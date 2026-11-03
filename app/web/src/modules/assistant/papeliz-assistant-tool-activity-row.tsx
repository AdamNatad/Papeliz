import { BookOpenText, CircleAlert, FilePen, Link2, List, Search } from 'lucide-react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizAssistantChatEntry, PapelizAssistantReplyProviderModel } from './papeliz-assistant-conversation-store'
import type { PapelizAssistantToolActivityKind } from './papeliz-assistant-vault-tools'

const papelizToolActivityIcons: Record<PapelizAssistantToolActivityKind, typeof Search> = {
  searched: Search,
  read: BookOpenText,
  'listed-links': Link2,
  'listed-notes': List,
  proposed: FilePen,
  failed: CircleAlert,
}

// What the assistant looked at or tried, as a quiet line with the notes it named, in the conversation
// and under a plan's step.
export function PapelizAssistantToolActivityRow({ chatEntry }: { chatEntry: Extract<PapelizAssistantChatEntry, { chatEntryKind: 'tool-activity' }> }) {
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const ToolActivityIcon = papelizToolActivityIcons[chatEntry.toolActivityKind]
  const shownVaultNoteRelativePaths = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 4)
  return (
    <div
      className={joinPapelizClassNames(
        'papeliz-pop-enter flex flex-wrap items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle',
        chatEntry.toolActivityKind === 'failed' && 'text-papeliz-diff-removed-ink',
      )}
    >
      <ToolActivityIcon className="size-3.5 flex-none" aria-hidden="true" />
      <span>{chatEntry.toolActivityLabel}</span>
      {shownVaultNoteRelativePaths.map((vaultNoteRelativePath) => (
        <button
          key={vaultNoteRelativePath}
          type="button"
          title={vaultNoteRelativePath}
          onClick={() => void openVaultNote(vaultNoteRelativePath)}
          className="rounded-md border border-papeliz-line px-1.5 text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:text-papeliz-blue"
        >
          {getVaultNoteTitle(vaultNoteRelativePath)}
        </button>
      ))}
      {chatEntry.toolActivityVaultNoteRelativePaths.length > shownVaultNoteRelativePaths.length && (
        <span>+{chatEntry.toolActivityVaultNoteRelativePaths.length - shownVaultNoteRelativePaths.length}</span>
      )}
    </div>
  )
}

// The model that wrote an answer, muted beside it, since the model chip can switch models in the
// middle of a chat; the tip adds its provider.
export function PapelizAssistantReplyProviderModelLabel({ replyProviderModel, className }: { replyProviderModel: PapelizAssistantReplyProviderModel; className?: string }) {
  const { assistantReplyProviderModelName, assistantReplyProviderDisplayName } = replyProviderModel
  if (assistantReplyProviderModelName === undefined) return null
  return (
    <span
      className={joinPapelizClassNames('min-w-0 truncate', className)}
      title={`Answered by ${assistantReplyProviderModelName}${assistantReplyProviderDisplayName === undefined ? '' : ` on ${assistantReplyProviderDisplayName}`}`}
    >
      {assistantReplyProviderModelName}
    </span>
  )
}
