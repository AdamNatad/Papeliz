import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { describePapelizFailureCode, papelizUnknownFailureSentence } from '../vault/papeliz-failure-code-words'

// A failed save in plain words: a few words for the status bar and the tab, and what to do, for the
// message that says so. The vault reports failures as short codes ("File In Use",
// describePapelizVaultError in papeliz-vault-adapter.ts); people never see those. What to do is the
// code's sentence (papeliz-failure-code-words.ts), except where closing or reloading would lose the
// unsaved typing: then it says to copy it somewhere safe first.

export interface PapelizNoteSaveFailureWords {
  // A few words, for the status bar beside "Not saved" and the tab's tooltip.
  noteSaveFailureShortReason: string
  // Why, and what to do next.
  noteSaveFailureAdvice: string
}

export function describePapelizNoteSaveFailure(noteSaveErrorCode: string | null): PapelizNoteSaveFailureWords {
  switch (noteSaveErrorCode) {
    case 'File In Use':
      return { noteSaveFailureShortReason: 'File open elsewhere', noteSaveFailureAdvice: describePapelizFailureCode(noteSaveErrorCode) }
    case 'No Permission':
      return {
        noteSaveFailureShortReason: 'No permission',
        // In the desktop app the folder's permission is Windows', so opening the vault again doesn't help.
        noteSaveFailureAdvice: isPapelizDesktopApp
          ? 'Papeliz may no longer write to this folder. Copy your changes somewhere safe, check the folder isn’t read-only, then press Try Again.'
          : 'Papeliz may no longer write to this folder. Copy your changes somewhere safe, then close the vault and open it again from Recent Vaults to allow it.',
      }
    case 'File Not Found':
      return {
        noteSaveFailureShortReason: 'Folder gone',
        noteSaveFailureAdvice: 'The note’s folder was moved or deleted outside Papeliz. Copy your changes somewhere safe, then press Try Again.',
      }
    case 'Disk Full':
      return { noteSaveFailureShortReason: 'Disk full', noteSaveFailureAdvice: describePapelizFailureCode(noteSaveErrorCode) }
    case 'Browser Storage Full':
      return { noteSaveFailureShortReason: 'Browser storage full', noteSaveFailureAdvice: describePapelizFailureCode(noteSaveErrorCode) }
  }
  const noteSaveFailureSentence = noteSaveErrorCode === null ? papelizUnknownFailureSentence : describePapelizFailureCode(noteSaveErrorCode)
  return {
    noteSaveFailureShortReason: 'Couldn’t write the file',
    noteSaveFailureAdvice:
      noteSaveFailureSentence === papelizUnknownFailureSentence ? 'Press Try Again. If it keeps failing, copy your changes somewhere safe.' : noteSaveFailureSentence,
  }
}

// The message for a note whose save just failed.
export function describePapelizNoteSaveFailureMessage(vaultNoteTitle: string, noteSaveErrorCode: string | null): string {
  return `Couldn’t save “${vaultNoteTitle}”. ${describePapelizNoteSaveFailure(noteSaveErrorCode).noteSaveFailureAdvice}`
}
