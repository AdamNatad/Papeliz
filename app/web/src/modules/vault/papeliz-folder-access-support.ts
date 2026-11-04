import { isPapelizMobileApp } from 'virtual:papeliz-mobile-platform-availability'

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
  // The Android and iOS app's web view has the picker, but it closes at once there, so it counts as none.
  if (isPapelizMobileApp || typeof window === 'undefined' || !window.isSecureContext || typeof window.showDirectoryPicker !== 'function') {
    return { isFolderAccessOn: false, folderAccessOffReason: 'unsupported' }
  }
  if (typeof FileSystemFileHandle === 'undefined' || typeof FileSystemFileHandle.prototype.createWritable !== 'function') {
    return { isFolderAccessOn: false, folderAccessOffReason: 'writes-blocked' }
  }
  if (isInsideAnotherSitesFrame()) return { isFolderAccessOn: false, folderAccessOffReason: 'chooser-unavailable' }
  return { isFolderAccessOn: true, folderAccessOffReason: null }
}

// The toast's, the tooltip's and the empty Recent Vaults list's words: why opening a folder is off,
// and where it works.
export function describePapelizFolderAccessOffReason(folderAccessOffReason: PapelizFolderAccessOffReason): string {
  switch (folderAccessOffReason) {
    case 'unsupported':
      return 'This browser can’t open folders. Open Papeliz in Chrome, Edge or Brave on a computer.'
    case 'writes-blocked':
      return 'This browser can’t save into folders. Open Papeliz in Chrome, Edge or Brave on a computer.'
    case 'chooser-unavailable':
      return 'The folder window can’t open here. Open Papeliz in its own tab, then try again.'
  }
}
