import { PapelizImportZipError } from '../export-zip/papeliz-import-zip-file-reader'
import { describePapelizVaultError } from './papeliz-vault-adapter'

// What people read when something fails: what happened and what to do, in plain sentences. The code
// passes failures around as short codes ("Name Taken", "File In Use"; describePapelizVaultError in
// papeliz-vault-adapter.ts, the name checks in papeliz-vault-relative-paths.ts, a zip's and an
// attachment's refusals). People never see a code: every one has its sentence here, and a message
// is the headline, then the sentence ("Couldn’t move “Plan” to the trash. The disk is full. …").
// A save's own words build on these (papeliz-note-save-failure-words.ts).

export interface PapelizFailureCodeContext {
  // The vault, note, text file or folder the failure is about, named in the sentence where it helps.
  failedEntryName?: string
  failedEntryKind?: 'vault' | 'note' | 'file' | 'folder'
  // What was being done: naming it (the default), or moving it into another folder.
  failedEntryAction?: 'name' | 'move'
}

export const papelizUnknownFailureSentence = 'Something went wrong. Try again, and reload Papeliz if it keeps failing.'

function describeNameTakenFailure({ failedEntryName, failedEntryKind, failedEntryAction }: PapelizFailureCodeContext): string {
  const whatToDo = failedEntryAction === 'move' ? 'Rename one of them first.' : 'Pick another name.'
  if (failedEntryName === undefined) return `That name is already taken there. ${whatToDo}`
  if (failedEntryKind === 'vault') return `A vault named “${failedEntryName}” already exists. ${whatToDo}`
  if (failedEntryKind === 'folder') return `A folder named “${failedEntryName}” is already there. ${whatToDo}`
  if (failedEntryKind === 'note') return `A note named “${failedEntryName}” is already there. ${whatToDo}`
  if (failedEntryKind === 'file') return `A file named “${failedEntryName}” is already there. ${whatToDo}`
  return `A note or folder named “${failedEntryName}” is already there. ${whatToDo}`
}

// A code is a few capitalized words with no full stop ("Name Taken", "Over 10 MB").
export function isPapelizFailureCodeShaped(failureText: string): boolean {
  return /^[A-Z0-9][\w’']*( [A-Z0-9][\w’']*)*$/.test(failureText)
}

