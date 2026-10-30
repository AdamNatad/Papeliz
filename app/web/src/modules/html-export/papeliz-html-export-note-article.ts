import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import { SKIP, visit } from 'unist-util-visit'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { readPapelizNoteFrontmatterProperties, type PapelizNoteFrontmatterProperty } from '../md-view/papeliz-note-frontmatter-properties'
import { papelizMdViewCalloutTitleClassName } from '../md-view/papeliz-remark-callouts'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { createPapelizHtmlExportHeadingIdMaker } from './papeliz-html-export-heading-ids'
import { createPapelizHtmlExportIconHastElement, type PapelizHtmlExportIconName } from './papeliz-html-export-icons'
import { getPapelizHtmlExportPictureMediaType, type PapelizHtmlExportVaultFileResolver } from './papeliz-html-export-vault-files'

// A note as an exported page's `<article>`: the same sanitized tree MD View's locked page draws
// (`renderPapelizMdViewNote`), with the steps a page outside Papeliz needs. Links between notes
// become links between pages, headings get ids, callouts and properties get MD View's icons, and
// mermaid blocks become drawn diagrams. Nothing from the note can become script: every step adds
// Papeliz's own markup to the sanitized tree, and the only markup taken whole is Mermaid's SVG,
// drawn in its strict mode.

export type PapelizHtmlExportTheme = 'light' | 'dark'

export type PapelizHtmlExportMermaidDrawResult = { mermaidDiagramSvgText: string } | { mermaidDiagramErrorMessage: string }

export type PapelizHtmlExportMermaidDiagramDrawer = (
  mermaidDiagramSource: string,
  htmlExportTheme: PapelizHtmlExportTheme,
) => Promise<PapelizHtmlExportMermaidDrawResult>

export interface PapelizHtmlExportNoteArticleOptions {
  vaultNoteRelativePath: string
  vaultNoteText: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  // The link from this note's page to another note's page, or null when that note isn't exported.
  getHtmlExportNotePageHref: (targetVaultNoteRelativePath: string) => string | null
  // Draws a mermaid block in a theme's colors; null keeps diagrams as their code.
  drawHtmlExportMermaidDiagramSvg: PapelizHtmlExportMermaidDiagramDrawer | null
  // Pictures and other files the note shows or links to; null leaves them as MD View shows them.
  htmlExportVaultFiles: PapelizHtmlExportVaultFiles | null
}

// How a page shows a file: a picture in it ('shown'), or a link to it ('linked').
export type PapelizHtmlExportVaultFileUse = 'shown' | 'linked'

export interface PapelizHtmlExportVaultFiles {
  resolveVaultFileReference: PapelizHtmlExportVaultFileResolver
  // Where the page finds a file: a `data:` URL inside a one-note page, a relative path in a
  // website. Null when the file can't go with the page.
  getVaultFileSource: (vaultFileRelativePath: string, vaultFileUse: PapelizHtmlExportVaultFileUse) => Promise<string | null>
}

export interface PapelizHtmlExportNoteArticle {
  noteArticleHastElement: HastElement
  noteFrontmatterProperties: PapelizNoteFrontmatterProperty[]
  // Whether any text is set in the code font, so the page knows to carry it.
  hasCodeText: boolean
}

const papelizHtmlExportLanguageTagPattern = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i

// A page's language: the note's `lang` property when it is a language tag, else English.
export function getPapelizHtmlExportNoteLanguageTag(noteFrontmatterProperties: readonly PapelizNoteFrontmatterProperty[]): string {
  const noteLanguageProperty = noteFrontmatterProperties.find((noteFrontmatterProperty) => noteFrontmatterProperty.frontmatterPropertyName.toLowerCase() === 'lang')
  const noteLanguageTag = noteLanguageProperty?.frontmatterPropertyValues[0] ?? ''
  return papelizHtmlExportLanguageTagPattern.test(noteLanguageTag) ? noteLanguageTag : 'en'
}

