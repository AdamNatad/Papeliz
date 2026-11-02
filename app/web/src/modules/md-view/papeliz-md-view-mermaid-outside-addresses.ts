// A diagram draws with nothing from outside the vault: no picture, stylesheet or font from a web
// address (`http:`, `https:`, `//…`) or a `data:` address, so opening a note never contacts another
// host. Mermaid's strict mode still loads files four ways: an image shape's `img`
// (`A@{ img: "https://…" }`, loaded before anything is drawn), a sequence actor's `icon`, a label's
// HTML (`<img>`, `<video poster>`, `<input type=image>`) and CSS (`url()`, `image-set()`,
// `@import`) in a style, a class or the diagram's own settings. Each way is closed in four places:
// - the source, before Mermaid reads it (removeOutsideAddressesFromMermaidDiagramSource);
// - Mermaid's label sanitizer, which drops every element and attribute that loads a file
//   (papelizMermaidLabelSanitizerSettings), and which a diagram can't change;
// - what Mermaid parsed, before it draws (findOutsideAddressInParsedMermaidDiagram and
//   findOutsideAddressInMermaidDiagramSettings): a diagram that still asks for a file isn't drawn;
// - the drawing, before it is shown or exported (removeOutsideAddressesFromMermaidDiagramSvgText).

// What an image shape shows in place of its picture: a dashed frame with a picture sign, in a gray
// that reads on both themes. Pictures stored in the vault arrive with attachments in a later version.
const papelizMermaidPlaceholderPictureSvgText =
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72" fill="none" stroke="#8a8f98" stroke-width="2" stroke-linejoin="round">' +
  '<rect x="1" y="1" width="94" height="70" rx="6" stroke-dasharray="6 4"/><circle cx="34" cy="26" r="6"/><path d="M16 58 38 36l12 10 10-8 20 20z"/></svg>'

export const papelizMermaidPlaceholderPictureAddress = `data:image/svg+xml;base64,${btoa(papelizMermaidPlaceholderPictureSvgText)}`

export const papelizMermaidOutsideAddressErrorMessage = 'it loads a file from outside the vault, which Papeliz doesn’t allow.'

// Mermaid's label sanitizer (DOMPurify) in place of its own `FORBID_TAGS: ['style']`: no element or
// attribute that loads a file is left in a label's HTML. `svg` goes too, since its `<image>`,
// `<use>` and `<feImage>` can. A label keeps its text, its formatting and its links.
export const papelizMermaidLabelSanitizerSettings = {
  FORBID_TAGS: ['style', 'img', 'image', 'picture', 'source', 'video', 'audio', 'track', 'input', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'svg', 'use', 'feimage', 'mglyph'],
  FORBID_ATTR: ['src', 'srcset', 'poster', 'background', 'data', 'ping', 'action', 'formaction', 'xlink:href'],
}

// Settings a diagram can't change in its own settings: Mermaid's own list, then the label sanitizer
// and absolute marker links (`url(http://…#arrowhead)`).
export const papelizMermaidSecureSettingNames = ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'dompurifyConfig', 'arrowMarkerAbsolute']

// Goes after the `@` of `@import`, unseen: `@⁠import` is an at-rule CSS doesn't know, so it is
// skipped. Mermaid's statement reader refuses this character, so a function name is parted from its
// `(` by a space instead.
const papelizMermaidCssWordJoiner = '⁠'