// The sentence for a failure code. A code with no sentence yet gets the general one, so people never
// see it; text that isn't a code (a message that is already a sentence) is given back as it is.
export function describePapelizFailureCode(failureCode: string, failureCodeContext: PapelizFailureCodeContext = {}): string {
  switch (failureCode) {
    // The disk, the folder and the browser.
    case 'No Permission':
      return 'Papeliz may no longer change this folder. Close the vault and open it again from Recent Vaults to allow it.'
    case 'Permission Not Given':
      return 'Papeliz needs your permission to change this folder. Try again, and allow it when the browser asks.'
    case 'File Not Found':
      return 'It was moved or deleted outside Papeliz. Check the folder, then try again.'
    case 'File In Use':
      return 'Another program has this file open. Close it there, then try again.'
    case 'Disk Full':
      return 'The disk is full. Free some space, then try again.'
    case 'Browser Storage Full':
      return 'This browser’s storage for Papeliz is full. Delete a vault you no longer need, then try again.'
    case 'Not Enough Browser Storage':
      return 'This browser doesn’t have room for it. Free some space, then try again.'
    case 'Storage Off':
      return 'This browser won’t keep files for Papeliz here, as in some private windows. Use a normal window, or let this site store data.'
    case 'Browser Can’t Delete':
      return 'This browser can’t delete folders. Delete the folder on your disk instead.'
    case 'Browser Sent No Files':
      return 'The browser didn’t pass on the folder’s files. Try again, or import a .zip instead.'
    case 'Unknown Error':
      return papelizUnknownFailureSentence

    // The vault and what is in it.
    case 'No Vault Open':
      return 'No vault is open. Open one, then try again.'
    case 'Vault Not Found':
      return 'It’s no longer in this browser. It may have been deleted in another tab.'
    case 'Folder Not Found':
      return 'The folder was moved, renamed or deleted. Find it on your disk and open it again.'
    case 'Open In Another Tab':
      return 'It’s open in another Papeliz tab. Close it there, then try again.'
    case 'Not In Vault':
      return 'It was moved or deleted in another tab or app.'
    case 'Not In Trash':
      return 'It’s no longer in the trash. It was restored or deleted in another tab or app.'
    case 'Note Not Found':
      return 'No note in this vault has that name. Check the link.'
    case 'Into Itself':
      return 'A folder can’t go inside itself. Pick a folder outside it.'
    case 'Hidden Folder':
      return 'It’s in a hidden folder, which Papeliz only reads. Move it out of the hidden folder to change it.'
    case 'All Notes Locked':
      return 'Every note is locked. Turn off Lock All Notes in the Settings gear, then try again.'
    case 'Note Locked':
      return 'This note is locked. Unlock it, then try again.'
    case 'Folder Locked':
      return 'Its folder is locked. Unlock the folder, then try again.'
    case 'Not Saved':
      return 'Its changes aren’t saved yet. Press Try Again to save them first.'
    case 'Not Synced':
      return 'Papeliz Sync doesn’t carry this kind of file.'
    case 'Not Supported Yet':
      return 'Papeliz can’t do this here yet.'
    case 'Unknown Settings File':
      return 'Papeliz doesn’t know that settings file. Reload Papeliz, then try again.'
    case 'Import Stopped':
      return 'The import was stopped before it finished.'
    case 'Text File Over 5 MB':
      return 'Papeliz opens text files up to 5 MB, and this one is bigger. Open it in another app.'

    // A name typed for a vault, a note or a folder.
    case 'Name Taken':
      return describeNameTakenFailure(failureCodeContext)
    case 'Name Empty':
      return 'The name is empty. Type a name.'
    case 'Starts With A Dot':
      return 'A name can’t start with a dot. Remove the dot at the start.'
    case 'Ends With A Dot':
      return 'A name can’t end with a dot. Remove the dot at the end.'
    case 'Has A Blocked Character':
      return 'A name can’t contain \\ / : * ? " < > |. Remove those characters.'
    case 'Name Too Long':
      return 'The name is too long. Shorten it.'

    // A zip to import.
    case 'Not A Zip':
      return 'That file isn’t a .zip. Pick a .zip file.'
    case 'Zip Damaged':
      return 'The .zip is damaged. Make it again, then try again.'
    case 'Zip Not Supported':
      return 'Papeliz can’t read this kind of .zip: it may be encrypted or over 4 GB. Make a plain .zip, then try again.'

    // A file added to an AI Assistant chat.
    case 'Picture Type Not Supported':
      return 'Only PNG, JPEG, WebP and GIF pictures can be added.'
    case 'Over 10 MB':
      return 'Pictures can be up to 10 MB. Pick a smaller one.'
    case 'Over 1 MB':
      return 'Text files can be up to 1 MB. Pick a smaller one.'
    case 'File Type Not Supported':
      return 'Only pictures and text files can be added.'

    default:
      return isPapelizFailureCodeShaped(failureCode) ? papelizUnknownFailureSentence : failureCode
  }
}

// The sentence for anything thrown by a vault, a zip reader or the browser.
export function describePapelizErrorSentence(caughtError: unknown, failureCodeContext?: PapelizFailureCodeContext): string {
  const failureCode = caughtError instanceof PapelizImportZipError ? caughtError.message : describePapelizVaultError(caughtError)
  return describePapelizFailureCode(failureCode, failureCodeContext)
}

// A toast's or a line's whole message: "Couldn’t move “Plan” to the trash. The disk is full. Free
// some space, then try again."
export function describePapelizFailureMessage(failureHeadline: string, caughtError: unknown, failureCodeContext?: PapelizFailureCodeContext): string {
  return `${failureHeadline}. ${describePapelizErrorSentence(caughtError, failureCodeContext)}`
}

// The same, for a failure that is already a code.
export function describePapelizFailureCodeMessage(failureHeadline: string, failureCode: string, failureCodeContext?: PapelizFailureCodeContext): string {
  return `${failureHeadline}. ${describePapelizFailureCode(failureCode, failureCodeContext)}`
}
