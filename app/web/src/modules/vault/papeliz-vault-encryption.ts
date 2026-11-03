import { PapelizEndToEndEncryptingVaultAdapter } from './papeliz-end-to-end-vault-adapter'
import type { PapelizExistingVaultOpenResult, PapelizOpenVault, PapelizOpenVaultResult } from './papeliz-open-vault'
import { PapelizVaultOperationError, type PapelizVaultAdapter } from './papeliz-vault-adapter'
import { isPapelizVaultEncryptionKeyRemembered } from './papeliz-vault-encryption-device-store'
import * as papelizVaultEncryptionKindChange from './papeliz-vault-encryption-kind-change'
import * as papelizVaultEncryptionOperations from './papeliz-vault-encryption-operations'
import { readPapelizVaultAdapterBehindPlainWriteRefusal, hasPapelizVaultStoredFileAccess } from './papeliz-vault-encryption-stored-files'
import { PapelizUnlockedVaultEncryptionKeyHolder } from './papeliz-vault-encryption-unlocked-key'
import type { PapelizVaultImportFile, PapelizVaultImportOptions } from './papeliz-vault-folder-import'
import { papelizVaultRootFolderRelativePath } from './papeliz-vault-relative-paths'
import {
  describePapelizVaultEncryptionFailureCode as describeVaultEncryptionFailureCodeSentence,
  describePapelizWrongVaultPassphrase as describeWrongVaultPassphraseSentence,
} from './papeliz-vault-encryption-words'

// A vault's encryption: Standard or End-to-end, chosen at New Vault in every build and changed later
// in Settings › Vault › Encryption. This file is what the screens and Papeliz for Windows build
// against; the work is done in the `papeliz-vault-encryption-*.ts` files and
// papeliz-end-to-end-vault-adapter.ts beside it.
//
// - Standard: the vault's files are plain Markdown and files, as they always were.
// - End-to-end: every file is encrypted on the device with the vault's own random 32-byte key. The key
//   is wrapped by the vault's passphrase (Argon2id, then AES-256-GCM) and kept, wrapped, in
//   `.papeliz/vault-encryption.json`. There is no recovery: a forgotten passphrase loses the vault,
//   unless this device remembers its key.
//
// An End-to-end vault on disk, or in Browser Storage:
//
//   papeliz-encrypted-files/      one randomly named file per note, file or empty folder, each
//                                 carrying its own sealed vault path (Papeliz Sync's file format)
//   .papeliz/vault-encryption.json   the kind, the passphrase key's settings, the wrapped key and the
//                                 format version; the only plain file in `.papeliz/`
//   About this Papeliz vault.txt  plain words saying what the folder is
//
// Opening one never hands out its files: papeliz-open-vault.ts reports it as 'needs-unlock', with a
// `PapelizLockedEndToEndVault`, and unlocking gives back a `PapelizOpenVault` whose adapter encrypts
// every read and write. Nothing decrypted is ever written to disk: notes, names, search's index,
// links and pictures live in memory until the vault is locked or closed.

export type PapelizVaultEncryptionKind = 'standard' | 'end-to-end'

// Where the encryption's own files sit in the vault's folder, and the passphrase's least length: 12
// characters or more, counted after Unicode NFC, with nothing trimmed (as Sync's passphrase).
export { papelizVaultEncryptionSettingsFileName } from './papeliz-vault-encryption-settings-file'
export { papelizEncryptedVaultAboutFileName, papelizEncryptedVaultFilesFolderName } from './papeliz-vault-encryption-format'
export { papelizVaultPassphraseMinimumCharacterCount } from './papeliz-vault-encryption-passphrase-key'

// What a `.papeliz/vault-encryption.json` says, read before anything is unlocked. A vault without the
// file is Standard.
export interface PapelizVaultEncryptionState {
  vaultEncryptionKind: PapelizVaultEncryptionKind
  // The End-to-end vault's own ID (`pzvault_<26 base32 characters>`), which its keys are bound to and
  // a remembered key is kept under. Null for a Standard vault.
  papelizEncryptedVaultId: string | null
  // A change of kind that stopped part-way (the app closed, the disk filled): it carries on, from where
  // it stopped, with finishPapelizVaultEncryptionKindChange once the vault is unlocked.
  unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null
}