function escapeTextForRegExp(literalText: string): string {
  return literalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One character of a CSS name, every way CSS reads it: itself in either case, a backslash before it
// (unless it is a hex digit), or its code in hex with up to six digits and one space after
// (`\75`, `\000075 ` for "u").
function describeCssNameCharacterPattern(cssNameCharacter: string): string {
  const characterVariants = [...new Set([cssNameCharacter.toLowerCase(), cssNameCharacter.toUpperCase()])]
  const characterHexCodes = characterVariants.map((characterVariant) => (characterVariant.codePointAt(0) ?? 0).toString(16))
  const characterPatterns = [escapeTextForRegExp(cssNameCharacter), `\\\\0{0,4}(?:${characterHexCodes.join('|')})(?:\\r\\n|[ \\t\\n\\r\\f])?`]
  if (!/[0-9a-f]/i.test(cssNameCharacter)) characterPatterns.push(`\\\\${escapeTextForRegExp(cssNameCharacter)}`)
  return `(?:${characterPatterns.join('|')})`
}

function describeCssNamePattern(cssName: string): string {
  return Array.from(cssName, describeCssNameCharacterPattern).join('')
}

// The CSS that loads a file: `url()` (but not `url(#id)`, a part of the same drawing), `image-set()`
// (`-webkit-image-set()` too), `image()`, `src()` and `@import`, written plainly or with escapes.
const papelizCssFileLoadingWordPatternSource = [
  `${describeCssNamePattern('url')}\\((?!\\s*["']?\\s*#)`,
  `${describeCssNamePattern('image-set')}\\(`,
  `${describeCssNamePattern('image')}\\(`,
  `${describeCssNamePattern('src')}\\(`,
  `@${describeCssNamePattern('import')}`,
].join('|')

const papelizCssFileLoadingWordPattern = new RegExp(papelizCssFileLoadingWordPatternSource, 'gi')
const papelizCssFileLoadingWordTestPattern = new RegExp(papelizCssFileLoadingWordPatternSource, 'i')

export function findCssFileLoadingWord(cssText: string): string | null {
  return papelizCssFileLoadingWordTestPattern.exec(cssText)?.[0] ?? null
}

// `url(…)` becomes `url (…)`, which CSS reads as a word and a bracket rather than a function, so the
// declaration holding it is dropped; `@import` becomes `@⁠import`.
export function neutralizeCssFileLoadingWords(cssText: string): string {
  return cssText.replace(papelizCssFileLoadingWordPattern, (cssFileLoadingWordText) =>
    cssFileLoadingWordText.startsWith('@') ? `@${papelizMermaidCssWordJoiner}${cssFileLoadingWordText.slice(1)}` : `${cssFileLoadingWordText.slice(0, -1)} (`,
  )
}

interface PapelizMermaidSourceEdit {
  editStart: number
  editEnd: number
  editReplacementText: string
}

function applyPapelizMermaidSourceEdits(mermaidSourceText: string, mermaidSourceEdits: readonly PapelizMermaidSourceEdit[]): string {
  let editedSourceText = mermaidSourceText
  for (const { editStart, editEnd, editReplacementText } of [...mermaidSourceEdits].sort((firstEdit, secondEdit) => secondEdit.editStart - firstEdit.editStart)) {
    editedSourceText = `${editedSourceText.slice(0, editStart)}${editReplacementText}${editedSourceText.slice(editEnd)}`
  }
  return editedSourceText
}

// Where a quoted YAML scalar starting at `quoteIndex` ends (after its closing quote). A double-quoted
// one ends at the next `"`, as Mermaid's own reader ends it; a single-quoted one at a `'` that isn't
// doubled.
function findShapeDataQuotedScalarEnd(shapeDataText: string, quoteIndex: number): number {
  if (shapeDataText[quoteIndex] === '"') {
    const closingQuoteIndex = shapeDataText.indexOf('"', quoteIndex + 1)
    return closingQuoteIndex === -1 ? shapeDataText.length : closingQuoteIndex + 1
  }
  for (let scanIndex = quoteIndex + 1; scanIndex < shapeDataText.length; scanIndex += 1) {
    if (shapeDataText[scanIndex] !== "'") continue
    if (shapeDataText[scanIndex + 1] === "'") scanIndex += 1
    else return scanIndex + 1
  }
  return shapeDataText.length
}

// Where a value starting at `valueStart` ends: a quoted scalar, a `[…]` or `{…}` collection, or plain
// text up to the next `,`, `}` or `]` (a one-line block, which Mermaid reads as `{…}`) or the end of
// the line (a block over several lines).
function findShapeDataValueEnd(shapeDataText: string, valueStart: number, isOneLineShapeData: boolean): number {
  const valueFirstCharacter = shapeDataText[valueStart]
  if (valueFirstCharacter === '"' || valueFirstCharacter === "'") return findShapeDataQuotedScalarEnd(shapeDataText, valueStart)
  if (valueFirstCharacter === '[' || valueFirstCharacter === '{') {
    let collectionDepth = 0
    for (let scanIndex = valueStart; scanIndex < shapeDataText.length; scanIndex += 1) {
      const scannedCharacter = shapeDataText[scanIndex]
      if (scannedCharacter === '"' || scannedCharacter === "'") scanIndex = findShapeDataQuotedScalarEnd(shapeDataText, scanIndex) - 1
      else if (scannedCharacter === '[' || scannedCharacter === '{') collectionDepth += 1
      else if ((scannedCharacter === ']' || scannedCharacter === '}') && (collectionDepth -= 1) === 0) return scanIndex + 1
    }
    return shapeDataText.length
  }
  const plainValueEndPattern = isOneLineShapeData ? /[,}\]]/g : /\n/g
  plainValueEndPattern.lastIndex = valueStart
  let plainValueEnd = plainValueEndPattern.exec(shapeDataText)?.index ?? shapeDataText.length
  while (plainValueEnd > valueStart && /[ \t\r]/.test(shapeDataText[plainValueEnd - 1] ?? '')) plainValueEnd -= 1
  return plainValueEnd
}

