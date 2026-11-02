// What Papeliz for Windows gives the web app, through `virtual:papeliz-desktop-platform`. The desktop
// build resolves that module to the Tauri side in `app/desktop/`; the web build resolves it to the
// stand-in (papeliz-desktop-platform-stand-in.ts), which says there is no desktop, so the published web
// app carries none of this. Every call stays small and native: the vault adapter, the dialogs' use and
// the title bar are built from them in the web app, where they are tested.

// One entry of a folder on disk, or what a path holds.
export interface PapelizDesktopFileSystemEntry {
  desktopEntryName: string
  isDesktopEntryFolder: boolean
  // A file's size in bytes, and when it last changed (milliseconds since 1970); null when not known
  // or for a folder.
  desktopFileByteCount: number | null
  desktopEntryModifiedAt: number | null
}

// A save is written beside its file under this ending, then moved over it. A crash in between could
// leave one behind, so the vault never lists such a file.
export const papelizDesktopSavingFileSuffix = '.papeliz-saving'

// Why a file call failed, carried on the Error it throws as `desktopFileSystemFailureKind`, so the app
// can say "No Permission" or "File In Use" rather than a general failure.
export type PapelizDesktopFileSystemFailureKind = 'not-found' | 'name-taken' | 'no-permission' | 'in-use' | 'disk-full' | 'other'

export interface PapelizDesktopFileSystemFailure extends Error {
  desktopFileSystemFailureKind: PapelizDesktopFileSystemFailureKind
}

// Files and folders on disk, by absolute Windows path ("C:\Users\…\Notes\Inbox.md"). Each call reaches
// only a folder the person picked in this app (and what is inside it); anything else fails.
export interface PapelizDesktopFileSystem {
  listDesktopFolderEntries(desktopFolderPath: string): Promise<PapelizDesktopFileSystemEntry[]>
  // What the path holds, with a file's size and last change, or null when nothing is there: the one
  // call for both "is it there" and "how big, how new".
  readDesktopEntry(desktopEntryPath: string): Promise<PapelizDesktopFileSystemEntry | null>
  readDesktopFileText(desktopFilePath: string): Promise<string>
  readDesktopFileBytes(desktopFilePath: string): Promise<Uint8Array>
  // Replaces the file, or makes it; its folder must be there already. The replace is whole or not at
  // all (written beside it, then moved over it), so a save that fails keeps the old note.
  writeDesktopFileText(desktopFilePath: string, desktopFileText: string): Promise<void>
  writeDesktopFileBytes(desktopFilePath: string, desktopFileBytes: Uint8Array): Promise<void>
  // Makes the folder and any missing folders above it; a folder already there is fine.
  makeDesktopFolder(desktopFolderPath: string): Promise<void>
  // Renames or moves a file or a whole folder. Fails when the target is taken.
  renameDesktopEntry(fromDesktopEntryPath: string, toDesktopEntryPath: string): Promise<void>
  // Copies a file, or a folder with everything in it. Fails when the target is taken.
  copyDesktopEntry(fromDesktopEntryPath: string, toDesktopEntryPath: string): Promise<void>
  // Deletes a file, or a folder with everything in it, from the disk. A vault's own deletes move to its
  // `.trash/` folder instead; this is only for what the person asks to delete outright.
  removeDesktopEntry(desktopEntryPath: string): Promise<void>
  // Joins a folder path and names with the platform's separator.
  joinDesktopPath(desktopFolderPath: string, ...desktopPathNames: string[]): string
}

export interface PapelizDesktopSaveFileRequest {
  suggestedDesktopFileName: string
  // For the dialog's "Save as type" list, for example { name: 'PDF', extensions: ['pdf'] }.
  desktopFileTypeFilters: { desktopFileTypeName: string; desktopFileExtensions: string[] }[]
}

export interface PapelizDesktopMaximizeButtonBounds {
  desktopMaximizeButtonLeft: number
  desktopMaximizeButtonTop: number
  desktopMaximizeButtonWidth: number
  desktopMaximizeButtonHeight: number
}

