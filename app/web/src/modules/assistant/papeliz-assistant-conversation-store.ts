import { create } from 'zustand'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { readLatestPapelizVaultNoteText, usePapelizVaultKnowledgeStore } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import {
  buildPapelizChatSessionNotePath,
  formatPapelizChatSessionFile,
  papelizChatSessionsFolderName,
  parsePapelizChatSessionFile,
  type PapelizChatSessionMessage,
} from './papeliz-assistant-chat-session-files'
import { getActivePapelizAssistantProviderConnection, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import {
  addPapelizChatCompletionToChatSessionTokenUsage,
  papelizEmptyChatSessionTokenUsage,
  type PapelizChatSessionTokenUsage,
} from './papeliz-assistant-token-usage'
import { executePapelizAssistantVaultTool, papelizAssistantVaultToolDefinitions, type PapelizAssistantProposalDraft, type PapelizAssistantToolActivityKind } from './papeliz-assistant-vault-tools'
import {
  estimatePapelizChatCompletionTokenUsage,
  streamPapelizChatCompletion,
  type PapelizChatCompletionTokenUsage,
  type PapelizChatMessage,
} from './papeliz-openai-compatible-client'
import { applyPapelizVaultNoteTextEdits } from './papeliz-vault-note-text-edits'

// One conversation with the assistant, in the docked panel (and focus mode's composer). The
// assistant looks things up with tools and proposes changes; every change waits in a proposal card
// until the user accepts it. Each conversation is saved as a note in the vault's hidden `.csessions`
// folder (papeliz-assistant-chat-session-files.ts), so it travels with the vault and can be reopened.
// The note also keeps the tokens the conversation used, request by request.

export type PapelizAssistantProposalStatus = 'pending' | 'accepted' | 'rejected' | 'failed'

export interface PapelizAssistantProposal extends PapelizAssistantProposalDraft {
  assistantProposalId: string
  proposalStatus: PapelizAssistantProposalStatus
  proposalProblem: string | null
}

export type PapelizAssistantChatEntry =
  | { chatEntryId: string; chatEntryKind: 'user-message'; chatEntryText: string; chatEntryContextLabel: string | null }
  | { chatEntryId: string; chatEntryKind: 'assistant-message'; chatEntryText: string; isChatEntryStreaming: boolean }
  | {
      chatEntryId: string
      chatEntryKind: 'tool-activity'
      toolActivityKind: PapelizAssistantToolActivityKind
      toolActivityLabel: string
      toolActivityVaultNoteRelativePaths: string[]
    }
  | { chatEntryId: string; chatEntryKind: 'proposal'; assistantProposalId: string }
  | { chatEntryId: string; chatEntryKind: 'notice'; chatEntryText: string; isChatEntryError: boolean }

// What the assistant is shown alongside the question.
export type PapelizAssistantContextMode = 'active-note' | 'whole-vault'

export interface PapelizAssistantSelectionContext {
  vaultNoteRelativePath: string
  selectedText: string
}

interface PapelizAssistantConversationState {
  chatVaultId: string | null
  papelizChatSessionId: string
  chatSessionVaultNoteRelativePath: string | null
  chatSessionCreatedAt: string
  // Every request this conversation made, and how full the context window is now.
  chatSessionTokenUsage: PapelizChatSessionTokenUsage
  chatEntries: PapelizAssistantChatEntry[]
  providerChatMessages: PapelizChatMessage[]
  assistantProposalsById: Record<string, PapelizAssistantProposal>
  isAssistantRunning: boolean
  assistantContextMode: PapelizAssistantContextMode
  pendingSelectionContext: PapelizAssistantSelectionContext | null
  composerDraftText: string

  sendAssistantMessage: (userMessageText: string) => Promise<void>
  stopAssistant: () => void
  startNewAssistantChat: () => void
  acceptAssistantProposal: (assistantProposalId: string) => Promise<void>
  rejectAssistantProposal: (assistantProposalId: string) => void
  acceptAllPendingAssistantProposals: () => Promise<void>
  openSavedChatSession: (chatSessionVaultNoteRelativePath: string) => Promise<void>
  setAssistantContextMode: (assistantContextMode: PapelizAssistantContextMode) => void
  setPendingSelectionContext: (pendingSelectionContext: PapelizAssistantSelectionContext | null) => void
  setComposerDraftText: (composerDraftText: string) => void
}

const papelizAssistantMaximumToolRounds = 10
const papelizAssistantContextNoteCharacterLimit = 16_000

let nextChatEntryNumber = 1
let activeAssistantAbortController: AbortController | null = null

function createChatEntryId(): string {
  return `papeliz-chat-entry-${nextChatEntryNumber++}`
}

export const papelizSuggestLinksRequestText =
  'Suggest links: look through my notes for places where one note talks about another note’s subject without linking to it. Propose edits that turn those words into [[wikilinks]] (one proposal per note, changing only the linked words). Then tell me in a short list what you proposed.'

export const papelizSuggestTagsRequestText =
  'Suggest tags: find notes with no tags or too few. Propose adding fitting tags to each one’s frontmatter `tags: [...]` list (add the frontmatter block at the top if a note has none), reusing tags the vault already uses where they fit. Then tell me in a short list what you proposed.'

// The conversation as the saved transcript: each question, then everything the assistant did and
// said in answer (what it looked at and proposed, as quoted lines, then its reply).
function buildChatSessionMessages(
  chatEntries: readonly PapelizAssistantChatEntry[],
  assistantProposalsById: Record<string, PapelizAssistantProposal>,
): PapelizChatSessionMessage[] {
  const chatSessionMessages: PapelizChatSessionMessage[] = []
  let assistantAnswerLines: string[] = []
  let assistantReplyTexts: string[] = []
  const finishAssistantAnswer = () => {
    const assistantAnswerText = [assistantAnswerLines.join('\n'), ...assistantReplyTexts].filter((answerPart) => answerPart.trim().length > 0).join('\n\n')
    if (assistantAnswerText.length > 0) chatSessionMessages.push({ chatSessionMessageRole: 'assistant', chatSessionMessageText: assistantAnswerText })
    assistantAnswerLines = []
    assistantReplyTexts = []
  }
  const linkVaultNote = (vaultNoteRelativePath: string) => `[[${vaultNoteRelativePath.replace(/\.md$/i, '')}|${getVaultNoteTitle(vaultNoteRelativePath)}]]`
  for (const chatEntry of chatEntries) {
    if (chatEntry.chatEntryKind === 'user-message') {
      finishAssistantAnswer()
      chatSessionMessages.push({ chatSessionMessageRole: 'user', chatSessionMessageText: chatEntry.chatEntryText })
    } else if (chatEntry.chatEntryKind === 'assistant-message') {
      assistantReplyTexts.push(chatEntry.chatEntryText)
    } else if (chatEntry.chatEntryKind === 'tool-activity' && chatEntry.toolActivityKind !== 'proposed') {
      const linkedNotes = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 6).map(linkVaultNote).join(', ')
      assistantAnswerLines.push(`> - ${chatEntry.toolActivityLabel}${linkedNotes.length > 0 ? ` ${linkedNotes}` : ''}`)
    } else if (chatEntry.chatEntryKind === 'proposal') {
      const assistantProposal = assistantProposalsById[chatEntry.assistantProposalId]
      if (assistantProposal !== undefined) {
        assistantAnswerLines.push(
          `> - ${assistantProposal.assistantProposalKind === 'create-note' ? 'Proposed a new note' : 'Proposed an edit to'} ${linkVaultNote(assistantProposal.vaultNoteRelativePath)} · ${assistantProposal.proposalStatus}`,
        )
      }
    } else if (chatEntry.chatEntryKind === 'notice' && chatEntry.isChatEntryError) {
      assistantAnswerLines.push(`> - ${chatEntry.chatEntryText}`)
    }
  }
  finishAssistantAnswer()
  return chatSessionMessages
}

