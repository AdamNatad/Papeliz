import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import { buildPapelizPdfExportTestNotePdfJob, papelizPdfExportTestVaultNotes } from './papeliz-pdf-export.test-support'

// Writes every sample and test note as a PDF into the folder PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER
// names, for veraPDF's PDF/UA-1 check (`verapdf --flavour ua1 <folder>`). Skipped when it isn't set.
const papelizPdfExportVerapdfFolderPath = process.env.PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER ?? ''

describe.skipIf(papelizPdfExportVerapdfFolderPath === '')('PDF export files for veraPDF', () => {
  it('writes every sample and test note as a PDF', async () => {
    await mkdir(papelizPdfExportVerapdfFolderPath, { recursive: true })
    for (const { vaultNoteRelativePath, vaultNoteText } of papelizPdfExportTestVaultNotes) {
      const notePdfFileStem = vaultNoteRelativePath.replace(/\.md$/, '').replace(/[\\/]/g, ' - ')
      for (const [noteFontFamily, pdfExportPageSize] of [['sans', 'a4'], ['serif', 'letter']] as const) {
        const notePdfJob = await buildPapelizPdfExportTestNotePdfJob(vaultNoteRelativePath, vaultNoteText, noteFontFamily, pdfExportPageSize)
        const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
        await writeFile(join(papelizPdfExportVerapdfFolderPath, `${notePdfFileStem} (${noteFontFamily}, ${pdfExportPageSize}).pdf`), pdfFileBytes)
      }
    }
  }, 300_000)
})
