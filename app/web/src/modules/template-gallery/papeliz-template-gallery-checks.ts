import {
  isPapelizTemplateCategoryTag,
  papelizTemplateCategoryTags,
  papelizTemplateLicenseDisplayNames,
  papelizTemplateManifestFileName,
  papelizTemplateTagPattern,
  type PapelizTemplateCheckId,
  type PapelizTemplateCheckOutcome,
  type PapelizTemplateCheckReport,
  type PapelizTemplateCheckResult,
  type PapelizTemplateFileList,
  type PapelizTemplateFileListEntry,
  type PapelizTemplateFilesChoice,
  type PapelizTemplateFilesChoices,
  type PapelizTemplateLicenseId,
  type PapelizTemplateManifest,
  type PapelizTemplateRunCommand,
  type PapelizTemplateRunCommandKind,
} from './papeliz-template-gallery-contract'
import { detectPapelizTemplatePictureFormat, findPapelizTemplatePictureFormatByName } from './papeliz-template-gallery-picture-metadata'

// Every check a template must pass before Papeliz lists it or makes a vault from it: the manifest,
// what it includes, and Papeliz's safety floor on top (size limits, names every system takes, text
// or PNG, JPEG and WebP pictures only, no script in a note, no Git LFS pointer, a LICENSE file with
// the text of CC0 1.0, CC BY 4.0 or MIT, and the files' fingerprint). It also lists the commands a
// template's agent settings name and its script files; Papeliz never runs them. A symbolic link can
// only arrive as a short text file, and a submodule, which has no files in the list, as nothing.
//
// The checks read only what they are given, with nothing from the page, so the Templates Worker
// bundles this same file. On Use Template the browser runs them again on exactly the bytes it read.

export const papelizTemplateMostFileCount = 300
export const papelizTemplateMostTotalByteCount = 10 * 1024 * 1024
export const papelizTemplateMostFileByteCount = 2 * 1024 * 1024
// Paths are shorter than this.
export const papelizTemplatePathLengthLimit = 200
export const papelizTemplateMostFolderDepth = 8
const papelizTemplateNameLongestLength = 80
const papelizTemplateDescriptionLongestLength = 300
const papelizTemplateMostTagCount = 5
const papelizTemplateTagLongestLength = 30
// "coding", "education" or "research".
const papelizTemplateCategoryWords = `${papelizTemplateCategoryTags
  .slice(0, -1)
  .map((templateCategoryTag) => `"${templateCategoryTag}"`)
  .join(', ')} or "${papelizTemplateCategoryTags.at(-1) ?? ''}"`
// In each of templateIncludedPaths and templateExcludedPaths.
const papelizTemplateMostPathPatternCount = 30
// What jsDelivr serves from GitHub at most.
const papelizJsdelivrMostRepositoryByteCount = 150 * 1024 * 1024
const papelizJsdelivrMostFileByteCount = 20 * 1024 * 1024

const papelizTemplateManifestFieldNames: ReadonlySet<string> = new Set([
  'papelizTemplateManifestVersion',
  'templateName',
  'templateDescription',
  'templateTags',
  'templateFirstNotePath',
  'templateIncludedPaths',
  'templateExcludedPaths',
  'templateOptionalPaths',
  'templateThumbnailPicturePath',
])

// Never copied into a vault, whatever their case: Git's own folder at any depth, the manifest, and the
// folders at the vault's top that only Papeliz writes (papeliz-vault-relative-paths.ts): its settings,
// its saved chats (and the earlier `.chatsession/`) and its trash. From its settings, a template may
// bring its file list's order and looks, by these exact names; Papeliz writes
// `.papeliz/template-source.json` itself.
const papelizTemplatePapelizOwnTopFolderNames: ReadonlySet<string> = new Set(['.papeliz', '.csessions', '.chatsession', '.trash'])
const papelizTemplateBroughtPapelizSettingsRelativePaths: ReadonlySet<string> = new Set(['.papeliz/file-list-order.json', '.papeliz/file-list-looks.json'])
// The license file the license check reads, at the repository's root: LICENSE, LICENSE.md or
// LICENSE.txt. It comes along whatever the manifest says, as MIT and CC BY ask.
const papelizTemplateLicenseFileNamePattern = /^license(?:\.(?:md|txt))?$/i

