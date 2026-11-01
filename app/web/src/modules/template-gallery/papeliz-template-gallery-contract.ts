import type { PapelizOpenVaultResult } from '../vault/papeliz-open-vault'

// The interface between Papeliz Templates' screens and its data layer: the manifest, a gallery row,
// a template's file list, the checks' results, and the gallery store's state and actions. The screens
// (the gallery, a template's page, Preview, Submit, and Use Template in New Vault's form) read only
// this and `usePapelizTemplateGalleryStore`.
//
// - A template is a public GitHub repository with `papeliz-template.json` at its root. Its id is
//   "<owner>/<repository>", as GitHub writes it ("AdamNatad/P1-Workflow").
// - Every template is pinned to one commit, a full 40-character SHA. Its files are read from jsDelivr
//   at that commit, never by branch name, or from raw.githubusercontent.com when jsDelivr can't be
//   reached. GitHub's API is asked only by Check and Recheck, once, for the newest commit; there is no
//   GitHub token anywhere.
// - Times are milliseconds since 1970 (Date.now()), sizes are bytes. Every sentence is plain words
//   for people, never a code.

export const papelizTemplateManifestFileName = 'papeliz-template.json'
// Written into each vault made from a template, in its `.papeliz/` folder.
export const papelizTemplateSourceFileName = 'template-source.json'

// ---------------------------------------------------------------- the manifest

// `papeliz-template.json`, as the author writes it. The author is the repository's owner and the
// license is read from the repository's own LICENSE file, so neither is in the manifest.
export interface PapelizTemplateManifest {
  papelizTemplateManifestVersion: 1
  templateName: string
  templateDescription: string
  templateTags: string[]
  // Opens first, in MD View: "START.md", "Guides/Read me first.md".
  templateFirstNotePath: string
  // Path patterns from the repository's root: `**` is any folders, `*` any characters within a name,
  // `?` one character. Everything is included unless excluded; missing, they are ["**"] and [].
  templateIncludedPaths: string[]
  templateExcludedPaths: string[]
  // A picture in the repository to show instead of the README's first one; null for the README's.
  templateThumbnailPicturePath: string | null
}

// The licenses a template may have, by their SPDX ids.
export type PapelizTemplateLicenseId = 'CC0-1.0' | 'CC-BY-4.0' | 'MIT'
export const papelizTemplateLicenseIds: readonly PapelizTemplateLicenseId[] = ['CC0-1.0', 'CC-BY-4.0', 'MIT']
export const papelizTemplateLicenseDisplayNames: Readonly<Record<PapelizTemplateLicenseId, string>> = {
  'CC0-1.0': 'CC0 1.0',
  'CC-BY-4.0': 'CC BY 4.0',
  MIT: 'MIT',
}

// ---------------------------------------------------------------- a gallery row

// One template as the gallery lists it: from the Featured list built into the app, or from the
// Templates Worker's hourly snapshot.
export interface PapelizTemplateGalleryRow {
  // "<owner>/<repository>".
  papelizTemplateGalleryId: string
  templateRepositoryOwner: string
  templateRepositoryName: string
  // The commit Papeliz knows: Browse, Preview and Use Template read this one until a Recheck moves it.
  templateCommitSha: string
  // The SHA-256 (base64) of the included files' sorted "path<TAB>sha256" lines at that commit
  // (`computePapelizTemplateIncludedFileListDigest`). Whatever host serves the files, they must give
  // it back.
  templateIncludedFileListDigest: string
  templateName: string
  templateDescription: string
  templateTags: string[]
  templateFirstNotePath: string
  templateLicenseId: PapelizTemplateLicenseId
  // Shown with <img> only, never read with fetch; null shows the name's first letter on a plain tile.
  templateThumbnailPictureUrl: string | null
  templateIncludedFileCount: number
  templateIncludedByteCount: number
  // Agent settings that name a command, or script files: the "Runs commands" tag.
  isTemplateRunningCommands: boolean
  isTemplateFeatured: boolean
  // When it was listed (New, for its first 14 days) and last checked; null when not known.
  templateListedAt: number | null
  templateCheckedAt: number | null
  templateUpVoteCount: number
  templateDownVoteCount: number
  // Its place in Top 100, from 1; null outside it.
  templateTopRank: number | null
}

