import type { PapelizExistingVaultOpenResult, PapelizOpenVault, PapelizOpenVaultResult } from './papeliz-open-vault'
import { renameRememberedVaultFolder } from './papeliz-remembered-vault-folders'
import { describePapelizVaultError, type PapelizVaultAdapter } from './papeliz-vault-adapter'
import type {
  PapelizEndToEndVaultMakeRequest,
  PapelizEndToEndVaultPassphraseUnlockRequest,
  PapelizEndToEndVaultUnlockResult,
  PapelizLockedEndToEndVault,
  PapelizVaultEncryptionActionResult,
  PapelizVaultEncryptionKindChangeDirection,
  PapelizVaultEncryptionStateReadResult,
} from './papeliz-vault-encryption'
import {
  forgetRememberedPapelizVaultEncryptionKey,
  readPapelizRecentVaultEncryptionKindRecords,
  readRememberedPapelizVaultEncryptionKeyBytes,
  recordPapelizRecentVaultEncryptionKind,
  rememberPapelizVaultEncryptionKeyBytes,
} from './papeliz-vault-encryption-device-store'
import {
  createPapelizEncryptedVaultId,
  isPapelizVaultKeyCheckOpened,
  papelizEncryptedVaultAboutFileName,
  papelizEncryptedVaultFilesFolderName,
  sealPapelizVaultKeyCheck,
} from './papeliz-vault-encryption-format'
import {
  countPapelizVaultPassphraseCharacters,
  papelizVaultPassphraseMinimumCharacterCount,
  unwrapPapelizVaultKeyWithPassphrase,
  wrapPapelizVaultKeyWithPassphrase,
} from './papeliz-vault-encryption-passphrase-key'
import {
  createPapelizVaultEncryptionRandomBytes,
  decodePapelizVaultEncryptionBase64Url,
  encodePapelizVaultEncryptionBase64Url,
  encodePapelizVaultEncryptionUtf8,
  PapelizVaultDecryptionError,
  papelizVaultEncryptionSymmetricKeyByteLength,
} from './papeliz-vault-encryption-primitives'
import {
  readPapelizVaultEncryptionSettingsFile,
  writePapelizVaultEncryptionSettingsFile,
  type PapelizEndToEndVaultEncryptionSettings,
} from './papeliz-vault-encryption-settings-file'
import {
  hasPapelizVaultStoredFileAccess,
  readPapelizVaultAdapterBehindPlainWriteRefusal,
  refusePlainWritesIntoPapelizEndToEndVault,
  type PapelizVaultStoredFileAccess,
} from './papeliz-vault-encryption-stored-files'
import { PapelizUnlockedVaultEncryptionKeyHolder } from './papeliz-vault-encryption-unlocked-key'
import { describePapelizVaultEncryptionFailureMessage } from './papeliz-vault-encryption-words'
import { papelizVaultOwnNameSettingsFileName, readPapelizVaultOwnName, writePapelizVaultOwnName } from './papeliz-vault-own-name'
import { joinVaultRelativePath, papelizVaultSettingsFolderName } from './papeliz-vault-relative-paths'
import { PapelizEndToEndEncryptingVaultAdapter } from './papeliz-end-to-end-vault-adapter'

// Making, finding, unlocking and remembering End-to-end vaults (papeliz-vault-encryption.ts says what
// each gives back). Changing the kind and the passphrase: papeliz-vault-encryption-kind-change.ts.

// The plain words beside an End-to-end vault's encrypted files, for anyone who opens the folder in
// another app.
export const papelizEncryptedVaultAboutFileText = [
  'This folder is a Papeliz vault encrypted End-to-end.',
  '',
  'Its notes and files are in the papeliz-encrypted-files folder, encrypted on the device with a',
  'passphrase only its owner knows. They open only in Papeliz, with that passphrase. Other apps can’t',
  'read them, and Papeliz can’t recover a forgotten passphrase.',
  '',
  'Don’t write notes or other files beside this one, and don’t rename, move or edit the files inside',
  'papeliz-encrypted-files or .papeliz: Papeliz won’t see the notes, and a changed file no longer opens.',
  'Open the vault in Papeliz to add, change or organize its notes.',
  '',
].join('\n')

