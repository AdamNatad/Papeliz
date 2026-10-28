// A thin typed wrapper over Papeliz's one IndexedDB database. Notes never
// live here: only app data such as the folders the user opened.

const papelizBrowserDatabaseName = 'papeliz-browser-database'
const papelizBrowserDatabaseVersion = 4

export const papelizVaultFolderHandlesStoreName = 'papelizVaultFolderHandles'
export const papelizUserSettingsStoreName = 'papelizUserSettings'
export const papelizAssistantProviderKeysStoreName = 'papelizAssistantProviderKeys'
// Recovery copies of unsaved typing (papeliz-note-recovery-drafts.ts).
export const papelizNoteRecoveryDraftsStoreName = 'papelizNoteRecoveryDrafts'

let papelizBrowserDatabasePromise: Promise<IDBDatabase> | null = null

export function isPapelizBrowserDatabaseAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openPapelizBrowserDatabase(): Promise<IDBDatabase> {
  papelizBrowserDatabasePromise ??= new Promise<IDBDatabase>((resolveDatabase, rejectDatabase) => {
    const databaseOpenRequest = indexedDB.open(papelizBrowserDatabaseName, papelizBrowserDatabaseVersion)
    databaseOpenRequest.onupgradeneeded = () => {
      const papelizBrowserDatabase = databaseOpenRequest.result
      // Each version only adds what is missing and never wipes what is already stored.
      // Version 1: the folders the user opened. Version 2: the user's settings (the theme).
      // Version 3: each assistant provider's base URL, model and API key. Version 4: recovery copies
      // of unsaved typing.
      if (!papelizBrowserDatabase.objectStoreNames.contains(papelizVaultFolderHandlesStoreName)) {
        papelizBrowserDatabase.createObjectStore(papelizVaultFolderHandlesStoreName, { keyPath: 'papelizVaultId' })
      }
      if (!papelizBrowserDatabase.objectStoreNames.contains(papelizUserSettingsStoreName)) {
        papelizBrowserDatabase.createObjectStore(papelizUserSettingsStoreName, { keyPath: 'papelizUserSettingName' })
      }
      if (!papelizBrowserDatabase.objectStoreNames.contains(papelizAssistantProviderKeysStoreName)) {
        papelizBrowserDatabase.createObjectStore(papelizAssistantProviderKeysStoreName, { keyPath: 'papelizAssistantProviderId' })
      }
      if (!papelizBrowserDatabase.objectStoreNames.contains(papelizNoteRecoveryDraftsStoreName)) {
        papelizBrowserDatabase.createObjectStore(papelizNoteRecoveryDraftsStoreName, { keyPath: 'noteRecoveryDraftKey' })
      }
    }
    databaseOpenRequest.onsuccess = () => resolveDatabase(databaseOpenRequest.result)
    databaseOpenRequest.onerror = () => {
      papelizBrowserDatabasePromise = null
      rejectDatabase(databaseOpenRequest.error ?? new Error('The browser database could not be opened.'))
    }
  })
  return papelizBrowserDatabasePromise
}

function waitForDatabaseRequest<RequestResult>(databaseRequest: IDBRequest<RequestResult>): Promise<RequestResult> {
  return new Promise((resolveRequest, rejectRequest) => {
    databaseRequest.onsuccess = () => resolveRequest(databaseRequest.result)
    databaseRequest.onerror = () => rejectRequest(databaseRequest.error ?? new Error('A browser database request failed.'))
  })
}

export async function readPapelizBrowserDatabaseRecord<StoredRecord>(objectStoreName: string, storedRecordKey: IDBValidKey): Promise<StoredRecord | undefined> {
  const papelizBrowserDatabase = await openPapelizBrowserDatabase()
  const readTransaction = papelizBrowserDatabase.transaction(objectStoreName, 'readonly')
  return waitForDatabaseRequest(readTransaction.objectStore(objectStoreName).get(storedRecordKey) as IDBRequest<StoredRecord | undefined>)
}

export async function readAllPapelizBrowserDatabaseRecords<StoredRecord>(objectStoreName: string): Promise<StoredRecord[]> {
  const papelizBrowserDatabase = await openPapelizBrowserDatabase()
  const readTransaction = papelizBrowserDatabase.transaction(objectStoreName, 'readonly')
  return waitForDatabaseRequest(readTransaction.objectStore(objectStoreName).getAll() as IDBRequest<StoredRecord[]>)
}

export async function putPapelizBrowserDatabaseRecord<StoredRecord>(objectStoreName: string, storedRecord: StoredRecord): Promise<void> {
  const papelizBrowserDatabase = await openPapelizBrowserDatabase()
  const writeTransaction = papelizBrowserDatabase.transaction(objectStoreName, 'readwrite')
  await waitForDatabaseRequest(writeTransaction.objectStore(objectStoreName).put(storedRecord))
}

export async function deletePapelizBrowserDatabaseRecord(objectStoreName: string, storedRecordKey: IDBValidKey): Promise<void> {
  const papelizBrowserDatabase = await openPapelizBrowserDatabase()
  const writeTransaction = papelizBrowserDatabase.transaction(objectStoreName, 'readwrite')
  await waitForDatabaseRequest(writeTransaction.objectStore(objectStoreName).delete(storedRecordKey))
}
