import { isPapelizEncryptedVaultId } from './papeliz-vault-encryption-format'
import { papelizVaultKeyWrapFormat, papelizVaultArgon2idSaltByteLength, type PapelizVaultPassphraseWrappedKey } from './papeliz-vault-encryption-passphrase-key'
import { decodePapelizVaultEncryptionBase64Url, papelizVaultEncryptionAesGcmNonceByteLength } from './papeliz-vault-encryption-primitives'
import type { PapelizVaultAdapter } from './papeliz-vault-adapter'

// `.papeliz/vault-encryption.json`: the one file an End-to-end vault keeps plain in `.papeliz/`, since
// it is read before the vault is unlocked. It holds nothing secret: the passphrase-wrapped key, the
// settings that turn the passphrase into its key, a key check, and the vault's own ID. A Standard vault
// either has no such file or one saying `"standard"` (left by a change back to Standard).
//
//   {
//     "papelizVaultEncryptionFormatVersion": 1,
//     "papelizVaultEncryptionKind": "end-to-end",
//     "papelizEncryptedVaultId": "pzvault_…",
//     "vaultPassphraseWrappedKey": { "vaultKeyWrapFormat": "papeliz-vault-encryption-key-wrap-v1", … },
//     "sealedVaultKeyCheck": "<base64url>",
//     "unfinishedVaultEncryptionKindChange": null
//   }

export const papelizVaultEncryptionSettingsFileFormatVersion = 1
export const papelizVaultEncryptionSettingsFileName = 'vault-encryption.json'

export type PapelizVaultEncryptionSettingsFileContents =
  | {
      papelizVaultEncryptionFormatVersion: typeof papelizVaultEncryptionSettingsFileFormatVersion
      papelizVaultEncryptionKind: 'standard'
    }
  | {
      papelizVaultEncryptionFormatVersion: typeof papelizVaultEncryptionSettingsFileFormatVersion
      papelizVaultEncryptionKind: 'end-to-end'
      papelizEncryptedVaultId: string
      vaultPassphraseWrappedKey: PapelizVaultPassphraseWrappedKey
      sealedVaultKeyCheck: string
      unfinishedVaultEncryptionKindChange: 'to-end-to-end' | 'to-standard' | null
    }

export type PapelizEndToEndVaultEncryptionSettings = Extract<PapelizVaultEncryptionSettingsFileContents, { papelizVaultEncryptionKind: 'end-to-end' }>

export type PapelizVaultEncryptionSettingsReadResult =
  | { vaultEncryptionSettingsReadOutcome: 'read'; vaultEncryptionSettings: PapelizVaultEncryptionSettingsFileContents }
  // No file: a Standard vault.
  | { vaultEncryptionSettingsReadOutcome: 'missing' }
  | { vaultEncryptionSettingsReadOutcome: 'failed'; vaultEncryptionFailureCode: 'Encryption Settings Damaged' | 'Made By Newer Papeliz' }

function isPlainRecord(candidateValue: unknown): candidateValue is Record<string, unknown> {
  return typeof candidateValue === 'object' && candidateValue !== null && !Array.isArray(candidateValue)
}

function isBase64UrlOfByteLength(candidateValue: unknown, expectedByteLength: number): boolean {
  if (typeof candidateValue !== 'string') return false
  return decodePapelizVaultEncryptionBase64Url(candidateValue)?.length === expectedByteLength
}

function isPapelizVaultPassphraseWrappedKey(candidateValue: unknown): candidateValue is PapelizVaultPassphraseWrappedKey {
  if (!isPlainRecord(candidateValue) || candidateValue.vaultKeyWrapFormat !== papelizVaultKeyWrapFormat) return false
  const vaultKeyDerivation = candidateValue.vaultKeyDerivation
  if (!isPlainRecord(vaultKeyDerivation) || vaultKeyDerivation.vaultKeyDerivationAlgorithm !== 'argon2id') return false
  const areDerivationSettingsWholeNumbers = ['argon2idMemoryKibibytes', 'argon2idPassCount', 'argon2idParallelism'].every((argon2idSettingName) =>
    Number.isSafeInteger(vaultKeyDerivation[argon2idSettingName]),
  )
  return (
    areDerivationSettingsWholeNumbers &&
    isBase64UrlOfByteLength(vaultKeyDerivation.vaultKeyDerivationSalt, papelizVaultArgon2idSaltByteLength) &&
    isBase64UrlOfByteLength(candidateValue.vaultKeyWrapNonce, papelizVaultEncryptionAesGcmNonceByteLength) &&
    isBase64UrlOfByteLength(candidateValue.wrappedVaultEncryptionKey, 48)
  )
}