// The icon MD View shows for each callout kind (papeliz-md-view-rendered-page.tsx).
const papelizHtmlExportCalloutIconNamesByKind: Readonly<Record<string, PapelizHtmlExportIconName>> = {
  note: 'Info',
  info: 'Info',
  abstract: 'BookOpen',
  summary: 'BookOpen',
  tip: 'Lightbulb',
  hint: 'Lightbulb',
  important: 'CircleAlert',
  success: 'CircleCheck',
  check: 'CircleCheck',
  done: 'CircleCheck',
  todo: 'ListChecks',
  question: 'CircleHelp',
  help: 'CircleHelp',
  faq: 'CircleHelp',
  warning: 'TriangleAlert',
  caution: 'TriangleAlert',
  attention: 'TriangleAlert',
  danger: 'OctagonAlert',
  error: 'OctagonAlert',
  failure: 'OctagonAlert',
  bug: 'Flame',
  example: 'List',
  quote: 'Quote',
  cite: 'Quote',
}

const papelizHtmlExportCalloutIconSizePixels = 16
const papelizHtmlExportPropertyIconSizePixels = 14
const papelizHeadingTagNames: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

// The icon MD View shows on a property chip (papeliz-note-frontmatter-property-chips.tsx).
function getPapelizHtmlExportPropertyIconName(frontmatterPropertyName: string): PapelizHtmlExportIconName {
  const lowerCasePropertyName = frontmatterPropertyName.toLowerCase()
  if (lowerCasePropertyName === 'tags' || lowerCasePropertyName === 'tag') return 'Hash'
  if (lowerCasePropertyName === 'aliases' || lowerCasePropertyName === 'alias') return 'Link'
  if (/date|created|updated|modified|due/.test(lowerCasePropertyName)) return 'Calendar'
  return 'Tag'
}

function createHastElement(tagName: string, properties: HastElement['properties'], children: HastElementContent[]): HastElement {
  return { type: 'element', tagName, properties, children }
}

function createHastText(textValue: string): HastElementContent {
  return { type: 'text', value: textValue }
}

function getHastStringProperty(hastElement: HastElement, hastPropertyName: string): string | null {
  const hastPropertyValue = hastElement.properties[hastPropertyName]
  return typeof hastPropertyValue === 'string' ? hastPropertyValue : null
}

function hasHastClassName(hastElement: HastElement, hastClassName: string): boolean {
  const hastClassNames = hastElement.properties['className']
  return Array.isArray(hastClassNames) && hastClassNames.includes(hastClassName)
}

function collectHastText(hastNode: HastElementContent | HastRoot): string {
  if (hastNode.type === 'text') return hastNode.value
  if (hastNode.type === 'element' || hastNode.type === 'root') return hastNode.children.map((hastChild) => collectHastText(hastChild as HastElementContent)).join('')
  return ''
}

function isExternalLinkHref(linkHref: string): boolean {
  return /^(https?:|mailto:)/i.test(linkHref)
}

function decodeLinkHrefPart(linkHrefPart: string): string {
  try {
    return decodeURIComponent(linkHrefPart)
  } catch {
    return linkHrefPart
  }
}

// The source of a ```mermaid block (`<pre><code class="language-mermaid">`), or null for other code.
function readMermaidDiagramSource(hastPreElement: HastElement): string | null {
  const hastCodeElement = hastPreElement.children.find((hastChild): hastChild is HastElement => hastChild.type === 'element' && hastChild.tagName === 'code')
  if (hastCodeElement === undefined || !hasHastClassName(hastCodeElement, 'language-mermaid')) return null
  return collectHastText(hastCodeElement).replace(/\n$/, '')
}

function readMermaidDrawErrorMessage(mermaidDrawResult: PapelizHtmlExportMermaidDrawResult): string | null {
  return 'mermaidDiagramErrorMessage' in mermaidDrawResult ? mermaidDrawResult.mermaidDiagramErrorMessage : null
}

