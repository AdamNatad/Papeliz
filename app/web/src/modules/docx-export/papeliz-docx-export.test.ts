import { describe, expect, it } from 'vitest'
import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import { createPapelizDocxExportBookmarkName } from './papeliz-docx-export-document-from-hast'
import { removePapelizDocxExportUnwritableCharacters } from './papeliz-docx-export-styles'
import {
  buildPapelizDocxExportNoteFile,
  describePapelizDocxExportFile,
  exportPapelizNotesAsDocx,
  getPapelizDocxExportRelativeFileHref,
  getPapelizDocxExportZipEntryPaths,
  papelizDocxExportFileMediaType,
  type PapelizDocxExportNoteFileOptions,
} from './papeliz-docx-export'
import {
  collectPapelizDocxExportExpectedText,
  normalizePapelizDocxExportWhitespace,
  readPapelizDocxExportFileParts,
  readPapelizDocxExportFileWithMammoth,
} from './papeliz-docx-export-file-parts.test-support'
import {
  fitPapelizDocxExportPictureSizePoints,
  getPapelizDocxExportPictureShownPixelSize,
  type PapelizDocxExportIconPngDrawer,
  type PapelizDocxExportPictureTools,
} from './papeliz-docx-export-pictures'

const papelizExportTestNoteTextsByModulePath = import.meta.glob('../export-print-style/papeliz-export-test-notes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The shared test notes, as notes of one vault: "papeliz-export-test-note-every-block.md" is "Every block.md".
const papelizExportTestNotes = Object.entries(papelizExportTestNoteTextsByModulePath).map(([testNoteModulePath, vaultNoteText]) => {
  const testNoteNameSlug = /papeliz-export-test-note-([\w-]+)\.md$/.exec(testNoteModulePath)?.[1] ?? 'note'
  const testNoteName = testNoteNameSlug.charAt(0).toUpperCase() + testNoteNameSlug.slice(1).replace(/-/g, ' ')
  return { vaultNoteRelativePath: `${testNoteName}.md`, vaultNoteText }
})

const papelizExportTestVaultNotes = [...papelizSampleVaultNotes, ...papelizExportTestNotes]
const resolveTestWikilinkTarget = createPapelizWikilinkTargetResolver(papelizExportTestVaultNotes.map((testVaultNote) => testVaultNote.vaultNoteRelativePath))

function getTestNoteText(vaultNoteRelativePath: string): string {
  const testVaultNote = papelizExportTestVaultNotes.find((testVaultNoteCandidate) => testVaultNoteCandidate.vaultNoteRelativePath === vaultNoteRelativePath)
  if (testVaultNote === undefined) throw new Error(`No test note ${vaultNoteRelativePath}`)
  return testVaultNote.vaultNoteText
}

async function buildTestNoteFile(vaultNoteRelativePath: string, vaultNoteText: string, noteFileOptionChanges: Partial<PapelizDocxExportNoteFileOptions> = {}): Promise<Blob> {
  const { docxExportNoteFileBlob } = await buildPapelizDocxExportNoteFile({
    vaultNoteRelativePath,
    vaultNoteText,
    resolveWikilinkTarget: resolveTestWikilinkTarget,
    docxExportPageSize: 'a4',
    docxExportNoteFontFamily: 'sans',
    ...noteFileOptionChanges,
  })
  return docxExportNoteFileBlob
}

function readXmlAttributeValues(xmlText: string, xmlElementName: string, xmlAttributeName: string): string[] {
  return [...xmlText.matchAll(new RegExp(`<${xmlElementName}\\b[^>]*\\s${xmlAttributeName}="([^"]*)"`, 'g'))].map((xmlAttributeMatch) => xmlAttributeMatch[1] ?? '')
}

describe('buildPapelizDocxExportNoteFile', () => {
  it('writes every sample and test note so mammoth reads its text back in order', async () => {
    expect(papelizExportTestNotes.length).toBeGreaterThanOrEqual(6)
    for (const { vaultNoteRelativePath, vaultNoteText } of papelizExportTestVaultNotes) {
      const docxExportFileBlob = await buildTestNoteFile(vaultNoteRelativePath, vaultNoteText)
      const { mammothRawText, mammothErrorMessages } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
      expect(mammothErrorMessages, vaultNoteRelativePath).toEqual([])
      expect(normalizePapelizDocxExportWhitespace(mammothRawText), vaultNoteRelativePath).toBe(
        collectPapelizDocxExportExpectedText(vaultNoteRelativePath, vaultNoteText, resolveTestWikilinkTarget),
      )
    }
  })

  it('writes headings as Word headings, in order, with their outline levels', async () => {
    const vaultNoteText = getTestNoteText('Every block.md')
    const docxExportFileBlob = await buildTestNoteFile('Every block.md', vaultNoteText)
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    const mammothHeadings = [...mammothHtml.matchAll(/<h([1-6])>(.*?)<\/h\1>/g)].map((headingMatch) => `${headingMatch[1]} ${headingMatch[2]?.replace(/<[^>]+>/g, '')}`)
    expect(mammothHeadings).toEqual(['1 Every block', '2 Lists', '2 Quotes', '2 Code', '3 Heading three', '4 Heading four', '5 Heading five', '6 Heading six'])
    const docxExportStylesXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('word/styles.xml') ?? ''
    for (let headingLevel = 1; headingLevel <= 6; headingLevel += 1) {
      expect(docxExportStylesXml).toMatch(new RegExp(`w:styleId="Heading${headingLevel}"[\\s\\S]*?<w:outlineLvl w:val="${headingLevel - 1}"/>`))
    }
  })

  it('writes lists as Word lists: bullets, numbers from their start, and nesting', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Every block.md', getTestNoteText('Every block.md'))
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toContain('<ul><li>A bullet</li><li>A bullet with <strong>bold</strong><ul><li>A nested bullet<ul><li>A bullet three deep</li></ul></li></ul></li><li>Back at the top</li></ul>')
    expect(mammothHtml).toContain('<ol><li>Counting from three</li><li>Four<ol><li>A nested number</li><li>Another</li></ol></li><li>Five</li></ol>')
    expect(mammothHtml).toContain('<ol><li>A list that starts again</li><li>at one</li></ol>')
    const docxExportFileParts = await readPapelizDocxExportFileParts(docxExportFileBlob)
    expect(docxExportFileParts.get('word/numbering.xml')).toContain('<w:start w:val="3"/>')
    // Each Markdown list is a Word list of its own, so each counts from its own start.
    const docxExportDocumentXml = docxExportFileParts.get('word/document.xml') ?? ''
    const listNumberIds = readXmlAttributeValues(docxExportDocumentXml, 'w:numId', 'w:val')
    // Three bullet levels, two numbered lists with one nested, the loose list and the callout's list.
    expect(new Set(listNumberIds).size).toBe(8)
    expect(normalizePapelizDocxExportWhitespace((await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)).mammothRawText)).toContain('☐ A task to do ☑ A task that is done ☐ A nested task')
  })

  it('makes only web links into links, and keeps them as the note has them', async () => {
    const vaultNoteText = getTestNoteText('Links and headings.md')
    const docxExportFileBlob = await buildTestNoteFile('Links and headings.md', vaultNoteText)
    const docxExportRelationshipsXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('word/_rels/document.xml.rels') ?? ''
    const externalTargets = [...docxExportRelationshipsXml.matchAll(/<Relationship\b[^>]*>/g)]
      .map((relationshipMatch) => relationshipMatch[0])
      .filter((relationshipXml) => relationshipXml.includes('TargetMode="External"'))
      .map((relationshipXml) => /Target="([^"]*)"/.exec(relationshipXml)?.[1]?.replace(/&amp;/g, '&'))
    expect(externalTargets.sort()).toEqual(['http://example.com', 'https://example.com/page?query=1&other=2', 'https://example.org', 'mailto:someone@example.com'])
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toContain('<a href="https://example.com/page?query=1&amp;other=2">an https link</a>')
    expect(mammothHtml).not.toContain('ftp:')
    expect(mammothHtml).not.toContain('javascript:')
  })

  it('gives each heading a hidden bookmark with a valid, unique name', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Links and headings.md', getTestNoteText('Links and headings.md'))
    const docxExportDocumentXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('word/document.xml') ?? ''
    const bookmarkNames = readXmlAttributeValues(docxExportDocumentXml, 'w:bookmarkStart', 'w:name')
    expect(bookmarkNames).toEqual(['_h1_links_and_headings', '_h2_part_two', '_h3_a_heading_repeated', '_h4_a_heading_repeated_1', '_h5_part_three', '_h6_skipped_a_level', '_h7_unicode_heading_and_emoji'])
    for (const bookmarkName of bookmarkNames) expect(bookmarkName).toMatch(/^_[A-Za-z0-9_]{1,39}$/)
    expect(new Set(bookmarkNames).size).toBe(bookmarkNames.length)
  })

  it('names the note as the title and leaves out everything else about the person', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Projects/Launch plan.md', '# Launch plan\n\nText.')
    const docxExportCorePropertiesXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('docProps/core.xml') ?? ''
    expect(docxExportCorePropertiesXml).toContain('<dc:title>Launch plan</dc:title>')
    for (const personalXmlElementName of ['dc:creator', 'cp:lastModifiedBy', 'cp:keywords', 'dc:description', 'dc:subject']) {
      expect(docxExportCorePropertiesXml).not.toContain(`<${personalXmlElementName}`)
    }
    expect(docxExportCorePropertiesXml).not.toContain('Projects')
  })

  it('never lets a note’s script, event handlers or script links into the file', async () => {
    const unsafeNoteText = [
      '# Unsafe',
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(1)">',
      '[a script link](javascript:alert(1)) and <a href="javascript:alert(1)" onclick="alert(1)">raw</a>',
      '[[Every block]]',
    ].join('\n\n')
    const docxExportFileBlob = await buildTestNoteFile('Unsafe.md', unsafeNoteText)
    for (const [docxExportFilePartPath, docxExportFilePartText] of await readPapelizDocxExportFileParts(docxExportFileBlob)) {
      expect(docxExportFilePartText.toLowerCase(), docxExportFilePartPath).not.toMatch(/javascript:|onerror|onclick|<script/)
    }
    const { mammothRawText } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(normalizePapelizDocxExportWhitespace(mammothRawText)).toBe('Unsafe a script link and raw Every block')
  })

  it('drops characters a Word file can’t hold', async () => {
    expect(removePapelizDocxExportUnwritableCharacters('before\u0001\u000b￿\ud800after\ttab 🙂')).toBe('beforeafter\ttab 🙂')
    const docxExportFileBlob = await buildTestNoteFile('Odd characters.md', 'before\u0001\u001fafter `code\u0002`')
    const { mammothRawText } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(normalizePapelizDocxExportWhitespace(mammothRawText)).toBe('beforeafter code')
  })

  it('sets the page size, footer, fonts and language', async () => {
    const lettersFileParts = await readPapelizDocxExportFileParts(await buildTestNoteFile('Letter.md', '---\nlang: fr\n---\nBonjour.', { docxExportPageSize: 'letter', docxExportNoteFontFamily: 'serif' }))
    expect(lettersFileParts.get('word/document.xml')).toMatch(/<w:pgSz w:w="12240" w:h="15840"/)
    expect(lettersFileParts.get('word/styles.xml')).toContain('w:ascii="Georgia"')
    expect(lettersFileParts.get('word/styles.xml')).toContain('<w:lang w:val="fr"/>')
    const a4FileParts = await readPapelizDocxExportFileParts(await buildTestNoteFile('Notes/A4 page.md', 'Hello.'))
    expect(a4FileParts.get('word/document.xml')).toMatch(/<w:pgSz w:w="11906" w:h="16838"/)
    expect(a4FileParts.get('word/styles.xml')).toContain('w:ascii="Figtree"')
    expect(a4FileParts.get('word/styles.xml')).toContain('<w:lang w:val="en"/>')
    const a4FooterXml = [...a4FileParts].find(([docxExportFilePartPath]) => /^word\/footer\d*\.xml$/.test(docxExportFilePartPath))?.[1] ?? ''
    expect(a4FooterXml).toContain('A4 page')
    expect(a4FooterXml).toMatch(/PAGE[\s\S]*NUMPAGES/)
  })
})

