import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { openPapelizVaultEncryptionSealedValue, papelizVaultEncryptionSymmetricKeyByteLength, sealPapelizVaultEncryptionValue, toPapelizVaultEncryptionWebCryptoBytes } from './papeliz-vault-encryption-primitives'
import type { PapelizVaultEncryptionKind } from './papeliz-vault-encryption'
import { waitForPapelizDesktopPlatform } from './papeliz-remembered-vault-folders'

// What vault encryption keeps on this device, outside any vault:
//
// - Remember on This Device. On the web, an End-to-end vault's key is sealed (AES-256-GCM) by a key of
//   its own that WebCrypto made non-extractable, and both sit in this browser's IndexedDB: page code can
//   use the sealing key but never read it out, as Sync's device key. Anyone using this browser profile
//   can open the vault. In Papeliz for Windows the key goes to Windows Credential Manager through the
//   desktop platform instead (papeliz-desktop-platform-contract.ts).
// - Each Recent Vaults row's kind, so the start screen shows the End-to-end badge and Unlock before the
//   folder is reached again.
//
// Both live in a database of their own, `papeliz-vault-encryption-database`, so the app's main database
// (papeliz-browser-database.ts) needs no new version for them.

const papelizVaultEncryptionDatabaseName = 'papeliz-vault-encryption-database'
const papelizVaultEncryptionDatabaseVersion = 1
const papelizRememberedVaultEncryptionKeysStoreName = 'papelizRememberedVaultEncryptionKeys'
const papelizRecentVaultEncryptionKindsStoreName = 'papelizRecentVaultEncryptionKinds'
const papelizRememberedVaultKeySealLabel = 'papeliz-vault-encryption-remembered-key-v1'

export interface PapelizRememberedVaultEncryptionKeyRecord {
  papelizEncryptedVaultId: string
  // Non-extractable AES-GCM; IndexedDB keeps the CryptoKey as it is.
  rememberingDeviceKey: CryptoKey
  sealedVaultEncryptionKey: Uint8Array<ArrayBuffer>
}

export interface PapelizRecentVaultEncryptionKindRecord {
  // The Recent Vaults row's own ID (papeliz-remembered-vault-folders.ts, papeliz-browser-vaults.ts).
  papelizVaultId: string
  papelizVaultEncryptionKind: PapelizVaultEncryptionKind
  papelizEncryptedVaultId: string | null
}

// Where the web's records go: IndexedDB in the app, a map in tests.
export interface PapelizVaultEncryptionDeviceRecordStore {
  readRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId: string): Promise<PapelizRememberedVaultEncryptionKeyRecord | undefined>
  putRememberedVaultEncryptionKeyRecord(rememberedVaultEncryptionKeyRecord: PapelizRememberedVaultEncryptionKeyRecord): Promise<void>
  deleteRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId: string): Promise<void>
  readAllRecentVaultEncryptionKindRecords(): Promise<PapelizRecentVaultEncryptionKindRecord[]>
  putRecentVaultEncryptionKindRecord(recentVaultEncryptionKindRecord: PapelizRecentVaultEncryptionKindRecord): Promise<void>
}

let papelizVaultEncryptionDatabasePromise: Promise<IDBDatabase> | null = null

function openPapelizVaultEncryptionDatabase(): Promise<IDBDatabase> {
  papelizVaultEncryptionDatabasePromise ??= new Promise<IDBDatabase>((resolveDatabase, rejectDatabase) => {
    const databaseOpenRequest = indexedDB.open(papelizVaultEncryptionDatabaseName, papelizVaultEncryptionDatabaseVersion)
    databaseOpenRequest.onupgradeneeded = () => {
      const vaultEncryptionDatabase = databaseOpenRequest.result
      // Each version only adds what is missing. Version 1: remembered keys and the rows' kinds.
      if (!vaultEncryptionDatabase.objectStoreNames.contains(papelizRememberedVaultEncryptionKeysStoreName)) {
        vaultEncryptionDatabase.createObjectStore(papelizRememberedVaultEncryptionKeysStoreName, { keyPath: 'papelizEncryptedVaultId' })
      }
      if (!vaultEncryptionDatabase.objectStoreNames.contains(papelizRecentVaultEncryptionKindsStoreName)) {
        vaultEncryptionDatabase.createObjectStore(papelizRecentVaultEncryptionKindsStoreName, { keyPath: 'papelizVaultId' })
      }
    }
    databaseOpenRequest.onsuccess = () => {
      const vaultEncryptionDatabase = databaseOpenRequest.result
      vaultEncryptionDatabase.onversionchange = () => {
        vaultEncryptionDatabase.close()
        papelizVaultEncryptionDatabasePromise = null
      }
      resolveDatabase(vaultEncryptionDatabase)
    }
    databaseOpenRequest.onerror = () => {
      papelizVaultEncryptionDatabasePromise = null
      rejectDatabase(databaseOpenRequest.error ?? new Error('The vault encryption database could not be opened.'))
    }
  })
  return papelizVaultEncryptionDatabasePromise
}