// ---------------------------------------------------------------- a template's files

// One file at a commit, as a file list gives it.
export interface PapelizTemplateFileListEntry {
  // From the repository's root, with "/": "Guides/Start here.md", ".claude/settings.json".
  templateFileRelativePath: string
  templateFileByteCount: number
  // jsDelivr's SHA-256 of the file's bytes, in base64; null when the list came from GitHub's tree.
  templateFileSha256Base64: string | null
  // GitHub's blob SHA-1, in hex; null when the list came from jsDelivr.
  templateFileGitBlobSha1Hex: string | null
}

export type PapelizTemplateFileListSource = 'jsdelivr' | 'github-tree'

export interface PapelizTemplateFileList {
  templateFileListEntries: PapelizTemplateFileListEntry[]
  // GitHub cut a very large tree short; such a template is refused.
  isTemplateFileListTruncated: boolean
  templateFileListSource: PapelizTemplateFileListSource
}

// How far a read of a template's files has got: "12 of 40 files".
export interface PapelizTemplateFileReadProgress {
  templateReadFileCount: number
  templateFileCount: number
}

// ---------------------------------------------------------------- the checks

export type PapelizTemplateCheckId =
  | 'repository-public'
  | 'license-allowed'
  | 'manifest-valid'
  | 'file-list-complete'
  | 'file-count-and-size'
  | 'file-paths'
  | 'file-types'
  | 'no-git-lfs-pointers'
  | 'file-hashes'
  | 'included-file-list-digest'
  | 'notes-safe'
  | 'json-files-parse'
  | 'first-note-present'

// `not-checked`: an earlier check failed, or the files it needs aren't read yet.
export type PapelizTemplateCheckOutcome = 'passed' | 'failed' | 'not-checked'

export interface PapelizTemplateCheckResult {
  templateCheckId: PapelizTemplateCheckId
  // What was checked, as a short label: "License", "Notes".
  templateCheckLabel: string
  templateCheckOutcome: PapelizTemplateCheckOutcome
  // One or two plain sentences: what passed, or what failed and what to do.
  templateCheckSentence: string
}

// - `agent-setting-command`: a command named in an agent's settings (a hook, an MCP server, a status
//   line), as written there.
// - `script-file`: a script among the files (`.sh`, `.ps1`, `.py`, ... or a file starting with `#!`).
export type PapelizTemplateRunCommandKind = 'agent-setting-command' | 'script-file'

// One command or script that Use Template lists before the vault is made. Papeliz never runs it.
export interface PapelizTemplateRunCommand {
  templateRunCommandKind: PapelizTemplateRunCommandKind
  templateRunCommandSourceRelativePath: string
  // The command line, or the script's file name.
  templateRunCommandText: string
}

export interface PapelizTemplateCheckReport {
  templateCheckResults: PapelizTemplateCheckResult[]
  isEveryTemplateCheckPassed: boolean
  // Null when the manifest is missing or doesn't read.
  templateManifest: PapelizTemplateManifest | null
  // The license the LICENSE file's text is; null when it isn't one of the three, or isn't read yet.
  templateLicenseId: PapelizTemplateLicenseId | null
  // The files that go into a vault, in path order.
  templateIncludedFileRelativePaths: string[]
  templateIncludedByteCount: number
  templateIncludedFileListDigest: string | null
  templateRunCommands: PapelizTemplateRunCommand[]
}

// What a vault made from a template keeps in `.papeliz/template-source.json`.
export interface PapelizTemplateSourceFile {
  papelizTemplateSourceFileVersion: 1
  papelizTemplateGalleryId: string
  templateSourceCommitSha: string
  templateSourceName: string
  // The repository's owner on GitHub.
  templateSourceAuthor: string
  templateSourceLicenseId: PapelizTemplateLicenseId
  // ISO time: "2026-11-02T09:30:00.000Z".
  templateSourceVaultMadeAt: string
}

