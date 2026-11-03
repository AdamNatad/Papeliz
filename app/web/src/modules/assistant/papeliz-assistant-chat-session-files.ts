import {
  joinVaultRelativePath,
  papelizVaultChatSessionFolderName,
  papelizVaultEarlierChatSessionFolderName,
  papelizVaultNoteFileExtension,
  pickFreeVaultEntryName,
} from '../vault/papeliz-vault-relative-paths'
import {
  isPapelizAssistantContextMode,
  papelizDefaultAssistantContextChoice,
  type PapelizAssistantContextChoice,
} from './papeliz-assistant-context-choice'
import {
  isPapelizAssistantPlanBuildPhase,
  isPapelizAssistantPlanStepStatus,
  type PapelizAssistantPlanBuildPhase,
  type PapelizAssistantPlanStepStatus,
} from './papeliz-assistant-plan-document'
import {
  papelizUnknownProviderModelName,
  type PapelizAssistantModelTokenUsageTally,
  type PapelizAssistantTokenUsageTally,
  type PapelizChatSessionTokenUsage,
} from './papeliz-assistant-token-usage'

// Conversations with the assistant are saved in the vault itself, in its hidden `.csessions`
// folder (out of the file list unless Show Hidden is on), as ordinary Markdown notes. They travel with the folder wherever it goes, read well in any Markdown
// app, and Papeliz can open them again to continue. A file looks like this:
//
//   ---
//   papeliz-chat-session: 6f1c…
//   created: 2026-10-27T15:40:00.000Z
//   updated: 2026-10-27T15:42:10.000Z
//   model: example-model
//   chat-session-input-tokens: 12034
//   chat-session-output-tokens: 2210
//   chat-session-requests: 6
//   chat-session-tokens-estimated: false
//   chat-session-context-tokens: 9800
//   chat-session-context-tokens-estimated: false
//   chat-session-tokens-by-model:
//     - "example-model · 12034 in · 2210 out · 6 requests"
//   tags: [chat-session]
//   ---
//   # What did I plan for the garden?
//
//   ### You
//   What did I plan for the garden?
//
//   ### Assistant · example-model · Example Provider
//   You planned three raised beds… see [[Garden plan]].
//
// Each answer's heading names the model that wrote it and that model's provider, since the model
// chip can switch models in the middle of a chat. `model:` is the model that answered last.
// Notes saved before then have a bare "### Assistant" and, as `model:`, the model in use when they
// were saved; their answers are put down to it.
//
// A message line that reads like a heading ("### You", or "### Assistant" with or without a model)
// is written as "\### You", so it can never be mistaken for the start of the next message.
//
// The `chat-session-…` keys are the chat's token use (papeliz-assistant-token-usage.ts): every
// request the chat made, added up, then split by model, one line per model ("· estimated" at the
// end when any of its figures is). The context keys are the last request's input plus its output.
// Notes saved before these keys existed read as no use.
//
// A chat that wrote a plan in Plan mode keeps where its latest plan is and how far it was built, so
// reopening it brings the plan back where it stopped and Sessions can show "Plan · 3 of 5 done":
//
//   chat-session-plan-message: 1
//   chat-session-plan-build: stopped
//   chat-session-plan-note: "Plans/Weekly review for Project Hub.md"
//   chat-session-plan-steps:
//     - "done"
//     - "failed · Couldn’t find a Decisions heading."
//     - "to-do"
//
// The message number counts the saved messages from 0; that message holds the plan's Markdown
// (papeliz-assistant-plan-document.ts), one step per line, in the order of the step states.
//
// What the assistant sees, when it isn't the note in front (papeliz-assistant-context-choice.ts), so a
// reopened chat sees the same notes:
//
//   chat-session-sees: selected-notes
//   chat-session-sees-notes:
//     - "Projects/Project Hub.md"
//     - "Inbox.md"
//
// or `chat-session-sees: folder` with `chat-session-sees-folder: "Projects"`. Notes saved before this
// see the note in front.