export type PapelizStoredVaultAdapter = PapelizVaultAdapter & PapelizVaultStoredFileAccess

export function canPapelizVaultAdapterBeEndToEnd(storedVaultAdapter: PapelizVaultAdapter): boolean {
  return hasPapelizVaultStoredFileAccess(readPapelizVaultAdapterBehindPlainWriteRefusal(storedVaultAdapter))
}

export async function readPapelizVaultEncryptionState(storedVaultAdapter: PapelizVaultAdapter): Promise<PapelizVaultEncryptionStateReadResult> {
  const vaultEncryptionSettingsReadResult = await readPapelizVaultEncryptionSettingsFile(readPapelizVaultAdapterBehindPlainWriteRefusal(storedVaultAdapter))
  if (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'failed') {
    return { vaultEncryptionStateReadOutcome: 'failed', vaultEncryptionFailureCode: vaultEncryptionSettingsReadResult.vaultEncryptionFailureCode }
  }
  if (
    vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'missing' ||
    vaultEncryptionSettingsReadResult.vaultEncryptionSettings.papelizVaultEncryptionKind === 'standard'
  ) {
    return {
      vaultEncryptionStateReadOutcome: 'read',
      papelizVaultEncryptionState: { vaultEncryptionKind: 'standard', papelizEncryptedVaultId: null, unfinishedVaultEncryptionKindChange: null },
    }
  }
  const { vaultEncryptionSettings } = vaultEncryptionSettingsReadResult
  return {
    vaultEncryptionStateReadOutcome: 'read',
    papelizVaultEncryptionState: {
      vaultEncryptionKind: 'end-to-end',
      papelizEncryptedVaultId: vaultEncryptionSettings.papelizEncryptedVaultId,
      unfinishedVaultEncryptionKindChange: vaultEncryptionSettings.unfinishedVaultEncryptionKindChange,
    },
  }
}

// The End-to-end settings of a vault that must be End-to-end, or the failure code.
export async function readPapelizEndToEndVaultEncryptionSettings(storedVaultAdapter: PapelizVaultAdapter): Promise<PapelizEndToEndVaultEncryptionSettings | string> {
  const vaultEncryptionSettingsReadResult = await readPapelizVaultEncryptionSettingsFile(storedVaultAdapter)
  if (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'failed') return vaultEncryptionSettingsReadResult.vaultEncryptionFailureCode
  if (
    vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'missing' ||
    vaultEncryptionSettingsReadResult.vaultEncryptionSettings.papelizVaultEncryptionKind === 'standard'
  ) {
    return 'Already Standard'
  }
  return vaultEncryptionSettingsReadResult.vaultEncryptionSettings
}

export function describePapelizVaultEncryptionCaughtError(caughtError: unknown): string {
  if (caughtError instanceof PapelizVaultDecryptionError) return caughtError.vaultDecryptionFailureKind === 'unsupported-format' ? 'Made By Newer Papeliz' : 'Encryption Settings Damaged'
  return describePapelizVaultError(caughtError)
}

// Making the key -----------------------------------------------------------------------------------------

export function findPapelizVaultPassphraseProblem(vaultPassphrase: string): 'Passphrase Too Short' | null {
  return countPapelizVaultPassphraseCharacters(vaultPassphrase) < papelizVaultPassphraseMinimumCharacterCount ? 'Passphrase Too Short' : null
}

