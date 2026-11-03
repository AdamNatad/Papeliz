import { PapelizEndToEndEncryptingVaultAdapter } from './papeliz-end-to-end-vault-adapter'
import type { PapelizVaultAdapter } from './papeliz-vault-adapter'
import type {
  PapelizVaultChangeToEndToEndRequest,
  PapelizVaultChangeToStandardRequest,
  PapelizVaultEncryptionKindChangeProgressListener,
  PapelizVaultEncryptionKindChangeResult,
  PapelizVaultPassphraseChangeRequest,
  PapelizVaultPassphraseChangeResult,
} from './papeliz-vault-encryption'
import { forgetRememberedPapelizVaultEncryptionKey, recordPapelizRecentVaultEncryptionKind } from './papeliz-vault-encryption-device-store'
import { papelizEncryptedVaultAboutFileName, papelizEncryptedVaultFilesFolderName } from './papeliz-vault-encryption-format'
import {
  describePapelizVaultEncryptionCaughtError,
  findPapelizVaultPassphraseProblem,
  makePapelizEndToEndVaultKeyAndSettings,
  readPapelizEndToEndEncryptingVaultAdapter,
  readPapelizEndToEndVaultEncryptionSettings,
  writePapelizEncryptedVaultAboutFile,
  type PapelizStoredVaultAdapter,
} from './papeliz-vault-encryption-operations'
import { unwrapPapelizVaultKeyWithPassphrase, wrapPapelizVaultKeyWithPassphrase } from './papeliz-vault-encryption-passphrase-key'
import { arePapelizVaultEncryptionBytesEqual, PapelizVaultDecryptionError } from './papeliz-vault-encryption-primitives'
import {
  papelizVaultEncryptionSettingsFileFormatVersion,
  papelizVaultEncryptionSettingsFileName,
  readPapelizVaultEncryptionSettingsFile,
  writePapelizVaultEncryptionSettingsFile,
  type PapelizEndToEndVaultEncryptionSettings,
} from './papeliz-vault-encryption-settings-file'
import { assertVaultFolderRelativePathCarriedByVaultEncryption, hasPapelizVaultStoredFileAccess, readPapelizVaultAdapterBehindPlainWriteRefusal } from './papeliz-vault-encryption-stored-files'
import { isVaultRelativePathInsideFolder, joinVaultRelativePath, papelizVaultSettingsFolderName, splitVaultRelativePath } from './papeliz-vault-relative-paths'

// Changing a vault's kind, both ways, and its passphrase. A change rewrites the files one at a time:
// each new file is written and read back before the old one is removed, so a stop part-way loses
// nothing, and `.papeliz/vault-encryption.json` keeps the unfinished change until the last file is
// done. A file already changed when a stopped change carries on is found by its path and contents and
// isn't written twice.
//
// The plain file a change to End-to-end has encrypted is removed outright, not moved into `.trash/`:
// a copy there would leave every note readable. The vault's `.trash/` itself is encrypted with the
// rest, so trashed notes can still be restored inside Papeliz.

// The plain files and empty folders a change to End-to-end encrypts: everything the change carries but
// the encryption's own files.
function isStoredVaultFileLeftPlainByEncryption(storedVaultFileRelativePath: string): boolean {
  return (
    isVaultRelativePathInsideFolder(storedVaultFileRelativePath, papelizEncryptedVaultFilesFolderName) ||
    storedVaultFileRelativePath === papelizEncryptedVaultAboutFileName ||
    storedVaultFileRelativePath === joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultEncryptionSettingsFileName)
  )
}

function isVaultFolderCarriedByVaultEncryption(vaultFolderRelativePath: string): boolean {
  try {
    assertVaultFolderRelativePathCarriedByVaultEncryption(vaultFolderRelativePath)
    return true
  } catch {
    return false
  }
}

function compareVaultFoldersDeepestFirst(firstVaultFolderRelativePath: string, secondVaultFolderRelativePath: string): number {
  return splitVaultRelativePath(secondVaultFolderRelativePath).length - splitVaultRelativePath(firstVaultFolderRelativePath).length
}

