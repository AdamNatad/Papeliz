import { describe, expect, it } from 'vitest'
import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import {
  describePapelizPdfExportFile,
  exportPapelizNotesAsPdf,
  getPapelizPdfExportZipEntryPaths,
} from './papeliz-pdf-export'
import { PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { choosePapelizPdfExportFontWeight, splitPapelizPdfExportTextBySubset } from './papeliz-pdf-export-fonts'
import { resolvePapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import { planPapelizPdfExportNotePages, writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportPageLayoutPlan, PapelizPdfExportTextRunOperation } from './papeliz-pdf-export-page-layout-plan'
import {
  buildPapelizPdfExportTestNotePdfJob,
  collectPapelizPdfExportNoteDocumentText,
  getPapelizPdfExportTestNoteText,
  papelizPdfExportInPlaceNotePdfWriter,
  papelizPdfExportTestVaultNotes,
  readPapelizPdfExportBodyText,
  readPapelizPdfExportFileLatin1Text,
  readPapelizPdfExportFileWithPdfJs,
  readPapelizPdfExportTestFontFile,
  removePapelizPdfExportTestWhitespace,
} from './papeliz-pdf-export.test-support'

function listPlanTextRuns(pageLayoutPlan: PapelizPdfExportPageLayoutPlan, pageIndex: number): PapelizPdfExportTextRunOperation[] {
  return (pageLayoutPlan.pdfExportPages[pageIndex]?.pageOperations ?? []).filter(
    (pageOperation): pageOperation is PapelizPdfExportTextRunOperation => pageOperation.pageOperationKind === 'text-run',
  )
}

// A plan as readable lines, one per drawing, so a layout change shows as a diff.
function summarizePageLayoutPlan(pageLayoutPlan: PapelizPdfExportPageLayoutPlan): string[][] {
  return pageLayoutPlan.pdfExportPages.map((pagePlan) =>
    pagePlan.pageOperations.map((pageOperation) => {
      switch (pageOperation.pageOperationKind) {
        case 'text-run':
          return `text ${pageOperation.fontFaceKey} ${pageOperation.textSizePoints} ${pageOperation.textLeftPoints},${pageOperation.textBaselinePoints} ${pageOperation.textRunText}`
        case 'rectangle':
          return `box ${pageOperation.rectangleLeftPoints},${pageOperation.rectangleTopPoints} ${pageOperation.rectangleWidthPoints}x${pageOperation.rectangleHeightPoints}`
        case 'line':
          return `line ${pageOperation.lineFromLeftPoints},${pageOperation.lineFromTopPoints} → ${pageOperation.lineToLeftPoints},${pageOperation.lineToTopPoints}`
        case 'path':
          return `shape ${pageOperation.pathLeftPoints},${pageOperation.pathTopPoints} ×${pageOperation.pathScale} ${pageOperation.pathData}`
        case 'link-area': {
          const { linkAreaTarget } = pageOperation
          return `link ${pageOperation.linkAreaLeftPoints},${pageOperation.linkAreaTopPoints} ${pageOperation.linkAreaWidthPoints}x${pageOperation.linkAreaHeightPoints} → ${linkAreaTarget.linkTargetKind === 'web' ? linkAreaTarget.webLinkAddress : `#${linkAreaTarget.noteDestinationName}`}`
        }
        case 'destination':
          return `place ${pageOperation.destinationName} at ${pageOperation.destinationTopPoints}`
      }
    }),
  )
}

// A note long enough for many pages: headings, paragraphs of several lines, and long code blocks.
function createLongTestNoteText(): string {
  const longNoteParts: string[] = ['# A long note']
  for (let sectionNumber = 1; sectionNumber <= 24; sectionNumber += 1) {
    longNoteParts.push(`## Section ${sectionNumber}`)
    for (let paragraphNumber = 1; paragraphNumber <= 3; paragraphNumber += 1) {
      longNoteParts.push(`Paragraph ${sectionNumber}.${paragraphNumber}: ${'The quick brown fox jumps over the lazy dog, then **rests** a while in the *shade*. '.repeat(paragraphNumber + 1)}`)
    }
    if (sectionNumber % 4 === 0) longNoteParts.push(['```ts', ...Array.from({ length: 30 }, (_codeLine, codeLineIndex) => `const papelizLine${codeLineIndex + 1} = ${codeLineIndex + 1}`), '```'].join('\n'))
  }
  return longNoteParts.join('\n\n')
}

describe('PDF export', () => {
  it('writes every sample and test note as a PDF that pdf.js reads back, with all its text in order', async () => {
    for (const { vaultNoteRelativePath, vaultNoteText } of papelizPdfExportTestVaultNotes) {
      const notePdfJob = await buildPapelizPdfExportTestNotePdfJob(vaultNoteRelativePath, vaultNoteText)
      const { pdfFileBytes, pdfPageCount, pdfExportNoteNotices } = await writePapelizPdfExportNotePdf(notePdfJob)
      const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)
      expect(pdfJsReading.pdfJsPageCount, vaultNoteRelativePath).toBe(pdfPageCount)
      expect(pdfJsReading.pdfJsPageSizes[0]).toEqual({ pageWidthPoints: 595.28, pageHeightPoints: 841.89 })
      expect(pdfJsReading.pdfJsTitle).toBe(notePdfJob.pdfExportDocumentTitle)
      expect(pdfJsReading.pdfJsStructureRoles).toContain('Document')
      // Characters no bundled font has print as boxes until they get pictures, and a box reads back
      // as U+0000, so only what the fonts print is compared, and the notice is checked.
      const expectedNoteText = collectPapelizPdfExportNoteDocumentText(notePdfJob.pdfExportNoteDocument)
      const keepPrintedCharacters = (comparedText: string) =>
        splitPapelizPdfExportTextBySubset(removePapelizPdfExportTestWhitespace(comparedText).replace(/\p{Cc}/gu, ''))
          .filter((textSubsetSegment) => textSubsetSegment.fontSubsetName !== null)
          .map((textSubsetSegment) => textSubsetSegment.segmentText)
          .join('')
      const hasUnprintedCharacters = splitPapelizPdfExportTextBySubset(expectedNoteText).some((textSubsetSegment) => textSubsetSegment.fontSubsetName === null)
      expect(pdfExportNoteNotices.length > 0, vaultNoteRelativePath).toBe(hasUnprintedCharacters)
      expect(keepPrintedCharacters(readPapelizPdfExportBodyText(pdfJsReading)), vaultNoteRelativePath).toBe(keepPrintedCharacters(expectedNoteText))
    }
  }, 60_000)

  it('embeds every font as a subset with its map back to the characters, and no font it leaves out', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md'))
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
    const pdfLatin1Text = readPapelizPdfExportFileLatin1Text(pdfFileBytes)
    const baseFontNames = [...pdfLatin1Text.matchAll(/\/BaseFont \/([^\s/]+)/g)].map((baseFontMatch) => baseFontMatch[1] ?? '')
    expect(baseFontNames.length).toBeGreaterThan(0)
    for (const baseFontName of baseFontNames) expect(baseFontName).toMatch(/^[A-Z]{6}\+(Figtree|JetBrainsMono)-/)
    expect(pdfLatin1Text.match(/\/FontFile2 /g)?.length).toBe(notePdfJob.pdfExportFontFiles.length)
    expect(pdfLatin1Text.match(/\/Subtype \/Type0/g)?.length).toBe(pdfLatin1Text.match(/\/ToUnicode /g)?.length)
    expect(pdfLatin1Text).not.toMatch(/\/(JavaScript|JS|Launch|EmbeddedFile|GoToR|SubmitForm)\b/)
  })

  it('writes the same bytes for the same note', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Start here.md', getPapelizPdfExportTestNoteText('Start here.md'))
    const firstPdfFile = await writePapelizPdfExportNotePdf(notePdfJob)
    const secondPdfFile = await writePapelizPdfExportNotePdf(notePdfJob)
    expect(secondPdfFile.pdfFileBytes).toEqual(firstPdfFile.pdfFileBytes)
  })

  it('prints on Letter paper when asked', async () => {
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Start here.md', getPapelizPdfExportTestNoteText('Start here.md'), 'sans', 'letter'))
    expect((await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)).pdfJsPageSizes[0]).toEqual({ pageWidthPoints: 612, pageHeightPoints: 792 })
  })

  it('keeps a note’s name whole in the document information and its XMP, and takes the language from `lang`', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('R&D <notes>.md', '---\nlang: de\n---\n\n# Plan\n\nText.')
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs((await writePapelizPdfExportNotePdf(notePdfJob)).pdfFileBytes)
    expect(pdfJsReading.pdfJsTitle).toBe('R&D <notes>')
    expect(pdfJsReading.pdfJsXmpTitle).toBe('R&D <notes>')
    expect(pdfJsReading.pdfJsLanguageTag).toBe('de')
    const pdfLatin1Text = readPapelizPdfExportFileLatin1Text((await writePapelizPdfExportNotePdf(notePdfJob)).pdfFileBytes)
    expect(pdfLatin1Text).not.toMatch(/\/Author|\/Subject|\/Keywords/)
  })

  it('tags headings, paragraphs and code, and marks the footer as page furniture', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Tags.md', '# Title\n\nA paragraph.\n\n## Part\n\n```\ncode()\n```')
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)
    expect(pdfJsReading.pdfJsStructureRoles).toEqual(['Root', 'Document', 'H1', 'P', 'H2', 'Code'])
    expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes)).toMatch(/\/Marked true/)
  })

  it('sets a Mono note’s code characters as they are, whatever ligatures the font has', async () => {
    const monoNoteText = 'Arrows a => b, c != d, e <= f, g -> h // done'
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Mono.md', monoNoteText, 'mono')
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs((await writePapelizPdfExportNotePdf(notePdfJob)).pdfFileBytes)
    expect(removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(pdfJsReading))).toBe(removePapelizPdfExportTestWhitespace(monoNoteText))
  })

  it('breaks a word longer than the line between its characters', async () => {
    const longWord = 'Papeliz'.repeat(60)
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Long word.md', `Before ${longWord} after`)
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(notePdfJob)
    const textRunBaselines = new Set(listPlanTextRuns(pageLayoutPlan, 0).filter((textRun) => textRun.operationTagging.operationTaggingKind === 'structure').map((textRun) => textRun.textBaselinePoints))
    expect(textRunBaselines.size).toBeGreaterThan(3)
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs((await writePapelizPdfExportNotePdf(notePdfJob)).pdfFileBytes)
    expect(removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(pdfJsReading))).toBe(`Before${longWord}after`)
  })

  it('keeps headings with what follows, two lines of a paragraph on each side of a break, and three of long code', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Long note.md', createLongTestNoteText())
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(notePdfJob)
    const structureRolesByKey = new Map(pageLayoutPlan.pdfExportStructureElements.map(({ structureElementKey, structureRole }) => [structureElementKey, structureRole]))
    expect(pageLayoutPlan.pdfExportPages.length).toBeGreaterThan(5)
    const lineCountsByStructureKey = new Map<string, number[]>()
    pageLayoutPlan.pdfExportPages.forEach((_pagePlan, pageIndex) => {
      const pageTextRuns = listPlanTextRuns(pageLayoutPlan, pageIndex)
      const bodyTextRuns = pageTextRuns.filter((textRun) => textRun.operationTagging.operationTaggingKind === 'structure')
      const lastBodyTextRun = bodyTextRuns.at(-1)
      const lastStructureKey = lastBodyTextRun?.operationTagging.operationTaggingKind === 'structure' ? lastBodyTextRun.operationTagging.structureElementKey : ''
      if (pageIndex < pageLayoutPlan.pdfExportPages.length - 1) expect(structureRolesByKey.get(lastStructureKey), `page ${pageIndex + 1} ends on a heading`).not.toMatch(/^H/)
      const baselinesByStructureKey = new Map<string, Set<number>>()
      for (const bodyTextRun of bodyTextRuns) {
        if (bodyTextRun.operationTagging.operationTaggingKind !== 'structure') continue
        const structureKey = bodyTextRun.operationTagging.structureElementKey
        baselinesByStructureKey.set(structureKey, (baselinesByStructureKey.get(structureKey) ?? new Set()).add(bodyTextRun.textBaselinePoints))
      }
      for (const [structureKey, lineBaselines] of baselinesByStructureKey) lineCountsByStructureKey.set(structureKey, [...(lineCountsByStructureKey.get(structureKey) ?? []), lineBaselines.size])
      expect(pageTextRuns.at(-1)?.textRunText).toBe(`${pageIndex + 1} / ${pageLayoutPlan.pdfExportPages.length}`)
    })
    let splitBlockCount = 0
    for (const [structureKey, pageLineCounts] of lineCountsByStructureKey) {
      if (pageLineCounts.length < 2) continue
      splitBlockCount += 1
      const leastLinesOnAPage = structureRolesByKey.get(structureKey) === 'Code' ? 3 : 2
      for (const pageLineCount of pageLineCounts) expect(pageLineCount, `${structureKey} split ${pageLineCounts.join(' + ')}`).toBeGreaterThanOrEqual(leastLinesOnAPage)
    }
    expect(splitBlockCount).toBeGreaterThan(0)
  })

  it('stops with a plain message when a note needs more pages than the limit', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Long note.md', createLongTestNoteText())
    await expect(writePapelizPdfExportNotePdf(notePdfJob, {}, resolvePapelizPdfExportLimits({ maximumPdfPageCountPerNote: 2 }))).rejects.toMatchObject({
      pdfExportErrorCode: 'pdf-export-limit-reached',
    })
    expect(resolvePapelizPdfExportLimits({ maximumPdfPageCountPerNote: 999_999 }).maximumPdfPageCountPerNote).toBe(2_000)
  })

  it('lays the "Every block" note out the same way every time', async () => {
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md')))
    expect(summarizePageLayoutPlan(pageLayoutPlan)).toMatchSnapshot()
  })
})

