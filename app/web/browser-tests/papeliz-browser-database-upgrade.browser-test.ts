import { expect, test } from '@playwright/test'

// The browser database's upgrade in a real browser. Version 6 adds each vault's remembered tabs
// (`papelizWorkspaceLayout`); a browser that has version 5 from an earlier visit keeps every store
// and every record it had.

const papelizBrowserDatabaseVersion5StoreKeyPaths = {
  papelizVaultFolderHandles: 'papelizVaultId',
  papelizUserSettings: 'papelizUserSettingName',
  papelizAssistantProviderKeys: 'papelizAssistantProviderId',
  papelizNoteRecoveryDrafts: 'noteRecoveryDraftKey',
  papelizBrowserVaults: 'papelizVaultId',
}

// One record in each store that holds data the app reads at start; the folder handles stay empty,
// since a stored handle can only come from the folder picker.
const papelizBrowserDatabaseVersion5Records = {
  papelizUserSettings: [{ papelizUserSettingName: 'papelizUpgradeTestSetting', papelizUserSettingValue: 'kept' }],
  papelizAssistantProviderKeys: [{ papelizAssistantProviderId: 'papeliz-upgrade-test-provider' }],
  papelizNoteRecoveryDrafts: [
    {
      noteRecoveryDraftKey: 'papeliz-upgrade-test-vault\nInbox.md',
      papelizVaultId: 'papeliz-upgrade-test-vault',
      vaultNoteRelativePath: 'Inbox.md',
      recoveryDraftVaultNoteText: '# Inbox\n\ntyped before the upgrade',
      recoveryDraftBaseVaultNoteText: '# Inbox',
      recoveryDraftWrittenAt: '2026-10-31T09:00:00.000Z',
    },
  ],
  papelizBrowserVaults: [
    {
      papelizVaultId: 'papeliz-upgrade-test-vault',
      papelizVaultDisplayName: 'Kept Through The Upgrade',
      papelizBrowserVaultCreatedAt: 1793440800000,
      papelizVaultLastOpenedAt: 1793440800000,
      papelizVaultHiddenAt: null,
      papelizBrowserVaultLastBackupAt: null,
      papelizBrowserVaultFirstChangeSinceBackupAt: null,
      papelizBrowserVaultBackupReminderOn: true,
      papelizBrowserVaultBackupReminderIntervalMinutes: 1440,
      papelizBrowserVaultBackupReminderShownAt: null,
    },
  ],
}

test('upgrading the browser database from version 5 keeps every store and record', async ({ page }) => {
  // A file of the same site that runs none of Papeliz, so nothing opens the database before it is
  // made as version 5.
  await page.goto('/papeliz-favicon.svg')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
  // The browser vault's own folder, without which the start page takes its row off the list.
  await page.evaluate(async (browserVaultId) => {
    const browserVaultsFolder = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-browser-vaults', { create: true })
    await browserVaultsFolder.getDirectoryHandle(browserVaultId, { create: true })
  }, papelizBrowserDatabaseVersion5Records.papelizBrowserVaults[0]!.papelizVaultId)
  await page.evaluate(
    ({ version5StoreKeyPaths, version5Records }) =>
      new Promise<void>((resolveVersion5, rejectVersion5) => {
        const version5OpenRequest = indexedDB.open('papeliz-browser-database', 5)
        version5OpenRequest.onupgradeneeded = () => {
          for (const [objectStoreName, objectStoreKeyPath] of Object.entries(version5StoreKeyPaths)) {
            version5OpenRequest.result.createObjectStore(objectStoreName, { keyPath: objectStoreKeyPath })
          }
          const version5Transaction = version5OpenRequest.transaction!
          for (const [objectStoreName, storedRecords] of Object.entries(version5Records)) {
            for (const storedRecord of storedRecords) version5Transaction.objectStore(objectStoreName).put(storedRecord)
          }
        }
        version5OpenRequest.onsuccess = () => {
          version5OpenRequest.result.close()
          resolveVersion5()
        }
        version5OpenRequest.onerror = () => rejectVersion5(version5OpenRequest.error)
      }),
    { version5StoreKeyPaths: papelizBrowserDatabaseVersion5StoreKeyPaths, version5Records: papelizBrowserDatabaseVersion5Records },
  )

  // The start page lists the browser vaults, which opens the database and so upgrades it.
  await page.goto('/')
  await expect(page.getByText('Kept Through The Upgrade')).toBeVisible()

  const upgradedDatabase = await page.evaluate(
    (version5StoreNames) =>
      new Promise<{ databaseVersion: number; objectStoreNames: string[]; recordsByStoreName: Record<string, unknown[]> }>((resolveUpgraded, rejectUpgraded) => {
        const upgradedOpenRequest = indexedDB.open('papeliz-browser-database')
        upgradedOpenRequest.onerror = () => rejectUpgraded(upgradedOpenRequest.error)
        upgradedOpenRequest.onsuccess = () => {
          const upgradedPapelizDatabase = upgradedOpenRequest.result
          const objectStoreNames = [...upgradedPapelizDatabase.objectStoreNames].sort()
          const readTransaction = upgradedPapelizDatabase.transaction(version5StoreNames, 'readonly')
          const recordsByStoreName: Record<string, unknown[]> = {}
          for (const objectStoreName of version5StoreNames) {
            const readAllRequest = readTransaction.objectStore(objectStoreName).getAll()
            readAllRequest.onsuccess = () => (recordsByStoreName[objectStoreName] = readAllRequest.result)
          }
          readTransaction.oncomplete = () => {
            upgradedPapelizDatabase.close()
            resolveUpgraded({ databaseVersion: upgradedPapelizDatabase.version, objectStoreNames, recordsByStoreName })
          }
          readTransaction.onerror = () => rejectUpgraded(readTransaction.error)
        }
      }),
    Object.keys(papelizBrowserDatabaseVersion5StoreKeyPaths),
  )

  expect(upgradedDatabase.databaseVersion).toBe(6)
  expect(upgradedDatabase.objectStoreNames).toEqual([...Object.keys(papelizBrowserDatabaseVersion5StoreKeyPaths), 'papelizWorkspaceLayout'].sort())
  expect(upgradedDatabase.recordsByStoreName['papelizVaultFolderHandles']).toEqual([])
  for (const [objectStoreName, storedRecords] of Object.entries(papelizBrowserDatabaseVersion5Records)) {
    expect(upgradedDatabase.recordsByStoreName[objectStoreName], objectStoreName).toEqual(storedRecords)
  }
})
