import { describe, expect, it } from 'vitest'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'

async function createTestFolderVault() {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', {
    '.other-app/app.json': '{"theme":"light"}',
    '.git/HEAD': 'ref: refs/heads/main',
    'Inbox.md': '# Inbox',
    'Ideas/Offline-first apps.md': '# Offline-first apps',
    'Ideas/sketch.png': 'png bytes',
    'Ideas/Deep/Notes.md': '# Notes',
    'Empty folder/': '',
  })
  return { fakeVaultRootHandle, folderVaultAdapter: new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()) }
}

describe('a folder on disk', () => {
  it('lists folders and .md notes, and leaves out hidden folders and other files', async () => {
    const { folderVaultAdapter } = await createTestFolderVault()
    const listedVaultTreeEntries = await folderVaultAdapter.listVaultTreeEntries()
    expect(listedVaultTreeEntries.map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`).sort()).toEqual([
      'folder:Empty folder',
      'folder:Ideas',
      'folder:Ideas/Deep',
      'note:Ideas/Deep/Notes.md',
      'note:Ideas/Offline-first apps.md',
      'note:Inbox.md',
    ])
  })

  it('keeps Papeliz’s own files in .papeliz/, hidden from the notes, and only by plain name', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    expect(await folderVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBeNull()
    await folderVaultAdapter.writePapelizVaultSettingsFile('file-list-order.json', '{"fileListOrder":{}}')
    expect(await folderVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBe('{"fileListOrder":{}}')
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['.papeliz/file-list-order.json']).toBe('{"fileListOrder":{}}')
    const listedPaths = (await folderVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(listedPaths.some((listedPath) => listedPath.startsWith('.papeliz'))).toBe(false)
    await expect(folderVaultAdapter.writePapelizVaultSettingsFile('../Inbox.md', 'x')).rejects.toThrow('Unknown Settings File')
    await expect(folderVaultAdapter.readPapelizVaultSettingsFile('.other-app/app.json')).rejects.toThrow('Unknown Settings File')
  })

  it('reads a note and saves it in place', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    expect(await folderVaultAdapter.readVaultNoteText('Ideas/Offline-first apps.md')).toBe('# Offline-first apps')
    await folderVaultAdapter.writeVaultNoteText('Ideas/Offline-first apps.md', '# Offline-first apps\n\nEdited.')
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Ideas/Offline-first apps.md']).toBe('# Offline-first apps\n\nEdited.')
  })

  it('keeps the old note when a save fails part-way', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    const inboxFileHandle = await fakeVaultRootHandle.getFileHandle('Inbox.md')
    inboxFileHandle.shouldFailNextWriteClose = true
    await expect(folderVaultAdapter.writeVaultNoteText('Inbox.md', 'half-written')).rejects.toThrow()
    expect(await folderVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
  })

  it('creates notes and folders, and refuses a name that is taken, ignoring case', async () => {
    const { folderVaultAdapter } = await createTestFolderVault()
    await folderVaultAdapter.createVaultNote('Ideas/New idea.md', '')
    await folderVaultAdapter.createVaultFolder('Ideas/Later')
    await expect(folderVaultAdapter.createVaultNote('inbox.md', '')).rejects.toThrow('Name Taken')
    await expect(folderVaultAdapter.createVaultFolder('ideas')).rejects.toThrow('Name Taken')
    const listedPaths = (await folderVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(listedPaths).toContain('Ideas/New idea.md')
    expect(listedPaths).toContain('Ideas/Later')
  })

  it('renames a folder with everything in it, Markdown or not', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    await folderVaultAdapter.renameVaultEntry('Ideas', 'Projects')
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(vaultFolderContents['Projects/Offline-first apps.md']).toBe('# Offline-first apps')
    expect(vaultFolderContents['Projects/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['Projects/Deep/Notes.md']).toBe('# Notes')
    expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('Ideas'))).toBe(false)
  })

  it('renames a note when only the case of its name changes', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    await folderVaultAdapter.renameVaultEntry('Inbox.md', 'INBOX.md')
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(vaultFolderContents['INBOX.md']).toBe('# Inbox')
    expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.toLowerCase() === 'inbox.md')).toEqual(['INBOX.md'])
  })

  it('refuses to rename onto a name that is taken', async () => {
    const { folderVaultAdapter } = await createTestFolderVault()
    await expect(folderVaultAdapter.renameVaultEntry('Ideas/Deep/Notes.md', 'Ideas/OFFLINE-FIRST APPS.md')).rejects.toThrow('Name Taken')
    await expect(folderVaultAdapter.renameVaultEntry('Ideas', 'Inbox.md')).rejects.toThrow('Name Taken')
    expect(await folderVaultAdapter.readVaultNoteText('Ideas/Deep/Notes.md')).toBe('# Notes')
  })

  it('moves deleted notes and folders into .trash, never erasing them', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    expect(await folderVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox.md')
    await folderVaultAdapter.createVaultNote('Inbox.md', 'second inbox')
    expect(await folderVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox 2.md')
    expect(await folderVaultAdapter.moveVaultEntryToTrash('Ideas')).toBe('.trash/Ideas')
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(vaultFolderContents['.trash/Inbox.md']).toBe('# Inbox')
    expect(vaultFolderContents['.trash/Inbox 2.md']).toBe('second inbox')
    expect(vaultFolderContents['.trash/Ideas/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['.trash/Ideas/Deep/Notes.md']).toBe('# Notes')
    const listedPaths = (await folderVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(listedPaths).toEqual(['Empty folder'])
  })

  it('never writes inside .other-app or any other hidden folder', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    await expect(folderVaultAdapter.writeVaultNoteText('.other-app/app.md', 'x')).rejects.toThrow('Hidden Folder')
    await expect(folderVaultAdapter.createVaultNote('.git/notes.md', 'x')).rejects.toThrow('Hidden Folder')
    await expect(folderVaultAdapter.renameVaultEntry('Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
    await expect(folderVaultAdapter.moveVaultEntryToTrash('.other-app')).rejects.toThrow('Hidden Folder')
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(vaultFolderContents['.other-app/app.json']).toBe('{"theme":"light"}')
    expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.startsWith('.other-app'))).toEqual([
      '.other-app/',
      '.other-app/app.json',
    ])
  })

  it('leaves the original in place, and no half copy, when a move cannot finish copying', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await createTestFolderVault()
    const ideasFolderHandle = await fakeVaultRootHandle.getDirectoryHandle('Ideas')
    // The copy of Ideas/Deep/Notes.md fails, so Ideas must stay where it was, complete.
    const deepFolderHandle = await ideasFolderHandle.getDirectoryHandle('Deep')
    const deepNotesFileHandle = await deepFolderHandle.getFileHandle('Notes.md')
    deepNotesFileHandle.getFile = async () => {
      throw new DOMException('The file is locked.', 'NoModificationAllowedError')
    }
    await expect(folderVaultAdapter.renameVaultEntry('Ideas', 'Projects')).rejects.toThrow()
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(vaultFolderContents['Ideas/Offline-first apps.md']).toBe('# Offline-first apps')
    expect(vaultFolderContents['Ideas/sketch.png']).toBe('png bytes')
    expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('Projects'))).toBe(false)
  })
})