export const papelizChatSessionsFolderName = papelizVaultChatSessionFolderName
// Where chats were saved before `.csessions`: `.chatsession`, and before it the visible "Chat
// Sessions". Still read, so earlier chats stay in Sessions until they are moved into `.csessions`.
export const papelizEarlierChatSessionsFolderNames: readonly string[] = [papelizVaultEarlierChatSessionFolderName, 'Chat Sessions']
const papelizChatSessionFrontmatterKey = 'papeliz-chat-session'
const papelizChatSessionUserHeading = '### You'
const papelizChatSessionAssistantHeading = '### Assistant'
// "### Assistant", or "### Assistant · model", or "### Assistant · model · provider".
const papelizChatSessionAssistantHeadingPattern = /^### Assistant(?: · (.+))?$/
const papelizChatSessionAssistantHeadingPartSeparator = ' · '
const papelizChatSessionTokenUsageFrontmatterKeys = {
  chatSessionInputTokenCount: 'chat-session-input-tokens',
  chatSessionOutputTokenCount: 'chat-session-output-tokens',
  chatSessionRequestCount: 'chat-session-requests',
  isChatSessionTokenCountEstimated: 'chat-session-tokens-estimated',
  chatSessionContextTokenCount: 'chat-session-context-tokens',
  isChatSessionContextTokenCountEstimated: 'chat-session-context-tokens-estimated',
  chatSessionModelTokenUsageTallies: 'chat-session-tokens-by-model',
} as const
const papelizChatSessionModelTokenUsageLinePattern = /^(.*) · (\d+) in · (\d+) out · (\d+) requests?( · estimated)?(?: · provider cost \$(\d+(?:\.\d+)?) over (\d+))?$/
const papelizChatSessionContextChoiceFrontmatterKeys = {
  assistantContextMode: 'chat-session-sees',
  contextSelectedNoteRelativePaths: 'chat-session-sees-notes',
  contextFolderRelativePath: 'chat-session-sees-folder',
} as const
const papelizChatSessionPlanFrontmatterKeys = {
  chatSessionPlanMessageIndex: 'chat-session-plan-message',
  chatSessionPlanBuildPhase: 'chat-session-plan-build',
  chatSessionPlanNoteRelativePath: 'chat-session-plan-note',
  chatSessionPlanStepStates: 'chat-session-plan-steps',
} as const
const papelizChatSessionPlanStepProblemSeparator = ' · '

export type PapelizChatSessionMessageRole = 'user' | 'assistant'

export interface PapelizChatSessionMessage {
  chatSessionMessageRole: PapelizChatSessionMessageRole
  chatSessionMessageText: string
  // An answer only: the exact model name Papeliz sent its requests to, and that provider's name
  // ("Claude"). Left out when nothing records them.
  assistantReplyProviderModelName?: string
  assistantReplyProviderDisplayName?: string
}

// One step of the chat's plan as the chat keeps it: its state, and why it failed when it did.
export interface PapelizChatSessionPlanStepState {
  planStepStatus: PapelizAssistantPlanStepStatus
  planStepProblem: string | null
}

export interface PapelizChatSessionPlanState {
  // Which saved message holds the plan, counted from 0.
  chatSessionPlanMessageIndex: number
  chatSessionPlanBuildPhase: PapelizAssistantPlanBuildPhase
  // Where Build or Save as Note put the plan's note, once it has one.
  chatSessionPlanNoteRelativePath: string | null
  chatSessionPlanStepStates: PapelizChatSessionPlanStepState[]
}

export interface PapelizChatSession {
  papelizChatSessionId: string
  chatSessionTitle: string
  chatSessionCreatedAt: string
  chatSessionUpdatedAt: string
  chatSessionModelName: string
  chatSessionMessages: PapelizChatSessionMessage[]
  chatSessionTokenUsage: PapelizChatSessionTokenUsage
  // Left out for a chat that wrote no plan.
  chatSessionPlanState?: PapelizChatSessionPlanState
  // Left out for a chat that sees the note in front.
  chatSessionContextChoice?: PapelizAssistantContextChoice
}

export function isPapelizChatSessionNotePath(vaultNoteRelativePath: string): boolean {
  return (
    vaultNoteRelativePath.startsWith(`${papelizChatSessionsFolderName}/`) ||
    papelizEarlierChatSessionsFolderNames.some((earlierChatSessionsFolderName) => vaultNoteRelativePath.startsWith(`${earlierChatSessionsFolderName}/`))
  )
}

