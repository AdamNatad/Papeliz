import type { PapelizVaultEncryptionKind } from '../vault/papeliz-vault-encryption'

// The words the screens for a vault's encryption share: New Vault's Encryption part, Unlock, the
// status bar's lock, Settings › Vault › Encryption and its change steps, and the AI Assistant's line.
// Why something failed comes from the vault encryption module itself, never from here.

export const papelizVaultEncryptionKindDisplayNames: Record<PapelizVaultEncryptionKind, string> = {
  standard: 'Standard',
  'end-to-end': 'End-to-end',
}

// One line under each kind, at New Vault and on the Encryption card.
export const papelizVaultEncryptionKindLines: Record<PapelizVaultEncryptionKind, string> = {
  standard: 'Plain Markdown files any app can open.',
  'end-to-end': 'Encrypted with a passphrase only you know.',
}

export const papelizNewEndToEndVaultPassphraseFieldLabel = 'Vault passphrase'

// Under a new passphrase: there's no way back without it.
export const papelizEndToEndVaultPassphraseNotRecoverableLine =
  'Keep your passphrase safe, as neither Papeliz nor any third party can reset or recover it. If you lose or forget it, your encrypted data may become permanently inaccessible. Your passphrase works exclusively across Papeliz Apps.'

// New Vault's "Sync This Vault": a Standard vault uploads encrypted with a key Papeliz keeps; Sync
// doesn't carry an End-to-end vault yet.
export const papelizNewStandardVaultSyncThisVaultLine = 'Uploads encrypted with a key Papeliz keeps, so it could read them too.'
export const papelizNewEndToEndVaultNotSyncedYetLine = 'Sync doesn’t carry End-to-end vaults yet. Pick Standard to sync this one.'

// The badge on an End-to-end vault's row, and on Unlock.
export const papelizEndToEndVaultBadgeWords = 'End-to-End Encryption'
export const papelizRememberedEndToEndVaultChipWords = 'Remembered'
export const papelizRememberedEndToEndVaultChipTooltipText = 'This device opens it without the passphrase.'

// Remember on This Device, and what it means where the key is kept.
export const papelizRememberEndToEndVaultSwitchLabel = 'Remember on This Device'
export const papelizRememberEndToEndVaultInBrowserLine =
  'This browser then opens it without the passphrase, for anyone who uses it. The files stay encrypted to other apps.'
export const papelizRememberEndToEndVaultInWindowsLine =
  'Kept in Windows Credential Manager: it opens without the passphrase while you’re signed in to Windows.'

// Unlock's lines.
export const papelizEndToEndVaultForgottenPassphraseLine =
  'Forgot it? Papeliz can’t recover it. A device that remembers this vault still opens it, so you can copy your notes out there.'
export const papelizEndToEndVaultFoundByOpenVaultLine = 'This folder is a Papeliz vault, encrypted End-to-end. Enter its passphrase to open it.'
export const papelizEndToEndVaultWrongPassphraseHintLine = 'Check Caps Lock and the keyboard’s language. Every try takes about a second.'

export function describePapelizEndToEndVaultLockedLine(papelizVaultDisplayName: string): string {
  return `${papelizVaultDisplayName} is locked. Every note was saved, then cleared from memory with the key.`
}

// The status bar's lock pill and Lock Now.
export const papelizEndToEndVaultLockPillWords = 'End-to-end'
export const papelizEndToEndVaultLockPillTooltipText = 'This vault is End-to-end and unlocked. Its notes are decrypted in Papeliz’s memory only.'
export const papelizLockEndToEndVaultNowLabel = 'Lock Now'
export const papelizLockEndToEndVaultNowTooltipText = 'Save every note, close the vault and clear it from memory with its key'

// Settings › Vault › Encryption.
export function describePapelizEndToEndVaultCardLine(vaultFileCount: number | null): string {
  return vaultFileCount === null ? 'Encrypted with your passphrase.' : `Encrypted with your passphrase. ${formatPapelizVaultFileCount(vaultFileCount)}.`
}

export function formatPapelizVaultFileCount(vaultFileCount: number): string {
  return `${vaultFileCount.toLocaleString('en-US')} ${vaultFileCount === 1 ? 'file' : 'files'}`
}

// The same on a button: "Encrypt 3,210 Files".
export function formatPapelizVaultFileCountTitle(vaultFileCount: number): string {
  return `${vaultFileCount.toLocaleString('en-US')} ${vaultFileCount === 1 ? 'File' : 'Files'}`
}

// Changing to End-to-end: copies made before can't be reached.
export const papelizEarlierPlainCopiesStayReadableLine =
  'Copies made before stay readable: backups, Git history and a cloud drive’s old versions. Papeliz can’t reach those.'
// Changing to Standard.
export const papelizStandardVaultReadableByOtherAppsLine =
  'Anything that can read this folder (other apps, a cloud drive, Git) will see the notes. The key remembered on this device is dropped.'
export const papelizBrowserStandardVaultReadableLine =
  'Anything that can read this browser’s storage will see the notes. The key remembered on this device is dropped.'
export const papelizVaultEncryptionChangeKeepOpenLine =
  'Keep Papeliz open. The vault stays closed until this is done. If Papeliz closes, it carries on from here the next time the vault opens.'
export const papelizVaultEncryptionChangeEachFileLine = 'Each file: encrypted copy written, checked by reading it back, then the plain file removed.'

// The AI Assistant's line, in an End-to-end vault.
export const papelizEndToEndVaultAssistantLine =
  'End-to-end covers this vault’s files, not what you send: the notes the Assistant reads go decrypted to the provider you chose.'