// ---------------------------------------------------------------- the gallery store

export type PapelizTemplateGalleryTab = 'featured' | 'new' | 'top-100'

// New and Top 100 come from the Templates Worker's snapshot.
// - `not-available-yet`: this build has no Worker to ask; the tabs say they aren't available yet.
// - `offline`: the Worker couldn't be reached; Featured still shows the built-in templates.
export type PapelizTemplateGallerySnapshotState =
  | { templateGallerySnapshotStage: 'not-available-yet' }
  | { templateGallerySnapshotStage: 'loading' }
  | { templateGallerySnapshotStage: 'loaded'; templateGallerySnapshotBuiltAt: number }
  | { templateGallerySnapshotStage: 'offline'; templateGallerySnapshotProblemSentence: string }

// Submit's Check, on a pasted repository link.
// - `reading-github`: asking GitHub for the default branch's newest commit.
// - `reading-files`: reading the file list and files from jsDelivr at that commit.
// - `checked`: every check ran; the report says whether all passed.
// - `failed-to-read`: GitHub or the files couldn't be read (a bad link, a private repository,
//   GitHub's limit, offline); nothing was checked.
export type PapelizTemplateCheckRunState =
  | { templateCheckRunStage: 'idle' }
  | { templateCheckRunStage: 'reading-github'; papelizTemplateGalleryId: string }
  | { templateCheckRunStage: 'reading-files'; papelizTemplateGalleryId: string; templateCommitSha: string; templateFileReadProgress: PapelizTemplateFileReadProgress | null }
  | { templateCheckRunStage: 'checked'; papelizTemplateGalleryId: string; templateCommitSha: string; templateCheckReport: PapelizTemplateCheckReport }
  | { templateCheckRunStage: 'failed-to-read'; templateCheckRunProblemSentence: string }

// Recheck on a template's page or in Preview's heading.
// - `up-to-date`: GitHub's newest commit is the one Papeliz knows.
// - `updated`: a newer commit passed every check; the template now reads it.
// - `newest-fails`: a newer commit fails a check; the template stays on the commit it had.
// - `repository-gone`: the repository is private, deleted, or has lost its manifest.
// - `failed-to-read`: GitHub or the files couldn't be read; nothing changed.
export type PapelizTemplateRecheckState =
  | { templateRecheckStage: 'idle' }
  | { templateRecheckStage: 'rechecking'; papelizTemplateGalleryId: string; templateFileReadProgress: PapelizTemplateFileReadProgress | null }
  | { templateRecheckStage: 'up-to-date'; papelizTemplateGalleryId: string; templateRecheckedAt: number }
  | {
      templateRecheckStage: 'updated'
      papelizTemplateGalleryId: string
      templateRecheckedAt: number
      previousTemplateCommitSha: string
      templateCommitSha: string
      // Files added, removed or changed between the two commits; null when the earlier list couldn't
      // be read to count them.
      templateChangedFileCount: number | null
    }
  | { templateRecheckStage: 'newest-fails'; papelizTemplateGalleryId: string; templateRecheckedAt: number; newestTemplateCommitSha: string; templateCheckReport: PapelizTemplateCheckReport }
  | { templateRecheckStage: 'repository-gone'; papelizTemplateGalleryId: string; templateRecheckProblemSentence: string }
  | { templateRecheckStage: 'failed-to-read'; papelizTemplateGalleryId: string; templateRecheckProblemSentence: string }