function isChatSessionMessageHeadingLine(messageLine: string): boolean {
  const trimmedMessageLine = messageLine.trimEnd()
  return trimmedMessageLine === papelizChatSessionUserHeading || papelizChatSessionAssistantHeadingPattern.test(trimmedMessageLine)
}

function escapeMessageMarkerLines(chatSessionMessageText: string): string {
  return chatSessionMessageText
    .split('\n')
    .map((messageLine) => (isChatSessionMessageHeadingLine(messageLine) ? `\\${messageLine}` : messageLine))
    .join('\n')
}

function unescapeMessageMarkerLines(chatSessionMessageText: string): string {
  return chatSessionMessageText
    .split('\n')
    .map((messageLine) => (messageLine.startsWith('\\') && isChatSessionMessageHeadingLine(messageLine.slice(1)) ? messageLine.slice(1) : messageLine))
    .join('\n')
}

function oneLine(frontmatterValue: string): string {
  return frontmatterValue.replace(/[\r\n]+/g, ' ').trim()
}

// "### Assistant · claude-haiku-5-5 · Claude", or a bare "### Assistant" when the model isn't known.
function formatChatSessionAssistantHeading(chatSessionMessage: PapelizChatSessionMessage): string {
  const assistantReplyProviderModelName = oneLine(chatSessionMessage.assistantReplyProviderModelName ?? '')
  if (assistantReplyProviderModelName.length === 0) return papelizChatSessionAssistantHeading
  const assistantReplyProviderDisplayName = oneLine(chatSessionMessage.assistantReplyProviderDisplayName ?? '')
  return [papelizChatSessionAssistantHeading, assistantReplyProviderModelName, ...(assistantReplyProviderDisplayName.length > 0 ? [assistantReplyProviderDisplayName] : [])].join(
    papelizChatSessionAssistantHeadingPartSeparator,
  )
}

// The model and provider an answer's heading names. The provider is the part after the last " · ",
// so a model name with " · " in it stays whole when its provider is named too.
function parseChatSessionAssistantHeading(
  assistantHeadingLine: string,
): Pick<PapelizChatSessionMessage, 'assistantReplyProviderModelName' | 'assistantReplyProviderDisplayName'> {
  const assistantHeadingText = papelizChatSessionAssistantHeadingPattern.exec(assistantHeadingLine)?.[1]?.trim() ?? ''
  if (assistantHeadingText.length === 0) return {}
  const providerSeparatorIndex = assistantHeadingText.lastIndexOf(papelizChatSessionAssistantHeadingPartSeparator)
  if (providerSeparatorIndex === -1) return { assistantReplyProviderModelName: assistantHeadingText }
  return {
    assistantReplyProviderModelName: assistantHeadingText.slice(0, providerSeparatorIndex).trim(),
    assistantReplyProviderDisplayName: assistantHeadingText.slice(providerSeparatorIndex + papelizChatSessionAssistantHeadingPartSeparator.length).trim(),
  }
}

// One model's line under `chat-session-tokens-by-model`, quoted so any model name stays one value.
function formatChatSessionModelTokenUsageLine(modelTokenUsageTally: PapelizAssistantModelTokenUsageTally): string {
  const modelTokenUsageText = [
    oneLine(modelTokenUsageTally.providerModelName) || papelizUnknownProviderModelName,
    `${modelTokenUsageTally.assistantInputTokenCount} in`,
    `${modelTokenUsageTally.assistantOutputTokenCount} out`,
    `${modelTokenUsageTally.assistantRequestCount} ${modelTokenUsageTally.assistantRequestCount === 1 ? 'request' : 'requests'}`,
    ...(modelTokenUsageTally.isAssistantTokenCountEstimated ? ['estimated'] : []),
    ...((modelTokenUsageTally.assistantProviderReportedCostRequestCount ?? 0) > 0
      ? [`provider cost $${Number((modelTokenUsageTally.assistantProviderReportedCostUsd ?? 0).toFixed(8))} over ${modelTokenUsageTally.assistantProviderReportedCostRequestCount}`]
      : []),
  ].join(' · ')
  return `  - ${JSON.stringify(modelTokenUsageText)}`
}