export type PapelizVaultEncryptionKindChangeDirection = 'to-end-to-end' | 'to-standard'

// Failures ------------------------------------------------------------------------------------------------
// Every failure is one of these codes, or a vault code from papeliz-vault-adapter.ts ("Disk Full",
// "No Permission", ...). The screens show describePapelizVaultEncryptionFailure's sentence and never
// write their own.

export type PapelizVaultEncryptionFailureCode =
  // The passphrase typed for a new vault, a change to End-to-end or Change Passphrase is under 12
  // characters.
  | 'Passphrase Too Short'
  // The two passphrases typed don't match.
  | 'Passphrases Differ'
  // `.papeliz/vault-encryption.json` can't be read as the format says.
  | 'Encryption Settings Damaged'
  // The vault was made or changed by a newer Papeliz, with a format this version doesn't know.
  | 'Made By Newer Papeliz'
  // A file in `papeliz-encrypted-files/` doesn't open with the vault's key: changed, cut short or put
  // there by hand.
  | 'Encrypted File Damaged'
  // This device remembered a key that no longer opens the vault (its key changed elsewhere). The
  // remembered key is forgotten; the passphrase opens the vault.
  | 'Remembered Key Wrong'
  // Remember on This Device isn't possible here: the browser keeps no storage (a private window), or
  // the key store refused.
  | 'Remember Not Available'
  // The vault was locked (Lock Now, closed) while something still used it.
  | 'Vault Locked'
  // New Vault's End-to-end needs an empty vault; a vault with notes changes kind instead.
  | 'Vault Not Empty'
  // The vault is already the kind asked for.
  | 'Already End-to-end'
  | 'Already Standard'
  // This kind of vault can't be encrypted (the sample vault).
  | 'Encryption Not Supported'
  // Something tried to write a plain note or file into an End-to-end vault's folder.
  | 'Plain Write Refused'
  // A change of kind stopped part-way. What was changed stays changed; it carries on next time.
  | 'Kind Change Stopped'

// The sentence for a vault encryption failure code ("That passphrase doesn’t open My Notes." is
// `papelizWrongVaultPassphraseSentence`), or null when the code isn't one of these, so the general
// failure words (papeliz-failure-code-words.ts) take it.
export function describePapelizVaultEncryptionFailureCode(vaultEncryptionFailureCode: string): string | null {
  return describeVaultEncryptionFailureCodeSentence(vaultEncryptionFailureCode)
}

// What Unlock shows for a wrong passphrase. There is no lockout: the second each try takes is what
// slows guessing.
export function describePapelizWrongVaultPassphrase(papelizVaultDisplayName: string): string {
  return describeWrongVaultPassphraseSentence(papelizVaultDisplayName)
}

// Reading the kind ---------------------------------------------------------------------------------------

export type PapelizVaultEncryptionStateReadResult =
  | { vaultEncryptionStateReadOutcome: 'read'; papelizVaultEncryptionState: PapelizVaultEncryptionState }
  | { vaultEncryptionStateReadOutcome: 'failed'; vaultEncryptionFailureCode: string }

// The kind of the vault this adapter reaches, from its `.papeliz/vault-encryption.json`.
export function readPapelizVaultEncryptionState(storedVaultAdapter: PapelizVaultAdapter): Promise<PapelizVaultEncryptionStateReadResult> {
  return papelizVaultEncryptionOperations.readPapelizVaultEncryptionState(storedVaultAdapter)
}

// Whether the encryption can be used on this adapter's vault at all: a folder on disk, a folder in
// Papeliz for Windows or a browser vault can; the sample vault can't.
export function canPapelizVaultAdapterBeEndToEnd(storedVaultAdapter: PapelizVaultAdapter): boolean {
  return papelizVaultEncryptionOperations.canPapelizVaultAdapterBeEndToEnd(storedVaultAdapter)
}

