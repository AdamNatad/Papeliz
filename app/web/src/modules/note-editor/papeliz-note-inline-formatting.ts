// Inline Markdown formats for a selected stretch of note text: bold, italic, underline,
// strikethrough, inline code, wikilink and link. Markdown has no underline mark, so underline is the
// HTML tag `<u>words</u>`, which MD View and most Markdown apps show underlined. Applying a format
// that is already there takes it off again. These are plain text changes, so the editor's commands
// and the tests share them.

export type PapelizInlineMarkdownFormat = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'inline-code' | 'wikilink' | 'link'

export const papelizUnderlineOpenTag = '<u>'
export const papelizUnderlineCloseTag = '</u>'

export interface PapelizInlineMarkdownTextChange {
  changeFrom: number
  changeTo: number
  insertedText: string
}

export interface PapelizInlineMarkdownFormatResult {
  textChanges: PapelizInlineMarkdownTextChange[]
  // Where the selection ends up, counted in the text after these changes.
  formattedSelectionFrom: number
  formattedSelectionTo: number
}

interface PapelizSymmetricInlineMarker {
  markerCharacter: string
  markerLength: number
  // Whether runs of the marker character this long on both sides mean the format is on. Italic and
  // bold share `*`: one or three stars are italic, two or more are bold.
  isMarkerRunApplied: (markerRunLength: number) => boolean
}

const papelizSymmetricInlineMarkers: Record<'bold' | 'italic' | 'strikethrough' | 'inline-code', PapelizSymmetricInlineMarker> = {
  bold: { markerCharacter: '*', markerLength: 2, isMarkerRunApplied: (markerRunLength) => markerRunLength >= 2 },
  italic: { markerCharacter: '*', markerLength: 1, isMarkerRunApplied: (markerRunLength) => markerRunLength % 2 === 1 },
  strikethrough: { markerCharacter: '~', markerLength: 2, isMarkerRunApplied: (markerRunLength) => markerRunLength >= 2 },
  'inline-code': { markerCharacter: '`', markerLength: 1, isMarkerRunApplied: (markerRunLength) => markerRunLength >= 1 },
}

const papelizLinkAddressPlaceholder = 'url'

function countMarkerRunBefore(noteText: string, runEnd: number, markerCharacter: string): number {
  let markerRunLength = 0
  while (runEnd - markerRunLength - 1 >= 0 && noteText[runEnd - markerRunLength - 1] === markerCharacter) markerRunLength += 1
  return markerRunLength
}

function countMarkerRunAfter(noteText: string, runStart: number, markerCharacter: string): number {
  let markerRunLength = 0
  while (runStart + markerRunLength < noteText.length && noteText[runStart + markerRunLength] === markerCharacter) markerRunLength += 1
  return markerRunLength
}

// The selection without the spaces at its ends: `** word **` does not render as bold.
function trimSelectionToText(noteText: string, selectionFrom: number, selectionTo: number): { trimmedFrom: number; trimmedTo: number } {
  let trimmedFrom = selectionFrom
  let trimmedTo = selectionTo
  while (trimmedFrom < trimmedTo && /\s/.test(noteText[trimmedFrom] ?? '')) trimmedFrom += 1
  while (trimmedTo > trimmedFrom && /\s/.test(noteText[trimmedTo - 1] ?? '')) trimmedTo -= 1
  return { trimmedFrom, trimmedTo }
}

interface PapelizInlineMarkdownFormatWrap {
  openingMarkerFrom: number
  openingMarkerTo: number
  closingMarkerFrom: number
  closingMarkerTo: number
}