function parseChatSessionModelTokenUsageLine(modelTokenUsageLineValue: string): PapelizAssistantModelTokenUsageTally | null {
  let modelTokenUsageText = modelTokenUsageLineValue.trim()
  if (modelTokenUsageText.startsWith('"')) {
    try {
      modelTokenUsageText = String(JSON.parse(modelTokenUsageText))
    } catch {
      return null
    }
  }
  const modelTokenUsageMatch = papelizChatSessionModelTokenUsageLinePattern.exec(modelTokenUsageText)
  if (modelTokenUsageMatch === null) return null
  return {
    providerModelName: (modelTokenUsageMatch[1] ?? '').trim() || papelizUnknownProviderModelName,
    assistantInputTokenCount: Number(modelTokenUsageMatch[2]),
    assistantOutputTokenCount: Number(modelTokenUsageMatch[3]),
    assistantRequestCount: Number(modelTokenUsageMatch[4]),
    isAssistantTokenCountEstimated: modelTokenUsageMatch[5] !== undefined,
    ...(modelTokenUsageMatch[6] !== undefined && modelTokenUsageMatch[7] !== undefined
      ? { assistantProviderReportedCostUsd: Number(modelTokenUsageMatch[6]), assistantProviderReportedCostRequestCount: Number(modelTokenUsageMatch[7]) }
      : {}),
  }
}

function readFrontmatterTokenCount(frontmatterValue: string | undefined): number {
  return frontmatterValue !== undefined && /^\d+$/.test(frontmatterValue) ? Number(frontmatterValue) : 0
}

function formatChatSessionTokenUsageFrontmatterLines(chatSessionTokenUsage: PapelizChatSessionTokenUsage): string[] {
  const chatSessionTokenUsageTally = chatSessionTokenUsage.chatSessionTokenUsageTally
  const tokenUsageFrontmatterLines = [
    `${papelizChatSessionTokenUsageFrontmatterKeys.chatSessionInputTokenCount}: ${chatSessionTokenUsageTally.assistantInputTokenCount}`,
    `${papelizChatSessionTokenUsageFrontmatterKeys.chatSessionOutputTokenCount}: ${chatSessionTokenUsageTally.assistantOutputTokenCount}`,
    `${papelizChatSessionTokenUsageFrontmatterKeys.chatSessionRequestCount}: ${chatSessionTokenUsageTally.assistantRequestCount}`,
    `${papelizChatSessionTokenUsageFrontmatterKeys.isChatSessionTokenCountEstimated}: ${chatSessionTokenUsageTally.isAssistantTokenCountEstimated}`,
    `${papelizChatSessionTokenUsageFrontmatterKeys.chatSessionContextTokenCount}: ${chatSessionTokenUsage.chatSessionContextTokenCount}`,
    `${papelizChatSessionTokenUsageFrontmatterKeys.isChatSessionContextTokenCountEstimated}: ${chatSessionTokenUsage.isChatSessionContextTokenCountEstimated}`,
  ]
  if (chatSessionTokenUsage.chatSessionModelTokenUsageTallies.length > 0) {
    tokenUsageFrontmatterLines.push(
      `${papelizChatSessionTokenUsageFrontmatterKeys.chatSessionModelTokenUsageTallies}:`,
      ...chatSessionTokenUsage.chatSessionModelTokenUsageTallies.map(formatChatSessionModelTokenUsageLine),
    )
  }
  return tokenUsageFrontmatterLines
}

