// Vault-relative paths always use "/" and never start or end with one: "Ideas/Offline-first apps.md".
// The vault root folder is the empty string.

export const papelizVaultRootFolderRelativePath = ''
export const papelizVaultTrashFolderName = '.trash'
// Papeliz's own files for a vault (the file list's order, say) live in this folder inside it.
export const papelizVaultSettingsFolderName = '.papeliz'
// The AI Assistant's saved chats live in this hidden folder of Papeliz's own, out of the file list
// unless Show Hidden is on, as `.trash` is. Sessions in the AI Assistant opens and deletes them.
export const papelizVaultChatSessionFolderName = '.csessions'
// Where Papeliz kept saved chats before `.csessions`. Papeliz may still move chats out of it into
// `.csessions` (papeliz-assistant-chat-session-folder-move.ts).
export const papelizVaultEarlierChatSessionFolderName = '.chatsession'
// Papeliz's own hidden folders, the only ones it writes in.
const papelizVaultOwnHiddenFolderNames: readonly string[] = [papelizVaultChatSessionFolderName, papelizVaultEarlierChatSessionFolderName]
const papelizVaultSettingsFileNamePattern = /^[a-z0-9][a-z0-9-]*\.json$/

// A file of Papeliz's own in `.papeliz/`: a plain lower-case JSON file name, never a path.
export function isPapelizVaultSettingsFileName(papelizVaultSettingsFileName: string): boolean {
  return papelizVaultSettingsFileNamePattern.test(papelizVaultSettingsFileName)
}
export const papelizVaultNoteFileExtension = '.md'

export function splitVaultRelativePath(vaultEntryRelativePath: string): string[] {
  return vaultEntryRelativePath.split('/').filter((vaultPathSegment) => vaultPathSegment.length > 0)
}

export function joinVaultRelativePath(vaultFolderRelativePath: string, vaultEntryName: string): string {
  return vaultFolderRelativePath === papelizVaultRootFolderRelativePath
    ? vaultEntryName
    : `${vaultFolderRelativePath}/${vaultEntryName}`
}

export function getVaultEntryName(vaultEntryRelativePath: string): string {
  const vaultPathSegments = splitVaultRelativePath(vaultEntryRelativePath)
  return vaultPathSegments[vaultPathSegments.length - 1] ?? ''
}

export function getVaultEntryParentFolderRelativePath(vaultEntryRelativePath: string): string {
  const vaultPathSegments = splitVaultRelativePath(vaultEntryRelativePath)
  return vaultPathSegments.slice(0, -1).join('/')
}

export function isVaultNoteFileName(vaultEntryName: string): boolean {
  return vaultEntryName.toLowerCase().endsWith(papelizVaultNoteFileExtension)
}

// "Ideas/Offline-first apps.md" -> "Offline-first apps"
export function getVaultNoteTitle(vaultNoteRelativePath: string): string {
  const vaultNoteFileName = getVaultEntryName(vaultNoteRelativePath)
  return isVaultNoteFileName(vaultNoteFileName)
    ? vaultNoteFileName.slice(0, -papelizVaultNoteFileExtension.length)
    : vaultNoteFileName
}

export function isVaultRelativePathInsideFolder(vaultEntryRelativePath: string, vaultFolderRelativePath: string): boolean {
  if (vaultFolderRelativePath === papelizVaultRootFolderRelativePath) return true
  return vaultEntryRelativePath === vaultFolderRelativePath || vaultEntryRelativePath.startsWith(`${vaultFolderRelativePath}/`)
}

// Moves a path from one folder prefix to another; paths outside the prefix come back unchanged.
export function replaceVaultRelativePathPrefix(
  vaultEntryRelativePath: string,
  fromVaultEntryRelativePath: string,
  toVaultEntryRelativePath: string,
): string {
  if (vaultEntryRelativePath === fromVaultEntryRelativePath) return toVaultEntryRelativePath
  if (vaultEntryRelativePath.startsWith(`${fromVaultEntryRelativePath}/`)) {
    return toVaultEntryRelativePath + vaultEntryRelativePath.slice(fromVaultEntryRelativePath.length)
  }
  return vaultEntryRelativePath
}

