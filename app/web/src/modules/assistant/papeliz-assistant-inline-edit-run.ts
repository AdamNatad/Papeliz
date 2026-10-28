import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { recordPapelizInlineEditTokenUsageInVault } from './papeliz-assistant-inline-edit-usage-file'
import { getActivePapelizAssistantProviderConnection } from './papeliz-assistant-provider-settings-store'
import {
  PapelizAssistantProviderError,
  estimatePapelizChatCompletionTokenUsage,
  streamPapelizChatCompletion,
  type PapelizChatCompletionResult,
  type PapelizChatCompletionTokenUsage,
  type PapelizChatMessage,
} from './papeliz-openai-compatible-client'

// The assistant on a selection: one short request that rewrites just the selected passage. The
// answer is shown in place as a diff, and nothing changes until the user accepts it. The tokens it
// used are added to the vault's inline-edit usage (papeliz-assistant-inline-edit-usage-file.ts).

export type PapelizInlineEditQuickAction = 'shorter' | 'rewrite' | 'fix-grammar' | 'translate'

function describeBrowserLanguage(): string {
  const browserLanguageCode = typeof navigator === 'undefined' ? 'en' : navigator.language
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(browserLanguageCode) ?? 'English'
  } catch {
    return 'English'
  }
}

export function describePapelizInlineEditQuickAction(inlineEditQuickAction: PapelizInlineEditQuickAction): string {
  switch (inlineEditQuickAction) {
    case 'shorter':
      return 'Make this shorter and plainer, keeping its meaning.'
    case 'rewrite':
      return 'Rewrite this to read more clearly, keeping its meaning and tone.'
    case 'fix-grammar':
      return 'Fix spelling, grammar and punctuation only. Change nothing else.'
    case 'translate':
      return `Translate this into ${describeBrowserLanguage()}. If it already is, translate it into English.`
  }
}

interface PapelizInlineEditRunRequest {
  inlineEditInstruction: string
  selectedPassageText: string
  vaultNoteTitle: string
  abortSignal: AbortSignal
  onReplacementTextDelta: (replacementTextDelta: string) => void
}

export async function runPapelizInlineEdit(inlineEditRunRequest: PapelizInlineEditRunRequest): Promise<string> {
  const activeProviderConnection = getActivePapelizAssistantProviderConnection()
  if (activeProviderConnection.providerConnectionOutcome !== 'ready') throw new PapelizAssistantProviderError(activeProviderConnection.providerSetupProblem, null)
  const inlineEditChatMessages: PapelizChatMessage[] = [
    {
      role: 'system',
      content:
        'You edit one passage of a Markdown note in Papeliz. Reply with only the new passage, in Markdown: no explanation, no quotes around it, no code fence. Keep [[wikilinks]], #tags and formatting unless asked to change them. Keep the passage’s line breaks unless asked otherwise.',
    },
    {
      role: 'user',
      content: `Note: ${inlineEditRunRequest.vaultNoteTitle}\nInstruction: ${inlineEditRunRequest.inlineEditInstruction}\n\nPassage:\n${inlineEditRunRequest.selectedPassageText}`,
    },
  ]
  // The vault the edit was asked in, even if another one is open by the time it is answered.
  const inlineEditOpenVault = usePapelizWorkspaceStore.getState().openVault
  const recordInlineEditTokenUsage = (completionTokenUsage: PapelizChatCompletionTokenUsage) => {
    if (inlineEditOpenVault === null) return
    recordPapelizInlineEditTokenUsageInVault(
      inlineEditOpenVault.papelizVaultAdapter,
      activeProviderConnection.providerConnection.providerModelName,
      completionTokenUsage,
    ).catch((inlineEditUsageWriteError: unknown) => {
      if (usePapelizWorkspaceStore.getState().openVault !== inlineEditOpenVault) return
      usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', `The inline edit’s token use could not be saved in the vault. ${describePapelizVaultError(inlineEditUsageWriteError)}`)
    })
  }
  let streamedReplacementText = ''
  let chatCompletionResult: PapelizChatCompletionResult
  try {
    chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: activeProviderConnection.providerConnection,
      abortSignal: inlineEditRunRequest.abortSignal,
      onAssistantTextDelta: (replacementTextDelta) => {
        streamedReplacementText += replacementTextDelta
        inlineEditRunRequest.onReplacementTextDelta(replacementTextDelta)
      },
      chatMessages: inlineEditChatMessages,
    })
  } catch (inlineEditRunError) {
    // Stopped after the answer had begun: the provider sends no counts then, so they are estimated.
    if (inlineEditRunError instanceof DOMException && inlineEditRunError.name === 'AbortError' && streamedReplacementText.length > 0) {
      recordInlineEditTokenUsage(estimatePapelizChatCompletionTokenUsage({ sentChatMessages: inlineEditChatMessages, receivedAssistantText: streamedReplacementText }))
    }
    throw inlineEditRunError
  }
  recordInlineEditTokenUsage(chatCompletionResult.completionTokenUsage)
  return chatCompletionResult.assistantText.replace(/^```[\w-]*\n([\s\S]*?)\n```$/, '$1')
}
