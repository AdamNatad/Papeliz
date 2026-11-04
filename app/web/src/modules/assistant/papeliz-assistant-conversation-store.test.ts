import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { startPapelizVaultKnowledgeSync } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { parsePapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import { isPapelizAssistantPlanChatEntry, usePapelizAssistantConversationStore, type PapelizAssistantPlanChatEntry } from './papeliz-assistant-conversation-store'
import { runPapelizInlineEdit } from './papeliz-assistant-inline-edit-run'
import { setPapelizAssistantPlanStepWords, togglePapelizAssistantPlanStepTicked } from './papeliz-assistant-plan-document'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'
import { readPapelizAssistantChatSessionRows } from './papeliz-assistant-vault-token-usage'

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
  usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask', assistantChangePermission: 'review-changes' })
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

  it('sends the notes the “sees” menu chose, names any past the limit, and keeps the choice with the chat', async () => {
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
      { vaultNoteRelativePath: 'Projects/Project Hub.md', vaultNoteText: 'Hub text.' },
      { vaultNoteRelativePath: 'Projects/Garden/Beds.md', vaultNoteText: 'Three beds.' },
      { vaultNoteRelativePath: 'Projects Archive/Old.md', vaultNoteText: 'Old text.' },
      // Nine long notes: eight fill the request, and the ninth is named for the assistant to read.
      ...Array.from({ length: 9 }, (_, longNoteIndex) => ({ vaultNoteRelativePath: `Long/Note ${longNoteIndex + 1}.md`, vaultNoteText: 'x'.repeat(20_000) })),
    ])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'context-choice-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://provider.test/v1', providerModelName: 'test-model', providerApiKey: 'test-key' },
      },
    })
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
    await waitUntil(() => usePapelizWorkspaceStore.getState().vaultTreeEntries.length > 0)
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    await usePapelizWorkspaceStore.getState().openVaultNote('Projects/Project Hub.md')
    const sendWithContextChoice = async (assistantContextChoice: Parameters<ReturnType<typeof usePapelizAssistantConversationStore.getState>['setAssistantContextChoice']>[0]) => {
      usePapelizAssistantConversationStore.getState().setAssistantContextChoice(assistantContextChoice)
      await usePapelizAssistantConversationStore.getState().sendAssistantMessage('What is in these?')
      return providerSystemMessages.at(-1) ?? ''
    }

    const thisNoteSystemMessage = await sendWithContextChoice({ assistantContextMode: 'active-note', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: null })
    expect(thisNoteSystemMessage).toContain('Its text:\n<note path="Projects/Project Hub.md">\nHub text.\n</note>')

    const openNotesSystemMessage = await sendWithContextChoice({ assistantContextMode: 'open-notes', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: null })
    expect(openNotesSystemMessage).toContain('The user asks about these 2 notes; their text follows.')
    expect(openNotesSystemMessage).toContain('<note path="Inbox.md">\nBuy seeds.\n</note>')
    expect(openNotesSystemMessage).toContain('<note path="Projects/Project Hub.md">\nHub text.\n</note>')
    expect(openNotesSystemMessage).not.toContain('Beds.md')

    const selectedNotesSystemMessage = await sendWithContextChoice({
      assistantContextMode: 'selected-notes',
      contextSelectedNoteRelativePaths: ['Projects/Garden/Beds.md', 'Inbox.md'],
      contextFolderRelativePath: null,
    })
    expect(selectedNotesSystemMessage).toContain('<note path="Projects/Garden/Beds.md">\nThree beds.\n</note>')
    expect(selectedNotesSystemMessage).toContain('<note path="Inbox.md">')
    expect(selectedNotesSystemMessage).not.toContain('<note path="Projects/Project Hub.md">')

    const folderSystemMessage = await sendWithContextChoice({ assistantContextMode: 'folder', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: 'Projects' })
    expect(folderSystemMessage).toContain('<note path="Projects/Project Hub.md">')
    expect(folderSystemMessage).toContain('<note path="Projects/Garden/Beds.md">')
    expect(folderSystemMessage).not.toContain('Projects Archive')
    expect(folderSystemMessage).not.toContain('<note path="Inbox.md">')

    const longFolderSystemMessage = await sendWithContextChoice({ assistantContextMode: 'folder', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: 'Long' })
    expect(longFolderSystemMessage.match(/<note path="Long\//g)).toHaveLength(8)
    expect(longFolderSystemMessage).toContain('read them with readVaultNote as needed: Long/Note 9.md')

    const wholeVaultSystemMessage = await sendWithContextChoice({ assistantContextMode: 'whole-vault', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: null })
    expect(wholeVaultSystemMessage).not.toContain('<note path=')

    const userMessageEntries = usePapelizAssistantConversationStore.getState().chatEntries.filter((chatEntry) => chatEntry.chatEntryKind === 'user-message')
    expect(userMessageEntries.map((chatEntry) => chatEntry.chatEntryContextLabel)).toEqual(['Project Hub', '2 open notes', '2 notes', 'Projects', 'Long', null])

    // The chat is saved with its choice; reopened, it sees the same.
    usePapelizAssistantConversationStore
      .getState()
      .setAssistantContextChoice({ assistantContextMode: 'folder', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: 'Projects/Garden' })
    let savedChatSessionText = ''
    for (let attempt = 0; attempt < 100 && !savedChatSessionText.includes('chat-session-sees-folder'); attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10))
      const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath
      savedChatSessionText = chatSessionVaultNoteRelativePath === null ? '' : await vaultAdapter.readVaultNoteText(chatSessionVaultNoteRelativePath).catch(() => '')
    }
    expect(savedChatSessionText).toContain('chat-session-sees: folder\nchat-session-sees-folder: "Projects/Garden"')
    const savedChatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath!
    usePapelizAssistantConversationStore.getState().startNewAssistantChat()
    usePapelizAssistantConversationStore.getState().setAssistantContextChoice({ assistantContextMode: 'active-note', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: null })
    await usePapelizAssistantConversationStore.getState().openSavedChatSession(savedChatSessionVaultNoteRelativePath)
    expect(usePapelizAssistantConversationStore.getState()).toMatchObject({ assistantContextMode: 'folder', assistantContextFolderRelativePath: 'Projects/Garden' })
    usePapelizAssistantConversationStore.getState().setAssistantContextChoice({ assistantContextMode: 'active-note', contextSelectedNoteRelativePaths: [], contextFolderRelativePath: null })
  })

  it('retries a failed answer from the same question, keeping what was typed since', async () => {
    const providerRequestBodies: Array<{ messages: Array<{ role: string; content: string }> }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
        providerRequestBodies.push(JSON.parse(String(requestInit.body)))
        if (providerRequestBodies.length === 1) return Response.json({ error: { message: 'Not now.' } }, { status: 401 })
        return Response.json({ choices: [{ message: { content: 'Here it is.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } })
      }),
    )
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' }])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'retry-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://provider.test/v1', providerModelName: 'test-model', providerApiKey: 'test-key' },
      },
    })
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
    await waitUntil(() => usePapelizWorkspaceStore.getState().vaultTreeEntries.length > 0)

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Summarize my inbox')
    const failedConversationState = usePapelizAssistantConversationStore.getState()
    const errorNoticeEntry = failedConversationState.chatEntries.at(-1)
    expect(errorNoticeEntry).toMatchObject({ chatEntryKind: 'notice', isChatEntryError: true })
    expect(failedConversationState.retryableAssistantErrorChatEntryId).toBe(errorNoticeEntry?.chatEntryId)

    usePapelizAssistantConversationStore.getState().setComposerDraftText('Then the garden')
    usePapelizAssistantConversationStore.getState().retryAssistantAnswer()
    await waitUntil(() => !usePapelizAssistantConversationStore.getState().isAssistantRunning)
    const retriedConversationState = usePapelizAssistantConversationStore.getState()
    expect(retriedConversationState.chatEntries.map((chatEntry) => chatEntry.chatEntryKind)).toEqual(['user-message', 'assistant-message'])
    expect(retriedConversationState.retryableAssistantErrorChatEntryId).toBeNull()
    expect(retriedConversationState.composerDraftText).toBe('Then the garden')
    // The question goes once in the retried request, not twice.
    expect(providerRequestBodies[1]?.messages.filter((providerMessage) => providerMessage.role === 'user').map((providerMessage) => providerMessage.content)).toEqual([
      'Summarize my inbox',
    ])
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
    // Saved before answers named their model: the answer is put down to the note's model.
    const reopenedAssistantMessage = conversationState.chatEntries.find((chatEntry) => chatEntry.chatEntryKind === 'assistant-message')
    expect(reopenedAssistantMessage).toMatchObject({ assistantReplyProviderModelName: 'm', assistantReplyProviderDisplayName: undefined })
    stopVaultKnowledgeSync()
  })

  it('tells the model which model and provider it runs on, and keeps each answer’s model when the chip switches', async () => {
    const providerSystemMessages: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
        const providerRequestBody = JSON.parse(String(requestInit.body)) as { model: string; messages: Array<{ role: string; content: string }> }
        providerSystemMessages.push(providerRequestBody.messages.find((providerMessage) => providerMessage.role === 'system')?.content ?? '')
        return Response.json({ choices: [{ message: { content: `I am ${providerRequestBody.model}.` }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } })
      }),
    )
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' }])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'answer-model-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'meta-model-api',
      activeAssistantProviderModelName: 'muse-spark-1.3-contributor',
      providerSettingsByProviderId: {
        'meta-model-api': {
          papelizAssistantProviderId: 'meta-model-api',
          providerBaseUrl: 'https://first-provider.test/v1',
          providerApiKey: 'test-first-key',
          enabledProviderModelNames: ['muse-spark-1.3-contributor'],
        },
        claude: { papelizAssistantProviderId: 'claude', providerBaseUrl: 'https://second-provider.test/v1', providerApiKey: 'test-second-key', enabledProviderModelNames: ['claude-haiku-5-5'] },
      },
    })
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
    await waitUntil(() => usePapelizWorkspaceStore.getState().vaultTreeEntries.length > 0)

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('What model are you?')
    expect(providerSystemMessages.at(-1)).toContain(
      'You are the assistant inside Papeliz, a Free, Open-Source Markdown Editor for your Personal Knowledge Base, with a built-in AI Assistant and Workflow Templates for Coding and AI Agents. You help the user with their vault',
    )
    expect(providerSystemMessages.at(-1)).toContain('You run on the model “muse-spark-1.3-contributor” from the provider “Meta Model API”')
    expect(providerSystemMessages.at(-1)).toContain('Never claim to be another model')
    expect(providerSystemMessages.at(-1)).toContain(
      'When asked who you are or who made you, answer as Papeliz: Papeliz is a Free, Open-Source Markdown Editor for building your Personal Knowledge Base, with a built-in AI Assistant that works with your Preferred AI Provider, as well as the ability to create and import Workflow Templates for Coding and AI Agents. Papeliz is made by Adam Natad.',
    )
    usePapelizAssistantProviderSettingsStore.setState({ activeAssistantProviderId: 'claude', activeAssistantProviderModelName: 'claude-haiku-5-5' })
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('And now?')
    expect(providerSystemMessages.at(-1)).toContain('You run on the model “claude-haiku-5-5” from the provider “Claude”')

    const answeredProviderModels = usePapelizAssistantConversationStore
      .getState()
      .chatEntries.flatMap((chatEntry) => (chatEntry.chatEntryKind === 'assistant-message' ? [[chatEntry.assistantReplyProviderModelName, chatEntry.assistantReplyProviderDisplayName]] : []))
    expect(answeredProviderModels).toEqual([
      ['muse-spark-1.3-contributor', 'Meta Model API'],
      ['claude-haiku-5-5', 'Claude'],
    ])

    // The saved chat names each answer's model, so it shows again when reopened.
    let savedChatSessionText = ''
    for (let attempt = 0; attempt < 100 && !savedChatSessionText.includes('I am claude-haiku-5-5.'); attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10))
      const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath
      savedChatSessionText = chatSessionVaultNoteRelativePath === null ? '' : await vaultAdapter.readVaultNoteText(chatSessionVaultNoteRelativePath).catch(() => '')
    }
    expect(savedChatSessionText).toContain('\nmodel: claude-haiku-5-5\n')
    expect(savedChatSessionText).toContain('### Assistant · muse-spark-1.3-contributor · Meta Model API\nI am muse-spark-1.3-contributor.')
    expect(savedChatSessionText).toContain('### Assistant · claude-haiku-5-5 · Claude\nI am claude-haiku-5-5.')
    const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath!
    usePapelizAssistantConversationStore.getState().startNewAssistantChat()
    await usePapelizAssistantConversationStore.getState().openSavedChatSession(chatSessionVaultNoteRelativePath)
    const reopenedProviderModels = usePapelizAssistantConversationStore
      .getState()
      .chatEntries.flatMap((chatEntry) => (chatEntry.chatEntryKind === 'assistant-message' ? [[chatEntry.assistantReplyProviderModelName, chatEntry.assistantReplyProviderDisplayName]] : []))
    expect(reopenedProviderModels).toEqual(answeredProviderModels)

    // An inline edit is told the same.
    await runPapelizInlineEdit({
      inlineEditInstruction: 'Shorter',
      selectedPassageText: 'Buy seeds.',
      vaultNoteTitle: 'Inbox',
      abortSignal: new AbortController().signal,
      onReplacementTextDelta: () => undefined,
    })
    expect(providerSystemMessages.at(-1)).toContain('You run on the model “claude-haiku-5-5” from the provider “Claude”')
  })
})