// Finds the markers of `inlineMarkdownFormat` around the selection, either just outside it or as
// the selection's own first and last characters. Null when the format is not on.
export function findPapelizInlineMarkdownFormatWrap(
  noteText: string,
  selectionFrom: number,
  selectionTo: number,
  inlineMarkdownFormat: PapelizInlineMarkdownFormat,
): PapelizInlineMarkdownFormatWrap | null {
  const { trimmedFrom, trimmedTo } = trimSelectionToText(noteText, selectionFrom, selectionTo)
  if (inlineMarkdownFormat === 'wikilink') {
    if (noteText.slice(trimmedFrom - 2, trimmedFrom) === '[[' && noteText.slice(trimmedTo, trimmedTo + 2) === ']]') {
      return { openingMarkerFrom: trimmedFrom - 2, openingMarkerTo: trimmedFrom, closingMarkerFrom: trimmedTo, closingMarkerTo: trimmedTo + 2 }
    }
    if (trimmedTo - trimmedFrom >= 4 && noteText.startsWith('[[', trimmedFrom) && noteText.slice(trimmedTo - 2, trimmedTo) === ']]') {
      return { openingMarkerFrom: trimmedFrom, openingMarkerTo: trimmedFrom + 2, closingMarkerFrom: trimmedTo - 2, closingMarkerTo: trimmedTo }
    }
    return null
  }
  if (inlineMarkdownFormat === 'underline') {
    const openTagLength = papelizUnderlineOpenTag.length
    const closeTagLength = papelizUnderlineCloseTag.length
    if (
      noteText.slice(trimmedFrom - openTagLength, trimmedFrom).toLowerCase() === papelizUnderlineOpenTag &&
      noteText.slice(trimmedTo, trimmedTo + closeTagLength).toLowerCase() === papelizUnderlineCloseTag
    ) {
      return { openingMarkerFrom: trimmedFrom - openTagLength, openingMarkerTo: trimmedFrom, closingMarkerFrom: trimmedTo, closingMarkerTo: trimmedTo + closeTagLength }
    }
    const selectedText = noteText.slice(trimmedFrom, trimmedTo).toLowerCase()
    if (selectedText.length > openTagLength + closeTagLength && selectedText.startsWith(papelizUnderlineOpenTag) && selectedText.endsWith(papelizUnderlineCloseTag)) {
      return {
        openingMarkerFrom: trimmedFrom,
        openingMarkerTo: trimmedFrom + openTagLength,
        closingMarkerFrom: trimmedTo - closeTagLength,
        closingMarkerTo: trimmedTo,
      }
    }
    return null
  }
  if (inlineMarkdownFormat === 'link') {
    const linkAddressMatch = noteText[trimmedFrom - 1] === '[' ? /^\]\([^()\s]*\)/.exec(noteText.slice(trimmedTo)) : null
    if (linkAddressMatch === null) return null
    return {
      openingMarkerFrom: trimmedFrom - 1,
      openingMarkerTo: trimmedFrom,
      closingMarkerFrom: trimmedTo,
      closingMarkerTo: trimmedTo + linkAddressMatch[0].length,
    }
  }
  const { markerCharacter, markerLength, isMarkerRunApplied } = papelizSymmetricInlineMarkers[inlineMarkdownFormat]
  const markerRunBeforeLength = countMarkerRunBefore(noteText, trimmedFrom, markerCharacter)
  const markerRunAfterLength = countMarkerRunAfter(noteText, trimmedTo, markerCharacter)
  if (isMarkerRunApplied(markerRunBeforeLength) && isMarkerRunApplied(markerRunAfterLength)) {
    return { openingMarkerFrom: trimmedFrom - markerLength, openingMarkerTo: trimmedFrom, closingMarkerFrom: trimmedTo, closingMarkerTo: trimmedTo + markerLength }
  }
  const selectedText = noteText.slice(trimmedFrom, trimmedTo)
  const markerRunInsideStartLength = countMarkerRunAfter(selectedText, 0, markerCharacter)
  const markerRunInsideEndLength = countMarkerRunBefore(selectedText, selectedText.length, markerCharacter)
  if (
    selectedText.length > markerLength * 2 &&
    markerRunInsideStartLength < selectedText.length &&
    isMarkerRunApplied(markerRunInsideStartLength) &&
    isMarkerRunApplied(markerRunInsideEndLength)
  ) {
    return {
      openingMarkerFrom: trimmedFrom,
      openingMarkerTo: trimmedFrom + markerLength,
      closingMarkerFrom: trimmedTo - markerLength,
      closingMarkerTo: trimmedTo,
    }
  }
  return null
}

// Turns `inlineMarkdownFormat` on for the selection, or off when it is already on.
export function togglePapelizInlineMarkdownFormat(
  noteText: string,
  selectionFrom: number,
  selectionTo: number,
  inlineMarkdownFormat: PapelizInlineMarkdownFormat,
): PapelizInlineMarkdownFormatResult {
  const formatWrap = findPapelizInlineMarkdownFormatWrap(noteText, selectionFrom, selectionTo, inlineMarkdownFormat)
  if (formatWrap !== null) {
    const openingMarkerLength = formatWrap.openingMarkerTo - formatWrap.openingMarkerFrom
    return {
      textChanges: [
        { changeFrom: formatWrap.openingMarkerFrom, changeTo: formatWrap.openingMarkerTo, insertedText: '' },
        { changeFrom: formatWrap.closingMarkerFrom, changeTo: formatWrap.closingMarkerTo, insertedText: '' },
      ],
      formattedSelectionFrom: formatWrap.openingMarkerFrom,
      formattedSelectionTo: formatWrap.closingMarkerFrom - openingMarkerLength,
    }
  }

  const { trimmedFrom, trimmedTo } = trimSelectionToText(noteText, selectionFrom, selectionTo)
  const [openingMarker, closingMarker] =
    inlineMarkdownFormat === 'wikilink'
      ? ['[[', ']]']
      : inlineMarkdownFormat === 'underline'
        ? [papelizUnderlineOpenTag, papelizUnderlineCloseTag]
        : inlineMarkdownFormat === 'link'
        ? ['[', `](${papelizLinkAddressPlaceholder})`]
        : [
            papelizSymmetricInlineMarkers[inlineMarkdownFormat].markerCharacter.repeat(papelizSymmetricInlineMarkers[inlineMarkdownFormat].markerLength),
            papelizSymmetricInlineMarkers[inlineMarkdownFormat].markerCharacter.repeat(papelizSymmetricInlineMarkers[inlineMarkdownFormat].markerLength),
          ]
  const textChanges = [
    { changeFrom: trimmedFrom, changeTo: trimmedFrom, insertedText: openingMarker },
    { changeFrom: trimmedTo, changeTo: trimmedTo, insertedText: closingMarker },
  ]
  if (inlineMarkdownFormat === 'link') {
    // The address placeholder comes selected, ready to be typed over.
    const linkAddressFrom = trimmedTo + openingMarker.length + 2
    return { textChanges, formattedSelectionFrom: linkAddressFrom, formattedSelectionTo: linkAddressFrom + papelizLinkAddressPlaceholder.length }
  }
  return { textChanges, formattedSelectionFrom: trimmedFrom + openingMarker.length, formattedSelectionTo: trimmedTo + openingMarker.length }
}
