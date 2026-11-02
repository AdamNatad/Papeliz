import { describe, expect, it } from 'vitest'
import { hasPapelizSyncVaultAdapterWholeFileAccess } from '../sync/papeliz-sync-local-vault-files'
import { createPapelizDesktopFolderVaultAdapter } from './papeliz-desktop-folder-vault-adapter'
import { papelizDirectoryHandleTestVaultFiles } from './papeliz-directory-handle-vault-adapter.test-support'
import { createPapelizFakeDesktopFileSystem } from './papeliz-fake-desktop-file-system.test-support'
import { isPapelizVaultEntryMissingError, type PapelizVaultAdapter, type PapelizVaultTreeEntry } from './papeliz-vault-adapter'
import type { PapelizVaultImportFile } from './papeliz-vault-folder-import'

// The same cases a folder opened in the browser is held to (papeliz-directory-handle-vault-adapter.test-support.ts),
// on the same test vault, here through Papeliz for Windows' native file calls; then what only a vault
// reached by path needs: paths that would leave the vault folder, and entries that give no size.

const desktopTestHomeFolderPath = 'C:\\Users\\Ada'
const desktopTestVaultFolderPath = 'C:\\Users\\Ada\\Field Notes'

function createDesktopTestVault() {
  const fakeDesktopFileSystem = createPapelizFakeDesktopFileSystem(desktopTestVaultFolderPath, papelizDirectoryHandleTestVaultFiles)
  // Beside the vault folder, never picked: no call may reach it.
  fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestHomeFolderPath, { 'secret.txt': 'not in the vault' })
  const desktopFolderVaultAdapter = createPapelizDesktopFolderVaultAdapter(desktopTestVaultFolderPath, fakeDesktopFileSystem)
  if (!hasPapelizSyncVaultAdapterWholeFileAccess(desktopFolderVaultAdapter)) throw new Error('The desktop folder vault has no whole-file access for Sync.')
  return {
    fakeDesktopFileSystem,
    desktopFolderVaultAdapter,
    readDesktopTestVaultFolder: () => fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestVaultFolderPath),
    addDesktopTestVaultFiles: (desktopTestVaultFileTextsByRelativePath: Record<string, string>) =>
      fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestVaultFolderPath, desktopTestVaultFileTextsByRelativePath),
  }
}