// A new vault key, wrapped by the passphrase, and the settings that hold it. The key is handed over to
// a holder, which keeps the only copy of its bytes.
export async function makePapelizEndToEndVaultKeyAndSettings(
  vaultPassphrase: string,
  unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null,
  onVaultPassphraseKeyProgress?: (vaultPassphraseKeyProgressFraction: number) => void,
): Promise<{ unlockedVaultEncryptionKeyHolder: PapelizUnlockedVaultEncryptionKeyHolder; endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings }> {
  const papelizEncryptedVaultId = createPapelizEncryptedVaultId()
  const vaultEncryptionKeyBytes = createPapelizVaultEncryptionRandomBytes(papelizVaultEncryptionSymmetricKeyByteLength)
  const vaultPassphraseWrappedKey = await wrapPapelizVaultKeyWithPassphrase({
    papelizEncryptedVaultId,
    vaultEncryptionKeyBytes,
    vaultPassphrase,
    ...(onVaultPassphraseKeyProgress ? { onArgon2idProgress: onVaultPassphraseKeyProgress } : {}),
  })
  const unlockedVaultEncryptionKeyHolder = await PapelizUnlockedVaultEncryptionKeyHolder.holdVaultEncryptionKey(papelizEncryptedVaultId, vaultEncryptionKeyBytes)
  const endToEndVaultKeys = unlockedVaultEncryptionKeyHolder.readEndToEndVaultKeys()
  if (endToEndVaultKeys === null) throw new Error('The new key was dropped')
  return {
    unlockedVaultEncryptionKeyHolder,
    endToEndVaultEncryptionSettings: {
      papelizVaultEncryptionFormatVersion: 1,
      papelizVaultEncryptionKind: 'end-to-end',
      papelizEncryptedVaultId,
      vaultPassphraseWrappedKey,
      sealedVaultKeyCheck: encodePapelizVaultEncryptionBase64Url(await sealPapelizVaultKeyCheck(endToEndVaultKeys)),
      unfinishedVaultEncryptionKindChange,
    },
  }
}

export async function writePapelizEncryptedVaultAboutFile(storedVaultAdapter: PapelizStoredVaultAdapter): Promise<void> {
  await storedVaultAdapter.writeStoredVaultFileBytes(papelizEncryptedVaultAboutFileName, encodePapelizVaultEncryptionUtf8(papelizEncryptedVaultAboutFileText))
}

async function isPapelizVaultKeyHolderCheckedBySettings(
  unlockedVaultEncryptionKeyHolder: PapelizUnlockedVaultEncryptionKeyHolder,
  endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings,
): Promise<boolean> {
  const endToEndVaultKeys = unlockedVaultEncryptionKeyHolder.readEndToEndVaultKeys()
  const sealedVaultKeyCheckBytes = decodePapelizVaultEncryptionBase64Url(endToEndVaultEncryptionSettings.sealedVaultKeyCheck)
  return endToEndVaultKeys !== null && sealedVaultKeyCheckBytes !== null && (await isPapelizVaultKeyCheckOpened(endToEndVaultKeys, sealedVaultKeyCheckBytes))
}

// Making a new End-to-end vault --------------------------------------------------------------------------

// The one file a new vault may hold before it is made End-to-end: the name New Vault saved in it
// (papeliz-vault-own-name.ts), which is then sealed with the rest.
const plainVaultOwnNameFileRelativePath = joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultOwnNameSettingsFileName)

