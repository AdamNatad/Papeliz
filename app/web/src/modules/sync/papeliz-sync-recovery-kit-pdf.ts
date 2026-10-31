import { choosePapelizExportDefaultPageSize } from '../export-print-style/papeliz-export-print-style'
import type { PapelizPdfExportOptions } from '../pdf-export/papeliz-pdf-export'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { buildPapelizSyncRecoveryKitNoteText } from './papeliz-sync-screen-words'

// The Recovery Kit as a PDF, made on this device by Papeliz's own PDF engine from a note that lives
// only in memory: the Recovery Key goes into no vault and over no network, only into the file the
// person downloads. The engine loads with the first Recovery Kit, not with the set-up dialog.

export const papelizSyncRecoveryKitNoteRelativePath = 'Papeliz Sync Recovery Kit.md'

// What tests give instead of the browser's own: the font files, the PDF writer (no worker in tests)
// and the drawing of characters no bundled font has.
export type PapelizSyncRecoveryKitPdfTestTools = Pick<PapelizPdfExportOptions, 'readPdfExportFontFile' | 'pdfExportNotePdfWriter' | 'drawPdfExportCharacterPictures'>

export async function makePapelizSyncRecoveryKitPdf(
  syncRecoveryKeyText: string,
  accountLabel: string | null,
  recoveryKitPdfTestTools: PapelizSyncRecoveryKitPdfTestTools = {},
): Promise<{ recoveryKitPdfFileName: string; recoveryKitPdfFileBlob: Blob }> {
  const { exportPapelizNotesAsPdf } = await import('../pdf-export/papeliz-pdf-export')
  const recoveryKitVaultAdapter = new PapelizInMemoryVaultAdapter([
    { vaultNoteRelativePath: papelizSyncRecoveryKitNoteRelativePath, vaultNoteText: buildPapelizSyncRecoveryKitNoteText(syncRecoveryKeyText, accountLabel, new Date()) },
  ])
  const pdfExportResult = await exportPapelizNotesAsPdf({
    pdfExportVault: { vaultAdapter: recoveryKitVaultAdapter, vaultDisplayName: 'Papeliz Sync' },
    pdfExportVaultNoteRelativePaths: [papelizSyncRecoveryKitNoteRelativePath],
    pdfExportEveryVaultNoteRelativePath: [papelizSyncRecoveryKitNoteRelativePath],
    pdfExportPageSize: choosePapelizExportDefaultPageSize(typeof navigator === 'undefined' ? [] : navigator.languages),
    pdfExportNoteFontFamily: 'sans',
    // Never asks to use the computer's fonts: the kit's text is all in Papeliz's own.
    pdfExportComputerFontSource: null,
    ...recoveryKitPdfTestTools,
  })
  return { recoveryKitPdfFileName: pdfExportResult.pdfExportFileName, recoveryKitPdfFileBlob: pdfExportResult.pdfExportFileBlob }
}