function buildAssistantSystemMessage(contextNoteText: string | null, selectionContext: PapelizAssistantSelectionContext | null): string {
  const workspaceState = usePapelizWorkspaceStore.getState()
  const noteCount = Object.keys(usePapelizVaultKnowledgeStore.getState().vaultNoteIndexEntriesByRelativePath).length
  const systemMessageLines = [
    'You are the assistant inside Papeliz, a Markdown notes app. You help the user with their vault: a folder of Markdown notes linked with [[wikilinks]].',
    '- Look things up with the tools: searchVaultNotes, readVaultNote, listVaultNoteLinks, listVaultNotes. Read a note before proposing changes to it.',
    '- You never change notes yourself. To change or add notes, call proposeVaultNoteEdit or proposeVaultNoteCreate; the user reviews each proposal as a diff and decides. Say what you proposed; never say it is done.',
    '- When you mention a note, cite it as a wikilink with its title, like [[Garden plan]].',
    '- Keep the user’s Markdown style. Answer in Markdown, briefly, in the language the user writes in.',
    `- Notes in the “${papelizChatSessionsFolderName}” folder are saved conversations with you. Read them when asked, but never propose changes to them.`,
    `The vault is “${workspaceState.openVault?.papelizVaultDisplayName ?? 'unnamed'}” with ${noteCount} notes. Today is ${new Date().toDateString()}.`,
  ]
  if (workspaceState.activeVaultNoteRelativePath !== null) {
    systemMessageLines.push(`The note open on screen is [[${getVaultNoteTitle(workspaceState.activeVaultNoteRelativePath)}]] (${workspaceState.activeVaultNoteRelativePath}).`)
  }
  if (contextNoteText !== null && workspaceState.activeVaultNoteRelativePath !== null) {
    systemMessageLines.push(`Its text:\n<note path="${workspaceState.activeVaultNoteRelativePath}">\n${contextNoteText.slice(0, papelizAssistantContextNoteCharacterLimit)}\n</note>`)
  }
  if (selectionContext !== null) {
    systemMessageLines.push(`The user selected this passage in ${selectionContext.vaultNoteRelativePath}:\n<selection>\n${selectionContext.selectedText}\n</selection>`)
  }
  return systemMessageLines.join('\n')
}

