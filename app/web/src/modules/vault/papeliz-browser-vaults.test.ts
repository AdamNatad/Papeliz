import { describe, expect, it } from 'vitest'
import {
  createPapelizBrowserVault,
  deletePapelizBrowserVault,
  findPapelizBrowserVaultNameProblem,
  listPapelizBrowserVaults,
  openPapelizBrowserVault,
  pickFreePapelizBrowserVaultName,
  readPapelizBrowserVaultRecord,
  renamePapelizBrowserVault,
  setPapelizBrowserVaultHidden,
} from './papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment } from './papeliz-fake-browser-vault-environment.test-support'
import { readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'

describe('the list of browser vaults', () => {
  it('makes a vault: a folder named by its id, its name in .papeliz/, and a row', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeBrowserVaultRecordsById } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultRecord = await createPapelizBrowserVault('  Field Notes ', browserVaultEnvironment)
    expect(browserVaultRecord).toMatchObject({
      papelizVaultDisplayName: 'Field Notes',
      papelizVaultHiddenAt: null,
      papelizBrowserVaultLastBackupAt: null,
      papelizBrowserVaultBackupReminderOn: true,
      papelizBrowserVaultBackupReminderIntervalMinutes: 30,
    })
    expect(fakeBrowserVaultRecordsById.get(browserVaultRecord.papelizVaultId)).toEqual(browserVaultRecord)
    const originPrivateFileSystemContents = await readPapelizFakeVaultFolder(fakeOriginPrivateFileSystemRoot)
    expect(Object.keys(originPrivateFileSystemContents)).toEqual([
      'papeliz-browser-vaults/',
      `papeliz-browser-vaults/${browserVaultRecord.papelizVaultId}/`,
      `papeliz-browser-vaults/${browserVaultRecord.papelizVaultId}/.papeliz/`,
      `papeliz-browser-vaults/${browserVaultRecord.papelizVaultId}/.papeliz/browser-vault.json`,
    ])
  })

  it('refuses a name another browser vault has, ignoring case, and names that can’t be a folder', async () => {
    const { browserVaultEnvironment } = createPapelizFakeBrowserVaultEnvironment()
    await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    await expect(createPapelizBrowserVault('field notes', browserVaultEnvironment)).rejects.toThrow('Name Taken')
    await expect(createPapelizBrowserVault('a/b', browserVaultEnvironment)).rejects.toThrow('Has A Blocked Character')
    await expect(createPapelizBrowserVault('   ', browserVaultEnvironment)).rejects.toThrow('Name Empty')
    expect(findPapelizBrowserVaultNameProblem('x'.repeat(81), [])).toBe('Name Too Long')
    const browserVaultRecords = await listPapelizBrowserVaults(browserVaultEnvironment)
    expect(pickFreePapelizBrowserVaultName('Field Notes', browserVaultRecords)).toBe('Field Notes 2')
    expect(pickFreePapelizBrowserVaultName('Recipes', browserVaultRecords)).toBe('Recipes')
  })

  it('lists the most recently opened first, and opening one brings it back from the Hidden list', async () => {
    const { browserVaultEnvironment, fakeClock } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    fakeClock.fakeCurrentTime += 1000
    await createPapelizBrowserVault('Recipes', browserVaultEnvironment)
    expect((await listPapelizBrowserVaults(browserVaultEnvironment)).map((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName)).toEqual(['Recipes', 'Field Notes'])
    await setPapelizBrowserVaultHidden(fieldNotesRecord, true, browserVaultEnvironment)
    expect((await readPapelizBrowserVaultRecord(fieldNotesRecord.papelizVaultId, browserVaultEnvironment))?.papelizVaultHiddenAt).toBe(fakeClock.fakeCurrentTime)
    fakeClock.fakeCurrentTime += 1000
    const openVaultResult = await openPapelizBrowserVault(fieldNotesRecord, browserVaultEnvironment)
    expect(openVaultResult.openVaultOutcome).toBe('opened')
    const listedBrowserVaultRecords = await listPapelizBrowserVaults(browserVaultEnvironment)
    expect(listedBrowserVaultRecords.map((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName)).toEqual(['Field Notes', 'Recipes'])
    expect(listedBrowserVaultRecords[0]?.papelizVaultHiddenAt).toBeNull()
    if (openVaultResult.openVaultOutcome === 'opened') openVaultResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('lists a vault whose row went missing from its own .papeliz/browser-vault.json, and drops a row whose folder is gone', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeBrowserVaultRecordsById } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    const recipesRecord = await createPapelizBrowserVault('Recipes', browserVaultEnvironment)
    fakeBrowserVaultRecordsById.delete(fieldNotesRecord.papelizVaultId)
    await (await fakeOriginPrivateFileSystemRoot.getDirectoryHandle('papeliz-browser-vaults')).removeEntry(recipesRecord.papelizVaultId, { recursive: true })
    const listedBrowserVaultRecords = await listPapelizBrowserVaults(browserVaultEnvironment)
    expect(listedBrowserVaultRecords.map((browserVaultRecord) => [browserVaultRecord.papelizVaultId, browserVaultRecord.papelizVaultDisplayName])).toEqual([
      [fieldNotesRecord.papelizVaultId, 'Field Notes'],
    ])
    expect(fakeBrowserVaultRecordsById.has(fieldNotesRecord.papelizVaultId)).toBe(true)
    expect(fakeBrowserVaultRecordsById.has(recipesRecord.papelizVaultId)).toBe(false)
  })

  it('renames a vault in its row and its .papeliz/browser-vault.json, unless it is open in a tab', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    await createPapelizBrowserVault('Recipes', browserVaultEnvironment)
    await expect(renamePapelizBrowserVault(fieldNotesRecord.papelizVaultId, 'RECIPES', browserVaultEnvironment)).rejects.toThrow('Name Taken')
    const renamedRecord = await renamePapelizBrowserVault(fieldNotesRecord.papelizVaultId, 'Garden Notes', browserVaultEnvironment)
    expect(renamedRecord.papelizVaultDisplayName).toBe('Garden Notes')
    const originPrivateFileSystemContents = await readPapelizFakeVaultFolder(fakeOriginPrivateFileSystemRoot)
    expect(JSON.parse(originPrivateFileSystemContents[`papeliz-browser-vaults/${fieldNotesRecord.papelizVaultId}/.papeliz/browser-vault.json`] ?? '')).toMatchObject({
      papelizBrowserVaultName: 'Garden Notes',
    })
    const openVaultResult = await openPapelizBrowserVault(renamedRecord, browserVaultEnvironment)
    await new Promise((resolveWait) => setTimeout(resolveWait, 0))
    await expect(renamePapelizBrowserVault(fieldNotesRecord.papelizVaultId, 'Other', browserVaultEnvironment)).rejects.toThrow('Open In Another Tab')
    if (openVaultResult.openVaultOutcome === 'opened') openVaultResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('deletes a vault and its row for good, unless it is open in a tab', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeBrowserVaultRecordsById } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    const openVaultResult = await openPapelizBrowserVault(fieldNotesRecord, browserVaultEnvironment)
    await new Promise((resolveWait) => setTimeout(resolveWait, 0))
    expect(await deletePapelizBrowserVault(fieldNotesRecord, browserVaultEnvironment)).toEqual({
      browserVaultDeleteOutcome: 'failed',
      browserVaultDeleteFailureMessage: 'Couldn’t delete “Field Notes” (Open In Another Tab)',
    })
    if (openVaultResult.openVaultOutcome === 'opened') openVaultResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
    await new Promise((resolveWait) => setTimeout(resolveWait, 0))
    expect(await deletePapelizBrowserVault(fieldNotesRecord, browserVaultEnvironment)).toEqual({ browserVaultDeleteOutcome: 'deleted' })
    expect(fakeBrowserVaultRecordsById.size).toBe(0)
    expect(await readPapelizFakeVaultFolder(fakeOriginPrivateFileSystemRoot)).toEqual({ 'papeliz-browser-vaults/': '' })
    expect(await listPapelizBrowserVaults(browserVaultEnvironment)).toEqual([])
  })

  it('says a vault is gone when its folder is', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    await (await fakeOriginPrivateFileSystemRoot.getDirectoryHandle('papeliz-browser-vaults')).removeEntry(fieldNotesRecord.papelizVaultId, { recursive: true })
    expect(await openPapelizBrowserVault(fieldNotesRecord, browserVaultEnvironment)).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'Couldn’t open “Field Notes” (Vault Not Found)',
    })
  })
})