// The plain folders below the vault's top that a change carries: what the file list would show with
// Show Hidden on, less the encryption's own folder and other apps' hidden ones.
async function listPlainVaultFolderRelativePaths(storedVaultAdapter: PapelizStoredVaultAdapter): Promise<string[]> {
  return (await storedVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }))
    .filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'folder')
    .map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    .filter(
      (vaultFolderRelativePath) => !isVaultRelativePathInsideFolder(vaultFolderRelativePath, papelizEncryptedVaultFilesFolderName) && isVaultFolderCarriedByVaultEncryption(vaultFolderRelativePath),
    )
}

// Removes folders left empty, deepest first; one that still holds something (another app's hidden
// files, say) stays.
async function removeEmptiedStoredVaultFolders(storedVaultAdapter: PapelizStoredVaultAdapter, storedVaultFolderRelativePaths: readonly string[]): Promise<void> {
  for (const storedVaultFolderRelativePath of [...storedVaultFolderRelativePaths].sort(compareVaultFoldersDeepestFirst)) {
    await storedVaultAdapter.removeStoredVaultEntry(storedVaultFolderRelativePath).catch(() => undefined)
  }
}

// To End-to-end -------------------------------------------------------------------------------------------

async function encryptEveryPlainVaultFile(
  endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter,
  onVaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgressListener | undefined,
): Promise<void> {
  const storedVaultAdapter = endToEndVaultAdapter.readStoredVaultAdapterForEncryption()
  const plainVaultFolderRelativePaths = await listPlainVaultFolderRelativePaths(storedVaultAdapter)
  const plainVaultFileRelativePaths = (await storedVaultAdapter.listStoredVaultFileStats())
    .map((storedVaultFileStat) => storedVaultFileStat.vaultFileRelativePath)
    .filter((storedVaultFileRelativePath) => !isStoredVaultFileLeftPlainByEncryption(storedVaultFileRelativePath))
    .sort()
  const vaultEncryptionChangeFilesInAll = plainVaultFileRelativePaths.length
  let vaultEncryptionChangeFilesDone = 0
  onVaultEncryptionKindChangeProgress?.({ vaultEncryptionChangeFilesDone, vaultEncryptionChangeFilesInAll })
  await endToEndVaultAdapter.refreshEncryptedVaultIndex()
  for (const plainVaultFileRelativePath of plainVaultFileRelativePaths) {
    const plainBytes = await storedVaultAdapter.readVaultFileBytes(plainVaultFileRelativePath)
    const alreadyEncryptedBytes = await endToEndVaultAdapter.readDecryptedVaultFileBytes(plainVaultFileRelativePath).catch(() => null)
    if (alreadyEncryptedBytes === null || !arePapelizVaultEncryptionBytesEqual(alreadyEncryptedBytes, plainBytes)) {
      await endToEndVaultAdapter.writeEncryptedVaultFileBytes(plainVaultFileRelativePath, plainBytes)
      const readBackBytes = await endToEndVaultAdapter.readDecryptedVaultFileBytes(plainVaultFileRelativePath)
      if (!arePapelizVaultEncryptionBytesEqual(readBackBytes, plainBytes)) throw new PapelizVaultDecryptionError('content-address-mismatch', 'The encrypted copy did not read back as written.')
    }
    await storedVaultAdapter.removeStoredVaultEntry(plainVaultFileRelativePath)
    vaultEncryptionChangeFilesDone += 1
    onVaultEncryptionKindChangeProgress?.({ vaultEncryptionChangeFilesDone, vaultEncryptionChangeFilesInAll })
  }
  // Empty folders come along as markers, then the plain folders go.
  for (const plainVaultFolderRelativePath of plainVaultFolderRelativePaths) await endToEndVaultAdapter.keepVaultFolderMarker(plainVaultFolderRelativePath)
  await removeEmptiedStoredVaultFolders(storedVaultAdapter, plainVaultFolderRelativePaths)
}

