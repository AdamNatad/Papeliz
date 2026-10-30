import { PapelizPdfExportError } from './papeliz-pdf-export-errors'

// A last look at the finished file before it is saved. It reads the classic cross-reference table and
// every object, and refuses the file if an offset is wrong, if anything names an action that runs or
// opens something (JavaScript, launching, another file, a form), an attached file, a font left out of
// the file, a font without its map back to the characters, or if a note with headings has no
// bookmarks. Strings and stream data are skipped, so a note named "/JavaScript" is still fine.

const papelizPdfExportForbiddenPdfNames: ReadonlySet<string> = new Set([
  'JavaScript',
  'JS',
  'Launch',
  'EmbeddedFile',
  'EmbeddedFiles',
  'FileAttachment',
  'GoToR',
  'GoToE',
  'SubmitForm',
  'ImportData',
  'RichMedia',
  'AcroForm',
  'OpenAction',
  'AA',
  'Encrypt',
])

const papelizPdfExportStandardFontNamePattern = /^(?:Helvetica|Times-|Times$|Courier|Symbol|ZapfDingbats|Arial)/

function failPapelizPdfExportFileCheck(fileCheckFailure: string): never {
  throw new PapelizPdfExportError('pdf-export-file-check-failed', `The finished PDF failed its check: ${fileCheckFailure}.`)
}

function readLatin1Text(pdfFileBytes: Uint8Array, startOffset: number, endOffset: number): string {
  let latin1Text = ''
  for (let byteOffset = startOffset; byteOffset < endOffset; byteOffset += 0x8000) {
    latin1Text += String.fromCharCode(...pdfFileBytes.subarray(byteOffset, Math.min(endOffset, byteOffset + 0x8000)))
  }
  return latin1Text
}

// The PDF syntax around strings: literal strings `( … )` (nested, with backslash escapes) and hex
// strings `< … >` become one space, so their text is never read as names.
function removePdfStrings(pdfSyntaxText: string): string {
  let syntaxWithoutStrings = ''
  let syntaxIndex = 0
  while (syntaxIndex < pdfSyntaxText.length) {
    const syntaxCharacter = pdfSyntaxText[syntaxIndex]
    if (syntaxCharacter === '(') {
      let stringDepth = 1
      syntaxIndex += 1
      while (syntaxIndex < pdfSyntaxText.length && stringDepth > 0) {
        const stringCharacter = pdfSyntaxText[syntaxIndex]
        if (stringCharacter === '\\') syntaxIndex += 1
        else if (stringCharacter === '(') stringDepth += 1
        else if (stringCharacter === ')') stringDepth -= 1
        syntaxIndex += 1
      }
      if (stringDepth !== 0) failPapelizPdfExportFileCheck('a string never ends')
      syntaxWithoutStrings += ' '
      continue
    }
    if (syntaxCharacter === '<' && pdfSyntaxText[syntaxIndex + 1] !== '<') {
      const hexStringEndIndex = pdfSyntaxText.indexOf('>', syntaxIndex)
      if (hexStringEndIndex === -1) failPapelizPdfExportFileCheck('a hex string never ends')
      syntaxIndex = hexStringEndIndex + 1
      syntaxWithoutStrings += ' '
      continue
    }
    if (syntaxCharacter === '<' || syntaxCharacter === '>') {
      syntaxWithoutStrings += pdfSyntaxText.slice(syntaxIndex, syntaxIndex + 2)
      syntaxIndex += 2
      continue
    }
    syntaxWithoutStrings += syntaxCharacter
    syntaxIndex += 1
  }
  return syntaxWithoutStrings
}