// A 1 × 1 PNG standing in for a callout icon: tests run where there is no canvas.
const testIconPngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (pngCharacter) => pngCharacter.charCodeAt(0))
const drawTestIconPng: PapelizDocxExportIconPngDrawer = async () => ({ pictureBytes: testIconPngBytes, pictureType: 'png', picturePixelWidth: 1, picturePixelHeight: 1 })

describe('tables, callouts, footnotes and links', () => {
  it('writes a Markdown table with a repeated header row, rows that don’t split, and its columns’ alignment', async () => {
    const vaultNoteText = getTestNoteText('Long table.md')
    const docxExportFileBlob = await buildTestNoteFile('Long table.md', vaultNoteText)
    const docxExportDocumentXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('word/document.xml') ?? ''
    expect(docxExportDocumentXml.match(/<w:tblHeader\/>/g)).toHaveLength(1)
    expect(docxExportDocumentXml.match(/<w:cantSplit\/>/g)).toHaveLength(76)
    expect(docxExportDocumentXml.match(/<w:jc w:val="right"\/>/g)).toHaveLength(76)
    expect(docxExportDocumentXml.match(/<w:jc w:val="center"\/>/g)).toHaveLength(76)
    // The header row is shaded as MD View's, and the table is as wide as the text.
    expect(docxExportDocumentXml).toContain('w:fill="F2F4F7"')
    expect(docxExportDocumentXml).toContain('<w:tblW w:type="dxa" w:w="9640"/>')
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toContain('<thead><tr><th><p><strong>Item</strong></p></th>')
    expect(mammothHtml).toContain('<td><p>Item 75</p></td>')
  })

  it('writes a callout as a shaded card with its icon and its title in the kind’s ink', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Callouts.md', getTestNoteText('Guides/Callouts.md'), { docxExportPictureTools: { drawDocxExportIconPng: drawTestIconPng } })
    const docxExportFileParts = await readPapelizDocxExportFileParts(docxExportFileBlob)
    const docxExportDocumentXml = docxExportFileParts.get('word/document.xml') ?? ''
    // note (blue), tip (blue), warning, danger and example: the grounds and inks of MD View.
    for (const calloutGroundColor of ['EAF2FE', 'FFF4E0', 'FDE8E7', 'EFE9FF']) expect(docxExportDocumentXml).toContain(`w:fill="${calloutGroundColor}"`)
    for (const calloutInkColor of ['0064D4', '8A4B00', 'A3302A', '5B3FC4']) expect(docxExportDocumentXml).toContain(`<w:color w:val="${calloutInkColor}"/>`)
    expect(docxExportDocumentXml.match(/<w:drawing>/g)).toHaveLength(5)
    expect(docxExportDocumentXml).toContain('descr=""')
    expect([...docxExportFileParts.keys()].filter((docxExportFilePartPath) => docxExportFilePartPath.startsWith('word/media/'))).not.toHaveLength(0)
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toContain('<ul><li>Callouts can hold lists</li><li>and <strong>formatting</strong>, too.</li></ul>')
  })

  it('keeps a callout’s card and title when its icon can’t be drawn', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Callouts.md', getTestNoteText('Guides/Callouts.md'))
    const docxExportDocumentXml = (await readPapelizDocxExportFileParts(docxExportFileBlob)).get('word/document.xml') ?? ''
    expect(docxExportDocumentXml).not.toContain('<w:drawing>')
    expect(docxExportDocumentXml).toContain('w:fill="FFF4E0"')
  })

  it('colors a callout with a custom color as MD View mixes it', async () => {
    const docxExportDocumentXml = (await readPapelizDocxExportFileParts(await buildTestNoteFile('Custom.md', '> [!note|#7c3aed] Purple\n> Body.'))).get('word/document.xml') ?? ''
    expect(docxExportDocumentXml).toMatch(/w:fill="E[67]E[12]FF"/)
  })

  it('writes footnotes as Word footnotes, with their formatting and links', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Every block.md', getTestNoteText('Every block.md'))
    const docxExportFileParts = await readPapelizDocxExportFileParts(docxExportFileBlob)
    expect(docxExportFileParts.get('word/document.xml')?.match(/<w:footnoteReference w:id="\d+"\/>/g)).toHaveLength(2)
    expect(docxExportFileParts.get('word/footnotes.xml')).toContain('The footnote')
    expect(docxExportFileParts.get('word/_rels/footnotes.xml.rels')).toContain('Target="https://example.com/footnote"')
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toMatch(/<li id="footnote-\d+"><p>The footnote's text\./)
    expect(mammothHtml).toMatch(/<li id="footnote-\d+"><p>A footnote with <strong>bold<\/strong> and a <a href="https:\/\/example.com\/footnote">link<\/a>/)
  })

  it('links to the note’s own headings, and leaves links to other notes as text in a one-note file', async () => {
    const docxExportFileBlob = await buildTestNoteFile('Links and headings.md', getTestNoteText('Links and headings.md'))
    const { mammothHtml } = await readPapelizDocxExportFileWithMammoth(docxExportFileBlob)
    expect(mammothHtml).toContain('<a href="#_h2_part_two">Part two</a>')
    expect(mammothHtml).toContain('<a href="#_h5_part_three">a labelled heading link</a>')
    expect(mammothHtml).toContain('<a href="#_h2_part_two">a Markdown link</a>')
    expect(mammothHtml).toContain('Links to other notes: Every block, Every block › Lists and a Markdown link to a note.')
  })
})

