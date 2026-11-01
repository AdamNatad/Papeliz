import { describe, expect, it } from 'vitest'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'

function createTestVault() {
  return new PapelizInMemoryVaultAdapter([
    { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '# Inbox' },
    { vaultNoteRelativePath: 'Guides/Callouts.md', vaultNoteText: '# Callouts' },
    { vaultNoteRelativePath: 'Guides/Deep/Links.md', vaultNoteText: '# Links' },
  ])
}

describe('the in-memory vault', () => {
  it('lists folders and notes', async () => {
    const testVault = createTestVault()
    const listedPaths = (await testVault.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath).sort()
    expect(listedPaths).toEqual(['Guides', 'Guides/Callouts.md', 'Guides/Deep', 'Guides/Deep/Links.md', 'Inbox.md'])
  })

  it('lists a kept file that isn’t a note as a text file', async () => {
    const testVault = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '# Inbox' },
      { vaultNoteRelativePath: 'Agent/settings.json', vaultNoteText: '{}' },
    ])
    const listedEntries = (await testVault.listVaultTreeEntries()).map((vaultTreeEntry) => `${vaultTreeEntry.vaultEntryKind}:${vaultTreeEntry.vaultEntryRelativePath}`).sort()
    expect(listedEntries).toEqual(['folder:Agent', 'note:Inbox.md', 'text-file:Agent/settings.json'])
  })

  it('renames a folder with everything inside it', async () => {
    const testVault = createTestVault()
    await testVault.renameVaultEntry('Guides', 'Help')
    expect(await testVault.readVaultNoteText('Help/Deep/Links.md')).toBe('# Links')
    await expect(testVault.readVaultNoteText('Guides/Callouts.md')).rejects.toThrow()
  })

  it('refuses a name that is already taken, ignoring case', async () => {
    const testVault = createTestVault()
    await expect(testVault.createVaultNote('inbox.md', '')).rejects.toThrow('Name Taken')
    await expect(testVault.renameVaultEntry('Guides/Callouts.md', 'INBOX.md')).rejects.toThrow('Name Taken')
  })

  it('allows a rename that only changes case', async () => {
    const testVault = createTestVault()
    await testVault.renameVaultEntry('Inbox.md', 'INBOX.md')
    expect(await testVault.readVaultNoteText('INBOX.md')).toBe('# Inbox')
  })

  it('moves deleted notes into .trash and keeps them out of the list', async () => {
    const testVault = createTestVault()
    expect(await testVault.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox.md')
    await testVault.createVaultNote('Inbox.md', 'again')
    expect(await testVault.moveVaultEntryToTrash('Inbox.md')).toBe('.trash/Inbox 2.md')
    expect(await testVault.readVaultNoteText('.trash/Inbox.md')).toBe('# Inbox')
    const listedPaths = (await testVault.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(listedPaths.some((listedPath) => listedPath.startsWith('.trash'))).toBe(false)
  })

  it('restores from .trash only, into a folder that is there, under a free name', async () => {
    const testVault = createTestVault()
    await testVault.moveVaultEntryToTrash('Inbox.md')
    await expect(testVault.restoreVaultEntryFromTrash('.trash/Inbox.md', 'Gone/Inbox.md')).rejects.toThrow('Not In Vault')
    await expect(testVault.restoreVaultEntryFromTrash('Ideas', 'Ideas 2')).rejects.toThrow('Not In Trash')
    await expect(testVault.restoreVaultEntryFromTrash('.trash', 'Trash')).rejects.toThrow('Not In Trash')
    await expect(testVault.restoreVaultEntryFromTrash('.trash/Inbox.md', '.other-app/Inbox.md')).rejects.toThrow('Hidden Folder')
    await testVault.restoreVaultEntryFromTrash('.trash/Inbox.md', 'Inbox.md')
    expect(await testVault.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    await testVault.moveVaultEntryToTrash('Inbox.md')
    await testVault.createVaultNote('Inbox.md', 'again')
    await expect(testVault.restoreVaultEntryFromTrash('.trash/Inbox.md', 'Inbox.md')).rejects.toThrow('Name Taken')
  })

  it('refuses to write inside .other-app', async () => {
    const testVault = createTestVault()
    await expect(testVault.writeVaultNoteText('.other-app/app.md', 'x')).rejects.toThrow()
  })

  it('lists and reads the files that aren’t notes, leaving out hidden ones', async () => {
    const testVault = createTestVault()
    await testVault.createVaultAttachmentFile('Ideas/sketch.png', new Blob(['png bytes']))
    await testVault.createVaultAttachmentFile('.csessions/chat-picture.png', new Blob(['chat']))
    expect(await testVault.listVaultAttachmentFileRelativePaths()).toEqual(['Ideas/sketch.png'])
    expect(await (await testVault.readVaultAttachmentFileBlob('Ideas/sketch.png')).text()).toBe('png bytes')
    await expect(testVault.readVaultAttachmentFileBlob('Ideas/missing.png')).rejects.toThrow('Not In Vault')
  })
})
