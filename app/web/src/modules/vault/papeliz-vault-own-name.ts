import type { PapelizVaultAdapter } from './papeliz-vault-adapter'
import { readPapelizVaultEncryptionSettingsFile } from './papeliz-vault-encryption-settings-file'

// A folder vault's own name (a folder opened in the browser, or in Papeliz for Windows), kept in the
// vault so every device and app that opens it shows the same name, while the folder on disk keeps its
// own. It is `.papeliz/vault-name.json`, read and written through the vault's adapter: plain in a
// Standard vault, and sealed with the rest of an End-to-end vault's files by its adapter, so it reads
// only once the vault is unlocked. A change of kind carries it as it carries the vault's other files.
// A vault with no name saved takes its folder's name. A browser vault keeps its name in
// `.papeliz/browser-vault.json` instead (papeliz-browser-vaults.ts), and never reads this one.
//
//   { "papelizVaultName": "Field Notes" }

export const papelizVaultOwnNameSettingsFileName = 'vault-name.json'

interface PapelizVaultOwnNameSettingsFile {
  papelizVaultName: string
}

export const papelizVaultOwnNameLongestLength = 200

// What is wrong with a name for a folder vault, as a code ("Name Empty", "Has A Blocked Character",
// "Name Too Long"), or null. Only Papeliz shows it, so a character a folder can't use is fine: the
// folder keeps its own name, and exports make their file names safe themselves. A control character
// (a tab, a line break) shows as nothing, so it is refused.
export function findPapelizVaultOwnNameProblem(typedVaultOwnName: string): string | null {
  const trimmedVaultOwnName = typedVaultOwnName.trim()
  if (trimmedVaultOwnName.length === 0) return 'Name Empty'
  if ([...trimmedVaultOwnName].some((vaultOwnNameCharacter) => isControlCharacter(vaultOwnNameCharacter))) return 'Has A Blocked Character'
  if (trimmedVaultOwnName.length > papelizVaultOwnNameLongestLength) return 'Name Too Long'
  return null
}

function isControlCharacter(vaultOwnNameCharacter: string): boolean {
  const characterCode = vaultOwnNameCharacter.charCodeAt(0)
  return characterCode < 0x20 || characterCode === 0x7f
}

// The name saved in the vault, or null when none is, or the file can't be read or holds no usable name.
export async function readPapelizVaultOwnName(papelizVaultAdapter: PapelizVaultAdapter): Promise<string | null> {
  try {
    const vaultOwnNameSettingsFileText = await papelizVaultAdapter.readPapelizVaultSettingsFile(papelizVaultOwnNameSettingsFileName)
    if (vaultOwnNameSettingsFileText === null) return null
    const parsedVaultOwnNameSettingsFile = JSON.parse(vaultOwnNameSettingsFileText) as Partial<PapelizVaultOwnNameSettingsFile> | null
    if (typeof parsedVaultOwnNameSettingsFile?.papelizVaultName !== 'string') return null
    const savedVaultOwnName = parsedVaultOwnNameSettingsFile.papelizVaultName.trim()
    return findPapelizVaultOwnNameProblem(savedVaultOwnName) === null ? savedVaultOwnName : null
  } catch {
    return null
  }
}

export async function writePapelizVaultOwnName(papelizVaultAdapter: PapelizVaultAdapter, papelizVaultOwnName: string): Promise<void> {
  const vaultOwnNameSettingsFile: PapelizVaultOwnNameSettingsFile = { papelizVaultName: papelizVaultOwnName.trim() }
  await papelizVaultAdapter.writePapelizVaultSettingsFile(papelizVaultOwnNameSettingsFileName, `${JSON.stringify(vaultOwnNameSettingsFile, null, 2)}\n`)
}

// A folder vault's name as it opens, before any unlock.
export type PapelizFolderVaultOwnNameRead =
  | { folderVaultOwnNameReadOutcome: 'saved'; papelizVaultOwnName: string }
  // No name saved: the vault takes its folder's name.
  | { folderVaultOwnNameReadOutcome: 'none' }
  // An End-to-end vault, or one whose encryption settings can't be read: its name is sealed until it
  // is unlocked, so the device shows the name it last saw.
  | { folderVaultOwnNameReadOutcome: 'sealed' }

export async function readPapelizFolderVaultOwnNameBeforeUnlock(storedVaultAdapter: PapelizVaultAdapter): Promise<PapelizFolderVaultOwnNameRead> {
  const vaultEncryptionSettingsReadResult = await readPapelizVaultEncryptionSettingsFile(storedVaultAdapter).catch(() => null)
  if (
    vaultEncryptionSettingsReadResult === null ||
    vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'failed' ||
    (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'read' &&
      vaultEncryptionSettingsReadResult.vaultEncryptionSettings.papelizVaultEncryptionKind === 'end-to-end')
  ) {
    return { folderVaultOwnNameReadOutcome: 'sealed' }
  }
  const papelizVaultOwnName = await readPapelizVaultOwnName(storedVaultAdapter)
  return papelizVaultOwnName === null ? { folderVaultOwnNameReadOutcome: 'none' } : { folderVaultOwnNameReadOutcome: 'saved', papelizVaultOwnName }
}

// The name a folder vault shows as it opens: its own; while sealed, the one this device last saw;
// otherwise its folder's.
export function choosePapelizFolderVaultDisplayName(
  folderVaultOwnNameRead: PapelizFolderVaultOwnNameRead,
  vaultFolderName: string,
  lastSeenVaultDisplayName: string | undefined,
): string {
  if (folderVaultOwnNameRead.folderVaultOwnNameReadOutcome === 'saved') return folderVaultOwnNameRead.papelizVaultOwnName
  if (folderVaultOwnNameRead.folderVaultOwnNameReadOutcome === 'sealed') return lastSeenVaultDisplayName ?? vaultFolderName
  return vaultFolderName
}
