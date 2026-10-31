import { describe, expect, it } from 'vitest'
import {
  papelizPdfExportInPlaceNotePdfWriter,
  readPapelizPdfExportFileWithPdfJs,
  readPapelizPdfExportTestFontFile,
  removePapelizPdfExportTestWhitespace,
} from '../pdf-export/papeliz-pdf-export.test-support'
import { makePapelizSyncRecoveryKitPdf } from './papeliz-sync-recovery-kit-pdf'
import { buildPapelizSyncRecoveryKitNoteText } from './papeliz-sync-screen-words'

// The Recovery Kit's PDF, made by the PDF engine in place (tests have no worker) and read back with pdf.js.

describe('the Recovery Kit', () => {
  it('is a note with the key in groups of four, in a code block', () => {
    const recoveryKitNoteText = buildPapelizSyncRecoveryKitNoteText('abcd-efgh-jkmn-pqrs-tvwx-yz23', 'you@example.com', new Date('2026-10-31T12:00:00Z'))
    expect(recoveryKitNoteText).toContain('```text\nABCD EFGH JKMN PQRS TVWX YZ23\n```')
    expect(recoveryKitNoteText).toContain('- Account: you@example.com')
    expect(recoveryKitNoteText).toContain('- Made on October 31, 2026')
    expect(buildPapelizSyncRecoveryKitNoteText('ABCDEFGHJKMNPQRSTVWXYZ23', null, new Date())).not.toContain('Account:')
  })

  it('prints as a PDF made on this device, titled, with the key in it', async () => {
    const { recoveryKitPdfFileName, recoveryKitPdfFileBlob } = await makePapelizSyncRecoveryKitPdf('ABCDEFGHJKMNPQRSTVWXYZ23', 'you@example.com', {
      readPdfExportFontFile: readPapelizPdfExportTestFontFile,
      pdfExportNotePdfWriter: papelizPdfExportInPlaceNotePdfWriter,
      drawPdfExportCharacterPictures: async () => [],
    })
    expect(recoveryKitPdfFileName).toBe('Papeliz Sync Recovery Kit.pdf')
    expect(recoveryKitPdfFileBlob.type).toBe('application/pdf')
    const recoveryKitPdfReading = await readPapelizPdfExportFileWithPdfJs(new Uint8Array(await recoveryKitPdfFileBlob.arrayBuffer()))
    expect(recoveryKitPdfReading.pdfJsPageCount).toBe(1)
    expect(recoveryKitPdfReading.pdfJsTitle).toBe('Papeliz Sync Recovery Kit')
    const recoveryKitPdfText = removePapelizPdfExportTestWhitespace(
      recoveryKitPdfReading.pdfJsTextItemsByPage.flat().map((pdfJsTextItem) => pdfJsTextItem.pdfJsText).join(' '),
    )
    expect(recoveryKitPdfText).toContain(removePapelizPdfExportTestWhitespace('ABCD EFGH JKMN PQRS TVWX YZ23'))
    expect(recoveryKitPdfText).toContain(removePapelizPdfExportTestWhitespace('Account: you@example.com'))
  })
})