// A diagram as MD View shows it: drawn, or its source with one error line.
function createMermaidDiagramHastElement(
  mermaidDiagramSource: string,
  drawResultsByTheme: Readonly<Record<PapelizHtmlExportTheme, PapelizHtmlExportMermaidDrawResult>>,
): HastElement {
  const lightDrawResult = drawResultsByTheme.light
  const darkDrawResult = drawResultsByTheme.dark
  if (!('mermaidDiagramSvgText' in lightDrawResult) || !('mermaidDiagramSvgText' in darkDrawResult)) {
    const mermaidDiagramErrorMessage = readMermaidDrawErrorMessage(lightDrawResult) ?? readMermaidDrawErrorMessage(darkDrawResult) ?? 'unknown error'
    return createHastElement('div', { className: ['papeliz-mermaid-diagram', 'papeliz-mermaid-diagram-has-error'] }, [
      createHastElement('pre', { className: ['papeliz-mermaid-diagram-source'] }, [createHastText(mermaidDiagramSource)]),
      createHastElement('p', { className: ['papeliz-mermaid-diagram-error'] }, [createHastText(`This diagram can’t be drawn: ${mermaidDiagramErrorMessage}`)]),
    ])
  }
  // Mermaid's own SVG in its strict mode: labels are sanitized and nothing in it runs. The page
  // shows the drawing for its theme.
  return createHastElement('div', { className: ['papeliz-mermaid-diagram'], role: 'img', ariaLabel: 'Diagram' }, [
    createHastElement('div', { className: ['papeliz-html-export-mermaid-light'] }, [{ type: 'raw', value: lightDrawResult.mermaidDiagramSvgText }]),
    createHastElement('div', { className: ['papeliz-html-export-mermaid-dark'] }, [{ type: 'raw', value: darkDrawResult.mermaidDiagramSvgText }]),
  ])
}

// The tree from MD View holds no raw HTML (the pipeline drops it); this makes sure of it before
// Papeliz adds its own Mermaid drawings, the only raw markup an exported page carries.
function removeRawHastNodes(noteHastRoot: HastRoot): void {
  visit(noteHastRoot, 'raw', (_rawHastNode, rawHastNodeIndex, rawHastNodeParent) => {
    if (rawHastNodeParent === undefined || rawHastNodeIndex === undefined) return
    rawHastNodeParent.children.splice(rawHastNodeIndex, 1)
    return [SKIP, rawHastNodeIndex]
  })
}

async function drawMermaidDiagrams(noteHastRoot: HastRoot, drawHtmlExportMermaidDiagramSvg: PapelizHtmlExportMermaidDiagramDrawer): Promise<void> {
  const mermaidDiagramPlaces: Array<{ hastParent: HastRoot | HastElement; hastChildIndex: number; mermaidDiagramSource: string }> = []
  visit(noteHastRoot, 'element', (hastElement: HastElement, hastChildIndex, hastParent) => {
    if (hastElement.tagName !== 'pre' || hastChildIndex === undefined) return
    if (hastParent?.type !== 'element' && hastParent?.type !== 'root') return
    const mermaidDiagramSource = readMermaidDiagramSource(hastElement)
    if (mermaidDiagramSource !== null) mermaidDiagramPlaces.push({ hastParent, hastChildIndex, mermaidDiagramSource })
    return SKIP
  })
  // Mermaid draws one diagram at a time, so the drawings are made in turn.
  for (const { hastParent, hastChildIndex, mermaidDiagramSource } of mermaidDiagramPlaces) {
    const drawResultsByTheme: Record<PapelizHtmlExportTheme, PapelizHtmlExportMermaidDrawResult> =
      mermaidDiagramSource.trim().length === 0
        ? { light: { mermaidDiagramErrorMessage: 'the diagram is empty.' }, dark: { mermaidDiagramErrorMessage: 'the diagram is empty.' } }
        : { light: await drawHtmlExportMermaidDiagramSvg(mermaidDiagramSource, 'light'), dark: await drawHtmlExportMermaidDiagramSvg(mermaidDiagramSource, 'dark') }
    hastParent.children[hastChildIndex] = createMermaidDiagramHastElement(mermaidDiagramSource, drawResultsByTheme)
  }
}

// A link that leads nowhere outside Papeliz (its note isn't in the export) keeps MD View's look but
// has no address, so it reads as text.
function leaveLinkWithoutTarget(hastAnchorElement: HastElement, linkTitle: string): void {
  delete hastAnchorElement.properties['href']
  hastAnchorElement.properties['title'] = linkTitle
}

function pointLinkAtExportedNote(
  hastAnchorElement: HastElement,
  linkTargetNoteName: string,
  targetVaultNoteRelativePath: string,
  linkHrefFragment: string,
  articleOptions: PapelizHtmlExportNoteArticleOptions,
): void {
  if (targetVaultNoteRelativePath === articleOptions.vaultNoteRelativePath) {
    hastAnchorElement.properties['href'] = linkHrefFragment === '' ? '#' : linkHrefFragment
    return
  }
  const targetNotePageHref = articleOptions.getHtmlExportNotePageHref(targetVaultNoteRelativePath)
  if (targetNotePageHref === null) {
    leaveLinkWithoutTarget(hastAnchorElement, `“${linkTargetNoteName}” isn’t in this export`)
    return
  }
  hastAnchorElement.properties['href'] = `${targetNotePageHref}${linkHrefFragment}`
}