function checkPdfNames(pdfSyntaxText: string, pdfObjectName: string): void {
  const syntaxWithoutStrings = removePdfStrings(pdfSyntaxText)
  for (const pdfNameMatch of syntaxWithoutStrings.matchAll(/\/([^\s/<>[\]{}()%]+)/g)) {
    const pdfName = (pdfNameMatch[1] ?? '').replace(/#([0-9A-Fa-f]{2})/g, (_escapedCharacter, hexCode: string) => String.fromCharCode(Number.parseInt(hexCode, 16)))
    if (papelizPdfExportForbiddenPdfNames.has(pdfName)) failPapelizPdfExportFileCheck(`${pdfObjectName} names /${pdfName}`)
  }
  for (const baseFontMatch of syntaxWithoutStrings.matchAll(/\/BaseFont\s*\/([^\s/<>[\]{}()%]+)/g)) {
    const baseFontName = (baseFontMatch[1] ?? '').replace(/^[A-Z]{6}\+/, '')
    if (papelizPdfExportStandardFontNamePattern.test(baseFontName) && !/^[A-Z]{6}\+/.test(baseFontMatch[1] ?? '')) failPapelizPdfExportFileCheck(`${pdfObjectName} uses the font ${baseFontName} without embedding it`)
  }
  if (/\/Subtype\s*\/Type0\b/.test(syntaxWithoutStrings) && !/\/ToUnicode\b/.test(syntaxWithoutStrings)) failPapelizPdfExportFileCheck(`${pdfObjectName} is a font without its map back to the characters`)
}

interface PapelizPdfObjectPlace {
  pdfObjectNumber: number
  pdfObjectOffset: number
}

function readCrossReferenceTable(pdfFileBytes: Uint8Array, crossReferenceOffset: number, startXrefOffset: number): { pdfObjectPlaces: PapelizPdfObjectPlace[]; trailerText: string } {
  const crossReferenceText = readLatin1Text(pdfFileBytes, crossReferenceOffset, startXrefOffset)
  const crossReferenceLines = crossReferenceText.split(/\r\n|\r|\n/)
  if (crossReferenceLines[0]?.trim() !== 'xref') failPapelizPdfExportFileCheck('the cross-reference table is missing')
  const pdfObjectPlaces: PapelizPdfObjectPlace[] = []
  let crossReferenceLineIndex = 1
  while (crossReferenceLineIndex < crossReferenceLines.length) {
    const crossReferenceLine = (crossReferenceLines[crossReferenceLineIndex] ?? '').trim()
    if (crossReferenceLine.startsWith('trailer')) {
      return { pdfObjectPlaces, trailerText: crossReferenceLines.slice(crossReferenceLineIndex).join('\n') }
    }
    const subsectionMatch = /^(\d+) (\d+)$/.exec(crossReferenceLine)
    if (subsectionMatch === null) failPapelizPdfExportFileCheck('a cross-reference section is malformed')
    const firstPdfObjectNumber = Number(subsectionMatch[1])
    const pdfObjectCount = Number(subsectionMatch[2])
    for (let entryIndex = 0; entryIndex < pdfObjectCount; entryIndex += 1) {
      const entryMatch = /^(\d{10}) (\d{5}) ([nf])$/.exec((crossReferenceLines[crossReferenceLineIndex + 1 + entryIndex] ?? '').trim())
      if (entryMatch === null) failPapelizPdfExportFileCheck('a cross-reference entry is malformed')
      if (entryMatch[3] === 'n') pdfObjectPlaces.push({ pdfObjectNumber: firstPdfObjectNumber + entryIndex, pdfObjectOffset: Number(entryMatch[1]) })
    }
    crossReferenceLineIndex += 1 + pdfObjectCount
  }
  failPapelizPdfExportFileCheck('the trailer is missing')
}

export interface PapelizPdfExportFileCheckOptions {
  // A note with headings must open with its bookmarks.
  hasPdfBookmarks: boolean
}

export function checkPapelizPdfExportFileBytes(pdfFileBytes: Uint8Array, fileCheckOptions: PapelizPdfExportFileCheckOptions = { hasPdfBookmarks: false }): void {
  if (readLatin1Text(pdfFileBytes, 0, Math.min(8, pdfFileBytes.length)) !== '%PDF-1.7') failPapelizPdfExportFileCheck('it doesn’t start as a PDF 1.7 file')
  const tailStartOffset = Math.max(0, pdfFileBytes.length - 2_048)
  const tailText = readLatin1Text(pdfFileBytes, tailStartOffset, pdfFileBytes.length)
  const startXrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(tailText)
  if (startXrefMatch === null) failPapelizPdfExportFileCheck('its end is malformed')
  const crossReferenceOffset = Number(startXrefMatch[1])
  const startXrefOffset = tailStartOffset + startXrefMatch.index
  if (crossReferenceOffset <= 0 || crossReferenceOffset >= startXrefOffset) failPapelizPdfExportFileCheck('the cross-reference table is out of place')
  const { pdfObjectPlaces, trailerText } = readCrossReferenceTable(pdfFileBytes, crossReferenceOffset, startXrefOffset)
  if (pdfObjectPlaces.length === 0) failPapelizPdfExportFileCheck('it holds no objects')
  if (/\/(?:Prev|XRefStm|Encrypt)\b/.test(trailerText) || !/\/Root\s+\d+ \d+ R/.test(trailerText) || !/\/ID\s*\[/.test(trailerText)) failPapelizPdfExportFileCheck('its trailer is malformed')
  const pdfObjectPlacesInFileOrder = [...pdfObjectPlaces].sort((leftPlace, rightPlace) => leftPlace.pdfObjectOffset - rightPlace.pdfObjectOffset)
  let hasOutlines = false
  pdfObjectPlacesInFileOrder.forEach((pdfObjectPlace, pdfObjectPlaceIndex) => {
    const pdfObjectEndOffset = pdfObjectPlacesInFileOrder[pdfObjectPlaceIndex + 1]?.pdfObjectOffset ?? crossReferenceOffset
    if (pdfObjectEndOffset <= pdfObjectPlace.pdfObjectOffset) failPapelizPdfExportFileCheck('two objects overlap')
    const pdfObjectName = `object ${pdfObjectPlace.pdfObjectNumber}`
    const pdfObjectHeadText = readLatin1Text(pdfFileBytes, pdfObjectPlace.pdfObjectOffset, Math.min(pdfObjectEndOffset, pdfObjectPlace.pdfObjectOffset + 32))
    if (!new RegExp(`^${pdfObjectPlace.pdfObjectNumber} 0 obj\\b`).test(pdfObjectHeadText)) failPapelizPdfExportFileCheck(`the table points beside ${pdfObjectName}`)
    const pdfObjectText = readLatin1Text(pdfFileBytes, pdfObjectPlace.pdfObjectOffset, pdfObjectEndOffset)
    const streamKeywordMatch = />>\s*stream(?:\r\n|\n)/.exec(pdfObjectText)
    if (streamKeywordMatch === null) {
      checkPdfNames(pdfObjectText, pdfObjectName)
      if (/\/Outlines\s+\d+\s+\d+\s+R/.test(removePdfStrings(pdfObjectText))) hasOutlines = true
      return
    }
    const streamDictionaryText = pdfObjectText.slice(0, streamKeywordMatch.index + 2)
    const streamLengthMatch = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(streamDictionaryText)
    if (streamLengthMatch === null) failPapelizPdfExportFileCheck(`${pdfObjectName} has a stream without its length`)
    const streamDataEndIndex = streamKeywordMatch.index + streamKeywordMatch[0].length + Number(streamLengthMatch[1])
    if (!/^\s*endstream\b/.test(pdfObjectText.slice(streamDataEndIndex, streamDataEndIndex + 16))) failPapelizPdfExportFileCheck(`${pdfObjectName} has a stream of the wrong length`)
    checkPdfNames(streamDictionaryText, pdfObjectName)
    checkPdfNames(pdfObjectText.slice(streamDataEndIndex).replace(/^\s*endstream/, ''), pdfObjectName)
  })
  checkPdfNames(trailerText, 'the trailer')
  if (fileCheckOptions.hasPdfBookmarks && !hasOutlines) failPapelizPdfExportFileCheck('the note has headings, yet the file has no bookmarks')
}