export type PapelizDesktopMaximizeButtonPointerState = 'idle' | 'hovered' | 'pressed'

// The window's own buttons and its drag area, for the blue bar that stands in for Windows' title bar.
export interface PapelizDesktopWindow {
  minimizeDesktopWindow(): Promise<void>
  toggleDesktopWindowMaximized(): Promise<void>
  isDesktopWindowMaximized(): Promise<boolean>
  // Called whenever the window is maximized or restored, by a button, a double-click or Windows
  // itself. Gives back the call that stops listening.
  subscribeToDesktopWindowMaximized(onDesktopWindowMaximizedChange: (isDesktopWindowMaximized: boolean) => void): () => void
  // A press on the bar's empty space: Windows moves the window from here, and a double-click
  // maximizes or restores it.
  startDesktopWindowDragging(): Promise<void>
  // Where the bar's maximize button is drawn, in CSS pixels from the window's top left, or null while
  // it isn't shown. The native side answers Windows' hit-test there, so Windows 11 shows Snap Layouts
  // when the pointer rests on it.
  setDesktopMaximizeButtonBounds(desktopMaximizeButtonBounds: PapelizDesktopMaximizeButtonBounds | null): Promise<void>
  // Since Windows, not the page, handles the pointer over the maximize button, its hover and pressed
  // looks come from here rather than from CSS. Gives back the call that stops listening.
  subscribeToDesktopMaximizeButtonPointerState(
    onDesktopMaximizeButtonPointerStateChange: (desktopMaximizeButtonPointerState: PapelizDesktopMaximizeButtonPointerState) => void,
  ): () => void
  // The close button and Alt+F4 call this first and close the window once it settles, so unsaved
  // text is written before the window goes. Gives back the call that removes it.
  setDesktopWindowCloseRequestHandler(beforeDesktopWindowCloses: () => Promise<void>): () => void
}

// A newer Papeliz for Windows, from the update check at start.
export interface PapelizDesktopAppUpdate {
  desktopAppUpdateVersion: string
  // Downloads it, checks its signature, installs it and restarts the app.
  installDesktopAppUpdate(): Promise<void>
}

export interface PapelizDesktopPlatform {
  desktopAppVersion: string
  // A direct download updates itself (the update check at start); the Microsoft Store package is
  // updated by the Store, so it has no update check.
  desktopAppDistribution: 'direct-download' | 'microsoft-store'
  desktopFileSystem: PapelizDesktopFileSystem
  // The folder picker, for a vault: the folder's absolute path, or null when the person cancels. The
  // native side lets the app reach that folder, now and at every later start, until it is forgotten.
  pickDesktopFolderPath(desktopFolderPickerTitle: string): Promise<string | null>
  // A recent vault removed from the list: the app stops reaching its folder. The folder itself stays.
  forgetDesktopVaultFolderPath(desktopVaultFolderPath: string): Promise<void>
  // The Save dialog: the chosen file's absolute path, or null when the person cancels.
  pickDesktopSaveFilePath(desktopSaveFileRequest: PapelizDesktopSaveFileRequest): Promise<string | null>
  // Opens an http or https link in the person's own browser, never in a Papeliz window.
  openLinkInSystemBrowser(externalLinkUrl: string): Promise<void>
  desktopWindow: PapelizDesktopWindow
  // A fetch made from the app's native side, which no browser rule applies to, for the providers a
  // web page can't reach. It answers only for those providers' hosts; any other address fails.
  fetchFromDesktopNativeSide: typeof fetch
  // Null when this version is the newest, when the check can't reach the update address, or in the
  // Microsoft Store package, which the Store updates.
  checkForDesktopAppUpdate(): Promise<PapelizDesktopAppUpdate | null>
}

// What `loadPapelizDesktopPlatform()` gives back: the platform in the desktop app, nothing in a browser.
export type PapelizDesktopPlatformLoadResult =
  | { papelizDesktopPlatformAvailability: 'in-the-desktop-app'; papelizDesktopPlatform: PapelizDesktopPlatform }
  | { papelizDesktopPlatformAvailability: 'not-in-this-build' }
