import { create } from 'zustand'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import {
  describeVaultEntryNameProblem,
  getVaultEntryName,
  getVaultNoteTitle,
  isVaultNoteFileName,
  papelizVaultNoteFileExtension,
  pickFreeVaultEntryName,
} from '../vault/papeliz-vault-relative-paths'
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
import {
  buildPapelizAssistantUserMessageContent,
  describePapelizAssistantAttachmentsForTranscript,
  papelizAssistantAttachmentLimit,
  readPapelizAssistantAttachmentFile,
  type PapelizAssistantAttachment,
} from './papeliz-assistant-attachments'
import {
  buildPapelizAssistantQuestionAnswerMessage,
  papelizAssistantQuestionToolDefinition,
  papelizAssistantQuestionToolName,
  readPapelizAssistantQuestionToolCall,
  type PapelizAssistantQuestion,
} from './papeliz-assistant-question-tool'
import { usePapelizAssistantRunOptionsStore, type PapelizAssistantMode } from './papeliz-assistant-run-options-store'
import { findPapelizAssistantVaultEntryTrashProblem } from './papeliz-assistant-vault-entry-trash'
import { executePapelizAssistantVaultTool, papelizAssistantVaultToolDefinitions, type PapelizAssistantProposalDraft, type PapelizAssistantToolActivityKind } from './papeliz-assistant-vault-tools'
import {
  estimatePapelizChatCompletionTokenUsage,
  streamPapelizChatCompletion,
  type PapelizChatCompletionTokenUsage,
  type PapelizChatMessage,
  type PapelizChatToolDefinition,
} from './papeliz-openai-compatible-client'
import { applyPapelizVaultNoteTextEdits } from './papeliz-vault-note-text-edits'

// One conversation with the assistant, in the docked panel (and focus mode's composer). The
// assistant looks things up with tools; in Write mode it also proposes changes, and every change
// waits in a proposal card until the user accepts it, unless Bypass permission is on. Ask only
// answers, and Plan writes a plan that Write It carries out. Each conversation is saved as a note in
// the vault's hidden `.csessions` folder (papeliz-assistant-chat-session-files.ts), so it travels
// with the vault and can be reopened. The note also keeps the tokens the conversation used.
//
// The assistant can ask the user a question (papeliz-assistant-question-tool.ts): asking ends the
// run, and the answer is the user's next message. While it answers, a message typed in steers it
// (it reads the message before its next step) or waits in the queue until the answer ends.

export type PapelizAssistantProposalStatus = 'pending' | 'accepted' | 'rejected' | 'failed'

export interface PapelizAssistantProposal extends PapelizAssistantProposalDraft {
  assistantProposalId: string
  proposalStatus: PapelizAssistantProposalStatus
  proposalProblem: string | null
}

export type PapelizAssistantChatEntry =
  | {
      chatEntryId: string
      chatEntryKind: 'user-message'
      chatEntryText: string
      chatEntryContextLabel: string | null
      // Typed while the assistant was answering, and read by it before its next step.
      isSteeringMessage?: boolean
      // Files and pictures sent with it.
      userMessageAttachments?: PapelizAssistantAttachment[]
    }
  | {
      chatEntryId: string
      chatEntryKind: 'assistant-message'
      chatEntryText: string
      isChatEntryStreaming: boolean
      // The mode it answered in: a Plan answer shows as a plan card.
      assistantMessageMode?: PapelizAssistantMode
      // Where Save as Note put a plan.
      savedPlanVaultNoteRelativePath?: string | null
    }
  | {
      chatEntryId: string
      chatEntryKind: 'question'
      assistantQuestions: PapelizAssistantQuestion[]
      // The answer to each question, in order, when they were given on the card.
      questionAnswerTexts: string[] | null
      // The message sent as the answer (on the card, or typed in the chat box), once there is one.
      questionAnswerText: string | null
    }
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

// A message waiting to be sent when the assistant's answer ends.
export interface PapelizAssistantQueuedMessage {
  queuedMessageId: string
  queuedMessageText: string
}

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
  queuedAssistantMessages: PapelizAssistantQueuedMessage[]
  // Files and pictures waiting to go with the next message.
  pendingAssistantAttachments: PapelizAssistantAttachment[]

  sendAssistantMessage: (userMessageText: string) => Promise<void>
  // While the assistant answers: hands it a message to read before its next step.
  steerAssistant: (userMessageText: string) => void
  // While the assistant answers: keeps a message to send when the answer ends.
  queueAssistantMessage: (userMessageText: string) => void
  removeQueuedAssistantMessage: (queuedMessageId: string) => void
  // Steers with a queued message during an answer, or sends it when there is none.
  sendQueuedAssistantMessageNow: (queuedMessageId: string) => void
  // Sends the answers picked or typed on a question card, one per question.
  answerAssistantQuestion: (chatEntryId: string, questionAnswerTexts: readonly string[]) => void
  // Adds files and pictures to the next message; one that can't be added says why in a toast.
  addAssistantAttachmentFiles: (attachmentFiles: readonly File[]) => Promise<void>
  removePendingAssistantAttachment: (assistantAttachmentId: string) => void
  // Switches to Write and asks the assistant to carry out a plan it wrote.
  carryOutAssistantPlan: (chatEntryId: string) => void
  saveAssistantPlanAsNote: (chatEntryId: string) => Promise<void>
  stopAssistant: () => void
  startNewAssistantChat: () => void
  acceptAssistantProposal: (assistantProposalId: string) => Promise<void>
  // Shows an edit or a new note whole, read-only, in a tab of its own (nothing is written for it).
  previewAssistantProposal: (assistantProposalId: string) => void
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
// Steering messages typed during the answer running now, not yet read by the assistant.
let pendingSteeringMessageTexts: string[] = []

