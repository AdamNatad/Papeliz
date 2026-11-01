// A failed save in plain words: a few words for the status bar and the tab, and what to do, for the
// message that says so. The vault reports failures as short codes ("File In Use",
// describePapelizVaultError in papeliz-vault-adapter.ts); people never see those alone.

export interface PapelizNoteSaveFailureWords {
  // A few words, for the status bar beside "Not saved" and the tab's tooltip.
  noteSaveFailureShortReason: string
  // Why, and what to do next.
  noteSaveFailureAdvice: string
}

export function describePapelizNoteSaveFailure(noteSaveErrorCode: string | null): PapelizNoteSaveFailureWords {
  switch (noteSaveErrorCode) {
    case 'File In Use':
      return {
        noteSaveFailureShortReason: 'File open elsewhere',
        noteSaveFailureAdvice: 'Another program has the file open. Close it there, then press Try again.',
      }
    case 'No Permission':
      return {
        noteSaveFailureShortReason: 'No permission',
        noteSaveFailureAdvice:
          'Papeliz may no longer write to this folder. Copy your changes somewhere safe, then close the vault and open it again from Recent Vaults to allow it.',
      }
    case 'File Not Found':
      return {
        noteSaveFailureShortReason: 'Folder gone',
        noteSaveFailureAdvice: 'The note’s folder was moved or deleted outside Papeliz. Copy your changes somewhere safe, then press Try again.',
      }
    case 'Disk Full':
      return {
        noteSaveFailureShortReason: 'Disk full',
        noteSaveFailureAdvice: 'The disk is full. Free some space, then press Try again.',
      }
    case 'Browser Storage Full':
      return {
        noteSaveFailureShortReason: 'Browser storage full',
        noteSaveFailureAdvice: 'This browser’s storage for Papeliz is full. Free some space (delete a vault you no longer need), then press Try again.',
      }
    default:
      return {
        noteSaveFailureShortReason: 'Couldn’t write the file',
        noteSaveFailureAdvice: 'Press Try again. If it keeps failing, copy your changes somewhere safe.',
      }
  }
}

// The message for a note whose save just failed.
export function describePapelizNoteSaveFailureMessage(vaultNoteTitle: string, noteSaveErrorCode: string | null): string {
  return `Couldn’t save “${vaultNoteTitle}”. ${describePapelizNoteSaveFailure(noteSaveErrorCode).noteSaveFailureAdvice}`
}
