import { describe, expect, it } from 'vitest'
import { checkPapelizPdfExportFileBytes } from './papeliz-pdf-export-file-check'

// A small PDF 1.7 file from object bodies, with a correct cross-reference table, so each test can
// change exactly one thing.
function buildTestPdfFile(pdfObjectBodies: readonly string[], crossReferenceOffsetShift = 0): Uint8Array {
  let pdfFileText = '%PDF-1.7\n'
  const pdfObjectOffsets: number[] = []
  pdfObjectBodies.forEach((pdfObjectBody, pdfObjectIndex) => {
    pdfObjectOffsets.push(pdfFileText.length)
    pdfFileText += `${pdfObjectIndex + 1} 0 obj\n${pdfObjectBody}\nendobj\n`
  })
  const crossReferenceOffset = pdfFileText.length
  pdfFileText += `xref\n0 ${pdfObjectBodies.length + 1}\n0000000000 65535 f \n`
  for (const pdfObjectOffset of pdfObjectOffsets) pdfFileText += `${String(pdfObjectOffset + crossReferenceOffsetShift).padStart(10, '0')} 00000 n \n`
  pdfFileText += `trailer\n<<\n/Size ${pdfObjectBodies.length + 1}\n/Root 1 0 R\n/ID [<00> <00>]\n>>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`
  return Uint8Array.from(pdfFileText, (pdfCharacter) => pdfCharacter.charCodeAt(0))
}

const papelizTestPdfCatalog = '<<\n/Type /Catalog\n/Pages 2 0 R\n>>'
const papelizTestPdfPages = '<<\n/Type /Pages\n/Kids []\n/Count 0\n>>'

describe('PDF export file check', () => {
  it('passes a well-formed file, even with forbidden words inside strings and streams', () => {
    expect(() =>
      checkPapelizPdfExportFileBytes(
        buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages, '<<\n/Title (Notes on /JavaScript \\) and /Launch)\n>>', '<<\n/Length 11\n>>\nstream\n/JavaScript\nendstream']),
      ),
    ).not.toThrow()
  })

  it('refuses actions that run or open something, and attached files', () => {
    for (const forbiddenPdfName of ['JavaScript', 'JS', 'Launch', 'GoToR', 'SubmitForm', 'EmbeddedFile', 'OpenAction', 'AA', 'Java#53cript']) {
      expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages, `<<\n/S /${forbiddenPdfName}\n>>`])), forbiddenPdfName).toThrow(/names/)
    }
  })

  it('refuses a standard font left out of the file and an embedded font without its character map', () => {
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages, '<<\n/Type /Font\n/BaseFont /Helvetica\n>>']))).toThrow(/without embedding/)
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages, '<<\n/Type /Font\n/Subtype /Type0\n/BaseFont /ABCDEF+Figtree-Regular\n>>']))).toThrow(
      /map back/,
    )
  })

  it('refuses a file without bookmarks for a note with headings', () => {
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages]), { hasPdfBookmarks: true })).toThrow(/no bookmarks/)
    const catalogWithOutlines = '<<\n/Type /Catalog\n/Pages 2 0 R\n/Outlines 3 0 R\n>>'
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([catalogWithOutlines, papelizTestPdfPages, '<<\n/Type /Outlines\n/Count 0\n>>']), { hasPdfBookmarks: true })).not.toThrow()
  })

  it('refuses wrong offsets, a stream of the wrong length, and a file that isn’t PDF 1.7', () => {
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages], 3))).toThrow(/points beside/)
    expect(() => checkPapelizPdfExportFileBytes(buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages, '<<\n/Length 4\n>>\nstream\n/JavaScript\nendstream']))).toThrow(/wrong length/)
    const pdfFileBytes = buildTestPdfFile([papelizTestPdfCatalog, papelizTestPdfPages])
    pdfFileBytes[7] = '4'.charCodeAt(0)
    expect(() => checkPapelizPdfExportFileBytes(pdfFileBytes)).toThrow(/PDF 1.7/)
  })
})