export async function makePapelizEndToEndVault(endToEndVaultMakeRequest: PapelizEndToEndVaultMakeRequest): Promise<PapelizEndToEndVaultUnlockResult> {
  const { newVaultOpenVault } = endToEndVaultMakeRequest
  const storedVaultAdapter = readPapelizVaultAdapterBehindPlainWriteRefusal(newVaultOpenVault.papelizVaultAdapter)
  if (!hasPapelizVaultStoredFileAccess(storedVaultAdapter)) return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Not Supported' }
  const vaultPassphraseProblem = findPapelizVaultPassphraseProblem(endToEndVaultMakeRequest.vaultPassphrase)
  if (vaultPassphraseProblem !== null) return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: vaultPassphraseProblem }
  try {
    const vaultEncryptionSettingsReadResult = await readPapelizVaultEncryptionSettingsFile(storedVaultAdapter)
    if (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'read' && vaultEncryptionSettingsReadResult.vaultEncryptionSettings.papelizVaultEncryptionKind === 'end-to-end') {
      return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Already End-to-end' }
    }
    const storedVaultFileStats = await storedVaultAdapter.listStoredVaultFileStats()
    if (storedVaultFileStats.some((storedVaultFileStat) => storedVaultFileStat.vaultFileRelativePath !== plainVaultOwnNameFileRelativePath)) {
      return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Not Empty' }
    }
    const isPlainVaultOwnNameFileThere = storedVaultFileStats.length > 0
    const newVaultOwnName = isPlainVaultOwnNameFileThere ? await readPapelizVaultOwnName(storedVaultAdapter) : null
    const { unlockedVaultEncryptionKeyHolder, endToEndVaultEncryptionSettings } = await makePapelizEndToEndVaultKeyAndSettings(
      endToEndVaultMakeRequest.vaultPassphrase,
      null,
      endToEndVaultMakeRequest.onVaultPassphraseKeyProgress,
    )
    await writePapelizVaultEncryptionSettingsFile(storedVaultAdapter, endToEndVaultEncryptionSettings)
    await writePapelizEncryptedVaultAboutFile(storedVaultAdapter)
    await storedVaultAdapter.makeStoredVaultFolder(papelizEncryptedVaultFilesFolderName)
    const endToEndVaultAdapter = await PapelizEndToEndEncryptingVaultAdapter.wrapStoredVaultAdapter(storedVaultAdapter, unlockedVaultEncryptionKeyHolder, null)
    if (isPlainVaultOwnNameFileThere) {
      if (newVaultOwnName !== null) await writePapelizVaultOwnName(endToEndVaultAdapter, newVaultOwnName)
      await storedVaultAdapter.removeStoredVaultEntry(plainVaultOwnNameFileRelativePath)
    }
    await recordPapelizRecentVaultEncryptionKind({
      papelizVaultId: newVaultOpenVault.papelizVaultId,
      papelizVaultEncryptionKind: 'end-to-end',
      papelizEncryptedVaultId: endToEndVaultAdapter.papelizEncryptedVaultId,
    })
    return {
      endToEndVaultUnlockOutcome: 'unlocked',
      papelizOpenVault: { ...newVaultOpenVault, papelizVaultAdapter: endToEndVaultAdapter },
      isVaultKeyRememberedOnThisDevice: false,
    }
  } catch (endToEndVaultMakeError) {
    return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(endToEndVaultMakeError) }
  }
}

// Finding and unlocking ------------------------------------------------------------------------------------