const papelizAssistantLookUpToolNames: readonly string[] = ['searchVaultNotes', 'readVaultNote', 'listVaultNoteLinks', 'listVaultNotes']

// What the assistant may call in each mode: Ask and Plan only look things up; Write may also propose
// changes. Every mode can ask the user a question.
function listAssistantChatTools(assistantMode: PapelizAssistantMode): PapelizChatToolDefinition[] {
  const vaultToolDefinitions =
    assistantMode === 'write'
      ? papelizAssistantVaultToolDefinitions
      : papelizAssistantVaultToolDefinitions.filter((vaultToolDefinition) => papelizAssistantLookUpToolNames.includes(vaultToolDefinition.function.name))
  return [...vaultToolDefinitions, papelizAssistantQuestionToolDefinition]
}

// A proposal as the assistant is told about it when the user decides ("the proposal for Ideas.md").
function describeAssistantProposalForProvider(assistantProposal: PapelizAssistantProposalDraft): string {
  return assistantProposal.assistantProposalKind === 'trash-entries'
    ? `moving ${assistantProposal.trashedVaultEntryRelativePaths.join(', ')} to the trash`
    : `the proposal for ${assistantProposal.vaultNoteRelativePath}`
}

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
      const attachmentsTranscriptText = describePapelizAssistantAttachmentsForTranscript(chatEntry.userMessageAttachments ?? [])
      chatSessionMessages.push({
        chatSessionMessageRole: 'user',
        chatSessionMessageText: [chatEntry.chatEntryText, attachmentsTranscriptText].filter((messagePart) => messagePart.length > 0).join('\n\n'),
      })
    } else if (chatEntry.chatEntryKind === 'assistant-message') {
      assistantReplyTexts.push(chatEntry.chatEntryText)
    } else if (chatEntry.chatEntryKind === 'question') {
      assistantReplyTexts.push(
        chatEntry.assistantQuestions
          .map((assistantQuestion) => [assistantQuestion.questionText, ...assistantQuestion.answerOptionTexts.map((answerOptionText) => `- ${answerOptionText}`)].join('\n'))
          .join('\n\n'),
      )
    } else if (chatEntry.chatEntryKind === 'tool-activity' && chatEntry.toolActivityKind !== 'proposed') {
      const linkedNotes = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 6).map(linkVaultNote).join(', ')
      assistantAnswerLines.push(`> - ${chatEntry.toolActivityLabel}${linkedNotes.length > 0 ? ` ${linkedNotes}` : ''}`)
    } else if (chatEntry.chatEntryKind === 'proposal') {
      const assistantProposal = assistantProposalsById[chatEntry.assistantProposalId]
      if (assistantProposal !== undefined) {
        const proposedVaultEntryLinks =
          assistantProposal.assistantProposalKind === 'trash-entries'
            ? assistantProposal.trashedVaultEntryRelativePaths
                .map((trashedVaultEntryRelativePath) => (isVaultNoteFileName(trashedVaultEntryRelativePath) ? linkVaultNote(trashedVaultEntryRelativePath) : `${trashedVaultEntryRelativePath}/`))
                .join(', ')
            : linkVaultNote(assistantProposal.vaultNoteRelativePath)
        const proposalActivityLabel =
          assistantProposal.assistantProposalKind === 'create-note'
            ? 'Proposed a new note'
            : assistantProposal.assistantProposalKind === 'trash-entries'
              ? 'Proposed deleting'
              : 'Proposed an edit to'
        assistantAnswerLines.push(`> - ${proposalActivityLabel} ${proposedVaultEntryLinks} · ${assistantProposal.proposalStatus}`)
      }
    } else if (chatEntry.chatEntryKind === 'notice' && chatEntry.isChatEntryError) {
      assistantAnswerLines.push(`> - ${chatEntry.chatEntryText}`)
    }
  }
  finishAssistantAnswer()
  return chatSessionMessages
}