async function finishChangeToEndToEnd(
  endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter,
  endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings,
  onVaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgressListener | undefined,
): Promise<PapelizVaultEncryptionKindChangeResult> {
  try {
    await encryptEveryPlainVaultFile(endToEndVaultAdapter, onVaultEncryptionKindChangeProgress)
    await writePapelizVaultEncryptionSettingsFile(endToEndVaultAdapter.readStoredVaultAdapterForEncryption(), {
      ...endToEndVaultEncryptionSettings,
      unfinishedVaultEncryptionKindChange: null,
    })
    endToEndVaultAdapter.noteVaultEncryptionKindChange(null)
    return { vaultEncryptionKindChangeOutcome: 'changed', changedVaultAdapter: endToEndVaultAdapter }
  } catch (kindChangeError) {
    return { vaultEncryptionKindChangeOutcome: 'stopped', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(kindChangeError), changedVaultAdapter: endToEndVaultAdapter }
  }
}

export async function changePapelizVaultToEndToEnd(vaultChangeToEndToEndRequest: PapelizVaultChangeToEndToEndRequest): Promise<PapelizVaultEncryptionKindChangeResult> {
  const storedVaultAdapter = readPapelizVaultAdapterBehindPlainWriteRefusal(vaultChangeToEndToEndRequest.standardVaultAdapter)
  if (readPapelizEndToEndEncryptingVaultAdapter(storedVaultAdapter) !== null) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already End-to-end' }
  if (!hasPapelizVaultStoredFileAccess(storedVaultAdapter)) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Not Supported' }
  const vaultPassphraseProblem = findPapelizVaultPassphraseProblem(vaultChangeToEndToEndRequest.vaultPassphrase)
  if (vaultPassphraseProblem !== null) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: vaultPassphraseProblem }
  let endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter
  let endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings
  try {
    const vaultEncryptionSettingsReadResult = await readPapelizVaultEncryptionSettingsFile(storedVaultAdapter)
    if (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'failed') {
      return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: vaultEncryptionSettingsReadResult.vaultEncryptionFailureCode }
    }
    if (vaultEncryptionSettingsReadResult.vaultEncryptionSettingsReadOutcome === 'read' && vaultEncryptionSettingsReadResult.vaultEncryptionSettings.papelizVaultEncryptionKind === 'end-to-end') {
      return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already End-to-end' }
    }
    const madeVaultKey = await makePapelizEndToEndVaultKeyAndSettings(
      vaultChangeToEndToEndRequest.vaultPassphrase,
      'to-end-to-end',
      vaultChangeToEndToEndRequest.onVaultPassphraseKeyProgress,
    )
    endToEndVaultEncryptionSettings = madeVaultKey.endToEndVaultEncryptionSettings
    // From here on the vault is End-to-end, with the change unfinished until every file is encrypted.
    await writePapelizVaultEncryptionSettingsFile(storedVaultAdapter, endToEndVaultEncryptionSettings)
    await writePapelizEncryptedVaultAboutFile(storedVaultAdapter)
    await storedVaultAdapter.makeStoredVaultFolder(papelizEncryptedVaultFilesFolderName)
    endToEndVaultAdapter = await PapelizEndToEndEncryptingVaultAdapter.wrapStoredVaultAdapter(storedVaultAdapter, madeVaultKey.unlockedVaultEncryptionKeyHolder, 'to-end-to-end')
    if (vaultChangeToEndToEndRequest.papelizVaultId !== undefined) {
      await recordPapelizRecentVaultEncryptionKind({
        papelizVaultId: vaultChangeToEndToEndRequest.papelizVaultId,
        papelizVaultEncryptionKind: 'end-to-end',
        papelizEncryptedVaultId: endToEndVaultAdapter.papelizEncryptedVaultId,
      })
    }
  } catch (kindChangeStartError) {
    return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(kindChangeStartError) }
  }
  return finishChangeToEndToEnd(endToEndVaultAdapter, endToEndVaultEncryptionSettings, vaultChangeToEndToEndRequest.onVaultEncryptionKindChangeProgress)
}

// To Standard ---------------------------------------------------------------------------------------------