export async function findPapelizLockedEndToEndVault(openVaultResult: PapelizOpenVaultResult): Promise<PapelizExistingVaultOpenResult> {
  if (openVaultResult.openVaultOutcome !== 'opened') return openVaultResult
  const { papelizOpenVault } = openVaultResult
  const storedVaultAdapter = papelizOpenVault.papelizVaultAdapter
  if (!hasPapelizVaultStoredFileAccess(storedVaultAdapter)) return openVaultResult
  let vaultEncryptionStateReadResult: PapelizVaultEncryptionStateReadResult
  try {
    vaultEncryptionStateReadResult = await readPapelizVaultEncryptionState(storedVaultAdapter)
  } catch (vaultEncryptionStateReadError) {
    vaultEncryptionStateReadResult = { vaultEncryptionStateReadOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultError(vaultEncryptionStateReadError) }
  }
  if (vaultEncryptionStateReadResult.vaultEncryptionStateReadOutcome === 'failed') {
    // Never opened as plain: its files may be encrypted.
    storedVaultAdapter.closeVaultAdapter?.()
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizVaultEncryptionFailureMessage(`Couldn’t open “${papelizOpenVault.papelizVaultDisplayName}”`, vaultEncryptionStateReadResult.vaultEncryptionFailureCode),
    }
  }
  const { papelizVaultEncryptionState } = vaultEncryptionStateReadResult
  const recentVaultEncryptionKindRecord = (await readPapelizRecentVaultEncryptionKindRecords()).get(papelizOpenVault.papelizVaultId)
  if (
    recentVaultEncryptionKindRecord?.papelizVaultEncryptionKind !== papelizVaultEncryptionState.vaultEncryptionKind ||
    recentVaultEncryptionKindRecord.papelizEncryptedVaultId !== papelizVaultEncryptionState.papelizEncryptedVaultId
  ) {
    if (recentVaultEncryptionKindRecord !== undefined || papelizVaultEncryptionState.vaultEncryptionKind === 'end-to-end') {
      await recordPapelizRecentVaultEncryptionKind({
        papelizVaultId: papelizOpenVault.papelizVaultId,
        papelizVaultEncryptionKind: papelizVaultEncryptionState.vaultEncryptionKind,
        papelizEncryptedVaultId: papelizVaultEncryptionState.papelizEncryptedVaultId,
      })
    }
  }
  if (papelizVaultEncryptionState.vaultEncryptionKind === 'standard' || papelizVaultEncryptionState.papelizEncryptedVaultId === null) return openVaultResult
  return {
    openVaultOutcome: 'needs-unlock',
    papelizLockedEndToEndVault: {
      papelizVaultId: papelizOpenVault.papelizVaultId,
      papelizVaultDisplayName: papelizOpenVault.papelizVaultDisplayName,
      papelizEncryptedVaultId: papelizVaultEncryptionState.papelizEncryptedVaultId,
      unfinishedVaultEncryptionKindChange: papelizVaultEncryptionState.unfinishedVaultEncryptionKindChange,
      lockedStoredVaultAdapter: refusePlainWritesIntoPapelizEndToEndVault(storedVaultAdapter),
    },
  }
}

async function openPapelizUnlockedEndToEndVault(
  lockedEndToEndVault: PapelizLockedEndToEndVault,
  storedVaultAdapter: PapelizStoredVaultAdapter,
  unlockedVaultEncryptionKeyHolder: PapelizUnlockedVaultEncryptionKeyHolder,
  endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings,
): Promise<PapelizOpenVault & { papelizVaultAdapter: PapelizEndToEndEncryptingVaultAdapter }> {
  const endToEndVaultAdapter = await PapelizEndToEndEncryptingVaultAdapter.wrapStoredVaultAdapter(
    storedVaultAdapter,
    unlockedVaultEncryptionKeyHolder,
    endToEndVaultEncryptionSettings.unfinishedVaultEncryptionKindChange,
  )
  await recordPapelizRecentVaultEncryptionKind({
    papelizVaultId: lockedEndToEndVault.papelizVaultId,
    papelizVaultEncryptionKind: 'end-to-end',
    papelizEncryptedVaultId: endToEndVaultAdapter.papelizEncryptedVaultId,
  })
  return {
    papelizVaultId: lockedEndToEndVault.papelizVaultId,
    papelizVaultDisplayName: await readPapelizUnlockedVaultDisplayName(lockedEndToEndVault, storedVaultAdapter, endToEndVaultAdapter),
    papelizVaultAdapter: endToEndVaultAdapter,
  }
}

// A folder vault opened locked with the name this device last saw; unlocked, its own sealed name (or
// its folder's, when none is saved) takes over, and Recent Vaults keeps it. A change of kind that
// stopped part-way may have left the name still plain, or plain again. A browser vault keeps the name
// it has.
async function readPapelizUnlockedVaultDisplayName(
  lockedEndToEndVault: PapelizLockedEndToEndVault,
  storedVaultAdapter: PapelizStoredVaultAdapter,
  endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter,
): Promise<string> {
  if (storedVaultAdapter.papelizVaultKind !== 'folder-on-disk') return lockedEndToEndVault.papelizVaultDisplayName
  const papelizVaultOwnName =
    (await readPapelizVaultOwnName(endToEndVaultAdapter)) ??
    (endToEndVaultAdapter.unfinishedVaultEncryptionKindChange === null ? null : await readPapelizVaultOwnName(storedVaultAdapter))
  const rememberedVaultDisplayName = await renameRememberedVaultFolder(lockedEndToEndVault.papelizVaultId, papelizVaultOwnName).catch(() => null)
  return rememberedVaultDisplayName ?? papelizVaultOwnName ?? lockedEndToEndVault.papelizVaultDisplayName
}