function describeListedVaultTreeEntries(listedVaultTreeEntries: readonly PapelizVaultTreeEntry[]): string[] {
  return listedVaultTreeEntries.map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`).sort()
}

async function listVaultTreeEntryPaths(desktopFolderVaultAdapter: PapelizVaultAdapter): Promise<string[]> {
  return (await desktopFolderVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
}

function createTestImportFile(importFileRelativePath: string, importFileText: string): PapelizVaultImportFile {
  return { importFileRelativePath, isImportFileFolder: false, importFileByteCount: importFileText.length, readImportFileBytes: async () => new TextEncoder().encode(importFileText) }
}

describe('a folder on disk in Papeliz for Windows', () => {
  it('is a folder on disk, which Papeliz Sync reads and writes whole', () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    expect(desktopFolderVaultAdapter.papelizVaultKind).toBe('folder-on-disk')
    expect(hasPapelizSyncVaultAdapterWholeFileAccess(desktopFolderVaultAdapter)).toBe(true)
  })

  it('never lists a save file left behind by a crash in the middle of a save', async () => {
    const { desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    addDesktopTestVaultFiles({ 'Inbox.md.papeliz-saving': '# Inbox, half saved', 'Ideas/Plan.md.papeliz-saving': '' })
    const listedVaultEntryPaths = await listVaultTreeEntryPaths(desktopFolderVaultAdapter)
    expect(listedVaultEntryPaths.some((vaultEntryPath) => vaultEntryPath.endsWith('.papeliz-saving'))).toBe(false)
    expect(listedVaultEntryPaths).toContain('Inbox.md')
    expect((await desktopFolderVaultAdapter.listVaultAttachmentFileRelativePaths()).some((attachmentPath) => attachmentPath.endsWith('.papeliz-saving'))).toBe(false)
  })

  it('imports into a new folder at the top under the next free name, hidden files too, changing nothing else, and the folder renames afterwards', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    const vaultFilesBeforeImport = readDesktopTestVaultFolder()
    const importedFileTextsByPath: Record<string, string> = { 'Start.md': '# Start', 'Guides/One.md': '# One', 'guides/two.md': '# Two', '.claude/settings.json': '{}', 'A.md': 'a', 'a.md': 'b' }
    const importProgressCounts: number[] = []
    const importedVaultFolderName = await desktopFolderVaultAdapter.importVaultFilesIntoNewFolder(
      'ideas',
      Object.entries(importedFileTextsByPath).map(([importFileRelativePath, importFileText]) => createTestImportFile(importFileRelativePath, importFileText)),
      { onBrowserVaultImportProgress: (importedFileCount) => importProgressCounts.push(importedFileCount) },
    )
    // "Ideas" is there already, whatever the case.
    expect(importedVaultFolderName).toBe('ideas 2')
    expect(importProgressCounts).toEqual([1, 2, 3, 4, 5, 6])
    const vaultFilesAfterImport = readDesktopTestVaultFolder()
    for (const [vaultFileRelativePath, vaultFileText] of Object.entries(vaultFilesBeforeImport)) expect(vaultFilesAfterImport[vaultFileRelativePath]).toBe(vaultFileText)
    expect(Object.fromEntries(Object.entries(vaultFilesAfterImport).filter(([vaultFileRelativePath]) => vaultFileRelativePath.startsWith('ideas 2/')))).toEqual({
      'ideas 2/': '',
      'ideas 2/.claude/': '',
      'ideas 2/Guides/': '',
      'ideas 2/Start.md': '# Start',
      'ideas 2/Guides/One.md': '# One',
      'ideas 2/Guides/two.md': '# Two',
      'ideas 2/.claude/settings.json': '{}',
      'ideas 2/A.md': 'a',
      'ideas 2/a 2.md': 'b',
    })
    await desktopFolderVaultAdapter.renameVaultEntry('ideas 2', 'Imported ideas')
    await desktopFolderVaultAdapter.renameVaultEntry('Imported ideas/Start.md', 'Start.md')
    const vaultFilesAfterReorganizing = readDesktopTestVaultFolder()
    expect(vaultFilesAfterReorganizing['Start.md']).toBe('# Start')
    expect(vaultFilesAfterReorganizing['Imported ideas/Guides/One.md']).toBe('# One')
  })

  it('stops an import when asked, keeping the files written so far', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    const importAbortController = new AbortController()
    const importFiles = [createTestImportFile('One.md', '# One'), createTestImportFile('Two.md', '# Two')]
    await expect(
      desktopFolderVaultAdapter.importVaultFilesIntoNewFolder('Field', importFiles, {
        browserVaultImportAbortSignal: importAbortController.signal,
        onBrowserVaultImportProgress: () => importAbortController.abort(),
      }),
    ).rejects.toThrow('Import Stopped')
    expect(readDesktopTestVaultFolder()['Field/One.md']).toBe('# One')
    expect(readDesktopTestVaultFolder()['Field/Two.md']).toBeUndefined()
  })

  it('lists folders and .md notes, and leaves out hidden folders and other files', async () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    expect(describeListedVaultTreeEntries(await desktopFolderVaultAdapter.listVaultTreeEntries())).toEqual([
      'folder:Empty folder',
      'folder:Ideas',
      'folder:Ideas/Deep',
      'note:Ideas/Deep/Notes.md',
      'note:Ideas/Offline-first apps.md',
      'note:Inbox.md',
    ])
  })

  it('lists Papeliz’s own saved chats, every hidden entry under Show Hidden, and never .papeliz/ or what is inside .git/', async () => {
    const { desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    addDesktopTestVaultFiles({ '.csessions/Chat.md': '# Chat', '.chatsession/Earlier chat.md': '# Earlier', '.papeliz/file-list-order.json': '{}' })
    const listedEntries = describeListedVaultTreeEntries(await desktopFolderVaultAdapter.listVaultTreeEntries())
    expect(listedEntries).toEqual(expect.arrayContaining(['folder:.csessions', 'note:.csessions/Chat.md', 'folder:.chatsession', 'note:.chatsession/Earlier chat.md']))
    expect(listedEntries.some((listedEntry) => /\.git|\.other-app|\.papeliz/.test(listedEntry))).toBe(false)
    const everyListedEntry = describeListedVaultTreeEntries(await desktopFolderVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }))
    expect(everyListedEntry).toEqual(expect.arrayContaining(['folder:.git', 'folder:.other-app', 'text-file:.other-app/app.json']))
    expect(everyListedEntry.some((listedEntry) => listedEntry.includes('.git/') || listedEntry.includes('.papeliz'))).toBe(false)
  })

  it('lists text files besides notes, known by name or by their first bytes, and leaves out pictures and binary files', async () => {
    const { desktopFolderVaultAdapter, addDesktopTestVaultFiles, readDesktopTestVaultFolder } = createDesktopTestVault()
    addDesktopTestVaultFiles({
      'LICENSE': 'MIT License',
      'Agent/settings.json': '{"hooks":{}}',
      'Agent/plan.draft': 'plain words',
      'Agent/blob.draft': 'bytes\u0000with a zero byte',
      'Agent/.gitignore': 'node_modules/',
    })
    await desktopFolderVaultAdapter.writePapelizVaultSettingsFile('file-list-order.json', '{"fileListOrder":{}}')
    const describeListedTextFilesAndFolders = (listedVaultTreeEntries: readonly PapelizVaultTreeEntry[]) =>
      describeListedVaultTreeEntries(listedVaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind !== 'note'))
    expect(describeListedTextFilesAndFolders(await desktopFolderVaultAdapter.listVaultTreeEntries())).toEqual([
      'folder:Agent',
      'folder:Empty folder',
      'folder:Ideas',
      'folder:Ideas/Deep',
      'text-file:Agent/plan.draft',
      'text-file:Agent/settings.json',
      'text-file:LICENSE',
    ])
    // Show Hidden adds hidden files that are text, but never Papeliz's own `.papeliz/`.
    const everyListedEntry = describeListedTextFilesAndFolders(await desktopFolderVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }))
    expect(everyListedEntry).toEqual(expect.arrayContaining(['text-file:Agent/.gitignore', 'folder:.other-app', 'text-file:.other-app/app.json', 'folder:.git']))
    expect(everyListedEntry.some((listedEntry) => listedEntry.includes('.papeliz'))).toBe(false)
    // A text file reads and saves like a note.
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Agent/settings.json')).toBe('{"hooks":{}}')
    await desktopFolderVaultAdapter.writeVaultNoteText('Agent/settings.json', '{"hooks":{"Stop":[]}}')
    expect(readDesktopTestVaultFolder()['Agent/settings.json']).toBe('{"hooks":{"Stop":[]}}')
  })

  it('reads a file whose name doesn’t say it is text once, and again only after it changes', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    addDesktopTestVaultFiles({ 'Agent/plan.draft': 'plain words' })
    const countPlanByteReads = () =>
      fakeDesktopFileSystem.fakeDesktopCalls.filter((desktopCall) => desktopCall.desktopCallName === 'readDesktopFileBytes' && desktopCall.desktopCallPaths[0]?.endsWith('plan.draft')).length
    await desktopFolderVaultAdapter.listVaultTreeEntries()
    await desktopFolderVaultAdapter.listVaultTreeEntries()
    expect(countPlanByteReads()).toBe(1)
    await desktopFolderVaultAdapter.writeVaultNoteText('Agent/plan.draft', 'plain words, and more')
    await desktopFolderVaultAdapter.listVaultTreeEntries()
    expect(countPlanByteReads()).toBe(2)
  })

  it('keeps Papeliz’s own files in .papeliz/, hidden from the notes, and only by plain name', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    expect(await desktopFolderVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBeNull()
    await desktopFolderVaultAdapter.writePapelizVaultSettingsFile('file-list-order.json', '{"fileListOrder":{}}')
    expect(await desktopFolderVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBe('{"fileListOrder":{}}')
    expect(readDesktopTestVaultFolder()['.papeliz/file-list-order.json']).toBe('{"fileListOrder":{}}')
    expect((await listVaultTreeEntryPaths(desktopFolderVaultAdapter)).some((listedPath) => listedPath.startsWith('.papeliz'))).toBe(false)
    await expect(desktopFolderVaultAdapter.writePapelizVaultSettingsFile('../Inbox.md', 'x')).rejects.toThrow('Unknown Settings File')
    await expect(desktopFolderVaultAdapter.readPapelizVaultSettingsFile('.other-app/app.json')).rejects.toThrow('Unknown Settings File')
  })

  it('reads a note and saves it in place', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Ideas/Offline-first apps.md')).toBe('# Offline-first apps')
    await desktopFolderVaultAdapter.writeVaultNoteText('Ideas/Offline-first apps.md', '# Offline-first apps\n\nEdited.')
    expect(readDesktopTestVaultFolder()['Ideas/Offline-first apps.md']).toBe('# Offline-first apps\n\nEdited.')
  })

  it('passes on a failed save and leaves the note as it was', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter } = createDesktopTestVault()
    fakeDesktopFileSystem.shouldFailNextDesktopFileWrite = true
    await expect(desktopFolderVaultAdapter.writeVaultNoteText('Inbox.md', 'half-written')).rejects.toThrow('The disk is full.')
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
  })

  it('creates notes and folders, and refuses a name that is taken, ignoring case, or a folder that is gone', async () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    await desktopFolderVaultAdapter.createVaultNote('Ideas/New idea.md', '')
    await desktopFolderVaultAdapter.createVaultFolder('Ideas/Later')
    await expect(desktopFolderVaultAdapter.createVaultNote('inbox.md', '')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.createVaultFolder('ideas')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.createVaultNote('Gone/New idea.md', '')).rejects.toThrow('Not In Vault')
    const listedPaths = await listVaultTreeEntryPaths(desktopFolderVaultAdapter)
    expect(listedPaths).toContain('Ideas/New idea.md')
    expect(listedPaths).toContain('Ideas/Later')
  })

  it('renames a folder with everything in it, Markdown or not', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await desktopFolderVaultAdapter.renameVaultEntry('Ideas', 'Projects')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['Projects/Offline-first apps.md']).toBe('# Offline-first apps')
    expect(vaultFolderContents['Projects/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['Projects/Deep/Notes.md']).toBe('# Notes')
    expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('Ideas'))).toBe(false)
  })

  it('renames a note when only the case of its name changes', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await desktopFolderVaultAdapter.renameVaultEntry('Inbox.md', 'INBOX.md')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['INBOX.md']).toBe('# Inbox')
    expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.toLowerCase().startsWith('inbox.md'))).toEqual(['INBOX.md'])
  })

  it('refuses to rename onto a name that is taken, or a note that isn’t there by that name', async () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    await expect(desktopFolderVaultAdapter.renameVaultEntry('Ideas/Deep/Notes.md', 'Ideas/OFFLINE-FIRST APPS.md')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.renameVaultEntry('Ideas', 'Inbox.md')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.renameVaultEntry('Ideas/Missing.md', 'Ideas/Found.md')).rejects.toThrow('File Not Found')
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Ideas/Deep/Notes.md')).toBe('# Notes')
  })

  it('copies a note, or a folder with everything in it, onto a free name, and never a folder into itself', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await desktopFolderVaultAdapter.copyVaultEntry('Inbox.md', 'Ideas/Inbox copy.md')
    await desktopFolderVaultAdapter.copyVaultEntry('Ideas', 'Empty folder/Ideas')
    await expect(desktopFolderVaultAdapter.copyVaultEntry('Inbox.md', 'ideas')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.copyVaultEntry('Ideas', 'Ideas/Deep/Ideas')).rejects.toThrow('Into Itself')
    // On Windows "ideas" is the same folder as "Ideas".
    await expect(desktopFolderVaultAdapter.copyVaultEntry('Ideas', 'ideas/Deep/Ideas')).rejects.toThrow('Into Itself')
    await expect(desktopFolderVaultAdapter.copyVaultEntry('Missing.md', 'Copy.md')).rejects.toThrow('File Not Found')
    await expect(desktopFolderVaultAdapter.copyVaultEntry('.other-app', 'Other app')).rejects.toThrow('Hidden Folder')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['Inbox.md']).toBe('# Inbox')
    expect(vaultFolderContents['Ideas/Inbox copy.md']).toBe('# Inbox')
    expect(vaultFolderContents['Ideas/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['Empty folder/Ideas/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['Empty folder/Ideas/Deep/Notes.md']).toBe('# Notes')
    expect(vaultFolderContents['Empty folder/Ideas/Inbox copy.md']).toBe('# Inbox')
    expect(fakeDesktopFileSystem.fakeDesktopCalls.filter((desktopCall) => desktopCall.desktopCallName === 'copyDesktopEntry')).toHaveLength(2)
  })

  it('moves deleted notes and folders into .trash, never erasing them', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    expect(await desktopFolderVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox.md')
    await desktopFolderVaultAdapter.createVaultNote('Inbox.md', 'second inbox')
    expect(await desktopFolderVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox 2.md')
    expect(await desktopFolderVaultAdapter.moveVaultEntryToTrash('Ideas')).toBe('.trash/Ideas')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['.trash/Inbox.md']).toBe('# Inbox')
    expect(vaultFolderContents['.trash/Inbox 2.md']).toBe('second inbox')
    expect(vaultFolderContents['.trash/Ideas/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['.trash/Ideas/Deep/Notes.md']).toBe('# Notes')
    expect(await listVaultTreeEntryPaths(desktopFolderVaultAdapter)).toEqual(['Empty folder'])
    expect(fakeDesktopFileSystem.fakeDesktopCalls.some((desktopCall) => desktopCall.desktopCallName === 'removeDesktopEntry')).toBe(false)
  })

  it('restores a note or folder from .trash with everything in it, onto a free name only', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await desktopFolderVaultAdapter.moveVaultEntryToTrash('Ideas')
    await desktopFolderVaultAdapter.moveVaultEntryToTrash('Inbox.md')
    await desktopFolderVaultAdapter.restoreVaultEntryFromTrash('.trash/Ideas', 'Empty folder/Ideas')
    await desktopFolderVaultAdapter.createVaultNote('Inbox.md', 'a new inbox')
    await expect(desktopFolderVaultAdapter.restoreVaultEntryFromTrash('.trash/Inbox.md', 'Inbox.md')).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.restoreVaultEntryFromTrash('Inbox.md', 'Inbox 2.md')).rejects.toThrow('Not In Trash')
    await expect(desktopFolderVaultAdapter.restoreVaultEntryFromTrash('.trash/Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['Empty folder/Ideas/sketch.png']).toBe('png bytes')
    expect(vaultFolderContents['Empty folder/Ideas/Deep/Notes.md']).toBe('# Notes')
    expect(vaultFolderContents['.trash/Inbox.md']).toBe('# Inbox')
    expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('.trash/Ideas'))).toBe(false)
  })

  it('opens a text file up to 5 MB and refuses a bigger one before reading it; a note has no limit', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    const fiveMegabytes = 5 * 1024 * 1024
    addDesktopTestVaultFiles({ 'edge.log': 'a'.repeat(fiveMegabytes), 'over.log': 'a'.repeat(fiveMegabytes + 1), 'Big note.md': 'a'.repeat(fiveMegabytes + 1) })
    expect((await desktopFolderVaultAdapter.readVaultNoteText('edge.log')).length).toBe(fiveMegabytes)
    await expect(desktopFolderVaultAdapter.readVaultNoteText('over.log')).rejects.toThrow('Text File Over 5 MB')
    expect((await desktopFolderVaultAdapter.readVaultNoteText('Big note.md')).length).toBe(fiveMegabytes + 1)
    expect(fakeDesktopFileSystem.fakeDesktopCalls.some((desktopCall) => desktopCall.desktopCallName === 'readDesktopFileText' && desktopCall.desktopCallPaths[0]?.endsWith('over.log'))).toBe(false)
  })

  it('takes back only an empty new note, removing it, and keeps any note with text or any other file', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await desktopFolderVaultAdapter.createVaultNote('Ideas/Untitled.md', '')
    expect(await desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('Ideas/Untitled.md')).toBe(true)
    expect(await desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('Inbox.md')).toBe(false)
    expect(await desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('Empty folder')).toBe(false)
    await expect(desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('.other-app/app.json')).rejects.toThrow('Hidden Folder')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(Object.keys(vaultFolderContents)).not.toContain('Ideas/Untitled.md')
    expect(Object.keys(vaultFolderContents)).not.toContain('.trash/Untitled.md')
    expect(vaultFolderContents['Inbox.md']).toBe('# Inbox')
    expect(vaultFolderContents['Ideas/Offline-first apps.md']).toBe('# Offline-first apps')
    expect(await listVaultTreeEntryPaths(desktopFolderVaultAdapter)).not.toContain('Ideas/Untitled.md')
    // Only the empty new note was removed; nothing else in the vault was.
    const removeDesktopEntryCalls = fakeDesktopFileSystem.fakeDesktopCalls.filter((desktopCall) => desktopCall.desktopCallName === 'removeDesktopEntry')
    expect(removeDesktopEntryCalls).toHaveLength(1)
  })

  it('never writes inside .other-app or any other hidden folder', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    await expect(desktopFolderVaultAdapter.writeVaultNoteText('.other-app/app.md', 'x')).rejects.toThrow('Hidden Folder')
    await expect(desktopFolderVaultAdapter.createVaultNote('.git/notes.md', 'x')).rejects.toThrow('Hidden Folder')
    await expect(desktopFolderVaultAdapter.renameVaultEntry('Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
    await expect(desktopFolderVaultAdapter.moveVaultEntryToTrash('.other-app')).rejects.toThrow('Hidden Folder')
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['.other-app/app.json']).toBe('{"theme":"light"}')
    expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.startsWith('.other-app'))).toEqual(['.other-app/', '.other-app/app.json'])
  })

  it('adds, lists and reads the files that aren’t notes, leaving out hidden folders', async () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    const photoFileBytes = Uint8Array.from([137, 80, 78, 71, 0, 255])
    await desktopFolderVaultAdapter.createVaultAttachmentFile('Ideas/photo.png', new Blob([photoFileBytes]))
    await expect(desktopFolderVaultAdapter.createVaultAttachmentFile('ideas/PHOTO.png', new Blob(['x']))).rejects.toThrow('Name Taken')
    await expect(desktopFolderVaultAdapter.createVaultAttachmentFile('.other-app/photo.png', new Blob(['x']))).rejects.toThrow('Hidden Folder')
    expect((await desktopFolderVaultAdapter.listVaultAttachmentFileRelativePaths()).sort()).toEqual(['Ideas/photo.png', 'Ideas/sketch.png'])
    expect(new Uint8Array(await (await desktopFolderVaultAdapter.readVaultAttachmentFileBlob('Ideas/photo.png')).arrayBuffer())).toEqual(photoFileBytes)
    expect(await (await desktopFolderVaultAdapter.readVaultAttachmentFileBlob('Ideas/sketch.png')).text()).toBe('png bytes')
    await expect(desktopFolderVaultAdapter.readVaultAttachmentFileBlob('Ideas/missing.png')).rejects.toThrow()
  })

  it('lists every file Papeliz Sync carries, with its size, and only those', async () => {
    const { desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    addDesktopTestVaultFiles({
      '.papeliz/file-order.json': '[]',
      '.csessions/Chat.md': '# Chat',
      '.chatsession/Earlier chat.md': '# Earlier',
      '.trash/Old.md': '# Old',
      '.DS_Store': 'x',
      'Ideas/.hidden-note.md': 'x',
    })
    const syncableVaultFileStats = await desktopFolderVaultAdapter.listSyncableVaultFileStats()
    expect(syncableVaultFileStats.map((syncableVaultFileStat) => `${syncableVaultFileStat.vaultFileRelativePath}:${syncableVaultFileStat.vaultFileByteLength}`).sort()).toEqual([
      '.csessions/Chat.md:6',
      '.papeliz/file-order.json:2',
      'Ideas/Deep/Notes.md:7',
      'Ideas/Offline-first apps.md:20',
      'Ideas/sketch.png:9',
      'Inbox.md:7',
    ])
    expect(syncableVaultFileStats.every((syncableVaultFileStat) => Number.isFinite(syncableVaultFileStat.vaultFileModifiedAt))).toBe(true)
  })

  it('reads and writes whole files for Papeliz Sync, making their folders', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    const scanFileBytes = Uint8Array.from([0, 1, 2, 137, 255])
    await desktopFolderVaultAdapter.writeVaultFileBytes('Pictures/2026/scan.png', scanFileBytes)
    expect(await desktopFolderVaultAdapter.readVaultFileBytes('Pictures/2026/scan.png')).toEqual(scanFileBytes)
    await desktopFolderVaultAdapter.writeVaultFileBytes('Inbox.md', new TextEncoder().encode('# Inbox, from another device'))
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox, from another device')
    await desktopFolderVaultAdapter.writeVaultFileBytes('.papeliz/file-order.json', new TextEncoder().encode('[]'))
    await desktopFolderVaultAdapter.writeVaultFileBytes('.csessions/Chat.md', new TextEncoder().encode('# Chat'))
    const vaultFolderContents = readDesktopTestVaultFolder()
    expect(vaultFolderContents['.papeliz/file-order.json']).toBe('[]')
    expect(vaultFolderContents['.csessions/Chat.md']).toBe('# Chat')
    expect(new TextDecoder().decode(await desktopFolderVaultAdapter.readVaultFileBytes('Ideas/sketch.png'))).toBe('png bytes')
    await expect(desktopFolderVaultAdapter.readVaultFileBytes('Ideas/missing.png')).rejects.toThrow('Not In Vault')
  })

  it('never writes a file Papeliz Sync doesn’t carry', async () => {
    const { desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    const vaultFolderContentsBefore = readDesktopTestVaultFolder()
    for (const notSyncedVaultFileRelativePath of ['.git/HEAD', '.trash/Inbox.md', '.other-app/app.json', '.chatsession/Chat.md', '.papeliz/browser-vault.json', 'Ideas/.hidden-note.md', '.DS_Store']) {
      await expect(desktopFolderVaultAdapter.writeVaultFileBytes(notSyncedVaultFileRelativePath, new TextEncoder().encode('x'))).rejects.toThrow('Not Synced')
    }
    expect(readDesktopTestVaultFolder()).toEqual(vaultFolderContentsBefore)
  })

  it('fails with “Not In Vault” when a note or its folder is gone, as the workspace reads a missing entry', async () => {
    const { desktopFolderVaultAdapter } = createDesktopTestVault()
    const missingNoteReadError = await desktopFolderVaultAdapter.readVaultNoteText('Gone.md').catch((caughtReadError: unknown) => caughtReadError)
    expect(isPapelizVaultEntryMissingError(missingNoteReadError)).toBe(true)
    await expect(desktopFolderVaultAdapter.writeVaultNoteText('Gone/Note.md', 'x')).rejects.toThrow('Not In Vault')
    await expect(desktopFolderVaultAdapter.readVaultNoteText('Ideas')).rejects.toThrow('Not In Vault')
    await expect(desktopFolderVaultAdapter.moveVaultEntryToTrash('Gone/Note.md')).rejects.toThrow('Not In Vault')
  })

  it('refuses any path with "..", an empty segment, or anything else that would leave the vault folder, before any native call', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, readDesktopTestVaultFolder } = createDesktopTestVault()
    const vaultFolderContentsBefore = readDesktopTestVaultFolder()
    const desktopCallCountBefore = fakeDesktopFileSystem.fakeDesktopCalls.length
    const refusedVaultRelativePaths = [
      '../secret.txt',
      'Ideas/../../secret.txt',
      '..',
      '.',
      'Ideas/./Deep/Notes.md',
      '/Inbox.md',
      'Inbox.md/',
      'Ideas//Deep/Notes.md',
      '..\\secret.txt',
      'C:\\Users\\Ada\\secret.txt',
      'C:secret.txt',
      'Inbox.md:hidden-stream',
      'Plan.',
      'Plan ',
    ]
    for (const refusedVaultRelativePath of refusedVaultRelativePaths) {
      await expect(desktopFolderVaultAdapter.readVaultNoteText(refusedVaultRelativePath), refusedVaultRelativePath).rejects.toThrow('Outside Vault')
      await expect(desktopFolderVaultAdapter.writeVaultNoteText(refusedVaultRelativePath, 'x'), refusedVaultRelativePath).rejects.toThrow('Outside Vault')
    }
    const refusedVaultChanges: [string, () => Promise<unknown>][] = [
      ['create a note', () => desktopFolderVaultAdapter.createVaultNote('../New.md', 'x')],
      ['create a folder', () => desktopFolderVaultAdapter.createVaultFolder('Ideas//Later')],
      ['add a file', () => desktopFolderVaultAdapter.createVaultAttachmentFile('../photo.png', new Blob(['x']))],
      ['read a file', () => desktopFolderVaultAdapter.readVaultAttachmentFileBlob('../secret.txt')],
      ['rename from', () => desktopFolderVaultAdapter.renameVaultEntry('../secret.txt', 'secret.txt')],
      ['rename to', () => desktopFolderVaultAdapter.renameVaultEntry('Inbox.md', '../Inbox.md')],
      ['copy from', () => desktopFolderVaultAdapter.copyVaultEntry('../secret.txt', 'secret.txt')],
      ['copy to', () => desktopFolderVaultAdapter.copyVaultEntry('Inbox.md', 'Ideas/../../Inbox.md')],
      ['trash', () => desktopFolderVaultAdapter.moveVaultEntryToTrash('../secret.txt')],
      ['restore from', () => desktopFolderVaultAdapter.restoreVaultEntryFromTrash('.trash/../../secret.txt', 'secret.txt')],
      ['restore to', () => desktopFolderVaultAdapter.restoreVaultEntryFromTrash('.trash/Inbox.md', '../Inbox.md')],
      ['take back', () => desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('../Untitled.md') ?? Promise.resolve()],
      ['Sync read', () => desktopFolderVaultAdapter.readVaultFileBytes('../secret.txt')],
      ['Sync write', () => desktopFolderVaultAdapter.writeVaultFileBytes('../secret.txt', new TextEncoder().encode('x'))],
    ]
    for (const [refusedVaultChangeLabel, runRefusedVaultChange] of refusedVaultChanges) {
      await expect(runRefusedVaultChange(), refusedVaultChangeLabel).rejects.toThrow('Outside Vault')
    }
    expect(fakeDesktopFileSystem.fakeDesktopCalls.length).toBe(desktopCallCountBefore)
    // An import's own paths are checked as it writes them: the new folder is made, and nothing leaves it.
    await expect(desktopFolderVaultAdapter.importVaultFilesIntoNewFolder('Escape', [createTestImportFile('../../secret.txt', 'overwritten')])).rejects.toThrow('Outside Vault')
    expect(readDesktopTestVaultFolder()).toEqual({ ...vaultFolderContentsBefore, 'Escape/': '' })
    expect(fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestHomeFolderPath)['secret.txt']).toBe('not in the vault')
  })

  it('works when the native side gives no sizes or times', async () => {
    const { fakeDesktopFileSystem, desktopFolderVaultAdapter, addDesktopTestVaultFiles } = createDesktopTestVault()
    addDesktopTestVaultFiles({ 'Agent/plan.draft': 'plain words', 'over.log': 'a'.repeat(5 * 1024 * 1024 + 1) })
    await desktopFolderVaultAdapter.createVaultNote('Untitled.md', '')
    fakeDesktopFileSystem.isFakeDesktopFileStatKnown = false
    const syncableVaultFileStats = await desktopFolderVaultAdapter.listSyncableVaultFileStats()
    expect(syncableVaultFileStats.find((syncableVaultFileStat) => syncableVaultFileStat.vaultFileRelativePath === 'Inbox.md')?.vaultFileByteLength).toBe(7)
    expect(syncableVaultFileStats.every((syncableVaultFileStat) => Number.isFinite(syncableVaultFileStat.vaultFileModifiedAt))).toBe(true)
    await expect(desktopFolderVaultAdapter.readVaultNoteText('over.log')).rejects.toThrow('Text File Over 5 MB')
    expect(await desktopFolderVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    expect(describeListedVaultTreeEntries(await desktopFolderVaultAdapter.listVaultTreeEntries())).toContain('text-file:Agent/plan.draft')
    expect(await desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('Inbox.md')).toBe(false)
    expect(await desktopFolderVaultAdapter.takeBackEmptyNewVaultNote?.('Untitled.md')).toBe(true)
  })
})