// Locked and unlocked vaults -------------------------------------------------------------------------

// An End-to-end vault that was opened (papeliz-open-vault.ts's 'needs-unlock', or reopened from Recent
// Vaults) and waits for its passphrase or its remembered key. It holds the vault's own adapter, which
// refuses every plain write ('Plain Write Refused'); nothing from it reaches the workspace until
// unlocked.
export interface PapelizLockedEndToEndVault {
  papelizVaultId: string
  papelizVaultDisplayName: string
  papelizEncryptedVaultId: string
  unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null
  lockedStoredVaultAdapter: PapelizVaultAdapter
}

// The adapter of an unlocked End-to-end vault, as the workspace gets it in `PapelizOpenVault`. Every
// method of `PapelizVaultAdapter` works as it does for a Standard vault, on decrypted paths and
// contents; underneath, every note, file, folder, attachment, rename, copy, trash move, import and
// `.papeliz/` file is an encrypted file in `papeliz-encrypted-files/`. It has no Papeliz Sync whole-file
// access yet, so Sync doesn't carry an End-to-end vault in this version.
export interface PapelizEndToEndVaultAdapter extends PapelizVaultAdapter {
  readonly papelizVaultEncryptionKind: 'end-to-end'
  readonly papelizEncryptedVaultId: string
  readonly unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null
  isEndToEndVaultLocked(): boolean
  // Lock Now: drops the key, the decrypted names and every object URL below. Every call after it fails
  // with 'Vault Locked'. Saving the open notes first is the workspace's. Close Vault
  // (`closeVaultAdapter`) locks too.
  lockEndToEndVault(): void
  // A `blob:` URL for a file's decrypted bytes, for MD View's pictures, video and PDFs: kept in memory,
  // never written to disk, and revoked when the vault locks. Fails as `readVaultAttachmentFileBlob`
  // does for a file that isn't there.
  createDecryptedVaultFileObjectUrl(vaultFileRelativePath: string): Promise<string>
  // Called once when the vault locks, from Lock Now, Close Vault or a change of kind. Gives back a
  // function that stops listening.
  listenForEndToEndVaultLock(onEndToEndVaultLocked: () => void): () => void
}

// What opening an existing vault does once its folder or browser vault is reached: a vault whose
// `.papeliz/vault-encryption.json` says End-to-end comes back as 'needs-unlock', its adapter kept
// inside the locked vault and refusing plain writes. A vault whose file can't be read fails with the
// file's failure, rather than opening as plain. Anything else comes back as it was.
export function findPapelizLockedEndToEndVault(openVaultResult: PapelizOpenVaultResult): Promise<PapelizExistingVaultOpenResult> {
  return papelizVaultEncryptionOperations.findPapelizLockedEndToEndVault(openVaultResult)
}

export function isPapelizEndToEndVaultAdapter(papelizVaultAdapter: PapelizVaultAdapter): papelizVaultAdapter is PapelizEndToEndVaultAdapter {
  return papelizVaultAdapter instanceof PapelizEndToEndEncryptingVaultAdapter
}

// What unlocking, making and changing give back. Unlocking gives the same `PapelizOpenVault` an opened
// Standard vault has, its adapter a `PapelizEndToEndVaultAdapter`.
export type PapelizEndToEndVaultUnlockResult =
  | {
      endToEndVaultUnlockOutcome: 'unlocked'
      papelizOpenVault: PapelizOpenVault & { papelizVaultAdapter: PapelizEndToEndVaultAdapter }
      // Whether this device now remembers the key: false when Remember on This Device wasn't asked for,
      // or when keeping it failed (the vault unlocks anyway).
      isVaultKeyRememberedOnThisDevice: boolean
    }
  | { endToEndVaultUnlockOutcome: 'wrong-passphrase' }
  // Unlocking with a remembered key: this device keeps none for the vault.
  | { endToEndVaultUnlockOutcome: 'key-not-remembered' }
  | { endToEndVaultUnlockOutcome: 'failed'; vaultEncryptionFailureCode: string }