function readLockedStoredVaultAdapter(lockedEndToEndVault: PapelizLockedEndToEndVault): PapelizStoredVaultAdapter | null {
  const storedVaultAdapter = readPapelizVaultAdapterBehindPlainWriteRefusal(lockedEndToEndVault.lockedStoredVaultAdapter)
  return hasPapelizVaultStoredFileAccess(storedVaultAdapter) ? storedVaultAdapter : null
}

export async function unlockPapelizEndToEndVault(
  lockedEndToEndVault: PapelizLockedEndToEndVault,
  passphraseUnlockRequest: PapelizEndToEndVaultPassphraseUnlockRequest,
): Promise<PapelizEndToEndVaultUnlockResult> {
  const storedVaultAdapter = readLockedStoredVaultAdapter(lockedEndToEndVault)
  if (storedVaultAdapter === null) return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Not Supported' }
  try {
    const endToEndVaultEncryptionSettings = await readPapelizEndToEndVaultEncryptionSettings(storedVaultAdapter)
    if (typeof endToEndVaultEncryptionSettings === 'string') return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: endToEndVaultEncryptionSettings }
    let vaultEncryptionKeyBytes: Uint8Array<ArrayBuffer>
    try {
      vaultEncryptionKeyBytes = await unwrapPapelizVaultKeyWithPassphrase({
        papelizEncryptedVaultId: endToEndVaultEncryptionSettings.papelizEncryptedVaultId,
        vaultPassphraseWrappedKey: endToEndVaultEncryptionSettings.vaultPassphraseWrappedKey,
        vaultPassphrase: passphraseUnlockRequest.vaultPassphrase,
        ...(passphraseUnlockRequest.onVaultPassphraseKeyProgress ? { onArgon2idProgress: passphraseUnlockRequest.onVaultPassphraseKeyProgress } : {}),
      })
    } catch (vaultKeyUnwrapError) {
      if (vaultKeyUnwrapError instanceof PapelizVaultDecryptionError && vaultKeyUnwrapError.vaultDecryptionFailureKind === 'wrong-key-or-tampered') {
        return { endToEndVaultUnlockOutcome: 'wrong-passphrase' }
      }
      throw vaultKeyUnwrapError
    }
    const unlockedVaultEncryptionKeyHolder = await PapelizUnlockedVaultEncryptionKeyHolder.holdVaultEncryptionKey(endToEndVaultEncryptionSettings.papelizEncryptedVaultId, vaultEncryptionKeyBytes)
    if (!(await isPapelizVaultKeyHolderCheckedBySettings(unlockedVaultEncryptionKeyHolder, endToEndVaultEncryptionSettings))) {
      unlockedVaultEncryptionKeyHolder.dropVaultEncryptionKey()
      return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Settings Damaged' }
    }
    const papelizOpenVault = await openPapelizUnlockedEndToEndVault(lockedEndToEndVault, storedVaultAdapter, unlockedVaultEncryptionKeyHolder, endToEndVaultEncryptionSettings)
    const isVaultKeyRememberedOnThisDevice =
      passphraseUnlockRequest.isVaultKeyRememberedOnThisDevice &&
      (await rememberPapelizVaultEncryptionKeyOnThisDevice(papelizOpenVault.papelizVaultAdapter)).vaultEncryptionActionOutcome === 'done'
    return { endToEndVaultUnlockOutcome: 'unlocked', papelizOpenVault, isVaultKeyRememberedOnThisDevice }
  } catch (vaultUnlockError) {
    return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(vaultUnlockError) }
  }
}