// What each mode lets the assistant do, as told in its instructions.
function describeAssistantModeRules(assistantMode: PapelizAssistantMode): string[] {
  if (assistantMode === 'ask') {
    return [
      '- You are in Ask mode: answer questions about the vault. You cannot change, create or delete notes here. If the user wants a change, tell them to switch to Write.',
    ]
  }
  if (assistantMode === 'plan') {
    return [
      '- You are in Plan mode: look things up, then reply with a plan in Markdown: a first line `# ` title, then numbered steps, each naming the notes it touches. Change nothing; the user can press Write It to have you carry out the plan in Write mode.',
    ]
  }
  const isBypassPermissionOn = usePapelizAssistantRunOptionsStore.getState().assistantChangePermission === 'bypass-permission'
  return [
    '- You are in Write mode. Read a note before proposing changes to it.',
    '- To change notes, call proposeVaultNoteEdit, proposeVaultNoteCreate or proposeVaultEntriesTrash (deleting moves notes and folders into the vault’s .trash folder, where they can be restored; saved chats are never deleted).',
    isBypassPermissionOn
      ? '- The user turned on Bypass permission: each proposal applies at once, with no review. Be careful and exact, and say what you changed.'
      : '- You never change notes yourself: the user reviews each proposal and decides. Say what you proposed; never say it is done.',
  ]
}

