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

  it('renames a folder with everything inside it', async () => {
    const testVault = createTestVault()
    await testVault.renameVaultEntry('Guides', 'Help')
    expect(await testVault.readVaultNoteText('Help/Deep/Links.md')).toBe('# Links')
    await expect(testVault.readVaultNoteText('Guides/Callouts.md')).rejects.toThrow()
  })

  it('refuses a name that is already taken, ignoring case', async () => {
    const testVault = createTestVault()
    await expect(testVault.createVaultNote('inbox.md', '')).rejects.toThrow(/already exists/)
    await expect(testVault.renameVaultEntry('Guides/Callouts.md', 'INBOX.md')).rejects.toThrow(/already exists/)
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

  it('refuses to write inside .other-app', async () => {
    const testVault = createTestVault()
    await expect(testVault.writeVaultNoteText('.other-app/app.md', 'x')).rejects.toThrow()
  })
})
