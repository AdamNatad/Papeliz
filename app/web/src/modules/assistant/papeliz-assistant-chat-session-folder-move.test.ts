import { describe, expect, it } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { movePapelizEarlierChatSessionsIntoChatSessionsFolder } from './papeliz-assistant-chat-session-folder-move'
import { formatPapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import { papelizEmptyChatSessionTokenUsage } from './papeliz-assistant-token-usage'

function formatTestChatSessionFile(papelizChatSessionId: string) {
  return formatPapelizChatSessionFile({
    papelizChatSessionId,
    chatSessionTitle: `Chat ${papelizChatSessionId}`,
    chatSessionCreatedAt: '2026-10-27T09:00:00.000Z',
    chatSessionUpdatedAt: '2026-10-27T09:00:00.000Z',
    chatSessionModelName: 'model-a',
    chatSessionMessages: [{ chatSessionMessageRole: 'user', chatSessionMessageText: 'Hi' }],
    chatSessionTokenUsage: papelizEmptyChatSessionTokenUsage,
  })
}

async function listVaultEntryPaths(vaultAdapter: PapelizInMemoryVaultAdapter): Promise<string[]> {
  return (await vaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true })).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath).sort()
}

describe('moving earlier chats into .csessions', () => {
  it('renames a folder of only chats to .csessions when there is none yet', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-26 0900 One.md', vaultNoteText: formatTestChatSessionFile('one') },
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-27 0900 Two.md', vaultNoteText: formatTestChatSessionFile('two') },
      { vaultNoteRelativePath: 'Ideas.md', vaultNoteText: '# Ideas' },
    ])
    const movedChatSessionPaths = await movePapelizEarlierChatSessionsIntoChatSessionsFolder(vaultAdapter)
    expect(movedChatSessionPaths.get('Chat Sessions/2026-10-26 0900 One.md')).toBe('.csessions/2026-10-26 0900 One.md')
    expect(await listVaultEntryPaths(vaultAdapter)).toEqual(['.csessions', '.csessions/2026-10-26 0900 One.md', '.csessions/2026-10-27 0900 Two.md', 'Ideas.md'])
  })

  it('moves chats one by one into an existing .csessions, keeps other notes, and trashes a folder left empty', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: '.csessions/2026-10-28 0900 Now.md', vaultNoteText: formatTestChatSessionFile('now') },
      { vaultNoteRelativePath: '.chatsession/2026-10-28 0900 Now.md', vaultNoteText: formatTestChatSessionFile('same-name') },
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-20 0900 Old.md', vaultNoteText: formatTestChatSessionFile('old') },
      { vaultNoteRelativePath: 'Chat Sessions/My own note.md', vaultNoteText: '# Not a chat' },
    ])
    const movedChatSessionPaths = await movePapelizEarlierChatSessionsIntoChatSessionsFolder(vaultAdapter)
    expect(movedChatSessionPaths.get('.chatsession/2026-10-28 0900 Now.md')).toBe('.csessions/2026-10-28 0900 Now 2.md')
    const vaultEntryPaths = await listVaultEntryPaths(vaultAdapter)
    expect(vaultEntryPaths).toContain('.csessions/2026-10-20 0900 Old.md')
    expect(vaultEntryPaths).toContain('Chat Sessions/My own note.md')
    expect(vaultEntryPaths).not.toContain('.chatsession')
    expect(vaultEntryPaths.some((vaultEntryPath) => vaultEntryPath.startsWith('.trash/') && vaultEntryPath.includes('.chatsession'))).toBe(true)
  })

  it('leaves a vault with no earlier chats alone', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Chat Sessions/Plan.md', vaultNoteText: '# Plan' }])
    expect((await movePapelizEarlierChatSessionsIntoChatSessionsFolder(vaultAdapter)).size).toBe(0)
    expect(await listVaultEntryPaths(vaultAdapter)).toEqual(['Chat Sessions', 'Chat Sessions/Plan.md'])
  })
})