// Where the value after `key:` starts: on the key's line, or (a block over several lines) on the next
// line when that is indented further than the key's. Null when the key has no value.
function findShapeDataValueStart(shapeDataText: string, keyStart: number, keyColonEnd: number, isOneLineShapeData: boolean): number | null {
  const sameLineValueStart = keyColonEnd + (/^[ \t]*/.exec(shapeDataText.slice(keyColonEnd))?.[0].length ?? 0)
  const sameLineValueCharacter = shapeDataText[sameLineValueStart]
  const isValueOnKeyLine = sameLineValueCharacter !== undefined && sameLineValueCharacter !== '\n' && sameLineValueCharacter !== '\r'
  if (isValueOnKeyLine) return isOneLineShapeData && /[,}\]]/.test(sameLineValueCharacter) ? null : sameLineValueStart
  if (isOneLineShapeData) return null
  const keyLineIndentWidth = /^[ \t]*/.exec(shapeDataText.slice(shapeDataText.lastIndexOf('\n', keyStart) + 1))?.[0].length ?? 0
  const nextLineMatch = /^[ \t]*\r?\n([ \t]*)(?=\S)/.exec(shapeDataText.slice(keyColonEnd))
  return nextLineMatch !== null && (nextLineMatch[1]?.length ?? 0) > keyLineIndentWidth ? keyColonEnd + nextLineMatch[0].length : null
}

