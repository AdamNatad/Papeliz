import { create } from 'zustand'
import { describePapelizErrorSentence, describePapelizFailureCodeMessage, describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import {
  describeVaultEntryNameProblem,
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultNoteFileName,
  joinVaultRelativePath,
  papelizVaultNoteFileExtension,
  pickFreeVaultEntryName,
} from '../vault/papeliz-vault-relative-paths'
import { readLatestPapelizVaultNoteText, usePapelizVaultKnowledgeStore } from '../workspace/papeliz-vault-knowledge-store'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import {
  buildPapelizChatSessionNotePath,
  formatPapelizChatSessionFile,
  papelizChatSessionsFolderName,
  parsePapelizChatSessionFile,
  type PapelizChatSessionMessage,
  type PapelizChatSessionPlanState,
} from './papeliz-assistant-chat-session-files'
import {
  describePapelizAssistantContextChoiceAboutLabel,
  listPapelizAssistantContextNoteRelativePaths,
  papelizDefaultAssistantContextChoice,
  type PapelizAssistantContextChoice,
  type PapelizAssistantContextMode,
} from './papeliz-assistant-context-choice'
import {
  findPapelizAssistantPlanActiveStep,
  findPapelizAssistantPlanStepToBuild,
  formatPapelizAssistantPlanMarkdown,
  formatPapelizAssistantPlanNote,
  papelizAssistantPlansFolderName,
  parsePapelizAssistantPlanNote,
  readPapelizAssistantPlanReply,
  updatePapelizAssistantPlanStep,
  type PapelizAssistantPlanDocument,
  type PapelizAssistantPlanStepStatus,
} from './papeliz-assistant-plan-document'
import {
  getActivePapelizAssistantProviderConnection,
  selectActivePapelizAssistantProviderModelName,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'
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
import { redactPapelizAssistantProviderErrorText } from './papeliz-assistant-provider-error-redaction'
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
// answers. Each conversation is saved as a note in the vault's hidden `.csessions` folder
// (papeliz-assistant-chat-session-files.ts), so it travels with the vault and can be reopened. The
// note also keeps the tokens the conversation used.
//
// Plan writes a plan (papeliz-assistant-plan-document.ts) that the user edits on its card, then Build
// carries it out one step at a time: the Assistant moves to Write, each step runs there with that
// step's words, and the next starts once the step's proposals are answered (at once, with Bypass
// permission on). Build first
// saves the plan as a checklist note in `Plans/`, and ticks each step there as it finishes. Stop ends
// the step that is running; Continue starts it again. A step that fails waits for Retry Step or Skip
// Step. A plain question asked in Plan gets a short answer and no plan.
//
// The assistant can ask the user a question (papeliz-assistant-question-tool.ts): asking ends the
// run, and the answer is the user's next message. While it answers, a message typed in steers it
// (it reads the message before its next step) or waits in the queue until the answer ends.

export type PapelizAssistantProposalStatus = 'pending' | 'accepted' | 'rejected' | 'failed'

// Which plan step a run builds: entries it makes are drawn under that step on the plan card.
export interface PapelizAssistantPlanStepRunTag {
  planChatEntryId: string
  planStepId: string
}

// The model that wrote an answer, since the model chip can switch models in the middle of a chat:
// the exact model name Papeliz sent the request to, and that provider's name ("Claude"). A chat
// reopened from a note saved before answers named their model may know only the model, or neither.
export interface PapelizAssistantReplyProviderModel {
  assistantReplyProviderModelName?: string
  assistantReplyProviderDisplayName?: string
}

export interface PapelizAssistantProposal extends PapelizAssistantProposalDraft {
  assistantProposalId: string
  proposalStatus: PapelizAssistantProposalStatus
  proposalProblem: string | null
}

export type PapelizAssistantChatEntry = (
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
  | ({
      chatEntryId: string
      chatEntryKind: 'assistant-message'
      chatEntryText: string
      isChatEntryStreaming: boolean
      // The mode it answered in. A Plan answer that is a plan shows as a plan card; one that isn't
      // shows as an answer, with Switch to Ask.
      assistantMessageMode?: PapelizAssistantMode
      // The plan, as edited on its card and built, for a Plan answer that is one.
      assistantPlanDocument?: PapelizAssistantPlanDocument
      // Where Build or Save as Note put the plan's note.
      savedPlanVaultNoteRelativePath?: string | null
    } & PapelizAssistantReplyProviderModel)
  | ({
      chatEntryId: string
      chatEntryKind: 'question'
      assistantQuestions: PapelizAssistantQuestion[]
      // The answer to each question, in order, when they were given on the card.
      questionAnswerTexts: string[] | null
      // The message sent as the answer (on the card, or typed in the chat box), once there is one.
      questionAnswerText: string | null
      // The mode it was asked in: in Plan the card offers Just Plan It.
      questionAskedInMode?: PapelizAssistantMode
      // Skipped with Just Plan It, so the plan was made from the assistant's best guesses.
      wereQuestionsSkippedForPlan?: boolean
    } & PapelizAssistantReplyProviderModel)
  | {
      chatEntryId: string
      chatEntryKind: 'tool-activity'
      toolActivityKind: PapelizAssistantToolActivityKind
      toolActivityLabel: string
      toolActivityVaultNoteRelativePaths: string[]
    }
  | { chatEntryId: string; chatEntryKind: 'proposal'; assistantProposalId: string }
  | { chatEntryId: string; chatEntryKind: 'notice'; chatEntryText: string; isChatEntryError: boolean }
  // Pictures made from the chat box's Imagine button (papeliz-assistant-chat-imagine-store.ts).
  | { chatEntryId: string; chatEntryKind: 'imagine-pictures'; chatImagineRunId: string; imaginePromptText: string }
) & {
  // Made while Build ran one step of a plan: drawn under that step, not in the conversation.
  assistantPlanStepRun?: PapelizAssistantPlanStepRunTag
}

// A Plan answer that is a plan.
export type PapelizAssistantPlanChatEntry = Extract<PapelizAssistantChatEntry, { chatEntryKind: 'assistant-message' }> & {
  assistantPlanDocument: PapelizAssistantPlanDocument
}

export function isPapelizAssistantPlanChatEntry(chatEntry: PapelizAssistantChatEntry): chatEntry is PapelizAssistantPlanChatEntry {
  return chatEntry.chatEntryKind === 'assistant-message' && chatEntry.assistantPlanDocument !== undefined
}

// What the assistant is shown alongside the question (papeliz-assistant-context-choice.ts).
export type { PapelizAssistantContextMode } from './papeliz-assistant-context-choice'

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
  // Selected Notes…'s notes and A Folder…'s folder, kept while another choice is on.
  assistantContextSelectedNoteRelativePaths: readonly string[]
  assistantContextFolderRelativePath: string | null
  pendingSelectionContext: PapelizAssistantSelectionContext | null
  composerDraftText: string
  queuedAssistantMessages: PapelizAssistantQueuedMessage[]
  // Files and pictures waiting to go with the next message.
  pendingAssistantAttachments: PapelizAssistantAttachment[]
  // The plan card opened to the panel's full height, if one is.
  fullHeightAssistantPlanChatEntryId: string | null
  // The error notice that ended the last answer, while Retry can still ask again (in this session, with
  // nothing sent since).
  retryableAssistantErrorChatEntryId: string | null

  sendAssistantMessage: (userMessageText: string) => Promise<void>
  // Retry, on the error that ended the last answer: takes that answer back to the message that asked it,
  // with its files and selection, and asks again.
  retryAssistantAnswer: () => void
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
  // Just Plan It: skips the questions and asks for the plan from the assistant's best guesses.
  skipAssistantQuestionsForPlan: (questionChatEntryId: string) => void
  // Change, on a plan's Assumed box: asks the skipped questions again.
  changeAssistantPlanAssumptions: (planChatEntryId: string) => void
  // An edit made on the plan card before it is built (words, ticks, order, steps added or deleted).
  changeAssistantPlanDocument: (planChatEntryId: string, changePlanDocument: (planDocument: PapelizAssistantPlanDocument) => PapelizAssistantPlanDocument) => void
  // Build, and Continue: saves the plan in Plans/ first, then builds its steps one at a time.
  buildAssistantPlan: (planChatEntryId: string) => Promise<void>
  // Stop: ends the step that is running (Continue starts it again), or holds the build where it waits.
  stopAssistantPlanBuild: (planChatEntryId: string) => void
  retryAssistantPlanStep: (planChatEntryId: string, planStepId: string) => void
  // Leaves a step unticked and goes on to the next.
  skipAssistantPlanStep: (planChatEntryId: string, planStepId: string) => void
  // Saves a plan as a note in a folder ('' is the top of the vault), named after its title, and opens it.
  saveAssistantPlanAsNote: (planChatEntryId: string, planNoteFolderRelativePath?: string) => Promise<void>
  // Continue, on a plan in Plans/: opens its chat, or a new chat with the plan when the chat is gone.
  continueAssistantPlanFromNote: (planVaultNoteRelativePath: string) => Promise<void>
  setFullHeightAssistantPlanChatEntryId: (fullHeightAssistantPlanChatEntryId: string | null) => void
  stopAssistant: () => void
  startNewAssistantChat: () => void
  acceptAssistantProposal: (assistantProposalId: string) => Promise<void>
  // Shows an edit or a new note whole, read-only, in a tab of its own (nothing is written for it).
  previewAssistantProposal: (assistantProposalId: string) => void
  rejectAssistantProposal: (assistantProposalId: string) => void
  acceptAllPendingAssistantProposals: () => Promise<void>
  openSavedChatSession: (chatSessionVaultNoteRelativePath: string) => Promise<void>
  setAssistantContextMode: (assistantContextMode: PapelizAssistantContextMode) => void
  // The "sees" menu's choice, with its notes or folder; saved with the chat.
  setAssistantContextChoice: (assistantContextChoice: PapelizAssistantContextChoice) => void
  setPendingSelectionContext: (pendingSelectionContext: PapelizAssistantSelectionContext | null) => void
  setComposerDraftText: (composerDraftText: string) => void
  appendImaginePicturesChatEntry: (chatImagineRunId: string, imaginePromptText: string) => void
}

const papelizAssistantMaximumToolRounds = 10
const papelizAssistantContextNoteCharacterLimit = 16_000
// All the notes a choice sends, together: past it, the rest are named for the assistant to read.
const papelizAssistantContextNotesCharacterLimit = 120_000

// The "sees" menu's choice as the conversation holds it.
export function selectPapelizAssistantContextChoice(
  conversationState: Pick<PapelizAssistantConversationState, 'assistantContextMode' | 'assistantContextSelectedNoteRelativePaths' | 'assistantContextFolderRelativePath'>,
): PapelizAssistantContextChoice {
  return {
    assistantContextMode: conversationState.assistantContextMode,
    contextSelectedNoteRelativePaths: conversationState.assistantContextSelectedNoteRelativePaths,
    contextFolderRelativePath: conversationState.assistantContextFolderRelativePath,
  }
}

// The notes the conversation's choice covers now, in the open vault.
export function listPapelizAssistantConversationContextNoteRelativePaths(assistantContextChoice: PapelizAssistantContextChoice): string[] {
  const workspaceState = usePapelizWorkspaceStore.getState()
  return listPapelizAssistantContextNoteRelativePaths(assistantContextChoice, {
    activeVaultMarkdownNoteRelativePath: selectActiveVaultMarkdownNoteRelativePath(workspaceState),
    openNoteTabMarkdownNoteRelativePaths: workspaceState.openNoteTabRelativePaths.filter((noteTabRelativePath) => isVaultNoteFileName(getVaultEntryName(noteTabRelativePath))),
    vaultNoteRelativePaths: workspaceState.vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
  })
}

// One note's text as it goes into the request.
interface PapelizAssistantContextNote {
  vaultNoteRelativePath: string
  contextNoteText: string
}

let nextChatEntryNumber = 1
let activeAssistantAbortController: AbortController | null = null
// Steering messages typed during the answer running now, not yet read by the assistant.
let pendingSteeringMessageTexts: string[] = []
// The plan step being built now, when the answer running is one.
let activeAssistantPlanStepRun: PapelizAssistantPlanStepRunTag | null = null
// A plan whose next step waits for the answer running now to end.
let assistantPlanWaitingForRunEndChatEntryId: string | null = null

const papelizAssistantLookUpToolNames: readonly string[] = ['searchVaultNotes', 'readVaultNote', 'listVaultNoteLinks', 'listVaultNotes']

// Sent by Just Plan It, in place of the answers.
export const papelizAssistantJustPlanItMessageText = 'Just plan it: use your best guesses for those questions, and list them in an Assumed: line.'
// Sent by Plan a Fix, under a Plan answer that wasn't a plan.
export const papelizAssistantPlanFixMessageText = 'Plan a fix for that.'

// What the assistant may call in each mode: Ask and Plan only look things up; Write may also propose
// changes. Every mode can ask the user a question, except while Build runs a step of a plan, which
// carries out what was already agreed.
function listAssistantChatTools(assistantMode: PapelizAssistantMode, isPlanStepRun: boolean): PapelizChatToolDefinition[] {
  const vaultToolDefinitions =
    assistantMode === 'write'
      ? papelizAssistantVaultToolDefinitions
      : papelizAssistantVaultToolDefinitions.filter((vaultToolDefinition) => papelizAssistantLookUpToolNames.includes(vaultToolDefinition.function.name))
  return isPlanStepRun ? vaultToolDefinitions : [...vaultToolDefinitions, papelizAssistantQuestionToolDefinition]
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

// What Build sends for one step: the step, and the whole plan as it stands now, since the user may
// have changed it on the card after the assistant wrote it.
function buildAssistantPlanStepMessageText(planDocument: PapelizAssistantPlanDocument, planStepId: string): string {
  const planStepIndex = planDocument.planSteps.findIndex((planStep) => planStep.planStepId === planStepId)
  const planStepNumber = planStepIndex + 1
  return [
    `Build step ${planStepNumber} of ${planDocument.planSteps.length} of the plan “${planDocument.planTitle}”: ${planDocument.planSteps[planStepIndex]?.planStepWords ?? ''}`,
    '',
    'The plan as it stands now (a ticked step is done):',
    '',
    formatPapelizAssistantPlanMarkdown(planDocument),
    '',
    `Do only step ${planStepNumber} now. End with one short line saying what you proposed.`,
  ].join('\n')
}

// A plan's steps run as Write, so the Assistant moves to Write as its build starts or goes on. It
// stays there once the plan is built; going back to Plan is the user's choice.
function moveAssistantModeToWriteForPlanBuild(): void {
  const runOptionsState = usePapelizAssistantRunOptionsStore.getState()
  if (runOptionsState.assistantMode !== 'write') runOptionsState.setAssistantMode('write')
}

// Why a step's run, which proposed nothing, didn't manage its step: its reply says it couldn't, or a
// change it tried was refused. Null when the step simply needed no change.
function findAssistantPlanStepRunProblem(failedChangeToolLabels: readonly string[], lastReplyText: string): string | null {
  const trimmedReplyText = lastReplyText.trim()
  const doesReplySayCouldNot = /^(?:\*\*|__)?(?:couldn[’']t|could not|can[’']t|cannot|unable)\b/i.test(trimmedReplyText)
  if (!doesReplySayCouldNot && failedChangeToolLabels.length === 0) return null
  const firstReplyParagraph = (trimmedReplyText.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim()
  return firstReplyParagraph || failedChangeToolLabels.at(-1) || 'The step couldn’t be done.'
}

// The plan a reopened chat had, from its saved message and the step states its file kept. Nothing
// runs in a chat just opened, so a step that was running or waiting for review is stopped, for
// Continue to start again (its proposals were settled when the chat was saved).
function restoreAssistantPlanDocument(planMessageText: string, chatSessionPlanState: PapelizChatSessionPlanState): PapelizAssistantPlanDocument | null {
  const planDocument = readPapelizAssistantPlanReply(planMessageText)
  if (planDocument === null) return null
  const planSteps = planDocument.planSteps.map((planStep, planStepIndex) => {
    const savedPlanStepState = chatSessionPlanState.chatSessionPlanStepStates[planStepIndex]
    if (savedPlanStepState === undefined) return planStep
    const restoredPlanStepStatus: PapelizAssistantPlanStepStatus =
      savedPlanStepState.planStepStatus === 'running' || savedPlanStepState.planStepStatus === 'needs-review' ? 'stopped' : savedPlanStepState.planStepStatus
    return { ...planStep, planStepStatus: restoredPlanStepStatus, planStepProblem: savedPlanStepState.planStepProblem }
  })
  const savedBuildPhase = chatSessionPlanState.chatSessionPlanBuildPhase
  return { ...planDocument, planSteps, planBuildPhase: savedBuildPhase === 'building' ? 'stopped' : savedBuildPhase }
}

// The plan a build is on now (building: a step running, waiting for review, or failed), for the
// strip that says so while the card is out of sight, and the dot on the Notes tab.
export function selectPapelizAssistantBuildingPlanEntry(conversationState: Pick<PapelizAssistantConversationState, 'chatEntries'>): PapelizAssistantPlanChatEntry | null {
  for (let chatEntryIndex = conversationState.chatEntries.length - 1; chatEntryIndex >= 0; chatEntryIndex -= 1) {
    const chatEntry = conversationState.chatEntries[chatEntryIndex]
    if (chatEntry !== undefined && isPapelizAssistantPlanChatEntry(chatEntry) && chatEntry.assistantPlanDocument.planBuildPhase === 'building') return chatEntry
  }
  return null
}

// The latest plan in the conversation, however far it is built.
export function selectPapelizAssistantLatestPlanEntry(conversationState: Pick<PapelizAssistantConversationState, 'chatEntries'>): PapelizAssistantPlanChatEntry | null {
  for (let chatEntryIndex = conversationState.chatEntries.length - 1; chatEntryIndex >= 0; chatEntryIndex -= 1) {
    const chatEntry = conversationState.chatEntries[chatEntryIndex]
    if (chatEntry !== undefined && isPapelizAssistantPlanChatEntry(chatEntry)) return chatEntry
  }
  return null
}

// The box's words in Plan, which follow the plan on screen: steering while it builds, a change to
// the plan once one is shown, and null (the box's own words) before there is one.
export function describePapelizAssistantPlanComposerPlaceholder(latestPlanEntry: PapelizAssistantPlanChatEntry | null): string | null {
  if (latestPlanEntry === null || latestPlanEntry.assistantPlanDocument.planBuildPhase === 'done') return null
  return latestPlanEntry.assistantPlanDocument.planBuildPhase === 'building' ? 'Steer the build, or queue a message' : 'Ask for a change to the plan'
}

export const papelizSuggestLinksRequestText =
  'Suggest links: look through my notes for places where one note talks about another note’s subject without linking to it. Propose edits that turn those words into [[wikilinks]] (one proposal per note, changing only the linked words). Then tell me in a short list what you proposed.'

export const papelizSuggestTagsRequestText =
  'Suggest tags: find notes with no tags or too few. Propose adding fitting tags to each one’s frontmatter `tags: [...]` list (add the frontmatter block at the top if a note has none), reusing tags the vault already uses where they fit. Then tell me in a short list what you proposed.'

const linkVaultNoteInTranscript = (vaultNoteRelativePath: string) => `[[${vaultNoteRelativePath.replace(/\.md$/i, '')}|${getVaultNoteTitle(vaultNoteRelativePath)}]]`

// A proposal as a quoted line of the transcript: "Proposed an edit to [[Ideas|Ideas]] · accepted".
function describeAssistantProposalForTranscript(assistantProposal: PapelizAssistantProposal): string {
  const proposedVaultEntryLinks =
    assistantProposal.assistantProposalKind === 'trash-entries'
      ? assistantProposal.trashedVaultEntryRelativePaths
          .map((trashedVaultEntryRelativePath) => (isVaultNoteFileName(trashedVaultEntryRelativePath) ? linkVaultNoteInTranscript(trashedVaultEntryRelativePath) : `${trashedVaultEntryRelativePath}/`))
          .join(', ')
      : linkVaultNoteInTranscript(assistantProposal.vaultNoteRelativePath)
  const proposalActivityLabel =
    assistantProposal.assistantProposalKind === 'create-note'
      ? 'Proposed a new note'
      : assistantProposal.assistantProposalKind === 'trash-entries'
        ? 'Proposed deleting'
        : 'Proposed an edit to'
  return `${proposalActivityLabel} ${proposedVaultEntryLinks} · ${assistantProposal.proposalStatus}`
}

// The conversation as the saved transcript: each question, then everything the assistant did and
// said in answer (what it looked at and proposed, as quoted lines, then its reply). A plan is saved as
// it stands on its card, and what Build did for each step joins the plan's answer as quoted lines
// ("Step 2 · Proposed an edit to …"). The latest plan's place and step states come back too, for the
// chat file's frontmatter.
function buildChatSessionMessages(
  chatEntries: readonly PapelizAssistantChatEntry[],
  assistantProposalsById: Record<string, PapelizAssistantProposal>,
): { chatSessionMessages: PapelizChatSessionMessage[]; chatSessionPlanState: PapelizChatSessionPlanState | undefined } {
  const chatSessionMessages: PapelizChatSessionMessage[] = []
  let assistantAnswerLines: string[] = []
  let assistantReplyTexts: string[] = []
  // The model that wrote the answer: one answer comes from one run, which keeps its model throughout.
  let assistantAnswerProviderModel: PapelizAssistantReplyProviderModel = {}
  let chatSessionPlanState: PapelizChatSessionPlanState | undefined
  // The plan in the answer being gathered, placed once the answer is.
  let answerPlanState: Omit<PapelizChatSessionPlanState, 'chatSessionPlanMessageIndex'> | null = null
  const planStepNumbersByPlanStepId = new Map<string, number>()
  for (const chatEntry of chatEntries) {
    if (!isPapelizAssistantPlanChatEntry(chatEntry)) continue
    chatEntry.assistantPlanDocument.planSteps.forEach((planStep, planStepIndex) => planStepNumbersByPlanStepId.set(planStep.planStepId, planStepIndex + 1))
  }
  const finishAssistantAnswer = () => {
    const assistantAnswerText = [assistantAnswerLines.join('\n'), ...assistantReplyTexts].filter((answerPart) => answerPart.trim().length > 0).join('\n\n')
    if (assistantAnswerText.length > 0) {
      if (answerPlanState !== null) chatSessionPlanState = { ...answerPlanState, chatSessionPlanMessageIndex: chatSessionMessages.length }
      chatSessionMessages.push({ chatSessionMessageRole: 'assistant', chatSessionMessageText: assistantAnswerText, ...assistantAnswerProviderModel })
    }
    assistantAnswerLines = []
    assistantReplyTexts = []
    assistantAnswerProviderModel = {}
    answerPlanState = null
  }
  const keepAssistantAnswerProviderModel = ({ assistantReplyProviderModelName, assistantReplyProviderDisplayName }: PapelizAssistantReplyProviderModel) => {
    if (assistantAnswerProviderModel.assistantReplyProviderModelName !== undefined || assistantReplyProviderModelName === undefined) return
    assistantAnswerProviderModel = {
      assistantReplyProviderModelName,
      ...(assistantReplyProviderDisplayName === undefined ? {} : { assistantReplyProviderDisplayName }),
    }
  }
  for (const chatEntry of chatEntries) {
    const planStepRun = chatEntry.assistantPlanStepRun
    if (planStepRun !== undefined) {
      const planStepLabel = `Step ${planStepNumbersByPlanStepId.get(planStepRun.planStepId) ?? '?'}`
      if (chatEntry.chatEntryKind === 'assistant-message') {
        chatEntry.chatEntryText
          .trim()
          .split('\n')
          .filter((replyLine) => replyLine.trim().length > 0)
          .forEach((replyLine, replyLineIndex) => assistantAnswerLines.push(`> ${replyLineIndex === 0 ? `${planStepLabel}: ` : ''}${replyLine}`))
      } else if (chatEntry.chatEntryKind === 'tool-activity' && chatEntry.toolActivityKind !== 'proposed') {
        const linkedNotes = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 6).map(linkVaultNoteInTranscript).join(', ')
        assistantAnswerLines.push(`> - ${planStepLabel} · ${chatEntry.toolActivityLabel}${linkedNotes.length > 0 ? ` ${linkedNotes}` : ''}`)
      } else if (chatEntry.chatEntryKind === 'proposal') {
        const assistantProposal = assistantProposalsById[chatEntry.assistantProposalId]
        if (assistantProposal !== undefined) assistantAnswerLines.push(`> - ${planStepLabel} · ${describeAssistantProposalForTranscript(assistantProposal)}`)
      } else if (chatEntry.chatEntryKind === 'notice' && chatEntry.isChatEntryError) {
        assistantAnswerLines.push(`> - ${planStepLabel} · ${chatEntry.chatEntryText}`)
      }
      // The message Build sent for the step is not saved as one of the user's.
      continue
    }
    if (chatEntry.chatEntryKind === 'user-message') {
      finishAssistantAnswer()
      const attachmentsTranscriptText = describePapelizAssistantAttachmentsForTranscript(chatEntry.userMessageAttachments ?? [])
      chatSessionMessages.push({
        chatSessionMessageRole: 'user',
        chatSessionMessageText: [chatEntry.chatEntryText, attachmentsTranscriptText].filter((messagePart) => messagePart.length > 0).join('\n\n'),
      })
    } else if (chatEntry.chatEntryKind === 'assistant-message') {
      keepAssistantAnswerProviderModel(chatEntry)
      if (chatEntry.assistantPlanDocument === undefined) {
        assistantReplyTexts.push(chatEntry.chatEntryText)
      } else {
        const { assistantPlanDocument } = chatEntry
        assistantReplyTexts.push(formatPapelizAssistantPlanMarkdown(assistantPlanDocument))
        answerPlanState = {
          chatSessionPlanBuildPhase: assistantPlanDocument.planBuildPhase,
          chatSessionPlanNoteRelativePath: chatEntry.savedPlanVaultNoteRelativePath ?? null,
          chatSessionPlanStepStates: assistantPlanDocument.planSteps.map(({ planStepStatus, planStepProblem }) => ({ planStepStatus, planStepProblem })),
        }
      }
    } else if (chatEntry.chatEntryKind === 'question') {
      keepAssistantAnswerProviderModel(chatEntry)
      assistantReplyTexts.push(
        chatEntry.assistantQuestions
          .map((assistantQuestion) => [assistantQuestion.questionText, ...assistantQuestion.answerOptionTexts.map((answerOptionText) => `- ${answerOptionText}`)].join('\n'))
          .join('\n\n'),
      )
    } else if (chatEntry.chatEntryKind === 'tool-activity' && chatEntry.toolActivityKind !== 'proposed') {
      const linkedNotes = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 6).map(linkVaultNoteInTranscript).join(', ')
      assistantAnswerLines.push(`> - ${chatEntry.toolActivityLabel}${linkedNotes.length > 0 ? ` ${linkedNotes}` : ''}`)
    } else if (chatEntry.chatEntryKind === 'proposal') {
      const assistantProposal = assistantProposalsById[chatEntry.assistantProposalId]
      if (assistantProposal !== undefined) assistantAnswerLines.push(`> - ${describeAssistantProposalForTranscript(assistantProposal)}`)
    } else if (chatEntry.chatEntryKind === 'notice' && chatEntry.isChatEntryError) {
      assistantAnswerLines.push(`> - ${chatEntry.chatEntryText}`)
    } else if (chatEntry.chatEntryKind === 'imagine-pictures') {
      finishAssistantAnswer()
      chatSessionMessages.push({ chatSessionMessageRole: 'user', chatSessionMessageText: `Imagine: ${chatEntry.imaginePromptText}` })
    }
  }
  finishAssistantAnswer()
  return { chatSessionMessages, chatSessionPlanState }
}

// What each mode lets the assistant do, as told in its instructions. A plan step Build runs is Write,
// with the step to keep to.
function describeAssistantModeRules(assistantMode: PapelizAssistantMode, isPlanStepRun: boolean): string[] {
  if (assistantMode === 'ask') {
    return [
      '- You are in Ask mode: answer questions about the vault. You cannot change, create or delete notes here. If the user wants a change, tell them to switch to Write.',
    ]
  }
  if (assistantMode === 'plan') {
    return [
      '- You are in Plan mode: look things up, then write a plan the user can edit. Change nothing here: the user edits the steps, then presses Build, and you carry them out in Write mode one step at a time, each reviewed before the next.',
      `- Ask first only when the request leaves real choices open (which notes, where new notes go, what to call things): 1 to 3 short questions with ${papelizAssistantQuestionToolName} (each with a one- or two-word topic and 2 to 4 short answers), then stop. When the request is clear, plan at once.`,
      '- When the user asks a question rather than for a change, answer it briefly, in a few lines, with no plan: no `# ` title and no checklist.',
      '- Write a plan in Markdown in exactly this shape: a first line `# ` title; then a line `Goal: ` with one sentence; then the steps as a checklist, one `- [ ] ` line each. Each step is one sentence that names every note it touches as a [[wikilink]], a note it creates too. Keep to 2 to 8 steps, and write nothing after the last one.',
      '- When the user asks you to plan with your best guesses, add a line `Assumed: ` after the goal that lists each guess, separated by ` · `.',
    ]
  }
  const isBypassPermissionOn = usePapelizAssistantRunOptionsStore.getState().assistantChangePermission === 'bypass-permission'
  return [
    '- You are in Write mode. Read a note before proposing changes to it.',
    '- To change notes, call proposeVaultNoteEdit, proposeVaultNoteCreate or proposeVaultEntriesTrash (deleting moves notes and folders into the vault’s .trash folder, where they can be restored; saved chats are never deleted).',
    isBypassPermissionOn
      ? '- The user turned on Bypass permission: each proposal applies at once, with no review. Be careful and exact, and say what you changed.'
      : '- You never change notes yourself: the user reviews each proposal and decides. Say what you proposed; never say it is done.',
    ...(isPlanStepRun
      ? [
          '- You are building one step of a plan the user approved. Do only that step: read the notes it needs, then propose its changes. Leave the other steps alone.',
          '- Don’t ask questions now: where a choice is open, make the sensible one and say which.',
          '- If the step can’t be done, change nothing and reply with one line that starts with “Couldn’t” and says why.',
        ]
      : []),
  ]
}

// What the model is told about itself, so it can say truthfully what it runs on when asked: the
// provider's name and the exact model name Papeliz sends the request to. Asked who it is or who made it,
// it answers as Papeliz, the whole app, and names Papeliz's maker.
export function describePapelizAssistantRunningProviderModel(runningProviderModelName: string, runningProviderDisplayName: string): string {
  return `You run on the model “${runningProviderModelName}” from the provider “${runningProviderDisplayName}”: Papeliz sends this request to exactly that model name. When asked which model or provider you are, or what runs under the hood, give exactly that model name and provider. Never claim to be another model, and never guess beyond those names. When asked who you are or who made you, answer as Papeliz: Papeliz is a Free, Open-Source Markdown Editor for building your Personal Knowledge Base, with a built-in AI Assistant that works with your Preferred AI Provider, as well as the ability to create and import Workflow Templates for Coding and AI Agents. Papeliz is made by Adam Natad.`
}

function buildAssistantSystemMessage(
  assistantMode: PapelizAssistantMode,
  contextNotes: readonly PapelizAssistantContextNote[],
  contextNotesLeftOutRelativePaths: readonly string[],
  selectionContext: PapelizAssistantSelectionContext | null,
  runningProviderModelName: string,
  runningProviderDisplayName: string,
  isPlanStepRun: boolean,
): string {
  const workspaceState = usePapelizWorkspaceStore.getState()
  const noteCount = Object.keys(usePapelizVaultKnowledgeStore.getState().vaultNoteIndexEntriesByRelativePath).length
  const systemMessageLines = [
    'You are the assistant inside Papeliz, a Free, Open-Source Markdown Editor for your Personal Knowledge Base, with a built-in AI Assistant and Workflow Templates for Coding and AI Agents. You help the user with their vault: a folder of Markdown notes linked with [[wikilinks]].',
    // The user can switch models in the middle of a chat, so an earlier answer may name another one.
    `- ${describePapelizAssistantRunningProviderModel(runningProviderModelName, runningProviderDisplayName)} Earlier answers in this chat may have come from other models the user switched from.`,
    '- Look things up with the tools: searchVaultNotes, readVaultNote, listVaultNoteLinks, listVaultNotes.',
    ...describeAssistantModeRules(assistantMode, isPlanStepRun),
    // Plan says when to ask in its own rules; a plan step doesn't ask.
    ...(assistantMode === 'plan' || isPlanStepRun
      ? []
      : [
          `- When the request is unclear or has real choices to make, ask with ${papelizAssistantQuestionToolName} (1 to 4 short questions, each with a one- or two-word topic and 2 to 4 short answers) and stop there. Don’t ask when the answer is clear.`,
        ]),
    '- When you mention a note, cite it as a wikilink with its title, like [[Garden plan]].',
    '- Keep the user’s Markdown style. Answer in Markdown, briefly, in the language the user writes in.',
    `- Notes in the “${papelizChatSessionsFolderName}” folder are saved conversations with you. Read them when asked, but never propose changes to them.`,
    `The vault is “${workspaceState.openVault?.papelizVaultDisplayName ?? 'unnamed'}” with ${noteCount} notes. Today is ${new Date().toDateString()}.`,
  ]
  const activeVaultMarkdownNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(workspaceState)
  if (activeVaultMarkdownNoteRelativePath !== null) {
    systemMessageLines.push(`The note open on screen is [[${getVaultNoteTitle(activeVaultMarkdownNoteRelativePath)}]] (${activeVaultMarkdownNoteRelativePath}).`)
  }
  // The notes the user chose for the assistant to see ("sees" menu), each in full up to its limit.
  const isOnlyTheOpenNoteSent = contextNotes.length === 1 && contextNotes[0]?.vaultNoteRelativePath === activeVaultMarkdownNoteRelativePath && contextNotesLeftOutRelativePaths.length === 0
  if (isOnlyTheOpenNoteSent) {
    systemMessageLines.push(`Its text:\n<note path="${contextNotes[0]!.vaultNoteRelativePath}">\n${contextNotes[0]!.contextNoteText}\n</note>`)
  } else if (contextNotes.length > 0 || contextNotesLeftOutRelativePaths.length > 0) {
    systemMessageLines.push(`The user asks about these ${contextNotes.length + contextNotesLeftOutRelativePaths.length} notes; their text follows.`)
    for (const contextNote of contextNotes) systemMessageLines.push(`<note path="${contextNote.vaultNoteRelativePath}">\n${contextNote.contextNoteText}\n</note>`)
    if (contextNotesLeftOutRelativePaths.length > 0) {
      systemMessageLines.push(`These are part of it too, but too long to include; read them with readVaultNote as needed: ${contextNotesLeftOutRelativePaths.join(', ')}`)
    }
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
    retryableAssistantErrorChatEntryId: null,
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
      updateProposal(assistantProposalId, { proposalStatus: 'failed', proposalProblem: describePapelizErrorSentence(proposalAcceptError) })
      return false
    }
  }

  let isNewAssistantChatWaitingForRun = false
  const startFreshAssistantChat = () => {
    closeAssistantProposalPreviewFor(null)
    activeAssistantPlanStepRun = null
    assistantPlanWaitingForRunEndChatEntryId = null
    setConversationState({
      chatEntries: [],
      providerChatMessages: [],
      assistantProposalsById: {},
      pendingSelectionContext: null,
      fullHeightAssistantPlanChatEntryId: null,
      ...createFreshChatSessionFields(),
    })
  }

  // A new vault starts a new conversation.
  const ensureConversationBelongsToOpenVault = () => {
    const openVaultId = usePapelizWorkspaceStore.getState().openVault?.papelizVaultId ?? null
    if (getConversationState().chatVaultId !== openVaultId) {
      assistantPlanWaitingForRunEndChatEntryId = null
      setConversationState({
        chatVaultId: openVaultId,
        chatEntries: [],
        providerChatMessages: [],
        assistantProposalsById: {},
        pendingSelectionContext: null,
        fullHeightAssistantPlanChatEntryId: null,
        ...createFreshChatSessionFields(),
        // Another vault's notes and folders mean nothing here.
        assistantContextSelectedNoteRelativePaths: [],
        assistantContextFolderRelativePath: null,
        ...(getConversationState().assistantContextMode === 'selected-notes' || getConversationState().assistantContextMode === 'folder'
          ? { assistantContextMode: papelizDefaultAssistantContextChoice.assistantContextMode }
          : {}),
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
      const { chatSessionMessages, chatSessionPlanState } = buildChatSessionMessages(conversationState.chatEntries, conversationState.assistantProposalsById)
      const firstUserMessage = chatSessionMessages.find((chatSessionMessage) => chatSessionMessage.chatSessionMessageRole === 'user')
      if (firstUserMessage === undefined) return
      // The model that answered last, or the one picked on the chip while none has answered.
      const lastAnswerProviderModelName = [...chatSessionMessages]
        .reverse()
        .find((chatSessionMessage) => chatSessionMessage.assistantReplyProviderModelName !== undefined)?.assistantReplyProviderModelName
      const chatSessionFileText = formatPapelizChatSessionFile({
        papelizChatSessionId: conversationState.papelizChatSessionId,
        chatSessionTitle: firstUserMessage.chatSessionMessageText.split('\n')[0]?.slice(0, 80) ?? 'Chat',
        chatSessionCreatedAt: conversationState.chatSessionCreatedAt,
        chatSessionUpdatedAt: new Date().toISOString(),
        chatSessionModelName: lastAnswerProviderModelName ?? selectActivePapelizAssistantProviderModelName(usePapelizAssistantProviderSettingsStore.getState()),
        chatSessionMessages,
        chatSessionTokenUsage: conversationState.chatSessionTokenUsage,
        ...(chatSessionPlanState === undefined ? {} : { chatSessionPlanState }),
        chatSessionContextChoice: selectPapelizAssistantContextChoice(conversationState),
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
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizFailureMessage('Couldn’t save the chat', chatSessionSaveError))
      }
    })
  }

  const findAssistantPlanEntry = (planChatEntryId: string): PapelizAssistantPlanChatEntry | null => {
    const planEntry = getConversationState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === planChatEntryId)
    return planEntry !== undefined && isPapelizAssistantPlanChatEntry(planEntry) ? planEntry : null
  }

  const updateAssistantPlanEntry = (
    planChatEntryId: string,
    changePlanEntry: (planEntry: PapelizAssistantPlanChatEntry) => Partial<Pick<PapelizAssistantPlanChatEntry, 'assistantPlanDocument' | 'savedPlanVaultNoteRelativePath'>>,
  ) =>
    setConversationState((conversationState) => ({
      chatEntries: conversationState.chatEntries.map((chatEntry) =>
        chatEntry.chatEntryId === planChatEntryId && isPapelizAssistantPlanChatEntry(chatEntry) ? { ...chatEntry, ...changePlanEntry(chatEntry) } : chatEntry,
      ),
    }))

  const updateAssistantPlanDocument = (planChatEntryId: string, changePlanDocument: (planDocument: PapelizAssistantPlanDocument) => PapelizAssistantPlanDocument) =>
    updateAssistantPlanEntry(planChatEntryId, (planEntry) => ({ assistantPlanDocument: changePlanDocument(planEntry.assistantPlanDocument) }))

  // The saved chat's name in `.csessions`, as the plan's note names it, once the chat has been saved.
  const readChatSessionNameForPlanNote = (): string | null => {
    const chatSessionVaultNoteRelativePath = getConversationState().chatSessionVaultNoteRelativePath
    return chatSessionVaultNoteRelativePath === null ? null : getVaultNoteTitle(chatSessionVaultNoteRelativePath)
  }

  // Writes the plan's note again with the plan as it stands (its words and ticks), one write at a
  // time. A note that has gone since is made again where it was.
  let assistantPlanNoteWriteQueue: Promise<void> = Promise.resolve()
  const writeAssistantPlanNote = (planChatEntryId: string): Promise<void> => {
    assistantPlanNoteWriteQueue = assistantPlanNoteWriteQueue.then(async () => {
      const planEntry = findAssistantPlanEntry(planChatEntryId)
      const planVaultNoteRelativePath = planEntry?.savedPlanVaultNoteRelativePath ?? null
      const workspaceState = usePapelizWorkspaceStore.getState()
      if (planEntry === null || planVaultNoteRelativePath === null || workspaceState.openVault?.papelizVaultId !== getConversationState().chatVaultId) return
      const planNoteText = formatPapelizAssistantPlanNote(planEntry.assistantPlanDocument, readChatSessionNameForPlanNote())
      try {
        const isPlanNoteInVault = workspaceState.vaultTreeEntries.some(
          (vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === planVaultNoteRelativePath.toLowerCase(),
        )
        if (isPlanNoteInVault) {
          await workspaceState.writeVaultNoteTextFromAssistant(planVaultNoteRelativePath, planNoteText)
        } else {
          await workspaceState.createVaultNoteFromAssistant(planVaultNoteRelativePath, planNoteText)
          await usePapelizWorkspaceStore.getState().refreshVaultTree()
        }
      } catch (planNoteWriteError) {
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizFailureMessage('Couldn’t update the plan’s note', planNoteWriteError))
      }
    })
    return assistantPlanNoteWriteQueue
  }

  // Puts the plan's note in a folder ('' is the top of the vault), named after the plan's title, and
  // keeps where it went. Gives back the note's path, or null when it couldn't be written (a notice
  // says why).
  const createAssistantPlanNote = async (planChatEntryId: string, planNoteFolderRelativePath: string): Promise<string | null> => {
    // The chat's own save first, so the note can name the chat.
    await chatSessionSaveQueue
    const planEntry = findAssistantPlanEntry(planChatEntryId)
    const workspaceState = usePapelizWorkspaceStore.getState()
    if (planEntry === null || workspaceState.openVault === null) return null
    // Characters a name can't hold become spaces.
    const planNoteTitle = planEntry.assistantPlanDocument.planTitle
      .replace(/[*_`[\]\\/:?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
      .replace(/[\s.]+$/, '')
    const planNoteBaseName = planNoteTitle.length > 0 && describeVaultEntryNameProblem(planNoteTitle) === null ? planNoteTitle : 'Plan'
    const takenVaultEntryNames = new Set(
      workspaceState.vaultTreeEntries
        .filter((vaultTreeEntry) => getVaultEntryParentFolderRelativePath(vaultTreeEntry.vaultEntryRelativePath) === planNoteFolderRelativePath)
        .map((vaultTreeEntry) => getVaultEntryName(vaultTreeEntry.vaultEntryRelativePath).toLowerCase()),
    )
    const planVaultNoteRelativePath = joinVaultRelativePath(
      planNoteFolderRelativePath,
      pickFreeVaultEntryName(planNoteBaseName, papelizVaultNoteFileExtension, (candidateVaultEntryName) => takenVaultEntryNames.has(candidateVaultEntryName.toLowerCase())),
    )
    try {
      await workspaceState.createVaultNoteFromAssistant(
        planVaultNoteRelativePath,
        formatPapelizAssistantPlanNote(findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument ?? planEntry.assistantPlanDocument, readChatSessionNameForPlanNote()),
      )
    } catch (planSaveError) {
      usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizFailureMessage('Couldn’t save the plan', planSaveError))
      return null
    }
    updateAssistantPlanEntry(planChatEntryId, () => ({ savedPlanVaultNoteRelativePath: planVaultNoteRelativePath }))
    await usePapelizWorkspaceStore.getState().refreshVaultTree()
    return planVaultNoteRelativePath
  }

  // Marks a step finished (done, skipped, or failed by its proposals), ticks the plan's note, and
  // saves the chat. Gives back whether the build goes on to its next step.
  const settleAssistantPlanStep = (planChatEntryId: string, planStepId: string, planStepStatus: 'done' | 'skipped' | 'failed', planStepProblem: string | null = null): boolean => {
    updateAssistantPlanDocument(planChatEntryId, (planDocument) => updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus, planStepProblem }))
    void writeAssistantPlanNote(planChatEntryId)
    saveChatSessionToVault()
    return planStepStatus !== 'failed' && findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument.planBuildPhase === 'building'
  }

  // A step whose proposals are all decided is done when one was accepted, failed when one couldn't be
  // applied (and none was accepted), and skipped when every one was rejected.
  const settleAssistantPlanStepFromProposals = (planChatEntryId: string, planStepId: string, stepProposals: readonly PapelizAssistantProposal[]): boolean => {
    if (stepProposals.some((stepProposal) => stepProposal.proposalStatus === 'accepted')) return settleAssistantPlanStep(planChatEntryId, planStepId, 'done')
    const failedStepProposal = stepProposals.find((stepProposal) => stepProposal.proposalStatus === 'failed')
    if (failedStepProposal !== undefined) return settleAssistantPlanStep(planChatEntryId, planStepId, 'failed', failedStepProposal.proposalProblem ?? 'The change couldn’t be applied.')
    return settleAssistantPlanStep(planChatEntryId, planStepId, 'skipped')
  }

  const listAssistantPlanStepProposals = (planStepProposalIds: readonly string[]): PapelizAssistantProposal[] => {
    const { assistantProposalsById } = getConversationState()
    return planStepProposalIds.map((assistantProposalId) => assistantProposalsById[assistantProposalId]).filter((stepProposal) => stepProposal !== undefined)
  }

  // Runs the plan's next step, or marks the plan done when none is left. Waits while a step runs,
  // waits for review or has failed, and while another answer is running.
  const advanceAssistantPlanBuild = (planChatEntryId: string) => {
    const planEntry = findAssistantPlanEntry(planChatEntryId)
    if (planEntry === null || planEntry.assistantPlanDocument.planBuildPhase !== 'building') return
    if (findPapelizAssistantPlanActiveStep(planEntry.assistantPlanDocument) !== null) return
    const planStepToBuild = findPapelizAssistantPlanStepToBuild(planEntry.assistantPlanDocument)
    if (planStepToBuild === null) {
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({ ...planDocument, planBuildPhase: 'done' }))
      // Built, the card goes back into the conversation.
      setConversationState((conversationState) =>
        conversationState.fullHeightAssistantPlanChatEntryId === planChatEntryId ? { fullHeightAssistantPlanChatEntryId: null } : conversationState,
      )
      void writeAssistantPlanNote(planChatEntryId)
      saveChatSessionToVault()
      return
    }
    if (getConversationState().isAssistantRunning) {
      assistantPlanWaitingForRunEndChatEntryId = planChatEntryId
      return
    }
    updateAssistantPlanDocument(planChatEntryId, (planDocument) =>
      updatePapelizAssistantPlanStep(planDocument, planStepToBuild.planStepId, { planStepStatus: 'running', planStepProblem: null, planStepProposalIds: [] }),
    )
    const planStepRunTag: PapelizAssistantPlanStepRunTag = { planChatEntryId, planStepId: planStepToBuild.planStepId }
    const latestPlanDocument = findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument ?? planEntry.assistantPlanDocument
    void runAssistantAnswer(buildAssistantPlanStepMessageText(latestPlanDocument, planStepToBuild.planStepId), planStepRunTag)
  }

  // The build goes on now, or once the answer running ends.
  const continueAssistantPlanBuildWhenFree = (planChatEntryId: string) => {
    if (getConversationState().isAssistantRunning) {
      assistantPlanWaitingForRunEndChatEntryId = planChatEntryId
      return
    }
    advanceAssistantPlanBuild(planChatEntryId)
  }

  type PapelizAssistantPlanStepRunOutcome =
    | { planStepRunOutcome: 'replied'; planStepRunFailedChangeToolLabels: readonly string[]; planStepRunLastReplyText: string }
    | { planStepRunOutcome: 'stopped' }
    | { planStepRunOutcome: 'failed'; planStepRunProblem: string }

  // How a step's run ended, on its step: stopped, failed, waiting for its proposals to be answered, or
  // finished. Gives back whether the build goes straight on to its next step.
  const finishAssistantPlanStepRun = (planStepRunTag: PapelizAssistantPlanStepRunTag, planStepRunOutcome: PapelizAssistantPlanStepRunOutcome): boolean => {
    const { planChatEntryId, planStepId } = planStepRunTag
    const planStep = findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument.planSteps.find((candidateStep) => candidateStep.planStepId === planStepId)
    if (planStep === undefined) return false
    if (planStepRunOutcome.planStepRunOutcome === 'stopped') {
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({
        ...updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: 'stopped', planStepProblem: null }),
        planBuildPhase: 'stopped',
      }))
      return false
    }
    if (planStepRunOutcome.planStepRunOutcome === 'failed') {
      updateAssistantPlanDocument(planChatEntryId, (planDocument) =>
        updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: 'failed', planStepProblem: planStepRunOutcome.planStepRunProblem }),
      )
      return false
    }
    const stepProposals = listAssistantPlanStepProposals(planStep.planStepProposalIds)
    if (stepProposals.length === 0) {
      const planStepRunProblem = findAssistantPlanStepRunProblem(planStepRunOutcome.planStepRunFailedChangeToolLabels, planStepRunOutcome.planStepRunLastReplyText)
      if (planStepRunProblem !== null) {
        updateAssistantPlanDocument(planChatEntryId, (planDocument) =>
          updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: 'failed', planStepProblem: planStepRunProblem }),
        )
        return false
      }
      return settleAssistantPlanStep(planChatEntryId, planStepId, 'done')
    }
    if (stepProposals.some((stepProposal) => stepProposal.proposalStatus === 'pending')) {
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: 'needs-review' }))
      return false
    }
    return settleAssistantPlanStepFromProposals(planChatEntryId, planStepId, stepProposals)
  }

  // Once every proposal of a step waiting for review is decided, the step is finished and the build
  // goes on (unless it was stopped meanwhile).
  const settleAssistantPlanStepAfterProposalDecision = (assistantProposalId: string) => {
    for (const chatEntry of getConversationState().chatEntries) {
      if (!isPapelizAssistantPlanChatEntry(chatEntry)) continue
      const planStep = chatEntry.assistantPlanDocument.planSteps.find((candidateStep) => candidateStep.planStepProposalIds.includes(assistantProposalId))
      if (planStep === undefined) continue
      if (planStep.planStepStatus !== 'needs-review') return
      const stepProposals = listAssistantPlanStepProposals(planStep.planStepProposalIds)
      if (stepProposals.some((stepProposal) => stepProposal.proposalStatus === 'pending')) return
      if (settleAssistantPlanStepFromProposals(chatEntry.chatEntryId, planStep.planStepId, stepProposals)) continueAssistantPlanBuildWhenFree(chatEntry.chatEntryId)
      return
    }
  }

  // One answer: the user's message, or a plan step Build sends, then the assistant's steps until it
  // replies. A plan step runs as Write whatever the switch says, doesn't ask questions, leaves the
  // box, the selection and the attachments alone, and is drawn under its step on the plan card.
  // Where Retry takes the conversation back to: the last answer's message, what it sent, and the
  // conversation as it was before it.
  let lastAssistantAnswerRetryPoint: {
    chatEntryCountBeforeAnswer: number
    providerChatMessagesBeforeAnswer: PapelizChatMessage[]
    retriedUserMessageText: string
    retriedAttachments: PapelizAssistantAttachment[]
    retriedSelectionContext: PapelizAssistantSelectionContext | null
  } | null = null

  const runAssistantAnswer = async (userMessageText: string, planStepRunTag: PapelizAssistantPlanStepRunTag | null) => {
    const trimmedUserMessageText = userMessageText.trim()
    const sentAttachments = planStepRunTag === null ? getConversationState().pendingAssistantAttachments : []
    if (trimmedUserMessageText.length === 0 && sentAttachments.length === 0) return
    if (getConversationState().isAssistantRunning) {
      // A step that couldn't start waits for the answer running now.
      if (planStepRunTag !== null) {
        updateAssistantPlanDocument(planStepRunTag.planChatEntryId, (planDocument) =>
          updatePapelizAssistantPlanStep(planDocument, planStepRunTag.planStepId, { planStepStatus: 'to-do' }),
        )
        assistantPlanWaitingForRunEndChatEntryId = planStepRunTag.planChatEntryId
      }
      return
    }
    ensureConversationBelongsToOpenVault()
    const appendRunChatEntry = (chatEntry: PapelizAssistantChatEntry) =>
      appendChatEntry(planStepRunTag === null ? chatEntry : { ...chatEntry, assistantPlanStepRun: planStepRunTag })
    if (planStepRunTag === null) markOpenQuestionAnswered(trimmedUserMessageText)
    const workspaceState = usePapelizWorkspaceStore.getState()
    const openVault = workspaceState.openVault
    const conversationState = getConversationState()
    const selectionContext = planStepRunTag === null ? conversationState.pendingSelectionContext : null
    // A plan step reads what it needs itself; an answer gets the notes the "sees" menu chose.
    const assistantContextChoice = selectPapelizAssistantContextChoice(conversationState)
    const contextNoteRelativePaths = planStepRunTag === null ? listPapelizAssistantConversationContextNoteRelativePaths(assistantContextChoice) : []
    const contextLabel =
      planStepRunTag !== null
        ? null
        : selectionContext !== null
          ? `Selection in ${getVaultNoteTitle(selectionContext.vaultNoteRelativePath)}`
          : describePapelizAssistantContextChoiceAboutLabel(assistantContextChoice, contextNoteRelativePaths)
    const userMessageEntryId = createChatEntryId()
    if (planStepRunTag === null) {
      lastAssistantAnswerRetryPoint = {
        chatEntryCountBeforeAnswer: getConversationState().chatEntries.length,
        providerChatMessagesBeforeAnswer: getConversationState().providerChatMessages,
        retriedUserMessageText: trimmedUserMessageText,
        retriedAttachments: sentAttachments,
        retriedSelectionContext: selectionContext,
      }
      setConversationState({ retryableAssistantErrorChatEntryId: null })
    }
    appendRunChatEntry({
      chatEntryId: userMessageEntryId,
      chatEntryKind: 'user-message',
      chatEntryText: trimmedUserMessageText,
      chatEntryContextLabel: contextLabel,
      isSteeringMessage: false,
      userMessageAttachments: sentAttachments,
    })
    if (planStepRunTag === null) setConversationState({ pendingSelectionContext: null, composerDraftText: '', pendingAssistantAttachments: [] })
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
          usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizFailureMessage(`Couldn’t save “${sentAttachment.attachmentFileName}”`, attachmentSaveError)),
        )
    }

    const activeProviderConnection = getActivePapelizAssistantProviderConnection()
    if (activeProviderConnection.providerConnectionOutcome !== 'ready' || openVault === null) {
      const providerProblemText =
        openVault === null ? 'Open a vault first.' : activeProviderConnection.providerConnectionOutcome === 'ready' ? '' : activeProviderConnection.providerSetupProblem
      appendRunChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'notice', chatEntryText: providerProblemText, isChatEntryError: true })
      if (planStepRunTag !== null) {
        finishAssistantPlanStepRun(planStepRunTag, { planStepRunOutcome: 'failed', planStepRunProblem: providerProblemText })
        saveChatSessionToVault()
      }
      return
    }

    // Taken before reading the open note, so nothing else starts in the meantime.
    pendingSteeringMessageTexts = []
    activeAssistantPlanStepRun = planStepRunTag
    setConversationState({ isAssistantRunning: true })
    // Each note's text, up to its own limit and all of them together up to theirs; the rest are named.
    const contextNotes: PapelizAssistantContextNote[] = []
    const contextNotesLeftOutRelativePaths: string[] = []
    let contextNotesCharacterCount = 0
    for (const contextNoteRelativePath of contextNoteRelativePaths) {
      if (contextNotesCharacterCount >= papelizAssistantContextNotesCharacterLimit) {
        contextNotesLeftOutRelativePaths.push(contextNoteRelativePath)
        continue
      }
      const readContextNoteText = await readLatestPapelizVaultNoteText(openVault, contextNoteRelativePath).catch(() => null)
      if (readContextNoteText === null) continue
      const contextNoteText = readContextNoteText.slice(0, papelizAssistantContextNoteCharacterLimit)
      contextNotesCharacterCount += contextNoteText.length
      contextNotes.push({ vaultNoteRelativePath: contextNoteRelativePath, contextNoteText })
    }
    const providerChatMessages: PapelizChatMessage[] = [
      ...getConversationState().providerChatMessages,
      { role: 'user', content: buildPapelizAssistantUserMessageContent(trimmedUserMessageText, sentAttachments) },
    ]
    // The mode stays as it was when the message was sent, for the whole answer.
    const runAssistantMode: PapelizAssistantMode = planStepRunTag === null ? usePapelizAssistantRunOptionsStore.getState().assistantMode : 'write'
    const isPlanStepRun = planStepRunTag !== null
    const runChatTools = listAssistantChatTools(runAssistantMode, isPlanStepRun)
    // Steering messages go in after the last step's results, before the next request.
    const takePendingSteeringMessages = (): boolean => {
      if (pendingSteeringMessageTexts.length === 0) return false
      for (const steeringMessageText of pendingSteeringMessageTexts) providerChatMessages.push({ role: 'user', content: steeringMessageText })
      pendingSteeringMessageTexts = []
      return true
    }

    const assistantAbortController = new AbortController()
    activeAssistantAbortController = assistantAbortController
    setConversationState({ providerChatMessages })
    const runChatSessionId = conversationState.papelizChatSessionId
    // The model and provider stay as they were when the message was sent, for the whole answer.
    const runProviderModelName = activeProviderConnection.providerConnection.providerModelName
    const runProviderDisplayName = activeProviderConnection.providerDisplayName
    // The request being answered now, so one that is stopped still counts what it used.
    let inFlightChatMessages: PapelizChatMessage[] | null = null
    let inFlightStreamedAssistantText = ''
    let didRunEndNormally = false
    // What a plan step's run did, to tell whether it managed its step.
    const planStepRunFailedChangeToolLabels: string[] = []
    let planStepRunLastReplyText = ''
    let planStepRunOutcome: PapelizAssistantPlanStepRunOutcome | null = null
    try {
      for (let toolRound = 0; toolRound < papelizAssistantMaximumToolRounds; toolRound += 1) {
        takePendingSteeringMessages()
        const assistantEntryId = createChatEntryId()
        appendRunChatEntry({
          chatEntryId: assistantEntryId,
          chatEntryKind: 'assistant-message',
          chatEntryText: '',
          isChatEntryStreaming: true,
          assistantMessageMode: runAssistantMode,
          savedPlanVaultNoteRelativePath: null,
          assistantReplyProviderModelName: runProviderModelName,
          assistantReplyProviderDisplayName: runProviderDisplayName,
        })
        // The system message is built each step, so Bypass permission switched on or off counts at once.
        const sentChatMessages: PapelizChatMessage[] = [
          {
            role: 'system',
            content: buildAssistantSystemMessage(runAssistantMode, contextNotes, contextNotesLeftOutRelativePaths, selectionContext, runProviderModelName, runProviderDisplayName, isPlanStepRun),
          },
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
        } else {
          planStepRunLastReplyText = chatCompletionResult.assistantText
          // A Plan reply that is a plan becomes the plan on its card; one that isn't stays an answer.
          const repliedPlanDocument = runAssistantMode === 'plan' ? readPapelizAssistantPlanReply(chatCompletionResult.assistantText) : null
          if (repliedPlanDocument !== null) {
            setConversationState((latestState) => ({
              chatEntries: latestState.chatEntries.map((chatEntry) =>
                chatEntry.chatEntryId === assistantEntryId && chatEntry.chatEntryKind === 'assistant-message' ? { ...chatEntry, assistantPlanDocument: repliedPlanDocument } : chatEntry,
              ),
            }))
          }
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
            const askedQuestions = isPlanStepRun ? null : readPapelizAssistantQuestionToolCall(assistantToolCall)
            const questionToolProblem = isPlanStepRun
              ? 'No questions while building a step. Make the sensible choice and say which.'
              : isQuestionAsked
                ? 'Put every question in one call.'
                : askedQuestions === null
                  ? 'The question was empty.'
                  : null
            if (askedQuestions !== null && questionToolProblem === null) {
              isQuestionAsked = true
              appendRunChatEntry({
                chatEntryId: createChatEntryId(),
                chatEntryKind: 'question',
                assistantQuestions: askedQuestions,
                questionAnswerTexts: null,
                questionAnswerText: null,
                questionAskedInMode: runAssistantMode,
                assistantReplyProviderModelName: runProviderModelName,
                assistantReplyProviderDisplayName: runProviderDisplayName,
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
          appendRunChatEntry({
            chatEntryId: createChatEntryId(),
            chatEntryKind: 'tool-activity',
            toolActivityKind: toolOutcome.toolActivityKind,
            toolActivityLabel: toolOutcome.toolActivityLabel,
            toolActivityVaultNoteRelativePaths: toolOutcome.toolActivityVaultNoteRelativePaths,
          })
          if (toolOutcome.toolActivityKind === 'failed' && !papelizAssistantLookUpToolNames.includes(assistantToolCall.function.name)) {
            planStepRunFailedChangeToolLabels.push(toolOutcome.toolActivityLabel)
          }
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
            // The step's proposals: it is answered once each is decided.
            if (planStepRunTag !== null) {
              updateAssistantPlanDocument(planStepRunTag.planChatEntryId, (planDocument) => ({
                ...planDocument,
                planSteps: planDocument.planSteps.map((planStep) =>
                  planStep.planStepId === planStepRunTag.planStepId ? { ...planStep, planStepProposalIds: [...planStep.planStepProposalIds, assistantProposalId] } : planStep,
                ),
              }))
            }
            appendRunChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'proposal', assistantProposalId })
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
          appendRunChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'notice', chatEntryText: 'The assistant stopped after many steps. Ask it to continue if needed.', isChatEntryError: false })
        }
      }
      didRunEndNormally = true
      planStepRunOutcome = { planStepRunOutcome: 'replied', planStepRunFailedChangeToolLabels, planStepRunLastReplyText }
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
      // The notice is shown and saved in the chat file, so it is cleaned of the key first.
      const runProblemText = wasStopped
        ? 'Stopped.'
        : redactPapelizAssistantProviderErrorText(
            assistantRunError instanceof Error ? assistantRunError.message : 'The assistant could not answer.',
            activeProviderConnection.providerConnection.providerApiKey,
          )
      const runProblemChatEntryId = createChatEntryId()
      appendRunChatEntry({ chatEntryId: runProblemChatEntryId, chatEntryKind: 'notice', chatEntryText: runProblemText, isChatEntryError: !wasStopped })
      if (!wasStopped && planStepRunTag === null) setConversationState({ retryableAssistantErrorChatEntryId: runProblemChatEntryId })
      planStepRunOutcome = wasStopped ? { planStepRunOutcome: 'stopped' } : { planStepRunOutcome: 'failed', planStepRunProblem: runProblemText }
    } finally {
      if (activeAssistantAbortController === assistantAbortController) activeAssistantAbortController = null
      if (activeAssistantPlanStepRun === planStepRunTag) activeAssistantPlanStepRun = null
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
      // A step's run settles its step first, so the saved chat has the step's state.
      const doesPlanBuildGoOn = planStepRunTag !== null && planStepRunOutcome !== null && finishAssistantPlanStepRun(planStepRunTag, planStepRunOutcome)
      saveChatSessionToVault()
      if (isNewAssistantChatWaitingForRun) {
        isNewAssistantChatWaitingForRun = false
        startFreshAssistantChat()
      }
      // Then the plan's next step, or one that waited for this answer; failing those, the next queued
      // message, once the answer ends (after Stop the queue waits).
      const planChatEntryIdToContinue = doesPlanBuildGoOn ? planStepRunTag.planChatEntryId : assistantPlanWaitingForRunEndChatEntryId
      assistantPlanWaitingForRunEndChatEntryId = null
      const nextQueuedMessage = planChatEntryIdToContinue === null && didRunEndNormally ? getConversationState().queuedAssistantMessages[0] : undefined
      if (planChatEntryIdToContinue !== null) {
        void Promise.resolve().then(() => advanceAssistantPlanBuild(planChatEntryIdToContinue))
      } else if (nextQueuedMessage !== undefined) {
        setConversationState((latestState) => ({
          queuedAssistantMessages: latestState.queuedAssistantMessages.filter((queuedMessage) => queuedMessage.queuedMessageId !== nextQueuedMessage.queuedMessageId),
        }))
        void Promise.resolve().then(() => getConversationState().sendAssistantMessage(nextQueuedMessage.queuedMessageText))
      }
    }
  }

  return {
    chatVaultId: null,
    ...createFreshChatSessionFields(),
    chatEntries: [],
    providerChatMessages: [],
    assistantProposalsById: {},
    isAssistantRunning: false,
    assistantContextMode: papelizDefaultAssistantContextChoice.assistantContextMode,
    assistantContextSelectedNoteRelativePaths: papelizDefaultAssistantContextChoice.contextSelectedNoteRelativePaths,
    assistantContextFolderRelativePath: papelizDefaultAssistantContextChoice.contextFolderRelativePath,
    pendingSelectionContext: null,
    composerDraftText: '',
    queuedAssistantMessages: [],
    pendingAssistantAttachments: [],
    fullHeightAssistantPlanChatEntryId: null,

    sendAssistantMessage: (userMessageText) => runAssistantAnswer(userMessageText, null),

    retryAssistantAnswer: () => {
      const { isAssistantRunning, retryableAssistantErrorChatEntryId, chatEntries, composerDraftText, pendingAssistantAttachments, pendingSelectionContext } = getConversationState()
      const retryPoint = lastAssistantAnswerRetryPoint
      if (isAssistantRunning || retryPoint === null || retryableAssistantErrorChatEntryId === null || chatEntries.at(-1)?.chatEntryId !== retryableAssistantErrorChatEntryId) return
      setConversationState({
        chatEntries: chatEntries.slice(0, retryPoint.chatEntryCountBeforeAnswer),
        providerChatMessages: retryPoint.providerChatMessagesBeforeAnswer,
        pendingAssistantAttachments: retryPoint.retriedAttachments,
        pendingSelectionContext: retryPoint.retriedSelectionContext,
        retryableAssistantErrorChatEntryId: null,
      })
      // The answer takes what it sends as it starts; what was typed, added or selected since stays.
      void runAssistantAnswer(retryPoint.retriedUserMessageText, null)
      setConversationState({ composerDraftText, pendingAssistantAttachments, pendingSelectionContext })
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
          usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `Couldn’t add “${attachmentFile.name}”. A message can carry up to ${papelizAssistantAttachmentLimit} files.`)
          return
        }
        const attachmentReadResult = await readPapelizAssistantAttachmentFile(attachmentFile)
        if (attachmentReadResult.attachmentReadOutcome === 'refused') {
          usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizFailureCodeMessage(`Couldn’t add “${attachmentFile.name}”`, attachmentReadResult.attachmentRefusedBecause))
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

    skipAssistantQuestionsForPlan: (questionChatEntryId) => {
      const questionEntry = getConversationState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === questionChatEntryId)
      if (questionEntry?.chatEntryKind !== 'question' || questionEntry.questionAnswerText !== null) return
      setConversationState((conversationState) => ({
        chatEntries: conversationState.chatEntries.map((chatEntry) =>
          chatEntry.chatEntryId === questionChatEntryId && chatEntry.chatEntryKind === 'question' ? { ...chatEntry, wereQuestionsSkippedForPlan: true } : chatEntry,
        ),
      }))
      // What comes back is a plan, so it is asked for in Plan.
      if (usePapelizAssistantRunOptionsStore.getState().assistantMode !== 'plan') usePapelizAssistantRunOptionsStore.getState().setAssistantMode('plan')
      getConversationState().steerAssistant(papelizAssistantJustPlanItMessageText)
    },

    changeAssistantPlanAssumptions: (planChatEntryId) => {
      const { chatEntries } = getConversationState()
      const planEntryIndex = chatEntries.findIndex((chatEntry) => chatEntry.chatEntryId === planChatEntryId)
      if (planEntryIndex === -1 || findOpenQuestionEntry() !== undefined) return
      const skippedQuestionEntry = chatEntries
        .slice(0, planEntryIndex)
        .reverse()
        .find((chatEntry): chatEntry is Extract<PapelizAssistantChatEntry, { chatEntryKind: 'question' }> => chatEntry.chatEntryKind === 'question' && chatEntry.wereQuestionsSkippedForPlan === true)
      // A plan that guessed without asking: the box takes the change in words.
      if (skippedQuestionEntry === undefined) {
        setConversationState({ composerDraftText: 'Change the assumptions: ' })
        return
      }
      // The same questions again; their answers come back as the next message, in Plan.
      appendChatEntry({
        chatEntryId: createChatEntryId(),
        chatEntryKind: 'question',
        assistantQuestions: skippedQuestionEntry.assistantQuestions,
        questionAnswerTexts: null,
        questionAnswerText: null,
        questionAskedInMode: 'plan',
        assistantReplyProviderModelName: skippedQuestionEntry.assistantReplyProviderModelName,
        assistantReplyProviderDisplayName: skippedQuestionEntry.assistantReplyProviderDisplayName,
      })
    },

    changeAssistantPlanDocument: (planChatEntryId, changePlanDocument) => {
      const planEntry = findAssistantPlanEntry(planChatEntryId)
      if (planEntry === null || planEntry.assistantPlanDocument.planBuildPhase !== 'draft') return
      updateAssistantPlanDocument(planChatEntryId, changePlanDocument)
      if ((planEntry.savedPlanVaultNoteRelativePath ?? null) !== null) void writeAssistantPlanNote(planChatEntryId)
      saveChatSessionToVault()
    },

    buildAssistantPlan: async (planChatEntryId) => {
      const planEntry = findAssistantPlanEntry(planChatEntryId)
      if (planEntry === null) return
      const { planBuildPhase, planSteps } = planEntry.assistantPlanDocument
      if (planBuildPhase === 'building' || planBuildPhase === 'done' || planSteps.length === 0) return
      // Build saves the plan in Plans/ before its first step. Pressed twice, the second waits for it.
      if ((planEntry.savedPlanVaultNoteRelativePath ?? null) === null) {
        updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({ ...planDocument, planBuildPhase: 'building' }))
        const planVaultNoteRelativePath = await createAssistantPlanNote(planChatEntryId, papelizAssistantPlansFolderName)
        if (planVaultNoteRelativePath === null) {
          updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({ ...planDocument, planBuildPhase }))
          return
        }
      }
      moveAssistantModeToWriteForPlanBuild()
      // Continue starts a stopped or failed step again; a step still waiting for review goes on waiting.
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({
        ...planDocument,
        planBuildPhase: 'building',
        planSteps: planDocument.planSteps.map((planStep) =>
          planStep.planStepStatus === 'stopped' || planStep.planStepStatus === 'failed' ? { ...planStep, planStepStatus: 'to-do', planStepProblem: null } : planStep,
        ),
      }))
      saveChatSessionToVault()
      // A step whose proposals were all answered while the build was stopped is finished first.
      const reviewedPlanStep = findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument.planSteps.find((planStep) => planStep.planStepStatus === 'needs-review')
      if (reviewedPlanStep !== undefined) {
        const stepProposals = listAssistantPlanStepProposals(reviewedPlanStep.planStepProposalIds)
        if (stepProposals.some((stepProposal) => stepProposal.proposalStatus === 'pending')) return
        if (!settleAssistantPlanStepFromProposals(planChatEntryId, reviewedPlanStep.planStepId, stepProposals)) return
      }
      continueAssistantPlanBuildWhenFree(planChatEntryId)
    },

    stopAssistantPlanBuild: (planChatEntryId) => {
      const planEntry = findAssistantPlanEntry(planChatEntryId)
      if (planEntry === null || planEntry.assistantPlanDocument.planBuildPhase !== 'building') return
      if (assistantPlanWaitingForRunEndChatEntryId === planChatEntryId) assistantPlanWaitingForRunEndChatEntryId = null
      // A step running ends as stopped, when its run does.
      if (activeAssistantPlanStepRun?.planChatEntryId === planChatEntryId && activeAssistantAbortController !== null) {
        activeAssistantAbortController.abort()
        return
      }
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({ ...planDocument, planBuildPhase: 'stopped' }))
      saveChatSessionToVault()
    },

    retryAssistantPlanStep: (planChatEntryId, planStepId) => {
      const planStep = findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument.planSteps.find((candidateStep) => candidateStep.planStepId === planStepId)
      if (planStep === undefined || (planStep.planStepStatus !== 'failed' && planStep.planStepStatus !== 'stopped')) return
      moveAssistantModeToWriteForPlanBuild()
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({
        ...updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: 'to-do', planStepProblem: null }),
        planBuildPhase: 'building',
      }))
      continueAssistantPlanBuildWhenFree(planChatEntryId)
    },

    skipAssistantPlanStep: (planChatEntryId, planStepId) => {
      const planStep = findAssistantPlanEntry(planChatEntryId)?.assistantPlanDocument.planSteps.find((candidateStep) => candidateStep.planStepId === planStepId)
      if (planStep === undefined || (planStep.planStepStatus !== 'failed' && planStep.planStepStatus !== 'stopped')) return
      moveAssistantModeToWriteForPlanBuild()
      updateAssistantPlanDocument(planChatEntryId, (planDocument) => ({ ...planDocument, planBuildPhase: 'building' }))
      if (settleAssistantPlanStep(planChatEntryId, planStepId, 'skipped')) continueAssistantPlanBuildWhenFree(planChatEntryId)
    },

    saveAssistantPlanAsNote: async (planChatEntryId, planNoteFolderRelativePath = papelizAssistantPlansFolderName) => {
      const planEntry = findAssistantPlanEntry(planChatEntryId)
      if (planEntry === null || (planEntry.savedPlanVaultNoteRelativePath ?? null) !== null) return
      const planVaultNoteRelativePath = await createAssistantPlanNote(planChatEntryId, planNoteFolderRelativePath)
      if (planVaultNoteRelativePath === null) return
      saveChatSessionToVault()
      const workspaceState = usePapelizWorkspaceStore.getState()
      workspaceState.showWorkspaceNotice('info', `Created “${getVaultNoteTitle(planVaultNoteRelativePath)}”.`)
      await workspaceState.openVaultNote(planVaultNoteRelativePath)
    },

    continueAssistantPlanFromNote: async (planVaultNoteRelativePath) => {
      const workspaceState = usePapelizWorkspaceStore.getState()
      const openVault = workspaceState.openVault
      if (openVault === null || getConversationState().isAssistantRunning) return
      const planNote = parsePapelizAssistantPlanNote(await readLatestPapelizVaultNoteText(openVault, planVaultNoteRelativePath).catch(() => ''))
      if (planNote === null) {
        workspaceState.showWorkspaceNotice('error', 'Couldn’t open the plan. The note isn’t a plan, or it’s damaged.')
        return
      }
      const planChatSessionVaultNoteRelativePath =
        planNote.planNoteChatSessionName === null ? null : `${papelizChatSessionsFolderName}/${planNote.planNoteChatSessionName}${papelizVaultNoteFileExtension}`
      if (
        planChatSessionVaultNoteRelativePath !== null &&
        workspaceState.vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === planChatSessionVaultNoteRelativePath.toLowerCase())
      ) {
        await getConversationState().openSavedChatSession(planChatSessionVaultNoteRelativePath)
        return
      }
      // Its chat is gone: the plan starts a chat of its own, with the ticks its note has.
      const continueMessageText = `Continue the plan “${planNote.planDocument.planTitle}”.`
      const planMarkdown = formatPapelizAssistantPlanMarkdown(planNote.planDocument)
      closeAssistantProposalPreviewFor(null)
      activeAssistantPlanStepRun = null
      assistantPlanWaitingForRunEndChatEntryId = null
      setConversationState({
        chatVaultId: openVault.papelizVaultId,
        ...createFreshChatSessionFields(),
        assistantProposalsById: {},
        pendingSelectionContext: null,
        fullHeightAssistantPlanChatEntryId: null,
        chatEntries: [
          { chatEntryId: createChatEntryId(), chatEntryKind: 'user-message', chatEntryText: continueMessageText, chatEntryContextLabel: null, isSteeringMessage: false },
          {
            chatEntryId: createChatEntryId(),
            chatEntryKind: 'assistant-message',
            chatEntryText: planMarkdown,
            isChatEntryStreaming: false,
            assistantMessageMode: 'plan',
            assistantPlanDocument: planNote.planDocument,
            savedPlanVaultNoteRelativePath: planVaultNoteRelativePath,
          },
        ],
        providerChatMessages: [
          { role: 'user', content: continueMessageText },
          { role: 'assistant', content: planMarkdown },
        ],
      })
      saveChatSessionToVault()
    },

    setFullHeightAssistantPlanChatEntryId: (fullHeightAssistantPlanChatEntryId) => setConversationState({ fullHeightAssistantPlanChatEntryId }),

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
        usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', 'Couldn’t open the chat. The file isn’t a saved chat, or it’s damaged.')
        return
      }
      const savedPlanState = savedChatSession.chatSessionPlanState
      const savedContextChoice = savedChatSession.chatSessionContextChoice ?? papelizDefaultAssistantContextChoice
      activeAssistantPlanStepRun = null
      assistantPlanWaitingForRunEndChatEntryId = null
      // Earlier answers come back as text; their proposals were settled when the chat was saved. The
      // chat's plan comes back on its card, where it stopped.
      setConversationState({
        chatVaultId: openVault.papelizVaultId,
        papelizChatSessionId: savedChatSession.papelizChatSessionId,
        chatSessionVaultNoteRelativePath,
        chatSessionCreatedAt: savedChatSession.chatSessionCreatedAt || new Date().toISOString(),
        // Carries on from what the chat had used (none, for a note saved before usage was kept).
        chatSessionTokenUsage: savedChatSession.chatSessionTokenUsage,
        assistantProposalsById: {},
        pendingSelectionContext: null,
        fullHeightAssistantPlanChatEntryId: null,
        retryableAssistantErrorChatEntryId: null,
        // The chat sees what it saw when it was saved.
        assistantContextMode: savedContextChoice.assistantContextMode,
        assistantContextSelectedNoteRelativePaths: [...savedContextChoice.contextSelectedNoteRelativePaths],
        assistantContextFolderRelativePath: savedContextChoice.contextFolderRelativePath,
        chatEntries: savedChatSession.chatSessionMessages.map((chatSessionMessage, chatSessionMessageIndex): PapelizAssistantChatEntry => {
          if (chatSessionMessage.chatSessionMessageRole === 'user') {
            return { chatEntryId: createChatEntryId(), chatEntryKind: 'user-message', chatEntryText: chatSessionMessage.chatSessionMessageText, chatEntryContextLabel: null, isSteeringMessage: false }
          }
          const restoredPlanDocument =
            savedPlanState?.chatSessionPlanMessageIndex === chatSessionMessageIndex ? restoreAssistantPlanDocument(chatSessionMessage.chatSessionMessageText, savedPlanState) : null
          return {
            chatEntryId: createChatEntryId(),
            chatEntryKind: 'assistant-message',
            chatEntryText: chatSessionMessage.chatSessionMessageText,
            isChatEntryStreaming: false,
            assistantMessageMode: restoredPlanDocument === null ? 'ask' : 'plan',
            ...(restoredPlanDocument === null
              ? {}
              : { assistantPlanDocument: restoredPlanDocument, savedPlanVaultNoteRelativePath: savedPlanState?.chatSessionPlanNoteRelativePath ?? null }),
            assistantReplyProviderModelName: chatSessionMessage.assistantReplyProviderModelName,
            assistantReplyProviderDisplayName: chatSessionMessage.assistantReplyProviderDisplayName,
          }
        }),
        providerChatMessages: savedChatSession.chatSessionMessages.map((chatSessionMessage) => ({
          role: chatSessionMessage.chatSessionMessageRole,
          content: chatSessionMessage.chatSessionMessageText,
        })),
      })
    },

    acceptAssistantProposal: async (assistantProposalId) => {
      const assistantProposal = getConversationState().assistantProposalsById[assistantProposalId]
      if (assistantProposal === undefined) return
      const isProposalApplied = await applyAssistantProposalToVault(assistantProposalId)
      // One that couldn't be applied is decided too: its step learns it failed.
      if (isProposalApplied) {
        setConversationState((conversationState) => ({
          providerChatMessages: [...conversationState.providerChatMessages, { role: 'user', content: `(I accepted ${describeAssistantProposalForProvider(assistantProposal)}.)` }],
        }))
      }
      if (assistantProposal.proposalStatus === 'pending') settleAssistantPlanStepAfterProposalDecision(assistantProposalId)
      if (isProposalApplied) saveChatSessionToVault()
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
      settleAssistantPlanStepAfterProposalDecision(assistantProposalId)
      saveChatSessionToVault()
    },

    acceptAllPendingAssistantProposals: async () => {
      for (const assistantProposal of Object.values(getConversationState().assistantProposalsById)) {
        if (assistantProposal.proposalStatus === 'pending') await getConversationState().acceptAssistantProposal(assistantProposal.assistantProposalId)
      }
    },

    setAssistantContextMode: (assistantContextMode) => setConversationState({ assistantContextMode }),

    setAssistantContextChoice: (assistantContextChoice) => {
      setConversationState({
        assistantContextMode: assistantContextChoice.assistantContextMode,
        assistantContextSelectedNoteRelativePaths: [...assistantContextChoice.contextSelectedNoteRelativePaths],
        assistantContextFolderRelativePath: assistantContextChoice.contextFolderRelativePath,
      })
      // A chat already saved keeps its new choice; one with nothing in it yet saves with its first answer.
      if (getConversationState().chatEntries.length > 0) saveChatSessionToVault()
    },
    setPendingSelectionContext: (pendingSelectionContext) => setConversationState({ pendingSelectionContext }),
    setComposerDraftText: (composerDraftText) => setConversationState({ composerDraftText }),
    appendImaginePicturesChatEntry: (chatImagineRunId, imaginePromptText) =>
      appendChatEntry({ chatEntryId: createChatEntryId(), chatEntryKind: 'imagine-pictures', chatImagineRunId, imaginePromptText }),
  }
})
