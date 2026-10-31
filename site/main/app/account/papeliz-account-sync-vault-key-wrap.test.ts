import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import papelizAccountSyncVaultKeyWrapTestVectors from './papeliz-account-sync-vault-key-wrap-test-vectors.json'
import {
  derivePapelizAccountSyncPassphraseKeyBytes,
  isPapelizAccountSyncPassphraseWrappedVaultKey,
  papelizAccountSyncDefaultArgon2idSettings,
  PapelizAccountSyncVaultKeyWrapError,
  rewrapPapelizAccountSyncVaultKeyWithNewPassphrase,
  unwrapPapelizAccountSyncVaultKeyWithPassphrase,
  wrapPapelizAccountSyncVaultKeyWithPassphrase,
  type PapelizAccountSyncPassphraseWrappedVaultKey,
} from './papeliz-account-sync-vault-key-wrap'

// The account page's copy of the v2 vault key wrap, checked against Papeliz Sync's own test vectors.
// The vectors are copied beside this test, so the site builds and tests without Sync's code; when
// Sync's code is in the same checkout, the copy is also checked against Sync's file.

type PapelizAccountSyncPassphraseWrapTestVector = (typeof papelizAccountSyncVaultKeyWrapTestVectors.passphraseWrapVectors)[number]

const papelizAccountSyncTestVectorsFormat = 'papeliz-sync-encryption-test-vectors-v2'
const papelizSyncPublishedTestVectorsFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../sync/papeliz-sync-protocol/test/vectors/papeliz-sync-encryption-test-vectors.json',
)
// Argon2id at the default settings is slow on purpose, and each check derives a key several times.
const papelizAccountSyncVaultKeyWrapTestTimeoutMilliseconds = 120_000

function decodePapelizAccountTestHex(hexText: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hexText.match(/../g) ?? [], (hexPair) => Number.parseInt(hexPair, 16))
}

function encodePapelizAccountTestHex(plainBytes: Uint8Array): string {
  return Array.from(plainBytes, (plainByte) => plainByte.toString(16).padStart(2, '0')).join('')
}

function readPapelizAccountTestWrappedVaultKey(passphraseWrapVector: PapelizAccountSyncPassphraseWrapTestVector): PapelizAccountSyncPassphraseWrappedVaultKey {
  if (!isPapelizAccountSyncPassphraseWrappedVaultKey(passphraseWrapVector.passphraseWrappedSyncVaultKey)) throw new Error('The test vector’s wrapped copy is malformed')
  return passphraseWrapVector.passphraseWrappedSyncVaultKey
}

async function readPapelizAccountSyncVaultKeyWrapFailureKind(vaultKeyWrapAttempt: Promise<unknown>): Promise<string> {
  try {
    await vaultKeyWrapAttempt
    return 'opened'
  } catch (vaultKeyWrapError) {
    return vaultKeyWrapError instanceof PapelizAccountSyncVaultKeyWrapError ? vaultKeyWrapError.syncVaultKeyWrapFailureKind : 'another error'
  }
}

