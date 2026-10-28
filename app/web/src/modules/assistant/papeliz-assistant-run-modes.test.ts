import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { startPapelizVaultKnowledgeSync } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'

interface ScriptedProviderRequestBody {
  messages: Array<{ role: string; content?: string | null }>
  tools?: Array<{ function: { name: string } }>
  reasoning_effort?: string
}

// A fake provider that gives the scripted replies in order. `onProviderRequest` runs while a
// request is in flight, as if the user typed something during the answer.
function createScriptedProviderFetch(scriptedProviderReplies: readonly Record<string, unknown>[], onProviderRequest?: (requestNumber: number) => void) {
  const providerRequestBodies: ScriptedProviderRequestBody[] = []
  const scriptedProviderFetch = vi.fn(async (_requestUrl: string, requestInit: RequestInit) => {
    providerRequestBodies.push(JSON.parse(String(requestInit.body)) as ScriptedProviderRequestBody)
    onProviderRequest?.(providerRequestBodies.length)
    return Response.json({
      choices: [{ message: scriptedProviderReplies[providerRequestBodies.length - 1] ?? { content: 'Done.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    })
  })
  return { scriptedProviderFetch, providerRequestBodies }
}

function scriptToolCall(toolCallId: string, toolName: string, toolArguments: Record<string, unknown>) {
  return { tool_calls: [{ index: 0, id: toolCallId, function: { name: toolName, arguments: JSON.stringify(toolArguments) } }] }
}

async function waitUntil(isConditionMet: () => boolean) {
  for (let attempt = 0; attempt < 100 && !isConditionMet(); attempt += 1) await new Promise((resolveWait) => setTimeout(resolveWait, 10))
}

async function openTestVault(vaultAdapter: PapelizInMemoryVaultAdapter) {
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
    { papelizVaultId: `run-modes-${crypto.randomUUID()}`, papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
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
}

afterEach(async () => {
  vi.unstubAllGlobals()
  usePapelizAssistantConversationStore.getState().startNewAssistantChat()
  usePapelizAssistantConversationStore.setState({ queuedAssistantMessages: [] })
  usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask', assistantChangePermission: 'review-changes', providerModelNamesRefusingReasoningEffort: [] })
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('the AI Assistant’s modes, questions, steering and queue', () => {
  it('in Ask, only looks things up, and a question ends the run until it is answered', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch([
      scriptToolCall('call_question', 'askUserQuestion', { question: 'Which notes?', answerOptions: ['All of them', 'Only the garden ones'] }),
      { content: 'Only the garden ones, then.' },
    ])
    vi.stubGlobal('fetch', scriptedProviderFetch)
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    await openTestVault(new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden' }]))
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask', assistantReasoningEffort: 'high' })

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Tidy my notes')
    expect(providerRequestBodies).toHaveLength(1)
    const askToolNames = providerRequestBodies[0]?.tools?.map((chatTool) => chatTool.function.name) ?? []
    expect(askToolNames).toContain('askUserQuestion')
    expect(askToolNames.some((toolName) => toolName.startsWith('propose'))).toBe(false)
    expect(providerRequestBodies[0]?.reasoning_effort).toBe('high')
    const questionEntry = usePapelizAssistantConversationStore.getState().chatEntries.find((chatEntry) => chatEntry.chatEntryKind === 'question')
    // One question sent the older way, with no topic, is still understood.
    expect(questionEntry).toMatchObject({
      assistantQuestions: [{ questionText: 'Which notes?', questionTopic: 'Question 1', answerOptionTexts: ['All of them', 'Only the garden ones'] }],
      questionAnswerText: null,
    })

    usePapelizAssistantConversationStore.getState().answerAssistantQuestion(questionEntry!.chatEntryId, ['Only the garden ones'])
    await waitUntil(() => providerRequestBodies.length === 2 && !usePapelizAssistantConversationStore.getState().isAssistantRunning)
    expect(providerRequestBodies[1]?.messages.at(-1)).toEqual({ role: 'user', content: 'Only the garden ones' })
    expect(usePapelizAssistantConversationStore.getState().chatEntries.find((chatEntry) => chatEntry.chatEntryKind === 'question')).toMatchObject({
      questionAnswerText: 'Only the garden ones',
    })
    stopVaultKnowledgeSync()
  })

  it('asks several questions on one card, and sends every answer back as one message', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch([
      scriptToolCall('call_questions', 'askUserQuestion', {
        questions: [
          { question: 'Which notes?', topic: 'Notes', answerOptions: ['All of them', 'Only the garden ones'] },
          { question: 'How should I tag them?', topic: 'Tags', answerOptions: ['By topic', 'By season'] },
        ],
      }),
      { content: 'Tagging the garden notes by season.' },
    ])
    vi.stubGlobal('fetch', scriptedProviderFetch)
    await openTestVault(new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden' }]))

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Tag my notes')
    const questionEntry = usePapelizAssistantConversationStore.getState().chatEntries.find((chatEntry) => chatEntry.chatEntryKind === 'question')
    expect(questionEntry).toMatchObject({
      assistantQuestions: [
        { questionText: 'Which notes?', questionTopic: 'Notes' },
        { questionText: 'How should I tag them?', questionTopic: 'Tags' },
      ],
    })
    // Every question needs an answer before anything is sent.
    usePapelizAssistantConversationStore.getState().answerAssistantQuestion(questionEntry!.chatEntryId, ['Only the garden ones'])
    expect(providerRequestBodies).toHaveLength(1)

    usePapelizAssistantConversationStore.getState().answerAssistantQuestion(questionEntry!.chatEntryId, ['Only the garden ones', 'By season'])
    await waitUntil(() => providerRequestBodies.length === 2 && !usePapelizAssistantConversationStore.getState().isAssistantRunning)
    expect(providerRequestBodies[1]?.messages.at(-1)).toEqual({ role: 'user', content: 'Which notes? → Only the garden ones\nHow should I tag them? → By season' })
    expect(usePapelizAssistantConversationStore.getState().chatEntries.find((chatEntry) => chatEntry.chatEntryKind === 'question')).toMatchObject({
      questionAnswerTexts: ['Only the garden ones', 'By season'],
    })
  })

  it('in Write with Bypass permission, moves notes to the trash at once and never the saved chats', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch([
      scriptToolCall('call_trash', 'proposeVaultEntriesTrash', { vaultEntryRelativePaths: ['Old', '.csessions'], reason: 'Clean up.' }),
      { content: 'Moved Old to the trash.' },
    ])
    vi.stubGlobal('fetch', scriptedProviderFetch)
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Old/Draft.md', vaultNoteText: 'draft' },
      { vaultNoteRelativePath: 'Keep.md', vaultNoteText: 'keep' },
      { vaultNoteRelativePath: '.csessions/2026-10-28 0900 Hi.md', vaultNoteText: 'a chat' },
    ])
    await openTestVault(vaultAdapter)
    usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'write', assistantChangePermission: 'bypass-permission' })

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Delete Old and my chats')
    const vaultEntryPaths = (await vaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true })).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(vaultEntryPaths).toContain('.trash/Old/Draft.md')
    expect(vaultEntryPaths).toContain('.csessions/2026-10-28 0900 Hi.md')
    expect(vaultEntryPaths).toContain('Keep.md')
    const [trashProposal] = Object.values(usePapelizAssistantConversationStore.getState().assistantProposalsById)
    expect(trashProposal).toMatchObject({ assistantProposalKind: 'trash-entries', trashedVaultEntryRelativePaths: ['Old'], proposalStatus: 'accepted' })
    const trashToolResult = JSON.parse(providerRequestBodies[1]?.messages.find((providerMessage) => providerMessage.role === 'tool')?.content ?? '{}') as {
      applied?: boolean
      skipped?: Array<{ skippedBecause: string }>
    }
    expect(trashToolResult.applied).toBe(true)
    expect(trashToolResult.skipped?.[0]?.skippedBecause).toBe('Saved Chats')
    stopVaultKnowledgeSync()
  })

  it('sends an attached picture to the model as a picture, and keeps a copy beside the saved chats', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch([{ content: 'A kale leaf.' }])
    vi.stubGlobal('fetch', scriptedProviderFetch)
    const pictureVaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden' }])
    await openTestVault(pictureVaultAdapter)

    await usePapelizAssistantConversationStore.getState().addAssistantAttachmentFiles([new File([new Uint8Array([1, 2])], 'leaf.png', { type: 'image/png' })])
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('What is this?')
    const sentUserMessage = providerRequestBodies[0]?.messages.find((providerMessage) => providerMessage.role === 'user') as { content?: unknown } | undefined
    expect(sentUserMessage?.content).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AQI=' } },
    ])
    expect(usePapelizAssistantConversationStore.getState().pendingAssistantAttachments).toEqual([])
    await waitUntil(() => pictureVaultAdapter.readVaultAttachmentFile('.csessions/attachments/leaf.png') !== null)
    expect(pictureVaultAdapter.readVaultAttachmentFile('.csessions/attachments/leaf.png')?.size).toBe(2)
  })

  it('reads a steering message before its next step, and sends a queued one after the answer', async () => {
    const { scriptedProviderFetch, providerRequestBodies } = createScriptedProviderFetch(
      [scriptToolCall('call_search', 'searchVaultNotes', { query: 'garden' }), { content: 'Here is a short answer.' }, { content: 'And the next one.' }],
      (requestNumber) => {
        if (requestNumber !== 1) return
        usePapelizAssistantConversationStore.getState().steerAssistant('Keep it short')
        usePapelizAssistantConversationStore.getState().queueAssistantMessage('Now the soil notes')
      },
    )
    vi.stubGlobal('fetch', scriptedProviderFetch)
    const stopVaultKnowledgeSync = startPapelizVaultKnowledgeSync()
    await openTestVault(new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden' }]))

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Summarize my garden notes')
    expect(providerRequestBodies[1]?.messages.slice(-2)).toEqual([
      expect.objectContaining({ role: 'tool' }),
      { role: 'user', content: 'Keep it short' },
    ])
    await waitUntil(() => providerRequestBodies.length === 3 && !usePapelizAssistantConversationStore.getState().isAssistantRunning)
    expect(providerRequestBodies[2]?.messages.at(-1)).toEqual({ role: 'user', content: 'Now the soil notes' })
    expect(usePapelizAssistantConversationStore.getState().queuedAssistantMessages).toEqual([])
    const userMessageEntries = usePapelizAssistantConversationStore
      .getState()
      .chatEntries.filter((chatEntry) => chatEntry.chatEntryKind === 'user-message')
      .map((chatEntry) => (chatEntry.chatEntryKind === 'user-message' ? [chatEntry.chatEntryText, chatEntry.isSteeringMessage] : []))
    expect(userMessageEntries).toEqual([
      ['Summarize my garden notes', false],
      ['Keep it short', true],
      ['Now the soil notes', false],
    ])
    stopVaultKnowledgeSync()
  })
})