interface PlanProviderRequestBody {
  messages: Array<{ role: string; content?: string | null }>
  tools?: Array<{ function: { name: string } }>
}

// A fake provider whose reply depends on what it is asked: the plan, then each step Build sends, then
// a line after each step's tool call.
function createPlanProviderFetch(answerProviderRequest: (providerRequestBody: PlanProviderRequestBody) => Record<string, unknown>) {
  const providerRequestBodies: PlanProviderRequestBody[] = []
  const planProviderFetch = vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
    const providerRequestBody = JSON.parse(String(requestInit.body)) as PlanProviderRequestBody
    providerRequestBodies.push(providerRequestBody)
    return Response.json({ choices: [{ message: answerProviderRequest(providerRequestBody), finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 10 } })
  })
  return { planProviderFetch, providerRequestBodies }
}

function scriptProposedEdit(toolCallId: string, vaultNoteRelativePath: string, findText: string, replaceWithText: string) {
  return {
    tool_calls: [
      { index: 0, id: toolCallId, function: { name: 'proposeVaultNoteEdit', arguments: JSON.stringify({ vaultNoteRelativePath, edits: [{ findText, replaceWithText }], reason: 'The step.' }) } },
    ],
  }
}

async function waitUntilVaultNoteText(vaultAdapter: PapelizInMemoryVaultAdapter, vaultNoteRelativePath: string, isVaultNoteTextReady: (vaultNoteText: string) => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const vaultNoteText = await vaultAdapter.readVaultNoteText(vaultNoteRelativePath).catch(() => '')
    if (isVaultNoteTextReady(vaultNoteText)) return vaultNoteText
    await new Promise((resolveWait) => setTimeout(resolveWait, 10))
  }
  return vaultAdapter.readVaultNoteText(vaultNoteRelativePath).catch(() => '')
}