// A step that needs a file read, run after the tree is walked: it replaces one node in its parent.
type PapelizHtmlExportPendingStep = () => Promise<void>

interface PapelizHtmlExportNodePlace {
  hastParent: HastRoot | HastElement
  hastChildIndex: number
}

// "300" or "300x200" after the bar in `![[plan.png|300]]`: the picture's size, as notes write it.
const papelizHtmlExportPictureSizePattern = /^(\d{1,5})(?:x(\d{1,5}))?$/

function createVaultPictureHastElement(pictureSource: string, pictureLabelText: string, vaultFileRelativePath: string): HastElement {
  const pictureSizeMatch = papelizHtmlExportPictureSizePattern.exec(pictureLabelText.trim())
  const pictureProperties: HastElement['properties'] = { src: pictureSource, alt: pictureSizeMatch === null ? pictureLabelText : getVaultEntryName(vaultFileRelativePath), loading: 'lazy' }
  if (pictureSizeMatch !== null) {
    pictureProperties['width'] = pictureSizeMatch[1]
    if (pictureSizeMatch[2] !== undefined) pictureProperties['height'] = pictureSizeMatch[2]
  }
  return createHastElement('img', pictureProperties, [])
}

// A link or embed whose target is a vault file, not a note: an embedded picture shows, anything
// else links to the file's copy; a file that can't go with the page reads as text.
function pointAtVaultFile(
  hastAnchorElement: HastElement,
  nodePlace: PapelizHtmlExportNodePlace,
  vaultFileRelativePath: string,
  isWikilinkEmbed: boolean,
  htmlExportVaultFiles: PapelizHtmlExportVaultFiles,
): PapelizHtmlExportPendingStep {
  return async () => {
    const isShownPicture = isWikilinkEmbed && getPapelizHtmlExportPictureMediaType(vaultFileRelativePath) !== null
    const vaultFileSource = await htmlExportVaultFiles.getVaultFileSource(vaultFileRelativePath, isShownPicture ? 'shown' : 'linked')
    if (vaultFileSource === null) {
      leaveLinkWithoutTarget(hastAnchorElement, `“${getVaultEntryName(vaultFileRelativePath)}” isn’t in this export`)
      return
    }
    if (isShownPicture) {
      nodePlace.hastParent.children[nodePlace.hastChildIndex] = createVaultPictureHastElement(vaultFileSource, collectHastText(hastAnchorElement), vaultFileRelativePath)
      return
    }
    hastAnchorElement.properties['href'] = vaultFileSource
  }
}