// The edits that give every `img` key in one shape-data block the placeholder picture, reading the
// block the way YAML does: a quote opens a string only where a value or key starts (`don't` is plain
// text), so a label that says "img:" is left alone. A double-quoted key with a backslash (YAML's
// escapes can spell `img` as `"\x69mg"`) is renamed, so Mermaid never reads it.
function findShapeDataPictureEdits(shapeDataText: string): PapelizMermaidSourceEdit[] {
  // Mermaid reads a block without line breaks (outside its strings) as `{…}`, and one with them as
  // block YAML.
  const isOneLineShapeData = !shapeDataText.replace(/"[^"]*"?/g, '""').includes('\n')
  const shapeDataEdits: PapelizMermaidSourceEdit[] = []
  let escapedShapeDataKeyCount = 0
  let previousSignificantCharacter = '{'
  let scanIndex = 0
  while (scanIndex < shapeDataText.length) {
    const scannedCharacter = shapeDataText[scanIndex] ?? ''
    if (scannedCharacter === ' ' || scannedCharacter === '\t' || scannedCharacter === '\r') {
      scanIndex += 1
      continue
    }
    if (scannedCharacter === '\n') previousSignificantCharacter = '\n'
    const isAtScalarStart = '{[,:?-\n'.includes(previousSignificantCharacter)
    // A tag or an anchor (`!!str img:`, `&name img:`) comes before the key or value it marks.
    if (isAtScalarStart && (scannedCharacter === '!' || scannedCharacter === '&')) {
      scanIndex += /^[^\s,{}[\]]+/.exec(shapeDataText.slice(scanIndex))?.[0].length ?? 1
      continue
    }
    const isQuotedScalar = isAtScalarStart && (scannedCharacter === '"' || scannedCharacter === "'")
    const plainWord = isAtScalarStart && !isQuotedScalar ? (/^[A-Za-z_][\w-]*/.exec(shapeDataText.slice(scanIndex))?.[0] ?? null) : null
    if (!isQuotedScalar && plainWord === null) {
      if (scannedCharacter !== '\n') previousSignificantCharacter = scannedCharacter
      scanIndex += 1
      continue
    }
    const scalarEnd = isQuotedScalar ? findShapeDataQuotedScalarEnd(shapeDataText, scanIndex) : scanIndex + (plainWord ?? '').length
    const keyColonMatch = /^\s*:/.exec(shapeDataText.slice(scalarEnd))
    if (keyColonMatch === null) {
      previousSignificantCharacter = shapeDataText[scalarEnd - 1] ?? previousSignificantCharacter
      scanIndex = scalarEnd
      continue
    }
    const keyText = isQuotedScalar ? shapeDataText.slice(scanIndex + 1, scalarEnd - 1) : (plainWord ?? '')
    const keyColonEnd = scalarEnd + keyColonMatch[0].length
    if (isQuotedScalar && scannedCharacter === '"' && keyText.includes('\\')) {
      escapedShapeDataKeyCount += 1
      shapeDataEdits.push({ editStart: scanIndex, editEnd: scalarEnd, editReplacementText: `"papelizEscapedShapeDataKey${escapedShapeDataKeyCount}"` })
    } else if (keyText === 'img') {
      const valueStart = findShapeDataValueStart(shapeDataText, scanIndex, keyColonEnd, isOneLineShapeData)
      const editStart = valueStart ?? keyColonEnd
      // A missing value is written in after the colon, over the spaces that followed it.
      const editEnd = valueStart === null ? keyColonEnd + (/^[ \t]*/.exec(shapeDataText.slice(keyColonEnd))?.[0].length ?? 0) : findShapeDataValueEnd(shapeDataText, valueStart, isOneLineShapeData)
      const spaceBeforeValue = editStart === keyColonEnd ? ' ' : ''
      shapeDataEdits.push({ editStart, editEnd, editReplacementText: `${spaceBeforeValue}"${papelizMermaidPlaceholderPictureAddress}"` })
      previousSignificantCharacter = '"'
      scanIndex = editEnd
      continue
    }
    previousSignificantCharacter = ':'
    scanIndex = keyColonEnd
  }
  return shapeDataEdits
}

// Each `@{…}` block (a node's or a link's shape data), found as Mermaid's reader finds it: a `"`
// opens or closes a string, and the block ends at the first `}` outside one.
function replacePicturesInMermaidShapeData(mermaidDiagramSource: string): string {
  const shapeDataEdits: PapelizMermaidSourceEdit[] = []
  for (let shapeDataStart = mermaidDiagramSource.indexOf('@{'); shapeDataStart !== -1; ) {
    const shapeDataTextStart = shapeDataStart + 2
    let shapeDataTextEnd = shapeDataTextStart
    for (let isInsideQuotedText = false; shapeDataTextEnd < mermaidDiagramSource.length && (isInsideQuotedText || mermaidDiagramSource[shapeDataTextEnd] !== '}'); shapeDataTextEnd += 1) {
      if (mermaidDiagramSource[shapeDataTextEnd] === '"') isInsideQuotedText = !isInsideQuotedText
    }
    for (const shapeDataEdit of findShapeDataPictureEdits(mermaidDiagramSource.slice(shapeDataTextStart, shapeDataTextEnd))) {
      shapeDataEdits.push({ ...shapeDataEdit, editStart: shapeDataEdit.editStart + shapeDataTextStart, editEnd: shapeDataEdit.editEnd + shapeDataTextStart })
    }
    shapeDataStart = mermaidDiagramSource.indexOf('@{', shapeDataTextEnd)
  }
  return applyPapelizMermaidSourceEdits(mermaidDiagramSource, shapeDataEdits)
}

// A diagram's settings: frontmatter at the very start, and `%%{init: …}%%` lines anywhere.
const papelizMermaidFrontmatterPattern = /^\s*---[\s\S]*?\n[ \t]*---/
const papelizMermaidDirectivePattern = /%%\{[\s\S]*?\}%%/g

