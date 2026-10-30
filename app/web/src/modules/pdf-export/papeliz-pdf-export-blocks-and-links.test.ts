import { describe, expect, it } from 'vitest'
import { checkPapelizPdfExportWebLinkAddress, createPapelizPdfExportHeadingDestinationName, papelizPdfExportDestinationNamePattern } from './papeliz-pdf-export-links'
import type { PapelizPdfExportLaidOutBlock } from './papeliz-pdf-export-block-layout'
import { resolvePapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import { getPapelizPdfExportPageArea, planPapelizPdfExportNotePages, writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import { checkPapelizPdfExportPageLayoutPlan, type PapelizPdfExportPageLayoutPlan, type PapelizPdfExportPageOperation } from './papeliz-pdf-export-page-layout-plan'
import { paginatePapelizPdfExportBlocks } from './papeliz-pdf-export-pagination'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'
import {
  buildPapelizPdfExportTestNotePdfJob,
  getPapelizPdfExportTestNoteText,
  readPapelizPdfExportFileLatin1Text,
  readPapelizPdfExportFileWithPdfJs,
  type PapelizPdfExportPdfJsStructureNode,
} from './papeliz-pdf-export.test-support'

// Phase 2 of the PDF export: every text block, links inside the note and to the web, footnotes both
// ways, bookmarks, and the keep rules at a page's end.

// Measures every character 5 pt wide, for pagination tests that need no fonts.
const papelizPdfExportFixedWidthTextMeasurer: PapelizPdfExportTextMeasurer = {
  getFontFaceMetrics: () => ({ ascentEm: 0.9, descentEm: 0.2, underlineOffsetEm: 0.1, underlineThicknessEm: 0.06, strikeOffsetEm: 0.3, strikeThicknessEm: 0.06 }),
  measureTextWidthPoints: (textToMeasure) => textToMeasure.length * 5,
  chooseOpenTypeFeatureSet: (_textToShape, _fontFaceKey, wantedOpenTypeFeatureSet) => wantedOpenTypeFeatureSet,
  countMissingCharacters: () => 0,
}

// A block of one line this tall, drawing one word, or a rule.
function createTestLaidOutBlock(lineHeightPoints: number, blockSpaceAbovePoints: number, isRule: boolean): PapelizPdfExportLaidOutBlock {
  const lineOperation: PapelizPdfExportPageOperation = isRule
    ? {
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: 0,
        rectangleTopPoints: 0,
        rectangleWidthPoints: 100,
        rectangleHeightPoints: lineHeightPoints,
        rectangleCornerRadiusPoints: 0,
        rectangleFillColor: '#dce0e6',
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      }
    : {
        pageOperationKind: 'text-run',
        textRunText: 'Words',
        fontFaceKey: 'figtree-latin-400-normal',
        textSizePoints: 11,
        textColor: '#111112',
        characterSpacingPoints: 0,
        openTypeFeatureSet: 'standard',
        textLeftPoints: 0,
        textBaselinePoints: 10,
        textWidthPoints: 25,
        operationTagging: { operationTaggingKind: 'structure', structureElementKey: 'structure-1' },
      }
  return {
    blockLeftPoints: 0,
    blockWidthPoints: 400,
    blockSpaceAbovePoints,
    blockSpaceBelowPoints: 0,
    blockLines: [{ lineHeightPoints, lineBaselinePoints: lineHeightPoints, lineOperations: [lineOperation], missingCharacterCount: 0 }],
    blockBox: null,
    blockQuoteBars: [],
    isBlockKeptWithNext: false,
    blockKeptWholeLineCount: Number.POSITIVE_INFINITY,
    minimumLinesBeforePageBreak: 1,
    minimumLinesAfterPageBreak: 1,
    isBlockLeftOutAtPageTop: isRule,
  }
}

// The structure element a text belongs to, and that element's role.
function getTextStructureRoles(pageLayoutPlan: PapelizPdfExportPageLayoutPlan): Map<string, string> {
  return new Map(pageLayoutPlan.pdfExportStructureElements.map(({ structureElementKey, structureRole }) => [structureElementKey, structureRole]))
}

function findStructureParentRole(structureNode: PapelizPdfExportPdfJsStructureNode | null, wantedRole: string, parentRole: string | null = null): string | null | undefined {
  if (structureNode === null) return undefined
  if (structureNode.role === wantedRole) return parentRole
  for (const structureChild of structureNode.children ?? []) {
    const foundParentRole = findStructureParentRole(structureChild, wantedRole, structureNode.role ?? null)
    if (foundParentRole !== undefined) return foundParentRole
  }
  return undefined
}

// A note whose headings fall at many places down a page, each followed by a different block: a
// paragraph, a list, a task list, a quote, code, or more headings.
function createHeadingsAtPageEndTestNoteText(): string {
  const followingBlockTexts = [
    'A paragraph after the heading. It runs on for two lines at least, so its first two lines must come along with the heading when the page ends here.',
    '- A list item after the heading\n- And a second one\n- And a third',
    '- [ ] A task after the heading\n- [x] A done task',
    '> A quote after the heading, long enough to reach a second line on the page, so the quote can be split after it.',
    '```\ncode after the heading\nline 2\nline 3\n```',
    '### A heading right after the heading\n\n#### And a third heading\n\nThen the paragraph all three headings keep with.',
  ]
  const notePartTexts = ['# Headings at page end']
  for (let sectionNumber = 1; sectionNumber <= 36; sectionNumber += 1) {
    notePartTexts.push(`Filler ${sectionNumber}: ${'Words fill the page so the next heading lands lower each time. '.repeat(1 + (sectionNumber % 7))}`)
    notePartTexts.push(`## Section ${sectionNumber}`)
    notePartTexts.push(followingBlockTexts[sectionNumber % followingBlockTexts.length] ?? '')
  }
  return notePartTexts.join('\n\n')
}

describe('PDF export links', () => {
  it('links only checked web addresses', () => {
    expect(checkPapelizPdfExportWebLinkAddress('https://Example.com/a b?q=1#part')).toBe('https://example.com/a%20b?q=1#part')
    expect(checkPapelizPdfExportWebLinkAddress('http://example.com')).toBe('http://example.com/')
    expect(checkPapelizPdfExportWebLinkAddress('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    for (const refusedLinkHref of [
      'javascript:alert(1)',
      'ftp://example.com/file',
      'file:///C:/notes.md',
      'data:text/html,hi',
      'https://user:secret@example.com/',
      'https://example.com/%0Aline',
      'https://example.com/\u0000',
      'mailto:',
      'https://',
      `https://example.com/${'a'.repeat(8_200)}`,
      'Other note.md#part',
    ]) {
      expect(checkPapelizPdfExportWebLinkAddress(refusedLinkHref), refusedLinkHref).toBeNull()
    }
  })

  it('names places in plain ASCII, unique by the heading’s place', () => {
    expect(createPapelizPdfExportHeadingDestinationName(3, 'ünïcödé-heading-and-émoji-')).toBe('heading-3-unicode-heading-and-emoji')
    expect(createPapelizPdfExportHeadingDestinationName(4, '日本語')).toBe('heading-4')
    expect(createPapelizPdfExportHeadingDestinationName(5, 'x'.repeat(300))).toMatch(papelizPdfExportDestinationNamePattern)
  })

  it('links web addresses, places in the note and footnotes both ways, and nothing else', async () => {
    const linksNotePdfJob = await buildPapelizPdfExportTestNotePdfJob('Links and headings.md', getPapelizPdfExportTestNoteText('Links and headings.md'))
    const linksPdfJsReading = await readPapelizPdfExportFileWithPdfJs((await writePapelizPdfExportNotePdf(linksNotePdfJob)).pdfFileBytes)
    // A link that wraps gets an area on each of its lines.
    const webLinkAddresses = linksPdfJsReading.pdfJsLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkAddress).filter((linkAddress) => linkAddress !== null)
    expect(webLinkAddresses.filter((linkAddress, linkAddressIndex) => linkAddress !== webLinkAddresses[linkAddressIndex - 1])).toEqual([
      'https://example.com/page?query=1&other=2',
      'http://example.com/',
      'mailto:someone@example.com',
      'https://example.org/',
    ])
    // [[#Part two]], [[Links and headings#Part three|…]] and [a Markdown link](#part-two); links to other
    // notes, an ftp link and a script link carry none.
    const internalLinks = linksPdfJsReading.pdfJsLinks.filter((pdfJsLink) => pdfJsLink.pdfJsLinkDestinationName !== null)
    expect(internalLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkDestinationName)).toEqual(['heading-2-part-two', 'heading-5-part-three', 'heading-2-part-two'])
    expect(internalLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkDescription)).toEqual(['Part two', 'a labelled heading link', 'a Markdown link'])
    for (const internalLink of internalLinks) expect(linksPdfJsReading.pdfJsDestinationPageIndexes.get(internalLink.pdfJsLinkDestinationName ?? '')).toBe(0)

    const everyBlockPdfJsReading = await readPapelizPdfExportFileWithPdfJs(
      (await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md')))).pdfFileBytes,
    )
    const linkedPlaceNames = everyBlockPdfJsReading.pdfJsLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkDestinationName).filter((destinationName) => destinationName !== null)
    expect(linkedPlaceNames).toEqual(expect.arrayContaining(['footnote-1', 'footnote-2', 'footnote-reference-1', 'footnote-reference-2', 'heading-2-lists', 'heading-3-quotes']))
    // Each footnote's place is on the footnotes' page, and each reference's on the page that refers to it.
    const { pdfJsDestinationPageIndexes } = everyBlockPdfJsReading
    expect(pdfJsDestinationPageIndexes.get('footnote-1')).toBe(everyBlockPdfJsReading.pdfJsPageCount - 1)
    expect(pdfJsDestinationPageIndexes.get('footnote-reference-1')).toBeLessThan(everyBlockPdfJsReading.pdfJsPageCount - 1)
    for (const linkedPlaceName of linkedPlaceNames) expect(pdfJsDestinationPageIndexes.has(linkedPlaceName), linkedPlaceName).toBe(true)
    expect(everyBlockPdfJsReading.pdfJsLinks.find((pdfJsLink) => pdfJsLink.pdfJsLinkDestinationName === 'footnote-reference-1')?.pdfJsLinkDescription).toBe('Back to reference 1')
    expect(everyBlockPdfJsReading.pdfJsLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkAddress)).toEqual(
      expect.arrayContaining(['https://papeliz.com/', 'mailto:hello@example.com', 'https://example.com/a-bare-link', 'https://example.com/footnote']),
    )
  })

  it('makes one bookmark per heading, nested by level and open to two levels', async () => {
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(
      (await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Links and headings.md', getPapelizPdfExportTestNoteText('Links and headings.md')))).pdfFileBytes,
    )
    expect(pdfJsReading.pdfJsBookmarks.map(({ pdfJsBookmarkTitle, pdfJsBookmarkDepth }) => `${pdfJsBookmarkDepth} ${pdfJsBookmarkTitle}`)).toEqual([
      '1 Links and headings',
      '2 Part two',
      '3 A heading repeated',
      '3 A heading repeated',
      '2 Part three',
      // A skipped level hangs under the nearest higher heading.
      '3 Skipped a level',
      '1 Ünïcödé heading and émoji 🙂',
    ])
    expect(pdfJsReading.pdfJsBookmarks.map((pdfJsBookmark) => pdfJsBookmark.pdfJsBookmarkCount)).toEqual([5, 2, null, null, 1, null, null])
    for (const { pdfJsBookmarkDestinationName } of pdfJsReading.pdfJsBookmarks) expect(pdfJsReading.pdfJsDestinationPageIndexes.has(pdfJsBookmarkDestinationName ?? '')).toBe(true)
    expect(pdfJsReading.pdfJsPageMode).toBe('UseOutlines')

    const oneHeadingPdfJsReading = await readPapelizPdfExportFileWithPdfJs((await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('One.md', '# Only one\n\nText.'))).pdfFileBytes)
    expect(oneHeadingPdfJsReading.pdfJsBookmarks).toHaveLength(1)
    expect(oneHeadingPdfJsReading.pdfJsPageMode).toBe('UseNone')
    const noHeadingPdfFile = await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('None.md', 'Just text.'))
    expect(readPapelizPdfExportFileLatin1Text(noHeadingPdfFile.pdfFileBytes)).not.toMatch(/\/Outlines/)
  })

  it('refuses a plan with a link to a missing place, a bookmark that jumps, a strange shape, or a structure element before its parent', async () => {
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md')))
    const pdfExportLimits = resolvePapelizPdfExportLimits()
    expect(() => checkPapelizPdfExportPageLayoutPlan(pageLayoutPlan, pdfExportLimits)).not.toThrow()
    const withPageOperation = (pageOperation: PapelizPdfExportPageOperation): PapelizPdfExportPageLayoutPlan => ({
      ...pageLayoutPlan,
      pdfExportPages: [{ pageOperations: [...(pageLayoutPlan.pdfExportPages[0]?.pageOperations ?? []), pageOperation] }, ...pageLayoutPlan.pdfExportPages.slice(1)],
    })
    const linkStructureElementKey = pageLayoutPlan.pdfExportStructureElements.find((structureElement) => structureElement.structureRole === 'Link')?.structureElementKey ?? ''
    const linkAreaBase = { pageOperationKind: 'link-area', linkAreaLeftPoints: 60, linkAreaTopPoints: 60, linkAreaWidthPoints: 10, linkAreaHeightPoints: 10, linkAreaDescription: 'x', structureElementKey: linkStructureElementKey } as const
    expect(() => checkPapelizPdfExportPageLayoutPlan(withPageOperation({ ...linkAreaBase, linkAreaTarget: { linkTargetKind: 'note-place', noteDestinationName: 'heading-99' } }), pdfExportLimits)).toThrow(/missing place/)
    expect(() => checkPapelizPdfExportPageLayoutPlan(withPageOperation({ ...linkAreaBase, linkAreaTarget: { linkTargetKind: 'web', webLinkAddress: 'javascript:alert(1)' } }), pdfExportLimits)).toThrow(/checked address/)
    expect(() =>
      checkPapelizPdfExportPageLayoutPlan(
        withPageOperation({ pageOperationKind: 'path', pathData: 'M0 0 <script>', pathLeftPoints: 60, pathTopPoints: 60, pathScale: 1, pathFillColor: null, pathStrokeColor: '#000000', pathStrokeWidth: 1 }),
        pdfExportLimits,
      ),
    ).toThrow(/path data/)
    expect(() => checkPapelizPdfExportPageLayoutPlan(withPageOperation({ pageOperationKind: 'destination', destinationName: 'heading-2-lists', destinationTopPoints: 60 }), pdfExportLimits)).toThrow(/named twice/)
    expect(() =>
      checkPapelizPdfExportPageLayoutPlan({ ...pageLayoutPlan, pdfExportBookmarks: [{ bookmarkTitle: 'Deep', bookmarkDepth: 3, bookmarkDestinationName: 'heading-2-lists' }] }, pdfExportLimits),
    ).toThrow(/jumps/)
    expect(() =>
      checkPapelizPdfExportPageLayoutPlan({ ...pageLayoutPlan, pdfExportStructureElements: [...pageLayoutPlan.pdfExportStructureElements].reverse() }, pdfExportLimits),
    ).toThrow(/before its parent/)
  })
})