// Use Template, from New Vault's form.
// - `preparing`: reading the template's files at its commit and checking them again on these bytes.
// - `ready`: every check passed; the form can make the vault. When `templateRunCommands` isn't empty,
//   the person ticks "I've read these commands" first (`isTemplateRunCommandsAcknowledged`).
// - `making-vault`: the vault's files are being written.
// - `made`: the vault is made; `makePapelizTemplateVault`'s result opens it.
// - `failed`: a file couldn't be read or a check failed, so no vault can be made from it.
// A vault that couldn't be made (a taken name, a closed folder window, a full disk) goes back to
// `ready`, and `makePapelizTemplateVault`'s result says why, as New Vault's own results do. A folder
// vault whose writing stopped partway keeps the files written so far, and the sentence says so.
export type PapelizTemplateUseState =
  | { templateUseStage: 'idle' }
  | { templateUseStage: 'preparing'; templateGalleryRow: PapelizTemplateGalleryRow; templateFileReadProgress: PapelizTemplateFileReadProgress | null }
  | {
      templateUseStage: 'ready'
      templateGalleryRow: PapelizTemplateGalleryRow
      templateCheckReport: PapelizTemplateCheckReport
      templateRunCommands: PapelizTemplateRunCommand[]
      isTemplateRunCommandsAcknowledged: boolean
      // Hidden files the template brings (`.gitignore`, `.claude/settings.json`): written into the
      // vault, but Sync doesn't carry them, so they stay on this device.
      templateHiddenFileRelativePaths: string[]
      // Pictures whose metadata couldn't be removed: they are left out of the vault.
      templateLeftOutPictureRelativePaths: string[]
    }
  | { templateUseStage: 'making-vault'; templateGalleryRow: PapelizTemplateGalleryRow; templateWrittenFileCount: number; templateFileCount: number }
  | { templateUseStage: 'made'; templateGalleryRow: PapelizTemplateGalleryRow; papelizVaultDisplayName: string }
  | { templateUseStage: 'failed'; templateGalleryRow: PapelizTemplateGalleryRow; templateUseProblemSentence: string; templateCheckReport: PapelizTemplateCheckReport | null }

// Where Use Template makes the vault, as in New Vault's form.
export type PapelizTemplateNewVaultPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// What making the vault gives back: the vault-opening result New Vault's form already handles, and,
// once opened, the note to open first in MD View.
export type PapelizTemplateVaultMakeResult = PapelizOpenVaultResult & { templateFirstNotePath: string | null }

export interface PapelizTemplateGalleryState {
  templateGalleryTab: PapelizTemplateGalleryTab
  // Featured: the built-in templates, with the Worker's own once its snapshot loads.
  featuredTemplateGalleryRows: PapelizTemplateGalleryRow[]
  // Newest first, and the hundred best by votes; empty until the snapshot loads.
  newTemplateGalleryRows: PapelizTemplateGalleryRow[]
  topTemplateGalleryRows: PapelizTemplateGalleryRow[]
  templateGallerySnapshotState: PapelizTemplateGallerySnapshotState
  templateCheckRunState: PapelizTemplateCheckRunState
  templateRecheckState: PapelizTemplateRecheckState
  templateUseState: PapelizTemplateUseState
}

export interface PapelizTemplateGalleryActions {
  // Templates was pressed: shows Featured, and asks for the snapshot when a Worker exists.
  openTemplateGallery: () => Promise<void>
  selectTemplateGalleryTab: (templateGalleryTab: PapelizTemplateGalleryTab) => void
  // Any row the gallery knows, from any tab; null when none has that id.
  findTemplateGalleryRow: (papelizTemplateGalleryId: string) => PapelizTemplateGalleryRow | null
  // Submit's Check on a pasted link ("https://github.com/owner/repository", or "owner/repository").
  checkTemplateRepositoryLink: (typedTemplateRepositoryLink: string) => Promise<void>
  resetTemplateCheckRun: () => void
  recheckTemplate: (papelizTemplateGalleryId: string) => Promise<void>
  // Use Template pressed: reads and checks the template, ending `ready` or `failed`.
  prepareTemplateUse: (templateGalleryRow: PapelizTemplateGalleryRow) => Promise<void>
  acknowledgeTemplateRunCommands: (isTemplateRunCommandsAcknowledged: boolean) => void
  // New Vault's form confirmed, with the name and place it already checked. Must run from the click,
  // since a folder vault shows the browser's folder window first.
  makePapelizTemplateVault: (typedNewVaultName: string, chosenNewVaultPlace: PapelizTemplateNewVaultPlace) => Promise<PapelizTemplateVaultMakeResult>
  // Cancel, or the form closed: stops a read under way and forgets the prepared files.
  cancelTemplateUse: () => void
}