function buildAssistantSystemMessage(
  assistantMode: PapelizAssistantMode,
  contextNoteText: string | null,
  selectionContext: PapelizAssistantSelectionContext | null,
): string {
  const workspaceState = usePapelizWorkspaceStore.getState()
  const noteCount = Object.keys(usePapelizVaultKnowledgeStore.getState().vaultNoteIndexEntriesByRelativePath).length
  const systemMessageLines = [
    'You are the assistant inside Papeliz, a Markdown notes app. You help the user with their vault: a folder of Markdown notes linked with [[wikilinks]].',
    '- Look things up with the tools: searchVaultNotes, readVaultNote, listVaultNoteLinks, listVaultNotes.',
    ...describeAssistantModeRules(assistantMode),
    `- When the request is unclear or has real choices to make, ask with ${papelizAssistantQuestionToolName} (1 to 4 short questions, each with a one- or two-word topic and 2 to 4 short answers) and stop there. Don’t ask when the answer is clear.`,
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

  // A proposal's preview closes once the proposal is decided, or its chat is gone.
  const closeAssistantProposalPreviewFor = (assistantProposalId: string | null) => {
    const workspaceState = usePapelizWorkspaceStore.getState()
    const assistantProposalPreview = workspaceState.assistantProposalPreview
    if (assistantProposalPreview === null) return
    if (assistantProposalId === null || assistantProposalPreview.previewedAssistantProposalId === assistantProposalId) workspaceState.closeAssistantProposalPreview()
  }

  const createFreshChatSessionFields = () => ({
    papelizChatSessionId: crypto.randomUUID(),
    chatSessionVaultNoteRelativePath: null,
    chatSessionCreatedAt: new Date().toISOString(),
    chatSessionTokenUsage: papelizEmptyChatSessionTokenUsage,
  })

  // Adds one request's tokens to the conversation that made it (not to a new chat started since).
  const addChatCompletionTokenUsage = (
    papelizChatSessionId: string,
    providerModelName: string,
    completionTokenUsage: PapelizChatCompletionTokenUsage,
    completionProviderReportedCostUsd: number | null = null,
  ) =>
    setConversationState((conversationState) =>
      conversationState.papelizChatSessionId !== papelizChatSessionId
        ? conversationState
        : {
            chatSessionTokenUsage: addPapelizChatCompletionToChatSessionTokenUsage(
              conversationState.chatSessionTokenUsage,
              providerModelName,
              completionTokenUsage,
              completionProviderReportedCostUsd,
            ),
          },
    )

  // The question the assistant asked last, while it still waits for an answer.
  const findOpenQuestionEntry = () =>
    [...getConversationState().chatEntries]
      .reverse()
      .find((chatEntry): chatEntry is Extract<PapelizAssistantChatEntry, { chatEntryKind: 'question' }> => chatEntry.chatEntryKind === 'question' && chatEntry.questionAnswerText === null)

  // A message the user sends while a question waits is its answer.
  const markOpenQuestionAnswered = (questionAnswerText: string) => {
    const openQuestionEntry = findOpenQuestionEntry()
    if (openQuestionEntry === undefined) return
    setConversationState((conversationState) => ({
      chatEntries: conversationState.chatEntries.map((chatEntry) =>
        chatEntry.chatEntryId === openQuestionEntry.chatEntryId && chatEntry.chatEntryKind === 'question' ? { ...chatEntry, questionAnswerText } : chatEntry,
      ),
    }))
  }

  // Writes a proposal into the vault and marks it accepted, or failed with the reason. Saved chats,
  // hidden folders and locked notes are checked again first, since a lock may have come since.
  const applyAssistantProposalToVault = async (assistantProposalId: string): Promise<boolean> => {
    const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
    const workspaceState = usePapelizWorkspaceStore.getState()
    if (assistantProposal === undefined || assistantProposal.proposalStatus !== 'pending' || workspaceState.openVault === null) return false
    try {
      if (assistantProposal.assistantProposalKind === 'create-note') {
        await workspaceState.createVaultNoteFromAssistant(assistantProposal.vaultNoteRelativePath, assistantProposal.newVaultNoteText)
      } else if (assistantProposal.assistantProposalKind === 'trash-entries') {
        const vaultEntryTrashProblem = assistantProposal.trashedVaultEntryRelativePaths
          .map((trashedVaultEntryRelativePath) =>
            findPapelizAssistantVaultEntryTrashProblem(trashedVaultEntryRelativePath, workspaceState.isWholeVaultEditingLocked, workspaceState.lockedVaultEntryRelativePaths),
          )
          .find((trashProblem) => trashProblem !== null)
        if (vaultEntryTrashProblem !== undefined && vaultEntryTrashProblem !== null) {
          updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: vaultEntryTrashProblem })
          return false
        }
        await workspaceState.moveVaultEntriesToTrashFromAssistant(assistantProposal.trashedVaultEntryRelativePaths)
      } else {
        // Applied to the note as it is now, so edits typed since the proposal are kept.
        const latestVaultNoteText = await readLatestPapelizVaultNoteText(workspaceState.openVault, assistantProposal.vaultNoteRelativePath)
        const vaultNoteTextEditsResult = applyPapelizVaultNoteTextEdits(latestVaultNoteText, assistantProposal.vaultNoteTextEdits)
        if (vaultNoteTextEditsResult.vaultNoteTextEditsOutcome === 'refused') {
          updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: vaultNoteTextEditsResult.vaultNoteTextEditsProblem })
          return false
        }
        await workspaceState.writeVaultNoteTextFromAssistant(assistantProposal.vaultNoteRelativePath, vaultNoteTextEditsResult.editedVaultNoteText)
      }
      updateProposal(assistantProposalId, { proposalStatus: 'accepted', proposalProblem: null })
      closeAssistantProposalPreviewFor(assistantProposalId)
      return true
    } catch (proposalAcceptError) {
      updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: describePapelizVaultError(proposalAcceptError) })
      return false
    }
  }

  let isNewAssistantChatWaitingForRun = false
  const startFreshAssistantChat = () => {
    closeAssistantProposalPreviewFor(null)
    setConversationState({ chatEntries: [], providerChatMessages: [], assistantProposalsById: {}, pendingSelectionContext: null, ...createFreshChatSessionFields() })
  }

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
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `Couldn’t save the chat (${describePapelizVaultError(chatSessionSaveError)})`)
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
    queuedAssistantMessages: [],
    pendingAssistantAttachments: [],

    sendAssistantMessage: async (userMessageText) => {
      const trimmedUserMessageText = userMessageText.trim()
      const sentAttachments = getConversationState().pendingAssistantAttachments
      if ((trimmedUserMessageText.length === 0 && sentAttachments.length === 0) || getConversationState().isAssistantRunning) return
      ensureConversationBelongsToOpenVault()
      markOpenQuestionAnswered(trimmedUserMessageText)
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
      const userMessageEntryId = createChatEntryId()
      appendChatEntry({
        chatEntryId: userMessageEntryId,
        chatEntryKind: 'user-message',
        chatEntryText: trimmedUserMessageText,
        chatEntryContextLabel: contextLabel,
        isSteeringMessage: false,
        userMessageAttachments: sentAttachments,
      })
      setConversationState({ pendingSelectionContext: null, composerDraftText: '', pendingAssistantAttachments: [] })
      // A copy of each picture goes beside the chats, so the saved chat shows it again.
      for (const sentAttachment of sentAttachments) {
        if (sentAttachment.attachmentKind !== 'image') continue
        void usePapelizWorkspaceStore
          .getState()
          .createChatAttachmentFileFromAssistant(sentAttachment.attachmentFileName, sentAttachment.attachmentFileBlob)
          .then((savedAttachmentVaultFileRelativePath) =>
            setConversationState((latestState) => ({
              chatEntries: latestState.chatEntries.map((chatEntry) =>
                chatEntry.chatEntryId === userMessageEntryId && chatEntry.chatEntryKind === 'user-message'
                  ? {
                      ...chatEntry,
                      userMessageAttachments: (chatEntry.userMessageAttachments ?? []).map((userMessageAttachment) =>
                        userMessageAttachment.assistantAttachmentId === sentAttachment.assistantAttachmentId
                          ? { ...userMessageAttachment, savedAttachmentVaultFileRelativePath }
                          : userMessageAttachment,
                      ),
                    }
                  : chatEntry,
              ),
            })),
          )
          .catch((attachmentSaveError: unknown) =>
            usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `Couldn’t save “${sentAttachment.attachmentFileName}” (${describePapelizVaultError(attachmentSaveError)})`),
          )
      }

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
      const providerChatMessages: PapelizChatMessage[] = [
        ...getConversationState().providerChatMessages,
        { role: 'user', content: buildPapelizAssistantUserMessageContent(trimmedUserMessageText, sentAttachments) },
      ]
      // The mode stays as it was when the message was sent, for the whole answer.
      const runAssistantMode = usePapelizAssistantRunOptionsStore.getState().assistantMode
      const runChatTools = listAssistantChatTools(runAssistantMode)
      pendingSteeringMessageTexts = []
      // Steering messages go in after the last step's results, before the next request.
      const takePendingSteeringMessages = (): boolean => {
        if (pendingSteeringMessageTexts.length === 0) return false
        for (const steeringMessageText of pendingSteeringMessageTexts) providerChatMessages.push({ role: 'user', content: steeringMessageText })
        pendingSteeringMessageTexts = []
        return true
      }

      const assistantAbortController = new AbortController()
      activeAssistantAbortController = assistantAbortController
      setConversationState({ isAssistantRunning: true, providerChatMessages })
      const runChatSessionId = conversationState.papelizChatSessionId
      const runProviderModelName = activeProviderConnection.providerConnection.providerModelName
      // The request being answered now, so one that is stopped still counts what it used.
      let inFlightChatMessages: PapelizChatMessage[] | null = null
      let inFlightStreamedAssistantText = ''
      let didRunEndNormally = false
      try {
        for (let toolRound = 0; toolRound < papelizAssistantMaximumToolRounds; toolRound += 1) {
          takePendingSteeringMessages()
          const assistantEntryId = createChatEntryId()
          appendChatEntry({
            chatEntryId: assistantEntryId,
            chatEntryKind: 'assistant-message',
            chatEntryText: '',
            isChatEntryStreaming: true,
            assistantMessageMode: runAssistantMode,
            savedPlanVaultNoteRelativePath: null,
          })
          // The system message is built each step, so Bypass permission switched on or off counts at once.
          const sentChatMessages: PapelizChatMessage[] = [
            { role: 'system', content: buildAssistantSystemMessage(runAssistantMode, contextNoteText, selectionContext) },
            ...providerChatMessages,
          ]
          inFlightChatMessages = sentChatMessages
          inFlightStreamedAssistantText = ''
          const { assistantReasoningEffort, providerModelNamesRefusingReasoningEffort } = usePapelizAssistantRunOptionsStore.getState()
          const isReasoningEffortSent = !providerModelNamesRefusingReasoningEffort.includes(runProviderModelName)
          const chatCompletionResult = await streamPapelizChatCompletion({
            providerConnection: activeProviderConnection.providerConnection,
            chatMessages: sentChatMessages,
            chatTools: runChatTools,
            abortSignal: assistantAbortController.signal,
            ...(isReasoningEffortSent ? { reasoningEffort: assistantReasoningEffort } : {}),
            onAssistantTextDelta: (assistantTextDelta) => {
              inFlightStreamedAssistantText += assistantTextDelta
              updateAssistantMessageEntry(assistantEntryId, (chatEntryText) => ({ chatEntryText: chatEntryText + assistantTextDelta, isChatEntryStreaming: true }))
            },
          })
          inFlightChatMessages = null
          if (chatCompletionResult.isReasoningEffortRefused) usePapelizAssistantRunOptionsStore.getState().rememberProviderModelRefusingReasoningEffort(runProviderModelName)
          addChatCompletionTokenUsage(runChatSessionId, runProviderModelName, chatCompletionResult.completionTokenUsage, chatCompletionResult.completionProviderReportedCostUsd)
          updateAssistantMessageEntry(assistantEntryId, (chatEntryText) => ({ chatEntryText, isChatEntryStreaming: false }))
          if (chatCompletionResult.assistantText.trim().length === 0) {
            setConversationState((latestState) => ({ chatEntries: latestState.chatEntries.filter((chatEntry) => chatEntry.chatEntryId !== assistantEntryId) }))
          }
          providerChatMessages.push({
            role: 'assistant',
            content: chatCompletionResult.assistantText.length > 0 ? chatCompletionResult.assistantText : null,
            ...(chatCompletionResult.assistantToolCalls.length > 0 ? { tool_calls: chatCompletionResult.assistantToolCalls } : {}),
          })
          if (chatCompletionResult.assistantToolCalls.length === 0) {
            // A steering message that came during the last step is answered before the run ends.
            if (takePendingSteeringMessages()) continue
            break
          }

          let isQuestionAsked = false
          for (const assistantToolCall of chatCompletionResult.assistantToolCalls) {
            if (assistantToolCall.function.name === papelizAssistantQuestionToolName) {
              const askedQuestions = readPapelizAssistantQuestionToolCall(assistantToolCall)
              const questionToolProblem = isQuestionAsked
                ? 'Put every question in one call.'
                : askedQuestions === null
                  ? 'The question was empty.'
                  : null
              if (askedQuestions !== null && questionToolProblem === null) {
                isQuestionAsked = true
                appendChatEntry({
                  chatEntryId: createChatEntryId(),
                  chatEntryKind: 'question',
                  assistantQuestions: askedQuestions,
                  questionAnswerTexts: null,
                  questionAnswerText: null,
                })
              }
              providerChatMessages.push({
                role: 'tool',
                tool_call_id: assistantToolCall.id,
                content: JSON.stringify(questionToolProblem === null ? { asked: true, note: 'The user’s answer comes as their next message.' } : { error: questionToolProblem }),
              })
              continue
            }
            const isChangeToolOutsideWrite = runAssistantMode !== 'write' && !papelizAssistantLookUpToolNames.includes(assistantToolCall.function.name)
            const toolOutcome = isChangeToolOutsideWrite
              ? {
                  toolResultText: JSON.stringify({ error: 'Changes are made in Write mode only. Tell the user to switch to Write.' }),
                  toolActivityKind: 'failed' as const,
                  toolActivityLabel: 'Changes need Write mode',
                  toolActivityVaultNoteRelativePaths: [],
                  proposalDraft: null,
                }
              : await executePapelizAssistantVaultTool(assistantToolCall)
            appendChatEntry({
              chatEntryId: createChatEntryId(),
              chatEntryKind: 'tool-activity',
              toolActivityKind: toolOutcome.toolActivityKind,
              toolActivityLabel: toolOutcome.toolActivityLabel,
              toolActivityVaultNoteRelativePaths: toolOutcome.toolActivityVaultNoteRelativePaths,
            })
            let toolResultText = toolOutcome.toolResultText
            if (toolOutcome.proposalDraft !== null) {
              const proposalDraft = toolOutcome.proposalDraft
              const assistantProposalId = `papeliz-proposal-${createChatEntryId()}`
              setConversationState((latestState) => ({
                assistantProposalsById: {
                  ...latestState.assistantProposalsById,
                  [assistantProposalId]: { ...proposalDraft, assistantProposalId, proposalStatus: 'pending', proposalProblem: null },
                },
              }))
              appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'proposal', assistantProposalId })
              // Bypass permission: the change applies now, and the assistant hears how it went.
              if (usePapelizAssistantRunOptionsStore.getState().assistantChangePermission === 'bypass-permission') {
                const isProposalApplied = await applyAssistantProposalToVault(assistantProposalId)
                const appliedProposal = getConversationState().assistantProposalsById[assistantProposalId]
                // What the tool said (such as entries it skipped), with how the change went.
                toolResultText = JSON.stringify({
                  ...(JSON.parse(toolOutcome.toolResultText) as Record<string, unknown>),
                  note: 'Bypass permission is on, so it applied at once.',
                  applied: isProposalApplied,
                  ...(isProposalApplied ? {} : { problem: appliedProposal?.proposalProblem ?? 'Unknown Error' }),
                })
              }
            }
            providerChatMessages.push({ role: 'tool', tool_call_id: assistantToolCall.id, content: toolResultText })
          }
          setConversationState({ providerChatMessages: [...providerChatMessages] })
          // Asking ends the run: the answer comes as the user's next message.
          if (isQuestionAsked) {
            if (takePendingSteeringMessages()) continue
            break
          }
          if (toolRound === papelizAssistantMaximumToolRounds - 1) {
            appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'notice', chatEntryText: 'The assistant stopped after many steps. Ask it to continue if needed.', isChatEntryError: false })
          }
        }
        didRunEndNormally = true
      } catch (assistantRunError) {
        const wasStopped = assistantRunError instanceof DOMException && assistantRunError.name === 'AbortError'
        // Stopped after the answer had begun: the provider sends no counts then, so they are estimated.
        if (wasStopped && inFlightChatMessages !== null && inFlightStreamedAssistantText.length > 0) {
          addChatCompletionTokenUsage(
            runChatSessionId,
            runProviderModelName,
            estimatePapelizChatCompletionTokenUsage({
              sentChatMessages: inFlightChatMessages,
              sentChatTools: runChatTools,
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
        // Steering messages the assistant never got to stay in the history for the next message.
        for (const steeringMessageText of pendingSteeringMessageTexts) providerChatMessages.push({ role: 'user', content: steeringMessageText })
        pendingSteeringMessageTexts = []
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
        // The next queued message goes once the answer ends; after Stop the queue waits.
        const nextQueuedMessage = didRunEndNormally ? getConversationState().queuedAssistantMessages[0] : undefined
        if (nextQueuedMessage !== undefined) {
          setConversationState((latestState) => ({
            queuedAssistantMessages: latestState.queuedAssistantMessages.filter((queuedMessage) => queuedMessage.queuedMessageId !== nextQueuedMessage.queuedMessageId),
          }))
          void Promise.resolve().then(() => getConversationState().sendAssistantMessage(nextQueuedMessage.queuedMessageText))
        }
      }
    },

    steerAssistant: (userMessageText) => {
      const trimmedUserMessageText = userMessageText.trim()
      if (trimmedUserMessageText.length === 0) return
      if (!getConversationState().isAssistantRunning) {
        void getConversationState().sendAssistantMessage(trimmedUserMessageText)
        return
      }
      markOpenQuestionAnswered(trimmedUserMessageText)
      appendChatEntry({
        chatEntryId: createChatEntryId(),
        chatEntryKind: 'user-message',
        chatEntryText: trimmedUserMessageText,
        chatEntryContextLabel: null,
        isSteeringMessage: true,
      })
      pendingSteeringMessageTexts.push(trimmedUserMessageText)
      setConversationState({ composerDraftText: '' })
    },

    queueAssistantMessage: (userMessageText) => {
      const trimmedUserMessageText = userMessageText.trim()
      if (trimmedUserMessageText.length === 0) return
      if (!getConversationState().isAssistantRunning) {
        void getConversationState().sendAssistantMessage(trimmedUserMessageText)
        return
      }
      setConversationState((conversationState) => ({
        composerDraftText: '',
        queuedAssistantMessages: [...conversationState.queuedAssistantMessages, { queuedMessageId: createChatEntryId(), queuedMessageText: trimmedUserMessageText }],
      }))
    },

    removeQueuedAssistantMessage: (queuedMessageId) =>
      setConversationState((conversationState) => ({
        queuedAssistantMessages: conversationState.queuedAssistantMessages.filter((queuedMessage) => queuedMessage.queuedMessageId !== queuedMessageId),
      })),

    sendQueuedAssistantMessageNow: (queuedMessageId) => {
      const queuedMessage = getConversationState().queuedAssistantMessages.find((candidateMessage) => candidateMessage.queuedMessageId === queuedMessageId)
      if (queuedMessage === undefined) return
      getConversationState().removeQueuedAssistantMessage(queuedMessageId)
      getConversationState().steerAssistant(queuedMessage.queuedMessageText)
    },

    addAssistantAttachmentFiles: async (attachmentFiles) => {
      for (const attachmentFile of attachmentFiles) {
        if (getConversationState().pendingAssistantAttachments.length >= papelizAssistantAttachmentLimit) {
          usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `Couldn’t add “${attachmentFile.name}” (${papelizAssistantAttachmentLimit} Files At Most)`)
          return
        }
        const attachmentReadResult = await readPapelizAssistantAttachmentFile(attachmentFile)
        if (attachmentReadResult.attachmentReadOutcome === 'refused') {
          usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `Couldn’t add “${attachmentFile.name}” (${attachmentReadResult.attachmentRefusedBecause})`)
          continue
        }
        setConversationState((conversationState) => ({
          pendingAssistantAttachments: [...conversationState.pendingAssistantAttachments, attachmentReadResult.assistantAttachment],
        }))
      }
    },

    removePendingAssistantAttachment: (assistantAttachmentId) =>
      setConversationState((conversationState) => ({
        pendingAssistantAttachments: conversationState.pendingAssistantAttachments.filter(
          (pendingAttachment) => pendingAttachment.assistantAttachmentId !== assistantAttachmentId,
        ),
      })),

    answerAssistantQuestion: (chatEntryId, questionAnswerTexts) => {
      const questionEntry = getConversationState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === chatEntryId)
      if (questionEntry?.chatEntryKind !== 'question' || questionEntry.questionAnswerText !== null) return
      const trimmedAnswerTexts = questionAnswerTexts.map((questionAnswerText) => questionAnswerText.trim())
      if (trimmedAnswerTexts.length !== questionEntry.assistantQuestions.length || trimmedAnswerTexts.some((answerText) => answerText.length === 0)) return
      // Each answer stays marked on the card; the message itself marks the question answered.
      setConversationState((conversationState) => ({
        chatEntries: conversationState.chatEntries.map((chatEntry) =>
          chatEntry.chatEntryId === chatEntryId && chatEntry.chatEntryKind === 'question' ? { ...chatEntry, questionAnswerTexts: trimmedAnswerTexts } : chatEntry,
        ),
      }))
      getConversationState().steerAssistant(buildPapelizAssistantQuestionAnswerMessage(questionEntry.assistantQuestions, trimmedAnswerTexts))
    },

    carryOutAssistantPlan: (chatEntryId) => {
      const planEntry = getConversationState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === chatEntryId)
      if (planEntry?.chatEntryKind !== 'assistant-message' || getConversationState().isAssistantRunning) return
      usePapelizAssistantRunOptionsStore.getState().setAssistantMode('write')
      void getConversationState().sendAssistantMessage('Carry out the plan above, step by step.')
    },

    // Saves a plan as a note at the top of the vault, named after its title, and opens it.
    saveAssistantPlanAsNote: async (chatEntryId) => {
      const planEntry = getConversationState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === chatEntryId)
      const workspaceState = usePapelizWorkspaceStore.getState()
      if (planEntry?.chatEntryKind !== 'assistant-message' || workspaceState.openVault === null) return
      const planTitle = (/^#\s+(.+)$/m.exec(planEntry.chatEntryText)?.[1] ?? '').replace(/[*_`[\]]/g, '').trim().slice(0, 80)
      const planNoteBaseName = planTitle.length > 0 && describeVaultEntryNameProblem(planTitle) === null ? planTitle : 'Plan'
      const takenVaultEntryNames = new Set(
        workspaceState.vaultTreeEntries
          .filter((vaultTreeEntry) => !vaultTreeEntry.vaultEntryRelativePath.includes('/'))
          .map((vaultTreeEntry) => getVaultEntryName(vaultTreeEntry.vaultEntryRelativePath).toLowerCase()),
      )
      const planVaultNoteRelativePath = pickFreeVaultEntryName(planNoteBaseName, papelizVaultNoteFileExtension, (candidateVaultEntryName) =>
        takenVaultEntryNames.has(candidateVaultEntryName.toLowerCase()),
      )
      try {
        await workspaceState.createVaultNoteFromAssistant(planVaultNoteRelativePath, planEntry.chatEntryText.trim() + '\n')
      } catch (planSaveError) {
        workspaceState.showWorkspaceNotice('error', `Couldn’t save the plan (${describePapelizVaultError(planSaveError)})`)
        return
      }
      setConversationState((conversationState) => ({
        chatEntries: conversationState.chatEntries.map((chatEntry) =>
          chatEntry.chatEntryId === chatEntryId && chatEntry.chatEntryKind === 'assistant-message' ? { ...chatEntry, savedPlanVaultNoteRelativePath: planVaultNoteRelativePath } : chatEntry,
        ),
      }))
      await workspaceState.refreshVaultTree()
      workspaceState.showWorkspaceNotice('info', `Created “${getVaultNoteTitle(planVaultNoteRelativePath)}”.`)
      await workspaceState.openVaultNote(planVaultNoteRelativePath)
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
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', 'Couldn’t open the chat (Not A Chat)')
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
            ? { chatEntryId: createChatEntryId(), chatEntryKind: 'user-message', chatEntryText: chatSessionMessage.chatSessionMessageText, chatEntryContextLabel: null, isSteeringMessage: false }
            : {
                chatEntryId: createChatEntryId(),
                chatEntryKind: 'assistant-message',
                chatEntryText: chatSessionMessage.chatSessionMessageText,
                isChatEntryStreaming: false,
                assistantMessageMode: 'ask',
              },
        ),
        providerChatMessages: savedChatSession.chatSessionMessages.map((chatSessionMessage) => ({
          role: chatSessionMessage.chatSessionMessageRole,
          content: chatSessionMessage.chatSessionMessageText,
        })),
      })
    },

    acceptAssistantProposal: async (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      if (assistantProposal === undefined || !(await applyAssistantProposalToVault(assistantProposalId))) return
      setConversationState((conversationState) => ({
        providerChatMessages: [...conversationState.providerChatMessages, { role: 'user', content: `(I accepted ${describeAssistantProposalForProvider(assistantProposal)}.)` }],
      }))
      saveChatSessionToVault()
    },

    previewAssistantProposal: (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      if (assistantProposal === undefined || assistantProposal.assistantProposalKind === 'trash-entries') return
      usePapelizWorkspaceStore.getState().showAssistantProposalPreview({
        previewedAssistantProposalId: assistantProposalId,
        previewedVaultNoteRelativePath: assistantProposal.vaultNoteRelativePath,
        previewedVaultNoteText: assistantProposal.newVaultNoteText,
      })
    },

    rejectAssistantProposal: (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      if (assistantProposal?.proposalStatus !== 'pending') return
      updateProposal(assistantProposalId, { proposalStatus: 'rejected' })
      closeAssistantProposalPreviewFor(assistantProposalId)
      setConversationState((conversationState) => ({
        providerChatMessages: [...conversationState.providerChatMessages, { role: 'user', content: `(I rejected ${describeAssistantProposalForProvider(assistantProposal)}.)` }],
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
