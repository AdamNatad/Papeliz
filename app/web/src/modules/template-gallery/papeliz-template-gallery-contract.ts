import type { PapelizNewVaultParentFolder, PapelizOpenVaultResult } from '../vault/papeliz-open-vault'
import type { PapelizVaultFolderImportOptions, PapelizVaultFolderImportPlan, PapelizVaultFolderImportResult } from '../vault/papeliz-vault-folder-import'

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
  // 1 to 3 tags: its main category first, then its subcategory, then a label. Any tag of the right
  // shape, so authors make their own categories.
  templateTags: string[]
  // Opens first, in MD View: "START.md", "Guides/Read me first.md".
  templateFirstNotePath: string
  // Up to 30 path patterns each, from the repository's root: `**` as a whole folder name is any
  // folders (none too, except at the end), `*` any characters within a name (`**` inside a name is
  // the same as `*`), `?` one character. Everything is included unless excluded; missing, they are
  // ["**"] and [].
  templateIncludedPaths: string[]
  templateExcludedPaths: string[]
  // Included files a person may leave out: they come only with All, not with Recommended. The same
  // pattern rules, up to 30; missing, it is []. The checks and the fingerprint still cover them.
  templateOptionalPaths: string[]
  // A picture in the repository to show instead of the README's first one; null for the README's.
  templateThumbnailPicturePath: string | null
}

// Which of a template's included files a vault made or imported from it gets:
// - `recommended`: all but the ones `templateOptionalPaths` matches;
// - `all`: every included file;
// - `chosen`: Recommended plus some of the optional files, ticked one by one. None of them is
//   Recommended and every one is All, so `chosen` always means some but not all.
export type PapelizTemplateFilesChoice = 'recommended' | 'all' | 'chosen'

// What Use Template and Import into This Vault show for the choice, for one template's included files.
export interface PapelizTemplateFilesChoices {
  // Recommended when the manifest has optional paths, All when it has none.
  defaultTemplateFilesChoice: PapelizTemplateFilesChoice
  // The optional paths match at least one included file, so the two choices differ.
  hasTemplateOptionalFiles: boolean
  recommendedTemplateFileCount: number
  allTemplateFileCount: number
  // The included files only All brings, in path order.
  templateOptionalFileRelativePaths: string[]
  // Their top folders and top-level files, once each, in path order: [".gemini", ".grok",
  // "opencode.json"].
  templateOptionalTopEntryNames: string[]
}

// A template's license, any one its author chose, since the gallery accepts any: the SPDX id of a well-known license, named from its LICENSE file's text ("MIT", "Apache-2.0",
// "CC-BY-SA-4.0"), or `papelizTemplateCustomLicenseId` for any other text, the author's own.
export type PapelizTemplateLicenseId = string
export const papelizTemplateCustomLicenseId = 'LicenseRef-Custom'

// A template's tags: the first is its main category, the second its subcategory, the third a label,
// each any tag of the right shape ("project-workflow"), so authors make their own categories. These
// three are the categories Papeliz started with, suggested when a template is made.
export type PapelizTemplateCategoryTag = 'coding' | 'education' | 'research'
export const papelizTemplateCategoryTags: readonly PapelizTemplateCategoryTag[] = ['coding', 'education', 'research']

export function isPapelizTemplateCategoryTag(templateTag: string): templateTag is PapelizTemplateCategoryTag {
  return (papelizTemplateCategoryTags as readonly string[]).includes(templateTag)
}

// The shape of every tag: lower-case letters and digits in words joined by single hyphens.
export const papelizTemplateTagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Short forms a tag's words keep in capitals.
const papelizTemplateTagAllCapsWords: ReadonlySet<string> = new Set(['ai', 'api', 'ui', 'ux', 'sql', 'css', 'html', 'json', 'cli', 'sdk'])

// A tag as the chips and a template's page show it: every word with a capital first letter and the
// hyphens as spaces, with short forms in capitals ("project-workflow" -> "Project Workflow", "ai-agents"
// -> "AI Agents").
export function formatPapelizTemplateTagDisplayName(templateTag: string): string {
  return templateTag
    .split('-')
    .filter((templateTagWord) => templateTagWord.length > 0)
    .map((templateTagWord) =>
      papelizTemplateTagAllCapsWords.has(templateTagWord.toLowerCase()) ? templateTagWord.toUpperCase() : templateTagWord.charAt(0).toUpperCase() + templateTagWord.slice(1),
    )
    .join(' ')
}

// The fixed tag list's earlier export, kept until the screens and the Templates Worker call
// `formatPapelizTemplateTagDisplayName`: every tag of the right shape is in it, named as that function
// names it, so the Worker's own check of tags against it refuses none; listed, it gives the categories.
export const papelizTemplateGalleryTagDisplayNames: Readonly<Record<string, string>> = new Proxy<Record<string, string>>(
  {},
  {
    get: (_tagDisplayNamesTarget, templateTag) => (isPapelizTemplateTagShaped(templateTag) ? formatPapelizTemplateTagDisplayName(templateTag) : undefined),
    has: (_tagDisplayNamesTarget, templateTag) => isPapelizTemplateTagShaped(templateTag),
    getOwnPropertyDescriptor: (_tagDisplayNamesTarget, templateTag) =>
      isPapelizTemplateTagShaped(templateTag) ? { value: formatPapelizTemplateTagDisplayName(templateTag), writable: false, enumerable: true, configurable: true } : undefined,
    ownKeys: () => [...papelizTemplateCategoryTags],
  },
)