// Wikilinks and links to vault files: a note first, as MD View opens them, then a file that isn't
// a note. Gives back a step when a file has to be read.
function prepareExportedLink(
  hastAnchorElement: HastElement,
  nodePlace: PapelizHtmlExportNodePlace | null,
  articleOptions: PapelizHtmlExportNoteArticleOptions,
): PapelizHtmlExportPendingStep | null {
  let linkTargetName: string
  let linkHrefFragment: string
  let isWikilinkEmbed = false
  const wikilinkTargetNoteName = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkTarget')
  if (wikilinkTargetNoteName !== null) {
    const wikilinkTargetHeading = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkHeading')
    linkTargetName = wikilinkTargetNoteName
    linkHrefFragment = wikilinkTargetHeading === null ? '' : `#${createPapelizHtmlExportHeadingIdMaker()(wikilinkTargetHeading)}`
    isWikilinkEmbed = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkEmbed') === 'true'
  } else {
    const linkHref = getHastStringProperty(hastAnchorElement, 'href')
    if (linkHref === null || linkHref.startsWith('#')) return null
    if (isExternalLinkHref(linkHref)) {
      hastAnchorElement.properties['target'] = '_blank'
      hastAnchorElement.properties['rel'] = ['noopener', 'noreferrer']
      return null
    }
    // A link to another file in the vault, `[text](Other note.md#part)`: MD View opens it as it
    // opens a wikilink to the same name.
    const linkHrefFragmentIndex = linkHref.indexOf('#')
    linkTargetName = decodeLinkHrefPart(linkHrefFragmentIndex === -1 ? linkHref : linkHref.slice(0, linkHrefFragmentIndex))
    linkHrefFragment = linkHrefFragmentIndex === -1 ? '' : linkHref.slice(linkHrefFragmentIndex)
  }
  const targetVaultNoteRelativePath = articleOptions.resolveWikilinkTarget(linkTargetName, articleOptions.vaultNoteRelativePath)
  if (targetVaultNoteRelativePath !== null) {
    pointLinkAtExportedNote(hastAnchorElement, linkTargetName, targetVaultNoteRelativePath, linkHrefFragment, articleOptions)
    return null
  }
  const htmlExportVaultFiles = articleOptions.htmlExportVaultFiles
  const targetVaultFileRelativePath = htmlExportVaultFiles?.resolveVaultFileReference(linkTargetName, articleOptions.vaultNoteRelativePath) ?? null
  if (htmlExportVaultFiles !== null && targetVaultFileRelativePath !== null && nodePlace !== null) {
    return pointAtVaultFile(hastAnchorElement, nodePlace, targetVaultFileRelativePath, isWikilinkEmbed, htmlExportVaultFiles)
  }
  leaveLinkWithoutTarget(hastAnchorElement, `“${linkTargetName}” isn’t a note yet`)
  return null
}

function addCalloutIcon(hastCalloutTitleElement: HastElement): void {
  const papelizCalloutKind = getHastStringProperty(hastCalloutTitleElement, 'dataPapelizCalloutKind') ?? 'note'
  const calloutIconName = papelizHtmlExportCalloutIconNamesByKind[papelizCalloutKind] ?? 'Info'
  hastCalloutTitleElement.children = [
    createPapelizHtmlExportIconHastElement(calloutIconName, papelizHtmlExportCalloutIconSizePixels),
    createHastElement('span', {}, hastCalloutTitleElement.children),
  ]
}

function createPicturePlaceholderHastElement(pictureAltText: string | null, pictureSource: string | null): HastElement {
  return createHastElement('span', { className: ['papeliz-md-view-image-placeholder'] }, [createHastText(`Image: ${pictureAltText || pictureSource || 'untitled'}`)])
}