// A picture as the tests' vault holds it: the first bytes of a PNG, which give its size. Tests have
// no canvas to decode pictures with, so the tools below read that size and stand in for drawing.
function createTestPictureBlob(pictureNaturalPixelWidth: number, pictureNaturalPixelHeight: number, pictureMediaType = 'image/png'): Blob {
  const pictureHeaderBytes = new Uint8Array(24)
  pictureHeaderBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const pictureHeaderView = new DataView(pictureHeaderBytes.buffer)
  pictureHeaderView.setUint32(16, pictureNaturalPixelWidth)
  pictureHeaderView.setUint32(20, pictureNaturalPixelHeight)
  return new Blob([pictureHeaderBytes], { type: pictureMediaType })
}

interface TestPictureToolsRecord {
  rewrittenPictureSizes: string[]
  diagramNoteFontFamilies: string[]
}

function createTestPictureTools(testPictureToolsRecord: TestPictureToolsRecord): Partial<PapelizDocxExportPictureTools> {
  return {
    drawDocxExportIconPng: drawTestIconPng,
    rewriteDocxExportPicture: async (pictureBlob, pictureMediaType, choosePictureBitmapSize) => {
      const pictureHeaderBytes = new Uint8Array(await pictureBlob.arrayBuffer())
      if (pictureHeaderBytes.length < 24 || pictureHeaderBytes[1] !== 0x50) return null
      const pictureHeaderView = new DataView(pictureHeaderBytes.buffer)
      const pictureNaturalPixelWidth = pictureHeaderView.getUint32(16)
      const pictureNaturalPixelHeight = pictureHeaderView.getUint32(20)
      const { bitmapPixelWidth, bitmapPixelHeight } = choosePictureBitmapSize(pictureNaturalPixelWidth, pictureNaturalPixelHeight, pictureMediaType === 'image/svg+xml')
      testPictureToolsRecord.rewrittenPictureSizes.push(`${pictureMediaType} ${pictureNaturalPixelWidth}x${pictureNaturalPixelHeight} -> ${bitmapPixelWidth}x${bitmapPixelHeight}`)
      return {
        docxExportPicture: { pictureBytes: testIconPngBytes, pictureType: 'png', picturePixelWidth: bitmapPixelWidth, picturePixelHeight: bitmapPixelHeight },
        pictureNaturalPixelWidth,
        pictureNaturalPixelHeight,
      }
    },
    fetchDocxExportWebPicture: async (pictureWebAddress) => (pictureWebAddress === 'https://pictures.example/shared.png' ? createTestPictureBlob(400, 300) : null),
    drawDocxExportMermaidDiagramPng: async (mermaidDiagramSource, docxExportNoteFontFamily) => {
      testPictureToolsRecord.diagramNoteFontFamilies.push(docxExportNoteFontFamily)
      if (mermaidDiagramSource.trim().endsWith('-->')) return { mermaidDiagramErrorMessage: 'Parse error on line 2' }
      return {
        docxExportPicture: { pictureBytes: testIconPngBytes, pictureType: 'png', picturePixelWidth: 1000, picturePixelHeight: 400 },
        mermaidDiagramPixelWidth: 500,
        mermaidDiagramPixelHeight: 200,
      }
    },
  }
}