function readPlanEntry(): PapelizAssistantPlanChatEntry {
  const planEntry = usePapelizAssistantConversationStore.getState().chatEntries.find(isPapelizAssistantPlanChatEntry)
  if (planEntry === undefined) throw new Error('The conversation should have a plan.')
  return planEntry
}

describe('Plan mode', () => {
  it('writes a plan that is changed on its card, then builds it step by step, ticking its note in Plans/ and keeping it with the chat', async () => {
    const tidyGardenPlanText =
      'I read your notes.\n\n# Tidy the garden\n\nGoal: One clear garden note.\n\n- [ ] Name the beds in [[Garden]].\n- [ ] Move the seeds task from [[Inbox]] into [[Garden]].\n- [ ] Link [[Garden]] from [[Inbox]].'
    const { planProviderFetch, providerRequestBodies } = createPlanProviderFetch((providerRequestBody) => {
      const lastProviderMessage = providerRequestBody.messages.at(-1)
      if (lastProviderMessage?.role === 'tool') return { content: 'I proposed the change.' }
      const lastUserMessageText = lastProviderMessage?.content ?? ''
      if (lastUserMessageText.startsWith('Build step 1 of 3')) return scriptProposedEdit('call_step_1', 'Garden.md', 'Three beds.', 'Three beds: north, south and east.')
      if (lastUserMessageText.startsWith('Build step 2 of 3')) return scriptProposedEdit('call_step_2', 'Inbox.md', 'Buy seeds.', 'Seeds: see [[Garden]].')
      return { content: tidyGardenPlanText }
    })
    vi.stubGlobal('fetch', planProviderFetch)
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden\n\nThree beds.' },
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Buy seeds.' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      { papelizVaultId: 'plan-build-test-vault', papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'custom',
      providerSettingsByProviderId: {
        custom: { papelizAssistantProviderId: 'custom', providerBaseUrl: 'https://provider.test/v1', providerModelName: 'test-model', providerApiKey: 'test-key' },
      },
    })
    await waitUntil(() => usePapelizWorkspaceStore.getState().vaultTreeEntries.length > 0)
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'plan', assistantChangePermission: 'review-changes' })

    // Plan looks things up and changes nothing; its words ask for the checklist.
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Plan a tidy-up of my garden notes')
    const planToolNames = providerRequestBodies[0]?.tools?.map((chatTool) => chatTool.function.name) ?? []
    expect(planToolNames).toContain('askUserQuestion')
    expect(planToolNames.some((toolName) => toolName.startsWith('propose'))).toBe(false)
    const planSystemMessageText = providerRequestBodies[0]?.messages[0]?.content ?? ''
    expect(planSystemMessageText).toContain('You are in Plan mode')
    expect(planSystemMessageText).toContain('one `- [ ] ` line each')
    expect(planSystemMessageText).toContain('answer it briefly')
    const planEntry = readPlanEntry()
    expect(planEntry.assistantPlanDocument).toMatchObject({ planTitle: 'Tidy the garden', planGoalText: 'One clear garden note.', planBuildPhase: 'draft' })
    const [nameBedsStep, moveSeedsStep, linkGardenStep] = planEntry.assistantPlanDocument.planSteps

    // Changed on the card before it is built: a step reworded, and one ticked as already done.
    const { changeAssistantPlanDocument } = usePapelizAssistantConversationStore.getState()
    changeAssistantPlanDocument(planEntry.chatEntryId, (planDocument) =>
      setPapelizAssistantPlanStepWords(planDocument, moveSeedsStep!.planStepId, 'Move the seeds task from [[Inbox]] into [[Garden]], under Seeds.'),
    )
    changeAssistantPlanDocument(planEntry.chatEntryId, (planDocument) => togglePapelizAssistantPlanStepTicked(planDocument, linkGardenStep!.planStepId))

    await usePapelizAssistantConversationStore.getState().buildAssistantPlan(planEntry.chatEntryId)
    // The Assistant moves to Write as the build starts, where its steps run.
    expect(usePapelizAssistantRunOptionsStore.getState().assistantMode).toBe('write')
    await waitUntil(() => readPlanEntry().assistantPlanDocument.planSteps[0]?.planStepStatus === 'needs-review')
    // Build saved the plan in Plans/ first, tied to its chat.
    const chatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath
    expect(readPlanEntry().savedPlanVaultNoteRelativePath).toBe('Plans/Tidy the garden.md')
    const firstPlanNoteText = await vaultAdapter.readVaultNoteText('Plans/Tidy the garden.md')
    expect(firstPlanNoteText).toContain(`papeliz-plan: in-progress\npapeliz-plan-chat: ${getVaultNoteTitle(chatSessionVaultNoteRelativePath ?? '')}\n---`)
    expect(firstPlanNoteText).toContain('- [ ] Move the seeds task from [[Inbox]] into [[Garden]], under Seeds.\n- [x] Link [[Garden]] from [[Inbox]].')

    // The step runs as Write with its own words and the plan as it stands, and asks nothing.
    const firstStepRequest = providerRequestBodies.find((providerRequestBody) => providerRequestBody.messages.at(-1)?.content?.startsWith('Build step 1 of 3'))
    expect(firstStepRequest?.messages.at(-1)?.content).toContain('Build step 1 of 3 of the plan “Tidy the garden”: Name the beds in [[Garden]].')
    expect(firstStepRequest?.messages.at(-1)?.content).toContain('- [x] Link [[Garden]] from [[Inbox]].')
    const firstStepToolNames = firstStepRequest?.tools?.map((chatTool) => chatTool.function.name) ?? []
    expect(firstStepToolNames).toContain('proposeVaultNoteEdit')
    expect(firstStepToolNames).not.toContain('askUserQuestion')
    expect(firstStepRequest?.messages[0]?.content).toContain('You are building one step of a plan')
    // What the step did is drawn under the step, not in the conversation.
    const firstStepEntryKinds = usePapelizAssistantConversationStore
      .getState()
      .chatEntries.filter((chatEntry) => chatEntry.assistantPlanStepRun?.planStepId === nameBedsStep!.planStepId)
      .map((chatEntry) => chatEntry.chatEntryKind)
    expect(firstStepEntryKinds).toEqual(['user-message', 'tool-activity', 'proposal', 'assistant-message'])
    expect(await vaultAdapter.readVaultNoteText('Garden.md')).toBe('# Garden\n\nThree beds.')

    // Accepting the step's change finishes it, ticks the note, and starts the next step.
    const [firstStepProposalId] = readPlanEntry().assistantPlanDocument.planSteps[0]!.planStepProposalIds
    await usePapelizAssistantConversationStore.getState().acceptAssistantProposal(firstStepProposalId!)
    expect(await vaultAdapter.readVaultNoteText('Garden.md')).toBe('# Garden\n\nThree beds: north, south and east.')
    await waitUntil(() => readPlanEntry().assistantPlanDocument.planSteps[1]?.planStepStatus === 'needs-review')
    expect(readPlanEntry().assistantPlanDocument.planSteps[0]?.planStepStatus).toBe('done')
    expect(await waitUntilVaultNoteText(vaultAdapter, 'Plans/Tidy the garden.md', (planNoteText) => planNoteText.includes('- [x] Name the beds'))).toContain(
      '- [x] Name the beds in [[Garden]].',
    )

    // Rejecting every change of a step leaves it unticked and goes on; the ticked step is skipped, so
    // the plan is built.
    const [secondStepProposalId] = readPlanEntry().assistantPlanDocument.planSteps[1]!.planStepProposalIds
    usePapelizAssistantConversationStore.getState().rejectAssistantProposal(secondStepProposalId!)
    await waitUntil(() => readPlanEntry().assistantPlanDocument.planBuildPhase === 'done')
    expect(readPlanEntry().assistantPlanDocument.planSteps.map((planStep) => planStep.planStepStatus)).toEqual(['done', 'skipped', 'ticked'])
    expect(usePapelizAssistantRunOptionsStore.getState().assistantMode).toBe('write')
    expect(providerRequestBodies.filter((providerRequestBody) => providerRequestBody.messages.at(-1)?.content?.startsWith('Build step 3'))).toHaveLength(0)
    expect(await vaultAdapter.readVaultNoteText('Inbox.md')).toBe('Buy seeds.')
    const finalPlanNoteText = await waitUntilVaultNoteText(vaultAdapter, 'Plans/Tidy the garden.md', (planNoteText) => !planNoteText.includes('- [ ] Name'))
    expect(finalPlanNoteText).toContain('papeliz-plan: in-progress')
    expect(finalPlanNoteText).toContain('- [x] Name the beds in [[Garden]].\n- [ ] Move the seeds task')

    // The chat keeps the plan and each step's state; its build is quoted in the plan's answer.
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    const savedChatSession = parsePapelizChatSessionFile(await vaultAdapter.readVaultNoteText(chatSessionVaultNoteRelativePath!))
    expect(savedChatSession?.chatSessionMessages.map((chatSessionMessage) => chatSessionMessage.chatSessionMessageRole)).toEqual(['user', 'assistant'])
    expect(savedChatSession?.chatSessionPlanState).toEqual({
      chatSessionPlanMessageIndex: 1,
      chatSessionPlanBuildPhase: 'done',
      chatSessionPlanNoteRelativePath: 'Plans/Tidy the garden.md',
      chatSessionPlanStepStates: [
        { planStepStatus: 'done', planStepProblem: null },
        { planStepStatus: 'skipped', planStepProblem: null },
        { planStepStatus: 'ticked', planStepProblem: null },
      ],
    })
    const savedPlanMessageText = savedChatSession?.chatSessionMessages[1]?.chatSessionMessageText ?? ''
    expect(savedPlanMessageText).toContain('> - Step 1 · Proposed an edit to [[Garden|Garden]] · accepted')
    expect(savedPlanMessageText).toContain('> - Step 2 · Proposed an edit to [[Inbox|Inbox]] · rejected')
    expect(savedPlanMessageText).toContain('# Tidy the garden\n\nGoal: One clear garden note.\n\n- [x] Name the beds in [[Garden]].')
    // Sessions shows how far it was built.
    const [chatSessionRow] = await readPapelizAssistantChatSessionRows(usePapelizWorkspaceStore.getState().openVault!, [chatSessionVaultNoteRelativePath!])
    expect(chatSessionRow?.chatSessionPlanProgress).toEqual({ planStepDoneCount: 2, planStepCount: 3, chatSessionPlanBuildPhase: 'done' })

    // Reopened, the chat brings the plan back as it was.
    usePapelizAssistantConversationStore.getState().startNewAssistantChat()
    await usePapelizAssistantConversationStore.getState().openSavedChatSession(chatSessionVaultNoteRelativePath!)
    expect(readPlanEntry().savedPlanVaultNoteRelativePath).toBe('Plans/Tidy the garden.md')
    expect(readPlanEntry().assistantPlanDocument).toMatchObject({ planTitle: 'Tidy the garden', planBuildPhase: 'done' })
    expect(readPlanEntry().assistantPlanDocument.planSteps.map(({ planStepWords, planStepStatus }) => [planStepWords, planStepStatus])).toEqual([
      ['Name the beds in [[Garden]].', 'done'],
      ['Move the seeds task from [[Inbox]] into [[Garden]], under Seeds.', 'skipped'],
      ['Link [[Garden]] from [[Inbox]].', 'ticked'],
    ])
    usePapelizAssistantConversationStore.getState().startNewAssistantChat()
    stopVaultKnowledgeSync()
  })
})