// Argon2id's progress while the passphrase is turned into its key (about a second), from 0 to 1.
export type PapelizVaultPassphraseKeyProgressListener = (vaultPassphraseKeyProgressFraction: number) => void

export interface PapelizEndToEndVaultPassphraseUnlockRequest {
  vaultPassphrase: string
  // Remember on This Device, ticked at Unlock: the key is remembered once the vault unlocks. A failure
  // to remember doesn't stop the unlock; `isVaultKeyRememberedOnThisDevice` on the result says.
  isVaultKeyRememberedOnThisDevice: boolean
  onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener
}

export function unlockPapelizEndToEndVault(
  lockedEndToEndVault: PapelizLockedEndToEndVault,
  passphraseUnlockRequest: PapelizEndToEndVaultPassphraseUnlockRequest,
): Promise<PapelizEndToEndVaultUnlockResult> {
  return papelizVaultEncryptionOperations.unlockPapelizEndToEndVault(lockedEndToEndVault, passphraseUnlockRequest)
}

// With the key this device remembers: no passphrase, no Argon2id. 'key-not-remembered' when there is
// none; 'failed' with 'Remembered Key Wrong' when it no longer opens the vault (and it is then
// forgotten).
export function unlockPapelizEndToEndVaultWithRememberedKey(lockedEndToEndVault: PapelizLockedEndToEndVault): Promise<PapelizEndToEndVaultUnlockResult> {
  return papelizVaultEncryptionOperations.unlockPapelizEndToEndVaultWithRememberedKey(lockedEndToEndVault)
}

// Wraps an End-to-end vault's own adapter with a key already unlocked: what the unlock functions above
// do once the key is open. The screens use those; this is for the kind change and tests.
export interface PapelizUnlockedVaultEncryptionKey {
  readonly papelizEncryptedVaultId: string
  // True once the key is dropped (the vault locked). Its bytes are zeroed then.
  isVaultEncryptionKeyDropped(): boolean
}

// The key an unlocked End-to-end adapter holds, to wrap the same vault's adapter again (a browser vault
// opened once an import into it is done). Locking either adapter drops the key for both.
export function readPapelizUnlockedVaultEncryptionKey(endToEndVaultAdapter: PapelizEndToEndVaultAdapter): PapelizUnlockedVaultEncryptionKey {
  if (!(endToEndVaultAdapter instanceof PapelizEndToEndEncryptingVaultAdapter)) throw new PapelizVaultOperationError('Vault Locked')
  return endToEndVaultAdapter.readUnlockedVaultEncryptionKeyHolder()
}

export function wrapPapelizVaultAdapterWithEndToEndEncryption(
  storedVaultAdapter: PapelizVaultAdapter,
  unlockedVaultEncryptionKey: PapelizUnlockedVaultEncryptionKey,
): Promise<PapelizEndToEndVaultAdapter> {
  const storedVaultAdapterBehindRefusal = readPapelizVaultAdapterBehindPlainWriteRefusal(storedVaultAdapter)
  if (!(unlockedVaultEncryptionKey instanceof PapelizUnlockedVaultEncryptionKeyHolder) || unlockedVaultEncryptionKey.isVaultEncryptionKeyDropped()) {
    return Promise.reject(new PapelizVaultOperationError('Vault Locked'))
  }
  if (!hasPapelizVaultStoredFileAccess(storedVaultAdapterBehindRefusal)) return Promise.reject(new PapelizVaultOperationError('Encryption Not Supported'))
  return PapelizEndToEndEncryptingVaultAdapter.wrapStoredVaultAdapter(storedVaultAdapterBehindRefusal, unlockedVaultEncryptionKey, null)
}

// Making a new End-to-end vault --------------------------------------------------------------------------