function decodeXmlAttributeValue(xmlAttributeValue: string): string {
  return xmlAttributeValue
    .replace(/&#xA;/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

describe('pictures and diagrams', () => {
  const picturesNoteRelativePath = 'Pictures and diagrams.md'
  const picturesNoteText = getTestNoteText(picturesNoteRelativePath)

  async function exportPicturesTestNote() {
    const testPictureToolsRecord: TestPictureToolsRecord = { rewrittenPictureSizes: [], diagramNoteFontFamilies: [] }
    const picturesVaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: picturesNoteRelativePath, vaultNoteText: picturesNoteText }])
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/garden-plan.png', createTestPictureBlob(600, 400))
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/wide-photo.jpg', createTestPictureBlob(3000, 1000, 'image/jpeg'))
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/tall-picture.png', createTestPictureBlob(400, 2000))
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/small-drawing.svg', createTestPictureBlob(48, 24, 'image/svg+xml'))
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/small-icon.png', createTestPictureBlob(64, 64))
    await picturesVaultAdapter.createVaultAttachmentFile('pictures/broken.png', new Blob(['not a picture']))
    const docxExportResult = await exportPapelizNotesAsDocx({
      docxExportVault: { vaultAdapter: picturesVaultAdapter, vaultDisplayName: 'Pictures' },
      docxExportVaultNoteRelativePaths: [picturesNoteRelativePath],
      docxExportEveryVaultNoteRelativePath: [picturesNoteRelativePath],
      docxExportPageSize: 'a4',
      docxExportNoteFontFamily: 'sans',
      docxExportPictureTools: createTestPictureTools(testPictureToolsRecord),
    })
    const docxExportFileParts = await readPapelizDocxExportFileParts(docxExportResult.docxExportFileBlob)
    return { docxExportResult, docxExportFileParts, docxExportDocumentXml: docxExportFileParts.get('word/document.xml') ?? '', testPictureToolsRecord }
  }

  it('places the vault’s and the web’s pictures inside the file, at MD View’s size on paper', async () => {
    const { docxExportDocumentXml, docxExportFileParts, testPictureToolsRecord } = await exportPicturesTestNote()
    const pictureExtentsInPixels = [...docxExportDocumentXml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/g)].map(
      (extentMatch) => `${Number(extentMatch[1]) / 9525}x${Number(extentMatch[2]) / 9525}`,
    )
    expect(pictureExtentsInPixels).toEqual([
      // 600 × 400 px at MD View's 17 px to 11 pt.
      '518x345',
      // 3000 × 1000 px, made as wide as the text (482 pt).
      '643x214',
      // 400 × 2000 px, made as tall as a page's text leaves room for.
      '186x932',
      '518x345',
      // `|120` gives the width; the height follows.
      '104x69',
      '41x21',
      '55x55',
      '345x259',
      '55x55',
      '431x173',
      '431x173',
    ])
    // A photo gets twice the pixels it prints at, never more than it has; an SVG is drawn at twice.
    expect(testPictureToolsRecord.rewrittenPictureSizes).toContain('image/png 600x400 -> 600x400')
    expect(testPictureToolsRecord.rewrittenPictureSizes).toContain('image/jpeg 3000x1000 -> 1285x428')
    expect(testPictureToolsRecord.rewrittenPictureSizes).toContain('image/png 400x2000 -> 373x1864')
    expect(testPictureToolsRecord.rewrittenPictureSizes).toContain('image/png 600x400 -> 207x138')
    expect(testPictureToolsRecord.rewrittenPictureSizes).toContain('image/svg+xml 48x24 -> 83x41')
    // Every picture is held in the file; nothing is linked for Word to fetch.
    expect(docxExportDocumentXml).not.toContain('r:link=')
    const docxExportRelationshipsXml = docxExportFileParts.get('word/_rels/document.xml.rels') ?? ''
    for (const relationshipMatch of docxExportRelationshipsXml.matchAll(/<Relationship\b[^>]*\/image"[^>]*>/g)) expect(relationshipMatch[0]).not.toContain('TargetMode="External"')
    // A paragraph that shows a picture has single line spacing.
    expect(docxExportDocumentXml.match(/w:line="240" w:lineRule="auto"/g)?.length ?? 0).toBeGreaterThanOrEqual(11)
  })

  it('gives each picture its alt text, and each diagram its Mermaid source with its lines, as the description', async () => {
    const { docxExportDocumentXml, docxExportResult, testPictureToolsRecord } = await exportPicturesTestNote()
    const pictureDescriptions = [...docxExportDocumentXml.matchAll(/<wp:docPr\b[^>]*\sdescr="([^"]*)"/g)].map((descriptionMatch) => decodeXmlAttributeValue(descriptionMatch[1] ?? ''))
    expect(pictureDescriptions).toEqual([
      'A plan of the garden',
      'A wide photo of the beds',
      'A tall picture',
      'garden-plan.png',
      'garden-plan.png',
      'A small drawing',
      'A small icon',
      'A picture on the web',
      'A small icon',
      'flowchart LR\n  A[Write a block] --> B{Cursor inside it?}\n  B -- Yes --> C[Edit its Markdown]\n  B -- No --> D[See it drawn]',
      'sequenceDiagram\n  Writer->>Papeliz: Export as Word\n  Papeliz-->>Writer: A file that holds its pictures',
    ])
    expect(testPictureToolsRecord.diagramNoteFontFamilies).toEqual(['sans', 'sans', 'sans'])
    // mammoth, reading the file on its own, finds the source's lines in the diagram's alt text.
    const { mammothHtml, mammothErrorMessages } = await readPapelizDocxExportFileWithMammoth(docxExportResult.docxExportFileBlob)
    expect(mammothErrorMessages).toEqual([])
    expect(mammothHtml).toContain('alt="sequenceDiagram\n  Writer-&gt;&gt;Papeliz: Export as Word\n')
  })

  it('writes a line for each picture it can’t read, a diagram it can’t draw as its source, and says so', async () => {
    const { docxExportResult, docxExportFileParts } = await exportPicturesTestNote()
    const { mammothRawText } = await readPapelizDocxExportFileWithMammoth(docxExportResult.docxExportFileBlob)
    const picturesNoteRawText = normalizePapelizDocxExportWhitespace(mammothRawText)
    expect(picturesNoteRawText).toContain("A picture from the web, and one whose site doesn't let other pages read it: Picture: A blue square https://papeliz.com/missing-square.png")
    expect(picturesNoteRawText).toContain('Picture: A broken picture Image: Not in the vault')
    expect(picturesNoteRawText).toContain('shown as its source: flowchart LR A --> This diagram can’t be drawn: Parse error on line 2')
    expect(docxExportFileParts.get('word/_rels/document.xml.rels')).toContain('Target="https://papeliz.com/missing-square.png" TargetMode="External"')
    expect(docxExportResult.docxExportNotices).toEqual([
      'Couldn’t load a picture from the web for “Pictures and diagrams”; it shows as its address.',
      'Couldn’t read “broken.png” for “Pictures and diagrams”; it shows as a line.',
      'Couldn’t draw a diagram in “Pictures and diagrams”; it shows as its source.',
    ])
  })

  it('sizes a picture as MD View shows it, then fits it to its room', () => {
    expect(getPapelizDocxExportPictureShownPixelSize(600, 400, null, null)).toEqual({ pictureShownPixelWidth: 600, pictureShownPixelHeight: 400 })
    expect(getPapelizDocxExportPictureShownPixelSize(600, 400, 120, null)).toEqual({ pictureShownPixelWidth: 120, pictureShownPixelHeight: 80 })
    expect(getPapelizDocxExportPictureShownPixelSize(600, 400, 120, 50)).toEqual({ pictureShownPixelWidth: 120, pictureShownPixelHeight: 50 })
    const { printedWidthPoints, printedHeightPoints } = fitPapelizDocxExportPictureSizePoints(170, 85, 482, 700)
    expect([printedWidthPoints, printedHeightPoints]).toEqual([110, 55])
    const fittedWidePicture = fitPapelizDocxExportPictureSizePoints(3400, 340, 482, 700)
    expect(fittedWidePicture.printedWidthPoints).toBeCloseTo(482)
    expect(fittedWidePicture.printedHeightPoints).toBeCloseTo(48.2)
  })
})