// Names Windows refuses, with or without an extension.
const papelizWindowsReservedFileBaseNamePattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
// Characters Windows, macOS or Linux refuse in a name, and control characters.
// eslint-disable-next-line no-control-regex
const papelizTemplateBlockedNameCharacterPattern = /[<>:"\\|?*\u0000-\u001f]/
// Bidirectional embeddings, overrides and isolates, which make a name read as another
// ("evil\u202Egpj.sh" shows as "evilhs.jpg").
const papelizTemplateTextReorderingCharacterPattern = /[\u202a-\u202e\u2066-\u2069]/

// Characters that show nothing or turn text around: control characters other than tab and line feed,
// format characters (bidirectional marks and controls, zero-width characters, the byte order mark,
// the soft hyphen), the line and paragraph separators, and letters drawn blank (the Hangul fillers and
// the braille blank).
const papelizTemplateHiddenCharacterPattern = /[\p{Cc}\p{Cf}\u2028\u2029\u115f\u1160\u3164\uffa0\u2800]/u
const papelizTemplateHiddenCharacterGlobalPattern = /[\p{Cc}\p{Cf}\u2028\u2029\u115f\u1160\u3164\uffa0\u2800]/gu

// Programs, archives, documents and other files that are never text; a picture's name must hold
// a picture's bytes.
const papelizTemplateBinaryFileExtensions: ReadonlySet<string> = new Set([
  'gif', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'heif', 'svg', 'psd',
  'mp3', 'mp4', 'm4a', 'm4v', 'wav', 'ogg', 'oga', 'flac', 'aac', 'mov', 'avi', 'mkv', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'epub', 'rtf',
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar', 'jar', 'war', 'iso', 'dmg',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm', 'class', 'o', 'a', 'pyc', 'sqlite', 'db', 'msi', 'apk', 'deb', 'rpm',
])

// Script files, listed under "Runs commands".
const papelizTemplateScriptFileExtensions: ReadonlySet<string> = new Set([
  'sh', 'bash', 'zsh', 'fish', 'command', 'ps1', 'psm1', 'bat', 'cmd', 'vbs', 'wsf',
  'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'py', 'rb', 'pl',
])

// Settings an agent or editor reads, in any folder, compared in lower case:
// - Claude Code's, Gemini CLI's, Qwen Code's, Command Code's, Devin's, OpenCode's and Kilo Code's;
// - Cursor's MCP servers, hooks and its CLI's permissions;
// - MCP servers, and VS Code's tasks (some run when the folder opens);
// - dev containers (`initializeCommand` runs on the computer itself);
// - every agent's hooks file in a hidden folder: `hooks.json` (or `hooks.v1.json`), or a JSON file in
//   its `hooks/` folder. These are Codex's, Copilot's (`.github/hooks/`), Antigravity's (`.agents/`),
//   Devin's, Factory's, Kiro's, Grok's and others'.
const papelizTemplateAgentSettingsFilePathPattern =
  /(?:^|\/)(?:\.claude\/settings(?:\.local)?\.json|\.mcp\.json|\.gemini\/settings\.json|\.qwen\/settings\.json|\.commandcode\/settings(?:\.local)?\.json|\.cursor\/(?:mcp|hooks|cli)\.json|\.devin\/config(?:\.local)?\.json|opencode\.jsonc?|\.kilo\/kilo\.jsonc?|\.vscode\/(?:mcp|tasks)\.json|\.devcontainer\/(?:[^/]+\/)?devcontainer\.json|\.devcontainer\.json|\.[^/]+\/hooks(?:\.v\d+)?\.json|\.[^/]+\/hooks\/[^/]+\.json)$/
// Listed whole:
// - files of an agent's own commands, each able to run shell lines when it's used;
// - settings that aren't JSON: Codex's, its rules (which can let a command run without asking), and
//   Aider's (its lint and test commands can run after every change).
const papelizTemplateAgentCommandFilePathPattern = /(?:^|\/)(?:(?:\.claude|\.gemini|\.qwen)\/commands\/|\.codex\/config\.toml$|\.codex\/rules\/[^/]+\.rules$|\.aider\.conf\.ya?ml$)/
// Fields that hold a command:
// - `command`, with the form some agents give for Windows (`commandWindows`);
// - any name ending in "Command" (`postCreateCommand`, `initializeCommand`, `discoveryCommand`,
//   Kiro's `confirmCommand`);
// - the helpers Claude Code runs;
// - Copilot's fields named for what runs them: `bash`, `powershell`, and `exec` (with `args`).
const papelizTemplateAgentSettingsCommandFieldNamePattern = /command(?:windows|linux|macos|osx)?$/i
const papelizTemplateAgentSettingsHelperFieldNames: ReadonlySet<string> = new Set(['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'otelHeadersHelper'])
const papelizTemplateAgentSettingsShellCommandFieldNames: ReadonlySet<string> = new Set(['bash', 'powershell', 'exec'])
// The command fields whose `args` beside them are the command's arguments.
const papelizTemplateAgentSettingsCommandWithArgumentsFieldNames: ReadonlySet<string> = new Set(['command', 'exec'])
// Permission and approval modes that ask before a command runs, as they always do.
const papelizTemplateAgentAskingPermissionModes: ReadonlySet<string> = new Set(['default', 'plan'])
// Gemini CLI's and Qwen Code's approval modes.
const papelizTemplateAgentApprovalModeFieldNames: ReadonlySet<string> = new Set(['approvalMode', 'defaultApprovalMode'])

const papelizGitLfsPointerStart = 'version https://git-lfs.github.com/spec/'

const papelizTemplateCheckLabels: Readonly<Record<PapelizTemplateCheckId, string>> = {
  'repository-public': 'Repository',
  'license-allowed': 'License',
  'manifest-valid': 'Manifest',
  'file-list-complete': 'File list',
  'file-count-and-size': 'Size',
  'file-paths': 'Names and folders',
  'file-types': 'File types',
  'no-git-lfs-pointers': 'Git LFS',
  'file-hashes': 'File contents',
  'included-file-list-digest': 'Same files as checked',
  'notes-safe': 'Notes',
  'json-files-parse': 'JSON files',
  'first-note-present': 'First note',
}

const papelizTemplateFilesNotReadYetSentence = 'Checked once the files are read.'
const papelizTemplateEarlierCheckFailedSentence = 'Not checked, since an earlier check failed.'

export interface PapelizTemplateCheckInput {
  templateFileList: PapelizTemplateFileList
  // The files read so far, by path: the manifest and the license file for a first look before
  // reading the rest (`listPapelizTemplateFirstLookRelativePaths`), then those and every included
  // file. Checks that need a file not here are `not-checked`.
  templateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>
  // The fingerprint the listed template was checked with; null on Check, which records a new one.
  expectedTemplateIncludedFileListDigest: string | null
}

// ---------------------------------------------------------------- small helpers

function getTemplateFileExtension(templateFileRelativePath: string): string {
  const templateFileName = templateFileRelativePath.slice(templateFileRelativePath.lastIndexOf('/') + 1)
  const extensionDotIndex = templateFileName.lastIndexOf('.')
  return extensionDotIndex > 0 ? templateFileName.slice(extensionDotIndex + 1).toLowerCase() : ''
}

function isTemplateNoteRelativePath(templateFileRelativePath: string): boolean {
  return getTemplateFileExtension(templateFileRelativePath) === 'md'
}

// “a.md”, “b.md” and 3 more.
function listQuotedTemplatePaths(templateFileRelativePaths: readonly string[], mostShownPathCount = 3): string {
  const quotedTemplatePaths = templateFileRelativePaths.slice(0, mostShownPathCount).map((templateFileRelativePath) => `“${templateFileRelativePath}”`)
  const hiddenPathCount = templateFileRelativePaths.length - quotedTemplatePaths.length
  if (hiddenPathCount > 0) return `${quotedTemplatePaths.join(', ')} and ${hiddenPathCount} more`
  if (quotedTemplatePaths.length <= 1) return quotedTemplatePaths.join('')
  return `${quotedTemplatePaths.slice(0, -1).join(', ')} and ${quotedTemplatePaths.at(-1)}`
}

function formatTemplateByteCount(templateByteCount: number): string {
  if (templateByteCount < 1024 * 1024) return `${Math.max(1, Math.round(templateByteCount / 1024))} KB`
  return `${(templateByteCount / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
}

function countTemplateItems(itemCount: number, singularItemName: string, pluralItemName = `${singularItemName}s`): string {
  return `${itemCount} ${itemCount === 1 ? singularItemName : pluralItemName}`
}

export function hasPapelizTemplateHiddenCharacter(templateText: string): boolean {
  for (const templateTextCharacter of templateText) {
    if (isPapelizTemplateHiddenCharacter(templateTextCharacter)) return true
  }
  return false
}

export function isPapelizTemplateHiddenCharacter(templateTextCharacter: string): boolean {
  return templateTextCharacter !== '\t' && templateTextCharacter !== '\n' && papelizTemplateHiddenCharacterPattern.test(templateTextCharacter)
}

// A piece of a command's text, for showing it: plain text, or one hidden character to mark.
export interface PapelizTemplateTextPiece {
  templateTextPieceText: string
  isTemplateTextPieceHiddenCharacter: boolean
}

// "npm test‮x" -> "npm test", "‮" (hidden), "x".
export function splitPapelizTemplateTextAtHiddenCharacters(templateText: string): PapelizTemplateTextPiece[] {
  const templateTextPieces: PapelizTemplateTextPiece[] = []
  let plainTemplateText = ''
  for (const templateTextCharacter of templateText) {
    if (!isPapelizTemplateHiddenCharacter(templateTextCharacter)) {
      plainTemplateText += templateTextCharacter
      continue
    }
    if (plainTemplateText.length > 0) templateTextPieces.push({ templateTextPieceText: plainTemplateText, isTemplateTextPieceHiddenCharacter: false })
    plainTemplateText = ''
    templateTextPieces.push({ templateTextPieceText: templateTextCharacter, isTemplateTextPieceHiddenCharacter: true })
  }
  if (plainTemplateText.length > 0) templateTextPieces.push({ templateTextPieceText: plainTemplateText, isTemplateTextPieceHiddenCharacter: false })
  return templateTextPieces
}

// "‮" -> "U+202E".
export function describePapelizTemplateHiddenCharacter(templateTextCharacter: string): string {
  return `U+${(templateTextCharacter.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`
}

// A path as a disk that ignores case may read it: hidden characters dropped (older macOS disks skip
// some), then one case, with "ſ" as "s" and the Kelvin sign as "k". Used only to keep more out.
function foldTemplatePathForComparison(templateFileRelativePath: string): string {
  return templateFileRelativePath.normalize('NFC').replace(papelizTemplateHiddenCharacterGlobalPattern, '').toUpperCase().toLowerCase()
}

function encodeBytesAsBase64(digestBytes: Uint8Array): string {
  let binaryText = ''
  for (const digestByte of digestBytes) binaryText += String.fromCharCode(digestByte)
  return btoa(binaryText)
}

export async function computePapelizTemplateFileSha256Base64(templateFileBytes: Uint8Array): Promise<string> {
  return encodeBytesAsBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', templateFileBytes as Uint8Array<ArrayBuffer>)))
}

// Git's blob id for a file: SHA-1 over "blob <size>\0" and the bytes.
export async function computePapelizTemplateFileGitBlobSha1Hex(templateFileBytes: Uint8Array): Promise<string> {
  const gitBlobHeaderBytes = new TextEncoder().encode(`blob ${templateFileBytes.length}\0`)
  const gitBlobBytes = new Uint8Array(gitBlobHeaderBytes.length + templateFileBytes.length)
  gitBlobBytes.set(gitBlobHeaderBytes)
  gitBlobBytes.set(templateFileBytes, gitBlobHeaderBytes.length)
  const gitBlobDigestBytes = new Uint8Array(await crypto.subtle.digest('SHA-1', gitBlobBytes))
  return [...gitBlobDigestBytes].map((gitBlobDigestByte) => gitBlobDigestByte.toString(16).padStart(2, '0')).join('')
}

// The included files' fingerprint: the SHA-256 (base64) of their "path<TAB>sha256" lines, sorted by
// path and joined with "\n", where each line's sha256 is the file's own, in base64 as jsDelivr lists
// it. The Worker records it with the commit; the browser's files must give it back.
export async function computePapelizTemplateIncludedFileListDigest(
  includedTemplateFileSha256Base64ByRelativePath: ReadonlyMap<string, string>,
): Promise<string> {
  const includedTemplateFileLines = [...includedTemplateFileSha256Base64ByRelativePath]
    .sort(([firstRelativePath], [secondRelativePath]) => (firstRelativePath < secondRelativePath ? -1 : firstRelativePath > secondRelativePath ? 1 : 0))
    .map(([includedRelativePath, includedSha256Base64]) => `${includedRelativePath}\t${includedSha256Base64}`)
  return computePapelizTemplateFileSha256Base64(new TextEncoder().encode(includedTemplateFileLines.join('\n')))
}

// ---------------------------------------------------------------- the manifest

export type PapelizTemplateManifestParseResult =
  | { templateManifest: PapelizTemplateManifest; templateManifestProblemSentence: null }
  | { templateManifest: null; templateManifestProblemSentence: string }

function findTemplatePathPatternProblem(templatePathPattern: unknown): boolean {
  if (typeof templatePathPattern !== 'string') return true
  if (templatePathPattern.length === 0 || templatePathPattern.length >= papelizTemplatePathLengthLimit) return true
  if (templatePathPattern.startsWith('/') || templatePathPattern.includes('\\')) return true
  return templatePathPattern.split('/').some((patternSegment) => patternSegment === '..' || patternSegment === '.')
}

function findTemplateRelativePathShapeProblem(templateRelativePath: unknown): boolean {
  if (typeof templateRelativePath !== 'string' || templateRelativePath.length === 0 || templateRelativePath.length >= papelizTemplatePathLengthLimit) return true
  if (templateRelativePath.startsWith('/') || templateRelativePath.includes('\\')) return true
  return templateRelativePath.split('/').some((pathSegment) => pathSegment.length === 0 || pathSegment === '..' || pathSegment === '.')
}

export function parsePapelizTemplateManifest(templateManifestText: string): PapelizTemplateManifestParseResult {
  const manifestProblem = (templateManifestProblemSentence: string): PapelizTemplateManifestParseResult => ({ templateManifest: null, templateManifestProblemSentence })
  let parsedManifest: unknown
  try {
    parsedManifest = JSON.parse(templateManifestText.replace(/^\uFEFF/, ''))
  } catch {
    return manifestProblem(`The manifest, ${papelizTemplateManifestFileName}, isn’t valid JSON. Fix it, then check again.`)
  }
  if (typeof parsedManifest !== 'object' || parsedManifest === null || Array.isArray(parsedManifest)) {
    return manifestProblem('The manifest must hold one JSON object, with the template’s name, description and first note.')
  }
  const manifestFields = parsedManifest as Record<string, unknown>
  const unknownFieldName = Object.keys(manifestFields).find((manifestFieldName) => !papelizTemplateManifestFieldNames.has(manifestFieldName))
  if (unknownFieldName !== undefined) return manifestProblem(`The manifest has a field Papeliz doesn’t know, “${unknownFieldName}”. Check its spelling.`)
  if (manifestFields['papelizTemplateManifestVersion'] !== 1) return manifestProblem('The manifest needs "papelizTemplateManifestVersion": 1.')
  const { templateName, templateDescription, templateTags, templateFirstNotePath } = manifestFields
  if (typeof templateName !== 'string' || templateName.trim().length === 0 || templateName.trim().length > papelizTemplateNameLongestLength) {
    return manifestProblem(`The manifest’s templateName must be a name of 1 to ${papelizTemplateNameLongestLength} characters.`)
  }
  if (typeof templateDescription !== 'string' || templateDescription.trim().length === 0 || templateDescription.trim().length > papelizTemplateDescriptionLongestLength) {
    return manifestProblem(`The manifest’s templateDescription must be a sentence or two, up to ${papelizTemplateDescriptionLongestLength} characters.`)
  }
  if (
    !Array.isArray(templateTags) ||
    templateTags.length > papelizTemplateMostTagCount ||
    templateTags.some((templateTag) => typeof templateTag !== 'string' || !papelizTemplateTagPattern.test(templateTag) || templateTag.length > papelizTemplateTagLongestLength)
  ) {
    return manifestProblem(`The manifest’s templateTags must be a list of up to ${papelizTemplateMostTagCount} tags in lower case, its category first, such as ["coding", "project-workflow"].`)
  }
  // The first tag is the template's Category; the rest are its subcategory and extra labels.
  const templateCategoryTag = (templateTags as string[])[0]
  if (templateCategoryTag === undefined) {
    return manifestProblem(`The manifest’s templateTags must start with the template’s category: ${papelizTemplateCategoryWords}, such as ["coding", "project-workflow"].`)
  }
  if (!isPapelizTemplateCategoryTag(templateCategoryTag)) {
    return manifestProblem(`The manifest’s first tag, “${templateCategoryTag}”, must be the template’s category: ${papelizTemplateCategoryWords}. Put one of them first, such as ["coding", "project-workflow"].`)
  }
  if (findTemplateRelativePathShapeProblem(templateFirstNotePath) || !isTemplateNoteRelativePath(templateFirstNotePath as string)) {
    return manifestProblem('The manifest’s templateFirstNotePath must be the path of a .md note in the repository, such as "START.md".')
  }
  const templateIncludedPaths = manifestFields['templateIncludedPaths'] ?? ['**']
  const templateExcludedPaths = manifestFields['templateExcludedPaths'] ?? []
  const templateOptionalPaths = manifestFields['templateOptionalPaths'] ?? []
  for (const [pathPatternFieldName, pathPatterns] of [
    ['templateIncludedPaths', templateIncludedPaths],
    ['templateExcludedPaths', templateExcludedPaths],
    ['templateOptionalPaths', templateOptionalPaths],
  ] as const) {
    if (!Array.isArray(pathPatterns) || pathPatterns.length > papelizTemplateMostPathPatternCount || pathPatterns.some(findTemplatePathPatternProblem)) {
      return manifestProblem(`The manifest’s ${pathPatternFieldName} must be a list of up to ${papelizTemplateMostPathPatternCount} paths from the repository’s root, such as ".github/**".`)
    }
  }
  const templateThumbnailPicturePath = manifestFields['templateThumbnailPicturePath'] ?? null
  if (templateThumbnailPicturePath !== null && (findTemplateRelativePathShapeProblem(templateThumbnailPicturePath) || findPapelizTemplatePictureFormatByName(templateThumbnailPicturePath as string) === null)) {
    return manifestProblem('The manifest’s templateThumbnailPicturePath must be the path of a PNG, JPEG or WebP picture in the repository.')
  }
  return {
    templateManifest: {
      papelizTemplateManifestVersion: 1,
      templateName: templateName.trim(),
      templateDescription: templateDescription.trim(),
      templateTags: templateTags as string[],
      templateFirstNotePath: templateFirstNotePath as string,
      templateIncludedPaths: templateIncludedPaths as string[],
      templateExcludedPaths: templateExcludedPaths as string[],
      templateOptionalPaths: templateOptionalPaths as string[],
      templateThumbnailPicturePath: templateThumbnailPicturePath as string | null,
    },
    templateManifestProblemSentence: null,
  }
}

// ---------------------------------------------------------------- what's included

// A path pattern's folder names, as the matcher takes them, each split into its characters: null for
// "**" alone, which is any folders; in any other name a run of "*" is one "*".
type PapelizTemplateSplitPathPattern = ReadonlyArray<readonly string[] | null>

function splitTemplatePathPattern(templatePathPattern: string): PapelizTemplateSplitPathPattern {
  return templatePathPattern.split('/').map((patternSegment) => (patternSegment === '**' ? null : Array.from(patternSegment.replace(/\*+/g, '*'))))
}

function splitTemplatePathIntoNameCharacters(templateFileRelativePath: string): string[][] {
  return templateFileRelativePath.split('/').map((pathSegment) => Array.from(pathSegment))
}

// How many steps matching may take for one template, across all its listed files and patterns: many
// times what any real manifest needs, and well under a second, so no pattern or file list can freeze
// the tab or use up the Templates Worker's time.
const papelizTemplatePathMatchingMostStepCount = 50_000_000

class PapelizTemplatePathMatchingTooLongError extends Error {}

interface PapelizTemplatePathMatchingSteps {
  remainingMatchingStepCount: number
}

function takeTemplatePathMatchingSteps(templatePathMatchingSteps: PapelizTemplatePathMatchingSteps, takenStepCount: number): void {
  templatePathMatchingSteps.remainingMatchingStepCount -= takenStepCount
  if (templatePathMatchingSteps.remainingMatchingStepCount < 0) throw new PapelizTemplatePathMatchingTooLongError()
}

// One name against one pattern name: `*` any characters, `?` one. Without a regular expression, and
// going back only to the last `*`, so it takes at most the names' lengths multiplied.
function matchTemplatePathPatternName(patternNameCharacters: readonly string[], pathNameCharacters: readonly string[], templatePathMatchingSteps: PapelizTemplatePathMatchingSteps): boolean {
  let patternIndex = 0
  let pathIndex = 0
  let lastStarPatternIndex = -1
  let pathIndexAfterLastStar = 0
  while (pathIndex < pathNameCharacters.length) {
    takeTemplatePathMatchingSteps(templatePathMatchingSteps, 1)
    const patternCharacter = patternNameCharacters[patternIndex]
    if (patternCharacter !== undefined && patternCharacter !== '*' && (patternCharacter === '?' || patternCharacter === pathNameCharacters[pathIndex])) {
      patternIndex += 1
      pathIndex += 1
    } else if (patternCharacter === '*') {
      lastStarPatternIndex = patternIndex
      pathIndexAfterLastStar = pathIndex
      patternIndex += 1
    } else if (lastStarPatternIndex >= 0) {
      patternIndex = lastStarPatternIndex + 1
      pathIndexAfterLastStar += 1
      pathIndex = pathIndexAfterLastStar
    } else {
      return false
    }
  }
  while (patternNameCharacters[patternIndex] === '*') patternIndex += 1
  return patternIndex === patternNameCharacters.length
}

// A path against a split pattern, folder by folder: for each pattern name, from the last back, which
// path positions the rest of the pattern matches from. Each pattern name meets each path name once,
// so no pattern can make it slow. A "**" at the end needs one name at least: "drafts/**" is what's
// inside drafts/.
function matchSplitTemplatePathPattern(
  patternSegments: PapelizTemplateSplitPathPattern,
  pathSegmentCharacters: ReadonlyArray<readonly string[]>,
  templatePathMatchingSteps: PapelizTemplatePathMatchingSteps,
): boolean {
  const pathSegmentCount = pathSegmentCharacters.length
  let isRestMatchedFrom: boolean[] = Array.from({ length: pathSegmentCount + 1 }, (_unused, pathSegmentIndex) => pathSegmentIndex === pathSegmentCount)
  for (let patternSegmentIndex = patternSegments.length - 1; patternSegmentIndex >= 0; patternSegmentIndex -= 1) {
    takeTemplatePathMatchingSteps(templatePathMatchingSteps, pathSegmentCount + 1)
    const patternNameCharacters = patternSegments[patternSegmentIndex] ?? null
    const isThisMatchedFrom = new Array<boolean>(pathSegmentCount + 1).fill(false)
    if (patternNameCharacters === null) {
      const isAtPatternEnd = patternSegmentIndex === patternSegments.length - 1 && patternSegments.length > 1
      for (let pathSegmentIndex = pathSegmentCount; pathSegmentIndex >= 0; pathSegmentIndex -= 1) {
        isThisMatchedFrom[pathSegmentIndex] = isAtPatternEnd
          ? pathSegmentIndex < pathSegmentCount
          : (isRestMatchedFrom[pathSegmentIndex] ?? false) || (pathSegmentIndex < pathSegmentCount && (isThisMatchedFrom[pathSegmentIndex + 1] ?? false))
      }
    } else {
      for (let pathSegmentIndex = 0; pathSegmentIndex < pathSegmentCount; pathSegmentIndex += 1) {
        isThisMatchedFrom[pathSegmentIndex] =
          (isRestMatchedFrom[pathSegmentIndex + 1] ?? false) && matchTemplatePathPatternName(patternNameCharacters, pathSegmentCharacters[pathSegmentIndex] ?? [], templatePathMatchingSteps)
      }
    }
    isRestMatchedFrom = isThisMatchedFrom
  }
  return isRestMatchedFrom[0] ?? false
}

// Whether a path pattern (from the manifest) matches a file's whole path from the repository's root;
// null when matching would take too long.
export function matchPapelizTemplatePathPattern(templatePathPattern: string, templateFileRelativePath: string): boolean | null {
  try {
    return matchSplitTemplatePathPattern(splitTemplatePathPattern(templatePathPattern), splitTemplatePathIntoNameCharacters(templateFileRelativePath), {
      remainingMatchingStepCount: papelizTemplatePathMatchingMostStepCount,
    })
  } catch (templatePathMatchingError) {
    if (templatePathMatchingError instanceof PapelizTemplatePathMatchingTooLongError) return null
    throw templatePathMatchingError
  }
}

// A file named like one of these folders is left out too, since it would stand where the folder goes
// (and a `.git` file can point Git at another repository).
function isTemplateRelativePathAlwaysLeftOut(templateFileRelativePath: string): boolean {
  if (templateFileRelativePath === papelizTemplateManifestFileName) return true
  const foldedPathSegments = foldTemplatePathForComparison(templateFileRelativePath).split('/')
  if (foldedPathSegments.includes('.git')) return true
  if (!papelizTemplatePapelizOwnTopFolderNames.has(foldedPathSegments[0] ?? '')) return false
  return !papelizTemplateBroughtPapelizSettingsRelativePaths.has(templateFileRelativePath)
}

export const papelizTemplatePathPatternsTooSlowSentence =
  'The manifest’s templateIncludedPaths and templateExcludedPaths take too long to match this repository’s files. Use fewer, simpler patterns, such as "drafts/**".'

// The files a vault made from the template gets, in path order; null when its patterns take too long
// to match the repository's files.
export function selectPapelizTemplateIncludedFileListEntries(
  templateFileList: PapelizTemplateFileList,
  templateManifest: PapelizTemplateManifest,
): PapelizTemplateFileListEntry[] | null {
  const includedPathPatterns = templateManifest.templateIncludedPaths.map(splitTemplatePathPattern)
  const excludedPathPatterns = templateManifest.templateExcludedPaths.map(splitTemplatePathPattern)
  const templatePathMatchingSteps: PapelizTemplatePathMatchingSteps = { remainingMatchingStepCount: papelizTemplatePathMatchingMostStepCount }
  try {
    return templateFileList.templateFileListEntries
      .filter(({ templateFileRelativePath }) => {
        if (isTemplateRelativePathAlwaysLeftOut(templateFileRelativePath)) return false
        if (!templateFileRelativePath.includes('/') && papelizTemplateLicenseFileNamePattern.test(templateFileRelativePath)) return true
        const templatePathNameCharacters = splitTemplatePathIntoNameCharacters(templateFileRelativePath)
        if (!includedPathPatterns.some((includedPathPattern) => matchSplitTemplatePathPattern(includedPathPattern, templatePathNameCharacters, templatePathMatchingSteps))) return false
        return !excludedPathPatterns.some((excludedPathPattern) => matchSplitTemplatePathPattern(excludedPathPattern, templatePathNameCharacters, templatePathMatchingSteps))
      })
      .sort((firstEntry, secondEntry) => (firstEntry.templateFileRelativePath < secondEntry.templateFileRelativePath ? -1 : 1))
  } catch (templatePathMatchingError) {
    if (templatePathMatchingError instanceof PapelizTemplatePathMatchingTooLongError) return null
    throw templatePathMatchingError
  }
}

// ---------------------------------------------------------------- Recommended or All

export const papelizTemplateOptionalPathPatternsTooSlowSentence =
  'The manifest’s templateOptionalPaths take too long to match this template’s files. Use fewer, simpler patterns, such as ".gemini/**".'

// The included files the manifest's optional paths match, in the order given; null when matching would
// take too long, which fails the manifest. The license file and the first note always come, so they
// are never optional.
export function findPapelizTemplateOptionalFileRelativePaths(includedTemplateFileRelativePaths: readonly string[], templateManifest: PapelizTemplateManifest): string[] | null {
  if (templateManifest.templateOptionalPaths.length === 0) return []
  const optionalPathPatterns = templateManifest.templateOptionalPaths.map(splitTemplatePathPattern)
  const templatePathMatchingSteps: PapelizTemplatePathMatchingSteps = { remainingMatchingStepCount: papelizTemplatePathMatchingMostStepCount }
  try {
    return includedTemplateFileRelativePaths.filter((includedRelativePath) => {
      if (includedRelativePath === templateManifest.templateFirstNotePath) return false
      if (!includedRelativePath.includes('/') && papelizTemplateLicenseFileNamePattern.test(includedRelativePath)) return false
      const includedPathNameCharacters = splitTemplatePathIntoNameCharacters(includedRelativePath)
      return optionalPathPatterns.some((optionalPathPattern) => matchSplitTemplatePathPattern(optionalPathPattern, includedPathNameCharacters, templatePathMatchingSteps))
    })
  } catch (templatePathMatchingError) {
    if (templatePathMatchingError instanceof PapelizTemplatePathMatchingTooLongError) return null
    throw templatePathMatchingError
  }
}

// Recommended when the manifest has optional paths, All when it has none.
export function findPapelizTemplateDefaultFilesChoice(templateManifest: PapelizTemplateManifest): PapelizTemplateFilesChoice {
  return templateManifest.templateOptionalPaths.length > 0 ? 'recommended' : 'all'
}

// The included files a choice keeps, in the order given: every one for All, and for Recommended all
// but the optional ones. Patterns too slow to match, which the checks refuse, leave nothing out.
export function selectPapelizTemplateChosenFileRelativePaths(
  includedTemplateFileRelativePaths: readonly string[],
  templateManifest: PapelizTemplateManifest,
  templateFilesChoice: PapelizTemplateFilesChoice,
): string[] {
  if (templateFilesChoice === 'all') return [...includedTemplateFileRelativePaths]
  const optionalFileRelativePaths = new Set(findPapelizTemplateOptionalFileRelativePaths(includedTemplateFileRelativePaths, templateManifest) ?? [])
  return includedTemplateFileRelativePaths.filter((includedRelativePath) => !optionalFileRelativePaths.has(includedRelativePath))
}

// Both choices for the screens: the default, each one's file count, and what only All brings.
export function describePapelizTemplateFilesChoices(includedTemplateFileRelativePaths: readonly string[], templateManifest: PapelizTemplateManifest): PapelizTemplateFilesChoices {
  const templateOptionalFileRelativePaths = [...(findPapelizTemplateOptionalFileRelativePaths(includedTemplateFileRelativePaths, templateManifest) ?? [])].sort((firstRelativePath, secondRelativePath) =>
    firstRelativePath < secondRelativePath ? -1 : firstRelativePath > secondRelativePath ? 1 : 0,
  )
  const templateOptionalTopEntryNames = [...new Set(templateOptionalFileRelativePaths.map((optionalRelativePath) => optionalRelativePath.split('/')[0] ?? optionalRelativePath))]
  return {
    defaultTemplateFilesChoice: findPapelizTemplateDefaultFilesChoice(templateManifest),
    hasTemplateOptionalFiles: templateOptionalFileRelativePaths.length > 0,
    recommendedTemplateFileCount: includedTemplateFileRelativePaths.length - templateOptionalFileRelativePaths.length,
    allTemplateFileCount: includedTemplateFileRelativePaths.length,
    templateOptionalFileRelativePaths,
    templateOptionalTopEntryNames,
  }
}

// ---------------------------------------------------------------- the floor

function findTemplatePathProblem(templateFileRelativePath: string): string | null {
  if (templateFileRelativePath.length >= papelizTemplatePathLengthLimit) return `is ${templateFileRelativePath.length} characters long`
  const templatePathSegments = templateFileRelativePath.split('/')
  if (templatePathSegments.length - 1 > papelizTemplateMostFolderDepth) return `is ${templatePathSegments.length - 1} folders deep`
  for (const templatePathSegment of templatePathSegments) {
    if (templatePathSegment.length === 0 || templatePathSegment === '.' || templatePathSegment === '..') return 'leaves its folder'
    if (papelizTemplateBlockedNameCharacterPattern.test(templatePathSegment)) return 'has a character Windows refuses'
    if (papelizTemplateTextReorderingCharacterPattern.test(templatePathSegment)) return 'has a hidden character that turns its name around'
    if (papelizWindowsReservedFileBaseNamePattern.test(templatePathSegment)) return 'has a name Windows refuses'
    if (/[. ]$/.test(templatePathSegment)) return 'has a name ending in a dot or space'
  }
  return null
}

function decodeTemplateText(templateFileBytes: Uint8Array): string | null {
  if (templateFileBytes.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(templateFileBytes)
  } catch {
    return null
  }
}

// What a file holds when it isn't text or a picture of its name's type, or null when it's fine.
function findTemplateFileTypeProblem(templateFileRelativePath: string, templateFileBytes: Uint8Array): string | null {
  const pictureFormatByName = findPapelizTemplatePictureFormatByName(templateFileRelativePath)
  if (pictureFormatByName !== null) return detectPapelizTemplatePictureFormat(templateFileBytes) === pictureFormatByName ? null : 'isn’t the picture its name says'
  const templateFileExtension = getTemplateFileExtension(templateFileRelativePath)
  if (papelizTemplateBinaryFileExtensions.has(templateFileExtension)) return templateFileExtension === 'svg' || templateFileExtension === 'gif' ? 'is a picture type templates don’t take' : 'isn’t text'
  return decodeTemplateText(templateFileBytes) === null ? 'isn’t text' : null
}

// Markdown code (fenced blocks and inline spans) shows as text, so what it holds never runs.
function removeMarkdownCode(noteText: string): string {
  const keptNoteLines: string[] = []
  let openFenceMarker: string | null = null
  for (const noteLine of noteText.split(/\r?\n/)) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(noteLine)
    if (openFenceMarker === null) {
      if (fenceMatch !== null) openFenceMarker = fenceMatch[1] ?? null
      else keptNoteLines.push(noteLine)
    } else if (fenceMatch !== null && (fenceMatch[1] ?? '').startsWith(openFenceMarker) && /^ {0,3}[`~]+\s*$/.test(noteLine)) {
      openFenceMarker = null
    }
  }
  return keptNoteLines.join('\n').replace(/(`+)[\s\S]*?\1/g, '')
}

// What in a note's text could run in a page, or null for none.
function findDangerousNoteMarkup(noteText: string): string | null {
  const noteProseText = removeMarkdownCode(noteText)
  const blockedTagMatch = /<\s*(script|iframe|object|embed|form)\b/i.exec(noteProseText)
  if (blockedTagMatch !== null) return `a <${(blockedTagMatch[1] ?? '').toLowerCase()}> tag`
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(noteProseText)) return 'an on… attribute'
  const runnableLinkPatterns = [
    /\]\(\s*<?\s*(javascript|vbscript|data):/i,
    /\b(?:href|src|action|formaction|xlink:href|poster|srcset)\s*=\s*["']?\s*(javascript|vbscript|data):/i,
    /<\s*(javascript|vbscript|data):/i,
    /^ {0,3}\[[^\]]+\]:\s*<?\s*(javascript|vbscript|data):/im,
  ]
  for (const runnableLinkPattern of runnableLinkPatterns) {
    const runnableLinkMatch = runnableLinkPattern.exec(noteProseText)
    if (runnableLinkMatch !== null) return `a ${(runnableLinkMatch[1] ?? '').toLowerCase()}: link`
  }
  return null
}

// ---------------------------------------------------------------- "Runs commands"

type PapelizTemplateAgentSettingKind = Exclude<PapelizTemplateRunCommandKind, 'agent-command-file' | 'script-file'>

function isPlainAgentSettingsObject(agentSettingsValue: unknown): agentSettingsValue is Record<string, unknown> {
  return typeof agentSettingsValue === 'object' && agentSettingsValue !== null && !Array.isArray(agentSettingsValue)
}

// A command's arguments as VS Code and MCP settings write them: strings, or `{ "value": \u2026 }`.
function describeAgentSettingsCommandArguments(agentSettingsArgumentsValue: unknown): string[] {
  if (!Array.isArray(agentSettingsArgumentsValue)) return []
  return (agentSettingsArgumentsValue as unknown[]).flatMap((commandArgument) => {
    if (typeof commandArgument === 'string') return [commandArgument]
    const commandArgumentValue = isPlainAgentSettingsObject(commandArgument) ? commandArgument['value'] : undefined
    return typeof commandArgumentValue === 'string' ? [commandArgumentValue] : []
  })
}

// One command a setting holds, as written: a string, a list of parts as one command line, or VS
// Code's `{ "value": \u2026, "quoting": \u2026 }`; null for anything else.
function describeAgentSettingsCommandValue(agentSettingsCommandValue: unknown): string | null {
  if (typeof agentSettingsCommandValue === 'string') return agentSettingsCommandValue
  if (Array.isArray(agentSettingsCommandValue)) {
    const commandParts = describeAgentSettingsCommandArguments(agentSettingsCommandValue)
    return commandParts.length > 0 ? commandParts.join(' ') : null
  }
  const commandValueText = isPlainAgentSettingsObject(agentSettingsCommandValue) ? agentSettingsCommandValue['value'] : undefined
  return typeof commandValueText === 'string' ? commandValueText : null
}

interface PapelizTemplateFoundAgentSetting {
  agentSettingKind: PapelizTemplateAgentSettingKind
  agentSettingText: string
}

// One step of reading a settings file: a value still to read, or a setting found in it.
type PapelizTemplateAgentSettingsWalkStep = { walkedAgentSettingsValue: unknown } | PapelizTemplateFoundAgentSetting

function createAgentSettingPermissionStep(agentSettingText: string): PapelizTemplateFoundAgentSetting {
  return { agentSettingKind: 'agent-setting-permission', agentSettingText }
}

// OpenCode's and Kilo Code's `permission`: "allow" for every tool, or by tool, each "allow", "ask" or
// "deny", or patterns with their own ({ "bash": { "*": "allow", "rm *": "deny" } }). What lets a
// command run without asking is `bash` or `*` allowed, whole or by pattern. Anything else in it is
// read as any setting is.
function listAgentToolPermissionWalkSteps(agentToolPermissionValue: unknown): PapelizTemplateAgentSettingsWalkStep[] {
  if (typeof agentToolPermissionValue === 'string') return agentToolPermissionValue === 'allow' ? [createAgentSettingPermissionStep('permission: allow')] : []
  if (!isPlainAgentSettingsObject(agentToolPermissionValue)) return [{ walkedAgentSettingsValue: agentToolPermissionValue }]
  const toolPermissionWalkSteps: PapelizTemplateAgentSettingsWalkStep[] = []
  for (const [permissionToolName, permissionToolValue] of Object.entries(agentToolPermissionValue)) {
    const isCommandRunningTool = permissionToolName.toLowerCase() === 'bash' || permissionToolName === '*'
    if (typeof permissionToolValue === 'string') {
      if (isCommandRunningTool && permissionToolValue === 'allow') toolPermissionWalkSteps.push(createAgentSettingPermissionStep(`${permissionToolName}: allow`))
    } else if (isPlainAgentSettingsObject(permissionToolValue) && Object.values(permissionToolValue).every((permissionAction) => typeof permissionAction === 'string')) {
      for (const [permissionPattern, permissionAction] of Object.entries(permissionToolValue)) {
        if (isCommandRunningTool && permissionAction === 'allow') toolPermissionWalkSteps.push(createAgentSettingPermissionStep(`${permissionToolName} ${permissionPattern}: allow`))
      }
    } else {
      toolPermissionWalkSteps.push({ walkedAgentSettingsValue: permissionToolValue })
    }
  }
  return toolPermissionWalkSteps
}

// Everything in a parsed settings file that runs a command or changes how one runs, in the file's
// order. It walks with a list, not by calling itself, so a file nested however deep is read to its
// end: every command, environment variable, permission that skips asking, and plugin.
function listAgentSettingsRunSettings(parsedAgentSettings: unknown): PapelizTemplateFoundAgentSetting[] {
  const foundAgentSettings: PapelizTemplateFoundAgentSetting[] = []
  const pendingWalkSteps: PapelizTemplateAgentSettingsWalkStep[] = [{ walkedAgentSettingsValue: parsedAgentSettings }]
  while (pendingWalkSteps.length > 0) {
    const walkStep = pendingWalkSteps.pop()
    if (walkStep === undefined) break
    if (!('walkedAgentSettingsValue' in walkStep)) {
      foundAgentSettings.push(walkStep)
      continue
    }
    const { walkedAgentSettingsValue } = walkStep
    // This value's steps in order; pushed last to first, so the first comes off the list first.
    const nextWalkSteps: PapelizTemplateAgentSettingsWalkStep[] = []
    if (Array.isArray(walkedAgentSettingsValue)) {
      for (const agentSettingsItem of walkedAgentSettingsValue as unknown[]) nextWalkSteps.push({ walkedAgentSettingsValue: agentSettingsItem })
    } else if (isPlainAgentSettingsObject(walkedAgentSettingsValue)) {
      for (const [agentSettingsFieldName, agentSettingsFieldValue] of Object.entries(walkedAgentSettingsValue)) {
        const isCommandField =
          papelizTemplateAgentSettingsCommandFieldNamePattern.test(agentSettingsFieldName) ||
          papelizTemplateAgentSettingsHelperFieldNames.has(agentSettingsFieldName) ||
          papelizTemplateAgentSettingsShellCommandFieldNames.has(agentSettingsFieldName)
        const commandText = describeAgentSettingsCommandValue(agentSettingsFieldValue)
        if (isCommandField && commandText !== null) {
          const commandArguments = papelizTemplateAgentSettingsCommandWithArgumentsFieldNames.has(agentSettingsFieldName) ? describeAgentSettingsCommandArguments(walkedAgentSettingsValue['args']) : []
          nextWalkSteps.push({ agentSettingKind: 'agent-setting-command', agentSettingText: [commandText, ...commandArguments].join(' ').trim() })
        } else if (isCommandField && isPlainAgentSettingsObject(agentSettingsFieldValue)) {
          // A dev container's step as named commands: { "install": "npm ci", "build": ["make"] }.
          for (const namedCommandValue of Object.values(agentSettingsFieldValue)) {
            const namedCommandText = describeAgentSettingsCommandValue(namedCommandValue)
            nextWalkSteps.push(namedCommandText === null ? { walkedAgentSettingsValue: namedCommandValue } : { agentSettingKind: 'agent-setting-command', agentSettingText: namedCommandText })
          }
        } else if (agentSettingsFieldName === 'script' && typeof agentSettingsFieldValue === 'string' && walkedAgentSettingsValue['type'] === 'npm') {
          // A VS Code npm task runs one of package.json's scripts.
          nextWalkSteps.push({ agentSettingKind: 'agent-setting-command', agentSettingText: `npm run ${agentSettingsFieldValue}` })
        } else if (agentSettingsFieldName === 'env' && isPlainAgentSettingsObject(agentSettingsFieldValue)) {
          for (const [environmentVariableName, environmentVariableValue] of Object.entries(agentSettingsFieldValue)) {
            nextWalkSteps.push({ agentSettingKind: 'agent-setting-environment', agentSettingText: `${environmentVariableName}=${typeof environmentVariableValue === 'string' ? environmentVariableValue : JSON.stringify(environmentVariableValue)}` })
          }
        } else if (agentSettingsFieldName === 'permissions' && isPlainAgentSettingsObject(agentSettingsFieldValue)) {
          // Rules that deny or ask run nothing; ones that allow, and a mode that asks less, do.
          const { allow: allowedPermissionRules, defaultMode: permissionMode } = agentSettingsFieldValue
          for (const allowedPermissionRule of Array.isArray(allowedPermissionRules) ? (allowedPermissionRules as unknown[]) : []) {
            nextWalkSteps.push(createAgentSettingPermissionStep(typeof allowedPermissionRule === 'string' ? allowedPermissionRule : JSON.stringify(allowedPermissionRule)))
          }
          if (permissionMode !== undefined && !(typeof permissionMode === 'string' && papelizTemplateAgentAskingPermissionModes.has(permissionMode))) {
            nextWalkSteps.push(createAgentSettingPermissionStep(`defaultMode: ${typeof permissionMode === 'string' ? permissionMode : JSON.stringify(permissionMode)}`))
          }
        } else if (agentSettingsFieldName === 'permission') {
          nextWalkSteps.push(...listAgentToolPermissionWalkSteps(agentSettingsFieldValue))
        } else if (agentSettingsFieldName === 'allowed' && Array.isArray(agentSettingsFieldValue)) {
          // Gemini CLI's and Qwen Code's tools that run without asking: "run_shell_command(npm test)".
          for (const allowedToolName of agentSettingsFieldValue as unknown[]) {
            nextWalkSteps.push(createAgentSettingPermissionStep(typeof allowedToolName === 'string' ? allowedToolName : JSON.stringify(allowedToolName)))
          }
        } else if (papelizTemplateAgentApprovalModeFieldNames.has(agentSettingsFieldName)) {
          if (!(typeof agentSettingsFieldValue === 'string' && papelizTemplateAgentAskingPermissionModes.has(agentSettingsFieldValue))) {
            nextWalkSteps.push(createAgentSettingPermissionStep(`${agentSettingsFieldName}: ${typeof agentSettingsFieldValue === 'string' ? agentSettingsFieldValue : JSON.stringify(agentSettingsFieldValue)}`))
          }
        } else if (agentSettingsFieldName === 'enabledPlugins' && isPlainAgentSettingsObject(agentSettingsFieldValue)) {
          for (const [pluginName, isPluginEnabled] of Object.entries(agentSettingsFieldValue)) {
            if (isPluginEnabled !== false) nextWalkSteps.push({ agentSettingKind: 'agent-setting-plugin', agentSettingText: pluginName })
          }
        } else {
          nextWalkSteps.push({ walkedAgentSettingsValue: agentSettingsFieldValue })
        }
      }
    }
    for (let nextWalkStepIndex = nextWalkSteps.length - 1; nextWalkStepIndex >= 0; nextWalkStepIndex -= 1) {
      const nextWalkStep = nextWalkSteps[nextWalkStepIndex]
      if (nextWalkStep !== undefined) pendingWalkSteps.push(nextWalkStep)
    }
  }
  return foundAgentSettings
}

function createTemplateRunCommand(templateRunCommandKind: PapelizTemplateRunCommandKind, templateRunCommandSourceRelativePath: string, templateRunCommandText: string): PapelizTemplateRunCommand {
  return {
    templateRunCommandKind,
    templateRunCommandSourceRelativePath,
    templateRunCommandText,
    hasTemplateRunCommandHiddenCharacters: hasPapelizTemplateHiddenCharacter(templateRunCommandText) || hasPapelizTemplateHiddenCharacter(templateRunCommandSourceRelativePath),
  }
}

// The commands a template's agent settings name (in any folder, whatever their case), its agents'
// command files and its script files, in path order. Settings Papeliz can't read through (not text,
// not JSON) are listed whole, so nothing in them goes unshown; the JSON check refuses them too.
export function listPapelizTemplateRunCommands(includedTemplateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>): PapelizTemplateRunCommand[] {
  const templateRunCommands: PapelizTemplateRunCommand[] = []
  for (const [templateFileRelativePath, templateFileBytes] of [...includedTemplateFileBytesByRelativePath].sort(([firstPath], [secondPath]) => (firstPath < secondPath ? -1 : 1))) {
    const foldedRelativePath = foldTemplatePathForComparison(templateFileRelativePath)
    const templateFileName = templateFileRelativePath.slice(templateFileRelativePath.lastIndexOf('/') + 1)
    const templateFileText = decodeTemplateText(templateFileBytes)?.replace(/^\uFEFF/, '') ?? null
    if (papelizTemplateAgentSettingsFilePathPattern.test(foldedRelativePath)) {
      let parsedAgentSettings: unknown
      try {
        parsedAgentSettings = templateFileText === null ? undefined : JSON.parse(templateFileText)
      } catch {
        parsedAgentSettings = undefined
      }
      if (parsedAgentSettings === undefined) {
        templateRunCommands.push(createTemplateRunCommand('agent-command-file', templateFileRelativePath, templateFileRelativePath))
        continue
      }
      // A setting a file gives twice, such as one hook's Unix and Windows forms, is listed once.
      const listedAgentSettingKeys = new Set<string>()
      for (const { agentSettingKind, agentSettingText } of listAgentSettingsRunSettings(parsedAgentSettings)) {
        const listedAgentSettingKey = `${agentSettingKind}\n${agentSettingText}`
        if (listedAgentSettingKeys.has(listedAgentSettingKey)) continue
        listedAgentSettingKeys.add(listedAgentSettingKey)
        templateRunCommands.push(createTemplateRunCommand(agentSettingKind, templateFileRelativePath, agentSettingText))
      }
    } else if (papelizTemplateAgentCommandFilePathPattern.test(foldedRelativePath)) {
      templateRunCommands.push(createTemplateRunCommand('agent-command-file', templateFileRelativePath, templateFileRelativePath))
    } else if (papelizTemplateScriptFileExtensions.has(getTemplateFileExtension(templateFileRelativePath)) || templateFileText?.startsWith('#!') === true) {
      templateRunCommands.push(createTemplateRunCommand('script-file', templateFileRelativePath, templateFileName))
    }
  }
  return templateRunCommands
}

// The commands a choice's files bring, for Use Template's confirmation: only those listed from files
// it keeps (`selectPapelizTemplateChosenFileRelativePaths`). A template's page shows the check
// report's full list.
export function listPapelizTemplateChosenRunCommands(
  templateRunCommands: readonly PapelizTemplateRunCommand[],
  chosenTemplateFileRelativePaths: readonly string[],
): PapelizTemplateRunCommand[] {
  const chosenFileRelativePaths = new Set(chosenTemplateFileRelativePaths)
  return templateRunCommands.filter((templateRunCommand) => chosenFileRelativePaths.has(templateRunCommand.templateRunCommandSourceRelativePath))
}

// ---------------------------------------------------------------- the license

// The MIT License's three paragraphs, as the license check compares them: lower case, one space for
// any run of white space, and straight quotes.
const papelizMitLicenseParagraphs = [
  'permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "software"), to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, and to permit persons to whom the software is furnished to do so, subject to the following conditions:',
  'the above copyright notice and this permission notice shall be included in all copies or substantial portions of the software.',
  'the software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. in no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.',
]

function normalizeLicenseText(licenseText: string): string {
  return licenseText.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
}

// Which of the three licenses a LICENSE file's text is, or null for any other text. MIT must be its
// standard text, with only its title and copyright lines before it; CC0 1.0 and CC BY 4.0 are known by
// their legal code's own title and sections, and CC BY's variants (NonCommercial, ShareAlike,
// NoDerivatives) are not CC BY.
export function detectPapelizTemplateLicenseId(licenseText: string): PapelizTemplateLicenseId | null {
  const normalizedLicenseText = normalizeLicenseText(licenseText)
  if (normalizedLicenseText.includes('cc0 1.0 universal') && normalizedLicenseText.includes('statement of purpose') && normalizedLicenseText.includes('waiver')) return 'CC0-1.0'
  const isCreativeCommonsAttributionVariant = /noncommercial|sharealike|noderivatives|non-commercial|share-alike|no-derivatives/.test(normalizedLicenseText)
  if (normalizedLicenseText.includes('creative commons attribution 4.0 international public license') && normalizedLicenseText.includes('licensed rights') && !isCreativeCommonsAttributionVariant) {
    return 'CC-BY-4.0'
  }
  let licenseTextBeforeParagraphs: string | null = null
  let remainingLicenseText = normalizedLicenseText
  for (const mitLicenseParagraph of papelizMitLicenseParagraphs) {
    const paragraphIndex = remainingLicenseText.indexOf(mitLicenseParagraph)
    if (paragraphIndex < 0) return null
    const licenseTextBetween = remainingLicenseText.slice(0, paragraphIndex).trim()
    if (licenseTextBeforeParagraphs === null) licenseTextBeforeParagraphs = licenseTextBetween
    else if (licenseTextBetween.length > 0) return null
    remainingLicenseText = remainingLicenseText.slice(paragraphIndex + mitLicenseParagraph.length)
  }
  if (remainingLicenseText.trim().length > 0) return null
  // Before the paragraphs: the title, and copyright lines with names and years.
  const isMitLicenseHeadingOnly = /^(?:#+ )?(?:the )?(?:mit license)?(?: \(mit\))? ?(?:copyright\b.{0,300})?$/.test(licenseTextBeforeParagraphs ?? '')
  return isMitLicenseHeadingOnly ? 'MIT' : null
}

// LICENSE, LICENSE.md or LICENSE.txt at the repository's root, in that order; null when there is none.
export function findPapelizTemplateLicenseFileRelativePath(templateFileList: PapelizTemplateFileList): string | null {
  const rootLicenseFileRelativePaths = templateFileList.templateFileListEntries
    .map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath)
    .filter((templateFileRelativePath) => papelizTemplateLicenseFileNamePattern.test(templateFileRelativePath))
  const licenseFileNameOrder = ['license', 'license.md', 'license.txt']
  return rootLicenseFileRelativePaths.sort((firstRelativePath, secondRelativePath) => licenseFileNameOrder.indexOf(firstRelativePath.toLowerCase()) - licenseFileNameOrder.indexOf(secondRelativePath.toLowerCase()))[0] ?? null
}

// What a first look reads before the rest of the files: the manifest and the license file.
export function listPapelizTemplateFirstLookRelativePaths(templateFileList: PapelizTemplateFileList): string[] {
  const hasManifest = templateFileList.templateFileListEntries.some((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === papelizTemplateManifestFileName)
  const licenseFileRelativePath = findPapelizTemplateLicenseFileRelativePath(templateFileList)
  return [...(hasManifest ? [papelizTemplateManifestFileName] : []), ...(licenseFileRelativePath === null ? [] : [licenseFileRelativePath])]
}

// ---------------------------------------------------------------- the checks

const papelizTemplateAllowedLicenseWords = 'CC0 1.0, CC BY 4.0 or MIT'

export async function runPapelizTemplateChecks(templateCheckInput: PapelizTemplateCheckInput): Promise<PapelizTemplateCheckReport> {
  const { templateFileList, templateFileBytesByRelativePath, expectedTemplateIncludedFileListDigest } = templateCheckInput
  const templateCheckResults: PapelizTemplateCheckResult[] = []
  const addCheckResult = (templateCheckId: PapelizTemplateCheckId, templateCheckOutcome: PapelizTemplateCheckOutcome, templateCheckSentence: string) => {
    templateCheckResults.push({ templateCheckId, templateCheckLabel: papelizTemplateCheckLabels[templateCheckId], templateCheckOutcome, templateCheckSentence })
  }

  // jsDelivr lists only commits it can read from a public repository, and GitHub's tree answers
  // without a sign-in only for one.
  addCheckResult(
    'repository-public',
    'passed',
    templateFileList.templateFileListSource === 'jsdelivr' ? 'The repository is public: jsDelivr lists this commit.' : 'The repository is public: GitHub lists this commit without a sign-in.',
  )
  const licenseFileRelativePath = findPapelizTemplateLicenseFileRelativePath(templateFileList)
  const licenseFileBytes = licenseFileRelativePath === null ? undefined : templateFileBytesByRelativePath.get(licenseFileRelativePath)
  const templateLicenseId = licenseFileBytes === undefined ? null : detectPapelizTemplateLicenseId(decodeTemplateText(licenseFileBytes) ?? '')
  if (licenseFileRelativePath === null) {
    addCheckResult('license-allowed', 'failed', `There’s no LICENSE file at the repository’s root. Add one with the text of ${papelizTemplateAllowedLicenseWords}.`)
  } else if (licenseFileBytes === undefined) {
    addCheckResult('license-allowed', 'not-checked', papelizTemplateFilesNotReadYetSentence)
  } else if (templateLicenseId === null) {
    addCheckResult(
      'license-allowed',
      'failed',
      `“${licenseFileRelativePath}” isn’t the text of ${papelizTemplateAllowedLicenseWords}, the licenses a template can have. Put one of them in it, then check again.`,
    )
  } else {
    addCheckResult('license-allowed', 'passed', `Its license is ${papelizTemplateLicenseDisplayNames[templateLicenseId]}.`)
  }

  // The manifest: without it nothing else can be checked.
  const manifestListEntry = templateFileList.templateFileListEntries.find((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === papelizTemplateManifestFileName)
  const templateManifestBytes = templateFileBytesByRelativePath.get(papelizTemplateManifestFileName)
  let templateManifestParseResult: PapelizTemplateManifestParseResult
  if (manifestListEntry === undefined) {
    templateManifestParseResult = { templateManifest: null, templateManifestProblemSentence: `There’s no ${papelizTemplateManifestFileName} at the repository’s root. Add one to make it a template.` }
  } else if (templateManifestBytes === undefined) {
    templateManifestParseResult = { templateManifest: null, templateManifestProblemSentence: `Papeliz couldn’t read ${papelizTemplateManifestFileName}.` }
  } else {
    templateManifestParseResult = parsePapelizTemplateManifest(decodeTemplateText(templateManifestBytes) ?? '')
  }
  const { templateManifest } = templateManifestParseResult
  // What's included, by the manifest's patterns, and which of it is optional; patterns too slow to
  // match fail the manifest.
  const includedFileListEntries = templateManifest === null ? null : selectPapelizTemplateIncludedFileListEntries(templateFileList, templateManifest)
  const optionalFileRelativePaths =
    templateManifest === null || includedFileListEntries === null
      ? null
      : findPapelizTemplateOptionalFileRelativePaths(
          includedFileListEntries.map((includedFileListEntry) => includedFileListEntry.templateFileRelativePath),
          templateManifest,
        )
  if (templateManifest === null || includedFileListEntries === null || optionalFileRelativePaths === null) {
    addCheckResult(
      'manifest-valid',
      'failed',
      templateManifestParseResult.templateManifestProblemSentence ??
        (includedFileListEntries === null ? papelizTemplatePathPatternsTooSlowSentence : papelizTemplateOptionalPathPatternsTooSlowSentence),
    )
    for (const notCheckedCheckId of Object.keys(papelizTemplateCheckLabels) as PapelizTemplateCheckId[]) {
      if (!templateCheckResults.some((templateCheckResult) => templateCheckResult.templateCheckId === notCheckedCheckId)) addCheckResult(notCheckedCheckId, 'not-checked', papelizTemplateEarlierCheckFailedSentence)
    }
    return {
      templateCheckResults,
      isEveryTemplateCheckPassed: false,
      templateManifest: null,
      templateLicenseId,
      templateIncludedFileRelativePaths: [],
      templateIncludedByteCount: 0,
      templateIncludedFileListDigest: null,
      templateRunCommands: [],
    }
  }
  addCheckResult('manifest-valid', 'passed', `The manifest names “${templateManifest.templateName}”.`)

  const includedRelativePaths = includedFileListEntries.map((includedFileListEntry) => includedFileListEntry.templateFileRelativePath)
  const templateIncludedByteCount = includedFileListEntries.reduce((includedByteCount, includedFileListEntry) => includedByteCount + includedFileListEntry.templateFileByteCount, 0)

  addCheckResult(
    'file-list-complete',
    templateFileList.isTemplateFileListTruncated ? 'failed' : 'passed',
    templateFileList.isTemplateFileListTruncated
      ? 'GitHub cut the repository’s file list short, so it is too large for a template.'
      : `Papeliz read the whole file list: ${countTemplateItems(templateFileList.templateFileListEntries.length, 'file')}.`,
  )

  // Size: the floor's limits on what's included, and jsDelivr's on the whole repository.
  const repositoryByteCount = templateFileList.templateFileListEntries.reduce((listedByteCount, templateFileListEntry) => listedByteCount + templateFileListEntry.templateFileByteCount, 0)
  const tooLargeIncludedPaths = includedFileListEntries
    .filter((includedFileListEntry) => includedFileListEntry.templateFileByteCount > papelizTemplateMostFileByteCount)
    .map((includedFileListEntry) => includedFileListEntry.templateFileRelativePath)
  if (repositoryByteCount > papelizJsdelivrMostRepositoryByteCount || templateFileList.templateFileListEntries.some((templateFileListEntry) => templateFileListEntry.templateFileByteCount > papelizJsdelivrMostFileByteCount)) {
    addCheckResult('file-count-and-size', 'failed', 'jsDelivr serves no repository over 150 MB or file over 20 MB, and this one is larger. Make it smaller, then check again.')
  } else if (includedFileListEntries.length > papelizTemplateMostFileCount) {
    addCheckResult('file-count-and-size', 'failed', `It includes ${includedFileListEntries.length} files, and a template can have ${papelizTemplateMostFileCount}. Leave some out with templateExcludedPaths.`)
  } else if (templateIncludedByteCount > papelizTemplateMostTotalByteCount) {
    addCheckResult('file-count-and-size', 'failed', `Its files come to ${formatTemplateByteCount(templateIncludedByteCount)}, and a template can have 10 MB in all. Leave some out with templateExcludedPaths.`)
  } else if (tooLargeIncludedPaths.length > 0) {
    addCheckResult('file-count-and-size', 'failed', `${listQuotedTemplatePaths(tooLargeIncludedPaths)} ${tooLargeIncludedPaths.length === 1 ? 'is' : 'are'} over 2 MB, the most one file can be. Make ${tooLargeIncludedPaths.length === 1 ? 'it' : 'them'} smaller or leave ${tooLargeIncludedPaths.length === 1 ? 'it' : 'them'} out.`)
  } else {
    addCheckResult('file-count-and-size', 'passed', `${countTemplateItems(includedFileListEntries.length, 'file')}, ${formatTemplateByteCount(templateIncludedByteCount)} in all.`)
  }

  // Names every system takes, and no two that differ only by case.
  const templatePathProblems: string[] = []
  for (const includedRelativePath of includedRelativePaths) {
    const templatePathProblem = findTemplatePathProblem(includedRelativePath)
    if (templatePathProblem !== null) templatePathProblems.push(`“${includedRelativePath}” ${templatePathProblem}`)
  }
  const includedRelativePathsByLowerCasePath = new Map<string, string>()
  for (const includedRelativePath of includedRelativePaths) {
    const lowerCaseRelativePath = includedRelativePath.toLowerCase()
    const sameButCaseRelativePath = includedRelativePathsByLowerCasePath.get(lowerCaseRelativePath)
    if (sameButCaseRelativePath !== undefined) templatePathProblems.push(`“${sameButCaseRelativePath}” and “${includedRelativePath}” differ only by case`)
    includedRelativePathsByLowerCasePath.set(lowerCaseRelativePath, includedRelativePath)
  }
  addCheckResult(
    'file-paths',
    templatePathProblems.length === 0 ? 'passed' : 'failed',
    templatePathProblems.length === 0
      ? `Every name works on Windows, macOS and Linux, under ${papelizTemplatePathLengthLimit} characters and ${papelizTemplateMostFolderDepth} folders deep.`
      : `${templatePathProblems.slice(0, 3).join('; ')}${templatePathProblems.length > 3 ? `, and ${templatePathProblems.length - 3} more` : ''}. Rename them, then check again.`,
  )

  // The rest reads the files themselves.
  const includedFileBytesByRelativePath = new Map<string, Uint8Array>()
  for (const includedRelativePath of includedRelativePaths) {
    const includedFileBytes = templateFileBytesByRelativePath.get(includedRelativePath)
    if (includedFileBytes !== undefined) includedFileBytesByRelativePath.set(includedRelativePath, includedFileBytes)
  }
  const isEveryIncludedFileRead = includedFileBytesByRelativePath.size === includedRelativePaths.length

  // The fingerprint, from the list's hashes, or from the bytes when the list has none.
  const includedSha256Base64ByRelativePath = new Map<string, string>()
  for (const includedFileListEntry of includedFileListEntries) {
    const includedFileBytes = includedFileBytesByRelativePath.get(includedFileListEntry.templateFileRelativePath)
    const includedSha256Base64 =
      includedFileListEntry.templateFileSha256Base64 ?? (includedFileBytes === undefined ? null : await computePapelizTemplateFileSha256Base64(includedFileBytes))
    if (includedSha256Base64 !== null) includedSha256Base64ByRelativePath.set(includedFileListEntry.templateFileRelativePath, includedSha256Base64)
  }
  const templateIncludedFileListDigest =
    includedSha256Base64ByRelativePath.size === includedFileListEntries.length ? await computePapelizTemplateIncludedFileListDigest(includedSha256Base64ByRelativePath) : null

  const hasListLevelFailure = templateCheckResults.some((templateCheckResult) => templateCheckResult.templateCheckOutcome === 'failed')
  // Each check on the files: what it finds wrong (null for nothing), and what it says when it passes.
  const describeFileCheck = (templateCheckId: PapelizTemplateCheckId, findFileProblems: () => Promise<string | null> | string | null, passedSentence: string) => ({
    templateCheckId,
    findFileProblems,
    passedSentence,
  })
  const fileChecks = [
    describeFileCheck(
      'file-types',
      () => {
        const fileTypeProblems = [...includedFileBytesByRelativePath].flatMap(([includedRelativePath, includedFileBytes]) => {
          const fileTypeProblem = findTemplateFileTypeProblem(includedRelativePath, includedFileBytes)
          return fileTypeProblem === null ? [] : [`“${includedRelativePath}” ${fileTypeProblem}`]
        })
        if (fileTypeProblems.length === 0) return null
        return `${fileTypeProblems.slice(0, 3).join('; ')}${fileTypeProblems.length > 3 ? `, and ${fileTypeProblems.length - 3} more` : ''}. A template holds only text and PNG, JPEG or WebP pictures.`
      },
      'Every file is text or a PNG, JPEG or WebP picture.',
    ),
    describeFileCheck(
      'no-git-lfs-pointers',
      () => {
        const lfsPointerPaths = [...includedFileBytesByRelativePath]
          .filter(([, includedFileBytes]) => decodeTemplateText(includedFileBytes.subarray(0, papelizGitLfsPointerStart.length))?.startsWith(papelizGitLfsPointerStart) === true)
          .map(([includedRelativePath]) => includedRelativePath)
        if (lfsPointerPaths.length === 0) return null
        return `${listQuotedTemplatePaths(lfsPointerPaths)} ${lfsPointerPaths.length === 1 ? 'is a Git LFS pointer' : 'are Git LFS pointers'}, not the file itself. Store ${lfsPointerPaths.length === 1 ? 'it' : 'them'} in Git without LFS.`
      },
      'No Git LFS pointers.',
    ),
    describeFileCheck(
      'file-hashes',
      async () => {
        const changedPaths: string[] = []
        for (const includedFileListEntry of includedFileListEntries) {
          const includedFileBytes = includedFileBytesByRelativePath.get(includedFileListEntry.templateFileRelativePath)
          if (includedFileBytes === undefined) continue
          const isSizeSame = includedFileBytes.length === includedFileListEntry.templateFileByteCount
          const isSha256Same =
            includedFileListEntry.templateFileSha256Base64 === null || (await computePapelizTemplateFileSha256Base64(includedFileBytes)) === includedFileListEntry.templateFileSha256Base64
          const isGitBlobSame =
            includedFileListEntry.templateFileGitBlobSha1Hex === null || (await computePapelizTemplateFileGitBlobSha1Hex(includedFileBytes)) === includedFileListEntry.templateFileGitBlobSha1Hex
          if (!isSizeSame || !isSha256Same || !isGitBlobSame) changedPaths.push(includedFileListEntry.templateFileRelativePath)
        }
        if (changedPaths.length === 0) return null
        return `${listQuotedTemplatePaths(changedPaths)} didn’t match the file list at this commit. Try again later.`
      },
      'Every file matches the file list at this commit.',
    ),
    describeFileCheck(
      'included-file-list-digest',
      () => {
        if (templateIncludedFileListDigest === null) return 'Papeliz couldn’t work out the files’ fingerprint. Try again later.'
        if (expectedTemplateIncludedFileListDigest !== null && templateIncludedFileListDigest !== expectedTemplateIncludedFileListDigest) {
          return 'These files aren’t the ones Papeliz checked at this commit. Try again later.'
        }
        return null
      },
      expectedTemplateIncludedFileListDigest === null ? 'The files’ fingerprint is recorded with this commit.' : 'The files are the ones Papeliz checked at this commit.',
    ),
    describeFileCheck(
      'notes-safe',
      () => {
        const noteProblems = [...includedFileBytesByRelativePath].flatMap(([includedRelativePath, includedFileBytes]) => {
          if (!isTemplateNoteRelativePath(includedRelativePath)) return []
          const dangerousNoteMarkup = findDangerousNoteMarkup(decodeTemplateText(includedFileBytes) ?? '')
          return dangerousNoteMarkup === null ? [] : [`“${includedRelativePath}” has ${dangerousNoteMarkup}`]
        })
        if (noteProblems.length === 0) return null
        return `${noteProblems.slice(0, 3).join('; ')}${noteProblems.length > 3 ? `, and ${noteProblems.length - 3} more` : ''}. Notes in a template can’t hold scripts, frames, forms or script links; take them out.`
      },
      'No note holds a script, frame, form or script link.',
    ),
    describeFileCheck(
      'json-files-parse',
      () => {
        const brokenJsonPaths = [...includedFileBytesByRelativePath]
          .filter(([includedRelativePath, includedFileBytes]) => {
            if (getTemplateFileExtension(includedRelativePath) !== 'json') return false
            try {
              JSON.parse((decodeTemplateText(includedFileBytes) ?? '\0').replace(/^\uFEFF/, ''))
              return false
            } catch {
              return true
            }
          })
          .map(([includedRelativePath]) => includedRelativePath)
        if (brokenJsonPaths.length === 0) return null
        return `${listQuotedTemplatePaths(brokenJsonPaths)} ${brokenJsonPaths.length === 1 ? 'isn’t' : 'aren’t'} valid JSON. Fix ${brokenJsonPaths.length === 1 ? 'it' : 'them'}, then check again.`
      },
      'Every JSON file reads.',
    ),
  ] as const
  for (const fileCheck of fileChecks) {
    if (hasListLevelFailure) {
      addCheckResult(fileCheck.templateCheckId, 'not-checked', papelizTemplateEarlierCheckFailedSentence)
      continue
    }
    if (!isEveryIncludedFileRead) {
      addCheckResult(fileCheck.templateCheckId, 'not-checked', papelizTemplateFilesNotReadYetSentence)
      continue
    }
    const fileProblemSentence = await fileCheck.findFileProblems()
    addCheckResult(fileCheck.templateCheckId, fileProblemSentence === null ? 'passed' : 'failed', fileProblemSentence ?? fileCheck.passedSentence)
  }

  const isFirstNoteIncluded = includedRelativePaths.includes(templateManifest.templateFirstNotePath)
  addCheckResult(
    'first-note-present',
    isFirstNoteIncluded ? 'passed' : 'failed',
    isFirstNoteIncluded
      ? `“${templateManifest.templateFirstNotePath}” opens first.`
      : `The first note, “${templateManifest.templateFirstNotePath}”, isn’t among the included files. Add it, or change templateFirstNotePath.`,
  )

  return {
    templateCheckResults,
    isEveryTemplateCheckPassed: templateCheckResults.every((templateCheckResult) => templateCheckResult.templateCheckOutcome === 'passed'),
    templateManifest,
    templateLicenseId,
    templateIncludedFileRelativePaths: includedRelativePaths,
    templateIncludedByteCount,
    templateIncludedFileListDigest,
    templateRunCommands: isEveryIncludedFileRead ? listPapelizTemplateRunCommands(includedFileBytesByRelativePath) : [],
  }
}

// True while no check has failed: what a first look, with only the manifest read, needs before the
// rest of the files are read.
export function hasNoFailedPapelizTemplateCheck(templateCheckReport: PapelizTemplateCheckReport): boolean {
  return templateCheckReport.templateCheckResults.every((templateCheckResult) => templateCheckResult.templateCheckOutcome !== 'failed')
}