// The diagram's type, lowercased ("flowchart", "sequencediagram"): the first word after its settings
// and comments.
function readMermaidDiagramTypeWord(mermaidDiagramSource: string): string {
  const diagramSourceWithoutSettings = mermaidDiagramSource.replace(papelizMermaidFrontmatterPattern, '').replace(papelizMermaidDirectivePattern, '')
  const firstStatementLine = diagramSourceWithoutSettings.split('\n').find((sourceLine) => sourceLine.trim().length > 0 && !sourceLine.trim().startsWith('%%'))
  return (firstStatementLine?.trim().split(/[\s;]/)[0] ?? '').toLowerCase()
}

const papelizMermaidSequenceActorPropertiesLinePattern = /^([ \t]*properties\b[^:\n]*:)([^\n]*)$/gim
const papelizMermaidSequenceActorDetailsLinePattern = /^[ \t]*details\b[^\n]*$/gim

function turnMermaidSourceLineIntoComment(mermaidSourceLine: string): string {
  return `%% ${mermaidSourceLine.trim()}`
}

// A sequence actor draws its `icon` property as a picture (`properties A: {"icon": "https://…"}`), so
// the icon is taken out of the JSON (read as JSON, which also reads `icon`); a line that isn't
// JSON becomes a comment. `details A: id` reads the same JSON from an element on the page, so it
// always becomes a comment.
function removePicturesFromMermaidSequenceActors(mermaidDiagramSource: string): string {
  return mermaidDiagramSource
    .replace(papelizMermaidSequenceActorDetailsLinePattern, turnMermaidSourceLineIntoComment)
    .replace(papelizMermaidSequenceActorPropertiesLinePattern, (propertiesLineText: string, propertiesLineStart: string, actorPropertiesJsonText: string) => {
      let actorProperties: unknown
      try {
        actorProperties = JSON.parse(actorPropertiesJsonText)
      } catch {
        return turnMermaidSourceLineIntoComment(propertiesLineText)
      }
      if (typeof actorProperties !== 'object' || actorProperties === null || Array.isArray(actorProperties)) return turnMermaidSourceLineIntoComment(propertiesLineText)
      if (!Object.hasOwn(actorProperties, 'icon')) return propertiesLineText
      const keptActorProperties = Object.fromEntries(Object.entries(actorProperties).filter(([actorPropertyName]) => actorPropertyName !== 'icon'))
      return Object.keys(keptActorProperties).length === 0 ? turnMermaidSourceLineIntoComment(propertiesLineText) : `${propertiesLineStart} ${JSON.stringify(keptActorProperties)}`
    })
}

// A statement whose text becomes CSS (`style`, `classDef`, `linkStyle`, C4's `UpdateElementStyle(…)`),
// from its keyword to the end of the statement (a `;` or the line's end).
const papelizMermaidCssStatementPattern = /(?<=^|;)[ \t]*(?:style|classDef|linkStyle|Update\w*Style|Add\w*Tag)\b[^;\n]*/gim

// CSS words that load a file are neutralized where the source holds CSS: its settings and its style
// statements. Elsewhere `url(…)` is ordinary diagram text (a node named `url` with round sides).
function neutralizeCssFileLoadingWordsInMermaidSource(mermaidDiagramSource: string): string {
  return mermaidDiagramSource
    .replace(papelizMermaidFrontmatterPattern, neutralizeCssFileLoadingWords)
    .replace(papelizMermaidDirectivePattern, neutralizeCssFileLoadingWords)
    .replace(papelizMermaidCssStatementPattern, neutralizeCssFileLoadingWords)
}