async function runPapelizVaultEncryptionDatabaseRequest<RequestResult>(
  objectStoreName: string,
  transactionMode: IDBTransactionMode,
  makeDatabaseRequest: (objectStore: IDBObjectStore) => IDBRequest<RequestResult>,
): Promise<RequestResult> {
  const vaultEncryptionDatabase = await openPapelizVaultEncryptionDatabase()
  const databaseRequest = makeDatabaseRequest(vaultEncryptionDatabase.transaction(objectStoreName, transactionMode).objectStore(objectStoreName))
  return new Promise((resolveRequest, rejectRequest) => {
    databaseRequest.onsuccess = () => resolveRequest(databaseRequest.result)
    databaseRequest.onerror = () => rejectRequest(databaseRequest.error ?? new Error('A vault encryption database request failed.'))
  })
}

const papelizIndexedDbVaultEncryptionDeviceRecordStore: PapelizVaultEncryptionDeviceRecordStore = {
  readRememberedVaultEncryptionKeyRecord: (papelizEncryptedVaultId) =>
    runPapelizVaultEncryptionDatabaseRequest(papelizRememberedVaultEncryptionKeysStoreName, 'readonly', (objectStore) =>
      objectStore.get(papelizEncryptedVaultId) as IDBRequest<PapelizRememberedVaultEncryptionKeyRecord | undefined>,
    ),
  putRememberedVaultEncryptionKeyRecord: async (rememberedVaultEncryptionKeyRecord) => {
    await runPapelizVaultEncryptionDatabaseRequest(papelizRememberedVaultEncryptionKeysStoreName, 'readwrite', (objectStore) => objectStore.put(rememberedVaultEncryptionKeyRecord))
  },
  deleteRememberedVaultEncryptionKeyRecord: async (papelizEncryptedVaultId) => {
    await runPapelizVaultEncryptionDatabaseRequest(papelizRememberedVaultEncryptionKeysStoreName, 'readwrite', (objectStore) => objectStore.delete(papelizEncryptedVaultId))
  },
  readAllRecentVaultEncryptionKindRecords: () =>
    runPapelizVaultEncryptionDatabaseRequest(papelizRecentVaultEncryptionKindsStoreName, 'readonly', (objectStore) => objectStore.getAll() as IDBRequest<PapelizRecentVaultEncryptionKindRecord[]>),
  putRecentVaultEncryptionKindRecord: async (recentVaultEncryptionKindRecord) => {
    await runPapelizVaultEncryptionDatabaseRequest(papelizRecentVaultEncryptionKindsStoreName, 'readwrite', (objectStore) => objectStore.put(recentVaultEncryptionKindRecord))
  },
}

// Tests give a store of their own, and say whether a desktop platform is there.
let papelizVaultEncryptionDeviceRecordStoreForTests: PapelizVaultEncryptionDeviceRecordStore | null = null
let papelizVaultEncryptionDesktopPlatformForTests: PapelizDesktopPlatform | null | undefined

export function usePapelizVaultEncryptionDeviceStoreForTests(
  deviceRecordStoreForTests: PapelizVaultEncryptionDeviceRecordStore | null,
  desktopPlatformForTests?: PapelizDesktopPlatform | null,
): void {
  papelizVaultEncryptionDeviceRecordStoreForTests = deviceRecordStoreForTests
  papelizVaultEncryptionDesktopPlatformForTests = desktopPlatformForTests
}

function readPapelizVaultEncryptionDeviceRecordStore(): PapelizVaultEncryptionDeviceRecordStore | null {
  if (papelizVaultEncryptionDeviceRecordStoreForTests !== null) return papelizVaultEncryptionDeviceRecordStoreForTests
  return typeof indexedDB === 'undefined' ? null : papelizIndexedDbVaultEncryptionDeviceRecordStore
}

async function readPapelizVaultEncryptionDesktopPlatform(): Promise<PapelizDesktopPlatform | null> {
  if (papelizVaultEncryptionDesktopPlatformForTests !== undefined) return papelizVaultEncryptionDesktopPlatformForTests
  if (papelizVaultEncryptionDeviceRecordStoreForTests !== null) return null
  return waitForPapelizDesktopPlatform()
}

// Remembered keys ------------------------------------------------------------------------------------------

function buildRememberedVaultKeySealAssociatedDataFields(papelizEncryptedVaultId: string): string[] {
  return [papelizRememberedVaultKeySealLabel, papelizEncryptedVaultId]
}

