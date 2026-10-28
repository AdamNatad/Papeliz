import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { readLatestPapelizVaultNoteText } from '../workspace/papeliz-vault-knowledge-store'
import { parsePapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import { papelizAssistantInlineEditUsageFileName, parsePapelizAssistantInlineEditUsageFile } from './papeliz-assistant-inline-edit-usage-file'
import {
  mergePapelizAssistantModelTokenUsageTallies,
  sumPapelizAssistantTokenUsageTallies,
  type PapelizAssistantModelTokenUsageTally,
  type PapelizAssistantTokenUsageTally,
  type PapelizChatSessionTokenUsage,
} from './papeliz-assistant-token-usage'

// What the Usage tab shows: the tokens the assistant used in the open vault, read straight from the
// vault, from its chat session notes and its inline-edit usage file. Nothing is kept anywhere else.

export interface PapelizAssistantUsageViewSessionRow {
  chatSessionVaultNoteRelativePath: string
  chatSessionTitle: string
  chatSessionUpdatedAt: string
  chatSessionMessageCount: number
  chatSessionTokenUsage: PapelizChatSessionTokenUsage
}

export interface PapelizAssistantVaultTokenUsageRecords {
  papelizVaultId: string
  // Every saved chat in the vault, newest first, whether or not it recorded any use.
  assistantUsageViewSessionRows: PapelizAssistantUsageViewSessionRow[]
  inlineEditModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[]
}

// Newest first: by when the chat was last saved, then by its file name (which starts with the date).
export function sortPapelizAssistantUsageViewSessionRowsNewestFirst(
  assistantUsageViewSessionRows: readonly PapelizAssistantUsageViewSessionRow[],
): PapelizAssistantUsageViewSessionRow[] {
  return [...assistantUsageViewSessionRows].sort(
    (firstSessionRow, secondSessionRow) =>
      secondSessionRow.chatSessionUpdatedAt.localeCompare(firstSessionRow.chatSessionUpdatedAt) ||
      secondSessionRow.chatSessionVaultNoteRelativePath.localeCompare(firstSessionRow.chatSessionVaultNoteRelativePath),
  )
}

// Every saved chat among these notes, newest first. A note that can't be read, or isn't a saved
// chat, is left out. Sessions lists them; Usage adds up their tokens.
export async function readPapelizAssistantChatSessionRows(
  papelizOpenVault: PapelizOpenVault,
  chatSessionVaultNoteRelativePaths: readonly string[],
): Promise<PapelizAssistantUsageViewSessionRow[]> {
  const assistantUsageViewSessionRows = (
    await Promise.all(
      chatSessionVaultNoteRelativePaths.map(async (chatSessionVaultNoteRelativePath): Promise<PapelizAssistantUsageViewSessionRow | null> => {
        const savedChatSession = parsePapelizChatSessionFile(await readLatestPapelizVaultNoteText(papelizOpenVault, chatSessionVaultNoteRelativePath).catch(() => ''))
        if (savedChatSession === null) return null
        return {
          chatSessionVaultNoteRelativePath,
          chatSessionTitle: savedChatSession.chatSessionTitle,
          chatSessionUpdatedAt: savedChatSession.chatSessionUpdatedAt,
          chatSessionMessageCount: savedChatSession.chatSessionMessages.length,
          chatSessionTokenUsage: savedChatSession.chatSessionTokenUsage,
        }
      }),
    )
  ).filter((assistantUsageViewSessionRow) => assistantUsageViewSessionRow !== null)
  return sortPapelizAssistantUsageViewSessionRowsNewestFirst(assistantUsageViewSessionRows)
}

export async function readPapelizAssistantVaultTokenUsageRecords(
  papelizOpenVault: PapelizOpenVault,
  chatSessionVaultNoteRelativePaths: readonly string[],
): Promise<PapelizAssistantVaultTokenUsageRecords> {
  const assistantUsageViewSessionRows = await readPapelizAssistantChatSessionRows(papelizOpenVault, chatSessionVaultNoteRelativePaths)
  const inlineEditUsageFileText = await papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizAssistantInlineEditUsageFileName).catch(() => null)
  return {
    papelizVaultId: papelizOpenVault.papelizVaultId,
    assistantUsageViewSessionRows,
    inlineEditModelTokenUsageTallies: parsePapelizAssistantInlineEditUsageFile(inlineEditUsageFileText),
  }
}

export interface PapelizAssistantVaultTokenUsageSummary {
  vaultTokenUsageTally: PapelizAssistantTokenUsageTally
  // Chats and inline edits together, biggest use first.
  vaultModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[]
  inlineEditsTokenUsageTally: PapelizAssistantTokenUsageTally
  // The inline edits' use, split by model, so their cost can be worked out.
  inlineEditModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[]
  // The chats that made requests, still newest first.
  assistantUsageViewSessionRowsWithTokenUsage: PapelizAssistantUsageViewSessionRow[]
  // Chats saved before token use was kept, which the figures can't include.
  chatSessionWithoutTokenUsageCount: number
}

export function summarizePapelizAssistantVaultTokenUsage(
  assistantUsageViewSessionRows: readonly PapelizAssistantUsageViewSessionRow[],
  inlineEditModelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[],
): PapelizAssistantVaultTokenUsageSummary {
  const assistantUsageViewSessionRowsWithTokenUsage = assistantUsageViewSessionRows.filter(
    (assistantUsageViewSessionRow) => assistantUsageViewSessionRow.chatSessionTokenUsage.chatSessionTokenUsageTally.assistantRequestCount > 0,
  )
  const inlineEditsTokenUsageTally = sumPapelizAssistantTokenUsageTallies(inlineEditModelTokenUsageTallies)
  return {
    vaultTokenUsageTally: sumPapelizAssistantTokenUsageTallies([
      ...assistantUsageViewSessionRowsWithTokenUsage.map((assistantUsageViewSessionRow) => assistantUsageViewSessionRow.chatSessionTokenUsage.chatSessionTokenUsageTally),
      inlineEditsTokenUsageTally,
    ]),
    vaultModelTokenUsageTallies: mergePapelizAssistantModelTokenUsageTallies([
      ...assistantUsageViewSessionRowsWithTokenUsage.map(
        (assistantUsageViewSessionRow) => assistantUsageViewSessionRow.chatSessionTokenUsage.chatSessionModelTokenUsageTallies,
      ),
      inlineEditModelTokenUsageTallies,
    ]),
    inlineEditsTokenUsageTally,
    inlineEditModelTokenUsageTallies: [...inlineEditModelTokenUsageTallies],
    assistantUsageViewSessionRowsWithTokenUsage,
    chatSessionWithoutTokenUsageCount: assistantUsageViewSessionRows.length - assistantUsageViewSessionRowsWithTokenUsage.length,
  }
}