async function decryptEveryEncryptedVaultFile(
  endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter,
  onVaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgressListener | undefined,
): Promise<void> {
  const storedVaultAdapter = endToEndVaultAdapter.readStoredVaultAdapterForEncryption()
  await endToEndVaultAdapter.refreshEncryptedVaultIndex()
  const decryptedVaultEntries = endToEndVaultAdapter
    .listDecryptedVaultEntries()
    .sort((firstVaultEntry, secondVaultEntry) => firstVaultEntry.vaultEntryRelativePath.localeCompare(secondVaultEntry.vaultEntryRelativePath))
  const vaultEncryptionChangeFilesInAll = decryptedVaultEntries.filter((decryptedVaultEntry) => decryptedVaultEntry.encryptedVaultEntryKind === 'file').length
  let vaultEncryptionChangeFilesDone = 0
  onVaultEncryptionKindChangeProgress?.({ vaultEncryptionChangeFilesDone, vaultEncryptionChangeFilesInAll })
  for (const decryptedVaultEntry of decryptedVaultEntries) {
    if (decryptedVaultEntry.encryptedVaultEntryKind === 'folder') {
      await storedVaultAdapter.makeStoredVaultFolder(decryptedVaultEntry.vaultEntryRelativePath)
    } else {
      const plainBytes = await endToEndVaultAdapter.readDecryptedVaultFileBytes(decryptedVaultEntry.vaultEntryRelativePath)
      await storedVaultAdapter.writeStoredVaultFileBytes(decryptedVaultEntry.vaultEntryRelativePath, plainBytes)
      const readBackBytes = await storedVaultAdapter.readVaultFileBytes(decryptedVaultEntry.vaultEntryRelativePath)
      if (!arePapelizVaultEncryptionBytesEqual(readBackBytes, plainBytes)) throw new Error('The plain copy did not read back as written')
    }
    await storedVaultAdapter.removeStoredVaultEntry(decryptedVaultEntry.encryptedVaultFileRelativePath)
    endToEndVaultAdapter.forgetEncryptedVaultEntryAt(decryptedVaultEntry.encryptedVaultFileRelativePath)
    if (decryptedVaultEntry.encryptedVaultEntryKind === 'file') {
      vaultEncryptionChangeFilesDone += 1
      onVaultEncryptionKindChangeProgress?.({ vaultEncryptionChangeFilesDone, vaultEncryptionChangeFilesInAll })
    }
  }
}

async function finishChangeToStandard(
  endToEndVaultAdapter: PapelizEndToEndEncryptingVaultAdapter,
  onVaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgressListener | undefined,
): Promise<PapelizVaultEncryptionKindChangeResult> {
  const storedVaultAdapter = endToEndVaultAdapter.readStoredVaultAdapterForEncryption()
  const { papelizEncryptedVaultId } = endToEndVaultAdapter
  try {
    await decryptEveryEncryptedVaultFile(endToEndVaultAdapter, onVaultEncryptionKindChangeProgress)
    await writePapelizVaultEncryptionSettingsFile(storedVaultAdapter, {
      papelizVaultEncryptionFormatVersion: papelizVaultEncryptionSettingsFileFormatVersion,
      papelizVaultEncryptionKind: 'standard',
    })
  } catch (kindChangeError) {
    return { vaultEncryptionKindChangeOutcome: 'stopped', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(kindChangeError), changedVaultAdapter: endToEndVaultAdapter }
  }
  // The vault is Standard now: what follows only tidies, and its failures change nothing.
  await storedVaultAdapter.removeStoredVaultEntry(papelizEncryptedVaultFilesFolderName).catch(() => undefined)
  await storedVaultAdapter.removeStoredVaultEntry(papelizEncryptedVaultAboutFileName).catch(() => undefined)
  await forgetRememberedPapelizVaultEncryptionKey(papelizEncryptedVaultId).catch(() => undefined)
  endToEndVaultAdapter.noteVaultEncryptionKindChange(null)
  endToEndVaultAdapter.lockEndToEndVault()
  return { vaultEncryptionKindChangeOutcome: 'changed', changedVaultAdapter: storedVaultAdapter }
}