// A hidden entry: it, or a folder it is in, has a name that starts with a dot (`.git`, `.trash`).
export function isVaultRelativePathHidden(vaultEntryRelativePath: string): boolean {
  return splitVaultRelativePath(vaultEntryRelativePath).some((vaultPathSegment) => vaultPathSegment.startsWith('.'))
}

// Papeliz writes only to the user's own notes and folders, and to its own `.csessions/` folder (and
// the earlier `.chatsession/`, to move chats out of it):
// never inside another hidden folder such as `.git/` or another app's settings folder. The vault's
// `.trash/` folder is written only by the move-to-trash step, and `.papeliz/` only through the
// adapters' own settings-file methods.
export function isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath: string): boolean {
  const vaultPathSegments = splitVaultRelativePath(vaultEntryRelativePath)
  if (vaultPathSegments.length === 0) return false
  const checkedVaultPathSegments = papelizVaultOwnHiddenFolderNames.includes(vaultPathSegments[0] ?? '') ? vaultPathSegments.slice(1) : vaultPathSegments
  return checkedVaultPathSegments.every((vaultPathSegment) => !vaultPathSegment.startsWith('.'))
}

// A browser vault's own file in `.papeliz/`, with its name in this browser (papeliz-browser-vaults.ts).
export const papelizBrowserVaultSettingsFileName = 'browser-vault.json'
// Papeliz's own hidden folders at the vault's top that Papeliz Sync carries: its settings and its
// saved chats. The earlier `.chatsession/` doesn't sync.
export const papelizVaultSyncedHiddenFolderNames: readonly string[] = [papelizVaultSettingsFolderName, papelizVaultChatSessionFolderName]

// A file Papeliz Sync reads and writes: any file outside hidden folders, or one inside `.papeliz/` or
// `.csessions/` at the vault's top. Never `.trash/`, `.git/`, another hidden folder or a hidden file,
// and never a browser vault's `.papeliz/browser-vault.json`, which names it in one browser only:
// two browser vaults syncing would otherwise take each other's names.
export function isVaultFileRelativePathSyncable(vaultFileRelativePath: string): boolean {
  const vaultPathSegments = splitVaultRelativePath(vaultFileRelativePath)
  if (vaultPathSegments.length === 0) return false
  if (vaultPathSegments.join('/') === `${papelizVaultSettingsFolderName}/${papelizBrowserVaultSettingsFileName}`) return false
  return vaultPathSegments.every(
    (vaultPathSegment, vaultPathSegmentIndex) =>
      !vaultPathSegment.startsWith('.') ||
      (vaultPathSegmentIndex === 0 && vaultPathSegments.length > 1 && papelizVaultSyncedHiddenFolderNames.includes(vaultPathSegment)),
  )
}

// Characters that Windows, macOS or Linux refuse in a file name, plus the "/" that separates folders.
const papelizVaultEntryNameForbiddenCharacters = /[\\/:*?"<>|]/

// Returns what is wrong with a note or folder name as a short Title Case tag ("Name Too Long", for an
// error toast's brackets), or null when it is fine.
export function describeVaultEntryNameProblem(vaultEntryName: string): string | null {
  const trimmedVaultEntryName = vaultEntryName.trim()
  if (trimmedVaultEntryName.length === 0) return 'Name Empty'
  if (trimmedVaultEntryName.startsWith('.')) return 'Starts With A Dot'
  // One of \ / : * ? " < > |
  if (papelizVaultEntryNameForbiddenCharacters.test(trimmedVaultEntryName)) return 'Has A Blocked Character'
  if (trimmedVaultEntryName.endsWith('.')) return 'Ends With A Dot'
  if (trimmedVaultEntryName.length > 200) return 'Name Too Long'
  return null
}

// Picks "Untitled.md", then "Untitled 2.md", "Untitled 3.md", ... until the name is free.
export function pickFreeVaultEntryName(
  preferredVaultEntryBaseName: string,
  vaultEntryExtension: string,
  isVaultEntryNameTaken: (candidateVaultEntryName: string) => boolean,
): string {
  for (let candidateNumber = 1; ; candidateNumber += 1) {
    const candidateVaultEntryName =
      candidateNumber === 1
        ? `${preferredVaultEntryBaseName}${vaultEntryExtension}`
        : `${preferredVaultEntryBaseName} ${candidateNumber}${vaultEntryExtension}`
    if (!isVaultEntryNameTaken(candidateVaultEntryName)) return candidateVaultEntryName
  }
}