export interface PapelizEndToEndVaultMakeRequest {
  // The vault New Vault just made, opened as Standard and still empty: a folder on disk, a folder in
  // Papeliz for Windows, or a browser vault.
  newVaultOpenVault: PapelizOpenVault
  vaultPassphrase: string
  onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener
}

// Turns the new, empty vault into an End-to-end vault and gives it back unlocked for this session. A
// new vault isn't remembered on this device: that is offered at the next unlock and in Settings.
export function makePapelizEndToEndVault(endToEndVaultMakeRequest: PapelizEndToEndVaultMakeRequest): Promise<PapelizEndToEndVaultUnlockResult> {
  return papelizVaultEncryptionOperations.makePapelizEndToEndVault(endToEndVaultMakeRequest)
}

// Import as a new vault (a folder or a .zip into a new browser vault) when End-to-end is picked: the
// files are written encrypted as they come in, at the vault's top, the way Import writes into a
// Standard vault. The vault must have been made End-to-end first, and still be empty.
export function writePapelizVaultImportFilesIntoEndToEndVault(
  endToEndVaultAdapter: PapelizEndToEndVaultAdapter,
  vaultImportFiles: readonly PapelizVaultImportFile[],
  vaultImportOptions?: PapelizVaultImportOptions,
): Promise<void> {
  if (!(endToEndVaultAdapter instanceof PapelizEndToEndEncryptingVaultAdapter)) return Promise.reject(new PapelizVaultOperationError('Vault Locked'))
  return endToEndVaultAdapter.writeVaultImportFilesInto(papelizVaultRootFolderRelativePath, vaultImportFiles, vaultImportOptions ?? {})
}

// Remember on This Device ----------------------------------------------------------------------------------
// The web keeps the vault's key sealed by a non-extractable WebCrypto key in this browser's IndexedDB:
// page code can use it but never read it out, and anyone using this browser profile can open the
// vault. Papeliz for Windows keeps it in Windows Credential Manager, for this Windows account
// (papeliz-desktop-platform-contract.ts).

export type PapelizVaultEncryptionActionResult = { vaultEncryptionActionOutcome: 'done' } | { vaultEncryptionActionOutcome: 'failed'; vaultEncryptionFailureCode: string }

export function rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter: PapelizEndToEndVaultAdapter): Promise<PapelizVaultEncryptionActionResult> {
  return papelizVaultEncryptionOperations.rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)
}

export function forgetPapelizVaultEncryptionKeyOnThisDevice(papelizEncryptedVaultId: string): Promise<PapelizVaultEncryptionActionResult> {
  return papelizVaultEncryptionOperations.forgetPapelizVaultEncryptionKeyOnThisDevice(papelizEncryptedVaultId)
}

// False too when this device can't keep keys at all.
export function isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId: string): Promise<boolean> {
  return isPapelizVaultEncryptionKeyRemembered(papelizEncryptedVaultId).catch(() => false)
}

// Changing the kind -------------------------------------------------------------------------------------
// Both ways rewrite the files on disk, one at a time: each new file is written and read back before
// the old one goes, so a stop part-way loses nothing and carries on next time (the unfinished change
// is kept in `.papeliz/vault-encryption.json`). The vault's `.trash/` comes along, encrypted or
// decrypted with the rest. Other apps' hidden folders (`.git/`, ...) are left as they are.

export interface PapelizVaultEncryptionKindChangeProgress {
  vaultEncryptionChangeFilesDone: number
  vaultEncryptionChangeFilesInAll: number
}

export type PapelizVaultEncryptionKindChangeProgressListener = (vaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgress) => void

