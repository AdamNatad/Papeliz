import { describe, expect, it } from 'vitest'
import { writePapelizExportZipFile } from '../export-zip/papeliz-export-zip-file-writer'
import { createPngPictureWithMetadata, createPngPictureWithoutMetadata } from '../template-gallery/papeliz-template-gallery-fixtures.test-support'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'
import {
  makePapelizImportVaultFolderName,
  papelizVaultFolderImportMostFileCount,
  planPapelizVaultFolderImport,
  planPapelizVaultFolderImportFromFiles,
  planPapelizVaultFolderImportFromZip,
  type PapelizVaultImportFile,
} from './papeliz-vault-folder-import'

// A file as the browser's picker gives it: a picked folder's files carry their path from the folder.
function createPickedFile(pickedFileContents: string | Uint8Array, pickedFileName: string, pickedFileRelativePath = ''): File {
  const pickedFile = new File([pickedFileContents as BlobPart], pickedFileName)
  Object.defineProperty(pickedFile, 'webkitRelativePath', { value: pickedFileRelativePath })
  return pickedFile
}

function createImportFile(importFileRelativePath: string, importFileText = ''): PapelizVaultImportFile {
  return { importFileRelativePath, isImportFileFolder: false, importFileByteCount: importFileText.length, readImportFileBytes: async () => new TextEncoder().encode(importFileText) }
}

describe('importing into a new vault folder', () => {
  it('names the folder after what was imported, as a vault folder can be named', () => {
    expect(makePapelizImportVaultFolderName('Field Notes')).toBe('Field Notes')
    expect(makePapelizImportVaultFolderName('.hidden: notes?. ')).toBe('hidden notes')
    expect(makePapelizImportVaultFolderName('...')).toBe('Imported Files')
    expect(makePapelizImportVaultFolderName('a'.repeat(150))).toHaveLength(100)
  })

  it('brings loose files in under “Imported Files”, and a picked folder under its own name', () => {
    const looseFilesPlan = planPapelizVaultFolderImportFromFiles([createPickedFile('# One', 'One.md'), createPickedFile('two', 'Two.txt')])
    expect(looseFilesPlan.suggestedVaultFolderName).toBe('Imported Files')
    expect(looseFilesPlan.vaultFolderImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['One.md', 'Two.txt'])

    const pickedFolderPlan = planPapelizVaultFolderImportFromFiles([
      createPickedFile('# Start', 'Start.md', 'Field Notes/Start.md'),
      createPickedFile('# Beans', 'Beans.md', 'Field Notes/Crops/Beans.md'),
      createPickedFile('[core]', 'config', 'Field Notes/.git/config'),
      createPickedFile('{}', 'file-list-order.json', 'Field Notes/.papeliz/file-list-order.json'),
      createPickedFile('# Old', 'Old.md', 'Field Notes/.trash/Old.md'),
      createPickedFile('', '.DS_Store', 'Field Notes/.DS_Store'),
      createPickedFile('*.log', '.gitignore', 'Field Notes/.gitignore'),
    ])
    expect(pickedFolderPlan).toMatchObject({ suggestedVaultFolderName: 'Field Notes', skippedImportFileCount: 4, importFileCount: 3 })
    expect(pickedFolderPlan.vaultFolderImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['Start.md', 'Crops/Beans.md', '.gitignore'])
  })

  it('brings a zip in under its name without “.zip”, taking what is inside its one top folder', async () => {
    const zipFileBlob = await writePapelizExportZipFile(
      [
        { zipEntryPath: 'Field Notes/Start.md', zipEntryBytes: new TextEncoder().encode('# Start') },
        { zipEntryPath: 'Field Notes/Crops/Beans.md', zipEntryBytes: new TextEncoder().encode('# Beans') },
        { zipEntryPath: '__MACOSX/Field Notes/._Start.md', zipEntryBytes: new Uint8Array([0]) },
      ],
      { zipEntryModifiedDate: new Date(2026, 10, 2) },
    )
    const zipPlan = planPapelizVaultFolderImportFromZip('Garden Backup.zip', new Uint8Array(await zipFileBlob.arrayBuffer()))
    expect(zipPlan.suggestedVaultFolderName).toBe('Garden Backup')
    expect(zipPlan.vaultFolderImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual(['Start.md', 'Crops/Beans.md'])
    expect(zipPlan.skippedImportFileCount).toBe(1)
  })

  it('strips a picture’s metadata as it is read, and keeps one that doesn’t read as its type', async () => {
    const picturePlan = planPapelizVaultFolderImport('Pictures', [
      { ...createImportFile('beds.png'), readImportFileBytes: async () => createPngPictureWithMetadata() },
      createImportFile('not-really.png', 'just text'),
    ])
    const [strippedPicture, notAPicture] = picturePlan.vaultFolderImportFiles
    expect(await strippedPicture?.readImportFileBytes()).toEqual(createPngPictureWithoutMetadata())
    expect(new TextDecoder().decode(await notAPicture?.readImportFileBytes())).toBe('just text')
  })

  it('refuses more than 20,000 files, or more than 2 GB', () => {
    const manyImportFiles = Array.from({ length: papelizVaultFolderImportMostFileCount + 1 }, (_unused, importFileIndex) => createImportFile(`${importFileIndex}.md`))
    expect(() => planPapelizVaultFolderImport('Many', manyImportFiles)).toThrow('Too Many Files')
    expect(() => planPapelizVaultFolderImport('Large', [{ ...createImportFile('big.bin'), importFileByteCount: 3 * 1024 * 1024 * 1024 }])).toThrow('Import Too Large')
  })

  it('imports into the sample vault: a new folder under the next free name, notes and text listed, the rest kept, nothing else changed', async () => {
    const inMemoryVaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '# Inbox' },
      { vaultNoteRelativePath: 'Imported Files/Old.md', vaultNoteText: '# Old' },
    ])
    const importedVaultFolderName = await inMemoryVaultAdapter.importVaultFilesIntoNewFolder('imported files', [
      createImportFile('One.md', '# One'),
      createImportFile('one.md', '# one again'),
      createImportFile('notes.txt', 'plain'),
      { ...createImportFile('beds.png'), readImportFileBytes: async () => createPngPictureWithoutMetadata() },
    ])
    expect(importedVaultFolderName).toBe('imported files 2')
    const listedVaultTreeEntries = await inMemoryVaultAdapter.listVaultTreeEntries()
    expect(listedVaultTreeEntries.map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`).sort()).toEqual([
      'folder:Imported Files',
      'folder:imported files 2',
      'note:Imported Files/Old.md',
      'note:Inbox.md',
      'note:imported files 2/One.md',
      'note:imported files 2/one 2.md',
      'text-file:imported files 2/notes.txt',
    ])
    expect(inMemoryVaultAdapter.readVaultAttachmentFile('imported files 2/beds.png')).not.toBeNull()
    expect(await inMemoryVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    await inMemoryVaultAdapter.renameVaultEntry('imported files 2', 'Garden')
    expect(await inMemoryVaultAdapter.readVaultNoteText('Garden/One.md')).toBe('# One')
  })
})