export const usePapelizAssistantConversationStore = create<PapelizAssistantConversationState>()((setConversationState, getConversationState) => {
  const appendChatEntry = (chatEntry: PapelizAssistantChatEntry) =>
    setConversationState((conversationState) => ({ chatEntries: [...conversationState.chatEntries, chatEntry] }))

  const updateAssistantMessageEntry = (chatEntryId: string, updateEntry: (chatEntryText: string) => { chatEntryText: string; isChatEntryStreaming: boolean }) =>
    setConversationState((conversationState) => ({
      chatEntries: conversationState.chatEntries.map((chatEntry) =>
        chatEntry.chatEntryId === chatEntryId && chatEntry.chatEntryKind === 'assistant-message' ? { ...chatEntry, ...updateEntry(chatEntry.chatEntryText) } : chatEntry,
      ),
    }))

  const updateProposal = (assistantProposalId: string, proposalChanges: Partial<PapelizAssistantProposal>) =>
    setConversationState((conversationState) => {
      const assistantProposal = conversationState.assistantProposalsById[assistantProposalId]
      if (assistantProposal === undefined) return conversationState
      return { assistantProposalsById: { ...conversationState.assistantProposalsById, [assistantProposalId]: { ...assistantProposal, ...proposalChanges } } }
    })

  const createFreshChatSessionFields = () => ({
    papelizChatSessionId: crypto.randomUUID(),
    chatSessionVaultNoteRelativePath: null,
    chatSessionCreatedAt: new Date().toISOString(),
    chatSessionTokenUsage: papelizEmptyChatSessionTokenUsage,
  })

  // Adds one request's tokens to the conversation that made it (not to a new chat started since).
  const addChatCompletionTokenUsage = (papelizChatSessionId: string, providerModelName: string, completionTokenUsage: PapelizChatCompletionTokenUsage) =>
    setConversationState((conversationState) =>
      conversationState.papelizChatSessionId !== papelizChatSessionId
        ? conversationState
        : { chatSessionTokenUsage: addPapelizChatCompletionToChatSessionTokenUsage(conversationState.chatSessionTokenUsage, providerModelName, completionTokenUsage) },
    )

  let isNewAssistantChatWaitingForRun = false
  const startFreshAssistantChat = () =>
    setConversationState({ chatEntries: [], providerChatMessages: [], assistantProposalsById: {}, pendingSelectionContext: null, ...createFreshChatSessionFields() })

  // A new vault starts a new conversation.
  const ensureConversationBelongsToOpenVault = () => {
    const openVaultId = usePapelizWorkspaceStore.getState().openVault?.papelizVaultId ?? null
    if (getConversationState().chatVaultId !== openVaultId) {
      setConversationState({
        chatVaultId: openVaultId,
        chatEntries: [],
        providerChatMessages: [],
        assistantProposalsById: {},
        pendingSelectionContext: null,
        ...createFreshChatSessionFields(),
      })
    }
  }

  // Saves the conversation to its note in `.csessions`, one save at a time. Each save keeps the
  // chat as it was when asked, so a save still waiting after New chat writes the chat it was for.
  let chatSessionSaveQueue: Promise<void> = Promise.resolve()
  // The note each chat was first saved to, so its later saves go to the same note.
  const chatSessionVaultNoteRelativePathsByChatSessionId = new Map<string, string>()
  const saveChatSessionToVault = () => {
    const conversationState = getConversationState()
    chatSessionSaveQueue = chatSessionSaveQueue.then(async () => {
      const workspaceState = usePapelizWorkspaceStore.getState()
      if (workspaceState.openVault === null || workspaceState.openVault.papelizVaultId !== conversationState.chatVaultId) return
      const chatSessionMessages = buildChatSessionMessages(conversationState.chatEntries, conversationState.assistantProposalsById)
      const firstUserMessage = chatSessionMessages.find((chatSessionMessage) => chatSessionMessage.chatSessionMessageRole === 'user')
      if (firstUserMessage === undefined) return
      const activeProviderSettingsState = usePapelizAssistantProviderSettingsStore.getState()
      const chatSessionFileText = formatPapelizChatSessionFile({
        papelizChatSessionId: conversationState.papelizChatSessionId,
        chatSessionTitle: firstUserMessage.chatSessionMessageText.split('\n')[0]?.slice(0, 80) ?? 'Chat',
        chatSessionCreatedAt: conversationState.chatSessionCreatedAt,
        chatSessionUpdatedAt: new Date().toISOString(),
        chatSessionModelName:
          activeProviderSettingsState.providerSettingsByProviderId[activeProviderSettingsState.activeAssistantProviderId]?.providerModelName ?? '',
        chatSessionMessages,
        chatSessionTokenUsage: conversationState.chatSessionTokenUsage,
      })
      const existingVaultEntryPaths = new Set(workspaceState.vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath.toLowerCase()))
      try {
        const chatSessionVaultNoteRelativePath =
          chatSessionVaultNoteRelativePathsByChatSessionId.get(conversationState.papelizChatSessionId) ?? conversationState.chatSessionVaultNoteRelativePath
        if (chatSessionVaultNoteRelativePath !== null && existingVaultEntryPaths.has(chatSessionVaultNoteRelativePath.toLowerCase())) {
          await workspaceState.writeVaultNoteTextFromAssistant(chatSessionVaultNoteRelativePath, chatSessionFileText, 'saved-chat-session')
          return
        }
        const newChatSessionVaultNoteRelativePath = buildPapelizChatSessionNotePath(
          new Date(conversationState.chatSessionCreatedAt),
          firstUserMessage.chatSessionMessageText.split('\n')[0] ?? '',
          (candidateVaultEntryName) => existingVaultEntryPaths.has(`${papelizChatSessionsFolderName}/${candidateVaultEntryName}`.toLowerCase()),
        )
        await workspaceState.createVaultNoteFromAssistant(newChatSessionVaultNoteRelativePath, chatSessionFileText, 'saved-chat-session')
        chatSessionVaultNoteRelativePathsByChatSessionId.set(conversationState.papelizChatSessionId, newChatSessionVaultNoteRelativePath)
        setConversationState((latestState) =>
          latestState.papelizChatSessionId === conversationState.papelizChatSessionId
            ? { chatSessionVaultNoteRelativePath: newChatSessionVaultNoteRelativePath }
            : latestState,
        )
      } catch (chatSessionSaveError) {
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `The chat could not be saved to the vault. ${describePapelizVaultError(chatSessionSaveError)}`)
      }
    })
  }

  return {
    chatVaultId: null,
    ...createFreshChatSessionFields(),
    chatEntries: [],
    providerChatMessages: [],
    assistantProposalsById: {},
    isAssistantRunning: false,
    assistantContextMode: 'active-note',
    pendingSelectionContext: null,
    composerDraftText: '',

    sendAssistantMessage: async (userMessageText) => {
      const trimmedUserMessageText = userMessageText.trim()
      if (trimmedUserMessageText.length === 0 || getConversationState().isAssistantRunning) return
      ensureConversationBelongsToOpenVault()
      const workspaceState = usePapelizWorkspaceStore.getState()
      const openVault = workspaceState.openVault
      const conversationState = getConversationState()
      const selectionContext = conversationState.pendingSelectionContext
      const contextLabel =
        selectionContext !== null
          ? `Selection in ${getVaultNoteTitle(selectionContext.vaultNoteRelativePath)}`
          : conversationState.assistantContextMode === 'active-note' && workspaceState.activeVaultNoteRelativePath !== null
            ? getVaultNoteTitle(workspaceState.activeVaultNoteRelativePath)
            : null
      appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'user-message', chatEntryText: trimmedUserMessageText, chatEntryContextLabel: contextLabel })
      setConversationState({ pendingSelectionContext: null, composerDraftText: '' })

      const activeProviderConnection = getActivePapelizAssistantProviderConnection()
      if (activeProviderConnection.providerConnectionOutcome !== 'ready' || openVault === null) {
        appendChatEntry({
          chatEntryId: createChatEntryId(),
          chatEntryKind: 'notice',
          chatEntryText: openVault === null ? 'Open a vault first.' : activeProviderConnection.providerConnectionOutcome === 'ready' ? '' : activeProviderConnection.providerSetupProblem,
          isChatEntryError: true,
        })
        return
      }

      const contextNoteText =
        conversationState.assistantContextMode === 'active-note' && workspaceState.activeVaultNoteRelativePath !== null
          ? await readLatestPapelizVaultNoteText(openVault, workspaceState.activeVaultNoteRelativePath).catch(() => null)
          : null
      const providerChatMessages: PapelizChatMessage[] = [...getConversationState().providerChatMessages, { role: 'user', content: trimmedUserMessageText }]
      const systemMessage: PapelizChatMessage = { role: 'system', content: buildAssistantSystemMessage(contextNoteText, selectionContext) }

      const assistantAbortController = new AbortController()
      activeAssistantAbortController = assistantAbortController
      setConversationState({ isAssistantRunning: true, providerChatMessages })
      const runChatSessionId = conversationState.papelizChatSessionId
      const runProviderModelName = activeProviderConnection.providerConnection.providerModelName
      // The request being answered now, so one that is stopped still counts what it used.
      let inFlightChatMessages: PapelizChatMessage[] | null = null
      let inFlightStreamedAssistantText = ''
      try {
        for (let toolRound = 0; toolRound < papelizAssistantMaximumToolRounds; toolRound += 1) {
          const assistantEntryId = createChatEntryId()
          appendChatEntry({ chatEntryId: assistantEntryId, chatEntryKind: 'assistant-message', chatEntryText: '', isChatEntryStreaming: true })
          const sentChatMessages: PapelizChatMessage[] = [systemMessage, ...providerChatMessages]
          inFlightChatMessages = sentChatMessages
          inFlightStreamedAssistantText = ''
          const chatCompletionResult = await streamPapelizChatCompletion({
            providerConnection: activeProviderConnection.providerConnection,
            chatMessages: sentChatMessages,
            chatTools: papelizAssistantVaultToolDefinitions,
            abortSignal: assistantAbortController.signal,
            onAssistantTextDelta: (assistantTextDelta) => {
              inFlightStreamedAssistantText += assistantTextDelta
              updateAssistantMessageEntry(assistantEntryId, (chatEntryText) => ({ chatEntryText: chatEntryText + assistantTextDelta, isChatEntryStreaming: true }))
            },
          })
          inFlightChatMessages = null
          addChatCompletionTokenUsage(runChatSessionId, runProviderModelName, chatCompletionResult.completionTokenUsage)
          updateAssistantMessageEntry(assistantEntryId, (chatEntryText) => ({ chatEntryText, isChatEntryStreaming: false }))
          if (chatCompletionResult.assistantText.trim().length === 0) {
            setConversationState((latestState) => ({ chatEntries: latestState.chatEntries.filter((chatEntry) => chatEntry.chatEntryId !== assistantEntryId) }))
          }
          providerChatMessages.push({
            role: 'assistant',
            content: chatCompletionResult.assistantText.length > 0 ? chatCompletionResult.assistantText : null,
            ...(chatCompletionResult.assistantToolCalls.length > 0 ? { tool_calls: chatCompletionResult.assistantToolCalls } : {}),
          })
          if (chatCompletionResult.assistantToolCalls.length === 0) break

          for (const assistantToolCall of chatCompletionResult.assistantToolCalls) {
            const toolOutcome = await executePapelizAssistantVaultTool(assistantToolCall)
            appendChatEntry({
              chatEntryId: createChatEntryId(),
              chatEntryKind: 'tool-activity',
              toolActivityKind: toolOutcome.toolActivityKind,
              toolActivityLabel: toolOutcome.toolActivityLabel,
              toolActivityVaultNoteRelativePaths: toolOutcome.toolActivityVaultNoteRelativePaths,
            })
            if (toolOutcome.proposalDraft !== null) {
              const assistantProposalId = `papeliz-proposal-${createChatEntryId()}`
              setConversationState((latestState) => ({
                assistantProposalsById: {
                  ...latestState.assistantProposalsById,
                  [assistantProposalId]: { ...toolOutcome.proposalDraft!, assistantProposalId, proposalStatus: 'pending', proposalProblem: null },
                },
              }))
              appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'proposal', assistantProposalId })
            }
            providerChatMessages.push({ role: 'tool', tool_call_id: assistantToolCall.id, content: toolOutcome.toolResultText })
          }
          setConversationState({ providerChatMessages: [...providerChatMessages] })
          if (toolRound === papelizAssistantMaximumToolRounds - 1) {
            appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'notice', chatEntryText: 'The assistant stopped after many steps. Ask it to continue if needed.', isChatEntryError: false })
          }
        }
      } catch (assistantRunError) {
        const wasStopped = assistantRunError instanceof DOMException && assistantRunError.name === 'AbortError'
        // Stopped after the answer had begun: the provider sends no counts then, so they are estimated.
        if (wasStopped && inFlightChatMessages !== null && inFlightStreamedAssistantText.length > 0) {
          addChatCompletionTokenUsage(
            runChatSessionId,
            runProviderModelName,
            estimatePapelizChatCompletionTokenUsage({
              sentChatMessages: inFlightChatMessages,
              sentChatTools: papelizAssistantVaultToolDefinitions,
              receivedAssistantText: inFlightStreamedAssistantText,
            }),
          )
        }
        appendChatEntry({
          chatEntryId: createChatEntryId(),
          chatEntryKind: 'notice',
          chatEntryText: wasStopped ? 'Stopped.' : assistantRunError instanceof Error ? assistantRunError.message : 'The assistant could not answer.',
          isChatEntryError: !wasStopped,
        })
      } finally {
        if (activeAssistantAbortController === assistantAbortController) activeAssistantAbortController = null
        setConversationState((latestState) => ({
          isAssistantRunning: false,
          providerChatMessages,
          chatEntries: latestState.chatEntries.map((chatEntry) =>
            chatEntry.chatEntryKind === 'assistant-message' && chatEntry.isChatEntryStreaming ? { ...chatEntry, isChatEntryStreaming: false } : chatEntry,
          ),
        }))
        saveChatSessionToVault()
        if (isNewAssistantChatWaitingForRun) {
          isNewAssistantChatWaitingForRun = false
          startFreshAssistantChat()
        }
      }
    },

    stopAssistant: () => activeAssistantAbortController?.abort(),

    // During an answer, New chat stops it first: the answer ends ("Stopped.") and saves with its own
    // chat and the tokens it used, and the new chat starts right after.
    startNewAssistantChat: () => {
      if (activeAssistantAbortController !== null && getConversationState().isAssistantRunning) {
        isNewAssistantChatWaitingForRun = true
        activeAssistantAbortController.abort()
        return
      }
      startFreshAssistantChat()
    },

    openSavedChatSession: async (chatSessionVaultNoteRelativePath) => {
      const openVault = usePapelizWorkspaceStore.getState().openVault
      if (openVault === null || getConversationState().isAssistantRunning) return
      const savedChatSession = parsePapelizChatSessionFile(await readLatestPapelizVaultNoteText(openVault, chatSessionVaultNoteRelativePath).catch(() => ''))
      if (savedChatSession === null) {
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', 'That note is not a saved chat.')
        return
      }
      // Earlier answers come back as text; their proposals were settled when the chat was saved.
      setConversationState({
        chatVaultId: openVault.papelizVaultId,
        papelizChatSessionId: savedChatSession.papelizChatSessionId,
        chatSessionVaultNoteRelativePath,
        chatSessionCreatedAt: savedChatSession.chatSessionCreatedAt || new Date().toISOString(),
        // Carries on from what the chat had used (none, for a note saved before usage was kept).
        chatSessionTokenUsage: savedChatSession.chatSessionTokenUsage,
        assistantProposalsById: {},
        pendingSelectionContext: null,
        chatEntries: savedChatSession.chatSessionMessages.map((chatSessionMessage): PapelizAssistantChatEntry =>
          chatSessionMessage.chatSessionMessageRole === 'user'
            ? { chatEntryId: createChatEntryId(), chatEntryKind: 'user-message', chatEntryText: chatSessionMessage.chatSessionMessageText, chatEntryContextLabel: null }
            : { chatEntryId: createChatEntryId(), chatEntryKind: 'assistant-message', chatEntryText: chatSessionMessage.chatSessionMessageText, isChatEntryStreaming: false },
        ),
        providerChatMessages: savedChatSession.chatSessionMessages.map((chatSessionMessage) => ({
          role: chatSessionMessage.chatSessionMessageRole,
          content: chatSessionMessage.chatSessionMessageText,
        })),
      })
    },

    acceptAssistantProposal: async (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      const workspaceState = usePapelizWorkspaceStore.getState()
      if (assistantProposal === undefined || assistantProposal.proposalStatus !== 'pending' || workspaceState.openVault === null) return
      try {
        if (assistantProposal.assistantProposalKind === 'create-note') {
          await workspaceState.createVaultNoteFromAssistant(assistantProposal.vaultNoteRelativePath, assistantProposal.newVaultNoteText)
        } else {
          // Applied to the note as it is now, so edits typed since the proposal are kept.
          const latestVaultNoteText = await readLatestPapelizVaultNoteText(workspaceState.openVault, assistantProposal.vaultNoteRelativePath)
          const vaultNoteTextEditsResult = applyPapelizVaultNoteTextEdits(latestVaultNoteText, assistantProposal.vaultNoteTextEdits)
          if (vaultNoteTextEditsResult.vaultNoteTextEditsOutcome === 'refused') {
            updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: vaultNoteTextEditsResult.vaultNoteTextEditsProblem })
            return
          }
          await workspaceState.writeVaultNoteTextFromAssistant(assistantProposal.vaultNoteRelativePath, vaultNoteTextEditsResult.editedVaultNoteText)
        }
        updateProposal(assistantProposalId, { proposalStatus: 'accepted', proposalProblem: null })
        setConversationState((conversationState) => ({
          providerChatMessages: [...conversationState.providerChatMessages, { role: 'user', content: `(I accepted the proposal for ${assistantProposal.vaultNoteRelativePath}.)` }],
        }))
        saveChatSessionToVault()
      } catch (proposalAcceptError) {
        updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: describePapelizVaultError(proposalAcceptError) })
      }
    },

    rejectAssistantProposal: (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      if (assistantProposal?.proposalStatus !== 'pending') return
      updateProposal(assistantProposalId, { proposalStatus: 'rejected' })
      setConversationState((conversationState) => ({
        providerChatMessages: [...conversationState.providerChatMessages, { role: 'user', content: `(I rejected the proposal for ${assistantProposal.vaultNoteRelativePath}.)` }],
      }))
      saveChatSessionToVault()
    },

    acceptAllPendingAssistantProposals: async () => {
      for (const assistantProposal of Object.values(getConversationState().assistantProposalsById)) {
        if (assistantProposal.proposalStatus === 'pending') await getConversationState().acceptAssistantProposal(assistantProposal.assistantProposalId)
      }
    },

    setAssistantContextMode: (assistantContextMode) => setConversationState({ assistantContextMode }),
    setPendingSelectionContext: (pendingSelectionContext) => setConversationState({ pendingSelectionContext }),
    setComposerDraftText: (composerDraftText) => setConversationState({ composerDraftText }),
  }
})
