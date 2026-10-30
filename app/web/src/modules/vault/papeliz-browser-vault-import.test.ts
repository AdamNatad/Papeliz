import { describe, expect, it } from 'vitest'
import { writePapelizExportZipFile } from '../export-zip/papeliz-export-zip-file-writer'
import {
  buildPapelizBrowserVaultBackupFileName,
  createPapelizBrowserVaultBackupZipBlob,
  notePapelizBrowserVaultBackedUp,
} from './papeliz-browser-vault-backup'
import {
  importPapelizBrowserVault,
  planPapelizBrowserVaultImportFromFolder,
  planPapelizBrowserVaultImportFromZip,
  suggestPapelizBrowserVaultNameFromFileName,
} from './papeliz-browser-vault-import'
import { createPapelizBrowserVault, listPapelizBrowserVaults, notePapelizBrowserVaultChangedSinceBackup, readPapelizBrowserVaultRecord } from './papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment, getPapelizFakeBrowserVaultFolder } from './papeliz-fake-browser-vault-environment.test-support'
import { addPapelizFakeVaultFiles, readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'

const utf8Encoder = new TextEncoder()

async function writeTestZipBytes(zipEntryTextsByPath: Record<string, string>): Promise<Uint8Array> {
  const zipFileBlob = await writePapelizExportZipFile(
    Object.entries(zipEntryTextsByPath).map(([zipEntryPath, zipEntryText]) => ({ zipEntryPath, zipEntryBytes: utf8Encoder.encode(zipEntryText) })),
    { zipEntryModifiedDate: new Date(2026, 9, 30, 14, 41) },
  )
  return new Uint8Array(await zipFileBlob.arrayBuffer())
}

describe('importing a browser vault', () => {
  it('drops a single top folder, names the vault after it, and leaves out leftovers and .git', async () => {
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromZip(
      'whatever.zip',
      await writeTestZipBytes({
        'Field Notes/Inbox.md': '# Inbox',
        'Field Notes/Ideas/Plan.md': '# Plan',
        'Field Notes/.trash/Old.md': '# Old',
        'Field Notes/.git/HEAD': 'ref',
        'Field Notes/.DS_Store': 'x',
        '__MACOSX/Field Notes/._Inbox.md': 'x',
      }),
    )
    expect(browserVaultImportPlan.suggestedBrowserVaultName).toBe('Field Notes')
    expect(browserVaultImportPlan.browserVaultImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['Inbox.md', 'Ideas/Plan.md', '.trash/Old.md'])
    expect(browserVaultImportPlan.skippedImportFileCount).toBe(3)
  })

  it('names a vault from a zip with no top folder after the zip, without a backup’s time', async () => {
    expect(suggestPapelizBrowserVaultNameFromFileName('Field Notes 2026-10-30 1441.zip')).toBe('Field Notes')
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromZip('Recipes.ZIP', await writeTestZipBytes({ 'Soup.md': '# Soup', 'Bread/Rye.md': '# Rye' }))
    expect(browserVaultImportPlan.suggestedBrowserVaultName).toBe('Recipes')
    expect(browserVaultImportPlan.browserVaultImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['Soup.md', 'Bread/Rye.md'])
  })

  it('refuses what isn’t a zip', async () => {
    await expect(planPapelizBrowserVaultImportFromZip('notes.zip', utf8Encoder.encode('not a zip, only words'))).rejects.toThrow('Not A Zip')
  })

  it('imports a picked folder, named after it', async () => {
    const pickedFolderFiles = ['Field Notes/Inbox.md', 'Field Notes/Ideas/Plan.md'].map((pickedFilePath) => {
      const pickedFolderFile = new File([`# ${pickedFilePath}`], pickedFilePath.split('/').at(-1) ?? '')
      Object.defineProperty(pickedFolderFile, 'webkitRelativePath', { value: pickedFilePath })
      return pickedFolderFile
    })
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromFolder(pickedFolderFiles)
    expect(browserVaultImportPlan.suggestedBrowserVaultName).toBe('Field Notes')
    expect(browserVaultImportPlan.browserVaultImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['Inbox.md', 'Ideas/Plan.md'])
    await expect(planPapelizBrowserVaultImportFromFolder([])).rejects.toThrow('Browser Sent No Files')
  })

  it('writes every file into a new vault, telling how far it got, and keeps names that differ only in case apart', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromZip(
      'Notes.zip',
      await writeTestZipBytes({ 'Inbox.md': '# Inbox', 'inbox.md': '# second inbox', 'Ideas/Plan.md': '# Plan' }),
    )
    const importProgressSteps: string[] = []
    const importedBrowserVaultRecord = await importPapelizBrowserVault(
      'Notes',
      browserVaultImportPlan,
      { onBrowserVaultImportProgress: (importedFileCount, importFileCount) => importProgressSteps.push(`${importedFileCount}/${importFileCount}`) },
      browserVaultEnvironment,
    )
    expect(importProgressSteps).toEqual(['1/3', '2/3', '3/3'])
    const importedVaultFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, importedBrowserVaultRecord.papelizVaultId)
    const importedVaultContents = await readPapelizFakeVaultFolder(importedVaultFolder)
    expect(importedVaultContents['Inbox.md']).toBe('# Inbox')
    expect(importedVaultContents['inbox 2.md']).toBe('# second inbox')
    expect(importedVaultContents['Ideas/Plan.md']).toBe('# Plan')
  })

  it('takes back a vault whose import was stopped', async () => {
    const { browserVaultEnvironment } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromZip('Notes.zip', await writeTestZipBytes({ 'A.md': 'a', 'B.md': 'b' }))
    const importAbortController = new AbortController()
    await expect(
      importPapelizBrowserVault(
        'Notes',
        browserVaultImportPlan,
        { browserVaultImportAbortSignal: importAbortController.signal, onBrowserVaultImportProgress: () => importAbortController.abort() },
        browserVaultEnvironment,
      ),
    ).rejects.toThrow('Import Stopped')
    expect(await listPapelizBrowserVaults(browserVaultEnvironment)).toEqual([])
  })
})