function parseChatSessionTokenUsageFrontmatter(
  frontmatterValues: ReadonlyMap<string, string>,
  frontmatterListValues: ReadonlyMap<string, readonly string[]>,
): PapelizChatSessionTokenUsage {
  const chatSessionTokenUsageTally: PapelizAssistantTokenUsageTally = {
    assistantInputTokenCount: readFrontmatterTokenCount(frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.chatSessionInputTokenCount)),
    assistantOutputTokenCount: readFrontmatterTokenCount(frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.chatSessionOutputTokenCount)),
    assistantRequestCount: readFrontmatterTokenCount(frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.chatSessionRequestCount)),
    isAssistantTokenCountEstimated: frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.isChatSessionTokenCountEstimated) === 'true',
  }
  const chatSessionModelTokenUsageTallies = (frontmatterListValues.get(papelizChatSessionTokenUsageFrontmatterKeys.chatSessionModelTokenUsageTallies) ?? [])
    .map(parseChatSessionModelTokenUsageLine)
    .filter((modelTokenUsageTally) => modelTokenUsageTally !== null)
  // Totals with no per-model lines (written by hand, say) are put down to the chat's model.
  if (chatSessionModelTokenUsageTallies.length === 0 && chatSessionTokenUsageTally.assistantRequestCount > 0) {
    chatSessionModelTokenUsageTallies.push({ ...chatSessionTokenUsageTally, providerModelName: frontmatterValues.get('model') || papelizUnknownProviderModelName })
  }
  // The provider's own cost is kept per model only; the chat's is their sum.
  const providerReportedCostRequestCount = chatSessionModelTokenUsageTallies.reduce(
    (requestCount, modelTokenUsageTally) => requestCount + (modelTokenUsageTally.assistantProviderReportedCostRequestCount ?? 0),
    0,
  )
  if (providerReportedCostRequestCount > 0) {
    chatSessionTokenUsageTally.assistantProviderReportedCostRequestCount = providerReportedCostRequestCount
    chatSessionTokenUsageTally.assistantProviderReportedCostUsd = chatSessionModelTokenUsageTallies.reduce(
      (reportedCostUsd, modelTokenUsageTally) => reportedCostUsd + (modelTokenUsageTally.assistantProviderReportedCostUsd ?? 0),
      0,
    )
  }
  return {
    chatSessionTokenUsageTally,
    chatSessionModelTokenUsageTallies,
    chatSessionContextTokenCount: readFrontmatterTokenCount(frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.chatSessionContextTokenCount)),
    isChatSessionContextTokenCountEstimated:
      frontmatterValues.get(papelizChatSessionTokenUsageFrontmatterKeys.isChatSessionContextTokenCountEstimated) === 'true',
  }
}

function formatChatSessionPlanFrontmatterLines(chatSessionPlanState: PapelizChatSessionPlanState | undefined): string[] {
  if (chatSessionPlanState === undefined) return []
  return [
    `${papelizChatSessionPlanFrontmatterKeys.chatSessionPlanMessageIndex}: ${chatSessionPlanState.chatSessionPlanMessageIndex}`,
    `${papelizChatSessionPlanFrontmatterKeys.chatSessionPlanBuildPhase}: ${chatSessionPlanState.chatSessionPlanBuildPhase}`,
    ...(chatSessionPlanState.chatSessionPlanNoteRelativePath === null
      ? []
      : [`${papelizChatSessionPlanFrontmatterKeys.chatSessionPlanNoteRelativePath}: ${JSON.stringify(oneLine(chatSessionPlanState.chatSessionPlanNoteRelativePath))}`]),
    `${papelizChatSessionPlanFrontmatterKeys.chatSessionPlanStepStates}:`,
    ...chatSessionPlanState.chatSessionPlanStepStates.map(
      ({ planStepStatus, planStepProblem }) =>
        `  - ${JSON.stringify(planStepProblem === null ? planStepStatus : `${planStepStatus}${papelizChatSessionPlanStepProblemSeparator}${oneLine(planStepProblem)}`)}`,
    ),
  ]
}

