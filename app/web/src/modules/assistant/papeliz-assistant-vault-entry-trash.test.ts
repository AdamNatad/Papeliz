import { describe, expect, it } from 'vitest'
import {
  findPapelizAssistantVaultEntryTrashProblem,
  keepOutermostPapelizVaultEntries,
  listPapelizAssistantWholeVaultTrashEntries,
} from './papeliz-assistant-vault-entry-trash'

describe('what the AI Assistant may move to the trash', () => {
  it('never moves saved chats, hidden folders or locked notes', () => {
    expect(findPapelizAssistantVaultEntryTrashProblem('Ideas/Compost.md', false, [])).toBeNull()
    expect(findPapelizAssistantVaultEntryTrashProblem('.csessions', false, [])).toBe('Saved Chats')
    expect(findPapelizAssistantVaultEntryTrashProblem('.csessions/2026-10-28 0900 Hi.md', false, [])).toBe('Saved Chats')
    expect(findPapelizAssistantVaultEntryTrashProblem('Chat Sessions', false, [])).toBe('Saved Chats')
    expect(findPapelizAssistantVaultEntryTrashProblem('.trash/Old.md', false, [])).toBe('Hidden Folder')
    expect(findPapelizAssistantVaultEntryTrashProblem('.git', false, [])).toBe('Hidden Folder')
    expect(findPapelizAssistantVaultEntryTrashProblem('Ideas', true, [])).toBe('All Notes Locked')
    expect(findPapelizAssistantVaultEntryTrashProblem('Ideas/Compost.md', false, ['Ideas/Compost.md'])).toBe('Note Locked')
    expect(findPapelizAssistantVaultEntryTrashProblem('Ideas/Compost.md', false, ['Ideas'])).toBe('Folder Locked')
    expect(findPapelizAssistantVaultEntryTrashProblem('Ideas', false, ['Ideas/Compost.md'])).toBe('Has Locked Notes')
    expect(findPapelizAssistantVaultEntryTrashProblem('', false, [])).toBe('Whole Vault')
  })

  it('takes the whole vault as its top entries, leaving the saved chats and hidden folders', () => {
    const vaultEntryRelativePaths = ['.csessions', '.csessions/Chat.md', '.trash', 'Ideas', 'Ideas/Compost.md', 'Inbox.md', 'Locked.md']
    expect(listPapelizAssistantWholeVaultTrashEntries(vaultEntryRelativePaths, false, ['Locked.md'])).toEqual(['Ideas', 'Inbox.md'])
  })

  it('leaves out what a folder in the list already takes along', () => {
    expect(keepOutermostPapelizVaultEntries(['Ideas/Compost.md', 'Ideas', 'Inbox.md', 'Inbox.md'])).toEqual(['Ideas', 'Inbox.md'])
  })
})
