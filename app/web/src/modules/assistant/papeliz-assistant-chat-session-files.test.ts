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
    {
      chatSessionMessageRole: 'assistant',
      chatSessionMessageText: '> Read [[Garden plan]]\n\nThree beds.\n\n### You\nmight appear in an answer.\n### Assistant · or this',
      assistantReplyProviderModelName: 'test-model',
      assistantReplyProviderDisplayName: 'Test Provider',
    },
    { chatSessionMessageRole: 'user', chatSessionMessageText: 'Thanks' },
    {
      chatSessionMessageRole: 'assistant',
      chatSessionMessageText: 'You’re welcome.',
      assistantReplyProviderModelName: 'local "llama3.1:8b"',
      assistantReplyProviderDisplayName: 'Ollama',
    },
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
    expect(chatSessionFileText).toContain('\n\\### Assistant · or this\n')
    expect(parsePapelizChatSessionFile(chatSessionFileText)).toEqual(testChatSession)
  })

  it('name the model and provider of each answer in its heading', () => {
    const chatSessionFileText = formatPapelizChatSessionFile(testChatSession)
    expect(chatSessionFileText).toContain('\n### Assistant · test-model · Test Provider\n> Read [[Garden plan]]')
    expect(chatSessionFileText).toContain('\n### Assistant · local "llama3.1:8b" · Ollama\nYou’re welcome.')
    // A model name with " · " in it stays whole: the provider is the part after the last one.
    const separatorModelChatSession: PapelizChatSession = {
      ...testChatSession,
      chatSessionMessages: [
        { chatSessionMessageRole: 'user', chatSessionMessageText: 'Hi' },
        { chatSessionMessageRole: 'assistant', chatSessionMessageText: 'Hello.', assistantReplyProviderModelName: 'odd · model', assistantReplyProviderDisplayName: 'Custom' },
        { chatSessionMessageRole: 'user', chatSessionMessageText: 'Again' },
        { chatSessionMessageRole: 'assistant', chatSessionMessageText: 'Hello again.' },
      ],
    }
    expect(parsePapelizChatSessionFile(formatPapelizChatSessionFile(separatorModelChatSession))).toEqual(separatorModelChatSession)
  })

  it('put every answer of a note saved before answers named their model down to the note’s model', () => {
    const savedChatSession = parsePapelizChatSessionFile(
      '---\npapeliz-chat-session: old-2\nmodel: muse-spark-1.3\ntags: [chat-session]\n---\n# Hi\n\n### You\nHi\n\n### Assistant\nHello.\n\n### You\nAgain\n\n### Assistant\nHello again.\n',
    )
    expect(savedChatSession?.chatSessionMessages).toEqual([
      { chatSessionMessageRole: 'user', chatSessionMessageText: 'Hi' },
      { chatSessionMessageRole: 'assistant', chatSessionMessageText: 'Hello.', assistantReplyProviderModelName: 'muse-spark-1.3' },
      { chatSessionMessageRole: 'user', chatSessionMessageText: 'Again' },
      { chatSessionMessageRole: 'assistant', chatSessionMessageText: 'Hello again.', assistantReplyProviderModelName: 'muse-spark-1.3' },
    ])
    // With no model on record, the answers name none.
    const unknownModelChatSession = parsePapelizChatSessionFile('---\npapeliz-chat-session: old-3\nmodel: unknown\n---\n# Hi\n\n### You\nHi\n\n### Assistant\nHello.\n')
    expect(unknownModelChatSession?.chatSessionMessages[1]).toEqual({ chatSessionMessageRole: 'assistant', chatSessionMessageText: 'Hello.' })
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
