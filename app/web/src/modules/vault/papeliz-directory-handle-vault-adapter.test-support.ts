import { describe, expect, it } from 'vitest'
import type { PapelizDirectoryHandleVaultAdapter } from './papeliz-directory-handle-vault-adapter'
import { addPapelizFakeVaultFiles, readPapelizFakeVaultFolder, type PapelizFakeDirectoryHandle } from './papeliz-fake-file-system-access.test-support'

// Test support only: what every vault reached through directory handles must do, run once for a
// folder on disk and once for each way a browser vault writes. The test vault holds these files.
export const papelizDirectoryHandleTestVaultFiles: Record<string, string> = {
  '.other-app/app.json': '{"theme":"light"}',
  '.git/HEAD': 'ref: refs/heads/main',
  'Inbox.md': '# Inbox',
  'Ideas/Offline-first apps.md': '# Offline-first apps',
  'Ideas/sketch.png': 'png bytes',
  'Ideas/Deep/Notes.md': '# Notes',
  'Empty folder/': '',
}

export interface PapelizDirectoryHandleTestVault {
  fakeVaultRootHandle: PapelizFakeDirectoryHandle
  directoryHandleVaultAdapter: PapelizDirectoryHandleVaultAdapter
}

export function describePapelizDirectoryHandleVaultAdapterCases(
  vaultKindLabel: string,
  createTestDirectoryHandleVault: () => Promise<PapelizDirectoryHandleTestVault>,
): void {
  describe(vaultKindLabel, () => {
    it('lists folders and .md notes, and leaves out hidden folders and other files', async () => {
      const { directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const listedVaultTreeEntries = await directoryHandleVaultAdapter.listVaultTreeEntries()
      expect(listedVaultTreeEntries.map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`).sort()).toEqual([
        'folder:Empty folder',
        'folder:Ideas',
        'folder:Ideas/Deep',
        'note:Ideas/Deep/Notes.md',
        'note:Ideas/Offline-first apps.md',
        'note:Inbox.md',
      ])
    })

    it('lists text files besides notes, known by name or by their first bytes, and leaves out pictures and binary files', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await addPapelizFakeVaultFiles(fakeVaultRootHandle, {
        'LICENSE': 'MIT License',
        'Agent/settings.json': '{"hooks":{}}',
        'Agent/plan.draft': 'plain words',
        'Agent/blob.draft': 'bytes\u0000with a zero byte',
        'Agent/.gitignore': 'node_modules/',
      })
      await directoryHandleVaultAdapter.writePapelizVaultSettingsFile('file-list-order.json', '{"fileListOrder":{}}')
      const describeListedTextFilesAndFolders = (listedVaultTreeEntries: readonly { vaultEntryRelativePath: string; vaultEntryKind: string }[]) =>
        listedVaultTreeEntries
          .filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind !== 'note')
          .map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`)
          .sort()
      expect(describeListedTextFilesAndFolders(await directoryHandleVaultAdapter.listVaultTreeEntries())).toEqual([
        'folder:Agent',
        'folder:Empty folder',
        'folder:Ideas',
        'folder:Ideas/Deep',
        'text-file:Agent/plan.draft',
        'text-file:Agent/settings.json',
        'text-file:LICENSE',
      ])
      // Show Hidden adds hidden files that are text, but never Papeliz's own `.papeliz/`.
      const everyListedEntry = describeListedTextFilesAndFolders(await directoryHandleVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }))
      expect(everyListedEntry).toEqual(expect.arrayContaining(['text-file:Agent/.gitignore', 'folder:.other-app', 'text-file:.other-app/app.json', 'folder:.git']))
      expect(everyListedEntry.some((listedEntry) => listedEntry.includes('.papeliz'))).toBe(false)
      // A text file reads and saves like a note.
      expect(await directoryHandleVaultAdapter.readVaultNoteText('Agent/settings.json')).toBe('{"hooks":{}}')
      await directoryHandleVaultAdapter.writeVaultNoteText('Agent/settings.json', '{"hooks":{"Stop":[]}}')
      expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Agent/settings.json']).toBe('{"hooks":{"Stop":[]}}')
    })

    it('keeps Papeliz’s own files in .papeliz/, hidden from the notes, and only by plain name', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      expect(await directoryHandleVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBeNull()
      await directoryHandleVaultAdapter.writePapelizVaultSettingsFile('file-list-order.json', '{"fileListOrder":{}}')
      expect(await directoryHandleVaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toBe('{"fileListOrder":{}}')
      expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['.papeliz/file-list-order.json']).toBe('{"fileListOrder":{}}')
      const listedPaths = (await directoryHandleVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
      expect(listedPaths.some((listedPath) => listedPath.startsWith('.papeliz'))).toBe(false)
      await expect(directoryHandleVaultAdapter.writePapelizVaultSettingsFile('../Inbox.md', 'x')).rejects.toThrow('Unknown Settings File')
      await expect(directoryHandleVaultAdapter.readPapelizVaultSettingsFile('.other-app/app.json')).rejects.toThrow('Unknown Settings File')
    })

    it('reads a note and saves it in place', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      expect(await directoryHandleVaultAdapter.readVaultNoteText('Ideas/Offline-first apps.md')).toBe('# Offline-first apps')
      await directoryHandleVaultAdapter.writeVaultNoteText('Ideas/Offline-first apps.md', '# Offline-first apps\n\nEdited.')
      expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Ideas/Offline-first apps.md']).toBe('# Offline-first apps\n\nEdited.')
    })

    it('keeps the old note when a save fails part-way', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const inboxFileHandle = await fakeVaultRootHandle.getFileHandle('Inbox.md')
      inboxFileHandle.shouldFailNextWriteClose = true
      await expect(directoryHandleVaultAdapter.writeVaultNoteText('Inbox.md', 'half-written')).rejects.toThrow()
      expect(await directoryHandleVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    })

    it('creates notes and folders, and refuses a name that is taken, ignoring case', async () => {
      const { directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await directoryHandleVaultAdapter.createVaultNote('Ideas/New idea.md', '')
      await directoryHandleVaultAdapter.createVaultFolder('Ideas/Later')
      await expect(directoryHandleVaultAdapter.createVaultNote('inbox.md', '')).rejects.toThrow('Name Taken')
      await expect(directoryHandleVaultAdapter.createVaultFolder('ideas')).rejects.toThrow('Name Taken')
      const listedPaths = (await directoryHandleVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
      expect(listedPaths).toContain('Ideas/New idea.md')
      expect(listedPaths).toContain('Ideas/Later')
    })

    it('renames a folder with everything in it, Markdown or not', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await directoryHandleVaultAdapter.renameVaultEntry('Ideas', 'Projects')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['Projects/Offline-first apps.md']).toBe('# Offline-first apps')
      expect(vaultFolderContents['Projects/sketch.png']).toBe('png bytes')
      expect(vaultFolderContents['Projects/Deep/Notes.md']).toBe('# Notes')
      expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('Ideas'))).toBe(false)
    })

    it('renames a note when only the case of its name changes', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await directoryHandleVaultAdapter.renameVaultEntry('Inbox.md', 'INBOX.md')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['INBOX.md']).toBe('# Inbox')
      expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.toLowerCase() === 'inbox.md')).toEqual(['INBOX.md'])
    })

    it('refuses to rename onto a name that is taken', async () => {
      const { directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await expect(directoryHandleVaultAdapter.renameVaultEntry('Ideas/Deep/Notes.md', 'Ideas/OFFLINE-FIRST APPS.md')).rejects.toThrow('Name Taken')
      await expect(directoryHandleVaultAdapter.renameVaultEntry('Ideas', 'Inbox.md')).rejects.toThrow('Name Taken')
      expect(await directoryHandleVaultAdapter.readVaultNoteText('Ideas/Deep/Notes.md')).toBe('# Notes')
    })

    it('moves deleted notes and folders into .trash, never erasing them', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      expect(await directoryHandleVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox.md')
      await directoryHandleVaultAdapter.createVaultNote('Inbox.md', 'second inbox')
      expect(await directoryHandleVaultAdapter.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox 2.md')
      expect(await directoryHandleVaultAdapter.moveVaultEntryToTrash('Ideas')).toBe('.trash/Ideas')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['.trash/Inbox.md']).toBe('# Inbox')
      expect(vaultFolderContents['.trash/Inbox 2.md']).toBe('second inbox')
      expect(vaultFolderContents['.trash/Ideas/sketch.png']).toBe('png bytes')
      expect(vaultFolderContents['.trash/Ideas/Deep/Notes.md']).toBe('# Notes')
      const listedPaths = (await directoryHandleVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
      expect(listedPaths).toEqual(['Empty folder'])
    })

    it('restores a note or folder from .trash with everything in it, onto a free name only', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await directoryHandleVaultAdapter.moveVaultEntryToTrash('Ideas')
      await directoryHandleVaultAdapter.moveVaultEntryToTrash('Inbox.md')
      await directoryHandleVaultAdapter.restoreVaultEntryFromTrash('.trash/Ideas', 'Empty folder/Ideas')
      await directoryHandleVaultAdapter.createVaultNote('Inbox.md', 'a new inbox')
      await expect(directoryHandleVaultAdapter.restoreVaultEntryFromTrash('.trash/Inbox.md', 'Inbox.md')).rejects.toThrow('Name Taken')
      await expect(directoryHandleVaultAdapter.restoreVaultEntryFromTrash('Inbox.md', 'Inbox 2.md')).rejects.toThrow('Not In Trash')
      await expect(directoryHandleVaultAdapter.restoreVaultEntryFromTrash('.trash/Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['Empty folder/Ideas/sketch.png']).toBe('png bytes')
      expect(vaultFolderContents['Empty folder/Ideas/Deep/Notes.md']).toBe('# Notes')
      expect(vaultFolderContents['.trash/Inbox.md']).toBe('# Inbox')
      expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('.trash/Ideas'))).toBe(false)
    })

    it('opens a text file up to 5 MB and refuses a bigger one before reading it; a note has no limit', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const fiveMegabytes = 5 * 1024 * 1024
      await addPapelizFakeVaultFiles(fakeVaultRootHandle, {
        'edge.log': 'a'.repeat(fiveMegabytes),
        'over.log': 'a'.repeat(fiveMegabytes + 1),
        'Big note.md': 'a'.repeat(fiveMegabytes + 1),
      })
      expect((await directoryHandleVaultAdapter.readVaultNoteText('edge.log')).length).toBe(fiveMegabytes)
      await expect(directoryHandleVaultAdapter.readVaultNoteText('over.log')).rejects.toThrow('Text File Over 5 MB')
      expect((await directoryHandleVaultAdapter.readVaultNoteText('Big note.md')).length).toBe(fiveMegabytes + 1)
    })

    it('takes back only an empty new note, and keeps any note with text or any other file', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await directoryHandleVaultAdapter.createVaultNote('Ideas/Untitled.md', '')
      expect(await directoryHandleVaultAdapter.takeBackEmptyNewVaultNote('Ideas/Untitled.md')).toBe(true)
      expect(await directoryHandleVaultAdapter.takeBackEmptyNewVaultNote('Inbox.md')).toBe(false)
      expect(await directoryHandleVaultAdapter.takeBackEmptyNewVaultNote('Empty folder')).toBe(false)
      await expect(directoryHandleVaultAdapter.takeBackEmptyNewVaultNote('.other-app/app.json')).rejects.toThrow('Hidden Folder')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(Object.keys(vaultFolderContents)).not.toContain('Ideas/Untitled.md')
      expect(vaultFolderContents['Inbox.md']).toBe('# Inbox')
      expect(vaultFolderContents['Ideas/Offline-first apps.md']).toBe('# Offline-first apps')
    })

    it('never writes inside .other-app or any other hidden folder', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await expect(directoryHandleVaultAdapter.writeVaultNoteText('.other-app/app.md', 'x')).rejects.toThrow('Hidden Folder')
      await expect(directoryHandleVaultAdapter.createVaultNote('.git/notes.md', 'x')).rejects.toThrow('Hidden Folder')
      await expect(directoryHandleVaultAdapter.renameVaultEntry('Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
      await expect(directoryHandleVaultAdapter.moveVaultEntryToTrash('.other-app')).rejects.toThrow('Hidden Folder')
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['.other-app/app.json']).toBe('{"theme":"light"}')
      expect(Object.keys(vaultFolderContents).filter((vaultRelativePath) => vaultRelativePath.startsWith('.other-app'))).toEqual([
        '.other-app/',
        '.other-app/app.json',
      ])
    })

    it('leaves the original in place, and no half copy, when a move cannot finish copying', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const ideasFolderHandle = await fakeVaultRootHandle.getDirectoryHandle('Ideas')
      // The copy of Ideas/Deep/Notes.md fails, so Ideas must stay where it was, complete.
      const deepFolderHandle = await ideasFolderHandle.getDirectoryHandle('Deep')
      const deepNotesFileHandle = await deepFolderHandle.getFileHandle('Notes.md')
      deepNotesFileHandle.getFile = async () => {
        throw new DOMException('The file is locked.', 'NoModificationAllowedError')
      }
      await expect(directoryHandleVaultAdapter.renameVaultEntry('Ideas', 'Projects')).rejects.toThrow()
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['Ideas/Offline-first apps.md']).toBe('# Offline-first apps')
      expect(vaultFolderContents['Ideas/sketch.png']).toBe('png bytes')
      expect(Object.keys(vaultFolderContents).some((vaultRelativePath) => vaultRelativePath.startsWith('Projects'))).toBe(false)
    })

    it('lists and reads the files that aren’t notes, leaving out hidden folders', async () => {
      const { directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      expect(await directoryHandleVaultAdapter.listVaultAttachmentFileRelativePaths()).toEqual(['Ideas/sketch.png'])
      expect(await (await directoryHandleVaultAdapter.readVaultAttachmentFileBlob('Ideas/sketch.png')).text()).toBe('png bytes')
      await expect(directoryHandleVaultAdapter.readVaultAttachmentFileBlob('Ideas/missing.png')).rejects.toThrow()
    })

    it('lists every file Papeliz Sync carries, with its size, and only those', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      await addPapelizFakeVaultFiles(fakeVaultRootHandle, {
        '.papeliz/file-order.json': '[]',
        '.csessions/Chat.md': '# Chat',
        '.chatsession/Earlier chat.md': '# Earlier',
        '.trash/Old.md': '# Old',
        '.DS_Store': 'x',
        'Ideas/.hidden-note.md': 'x',
      })
      const syncableVaultFileStats = await directoryHandleVaultAdapter.listSyncableVaultFileStats()
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
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const scanFileBytes = Uint8Array.from([0, 1, 2, 137, 255])
      await directoryHandleVaultAdapter.writeVaultFileBytes('Pictures/2026/scan.png', scanFileBytes)
      expect(await directoryHandleVaultAdapter.readVaultFileBytes('Pictures/2026/scan.png')).toEqual(scanFileBytes)
      await directoryHandleVaultAdapter.writeVaultFileBytes('Inbox.md', new TextEncoder().encode('# Inbox, from another device'))
      expect(await directoryHandleVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox, from another device')
      await directoryHandleVaultAdapter.writeVaultFileBytes('.papeliz/file-order.json', new TextEncoder().encode('[]'))
      await directoryHandleVaultAdapter.writeVaultFileBytes('.csessions/Chat.md', new TextEncoder().encode('# Chat'))
      const vaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      expect(vaultFolderContents['.papeliz/file-order.json']).toBe('[]')
      expect(vaultFolderContents['.csessions/Chat.md']).toBe('# Chat')
      expect(new TextDecoder().decode(await directoryHandleVaultAdapter.readVaultFileBytes('Ideas/sketch.png'))).toBe('png bytes')
      await expect(directoryHandleVaultAdapter.readVaultFileBytes('Ideas/missing.png')).rejects.toThrow()
    })

    it('never writes a file Papeliz Sync doesn’t carry', async () => {
      const { fakeVaultRootHandle, directoryHandleVaultAdapter } = await createTestDirectoryHandleVault()
      const vaultFolderContentsBefore = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
      for (const notSyncedVaultFileRelativePath of [
        '.git/HEAD',
        '.trash/Inbox.md',
        '.other-app/app.json',
        '.chatsession/Chat.md',
        '.papeliz/browser-vault.json',
        'Ideas/.hidden-note.md',
        '.DS_Store',
      ]) {
        await expect(directoryHandleVaultAdapter.writeVaultFileBytes(notSyncedVaultFileRelativePath, new TextEncoder().encode('x'))).rejects.toThrow('Not Synced')
      }
      expect(await readPapelizFakeVaultFolder(fakeVaultRootHandle)).toEqual(vaultFolderContentsBefore)
    })
  })
}