async function verifyPapelizVaultPassphrase(
  storedVaultAdapter: PapelizVaultAdapter,
  vaultPassphrase: string,
  onVaultPassphraseKeyProgress: ((vaultPassphraseKeyProgressFraction: number) => void) | undefined,
): Promise<{ endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings; vaultEncryptionKeyBytes: Uint8Array<ArrayBuffer> } | 'wrong-passphrase' | string> {
  const endToEndVaultEncryptionSettings = await readPapelizEndToEndVaultEncryptionSettings(storedVaultAdapter)
  if (typeof endToEndVaultEncryptionSettings === 'string') return endToEndVaultEncryptionSettings
  try {
    const vaultEncryptionKeyBytes = await unwrapPapelizVaultKeyWithPassphrase({
      papelizEncryptedVaultId: endToEndVaultEncryptionSettings.papelizEncryptedVaultId,
      vaultPassphraseWrappedKey: endToEndVaultEncryptionSettings.vaultPassphraseWrappedKey,
      vaultPassphrase,
      ...(onVaultPassphraseKeyProgress ? { onArgon2idProgress: onVaultPassphraseKeyProgress } : {}),
    })
    return { endToEndVaultEncryptionSettings, vaultEncryptionKeyBytes }
  } catch (vaultKeyUnwrapError) {
    if (vaultKeyUnwrapError instanceof PapelizVaultDecryptionError && vaultKeyUnwrapError.vaultDecryptionFailureKind === 'wrong-key-or-tampered') return 'wrong-passphrase'
    throw vaultKeyUnwrapError
  }
}

export async function changePapelizVaultToStandard(vaultChangeToStandardRequest: PapelizVaultChangeToStandardRequest): Promise<PapelizVaultEncryptionKindChangeResult> {
  const endToEndVaultAdapter = readPapelizEndToEndEncryptingVaultAdapter(vaultChangeToStandardRequest.endToEndVaultAdapter)
  if (endToEndVaultAdapter === null) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already Standard' }
  if (endToEndVaultAdapter.isEndToEndVaultLocked()) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Locked' }
  try {
    const storedVaultAdapter = endToEndVaultAdapter.readStoredVaultAdapterForEncryption()
    const passphraseCheck = await verifyPapelizVaultPassphrase(storedVaultAdapter, vaultChangeToStandardRequest.vaultPassphrase, vaultChangeToStandardRequest.onVaultPassphraseKeyProgress)
    if (passphraseCheck === 'wrong-passphrase') return { vaultEncryptionKindChangeOutcome: 'wrong-passphrase' }
    if (typeof passphraseCheck === 'string') return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: passphraseCheck }
    passphraseCheck.vaultEncryptionKeyBytes.fill(0)
    await writePapelizVaultEncryptionSettingsFile(storedVaultAdapter, { ...passphraseCheck.endToEndVaultEncryptionSettings, unfinishedVaultEncryptionKindChange: 'to-standard' })
    endToEndVaultAdapter.noteVaultEncryptionKindChange('to-standard')
  } catch (kindChangeStartError) {
    return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(kindChangeStartError) }
  }
  const kindChangeResult = await finishChangeToStandard(endToEndVaultAdapter, vaultChangeToStandardRequest.onVaultEncryptionKindChangeProgress)
  if (kindChangeResult.vaultEncryptionKindChangeOutcome === 'changed' && vaultChangeToStandardRequest.papelizVaultId !== undefined) {
    await recordPapelizRecentVaultEncryptionKind({ papelizVaultId: vaultChangeToStandardRequest.papelizVaultId, papelizVaultEncryptionKind: 'standard', papelizEncryptedVaultId: null })
  }
  return kindChangeResult
}

// Carrying on ------------------------------------------------------------------------------------------------