describe('exportPapelizNotesAsDocx', () => {
  const sampleVaultNoteRelativePaths = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath)
  const createSampleDocxExportVault = () => ({ vaultAdapter: new PapelizInMemoryVaultAdapter(papelizSampleVaultNotes), vaultDisplayName: 'Sample vault' })

  it('saves one note as its own .docx', async () => {
    const docxExportResult = await exportPapelizNotesAsDocx({
      docxExportVault: createSampleDocxExportVault(),
      docxExportVaultNoteRelativePaths: ['Guides/Callouts.md'],
      docxExportEveryVaultNoteRelativePath: sampleVaultNoteRelativePaths,
      docxExportPageSize: 'a4',
      docxExportNoteFontFamily: 'sans',
    })
    expect(docxExportResult.docxExportFileName).toBe('Callouts.docx')
    expect(docxExportResult.docxExportFileBlob.type).toBe(papelizDocxExportFileMediaType)
    expect(docxExportResult.docxExportNotices).toEqual([])
  })

  it('saves several notes as one .zip, folders kept, reporting progress', async () => {
    const docxExportProgressCounts: string[] = []
    const docxExportResult = await exportPapelizNotesAsDocx({
      docxExportVault: createSampleDocxExportVault(),
      docxExportVaultNoteRelativePaths: sampleVaultNoteRelativePaths,
      docxExportEveryVaultNoteRelativePath: sampleVaultNoteRelativePaths,
      docxExportPageSize: 'letter',
      docxExportNoteFontFamily: 'sans',
      onDocxExportProgress: (exportedNoteCount, docxExportNoteCount) => docxExportProgressCounts.push(`${exportedNoteCount}/${docxExportNoteCount}`),
    })
    expect(docxExportResult.docxExportFileName).toBe('Sample vault Word.zip')
    expect(docxExportProgressCounts).toEqual(sampleVaultNoteRelativePaths.map((_sampleVaultNoteRelativePath, sampleNoteIndex) => `${sampleNoteIndex + 1}/${sampleVaultNoteRelativePaths.length}`))
    const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await docxExportResult.docxExportFileBlob.arrayBuffer()))
    expect(importZipEntries.map((importZipEntry) => importZipEntry.importZipEntryPath)).toEqual(sampleVaultNoteRelativePaths.map((sampleVaultNoteRelativePath) => sampleVaultNoteRelativePath.replace(/\.md$/, '.docx')))
    const gardenPlanZipEntry = importZipEntries.find((importZipEntry) => importZipEntry.importZipEntryPath === 'Projects/Garden plan.docx')
    const gardenPlanFileBlob = new Blob([(await gardenPlanZipEntry?.readImportZipEntryBytes()) as Uint8Array<ArrayBuffer>])
    const { mammothRawText } = await readPapelizDocxExportFileWithMammoth(gardenPlanFileBlob)
    expect(normalizePapelizDocxExportWhitespace(mammothRawText)).toContain('Three raised beds along the south fence.')
  })

  it('links the notes in a .zip to each other’s files, relative to each file', async () => {
    const docxExportResult = await exportPapelizNotesAsDocx({
      docxExportVault: createSampleDocxExportVault(),
      docxExportVaultNoteRelativePaths: ['Start here.md', 'Guides/Links between notes.md', 'Projects/Garden plan.md'],
      docxExportEveryVaultNoteRelativePath: sampleVaultNoteRelativePaths,
      docxExportPageSize: 'a4',
      docxExportNoteFontFamily: 'sans',
      docxExportPictureTools: { drawDocxExportIconPng: drawTestIconPng },
    })
    const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await docxExportResult.docxExportFileBlob.arrayBuffer()))
    const readZipEntryExternalTargets = async (zipEntryPath: string) => {
      const zipEntryBytes = await importZipEntries.find((importZipEntry) => importZipEntry.importZipEntryPath === zipEntryPath)?.readImportZipEntryBytes()
      const zipEntryRelationshipsXml = (await readPapelizDocxExportFileParts(new Blob([zipEntryBytes as Uint8Array<ArrayBuffer>]))).get('word/_rels/document.xml.rels') ?? ''
      return [...zipEntryRelationshipsXml.matchAll(/<Relationship\b[^>]*TargetMode="External"[^>]*>/g)].map((relationshipMatch) => /Target="([^"]*)"/.exec(relationshipMatch[0])?.[1]).sort()
    }
    // Start here links to "Links between notes" (exported) and to other guides (not exported: text).
    expect(await readZipEntryExternalTargets('Start here.docx')).toEqual(['Guides/Links%20between%20notes.docx'])
    expect(await readZipEntryExternalTargets('Guides/Links between notes.docx')).toEqual(['../Projects/Garden%20plan.docx', '../Start%20here.docx'])
    expect(await readZipEntryExternalTargets('Projects/Garden plan.docx')).toEqual([])
  })

  it('stops when the export is cancelled', async () => {
    const docxExportAbortController = new AbortController()
    docxExportAbortController.abort()
    await expect(
      exportPapelizNotesAsDocx({
        docxExportVault: createSampleDocxExportVault(),
        docxExportVaultNoteRelativePaths: sampleVaultNoteRelativePaths,
        docxExportEveryVaultNoteRelativePath: sampleVaultNoteRelativePaths,
        docxExportPageSize: 'a4',
        docxExportNoteFontFamily: 'sans',
        docxExportAbortSignal: docxExportAbortController.signal,
      }),
    ).rejects.toThrow()
  })
})