describe('PDF export fonts', () => {
  it('gives each character the file whose range holds it', () => {
    expect(splitPapelizPdfExportTextBySubset('Łódź café 😀')).toEqual([
      { segmentText: 'Ł', fontSubsetName: 'latin-ext' },
      { segmentText: 'ód', fontSubsetName: 'latin' },
      { segmentText: 'ź', fontSubsetName: 'latin-ext' },
      { segmentText: ' café ', fontSubsetName: 'latin' },
      { segmentText: '😀', fontSubsetName: null },
    ])
    // "e" with a separate accent is printed as the one character "é".
    expect(splitPapelizPdfExportTextBySubset('e\u0301')).toEqual([{ segmentText: 'é', fontSubsetName: 'latin' }])
  })

  it('picks the weight a browser would when a family lacks one', () => {
    expect(choosePapelizPdfExportFontWeight('jetbrains-mono', 500)).toBe(400)
    expect(choosePapelizPdfExportFontWeight('jetbrains-mono', 600)).toBe(700)
    expect(choosePapelizPdfExportFontWeight('figtree', 700)).toBe(600)
  })
})

describe('PDF export files', () => {
  it('names one note’s file and a .zip of several, folders kept and repeats numbered', () => {
    expect(describePapelizPdfExportFile('Field Notes', ['Projects/Launch plan.md'])).toMatchObject({ pdfExportFileName: 'Launch plan.pdf', pdfExportFileMediaType: 'application/pdf' })
    expect(describePapelizPdfExportFile('Field Notes', ['A.md', 'B.md'])).toMatchObject({ pdfExportFileName: 'Field Notes PDF.zip', pdfExportFileMediaType: 'application/zip' })
    expect([...getPapelizPdfExportZipEntryPaths(['Plan.md', 'plan.md', 'Projects/Plan.md']).values()]).toEqual(['Plan.pdf', 'plan 2.pdf', 'Projects/Plan.pdf'])
  })

  it('exports five notes, and a whole vault, as a .zip of PDFs with progress, and one note as its PDF', async () => {
    const pdfExportVaultAdapter = new PapelizInMemoryVaultAdapter(papelizPdfExportTestVaultNotes)
    const everyTestVaultNoteRelativePath = papelizPdfExportTestVaultNotes.map((testVaultNote) => testVaultNote.vaultNoteRelativePath)
    const exportTestVaultNotesAsPdf = (pdfExportVaultNoteRelativePaths: readonly string[], onPdfExportProgress?: (exportedNoteCount: number) => void) =>
      exportPapelizNotesAsPdf({
        pdfExportVault: { vaultAdapter: pdfExportVaultAdapter, vaultDisplayName: 'Sample vault' },
        pdfExportVaultNoteRelativePaths,
        pdfExportEveryVaultNoteRelativePath: everyTestVaultNoteRelativePath,
        pdfExportPageSize: 'a4',
        pdfExportNoteFontFamily: 'sans',
        ...(onPdfExportProgress === undefined ? {} : { onPdfExportProgress }),
        readPdfExportFontFile: readPapelizPdfExportTestFontFile,
        pdfExportNotePdfWriter: papelizPdfExportInPlaceNotePdfWriter,
      })
    for (const zipVaultNoteRelativePaths of [everyTestVaultNoteRelativePath.slice(0, 5), everyTestVaultNoteRelativePath]) {
      const exportedNoteCounts: number[] = []
      const zipExportResult = await exportTestVaultNotesAsPdf(zipVaultNoteRelativePaths, (exportedNoteCount) => exportedNoteCounts.push(exportedNoteCount))
      expect(zipExportResult.pdfExportFileName).toBe('Sample vault PDF.zip')
      expect(exportedNoteCounts).toEqual(zipVaultNoteRelativePaths.map((_vaultNoteRelativePath, vaultNoteIndex) => vaultNoteIndex + 1))
      const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await zipExportResult.pdfExportFileBlob.arrayBuffer()))
      expect(importZipEntries.map((importZipEntry) => importZipEntry.importZipEntryPath)).toEqual(zipVaultNoteRelativePaths.map((vaultNoteRelativePath) => vaultNoteRelativePath.replace(/\.md$/, '.pdf')))
      for (const importZipEntry of importZipEntries) expect((await readPapelizPdfExportFileWithPdfJs(await importZipEntry.readImportZipEntryBytes())).pdfJsPageCount).toBeGreaterThan(0)
      // Every note's notices together, each naming its note.
      if (zipVaultNoteRelativePaths.includes('Scripts and emoji.md')) expect(zipExportResult.pdfExportNotices.some((pdfExportNotice) => pdfExportNotice.includes('“Scripts and emoji”'))).toBe(true)
    }

    const oneNoteExportResult = await exportTestVaultNotesAsPdf(['Start here.md'])
    expect(oneNoteExportResult.pdfExportFileName).toBe('Start here.pdf')
    expect(oneNoteExportResult.pdfExportFileBlob.type).toBe('application/pdf')
  }, 60_000)

  it('stops a .zip export on Cancel, between notes or inside one', async () => {
    const pdfExportVaultAdapter = new PapelizInMemoryVaultAdapter(papelizSampleVaultNotes)
    const sampleVaultNoteRelativePaths = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath)
    const pdfExportAbortController = new AbortController()
    const exportedNoteCounts: number[] = []
    const cancelledExport = exportPapelizNotesAsPdf({
      pdfExportVault: { vaultAdapter: pdfExportVaultAdapter, vaultDisplayName: 'Sample vault' },
      pdfExportVaultNoteRelativePaths: sampleVaultNoteRelativePaths,
      pdfExportEveryVaultNoteRelativePath: sampleVaultNoteRelativePaths,
      pdfExportPageSize: 'a4',
      pdfExportNoteFontFamily: 'sans',
      onPdfExportProgress: (exportedNoteCount) => {
        exportedNoteCounts.push(exportedNoteCount)
        if (exportedNoteCount === 2) pdfExportAbortController.abort()
      },
      pdfExportAbortSignal: pdfExportAbortController.signal,
      readPdfExportFontFile: readPapelizPdfExportTestFontFile,
      pdfExportNotePdfWriter: papelizPdfExportInPlaceNotePdfWriter,
    })
    await expect(cancelledExport).rejects.toMatchObject({ name: 'AbortError' })
    expect(exportedNoteCounts).toEqual([1, 2])
  })

  it('says plainly why an export stopped, with the detail kept for the console', async () => {
    const pdfExportVaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Plan.md', vaultNoteText: 'Text' }])
    const failedExport = exportPapelizNotesAsPdf({
      pdfExportVault: { vaultAdapter: pdfExportVaultAdapter, vaultDisplayName: 'Vault' },
      pdfExportVaultNoteRelativePaths: ['Plan.md'],
      pdfExportEveryVaultNoteRelativePath: ['Plan.md'],
      pdfExportPageSize: 'a4',
      pdfExportNoteFontFamily: 'sans',
      readPdfExportFontFile: () => Promise.reject(new Error('D:\\fonts\\figtree.woff is gone')),
      pdfExportNotePdfWriter: papelizPdfExportInPlaceNotePdfWriter,
    })
    await expect(failedExport).rejects.toBeInstanceOf(PapelizPdfExportError)
    await expect(failedExport).rejects.toMatchObject({ message: 'a font for “Plan.pdf” couldn’t be read; try again' })
  })
})