export async function unlockPapelizEndToEndVaultWithRememberedKey(lockedEndToEndVault: PapelizLockedEndToEndVault): Promise<PapelizEndToEndVaultUnlockResult> {
  const storedVaultAdapter = readLockedStoredVaultAdapter(lockedEndToEndVault)
  if (storedVaultAdapter === null) return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Not Supported' }
  try {
    const endToEndVaultEncryptionSettings = await readPapelizEndToEndVaultEncryptionSettings(storedVaultAdapter)
    if (typeof endToEndVaultEncryptionSettings === 'string') return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: endToEndVaultEncryptionSettings }
    const { papelizEncryptedVaultId } = endToEndVaultEncryptionSettings
    const rememberedVaultKeyBytes = await readRememberedPapelizVaultEncryptionKeyBytes(papelizEncryptedVaultId).catch(() => null)
    if (rememberedVaultKeyBytes === null) return { endToEndVaultUnlockOutcome: 'key-not-remembered' }
    const unlockedVaultEncryptionKeyHolder = await PapelizUnlockedVaultEncryptionKeyHolder.holdVaultEncryptionKey(papelizEncryptedVaultId, rememberedVaultKeyBytes)
    if (!(await isPapelizVaultKeyHolderCheckedBySettings(unlockedVaultEncryptionKeyHolder, endToEndVaultEncryptionSettings))) {
      unlockedVaultEncryptionKeyHolder.dropVaultEncryptionKey()
      await forgetRememberedPapelizVaultEncryptionKey(papelizEncryptedVaultId).catch(() => undefined)
      return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: 'Remembered Key Wrong' }
    }
    const papelizOpenVault = await openPapelizUnlockedEndToEndVault(lockedEndToEndVault, storedVaultAdapter, unlockedVaultEncryptionKeyHolder, endToEndVaultEncryptionSettings)
    return { endToEndVaultUnlockOutcome: 'unlocked', papelizOpenVault, isVaultKeyRememberedOnThisDevice: true }
  } catch (vaultUnlockError) {
    return { endToEndVaultUnlockOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(vaultUnlockError) }
  }
}

// Remember on This Device ----------------------------------------------------------------------------------

export function readPapelizEndToEndEncryptingVaultAdapter(papelizVaultAdapter: PapelizVaultAdapter): PapelizEndToEndEncryptingVaultAdapter | null {
  return papelizVaultAdapter instanceof PapelizEndToEndEncryptingVaultAdapter ? papelizVaultAdapter : null
}

export async function rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter: PapelizVaultAdapter): Promise<PapelizVaultEncryptionActionResult> {
  const endToEndEncryptingVaultAdapter = readPapelizEndToEndEncryptingVaultAdapter(endToEndVaultAdapter)
  if (endToEndEncryptingVaultAdapter === null || endToEndEncryptingVaultAdapter.isEndToEndVaultLocked()) {
    return { vaultEncryptionActionOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Locked' }
  }
  const vaultEncryptionKeyBytes = endToEndEncryptingVaultAdapter.readUnlockedVaultEncryptionKeyHolder().copyVaultEncryptionKeyBytes()
  if (vaultEncryptionKeyBytes === null) return { vaultEncryptionActionOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Locked' }
  try {
    await rememberPapelizVaultEncryptionKeyBytes(endToEndEncryptingVaultAdapter.papelizEncryptedVaultId, vaultEncryptionKeyBytes)
    return { vaultEncryptionActionOutcome: 'done' }
  } catch {
    return { vaultEncryptionActionOutcome: 'failed', vaultEncryptionFailureCode: 'Remember Not Available' }
  } finally {
    vaultEncryptionKeyBytes.fill(0)
  }
}

export async function forgetPapelizVaultEncryptionKeyOnThisDevice(papelizEncryptedVaultId: string): Promise<PapelizVaultEncryptionActionResult> {
  try {
    await forgetRememberedPapelizVaultEncryptionKey(papelizEncryptedVaultId)
    return { vaultEncryptionActionOutcome: 'done' }
  } catch {
    return { vaultEncryptionActionOutcome: 'failed', vaultEncryptionFailureCode: 'Remember Not Available' }
  }
}