// `![alt](…)`: `https:` pictures show as MD View shows them; a picture kept in the vault shows from
// its copy, and another kind of file (`![](brief.pdf)`) links to its copy. Anything else stays
// MD View's placeholder. Gives back a step when a file has to be read.
function preparePicture(hastImageElement: HastElement, nodePlace: PapelizHtmlExportNodePlace, articleOptions: PapelizHtmlExportNoteArticleOptions): PapelizHtmlExportPendingStep | null {
  const pictureSource = getHastStringProperty(hastImageElement, 'src')
  const pictureAltText = getHastStringProperty(hastImageElement, 'alt')
  if (pictureSource !== null && /^https:/i.test(pictureSource)) {
    nodePlace.hastParent.children[nodePlace.hastChildIndex] = createHastElement('img', { src: pictureSource, alt: pictureAltText ?? '', loading: 'lazy', referrerPolicy: 'no-referrer' }, [])
    return null
  }
  nodePlace.hastParent.children[nodePlace.hastChildIndex] = createPicturePlaceholderHastElement(pictureAltText, pictureSource)
  const htmlExportVaultFiles = articleOptions.htmlExportVaultFiles
  if (htmlExportVaultFiles === null || pictureSource === null) return null
  const vaultFileRelativePath = htmlExportVaultFiles.resolveVaultFileReference(decodeLinkHrefPart(pictureSource.replace(/[?#].*$/, '')), articleOptions.vaultNoteRelativePath)
  if (vaultFileRelativePath === null) return null
  return async () => {
    const isPicture = getPapelizHtmlExportPictureMediaType(vaultFileRelativePath) !== null
    const vaultFileSource = await htmlExportVaultFiles.getVaultFileSource(vaultFileRelativePath, isPicture ? 'shown' : 'linked')
    if (vaultFileSource === null) return
    nodePlace.hastParent.children[nodePlace.hastChildIndex] = isPicture
      ? createHastElement('img', { src: vaultFileSource, alt: pictureAltText ?? '', loading: 'lazy' }, [])
      : createHastElement('a', { href: vaultFileSource }, [createHastText(pictureAltText || getVaultEntryName(vaultFileRelativePath))])
  }
}

function createPropertyChipsHastElement(noteFrontmatterProperties: readonly PapelizNoteFrontmatterProperty[]): HastElement {
  return createHastElement(
    'ul',
    { className: ['papeliz-md-view-properties'], ariaLabel: 'Note properties' },
    noteFrontmatterProperties.map((noteFrontmatterProperty) =>
      createHastElement('li', { className: ['papeliz-md-view-property'] }, [
        createPapelizHtmlExportIconHastElement(getPapelizHtmlExportPropertyIconName(noteFrontmatterProperty.frontmatterPropertyName), papelizHtmlExportPropertyIconSizePixels),
        createHastElement('b', {}, [createHastText(noteFrontmatterProperty.frontmatterPropertyName)]),
        // The chip is a flex row, so this space shows nothing; it keeps the name and values apart
        // when the text is copied or searched.
        createHastText(' '),
        createHastElement('span', {}, [createHastText(noteFrontmatterProperty.frontmatterPropertyValues.join(', '))]),
      ]),
    ),
  )
}

export async function buildPapelizHtmlExportNoteArticle(articleOptions: PapelizHtmlExportNoteArticleOptions): Promise<PapelizHtmlExportNoteArticle> {
  const { noteFrontmatterText, noteHastRoot } = renderPapelizMdViewNote(articleOptions.vaultNoteText, {
    resolveWikilinkTarget: articleOptions.resolveWikilinkTarget,
    fromVaultNoteRelativePath: articleOptions.vaultNoteRelativePath,
  })
  removeRawHastNodes(noteHastRoot)

  let hasCodeText = false
  const makeHeadingId = createPapelizHtmlExportHeadingIdMaker()
  const pendingSteps: PapelizHtmlExportPendingStep[] = []
  visit(noteHastRoot, 'element', (hastElement: HastElement, hastChildIndex, hastParent) => {
    const nodePlace = hastChildIndex !== undefined && (hastParent?.type === 'element' || hastParent?.type === 'root') ? { hastParent, hastChildIndex } : null
    if (hastElement.tagName === 'code') hasCodeText = true
    if (hastElement.tagName === 'a') {
      const pendingStep = prepareExportedLink(hastElement, nodePlace, articleOptions)
      if (pendingStep !== null) pendingSteps.push(pendingStep)
    } else if (papelizHeadingTagNames.has(hastElement.tagName) && hastElement.properties['id'] === undefined) {
      const headingId = makeHeadingId(collectHastText(hastElement))
      if (headingId.length > 0) hastElement.properties['id'] = headingId
    } else if (hastElement.tagName === 'div' && hasHastClassName(hastElement, papelizMdViewCalloutTitleClassName)) addCalloutIcon(hastElement)
    else if (hastElement.tagName === 'img' && nodePlace !== null) {
      const pendingStep = preparePicture(hastElement, nodePlace, articleOptions)
      if (pendingStep !== null) pendingSteps.push(pendingStep)
      return SKIP
    }
  })
  // Files are read one at a time, in the note's order.
  for (const pendingStep of pendingSteps) await pendingStep()
  if (articleOptions.drawHtmlExportMermaidDiagramSvg !== null) await drawMermaidDiagrams(noteHastRoot, articleOptions.drawHtmlExportMermaidDiagramSvg)

  const noteFrontmatterProperties = noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(noteFrontmatterText)
  const noteArticleChildren: HastElementContent[] = []
  if (noteFrontmatterProperties.length > 0) noteArticleChildren.push(createPropertyChipsHastElement(noteFrontmatterProperties))
  noteArticleChildren.push(...(noteHastRoot.children as HastElementContent[]))
  if (articleOptions.vaultNoteText.trim().length === 0) {
    noteArticleChildren.push(createHastElement('p', { className: ['papeliz-md-view-empty-note'] }, [createHastText('This note is empty.')]))
  }
  return {
    noteArticleHastElement: createHastElement('article', { className: ['papeliz-md-view-article'] }, noteArticleChildren),
    noteFrontmatterProperties,
    hasCodeText,
  }
}