function formatChatSessionContextChoiceFrontmatterLines(chatSessionContextChoice: PapelizAssistantContextChoice | undefined): string[] {
  if (chatSessionContextChoice === undefined || chatSessionContextChoice.assistantContextMode === 'active-note') return []
  const contextChoiceLines = [`${papelizChatSessionContextChoiceFrontmatterKeys.assistantContextMode}: ${chatSessionContextChoice.assistantContextMode}`]
  if (chatSessionContextChoice.assistantContextMode === 'selected-notes') {
    contextChoiceLines.push(
      `${papelizChatSessionContextChoiceFrontmatterKeys.contextSelectedNoteRelativePaths}:`,
      ...chatSessionContextChoice.contextSelectedNoteRelativePaths.map((contextSelectedNoteRelativePath) => `  - ${JSON.stringify(oneLine(contextSelectedNoteRelativePath))}`),
    )
  }
  if (chatSessionContextChoice.assistantContextMode === 'folder' && chatSessionContextChoice.contextFolderRelativePath !== null) {
    contextChoiceLines.push(`${papelizChatSessionContextChoiceFrontmatterKeys.contextFolderRelativePath}: ${JSON.stringify(oneLine(chatSessionContextChoice.contextFolderRelativePath))}`)
  }
  return contextChoiceLines
}

function parseChatSessionContextChoiceFrontmatter(
  frontmatterValues: ReadonlyMap<string, string>,
  frontmatterListValues: ReadonlyMap<string, readonly string[]>,
): PapelizAssistantContextChoice | null {
  const contextModeValue = frontmatterValues.get(papelizChatSessionContextChoiceFrontmatterKeys.assistantContextMode) ?? ''
  if (!isPapelizAssistantContextMode(contextModeValue) || contextModeValue === 'active-note') return null
  const contextFolderRelativePathValue = readQuotedFrontmatterValue(frontmatterValues.get(papelizChatSessionContextChoiceFrontmatterKeys.contextFolderRelativePath) ?? '')
  return {
    ...papelizDefaultAssistantContextChoice,
    assistantContextMode: contextModeValue,
    contextSelectedNoteRelativePaths: (frontmatterListValues.get(papelizChatSessionContextChoiceFrontmatterKeys.contextSelectedNoteRelativePaths) ?? [])
      .map((contextSelectedNoteValue) => readQuotedFrontmatterValue(contextSelectedNoteValue.trim()))
      .filter((contextSelectedNoteRelativePath) => contextSelectedNoteRelativePath.length > 0),
    contextFolderRelativePath: contextFolderRelativePathValue.length > 0 ? contextFolderRelativePathValue : null,
  }
}

// A frontmatter value written with JSON quotes, read back; one without quotes is taken as it is.
function readQuotedFrontmatterValue(frontmatterValue: string): string {
  if (!frontmatterValue.startsWith('"')) return frontmatterValue
  try {
    return String(JSON.parse(frontmatterValue))
  } catch {
    return frontmatterValue
  }
}

function parseChatSessionPlanFrontmatter(
  frontmatterValues: ReadonlyMap<string, string>,
  frontmatterListValues: ReadonlyMap<string, readonly string[]>,
): PapelizChatSessionPlanState | null {
  const planMessageIndexValue = frontmatterValues.get(papelizChatSessionPlanFrontmatterKeys.chatSessionPlanMessageIndex)
  const planBuildPhaseValue = frontmatterValues.get(papelizChatSessionPlanFrontmatterKeys.chatSessionPlanBuildPhase) ?? ''
  if (planMessageIndexValue === undefined || !/^\d+$/.test(planMessageIndexValue) || !isPapelizAssistantPlanBuildPhase(planBuildPhaseValue)) return null
  const planNoteRelativePathValue = readQuotedFrontmatterValue(frontmatterValues.get(papelizChatSessionPlanFrontmatterKeys.chatSessionPlanNoteRelativePath) ?? '')
  const chatSessionPlanStepStates = (frontmatterListValues.get(papelizChatSessionPlanFrontmatterKeys.chatSessionPlanStepStates) ?? []).map(
    (planStepStateValue): PapelizChatSessionPlanStepState => {
      const planStepStateText = readQuotedFrontmatterValue(planStepStateValue.trim())
      const problemSeparatorIndex = planStepStateText.indexOf(papelizChatSessionPlanStepProblemSeparator)
      const planStepStatusText = problemSeparatorIndex === -1 ? planStepStateText : planStepStateText.slice(0, problemSeparatorIndex)
      const planStepProblemText = problemSeparatorIndex === -1 ? '' : planStepStateText.slice(problemSeparatorIndex + papelizChatSessionPlanStepProblemSeparator.length).trim()
      return {
        planStepStatus: isPapelizAssistantPlanStepStatus(planStepStatusText) ? planStepStatusText : 'to-do',
        planStepProblem: planStepProblemText.length > 0 ? planStepProblemText : null,
      }
    },
  )
  return {
    chatSessionPlanMessageIndex: Number(planMessageIndexValue),
    chatSessionPlanBuildPhase: planBuildPhaseValue,
    chatSessionPlanNoteRelativePath: planNoteRelativePathValue.length > 0 ? planNoteRelativePathValue : null,
    chatSessionPlanStepStates,
  }
}