describe('PDF export blocks', () => {
  it('tags lists, list items, labels, quotes, links and footnotes', async () => {
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(
      (await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md')))).pdfFileBytes,
    )
    expect(new Set(pdfJsReading.pdfJsStructureRoles)).toEqual(new Set(['Root', 'Document', 'L', 'LI', 'LBody', 'Lbl', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Link', 'BlockQuote', 'Code', 'Note']))
    const pageStructureTrees = pdfJsReading.pdfJsStructureTreesByPage
    expect(findStructureParentRole(pageStructureTrees[0] ?? null, 'Lbl')).toBe('LI')
    expect(findStructureParentRole(pageStructureTrees[0] ?? null, 'Link')).toBe('P')
    expect(findStructureParentRole(pageStructureTrees.at(-1) ?? null, 'Note')).toBe('Document')
  })

  it('draws bullets by depth, numbers from the list’s start, and task boxes with the done one checked', async () => {
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(
      await buildPapelizPdfExportTestNotePdfJob('Lists.md', '- one\n  - two\n    - three\n\n3. three\n4. four\n\n- [ ] to do\n- [x] done'),
    )
    const pageOperations = pageLayoutPlan.pdfExportPages[0]?.pageOperations ?? []
    const bulletBoxes = pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleWidthPoints < 5)
    expect(bulletBoxes.map((bulletBox) => (bulletBox.pageOperationKind === 'rectangle' ? [bulletBox.rectangleFillColor !== null, bulletBox.rectangleCornerRadiusPoints > 0] : []))).toEqual([
      [true, true],
      [false, true],
      [true, false],
    ])
    const textRuns = pageOperations.flatMap((pageOperation) => (pageOperation.pageOperationKind === 'text-run' ? [pageOperation.textRunText] : []))
    expect(textRuns.join(' ')).toBe('one two three 3. three 4. four to do done Lists 1 / 1')
    const taskBoxes = pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleStrokeColor !== null && pageOperation.rectangleWidthPoints > 10)
    expect(taskBoxes.map((taskBox) => (taskBox.pageOperationKind === 'rectangle' ? taskBox.rectangleFillColor : null))).toEqual(['#ffffff', '#0064d4'])
    expect(pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'path')).toHaveLength(1)
    // Each marker sits left of its item's text, on the same baseline.
    const pageTextRuns = pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'text-run')
    const numberRunIndex = pageTextRuns.findIndex((pageTextRun) => pageTextRun.textRunText === '3.')
    const [numberRun, numberedItemRun] = [pageTextRuns[numberRunIndex], pageTextRuns[numberRunIndex + 1]]
    expect(numberedItemRun?.textRunText).toBe('three')
    expect(numberRun?.textBaselinePoints).toBe(numberedItemRun?.textBaselinePoints)
    expect((numberRun?.textLeftPoints ?? 0) + (numberRun?.textWidthPoints ?? 0)).toBeLessThan(numberedItemRun?.textLeftPoints ?? 0)
  })

  it('prints a properties-only note as MD View’s chips', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Properties only.md', getPapelizPdfExportTestNoteText('Properties only.md'))
    expect(notePdfJob.pdfExportNoteDocument.noteBlocks).toEqual([
      {
        noteBlockKind: 'properties',
        noteProperties: [
          { notePropertyName: 'tags', notePropertyValuesText: 'export, test' },
          { notePropertyName: 'aliases', notePropertyValuesText: 'Only properties' },
          { notePropertyName: 'due', notePropertyValuesText: '2026-11-04' },
        ],
      },
    ])
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(notePdfJob)
    const chipGrounds = (pageLayoutPlan.pdfExportPages[0]?.pageOperations ?? []).filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleFillColor === '#e8ebf0')
    expect(chipGrounds).toHaveLength(3)
    // One row: every chip on the same top.
    expect(new Set(chipGrounds.map((chipGround) => (chipGround.pageOperationKind === 'rectangle' ? chipGround.rectangleTopPoints : 0))).size).toBe(1)
  })

  it('prints a Serif note in Charis SIL', async () => {
    const pdfFileBytes = (await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Every block.md', getPapelizPdfExportTestNoteText('Every block.md'), 'serif'))).pdfFileBytes
    const baseFontNames = [...readPapelizPdfExportFileLatin1Text(pdfFileBytes).matchAll(/\/BaseFont \/([^\s/]+)/g)].map((baseFontMatch) => baseFontMatch[1] ?? '')
    expect(baseFontNames.some((baseFontName) => /^[A-Z]{6}\+CharisSIL-Bold$/.test(baseFontName))).toBe(true)
    expect(baseFontNames.some((baseFontName) => /^[A-Z]{6}\+CharisSIL-Italic$/.test(baseFontName))).toBe(true)
    // Code stays in JetBrains Mono; nothing prints in Figtree.
    expect(baseFontNames.some((baseFontName) => baseFontName.includes('JetBrainsMono'))).toBe(true)
    expect(baseFontNames.some((baseFontName) => baseFontName.includes('Figtree'))).toBe(false)
  })

  it('keeps headings with what follows when they fall at a page’s end', async () => {
    for (const pdfExportPageSize of ['a4', 'letter'] as const) {
      const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Headings at page end.md', createHeadingsAtPageEndTestNoteText(), 'sans', pdfExportPageSize))
      const structureRolesByKey = getTextStructureRoles(pageLayoutPlan)
      const structureParentsByKey = new Map(pageLayoutPlan.pdfExportStructureElements.map(({ structureElementKey, parentStructureElementKey }) => [structureElementKey, parentStructureElementKey]))
      const getBlockRole = (structureElementKey: string) => structureRolesByKey.get(structureRolesByKey.get(structureElementKey) === 'Link' ? (structureParentsByKey.get(structureElementKey) ?? '') : structureElementKey)
      let headingsMovedOnCount = 0
      pageLayoutPlan.pdfExportPages.forEach((pagePlan, pageIndex) => {
        const bodyTextRuns = pagePlan.pageOperations.filter(
          (pageOperation) => pageOperation.pageOperationKind === 'text-run' && pageOperation.operationTagging.operationTaggingKind === 'structure',
        )
        const lastBodyTextRun = bodyTextRuns.at(-1)
        const lastStructureElementKey = lastBodyTextRun?.pageOperationKind === 'text-run' && lastBodyTextRun.operationTagging.operationTaggingKind === 'structure' ? lastBodyTextRun.operationTagging.structureElementKey : ''
        if (pageIndex < pageLayoutPlan.pdfExportPages.length - 1) expect(getBlockRole(lastStructureElementKey), `${pdfExportPageSize} page ${pageIndex + 1} ends on a heading`).not.toMatch(/^H/)
        const firstBodyTextRun = bodyTextRuns[0]
        const firstStructureElementKey = firstBodyTextRun?.pageOperationKind === 'text-run' && firstBodyTextRun.operationTagging.operationTaggingKind === 'structure' ? firstBodyTextRun.operationTagging.structureElementKey : ''
        if (pageIndex > 0 && getBlockRole(firstStructureElementKey) === 'H2') headingsMovedOnCount += 1
      })
      // The note does put headings at pages' ends: some had to move on with what follows them.
      expect(headingsMovedOnCount, pdfExportPageSize).toBeGreaterThan(0)
    }
  })

  it('draws a quote’s bar on every page it spans, and leaves out a rule that would open a page', async () => {
    const longQuoteText = Array.from({ length: 40 }, (_quoteLine, quoteLineIndex) => `> Quote paragraph ${quoteLineIndex + 1}, long enough to be a line of its own on the page.\n>`).join('\n')
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Long quote.md', `# Quote\n\n${longQuoteText}`))
    expect(pageLayoutPlan.pdfExportPages.length).toBeGreaterThan(1)
    for (const pagePlan of pageLayoutPlan.pdfExportPages) {
      const quoteBars = pagePlan.pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleFillColor === '#c5cbd3')
      expect(quoteBars).toHaveLength(1)
    }

    // A rule that doesn't fit below a full page would open the next one, so it is left out; one that
    // fits stays.
    const pdfExportPageArea = getPapelizPdfExportPageArea('a4')
    const contentHeightPoints = pdfExportPageArea.contentBottomPoints - pdfExportPageArea.contentTopPoints
    const paginateTestBlocks = (laidOutBlocks: PapelizPdfExportLaidOutBlock[]) =>
      paginatePapelizPdfExportBlocks({
        laidOutBlocks,
        pdfExportPageArea,
        footerNoteName: 'Rules',
        footerFontStyle: { fontFamilyName: 'figtree', fontWeight: 400, isFontItalic: false },
        textMeasurer: papelizPdfExportFixedWidthTextMeasurer,
      })
    const countRules = (pagePlans: ReturnType<typeof paginatePapelizPdfExportBlocks>) =>
      pagePlans.map((pagePlan) => pagePlan.pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleFillColor === '#dce0e6').length)
    expect(countRules(paginateTestBlocks([createTestLaidOutBlock(contentHeightPoints - 5, 0, false), createTestLaidOutBlock(0.65, 16.8, true), createTestLaidOutBlock(20, 0, false)]))).toEqual([0, 0])
    expect(countRules(paginateTestBlocks([createTestLaidOutBlock(contentHeightPoints - 40, 0, false), createTestLaidOutBlock(0.65, 16.8, true), createTestLaidOutBlock(20, 0, false)]))).toEqual([1])
  })
})