export async function finishPapelizVaultEncryptionKindChange(
  endToEndVaultAdapter: PapelizVaultAdapter,
  onVaultEncryptionKindChangeProgress?: PapelizVaultEncryptionKindChangeProgressListener,
): Promise<PapelizVaultEncryptionKindChangeResult> {
  const endToEndEncryptingVaultAdapter = readPapelizEndToEndEncryptingVaultAdapter(endToEndVaultAdapter)
  if (endToEndEncryptingVaultAdapter === null) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already Standard' }
  if (endToEndEncryptingVaultAdapter.isEndToEndVaultLocked()) return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Locked' }
  const unfinishedVaultEncryptionKindChange = endToEndEncryptingVaultAdapter.unfinishedVaultEncryptionKindChange
  if (unfinishedVaultEncryptionKindChange === null) return { vaultEncryptionKindChangeOutcome: 'changed', changedVaultAdapter: endToEndEncryptingVaultAdapter }
  if (unfinishedVaultEncryptionKindChange === 'to-standard') return finishChangeToStandard(endToEndEncryptingVaultAdapter, onVaultEncryptionKindChangeProgress)
  let endToEndVaultEncryptionSettings: PapelizEndToEndVaultEncryptionSettings | string
  try {
    endToEndVaultEncryptionSettings = await readPapelizEndToEndVaultEncryptionSettings(endToEndEncryptingVaultAdapter.readStoredVaultAdapterForEncryption())
  } catch (settingsReadError) {
    return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(settingsReadError) }
  }
  if (typeof endToEndVaultEncryptionSettings === 'string') return { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: endToEndVaultEncryptionSettings }
  return finishChangeToEndToEnd(endToEndEncryptingVaultAdapter, endToEndVaultEncryptionSettings, onVaultEncryptionKindChangeProgress)
}

// Change Passphrase ---------------------------------------------------------------------------------------------

export async function changePapelizEndToEndVaultPassphrase(vaultPassphraseChangeRequest: PapelizVaultPassphraseChangeRequest): Promise<PapelizVaultPassphraseChangeResult> {
  const endToEndVaultAdapter = readPapelizEndToEndEncryptingVaultAdapter(vaultPassphraseChangeRequest.endToEndVaultAdapter)
  if (endToEndVaultAdapter === null) return { vaultPassphraseChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already Standard' }
  if (endToEndVaultAdapter.isEndToEndVaultLocked()) return { vaultPassphraseChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Vault Locked' }
  const vaultPassphraseProblem = findPapelizVaultPassphraseProblem(vaultPassphraseChangeRequest.newVaultPassphrase)
  if (vaultPassphraseProblem !== null) return { vaultPassphraseChangeOutcome: 'failed', vaultEncryptionFailureCode: vaultPassphraseProblem }
  try {
    const storedVaultAdapter = endToEndVaultAdapter.readStoredVaultAdapterForEncryption()
    // Each Argon2id run reports its own half of the progress.
    const onVaultPassphraseKeyProgress = vaultPassphraseChangeRequest.onVaultPassphraseKeyProgress
    const passphraseCheck = await verifyPapelizVaultPassphrase(
      storedVaultAdapter,
      vaultPassphraseChangeRequest.currentVaultPassphrase,
      onVaultPassphraseKeyProgress ? (progressFraction) => onVaultPassphraseKeyProgress(progressFraction / 2) : undefined,
    )
    if (passphraseCheck === 'wrong-passphrase') return { vaultPassphraseChangeOutcome: 'wrong-passphrase' }
    if (typeof passphraseCheck === 'string') return { vaultPassphraseChangeOutcome: 'failed', vaultEncryptionFailureCode: passphraseCheck }
    const { endToEndVaultEncryptionSettings, vaultEncryptionKeyBytes } = passphraseCheck
    try {
      const vaultPassphraseWrappedKey = await wrapPapelizVaultKeyWithPassphrase({
        papelizEncryptedVaultId: endToEndVaultEncryptionSettings.papelizEncryptedVaultId,
        vaultEncryptionKeyBytes,
        vaultPassphrase: vaultPassphraseChangeRequest.newVaultPassphrase,
        ...(onVaultPassphraseKeyProgress ? { onArgon2idProgress: (progressFraction: number) => onVaultPassphraseKeyProgress(0.5 + progressFraction / 2) } : {}),
      })
      await writePapelizVaultEncryptionSettingsFile(storedVaultAdapter, { ...endToEndVaultEncryptionSettings, vaultPassphraseWrappedKey })
    } finally {
      vaultEncryptionKeyBytes.fill(0)
    }
    return { vaultPassphraseChangeOutcome: 'changed' }
  } catch (passphraseChangeError) {
    return { vaultPassphraseChangeOutcome: 'failed', vaultEncryptionFailureCode: describePapelizVaultEncryptionCaughtError(passphraseChangeError) }
  }
}