export function formatPapelizChatSessionFile(chatSession: PapelizChatSession): string {
  const chatSessionFileParts = [
    '---',
    `${papelizChatSessionFrontmatterKey}: ${oneLine(chatSession.papelizChatSessionId)}`,
    `created: ${oneLine(chatSession.chatSessionCreatedAt)}`,
    `updated: ${oneLine(chatSession.chatSessionUpdatedAt)}`,
    `model: ${oneLine(chatSession.chatSessionModelName) || 'unknown'}`,
    ...formatChatSessionTokenUsageFrontmatterLines(chatSession.chatSessionTokenUsage),
    ...formatChatSessionPlanFrontmatterLines(chatSession.chatSessionPlanState),
    ...formatChatSessionContextChoiceFrontmatterLines(chatSession.chatSessionContextChoice),
    'tags: [chat-session]',
    '---',
    `# ${oneLine(chatSession.chatSessionTitle) || 'Chat'}`,
  ]
  for (const chatSessionMessage of chatSession.chatSessionMessages) {
    chatSessionFileParts.push(
      '',
      chatSessionMessage.chatSessionMessageRole === 'user' ? papelizChatSessionUserHeading : formatChatSessionAssistantHeading(chatSessionMessage),
      escapeMessageMarkerLines(chatSessionMessage.chatSessionMessageText.trim()),
    )
  }
  return `${chatSessionFileParts.join('\n')}\n`
}

