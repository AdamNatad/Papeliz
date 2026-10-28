import {
  joinVaultRelativePath,
  papelizVaultChatSessionFolderName,
  papelizVaultEarlierChatSessionFolderName,
  papelizVaultNoteFileExtension,
  pickFreeVaultEntryName,
} from '../vault/papeliz-vault-relative-paths'
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
//   ### Assistant
//   You planned three raised beds… see [[Garden plan]].
//
// A message line that is exactly "### You" or "### Assistant" is written as "\### You", so it can
// never be mistaken for the start of the next message.
//
// The `chat-session-…` keys are the chat's token use (papeliz-assistant-token-usage.ts): every
// request the chat made, added up, then split by model, one line per model ("· estimated" at the
// end when any of its figures is). The context keys are the last request's input plus its output.
// Notes saved before these keys existed read as no use.

export const papelizChatSessionsFolderName = papelizVaultChatSessionFolderName
// Where chats were saved before `.csessions`: `.chatsession`, and before it the visible "Chat
// Sessions". Still read, so earlier chats stay in Sessions until they are moved into `.csessions`.
export const papelizEarlierChatSessionsFolderNames: readonly string[] = [papelizVaultEarlierChatSessionFolderName, 'Chat Sessions']
const papelizChatSessionFrontmatterKey = 'papeliz-chat-session'
const papelizChatSessionUserHeading = '### You'
const papelizChatSessionAssistantHeading = '### Assistant'
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

export type PapelizChatSessionMessageRole = 'user' | 'assistant'

export interface PapelizChatSessionMessage {
  chatSessionMessageRole: PapelizChatSessionMessageRole
  chatSessionMessageText: string
}

export interface PapelizChatSession {
  papelizChatSessionId: string
  chatSessionTitle: string
  chatSessionCreatedAt: string
  chatSessionUpdatedAt: string
  chatSessionModelName: string
  chatSessionMessages: PapelizChatSessionMessage[]
  chatSessionTokenUsage: PapelizChatSessionTokenUsage
}

export function isPapelizChatSessionNotePath(vaultNoteRelativePath: string): boolean {
  return (
    vaultNoteRelativePath.startsWith(`${papelizChatSessionsFolderName}/`) ||
    papelizEarlierChatSessionsFolderNames.some((earlierChatSessionsFolderName) => vaultNoteRelativePath.startsWith(`${earlierChatSessionsFolderName}/`))
  )
}

function escapeMessageMarkerLines(chatSessionMessageText: string): string {
  return chatSessionMessageText
    .split('\n')
    .map((messageLine) => (messageLine.trimEnd() === papelizChatSessionUserHeading || messageLine.trimEnd() === papelizChatSessionAssistantHeading ? `\\${messageLine}` : messageLine))
    .join('\n')
}

function unescapeMessageMarkerLines(chatSessionMessageText: string): string {
  return chatSessionMessageText
    .split('\n')
    .map((messageLine) =>
      messageLine.trimEnd() === `\\${papelizChatSessionUserHeading}` || messageLine.trimEnd() === `\\${papelizChatSessionAssistantHeading}` ? messageLine.slice(1) : messageLine,
    )
    .join('\n')
}

function oneLine(frontmatterValue: string): string {
  return frontmatterValue.replace(/[\r\n]+/g, ' ').trim()
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

export function formatPapelizChatSessionFile(chatSession: PapelizChatSession): string {
  const chatSessionFileParts = [
    '---',
    `${papelizChatSessionFrontmatterKey}: ${oneLine(chatSession.papelizChatSessionId)}`,
    `created: ${oneLine(chatSession.chatSessionCreatedAt)}`,
    `updated: ${oneLine(chatSession.chatSessionUpdatedAt)}`,
    `model: ${oneLine(chatSession.chatSessionModelName) || 'unknown'}`,
    ...formatChatSessionTokenUsageFrontmatterLines(chatSession.chatSessionTokenUsage),
    'tags: [chat-session]',
    '---',
    `# ${oneLine(chatSession.chatSessionTitle) || 'Chat'}`,
  ]
  for (const chatSessionMessage of chatSession.chatSessionMessages) {
    chatSessionFileParts.push(
      '',
      chatSessionMessage.chatSessionMessageRole === 'user' ? papelizChatSessionUserHeading : papelizChatSessionAssistantHeading,
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
  let currentChatSessionMessage: { chatSessionMessageRole: PapelizChatSessionMessageRole; messageLines: string[] } | null = null
  const finishCurrentMessage = () => {
    if (currentChatSessionMessage === null) return
    chatSessionMessages.push({
      chatSessionMessageRole: currentChatSessionMessage.chatSessionMessageRole,
      chatSessionMessageText: unescapeMessageMarkerLines(currentChatSessionMessage.messageLines.join('\n').trim()),
    })
  }
  for (const chatSessionBodyLine of chatSessionBodyLines) {
    const trimmedBodyLine = chatSessionBodyLine.trimEnd()
    if (trimmedBodyLine === papelizChatSessionUserHeading || trimmedBodyLine === papelizChatSessionAssistantHeading) {
      finishCurrentMessage()
      currentChatSessionMessage = { chatSessionMessageRole: trimmedBodyLine === papelizChatSessionUserHeading ? 'user' : 'assistant', messageLines: [] }
    } else if (currentChatSessionMessage !== null) {
      currentChatSessionMessage.messageLines.push(chatSessionBodyLine)
    } else if (chatSessionTitle.length === 0 && trimmedBodyLine.startsWith('# ')) {
      chatSessionTitle = trimmedBodyLine.slice(2).trim()
    }
  }
  finishCurrentMessage()

  return {
    papelizChatSessionId,
    chatSessionTitle,
    chatSessionCreatedAt: frontmatterValues.get('created') ?? '',
    chatSessionUpdatedAt: frontmatterValues.get('updated') ?? '',
    chatSessionModelName: frontmatterValues.get('model') ?? '',
    chatSessionMessages,
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