describe('the account page’s vault key wrap, against Papeliz Sync’s v2 test vectors', () => {
  it('reads the v2 vectors', () => {
    expect(papelizAccountSyncVaultKeyWrapTestVectors.papelizSyncTestVectorsFormat).toBe(papelizAccountSyncTestVectorsFormat)
    expect(papelizAccountSyncVaultKeyWrapTestVectors.passphraseWrapVectors.length).toBeGreaterThan(0)
  })

  it.skipIf(!existsSync(papelizSyncPublishedTestVectorsFile))('has the same passphrase vectors as Papeliz Sync’s own file', () => {
    const papelizSyncPublishedTestVectors = JSON.parse(readFileSync(papelizSyncPublishedTestVectorsFile, 'utf8')) as {
      papelizSyncTestVectorsFormat: string
      passphraseWrapVectors: unknown[]
    }
    expect(papelizSyncPublishedTestVectors.papelizSyncTestVectorsFormat).toBe(papelizAccountSyncVaultKeyWrapTestVectors.papelizSyncTestVectorsFormat)
    expect(papelizSyncPublishedTestVectors.passphraseWrapVectors).toEqual(papelizAccountSyncVaultKeyWrapTestVectors.passphraseWrapVectors)
  })

  for (const passphraseWrapVector of papelizAccountSyncVaultKeyWrapTestVectors.passphraseWrapVectors) {
    it(
      `derives, wraps and unwraps as the vector says: ${passphraseWrapVector.testVectorName}`,
      async () => {
        const syncKeyDerivationSaltBytes = decodePapelizAccountTestHex(passphraseWrapVector.syncKeyDerivationSaltHex)
        const passphraseKeyBytes = await derivePapelizAccountSyncPassphraseKeyBytes(
          passphraseWrapVector.syncVaultPassphrase,
          syncKeyDerivationSaltBytes,
          passphraseWrapVector.argon2idSettings,
        )
        expect(encodePapelizAccountTestHex(passphraseKeyBytes)).toBe(passphraseWrapVector.passphraseKeyHex)

        const passphraseWrappedSyncVaultKey = await wrapPapelizAccountSyncVaultKeyWithPassphrase({
          papelizSyncAccountId: passphraseWrapVector.papelizSyncAccountId,
          papelizSyncVaultId: passphraseWrapVector.papelizSyncVaultId,
          syncVaultKeyBytes: decodePapelizAccountTestHex(passphraseWrapVector.syncVaultKeyHex),
          syncVaultPassphrase: passphraseWrapVector.syncVaultPassphrase,
          argon2idSettings: passphraseWrapVector.argon2idSettings,
          fixedRandomnessForTestVectors: {
            syncKeyDerivationSaltBytes,
            syncKeyWrapNonceBytes: decodePapelizAccountTestHex(passphraseWrapVector.syncKeyWrapNonceHex),
          },
        })
        expect(passphraseWrappedSyncVaultKey).toEqual(passphraseWrapVector.passphraseWrappedSyncVaultKey)

        // The passphrase as given, and as other systems may type it (decomposed accents), open it alike.
        for (const syncVaultPassphrase of [passphraseWrapVector.syncVaultPassphrase, ...passphraseWrapVector.syncVaultPassphraseVariants]) {
          const syncVaultKeyBytes = await unwrapPapelizAccountSyncVaultKeyWithPassphrase({
            papelizSyncAccountId: passphraseWrapVector.papelizSyncAccountId,
            papelizSyncVaultId: passphraseWrapVector.papelizSyncVaultId,
            passphraseWrappedSyncVaultKey: readPapelizAccountTestWrappedVaultKey(passphraseWrapVector),
            syncVaultPassphrase,
          })
          expect(encodePapelizAccountTestHex(syncVaultKeyBytes)).toBe(passphraseWrapVector.syncVaultKeyHex)
        }
      },
      papelizAccountSyncVaultKeyWrapTestTimeoutMilliseconds,
    )
  }

  // The lightest vector, so the failures below stay quick.
  const lightestPassphraseWrapVector = papelizAccountSyncVaultKeyWrapTestVectors.passphraseWrapVectors.reduce((lightestVector, candidateVector) =>
    candidateVector.argon2idSettings.argon2idMemoryKibibytes * candidateVector.argon2idSettings.argon2idPassCount <
    lightestVector.argon2idSettings.argon2idMemoryKibibytes * lightestVector.argon2idSettings.argon2idPassCount
      ? candidateVector
      : lightestVector,
  )

  it(
    'refuses a wrong passphrase, and a copy moved to another vault or account',
    async () => {
      const passphraseWrappedSyncVaultKey = readPapelizAccountTestWrappedVaultKey(lightestPassphraseWrapVector)
      const { papelizSyncAccountId, papelizSyncVaultId, syncVaultPassphrase } = lightestPassphraseWrapVector
      expect(
        await readPapelizAccountSyncVaultKeyWrapFailureKind(
          unwrapPapelizAccountSyncVaultKeyWithPassphrase({ papelizSyncAccountId, papelizSyncVaultId, passphraseWrappedSyncVaultKey, syncVaultPassphrase: `${syncVaultPassphrase}!` }),
        ),
      ).toBe('wrong-passphrase')
      expect(
        await readPapelizAccountSyncVaultKeyWrapFailureKind(
          unwrapPapelizAccountSyncVaultKeyWithPassphrase({
            papelizSyncAccountId,
            papelizSyncVaultId: 'pzvault_anothervaultanothervault2222',
            passphraseWrappedSyncVaultKey,
            syncVaultPassphrase,
          }),
        ),
      ).toBe('wrong-passphrase')
      expect(
        await readPapelizAccountSyncVaultKeyWrapFailureKind(
          unwrapPapelizAccountSyncVaultKeyWithPassphrase({
            papelizSyncAccountId: 'pzacct_eu_anotheraccountanotheraccount22',
            papelizSyncVaultId,
            passphraseWrappedSyncVaultKey,
            syncVaultPassphrase,
          }),
        ),
      ).toBe('wrong-passphrase')
    },
    papelizAccountSyncVaultKeyWrapTestTimeoutMilliseconds,
  )

  it('refuses a copy with settings outside the bounds, or another format, before deriving anything', async () => {
    const passphraseWrappedSyncVaultKey = readPapelizAccountTestWrappedVaultKey(lightestPassphraseWrapVector)
    const { papelizSyncAccountId, papelizSyncVaultId, syncVaultPassphrase } = lightestPassphraseWrapVector
    const copyWithWeakSettings = { ...passphraseWrappedSyncVaultKey, syncKeyDerivation: { ...passphraseWrappedSyncVaultKey.syncKeyDerivation, argon2idMemoryKibibytes: 1024 } }
    const copyWithHugeSettings = { ...passphraseWrappedSyncVaultKey, syncKeyDerivation: { ...passphraseWrappedSyncVaultKey.syncKeyDerivation, argon2idPassCount: 1000 } }
    const copyWithAnotherFormat = { ...passphraseWrappedSyncVaultKey, syncVaultKeyWrapFormat: 'papeliz-sync-vault-key-wrap-v1' }
    const copyWithAnExtraField = { ...passphraseWrappedSyncVaultKey, syncRecoveryKeyHint: 'none' }
    for (const malformedCopy of [copyWithWeakSettings, copyWithHugeSettings, copyWithAnExtraField]) {
      expect(isPapelizAccountSyncPassphraseWrappedVaultKey(malformedCopy)).toBe(false)
      expect(
        await readPapelizAccountSyncVaultKeyWrapFailureKind(
          unwrapPapelizAccountSyncVaultKeyWithPassphrase({
            papelizSyncAccountId,
            papelizSyncVaultId,
            passphraseWrappedSyncVaultKey: malformedCopy as unknown as PapelizAccountSyncPassphraseWrappedVaultKey,
            syncVaultPassphrase,
          }),
        ),
      ).toBe('malformed')
    }
    expect(
      await readPapelizAccountSyncVaultKeyWrapFailureKind(
        unwrapPapelizAccountSyncVaultKeyWithPassphrase({
          papelizSyncAccountId,
          papelizSyncVaultId,
          passphraseWrappedSyncVaultKey: copyWithAnotherFormat as unknown as PapelizAccountSyncPassphraseWrappedVaultKey,
          syncVaultPassphrase,
        }),
      ),
    ).toBe('unsupported-format')
  })

  it(
    'changes the passphrase: the same vault key, a fresh salt and nonce, the default settings, and only the new passphrase opens it',
    async () => {
      const { papelizSyncAccountId, papelizSyncVaultId, syncVaultPassphrase, syncVaultKeyHex } = lightestPassphraseWrapVector
      const passphraseWrappedSyncVaultKey = readPapelizAccountTestWrappedVaultKey(lightestPassphraseWrapVector)
      const newSyncVaultPassphrase = 'a new passphrase for the vault'
      const rewrappedSyncVaultKey = await rewrapPapelizAccountSyncVaultKeyWithNewPassphrase({
        papelizSyncAccountId,
        papelizSyncVaultId,
        passphraseWrappedSyncVaultKey,
        currentSyncVaultPassphrase: syncVaultPassphrase,
        newSyncVaultPassphrase,
      })
      expect(isPapelizAccountSyncPassphraseWrappedVaultKey(rewrappedSyncVaultKey)).toBe(true)
      expect(rewrappedSyncVaultKey.syncKeyDerivation).toMatchObject(papelizAccountSyncDefaultArgon2idSettings)
      expect(rewrappedSyncVaultKey.syncKeyDerivation.syncKeyDerivationSalt).not.toBe(passphraseWrappedSyncVaultKey.syncKeyDerivation.syncKeyDerivationSalt)
      expect(rewrappedSyncVaultKey.syncKeyWrapNonce).not.toBe(passphraseWrappedSyncVaultKey.syncKeyWrapNonce)
      const syncVaultKeyBytes = await unwrapPapelizAccountSyncVaultKeyWithPassphrase({
        papelizSyncAccountId,
        papelizSyncVaultId,
        passphraseWrappedSyncVaultKey: rewrappedSyncVaultKey,
        syncVaultPassphrase: newSyncVaultPassphrase,
      })
      expect(encodePapelizAccountTestHex(syncVaultKeyBytes)).toBe(syncVaultKeyHex)
      expect(
        await readPapelizAccountSyncVaultKeyWrapFailureKind(
          unwrapPapelizAccountSyncVaultKeyWithPassphrase({ papelizSyncAccountId, papelizSyncVaultId, passphraseWrappedSyncVaultKey: rewrappedSyncVaultKey, syncVaultPassphrase }),
        ),
      ).toBe('wrong-passphrase')
    },
    papelizAccountSyncVaultKeyWrapTestTimeoutMilliseconds,
  )

  it('changes nothing for a wrong current passphrase or a new one under 12 characters', async () => {
    const { papelizSyncAccountId, papelizSyncVaultId, syncVaultPassphrase } = lightestPassphraseWrapVector
    const passphraseWrappedSyncVaultKey = readPapelizAccountTestWrappedVaultKey(lightestPassphraseWrapVector)
    expect(
      await readPapelizAccountSyncVaultKeyWrapFailureKind(
        rewrapPapelizAccountSyncVaultKeyWithNewPassphrase({
          papelizSyncAccountId,
          papelizSyncVaultId,
          passphraseWrappedSyncVaultKey,
          currentSyncVaultPassphrase: 'not the passphrase at all',
          newSyncVaultPassphrase: 'a new passphrase for the vault',
        }),
      ),
    ).toBe('wrong-passphrase')
    await expect(
      rewrapPapelizAccountSyncVaultKeyWithNewPassphrase({
        papelizSyncAccountId,
        papelizSyncVaultId,
        passphraseWrappedSyncVaultKey,
        currentSyncVaultPassphrase: syncVaultPassphrase,
        newSyncVaultPassphrase: 'too short',
      }),
    ).rejects.toThrow('at least 12 characters')
  })
})
