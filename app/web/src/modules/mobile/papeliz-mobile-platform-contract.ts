import type { ComponentType, ReactNode } from 'react'
import type { PapelizDesktopFileSystem } from '../desktop/papeliz-desktop-platform-contract'
import type { PapelizNoteEditorSessionCache } from '../note-editor/papeliz-note-editor'

// What Papeliz for Android and iOS gives the web app, through `virtual:papeliz-mobile-platform`. The
// mobile build resolves that module to the app's own side in `app/mobile/`; the web build resolves it
// to the stand-in (papeliz-mobile-platform-stand-in.ts), which says there is no mobile app and has no
// phone layout, so papeliz.com, its phone view included, carries none of this.

export interface PapelizMobilePlatform {
  mobileAppVersion: string
  // App Storage's own folder: each vault made in App Storage is a folder inside it, which the phone
  // removes with the app.
  mobileAppStorageFolderPath: string
  // Its files and folders, through the same calls as the desktop app's folders, so one folder vault
  // adapter serves both.
  mobileAppStorageFileSystem: PapelizDesktopFileSystem
  // Opens an http or https link in the phone's own browser, never inside Papeliz.
  openLinkInSystemBrowser(externalLinkUrl: string): Promise<void>
  // Opens the phone's own save screen (Android's Create Document) with the file's name and type
  // filled in, and writes the file where the person picks. Unlike the browser's save dialog, it has
  // no time limit after the click.
  saveFileWithMobileSaveScreen(mobileSaveFileRequest: PapelizMobileSaveFileRequest): Promise<PapelizMobileSaveFileOutcome>
}

// A built export or backup, for the phone's save screen.
export interface PapelizMobileSaveFileRequest {
  suggestedMobileFileName: string
  mobileFileMediaType: string
  mobileFileBlob: Blob
}

// Where it went: the file the person picked, or nowhere because they closed the save screen.
export type PapelizMobileSaveFileOutcome = 'saved-to-chosen-file' | 'save-screen-closed'

export type PapelizMobilePlatformLoadResult =
  | { papelizMobilePlatformAvailability: 'in-the-mobile-app'; papelizMobilePlatform: PapelizMobilePlatform }
  | { papelizMobilePlatformAvailability: 'not-in-this-build' }

// The phone layout the Android and iOS app draws once a vault is open, in place of the web's: the
// bottom bar, the blue top bar and the places they lead to. The workspace keeps everything a vault
// needs running and hands the layout what every layout shares (its notices and dialogs) as children.
export interface PapelizMobileWorkspaceLayoutProps {
  noteEditorSessionCache: PapelizNoteEditorSessionCache
  children: ReactNode
}

export type PapelizMobileWorkspaceLayoutComponent = ComponentType<PapelizMobileWorkspaceLayoutProps>
