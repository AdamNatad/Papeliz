import { inflateSync } from 'node:zlib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { splitPapelizPdfExportTextByBundledFontFile } from './papeliz-pdf-export-fonts'
import { writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import {
  buildPapelizPdfExportTestNotePdfJob,
  collectPapelizPdfExportNoteDocumentText,
  papelizPdfExportTestVaultNotes,
  readPapelizPdfExportFileLatin1Text,
  removePapelizPdfExportTestWhitespace,
} from './papeliz-pdf-export.test-support'

// Phase 6 of the PDF export: the accessibility check. veraPDF runs by hand on the files
// `papeliz-pdf-export-verapdf-files.test.ts` writes; these are the PDF/UA-1 (Matterhorn Protocol)
// checks that can be made from the file itself, on every sample and test note, on every test run: the catalog (language, marked, structure tree, title shown,
// metadata, and no PDF/UA claim yet); every page's tab order and structure parents; every mark on a
// page inside tagged content or an artifact; only standard structure types; heading tags that start
// at H1 and skip no level; alternate text on every figure; a scope on every table header; an ID on every note; a structure parent and a description on
// every link; every font embedded with its map to Unicode; and the text read through the tags, as a
// screen reader reads it, in the note's own order.

interface PapelizTestPdfObject {
  pdfObjectNumber: number
  pdfObjectDictionaryText: string
  pdfObjectStreamBytes: Uint8Array | null
}

// The file's objects: each dictionary as text, and its stream unpacked.
function readTestPdfObjects(pdfFileBytes: Uint8Array): PapelizTestPdfObject[] {
  const pdfLatin1Text = readPapelizPdfExportFileLatin1Text(pdfFileBytes)
  const pdfObjects: PapelizTestPdfObject[] = []
  for (const objectMatch of pdfLatin1Text.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) {
    const objectBodyText = objectMatch[2] ?? ''
    const streamStart = objectBodyText.search(/stream\r?\n/)
    let pdfObjectStreamBytes: Uint8Array | null = null
    let pdfObjectDictionaryText = objectBodyText
    if (streamStart >= 0) {
      pdfObjectDictionaryText = objectBodyText.slice(0, streamStart)
      const streamLength = Number(/\/Length (\d+)/.exec(pdfObjectDictionaryText)?.[1] ?? 0)
      const streamOffset = (objectMatch.index ?? 0) + objectMatch[0].indexOf(objectBodyText) + streamStart + (/stream\r?\n/.exec(objectBodyText.slice(streamStart))?.[0].length ?? 7)
      const rawStreamBytes = pdfFileBytes.subarray(streamOffset, streamOffset + streamLength)
      pdfObjectStreamBytes = /\/FlateDecode/.test(pdfObjectDictionaryText) && !/\/Subtype \/Image/.test(pdfObjectDictionaryText) ? new Uint8Array(inflateSync(rawStreamBytes)) : rawStreamBytes
    }
    pdfObjects.push({ pdfObjectNumber: Number(objectMatch[1]), pdfObjectDictionaryText, pdfObjectStreamBytes })
  }
  return pdfObjects
}

// The operators of a content stream with their marked-content depth: strings, names, arrays and
// dictionaries are skipped as operands.
function listContentOperators(contentStreamBytes: Uint8Array): Array<{ contentOperator: string; markedContentDepth: number; markedContentTag: string }> {
  const contentText = Buffer.from(contentStreamBytes).toString('latin1')
  const contentOperators: Array<{ contentOperator: string; markedContentDepth: number; markedContentTag: string }> = []
  const markedContentTags: string[] = []
  let lastNameOperand = ''
  let lastDictionaryText = ''
  let textIndex = 0
  while (textIndex < contentText.length) {
    const character = contentText[textIndex] ?? ''
    if (/\s/.test(character)) {
      textIndex += 1
    } else if (character === '(') {
      let parenthesisDepth = 0
      for (; textIndex < contentText.length; textIndex += 1) {
        const stringCharacter = contentText[textIndex]
        if (stringCharacter === '\\') textIndex += 1
        else if (stringCharacter === '(') parenthesisDepth += 1
        else if (stringCharacter === ')' && --parenthesisDepth === 0) break
      }
      textIndex += 1
    } else if (character === '<' && contentText[textIndex + 1] === '<') {
      const dictionaryEnd = contentText.indexOf('>>', textIndex)
      lastDictionaryText = contentText.slice(textIndex, dictionaryEnd + 2)
      textIndex = dictionaryEnd + 2
    } else if (character === '<') {
      textIndex = contentText.indexOf('>', textIndex) + 1
    } else if (character === '[' || character === ']') {
      textIndex += 1
    } else if (character === '/') {
      const nameMatch = /^\/[^\s/<>[\]()]*/.exec(contentText.slice(textIndex)) ?? ['/']
      lastNameOperand = nameMatch[0]
      textIndex += nameMatch[0].length
    } else {
      const wordMatch = /^[^\s/<>[\]()]+/.exec(contentText.slice(textIndex)) ?? [character]
      const word = wordMatch[0]
      textIndex += word.length
      if (/^[-+.\d]/.test(word)) continue
      if (word === 'BDC' || word === 'BMC') markedContentTags.push(`${lastNameOperand} ${word === 'BDC' ? lastDictionaryText : ''}`)
      else if (word === 'EMC') markedContentTags.pop()
      contentOperators.push({ contentOperator: word, markedContentDepth: markedContentTags.length, markedContentTag: markedContentTags.join(' > ') })
    }
  }
  return contentOperators
}

const papelizMarkingContentOperators: ReadonlySet<string> = new Set(['f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'S', 's', 'Tj', 'TJ', "'", '"', 'Do', 'sh', 'BI'])
// PDF 1.7's standard structure types Papeliz writes.
const papelizStandardStructureRoles: ReadonlySet<string> = new Set(['Document', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'L', 'LI', 'Lbl', 'LBody', 'Link', 'Table', 'TR', 'TH', 'TD', 'Figure', 'Code', 'BlockQuote', 'Note', 'Div', 'Span'])

interface PapelizPdfJsStructureNode {
  role?: string
  alt?: string
  type?: string
  id?: string
  children?: PapelizPdfJsStructureNode[]
}

// The text a screen reader meets through the tags: each page's structure tree walked in order, each
// marked content's text where the tree points to it.
async function readTextThroughTags(pdfFileBytes: Uint8Array): Promise<{ taggedText: string; structureNodes: PapelizPdfJsStructureNode[] }> {
  const pdfJsLoadingTask = getDocument({ data: pdfFileBytes.slice(), verbosity: 0, useSystemFonts: false, disableFontFace: true })
  const pdfJsDocument = await pdfJsLoadingTask.promise
  const taggedTextParts: string[] = []
  const structureNodes: PapelizPdfJsStructureNode[] = []
  try {
    for (let pageNumber = 1; pageNumber <= pdfJsDocument.numPages; pageNumber += 1) {
      const pdfJsPage = await pdfJsDocument.getPage(pageNumber)
      const textContent = await pdfJsPage.getTextContent({ includeMarkedContent: true })
      const markedContentTexts = new Map<string, string>()
      const openMarkedContentIds: string[] = []
      for (const textItem of textContent.items as Array<{ type?: string; id?: string; str?: string }>) {
        if (textItem.type === 'beginMarkedContentProps' || textItem.type === 'beginMarkedContent') openMarkedContentIds.push(textItem.id ?? '')
        else if (textItem.type === 'endMarkedContent') openMarkedContentIds.pop()
        else if (textItem.str !== undefined) {
          const markedContentId = openMarkedContentIds.at(-1) ?? ''
          markedContentTexts.set(markedContentId, (markedContentTexts.get(markedContentId) ?? '') + textItem.str)
        }
      }
      const walkStructureNode = (structureNode: PapelizPdfJsStructureNode) => {
        structureNodes.push(structureNode)
        if (structureNode.type === 'content' && structureNode.id !== undefined) taggedTextParts.push(markedContentTexts.get(structureNode.id) ?? '')
        for (const childNode of structureNode.children ?? []) walkStructureNode(childNode)
      }
      const pageStructureTree = (await pdfJsPage.getStructTree()) as PapelizPdfJsStructureNode | null
      if (pageStructureTree !== null) walkStructureNode(pageStructureTree)
    }
  } finally {
    await pdfJsLoadingTask.destroy()
  }
  return { taggedText: taggedTextParts.join(''), structureNodes }
}

describe('PDF export accessibility', () => {
  it('passes the PDF/UA checks that can be made from the file, on every sample and test note', async () => {
    // What the checks met, so they can't pass by meeting nothing.
    const checkedCounts = { tableHeaderCells: 0, notes: 0, linkAnnotations: 0, markingOperators: 0, artifactOperators: 0, structureNodes: 0, headingTags: 0 }
    for (const { vaultNoteRelativePath, vaultNoteText } of papelizPdfExportTestVaultNotes) {
      const notePdfJob = await buildPapelizPdfExportTestNotePdfJob(vaultNoteRelativePath, vaultNoteText)
      const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
      const pdfObjects = readTestPdfObjects(pdfFileBytes)
      const findObject = (objectReferenceText: string | undefined) => pdfObjects.find((pdfObject) => `${pdfObject.pdfObjectNumber} 0 R` === objectReferenceText)
      const catalogText = pdfObjects.find((pdfObject) => /\/Type \/Catalog/.test(pdfObject.pdfObjectDictionaryText))?.pdfObjectDictionaryText ?? ''
      // The catalog: a language, marked, a structure tree, the title shown, metadata.
      expect(/\/Lang \(([^)]+)\)/.exec(catalogText)?.[1], vaultNoteRelativePath).toMatch(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/)
      expect(findObject(/\/MarkInfo (\d+ 0 R)/.exec(catalogText)?.[1])?.pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/Marked true/)
      expect(catalogText, vaultNoteRelativePath).toMatch(/\/StructTreeRoot \d+ 0 R/)
      expect(findObject(/\/ViewerPreferences (\d+ 0 R)/.exec(catalogText)?.[1])?.pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/DisplayDocTitle true/)
      const metadataText = Buffer.from(findObject(/\/Metadata (\d+ 0 R)/.exec(catalogText)?.[1])?.pdfObjectStreamBytes ?? new Uint8Array()).toString('utf8')
      expect(metadataText, vaultNoteRelativePath).toContain('dc:title')
      // No PDF/UA claim until veraPDF and a screen reader have checked the file.
      expect(metadataText, vaultNoteRelativePath).not.toContain('pdfuaid')
      // Every page: tabs in structure order, and its place in the structure's parent tree.
      const pageObjects = pdfObjects.filter((pdfObject) => /\/Type \/Page\b(?!s)/.test(pdfObject.pdfObjectDictionaryText))
      expect(pageObjects.length, vaultNoteRelativePath).toBeGreaterThan(0)
      for (const pageObject of pageObjects) {
        expect(pageObject.pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/Tabs \/S/)
        expect(pageObject.pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/StructParents \d+/)
        // Every mark on the page is tagged content (with its MCID) or an artifact.
        const contentObject = findObject(/\/Contents (\d+ 0 R)/.exec(pageObject.pdfObjectDictionaryText)?.[1])
        for (const { contentOperator, markedContentDepth, markedContentTag } of listContentOperators(contentObject?.pdfObjectStreamBytes ?? new Uint8Array())) {
          if (!papelizMarkingContentOperators.has(contentOperator)) continue
          checkedCounts.markingOperators += 1
          if (markedContentTag.includes('/Artifact')) checkedCounts.artifactOperators += 1
          expect(markedContentDepth, `${vaultNoteRelativePath}: ${contentOperator} outside tagged content`).toBeGreaterThan(0)
          expect(markedContentTag, `${vaultNoteRelativePath}: ${contentOperator}`).toMatch(/\/Artifact|\/MCID \d+/)
        }
      }
      // Tags: a table header names its scope, a note has an ID; a link annotation has its structure
      // parent and says where it leads; every font is embedded with its map to Unicode.
      for (const { pdfObjectDictionaryText } of pdfObjects) {
        if (/\/S \/TH\b/.test(pdfObjectDictionaryText)) {
          checkedCounts.tableHeaderCells += 1
          expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/Scope \/Column/)
        }
        if (/\/S \/Note\b/.test(pdfObjectDictionaryText)) {
          checkedCounts.notes += 1
          expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/ID \(/)
        }
        if (/\/Subtype \/Link/.test(pdfObjectDictionaryText)) {
          checkedCounts.linkAnnotations += 1
          expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/StructParent \d+/)
          expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/Contents \(/)
        }
        if (/\/Subtype \/Type0/.test(pdfObjectDictionaryText)) expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/ToUnicode \d+ 0 R/)
        if (/\/Type \/FontDescriptor/.test(pdfObjectDictionaryText)) expect(pdfObjectDictionaryText, vaultNoteRelativePath).toMatch(/\/FontFile[23] \d+ 0 R/)
      }
      const { taggedText, structureNodes } = await readTextThroughTags(pdfFileBytes)
      checkedCounts.structureNodes += structureNodes.length
      let lastHeadingTagLevel = 0
      for (const structureNode of structureNodes) {
        if (structureNode.role === undefined) continue
        expect(papelizStandardStructureRoles.has(structureNode.role) || structureNode.role === 'Root', `${vaultNoteRelativePath}: ${structureNode.role}`).toBe(true)
        if (structureNode.role === 'Figure') expect((structureNode.alt ?? '').trim().length, `${vaultNoteRelativePath}: a figure without alternate text`).toBeGreaterThan(0)
        // Heading tags start at H1 and never skip a level going down.
        const headingTagLevel = Number(/^H([1-6])$/.exec(structureNode.role)?.[1] ?? 0)
        if (headingTagLevel > 0) {
          checkedCounts.headingTags += 1
          expect(headingTagLevel, `${vaultNoteRelativePath}: heading tag H${headingTagLevel} after H${lastHeadingTagLevel}`).toBeLessThanOrEqual(lastHeadingTagLevel + 1)
          lastHeadingTagLevel = headingTagLevel
        }
      }
      // Read through the tags, the note's text comes in its own order (characters no bundled font
      // has print as boxes in these tests, so only the printed ones are compared).
      const sansTextFontStyle = { fontFamilyName: 'figtree', fontWeight: 400, isFontItalic: false } as const
      const keepPrintedCharacters = (comparedText: string) =>
        splitPapelizPdfExportTextByBundledFontFile(removePapelizPdfExportTestWhitespace(comparedText).replace(/\p{Cc}/gu, ''), sansTextFontStyle)
          .filter((bundledFontSegment) => bundledFontSegment.fontFaceKey !== null)
          .map((bundledFontSegment) => bundledFontSegment.segmentText)
          .join('')
      expect(keepPrintedCharacters(taggedText), vaultNoteRelativePath).toBe(keepPrintedCharacters(collectPapelizPdfExportNoteDocumentText(notePdfJob.pdfExportNoteDocument)))
    }
    for (const [checkedThing, checkedCount] of Object.entries(checkedCounts)) expect(checkedCount, checkedThing).toBeGreaterThan(0)
    console.info('PDF/UA checks met:', JSON.stringify(checkedCounts))
  }, 120_000)
})
