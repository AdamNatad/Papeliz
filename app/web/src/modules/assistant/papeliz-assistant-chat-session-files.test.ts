import { describe, expect, it } from 'vitest'
import {
  buildPapelizChatSessionNotePath,
  formatPapelizChatSessionFile,
  parsePapelizChatSessionFile,
  type PapelizChatSession,
} from './papeliz-assistant-chat-session-files'
import { papelizEmptyChatSessionTokenUsage } from './papeliz-assistant-token-usage'

const testChatSession: PapelizChatSession = {
  papelizChatSessionId: 'session-1',
  chatSessionTitle: 'What did I plan for the garden?',
  chatSessionCreatedAt: '2026-10-27T15:40:00.000Z',
  chatSessionUpdatedAt: '2026-10-27T15:42:10.000Z',
  chatSessionModelName: 'test-model',
  chatSessionMessages: [
    { chatSessionMessageRole: 'user', chatSessionMessageText: 'What did I plan for the garden?' },
    { chatSessionMessageRole: 'assistant', chatSessionMessageText: '> Read [[Garden plan]]\n\nThree beds.\n\n### You\nmight appear in an answer.' },
    { chatSessionMessageRole: 'user', chatSessionMessageText: 'Thanks' },
  ],
  chatSessionTokenUsage: {
    chatSessionTokenUsageTally: { assistantInputTokenCount: 5400, assistantOutputTokenCount: 320, assistantRequestCount: 3, isAssistantTokenCountEstimated: true },
    chatSessionModelTokenUsageTallies: [
      { providerModelName: 'test-model', assistantInputTokenCount: 5000, assistantOutputTokenCount: 300, assistantRequestCount: 2, isAssistantTokenCountEstimated: false },
      { providerModelName: 'local "llama3.1:8b"', assistantInputTokenCount: 400, assistantOutputTokenCount: 20, assistantRequestCount: 1, isAssistantTokenCountEstimated: true },
    ],
    chatSessionContextTokenCount: 420,
    isChatSessionContextTokenCountEstimated: true,
  },
}

describe('chat session files', () => {
  it('write a readable note and read back the same conversation', () => {
    const chatSessionFileText = formatPapelizChatSessionFile(testChatSession)
    expect(chatSessionFileText).toContain('papeliz-chat-session: session-1')
    expect(chatSessionFileText).toContain('# What did I plan for the garden?\n\n### You\nWhat did I plan for the garden?')
    expect(chatSessionFileText).toContain('\\### You\nmight appear')
    expect(parsePapelizChatSessionFile(chatSessionFileText)).toEqual(testChatSession)
  })

  it('keep the chat’s token use in the frontmatter, one line per model', () => {
    const chatSessionFileText = formatPapelizChatSessionFile(testChatSession)
    expect(chatSessionFileText).toContain(
      [
        'model: test-model',
        'chat-session-input-tokens: 5400',
        'chat-session-output-tokens: 320',
        'chat-session-requests: 3',
        'chat-session-tokens-estimated: true',
        'chat-session-context-tokens: 420',
        'chat-session-context-tokens-estimated: true',
        'chat-session-tokens-by-model:',
        '  - "test-model · 5000 in · 300 out · 2 requests"',
        '  - "local \\"llama3.1:8b\\" · 400 in · 20 out · 1 request · estimated"',
        'tags: [chat-session]',
      ].join('\n'),
    )
  })

  it('read notes saved before token use was kept as no use', () => {
    const savedChatSession = parsePapelizChatSessionFile(
      '---\npapeliz-chat-session: old-1\ncreated: 2026-10-27T01:00:00.000Z\nupdated: x\nmodel: m\ntags: [chat-session]\n---\n# Hello\n\n### You\nHello\n',
    )
    expect(savedChatSession?.chatSessionTokenUsage).toEqual(papelizEmptyChatSessionTokenUsage)
    expect(formatPapelizChatSessionFile({ ...testChatSession, chatSessionTokenUsage: papelizEmptyChatSessionTokenUsage })).not.toContain('chat-session-tokens-by-model')
  })

  it('put totals with no model lines down to the chat’s model', () => {
    const savedChatSession = parsePapelizChatSessionFile(
      '---\npapeliz-chat-session: hand-1\nmodel: some-model\nchat-session-input-tokens: 100\nchat-session-output-tokens: 7\nchat-session-requests: 1\n---\n# Hi\n',
    )
    expect(savedChatSession?.chatSessionTokenUsage.chatSessionModelTokenUsageTallies).toEqual([
      { providerModelName: 'some-model', assistantInputTokenCount: 100, assistantOutputTokenCount: 7, assistantRequestCount: 1, isAssistantTokenCountEstimated: false },
    ])
  })

  it('ignore notes that are not chat sessions', () => {
    expect(parsePapelizChatSessionFile('# Garden plan\n\n### You\nnot a chat')).toBeNull()
    expect(parsePapelizChatSessionFile('---\ntags: [x]\n---\n# Note')).toBeNull()
  })

  it('name the file after the time and the first question, and keep the name free', () => {
    const chatSessionCreatedAt = new Date(2026, 9, 27, 23, 40)
    expect(buildPapelizChatSessionNotePath(chatSessionCreatedAt, 'What: did I plan? [[Garden]]', () => false)).toBe(
      '.csessions/2026-10-27 2340 What did I plan Garden.md',
    )
    expect(buildPapelizChatSessionNotePath(chatSessionCreatedAt, 'Hi', (candidateName) => candidateName === '2026-10-27 2340 Hi.md')).toBe(
      '.csessions/2026-10-27 2340 Hi 2.md',
    )
  })
})