function isPapelizTemplateTagShaped(templateTag: string | symbol): templateTag is string {
  return typeof templateTag === 'string' && papelizTemplateTagPattern.test(templateTag)
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
  // Shown with <img> only, never read with fetch, and only from a host a template's pictures may come
  // from (`isPapelizTemplatePictureUrlAllowed`); null, or any other host, shows the name's first letter
  // on a plain tile.
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

// What an agent or editor reads from a template, at any depth and whatever its case: coding agents'
// settings, hooks files and MCP servers (Claude Code's, Codex's, Copilot's, Gemini CLI's, Cursor's,
// OpenCode's and others'), VS Code's tasks and dev containers.
// - `agent-setting-command`: a command named there (a hook, an MCP server, a status line, a task, a
//   dev container's step), as written.
// - `agent-setting-environment`: an environment variable every command there gets, as "NAME=value".
// - `agent-setting-permission`: a command an agent may run without asking ("Bash(npm test)",
//   "bash git status: allow"), or a mode that asks less ("defaultMode: bypassPermissions",
//   "approvalMode: yolo").
// - `agent-setting-plugin`: a plugin an agent turns on, which can bring commands of its own.
// - `agent-command-file`: a file of an agent's own commands (`.claude/commands/…`), which can run
//   shell lines when used; or settings Papeliz can't read through (`.codex/config.toml`, Codex's
//   rules, Aider's settings, or a settings file that isn't JSON). The text is its path.
// - `script-file`: a script among the files (`.sh`, `.ps1`, `.py`, ... or a file starting with `#!`).
export type PapelizTemplateRunCommandKind =
  | 'agent-setting-command'
  | 'agent-setting-environment'
  | 'agent-setting-permission'
  | 'agent-setting-plugin'
  | 'agent-command-file'
  | 'script-file'

// One command or script that Use Template lists before the vault is made. Papeliz never runs it.
export interface PapelizTemplateRunCommand {
  templateRunCommandKind: PapelizTemplateRunCommandKind
  templateRunCommandSourceRelativePath: string
  // The command line, the setting, or the file's name.
  templateRunCommandText: string
  // Its text or path holds characters that show nothing or turn text around (zero-width characters,
  // bidirectional controls, a carriage return); the commands list marks each one where it is.
  hasTemplateRunCommandHiddenCharacters: boolean
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
  // Which files the vault got. Missing in vaults made before the choice existed, which got all.
  templateSourceFilesChoice?: PapelizTemplateFilesChoice
  // With `chosen`, the optional files it got, in path order.
  templateSourceChosenOptionalFileRelativePaths?: string[]
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
//   the person ticks "I've read these commands" first (`isTemplateRunCommandsAcknowledged`). Those are
//   the commands of the chosen files, Recommended, All or the optional files ticked one by one
//   (`chooseTemplateFilesChoice`, `chooseTemplateOptionalFiles`); the check report keeps every
//   included file's.
// - `picking-folder`: a folder vault waits for the folder window, which is open: the browser's, or
//   Windows' in Papeliz for Windows when the form's Location has no folder.
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
      // Recommended, All or chosen, both presets' counts, and the optional files in ([] for
      // Recommended, every one for All); the hidden files, left-out pictures and commands above are
      // the chosen files'. The store always gives them; they are optional only so made-up screens
      // built before the choice still describe a ready state, which then means All.
      templateFilesChoice?: PapelizTemplateFilesChoice
      templateFilesChoices?: PapelizTemplateFilesChoices
      chosenTemplateOptionalFileRelativePaths?: string[]
    }
  | { templateUseStage: 'picking-folder'; templateGalleryRow: PapelizTemplateGalleryRow }
  | { templateUseStage: 'making-vault'; templateGalleryRow: PapelizTemplateGalleryRow; templateWrittenFileCount: number; templateFileCount: number }
  | { templateUseStage: 'made'; templateGalleryRow: PapelizTemplateGalleryRow; papelizVaultDisplayName: string }
  // Import from Template, in an open vault: the files being written into a new folder, then the folder.
  | { templateUseStage: 'importing-into-vault'; templateGalleryRow: PapelizTemplateGalleryRow; templateWrittenFileCount: number; templateFileCount: number }
  | { templateUseStage: 'imported-into-vault'; templateGalleryRow: PapelizTemplateGalleryRow; importedVaultFolderRelativePath: string }
  | { templateUseStage: 'failed'; templateGalleryRow: PapelizTemplateGalleryRow; templateUseProblemSentence: string; templateCheckReport: PapelizTemplateCheckReport | null }

// Where Use Template makes the vault, as in New Vault's form.
export type PapelizTemplateNewVaultPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// What making the vault gives back: the vault-opening result New Vault's form already handles, and,
// once opened, the note to open first in MD View.
export type PapelizTemplateVaultMakeResult = PapelizOpenVaultResult & { templateFirstNotePath: string | null }

// Import from Template's way into the open vault: the workspace's import into a new folder
// (`importIntoNewVaultFolder`), which also records where the folder came from.
export type PapelizTemplateVaultFolderImporter = (
  vaultFolderImportPlan: PapelizVaultFolderImportPlan,
  vaultFolderImportOptions: PapelizVaultFolderImportOptions,
) => Promise<PapelizVaultFolderImportResult>

// What Import into This Vault gives back: the import's result and, once imported, the template's first
// note inside its new folder ("P1-Workflow/README.md").
export type PapelizTemplateVaultFolderImportResult = PapelizVaultFolderImportResult & { templateFirstNotePath: string | null }

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
  // Refresh: asks for the list again, staying on the tab shown.
  refreshTemplateGallery: () => Promise<void>
  selectTemplateGalleryTab: (templateGalleryTab: PapelizTemplateGalleryTab) => void
  // Any row the gallery knows, from any tab; null when none has that id.
  findTemplateGalleryRow: (papelizTemplateGalleryId: string) => PapelizTemplateGalleryRow | null
  // Submit's Check on a pasted link ("https://github.com/owner/repository", or "owner/repository").
  checkTemplateRepositoryLink: (typedTemplateRepositoryLink: string) => Promise<void>
  resetTemplateCheckRun: () => void
  recheckTemplate: (papelizTemplateGalleryId: string) => Promise<void>
  // A template's page or Preview closed: stops a Recheck under way and forgets what it found.
  resetTemplateRecheck: () => void
  // Preview's and a template page's reads, at the row's commit, from jsDelivr (raw files when it
  // can't), never from GitHub's API, each read once per commit:
  // - the files a vault would get, in path order; fails when they aren't the ones Papeliz checked;
  // - one of those files' text, checked against the file list;
  // - a picture's jsDelivr address, to show with <img> only.
  listTemplateIncludedFiles: (templateGalleryRow: PapelizTemplateGalleryRow) => Promise<readonly PapelizTemplateFileListEntry[]>
  readTemplateFileText: (templateGalleryRow: PapelizTemplateGalleryRow, templateFileRelativePath: string) => Promise<string>
  buildTemplatePictureUrl: (templateGalleryRow: PapelizTemplateGalleryRow, templateFileRelativePath: string) => string
  // The author's (the repository owner's) GitHub picture, `authorPictureSize` pixels square, to show
  // with <img> only.
  buildTemplateAuthorPictureUrl: (templateRepositoryOwner: string, authorPictureSize: number) => string
  // Use Template pressed: reads and checks the template, ending `ready` or `failed`.
  prepareTemplateUse: (templateGalleryRow: PapelizTemplateGalleryRow) => Promise<void>
  acknowledgeTemplateRunCommands: (isTemplateRunCommandsAcknowledged: boolean) => void
  // Recommended, All or chosen, while ready: only that choice's files are made or imported, and its
  // choice is recorded (chosen keeps the files ticked). A choice that brings commands not yet ticked
  // asks for the tick again. The store always has it; it is optional only so made-up screens can
  // leave it out.
  chooseTemplateFilesChoice?: (templateFilesChoice: PapelizTemplateFilesChoice) => void
  // The optional files ticked one by one, while ready: only included optional files count, in path
  // order; none is Recommended and every one is All. The same tick rule as above.
  chooseTemplateOptionalFiles?: (chosenTemplateOptionalFileRelativePaths: readonly string[]) => void
  // New Vault's form confirmed, with the name and place it already checked, and the folder its Location
  // row shows in Papeliz for Windows (null or left out: none, so a folder window asks). Must run from
  // the click, since a folder vault in a browser shows the browser's folder window first.
  makePapelizTemplateVault: (
    typedNewVaultName: string,
    chosenNewVaultPlace: PapelizTemplateNewVaultPlace,
    templateVaultParentFolder?: PapelizNewVaultParentFolder | null,
  ) => Promise<PapelizTemplateVaultMakeResult>
  // Import into This Vault, in an open vault, once ready (and the commands ticked): the checked files go
  // into a new folder named after the template (the next free name when taken), through the
  // workspace's importer, and the vault records where the folder came from. The template's own
  // `.papeliz/` files stay out, since they mean something only at a vault's top. A failed import goes
  // back to `ready`.
  importPapelizTemplateIntoVault: (templateVaultFolderImporter: PapelizTemplateVaultFolderImporter) => Promise<PapelizTemplateVaultFolderImportResult>
  // Cancel, or the form closed: stops a read under way and forgets the prepared files.
  cancelTemplateUse: () => void
}