export function parsePapelizVaultEncryptionSettingsFile(vaultEncryptionSettingsFileText: string): PapelizVaultEncryptionSettingsReadResult {
  let parsedSettings: unknown
  try {
    parsedSettings = JSON.parse(vaultEncryptionSettingsFileText)
  } catch {
    return { vaultEncryptionSettingsReadOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Settings Damaged' }
  }
  if (!isPlainRecord(parsedSettings) || !Number.isSafeInteger(parsedSettings.papelizVaultEncryptionFormatVersion)) {
    return { vaultEncryptionSettingsReadOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Settings Damaged' }
  }
  if ((parsedSettings.papelizVaultEncryptionFormatVersion as number) > papelizVaultEncryptionSettingsFileFormatVersion) {
    return { vaultEncryptionSettingsReadOutcome: 'failed', vaultEncryptionFailureCode: 'Made By Newer Papeliz' }
  }
  if (parsedSettings.papelizVaultEncryptionFormatVersion !== papelizVaultEncryptionSettingsFileFormatVersion) {
    return { vaultEncryptionSettingsReadOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Settings Damaged' }
  }
  if (parsedSettings.papelizVaultEncryptionKind === 'standard') {
    return {
      vaultEncryptionSettingsReadOutcome: 'read',
      vaultEncryptionSettings: { papelizVaultEncryptionFormatVersion: papelizVaultEncryptionSettingsFileFormatVersion, papelizVaultEncryptionKind: 'standard' },
    }
  }
  const unfinishedVaultEncryptionKindChange = parsedSettings.unfinishedVaultEncryptionKindChange ?? null
  if (
    parsedSettings.papelizVaultEncryptionKind !== 'end-to-end' ||
    !isPapelizEncryptedVaultId(parsedSettings.papelizEncryptedVaultId) ||
    !isPapelizVaultPassphraseWrappedKey(parsedSettings.vaultPassphraseWrappedKey) ||
    typeof parsedSettings.sealedVaultKeyCheck !== 'string' ||
    decodePapelizVaultEncryptionBase64Url(parsedSettings.sealedVaultKeyCheck) === null ||
    (unfinishedVaultEncryptionKindChange !== null && unfinishedVaultEncryptionKindChange !== 'to-end-to-end' && unfinishedVaultEncryptionKindChange !== 'to-standard')
  ) {
    return { vaultEncryptionSettingsReadOutcome: 'failed', vaultEncryptionFailureCode: 'Encryption Settings Damaged' }
  }
  return {
    vaultEncryptionSettingsReadOutcome: 'read',
    vaultEncryptionSettings: {
      papelizVaultEncryptionFormatVersion: papelizVaultEncryptionSettingsFileFormatVersion,
      papelizVaultEncryptionKind: 'end-to-end',
      papelizEncryptedVaultId: parsedSettings.papelizEncryptedVaultId,
      vaultPassphraseWrappedKey: parsedSettings.vaultPassphraseWrappedKey,
      sealedVaultKeyCheck: parsedSettings.sealedVaultKeyCheck,
      unfinishedVaultEncryptionKindChange,
    },
  }
}

export async function readPapelizVaultEncryptionSettingsFile(storedVaultAdapter: PapelizVaultAdapter): Promise<PapelizVaultEncryptionSettingsReadResult> {
  const vaultEncryptionSettingsFileText = await storedVaultAdapter.readPapelizVaultSettingsFile(papelizVaultEncryptionSettingsFileName)
  if (vaultEncryptionSettingsFileText === null) return { vaultEncryptionSettingsReadOutcome: 'missing' }
  return parsePapelizVaultEncryptionSettingsFile(vaultEncryptionSettingsFileText)
}

export async function writePapelizVaultEncryptionSettingsFile(
  storedVaultAdapter: PapelizVaultAdapter,
  vaultEncryptionSettings: PapelizVaultEncryptionSettingsFileContents,
): Promise<void> {
  await storedVaultAdapter.writePapelizVaultSettingsFile(papelizVaultEncryptionSettingsFileName, `${JSON.stringify(vaultEncryptionSettings, null, 2)}\n`)
}
