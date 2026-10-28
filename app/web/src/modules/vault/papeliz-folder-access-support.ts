// Whether this browser can open a folder on the disk as a vault, and if not, why. Detection checks
// features, never the browser's name: the folder picker, the write API behind it, and whether the
// page runs inside another site's frame, where browsers refuse to show the picker.

export type PapelizFolderAccessOffReason =
  // No folder picker at all (Firefox, Safari, phones) or not a secure page.
  | 'unsupported'
  // A picker, but no way to write into the folder.
  | 'writes-blocked'
  // The picker exists but won't open here: inside another site's frame, or it failed to open from
  // a click of the user's own. The last can be tried again.
  | 'chooser-unavailable'

export interface PapelizFolderAccessSupport {
  isFolderAccessOn: boolean
  folderAccessOffReason: PapelizFolderAccessOffReason | null
}

// A frame whose top window belongs to another site: reading its location throws.
function isInsideAnotherSitesFrame(): boolean {
  if (window.top === null || window.top === window.self) return false
  try {
    void window.top.location.href
    return false
  } catch {
    return true
  }
}

export function detectPapelizFolderAccessSupport(): PapelizFolderAccessSupport {
  if (typeof window === 'undefined' || !window.isSecureContext || typeof window.showDirectoryPicker !== 'function') {
    return { isFolderAccessOn: false, folderAccessOffReason: 'unsupported' }
  }
  if (typeof FileSystemFileHandle === 'undefined' || typeof FileSystemFileHandle.prototype.createWritable !== 'function') {
    return { isFolderAccessOn: false, folderAccessOffReason: 'writes-blocked' }
  }
  if (isInsideAnotherSitesFrame()) return { isFolderAccessOn: false, folderAccessOffReason: 'chooser-unavailable' }
  return { isFolderAccessOn: true, folderAccessOffReason: null }
}

// The badge's and the toast's words: why opening a folder is off, and what still works.
export function describePapelizFolderAccessOffReason(folderAccessOffReason: PapelizFolderAccessOffReason): string {
  switch (folderAccessOffReason) {
    case 'unsupported':
      return 'Opening a folder needs a Chromium-based browser (Chrome, Edge, Brave or another Chromium browser) on a computer. Try Sample works here.'
    case 'writes-blocked':
      return 'This browser can’t save notes into your folders, so opening a folder is off here. Try Sample still works, or open Papeliz in Chrome, Edge or Brave.'
    case 'chooser-unavailable':
      return 'This browser won’t open a folder window here, so opening a folder is off. Try Sample still works, or open Papeliz in its own tab in Chrome, Edge or Brave.'
  }
}