// An HTML tag in a diagram's source, `<name …>`, with its quoted values read whole.
export const papelizMermaidSourceHtmlTagPattern = /<[A-Za-z][^\s/>]*(?:[\s/](?:"[^"]*"|'[^']*'|[^"'>])*)?>/g
// Inside such a tag: a quoted value, kept as it is, or a `style` attribute with its value (in
// Mermaid's quotes too, `style=#quot;…#quot;`).
const papelizMermaidSourceHtmlTagStylePartPattern = /"[^"]*"|'[^']*'|(?<=[\s/"'])style\s*=\s*("[^"]*"|'[^']*'|#(?:quot|34);[\s\S]*?#(?:quot|34);|[^\s>]*)/gi

// A label's `style` attribute goes when it loads a file, or when it holds an escape (`&#117;`,
// `#117;`, `\75`) that could spell one once the label is read as HTML.
function removeFileLoadingStyleAttributesFromMermaidSourceHtml(mermaidDiagramSource: string): string {
  return mermaidDiagramSource.replace(papelizMermaidSourceHtmlTagPattern, (htmlTagText) =>
    htmlTagText.replace(papelizMermaidSourceHtmlTagStylePartPattern, (htmlTagPartText: string, styleAttributeValueText: string | undefined) => {
      if (styleAttributeValueText === undefined) return htmlTagPartText
      const styleAttributeCssText = styleAttributeValueText.replace(/^(?:["']|#(?:quot|34);)|(?:["']|#(?:quot|34);)$/g, '')
      const isStyleAttributeEscaped = /[&\\]|#\w+;/.test(styleAttributeCssText)
      return isStyleAttributeEscaped || findCssFileLoadingWord(styleAttributeCssText) !== null ? '' : htmlTagPartText
    }),
  )
}

// The source as Mermaid reads it: every image shape shows the placeholder picture, a sequence actor
// has no icon, and no setting, style statement or label style loads a file. A diagram without any
// of those comes back unchanged.
export function removeOutsideAddressesFromMermaidDiagramSource(mermaidDiagramSource: string): string {
  let guardedDiagramSource = replacePicturesInMermaidShapeData(mermaidDiagramSource)
  if (readMermaidDiagramTypeWord(guardedDiagramSource) === 'sequencediagram') guardedDiagramSource = removePicturesFromMermaidSequenceActors(guardedDiagramSource)
  guardedDiagramSource = neutralizeCssFileLoadingWordsInMermaidSource(guardedDiagramSource)
  return removeFileLoadingStyleAttributesFromMermaidSourceHtml(guardedDiagramSource)
}

// The names of a parsed value whose text becomes CSS: `styles`, `textStyles`, `cssStyles`,
// `bgColor`, `fontFamily`, `themeCSS` and the like.
const papelizMermaidCssValueNamePattern = /style|css|colou?r|font|fill|stroke|background|border|shadow/i

// An icon's name (`fa:fa-user`, `logos:aws`, `fa fa-book`) rather than an address.
function isMermaidIconName(mermaidIconText: string): boolean {
  return /^[\p{L}\p{N}_:\s-]*$/u.test(mermaidIconText)
}

// Walks everything Mermaid parsed (objects, arrays, maps and sets), with the name each value sits
// under, until `findOutsideAddressInValue` finds something. A map's keys are its data (a node's id),
// so its values, like an array's, sit under the name of the map itself.
function findOutsideAddressInParsedMermaidValues(
  parsedMermaidRootValue: unknown,
  findOutsideAddressInValue: (parsedValueName: string, parsedValue: unknown) => string | null,
): string | null {
  const pendingParsedValues: Array<{ parsedValueName: string; parsedValue: unknown }> = [{ parsedValueName: '', parsedValue: parsedMermaidRootValue }]
  const visitedParsedObjects = new Set<object>()
  for (let pendingParsedValue = pendingParsedValues.pop(); pendingParsedValue !== undefined; pendingParsedValue = pendingParsedValues.pop()) {
    const { parsedValueName, parsedValue } = pendingParsedValue
    const outsideAddressText = findOutsideAddressInValue(parsedValueName, parsedValue)
    if (outsideAddressText !== null) return outsideAddressText
    if (typeof parsedValue !== 'object' || parsedValue === null || visitedParsedObjects.has(parsedValue)) continue
    if (typeof Node !== 'undefined' && parsedValue instanceof Node) continue
    visitedParsedObjects.add(parsedValue)
    if (parsedValue instanceof Map || parsedValue instanceof Set || Array.isArray(parsedValue)) {
      for (const childParsedValue of parsedValue.values()) pendingParsedValues.push({ parsedValueName, parsedValue: childParsedValue })
    } else {
      for (const [childParsedValueName, childParsedValue] of Object.entries(parsedValue)) pendingParsedValues.push({ parsedValueName: childParsedValueName, parsedValue: childParsedValue })
    }
  }
  return null
}

// What a parsed diagram (Mermaid's `db`) would load when drawn, or null: an `img` other than the
// placeholder picture, an `icon` that is an address (a sequence actor draws it as a picture), or a
// style or color value with CSS that loads a file.
export function findOutsideAddressInParsedMermaidDiagram(parsedMermaidDiagramDb: unknown): string | null {
  return findOutsideAddressInParsedMermaidValues(parsedMermaidDiagramDb, (parsedValueName, parsedValue) => {
    if (parsedValueName === 'img') return parsedValue === undefined || parsedValue === null || parsedValue === '' || parsedValue === papelizMermaidPlaceholderPictureAddress ? null : String(parsedValue)
    if (typeof parsedValue !== 'string') return null
    if (parsedValueName === 'icon' && !isMermaidIconName(parsedValue)) return parsedValue
    return papelizMermaidCssValueNamePattern.test(parsedValueName) ? findCssFileLoadingWord(parsedValue) : null
  })
}

// A diagram's own settings as Mermaid read them (frontmatter `config:` and `%%{init}%%`, with YAML's
// and JSON's escapes read): any text in them with CSS that loads a file, or null.
export function findOutsideAddressInMermaidDiagramSettings(mermaidDiagramSettings: unknown): string | null {
  return findOutsideAddressInParsedMermaidValues(mermaidDiagramSettings, (_parsedValueName, parsedValue) => (typeof parsedValue === 'string' ? findCssFileLoadingWord(parsedValue) : null))
}

// Elements and attributes that load a file, wherever they sit in a drawing.
const papelizMermaidDrawingFileLoadingElementNames = new Set(['img', 'picture', 'source', 'video', 'audio', 'track', 'input', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'script', 'portal', 'mglyph'])
const papelizMermaidDrawingFileLoadingAttributeNames = new Set(['src', 'srcset', 'poster', 'background', 'data', 'ping', 'action', 'formaction', 'lowsrc', 'dynsrc'])

// Mermaid's drawing with nothing in it that loads a file: an `<image>` shows the placeholder picture,
// another element's link (`href`, `xlink:href`) may only point inside the drawing (`#id`) unless it
// is a link to follow (`<a>`), and the CSS in `<style>` and in attributes loads nothing. Read in an
// inert template, where nothing loads or runs; a drawing with nothing to clean comes back unchanged.
export function removeOutsideAddressesFromMermaidDiagramSvgText(mermaidDiagramSvgText: string): string {
  const mermaidDiagramTemplate = document.createElement('template')
  mermaidDiagramTemplate.innerHTML = mermaidDiagramSvgText
  let isDrawingCleaned = false
  for (const drawingElement of Array.from(mermaidDiagramTemplate.content.querySelectorAll('*'))) {
    const drawingElementName = drawingElement.localName.toLowerCase()
    if (papelizMermaidDrawingFileLoadingElementNames.has(drawingElementName)) {
      drawingElement.remove()
      isDrawingCleaned = true
      continue
    }
    if (drawingElementName === 'style') {
      const drawingCssText = drawingElement.textContent ?? ''
      const neutralizedDrawingCssText = neutralizeCssFileLoadingWords(drawingCssText)
      if (neutralizedDrawingCssText !== drawingCssText) {
        drawingElement.textContent = neutralizedDrawingCssText
        isDrawingCleaned = true
      }
    }
    for (const drawingAttribute of Array.from(drawingElement.attributes)) {
      const drawingAttributeName = drawingAttribute.name.toLowerCase()
      if (papelizMermaidDrawingFileLoadingAttributeNames.has(drawingAttributeName)) {
        drawingElement.removeAttributeNode(drawingAttribute)
        isDrawingCleaned = true
      } else if (drawingAttributeName === 'href' || drawingAttributeName === 'xlink:href') {
        if (drawingElementName === 'a') continue
        if (drawingElementName === 'image') {
          if (drawingAttribute.value === papelizMermaidPlaceholderPictureAddress) continue
          drawingAttribute.value = papelizMermaidPlaceholderPictureAddress
          isDrawingCleaned = true
        } else if (!/^\s*#/.test(drawingAttribute.value)) {
          drawingElement.removeAttributeNode(drawingAttribute)
          isDrawingCleaned = true
        }
      } else {
        const neutralizedAttributeValue = neutralizeCssFileLoadingWords(drawingAttribute.value)
        if (neutralizedAttributeValue !== drawingAttribute.value) {
          drawingAttribute.value = neutralizedAttributeValue
          isDrawingCleaned = true
        }
      }
    }
  }
  return isDrawingCleaned ? mermaidDiagramTemplate.innerHTML : mermaidDiagramSvgText
}
