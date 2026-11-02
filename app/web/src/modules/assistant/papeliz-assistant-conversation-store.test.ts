import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { startPapelizVaultKnowledgeSync } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { parsePapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'

// A fake provider that answers in a fixed order: search, read, propose an edit, then reply. Each
// answer counts 1000 more input tokens than the one before, and 20 output tokens.
function createScriptedProviderFetch() {
  const scriptedProviderReplies = [
    { tool_calls: [{ index: 0, id: 'call_search', function: { name: 'searchVaultNotes', arguments: '{"query":"garden"}' } }] },
    { tool_calls: [{ index: 0, id: 'call_read', function: { name: 'readVaultNote', arguments: '{"vaultNoteRelativePath":"Garden plan"}' } }] },
    {
      tool_calls: [
        {
          index: 0,
          id: 'call_propose',
          function: {
            name: 'proposeVaultNoteEdit',
            arguments: JSON.stringify({
              vaultNoteRelativePath: 'Projects/Garden plan.md',
              edits: [{ findText: 'Three raised beds.', replaceWithText: 'Three sunny raised beds.' }],
              reason: 'More precise.',
            }),
          },
        },
      ],
    },
    { content: 'I proposed an edit to [[Garden plan]].' },
  ]
  const providerRequestBodies: Array<{ messages: Array<{ role: string }> }> = []
  const scriptedProviderFetch = vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
    providerRequestBodies.push(JSON.parse(String(requestInit.body)))
    const scriptedReply = scriptedProviderReplies[providerRequestBodies.length - 1] ?? { content: 'Done.' }
    return Response.json({
      choices: [{ message: scriptedReply, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1000 * providerRequestBodies.length, completion_tokens: 20 },
    })
  })
  return { scriptedProviderFetch, providerRequestBodies }
}