describe('Word export names', () => {
  it('describes the file before the export runs', () => {
    expect(describePapelizDocxExportFile('Field Notes', ['Projects/Launch plan.md'])).toMatchObject({ docxExportFileName: 'Launch plan.docx', docxExportFileExtension: '.docx' })
    expect(describePapelizDocxExportFile('Field: Notes', ['A.md', 'B.md'])).toMatchObject({ docxExportFileName: 'Field- Notes Word.zip', docxExportFileMediaType: 'application/zip' })
  })

  it('keeps two notes with the same file name apart in the .zip', () => {
    expect([...getPapelizDocxExportZipEntryPaths(['Plan?.md', 'Plan-.md', 'plan-.md', 'Ideas/Plan?.md']).values()]).toEqual(['Plan-.docx', 'Plan- 2.docx', 'plan- 3.docx', 'Ideas/Plan-.docx'])
  })

  it('makes links between files in the .zip relative to the linking file', () => {
    expect(getPapelizDocxExportRelativeFileHref('Guides/Callouts.docx', 'Projects/Garden plan.docx')).toBe('../Projects/Garden%20plan.docx')
    expect(getPapelizDocxExportRelativeFileHref('Start here.docx', 'Guides/A/B.docx')).toBe('Guides/A/B.docx')
    expect(getPapelizDocxExportRelativeFileHref('Guides/A/B.docx', 'Guides/C.docx')).toBe('../C.docx')
    expect(getPapelizDocxExportRelativeFileHref('Guides/C.docx', 'Guides/C 2.docx')).toBe('C%202.docx')
    expect(getPapelizDocxExportRelativeFileHref('A/B/C.docx', 'D.docx')).toBe('../../D.docx')
  })

  it('makes bookmark names Word accepts', () => {
    expect(createPapelizDocxExportBookmarkName(3, 'launch-plan')).toBe('_h3_launch_plan')
    expect(createPapelizDocxExportBookmarkName(12, 'café-ünïcode')).toBe('_h12_cafe_unicode')
    expect(createPapelizDocxExportBookmarkName(4, '日本語')).toBe('_h4')
    expect(createPapelizDocxExportBookmarkName(1, 'a'.repeat(80))).toHaveLength(40)
  })
})