export type PapelizVaultEncryptionKindChangeResult =
  // The vault's new adapter: a `PapelizEndToEndVaultAdapter` after a change to End-to-end, the vault's
  // own plain adapter after a change to Standard. The workspace swaps to it; the old one is closed.
  | { vaultEncryptionKindChangeOutcome: 'changed'; changedVaultAdapter: PapelizVaultAdapter }
  | { vaultEncryptionKindChangeOutcome: 'wrong-passphrase' }
  // Nothing on disk changed.
  | { vaultEncryptionKindChangeOutcome: 'failed'; vaultEncryptionFailureCode: string }
  // It stopped part-way (the disk filled, a file in use): the vault is End-to-end now, with the change
  // unfinished, and this is its adapter; the old one must not be used again. It carries on with
  // finishPapelizVaultEncryptionKindChange.
  | { vaultEncryptionKindChangeOutcome: 'stopped'; vaultEncryptionFailureCode: string; changedVaultAdapter: PapelizEndToEndVaultAdapter }

export interface PapelizVaultChangeToEndToEndRequest {
  // The open Standard vault's adapter.
  standardVaultAdapter: PapelizVaultAdapter
  // The open vault's ID (`PapelizOpenVault`), so its Recent Vaults row shows the new kind at once.
  papelizVaultId?: string
  // Typed twice by the person; the screens check the two match.
  vaultPassphrase: string
  onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener
  onVaultEncryptionKindChangeProgress?: PapelizVaultEncryptionKindChangeProgressListener
}

export function changePapelizVaultToEndToEnd(vaultChangeToEndToEndRequest: PapelizVaultChangeToEndToEndRequest): Promise<PapelizVaultEncryptionKindChangeResult> {
  return papelizVaultEncryptionKindChange.changePapelizVaultToEndToEnd(vaultChangeToEndToEndRequest)
}

export interface PapelizVaultChangeToStandardRequest {
  endToEndVaultAdapter: PapelizEndToEndVaultAdapter
  papelizVaultId?: string
  // Asked again, so nobody at an unlocked vault can undo it in two clicks.
  vaultPassphrase: string
  onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener
  onVaultEncryptionKindChangeProgress?: PapelizVaultEncryptionKindChangeProgressListener
}

// The remembered key is forgotten once the vault is Standard.
export function changePapelizVaultToStandard(vaultChangeToStandardRequest: PapelizVaultChangeToStandardRequest): Promise<PapelizVaultEncryptionKindChangeResult> {
  return papelizVaultEncryptionKindChange.changePapelizVaultToStandard(vaultChangeToStandardRequest)
}

// Carries on a change that stopped part-way, in its own direction, once the vault is unlocked
// (`unfinishedVaultEncryptionKindChange` on the adapter says which). No passphrase: the vault is open.
export function finishPapelizVaultEncryptionKindChange(
  endToEndVaultAdapter: PapelizEndToEndVaultAdapter,
  onVaultEncryptionKindChangeProgress?: PapelizVaultEncryptionKindChangeProgressListener,
): Promise<PapelizVaultEncryptionKindChangeResult> {
  return papelizVaultEncryptionKindChange.finishPapelizVaultEncryptionKindChange(endToEndVaultAdapter, onVaultEncryptionKindChangeProgress)
}

// Change Passphrase -----------------------------------------------------------------------------------------
// Only rewraps the vault's key: no file changes, and a remembered key still opens it.

export interface PapelizVaultPassphraseChangeRequest {
  endToEndVaultAdapter: PapelizEndToEndVaultAdapter
  currentVaultPassphrase: string
  newVaultPassphrase: string
  onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener
}

export type PapelizVaultPassphraseChangeResult =
  | { vaultPassphraseChangeOutcome: 'changed' }
  | { vaultPassphraseChangeOutcome: 'wrong-passphrase' }
  | { vaultPassphraseChangeOutcome: 'failed'; vaultEncryptionFailureCode: string }

export function changePapelizEndToEndVaultPassphrase(vaultPassphraseChangeRequest: PapelizVaultPassphraseChangeRequest): Promise<PapelizVaultPassphraseChangeResult> {
  return papelizVaultEncryptionKindChange.changePapelizEndToEndVaultPassphrase(vaultPassphraseChangeRequest)
}