describe('backing up a browser vault', () => {
  it('names the backup after the vault and the time', () => {
    expect(buildPapelizBrowserVaultBackupFileName('Field Notes', new Date(2026, 9, 30, 14, 41))).toBe('Field Notes 2026-10-30 1441.zip')
  })

  it('zips every file, hidden ones and empty folders too, and imports back as it was', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    const fieldNotesFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, fieldNotesRecord.papelizVaultId)
    await addPapelizFakeVaultFiles(fieldNotesFolder, {
      'Inbox.md': '# Inbox',
      'Ideas/Plan.md': '# Plan',
      'attachments/sketch.png': 'png bytes',
      '.papeliz/file-list-order.json': '{}',
      '.trash/Old.md': '# Old',
      'Empty folder/': '',
    })
    const backupZipBlob = await createPapelizBrowserVaultBackupZipBlob(fieldNotesRecord, new Date(2026, 9, 30, 14, 41), browserVaultEnvironment)
    const backupImportPlan = await planPapelizBrowserVaultImportFromZip('Field Notes 2026-10-30 1441.zip', new Uint8Array(await backupZipBlob.arrayBuffer()))
    expect(backupImportPlan.suggestedBrowserVaultName).toBe('Field Notes')
    const restoredRecord = await importPapelizBrowserVault('Field Notes 2', backupImportPlan, {}, browserVaultEnvironment)
    const restoredFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, restoredRecord.papelizVaultId)
    const restoredContents = await readPapelizFakeVaultFolder(restoredFolder)
    const { ['.papeliz/browser-vault.json']: restoredSettingsFile, ...restoredVaultFiles } = restoredContents
    const { ['.papeliz/browser-vault.json']: _originalSettingsFile, ...originalVaultFiles } = await readPapelizFakeVaultFolder(fieldNotesFolder)
    expect(restoredVaultFiles).toEqual(originalVaultFiles)
    expect(JSON.parse(restoredSettingsFile ?? '')).toMatchObject({ papelizBrowserVaultName: 'Field Notes 2' })
  })

  it('starts the reminder over once a backup is handed over', async () => {
    const { browserVaultEnvironment, fakeClock } = createPapelizFakeBrowserVaultEnvironment()
    const fieldNotesRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
    await notePapelizBrowserVaultChangedSinceBackup(fieldNotesRecord.papelizVaultId, browserVaultEnvironment)
    fakeClock.fakeCurrentTime += 3_600_000
    await notePapelizBrowserVaultBackedUp(fieldNotesRecord.papelizVaultId, browserVaultEnvironment)
    expect(await readPapelizBrowserVaultRecord(fieldNotesRecord.papelizVaultId, browserVaultEnvironment)).toMatchObject({
      papelizBrowserVaultLastBackupAt: fakeClock.fakeCurrentTime,
      papelizBrowserVaultFirstChangeSinceBackupAt: null,
      papelizBrowserVaultBackupReminderShownAt: null,
    })
  })
})