// Throws when this device can keep no keys.
export async function rememberPapelizVaultEncryptionKeyBytes(papelizEncryptedVaultId: string, vaultEncryptionKeyBytes: Uint8Array): Promise<void> {
  const papelizDesktopPlatform = await readPapelizVaultEncryptionDesktopPlatform()
  if (papelizDesktopPlatform !== null) {
    await papelizDesktopPlatform.rememberDesktopVaultEncryptionKey(papelizEncryptedVaultId, vaultEncryptionKeyBytes)
    return
  }
  const deviceRecordStore = readPapelizVaultEncryptionDeviceRecordStore()
  if (deviceRecordStore === null) throw new Error('This browser keeps no storage')
  const rememberingDeviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  if ('privateKey' in rememberingDeviceKey) throw new Error('AES-GCM made a key pair')
  await deviceRecordStore.putRememberedVaultEncryptionKeyRecord({
    papelizEncryptedVaultId,
    rememberingDeviceKey,
    sealedVaultEncryptionKey: await sealPapelizVaultEncryptionValue(
      rememberingDeviceKey,
      vaultEncryptionKeyBytes,
      buildRememberedVaultKeySealAssociatedDataFields(papelizEncryptedVaultId),
    ),
  })
}

// The remembered key's 32 bytes, or null when none is kept (or the one kept no longer opens: it is
// then forgotten).
export async function readRememberedPapelizVaultEncryptionKeyBytes(papelizEncryptedVaultId: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const papelizDesktopPlatform = await readPapelizVaultEncryptionDesktopPlatform()
  if (papelizDesktopPlatform !== null) {
    const rememberedDesktopKeyBytes = await papelizDesktopPlatform.readRememberedDesktopVaultEncryptionKey(papelizEncryptedVaultId)
    if (rememberedDesktopKeyBytes === null) return null
    if (rememberedDesktopKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) {
      await papelizDesktopPlatform.forgetRememberedDesktopVaultEncryptionKey(papelizEncryptedVaultId)
      return null
    }
    return toPapelizVaultEncryptionWebCryptoBytes(rememberedDesktopKeyBytes)
  }
  const deviceRecordStore = readPapelizVaultEncryptionDeviceRecordStore()
  if (deviceRecordStore === null) return null
  const rememberedKeyRecord = await deviceRecordStore.readRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId)
  if (rememberedKeyRecord === undefined) return null
  try {
    const vaultEncryptionKeyBytes = await openPapelizVaultEncryptionSealedValue(
      rememberedKeyRecord.rememberingDeviceKey,
      rememberedKeyRecord.sealedVaultEncryptionKey,
      buildRememberedVaultKeySealAssociatedDataFields(papelizEncryptedVaultId),
    )
    if (vaultEncryptionKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new Error('A vault key is 32 bytes')
    return vaultEncryptionKeyBytes
  } catch {
    await deviceRecordStore.deleteRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId)
    return null
  }
}

export async function forgetRememberedPapelizVaultEncryptionKey(papelizEncryptedVaultId: string): Promise<void> {
  const papelizDesktopPlatform = await readPapelizVaultEncryptionDesktopPlatform()
  if (papelizDesktopPlatform !== null) {
    await papelizDesktopPlatform.forgetRememberedDesktopVaultEncryptionKey(papelizEncryptedVaultId)
    return
  }
  await readPapelizVaultEncryptionDeviceRecordStore()?.deleteRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId)
}

export async function isPapelizVaultEncryptionKeyRemembered(papelizEncryptedVaultId: string): Promise<boolean> {
  const papelizDesktopPlatform = await readPapelizVaultEncryptionDesktopPlatform()
  if (papelizDesktopPlatform !== null) {
    const rememberedDesktopKeyBytes = await papelizDesktopPlatform.readRememberedDesktopVaultEncryptionKey(papelizEncryptedVaultId)
    rememberedDesktopKeyBytes?.fill(0)
    return rememberedDesktopKeyBytes !== null
  }
  const deviceRecordStore = readPapelizVaultEncryptionDeviceRecordStore()
  return deviceRecordStore === null ? false : (await deviceRecordStore.readRememberedVaultEncryptionKeyRecord(papelizEncryptedVaultId)) !== undefined
}

// Recent Vaults' kinds ---------------------------------------------------------------------------------------

// Keeps a row's kind as the vault was just found. Never fails: a row without it reads as Standard.
export async function recordPapelizRecentVaultEncryptionKind(recentVaultEncryptionKindRecord: PapelizRecentVaultEncryptionKindRecord): Promise<void> {
  try {
    await readPapelizVaultEncryptionDeviceRecordStore()?.putRecentVaultEncryptionKindRecord(recentVaultEncryptionKindRecord)
  } catch {
    // The start screen's badge waits for the next open.
  }
}

export async function readPapelizRecentVaultEncryptionKindRecords(): Promise<Map<string, PapelizRecentVaultEncryptionKindRecord>> {
  try {
    const recentVaultEncryptionKindRecords = (await readPapelizVaultEncryptionDeviceRecordStore()?.readAllRecentVaultEncryptionKindRecords()) ?? []
    return new Map(recentVaultEncryptionKindRecords.map((kindRecord) => [kindRecord.papelizVaultId, kindRecord]))
  } catch {
    return new Map()
  }
}