// Returns null for any note that is not a saved chat session.
export function parsePapelizChatSessionFile(chatSessionFileText: string): PapelizChatSession | null {
  const normalizedFileText = chatSessionFileText.replace(/\r\n/g, '\n')
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(normalizedFileText)
  if (frontmatterMatch === null) return null
  const frontmatterValues = new Map<string, string>()
  // "key:" with nothing after it, then "  - item" lines below.
  const frontmatterListValues = new Map<string, string[]>()
  let openFrontmatterListKey: string | null = null
  for (const frontmatterLine of (frontmatterMatch[1] ?? '').split('\n')) {
    const frontmatterLineMatch = /^([\w-]+):\s*(.*)$/.exec(frontmatterLine)
    if (frontmatterLineMatch !== null) {
      const frontmatterKey = frontmatterLineMatch[1] ?? ''
      const frontmatterValue = (frontmatterLineMatch[2] ?? '').trim()
      frontmatterValues.set(frontmatterKey, frontmatterValue)
      openFrontmatterListKey = frontmatterValue.length === 0 ? frontmatterKey : null
      continue
    }
    const frontmatterListItemMatch = /^\s+-\s+(.*)$/.exec(frontmatterLine)
    if (frontmatterListItemMatch !== null && openFrontmatterListKey !== null) {
      frontmatterListValues.set(openFrontmatterListKey, [...(frontmatterListValues.get(openFrontmatterListKey) ?? []), frontmatterListItemMatch[1] ?? ''])
    }
  }
  const papelizChatSessionId = frontmatterValues.get(papelizChatSessionFrontmatterKey)
  if (papelizChatSessionId === undefined || papelizChatSessionId.length === 0) return null

  const chatSessionBodyLines = normalizedFileText.slice(frontmatterMatch[0].length).split('\n')
  let chatSessionTitle = ''
  const chatSessionMessages: PapelizChatSessionMessage[] = []
  let currentChatSessionMessage: (Omit<PapelizChatSessionMessage, 'chatSessionMessageText'> & { messageLines: string[] }) | null = null
  const finishCurrentMessage = () => {
    if (currentChatSessionMessage === null) return
    const { messageLines, ...chatSessionMessageFields } = currentChatSessionMessage
    chatSessionMessages.push({ ...chatSessionMessageFields, chatSessionMessageText: unescapeMessageMarkerLines(messageLines.join('\n').trim()) })
  }
  for (const chatSessionBodyLine of chatSessionBodyLines) {
    const trimmedBodyLine = chatSessionBodyLine.trimEnd()
    if (trimmedBodyLine === papelizChatSessionUserHeading) {
      finishCurrentMessage()
      currentChatSessionMessage = { chatSessionMessageRole: 'user', messageLines: [] }
    } else if (papelizChatSessionAssistantHeadingPattern.test(trimmedBodyLine)) {
      finishCurrentMessage()
      currentChatSessionMessage = { chatSessionMessageRole: 'assistant', ...parseChatSessionAssistantHeading(trimmedBodyLine), messageLines: [] }
    } else if (currentChatSessionMessage !== null) {
      currentChatSessionMessage.messageLines.push(chatSessionBodyLine)
    } else if (chatSessionTitle.length === 0 && trimmedBodyLine.startsWith('# ')) {
      chatSessionTitle = trimmedBodyLine.slice(2).trim()
    }
  }
  finishCurrentMessage()

  // Saved before each answer named its model: every answer is put down to the note's `model:`, the
  // model in use when it was saved. A note that names any answer's model leaves the others unnamed.
  const chatSessionModelName = frontmatterValues.get('model') ?? ''
  const isSavedBeforeAnswerModels = !chatSessionMessages.some((chatSessionMessage) => chatSessionMessage.assistantReplyProviderModelName !== undefined)
  const hasKnownChatSessionModel = chatSessionModelName.length > 0 && chatSessionModelName !== papelizUnknownProviderModelName
  const chatSessionPlanState = parseChatSessionPlanFrontmatter(frontmatterValues, frontmatterListValues)
  const chatSessionContextChoice = parseChatSessionContextChoiceFrontmatter(frontmatterValues, frontmatterListValues)
  return {
    ...(chatSessionPlanState === null ? {} : { chatSessionPlanState }),
    ...(chatSessionContextChoice === null ? {} : { chatSessionContextChoice }),
    papelizChatSessionId,
    chatSessionTitle,
    chatSessionCreatedAt: frontmatterValues.get('created') ?? '',
    chatSessionUpdatedAt: frontmatterValues.get('updated') ?? '',
    chatSessionModelName,
    chatSessionMessages:
      isSavedBeforeAnswerModels && hasKnownChatSessionModel
        ? chatSessionMessages.map((chatSessionMessage) =>
            chatSessionMessage.chatSessionMessageRole === 'assistant' ? { ...chatSessionMessage, assistantReplyProviderModelName: chatSessionModelName } : chatSessionMessage,
          )
        : chatSessionMessages,
    chatSessionTokenUsage: parseChatSessionTokenUsageFrontmatter(frontmatterValues, frontmatterListValues),
  }
}

// ".csessions/2026-10-27 2340 What did I plan for the garden.md", made unique when taken.
export function buildPapelizChatSessionNotePath(chatSessionCreatedAt: Date, chatSessionTitle: string, isVaultEntryNameTaken: (candidateVaultEntryName: string) => boolean): string {
  const twoDigits = (dateNumber: number) => String(dateNumber).padStart(2, '0')
  const datePrefix = `${chatSessionCreatedAt.getFullYear()}-${twoDigits(chatSessionCreatedAt.getMonth() + 1)}-${twoDigits(chatSessionCreatedAt.getDate())} ${twoDigits(chatSessionCreatedAt.getHours())}${twoDigits(chatSessionCreatedAt.getMinutes())}`
  const titleWords = chatSessionTitle
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .replace(/[\s.]+$/, '')
  const chatSessionNoteName = pickFreeVaultEntryName(titleWords.length > 0 ? `${datePrefix} ${titleWords}` : datePrefix, papelizVaultNoteFileExtension, isVaultEntryNameTaken)
  return joinVaultRelativePath(papelizChatSessionsFolderName, chatSessionNoteName)
}