async function waitUntil(isConditionMet: () => boolean) {
  for (let attempt = 0; attempt < 100 && !isConditionMet(); attempt += 1) await new Promise((resolveWait) => setTimeout(resolveWait, 10))
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('the assistant conversation', () => {
  it('looks things up, proposes an edit that changes nothing until accepted, and saves the chat in the vault', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch()
    vi.stubGlobal('fetch', scriptedProviderFetch)
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Projects/Garden plan.md', vaultNoteText: '# Garden plan\n\nThree raised beds.' },
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'conversation-test-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://provider.test/v1', providerModelName: 'test-model', providerApiKey: 'test-key' },
      },
    })
    await waitUntil(() => Object.keys(usePapelizWorkspaceStore.getState().vaultTreeEntries).length > 0)
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))

    // Only Write proposes changes.
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'write' })
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Improve my garden plan')

    const conversationState = usePapelizAssistantConversationStore.getState()
    expect(providerRequestBodies).toHaveLength(4)
    expect(providerRequestBodies[3]?.messages.filter((providerMessage) => providerMessage.role === 'tool')).toHaveLength(3)
    expect(conversationState.chatEntries.map((chatEntry) => chatEntry.chatEntryKind)).toEqual([
      'user-message',
      'tool-activity',
      'tool-activity',
      'tool-activity',
      'proposal',
      'assistant-message',
    ])
    const [assistantProposal] = Object.values(conversationState.assistantProposalsById)
    expect(assistantProposal?.proposalStatus).toBe('pending')
    expect(await vaultAdapter.readVaultNoteText('Projects/Garden plan.md')).toBe('# Garden plan\n\nThree raised beds.')

    await usePapelizAssistantConversationStore.getState().acceptAssistantProposal(assistantProposal!.assistantProposalId)
    expect(await vaultAdapter.readVaultNoteText('Projects/Garden plan.md')).toBe('# Garden plan\n\nThree sunny raised beds.')

    await waitUntil(() => usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath !== null)
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath
    expect(chatSessionVaultNoteRelativePath).toMatch(/^\.csessions\/\d{4}-\d{2}-\d{2} \d{4} Improve my garden plan\.md$/)
    const savedChatSession = parsePapelizChatSessionFile(await vaultAdapter.readVaultNoteText(chatSessionVaultNoteRelativePath!))
    expect(savedChatSession?.chatSessionMessages.map((chatSessionMessage) => chatSessionMessage.chatSessionMessageRole)).toEqual(['user', 'assistant'])
    expect(savedChatSession?.chatSessionMessages[1]?.chatSessionMessageText).toContain('> - Proposed an edit to [[Projects/Garden plan|Garden plan]] · accepted')

    // Every request of the tool loop is counted, and the context is the last request's in and out.
    const expectedChatSessionTokenUsage = {
      chatSessionTokenUsageTally: { assistantInputTokenCount: 10_000, assistantOutputTokenCount: 80, assistantRequestCount: 4, isAssistantTokenCountEstimated: false },
      chatSessionModelTokenUsageTallies: [
        { providerModelName: 'test-model', assistantInputTokenCount: 10_000, assistantOutputTokenCount: 80, assistantRequestCount: 4, isAssistantTokenCountEstimated: false },
      ],
      chatSessionContextTokenCount: 4020,
      isChatSessionContextTokenCountEstimated: false,
    }
    expect(usePapelizAssistantConversationStore.getState().chatSessionTokenUsage).toEqual(expectedChatSessionTokenUsage)
    expect(savedChatSession?.chatSessionTokenUsage).toEqual(expectedChatSessionTokenUsage)

    usePapelizAssistantConversationStore.getState().startNewAssistantChat()
    expect(usePapelizAssistantConversationStore.getState().chatSessionTokenUsage.chatSessionContextTokenCount).toBe(0)
    await usePapelizAssistantConversationStore.getState().openSavedChatSession(chatSessionVaultNoteRelativePath!)
    expect(usePapelizAssistantConversationStore.getState().chatSessionTokenUsage).toEqual(expectedChatSessionTokenUsage)
    stopVaultKnowledgeSync()
  })

  it('sends an open note as the open note, and never an open text file', async () => {
    const providerSystemMessages: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
        const providerRequestBody = JSON.parse(String(requestInit.body)) as { messages: Array<{ role: string; content: string }> }
        providerSystemMessages.push(providerRequestBody.messages.find((providerMessage) => providerMessage.role === 'system')?.content ?? '')
        return Response.json({ choices: [{ message: { content: 'Done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } })
      }),
    )
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' },
      { vaultNoteRelativePath: 'settings.json', vaultNoteText: '{"apiToken": "kept here"}' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'text-file-context-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://provider.test/v1', providerModelName: 'test-model', providerApiKey: 'test-key' },
      },
    })
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
    usePapelizAssistantConversationStore.getState().setAssistantContextMode('active-note')

    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('What is this?')
    expect(providerSystemMessages.at(-1)).toContain('<note path="Inbox.md">\nBuy seeds.')

    await usePapelizWorkspaceStore.getState().openVaultNote('settings.json')
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('And this?')
    expect(providerSystemMessages.at(-1)).not.toContain('settings.json')
    expect(providerSystemMessages.at(-1)).not.toContain('kept here')
    const userMessageEntries = usePapelizAssistantConversationStore.getState().chatEntries.filter((chatEntry) => chatEntry.chatEntryKind === 'user-message')
    expect(userMessageEntries.map((chatEntry) => chatEntry.chatEntryContextLabel)).toEqual(['Inbox', null])
  })

  it('shows and saves a provider error without the key, also when the stream breaks', async () => {
    const fakeCustomProxyApiKey = 'papeliz-fake-proxy-test-key-0000'
    let providerRequestCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        providerRequestCount += 1
        if (providerRequestCount === 1) return Response.json({ error: { message: `Invalid API key ${fakeCustomProxyApiKey}` } }, { status: 401 })
        // The answer starts, then its stream fails with a message that quotes the key.
        return new Response(
          new ReadableStream({
            start(streamController) {
              streamController.error(new TypeError(`The stream for key ${fakeCustomProxyApiKey} was cut off.`))
            },
          }),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        )
      }),
    )
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' }])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'provider-error-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://proxy.test/v1', providerModelName: 'test-model', providerApiKey: fakeCustomProxyApiKey },
      },
    })
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
    await waitUntil(() => Object.keys(usePapelizWorkspaceStore.getState().vaultTreeEntries).length > 0)

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Hello')
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Again')
    const errorNoticeTexts = usePapelizAssistantConversationStore
      .getState()
      .chatEntries.flatMap((chatEntry) => (chatEntry.chatEntryKind === 'notice' && chatEntry.isChatEntryError ? [chatEntry.chatEntryText] : []))
    expect(errorNoticeTexts).toEqual(['The provider refused the API key (401). The provider said: Invalid API key [hidden]', 'The stream for key [hidden] was cut off.'])

    // The chat is saved after each answer; this waits for the save after the second one.
    let savedChatSessionText = ''
    for (let attempt = 0; attempt < 100 && !savedChatSessionText.includes('was cut off'); attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10))
      const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath
      savedChatSessionText = chatSessionVaultNoteRelativePath === null ? '' : await vaultAdapter.readVaultNoteText(chatSessionVaultNoteRelativePath).catch(() => '')
    }
    expect(savedChatSessionText).toContain('> - The provider refused the API key (401). The provider said: Invalid API key [hidden]')
    expect(savedChatSessionText).toContain('> - The stream for key [hidden] was cut off.')
    expect(savedChatSessionText).not.toContain('papeliz-fake')
  })

  it('reopens a saved chat with its messages', async () => {
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      {
        vaultNoteRelativePath: 'Chat Sessions/2026-10-27 0900 Hello.md',
        vaultNoteText: '---\npapeliz-chat-session: saved-1\ncreated: 2026-10-27T01:00:00.000Z\nupdated: x\nmodel: m\ntags: [chat-session]\n---\n# Hello\n\n### You\nHello\n\n### Assistant\nHi there.\n',
      },
    ])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'saved-chat-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    await usePapelizAssistantConversationStore.getState().openSavedChatSession('Chat Sessions/2026-10-27 0900 Hello.md')
    const conversationState = usePapelizAssistantConversationStore.getState()
    expect(conversationState.papelizChatSessionId).toBe('saved-1')
    expect(conversationState.providerChatMessages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there.' },
    ])
    // Saved before token use was kept: it starts from none.
    expect(conversationState.chatSessionTokenUsage.chatSessionTokenUsageTally.assistantRequestCount).toBe(0)
    stopVaultKnowledgeSync()
  })
})
