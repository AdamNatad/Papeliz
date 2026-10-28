import { Check, CircleAlert, Eye, FilePlus, FileText, Folder, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { getVaultNoteTitle, isVaultNoteFileName, isVaultRelativePathInsideFolder } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { diffPapelizTextByWords, type PapelizTextDiffPart } from './papeliz-assistant-text-diff'

export function PapelizTextDiffView({ textDiffParts }: { textDiffParts: readonly PapelizTextDiffPart[] }) {
  return (
    <div className="papeliz-text-diff papeliz-selectable-text whitespace-pre-wrap break-words">
      {textDiffParts.map((textDiffPart, textDiffPartIndex) =>
        textDiffPart.textDiffPartKind === 'kept' ? (
          <span key={textDiffPartIndex}>{textDiffPart.textDiffPartText}</span>
        ) : textDiffPart.textDiffPartKind === 'removed' ? (
          <del key={textDiffPartIndex} className="papeliz-text-diff-removed">
            {textDiffPart.textDiffPartText}
          </del>
        ) : (
          <ins key={textDiffPartIndex} className="papeliz-text-diff-added">
            {textDiffPart.textDiffPartText}
          </ins>
        ),
      )}
    </div>
  )
}

interface PapelizAssistantProposalCardProps {
  assistantProposalId: string
}

// The notes and folders a delete proposal moves to `.trash`, each folder with how many notes it holds.
function PapelizTrashedVaultEntryList({ trashedVaultEntryRelativePaths }: { trashedVaultEntryRelativePaths: readonly string[] }) {
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  return (
    <ul className="flex flex-col gap-1">
      {trashedVaultEntryRelativePaths.map((trashedVaultEntryRelativePath) => {
        const isTrashedNote = isVaultNoteFileName(trashedVaultEntryRelativePath)
        const folderNoteCount = isTrashedNote
          ? 0
          : vaultTreeEntries.filter(
              (vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note' && isVaultRelativePathInsideFolder(vaultTreeEntry.vaultEntryRelativePath, trashedVaultEntryRelativePath),
            ).length
        const TrashedVaultEntryIcon = isTrashedNote ? FileText : Folder
        return (
          <li key={trashedVaultEntryRelativePath} className="flex min-w-0 items-center gap-2 text-[13.5px]" title={trashedVaultEntryRelativePath}>
            <TrashedVaultEntryIcon className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
            <span className="truncate font-medium">{getVaultNoteTitle(trashedVaultEntryRelativePath)}</span>
            {!isTrashedNote && (
              <span className="flex-none text-[12px] text-papeliz-ink-subtle">
                {folderNoteCount} {folderNoteCount === 1 ? 'note' : 'notes'}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// A change the assistant wants to make, as a diff (or, to delete, the list of what moves to the
// trash). Nothing is written until Accept. View shows an edit or a new note whole, read-only.
export function PapelizAssistantProposalCard({ assistantProposalId }: PapelizAssistantProposalCardProps) {
  const assistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantProposalsById[assistantProposalId])
  const acceptAssistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.acceptAssistantProposal)
  const rejectAssistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.rejectAssistantProposal)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const previewAssistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.previewAssistantProposal)

  const proposalDiffs = useMemo(() => {
    if (assistantProposal === undefined) return []
    if (assistantProposal.assistantProposalKind === 'create-note') return [diffPapelizTextByWords('', assistantProposal.newVaultNoteText)]
    return assistantProposal.vaultNoteTextEdits.map((vaultNoteTextEdit) =>
      vaultNoteTextEdit.findText.length === 0
        ? diffPapelizTextByWords('', vaultNoteTextEdit.replaceWithText)
        : diffPapelizTextByWords(vaultNoteTextEdit.findText, vaultNoteTextEdit.replaceWithText),
    )
  }, [assistantProposal])

  if (assistantProposal === undefined) return null
  const isCreateProposal = assistantProposal.assistantProposalKind === 'create-note'
  const isTrashProposal = assistantProposal.assistantProposalKind === 'trash-entries'
  const ProposalIcon = isTrashProposal ? Trash2 : isCreateProposal ? FilePlus : FileText
  const trashedEntryCount = assistantProposal.trashedVaultEntryRelativePaths.length

  return (
    <div className="papeliz-pop-enter flex-none overflow-hidden rounded-[18px] border border-papeliz-line bg-papeliz-surface shadow-papeliz-card">
      <div className="flex items-center gap-2 border-b border-papeliz-line px-3.5 py-2.5 text-[13px] text-papeliz-ink-muted">
        <ProposalIcon className={isTrashProposal ? 'size-4 flex-none text-papeliz-error-notice-icon' : 'size-4 flex-none text-papeliz-blue'} aria-hidden="true" />
        {isTrashProposal ? (
          <span className="min-w-0 font-semibold text-papeliz-ink">
            Delete {trashedEntryCount} {trashedEntryCount === 1 ? 'item' : 'items'}
          </span>
        ) : (
          <span className="min-w-0">
            {isCreateProposal ? 'New note ' : 'Edit '}
            <button
              type="button"
              className="font-semibold text-papeliz-ink hover:underline disabled:no-underline"
              disabled={isCreateProposal && assistantProposal.proposalStatus !== 'accepted'}
              onClick={() => void openVaultNote(assistantProposal.vaultNoteRelativePath)}
              title={assistantProposal.vaultNoteRelativePath}
            >
              {getVaultNoteTitle(assistantProposal.vaultNoteRelativePath)}
            </button>
          </span>
        )}
        {!isTrashProposal && assistantProposal.proposalStatus === 'pending' && (
          <button
            type="button"
            onClick={() => previewAssistantProposal(assistantProposalId)}
            title="See the whole note as it would be, read-only"
            className="ml-auto flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-medium text-papeliz-blue hover:bg-papeliz-blue-soft"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            View
          </button>
        )}
      </div>
      {assistantProposal.proposalReason.length > 0 && <p className="px-3.5 pt-2.5 text-[13px] text-papeliz-ink-muted">{assistantProposal.proposalReason}</p>}
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-3.5 py-2.5 text-[14px] leading-relaxed">
        {isTrashProposal ? (
          <>
            <PapelizTrashedVaultEntryList trashedVaultEntryRelativePaths={assistantProposal.trashedVaultEntryRelativePaths} />
            <p className="text-[12.5px] text-papeliz-ink-subtle">They move into this vault’s .trash folder, so nothing is erased.</p>
          </>
        ) : (
          proposalDiffs.map((textDiffParts, proposalDiffIndex) => (
            <div key={proposalDiffIndex} className={proposalDiffIndex > 0 ? 'border-t border-dashed border-papeliz-line pt-2' : undefined}>
              <PapelizTextDiffView textDiffParts={textDiffParts} />
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-papeliz-line bg-papeliz-surface-soft px-3.5 py-2.5">
        {assistantProposal.proposalStatus === 'pending' && (
          <>
            <PapelizPillButton
              pillButtonVariant={isTrashProposal ? 'red-primary' : 'primary'}
              pillButtonSize="small"
              onClick={() => void acceptAssistantProposal(assistantProposalId)}
            >
              {isTrashProposal ? <Trash2 className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
              {isTrashProposal ? 'Move to Trash' : isCreateProposal ? 'Create note' : 'Accept'}
            </PapelizPillButton>
            <PapelizPillButton pillButtonSize="small" onClick={() => rejectAssistantProposal(assistantProposalId)}>
              Reject
            </PapelizPillButton>
          </>
        )}
        {assistantProposal.proposalStatus === 'accepted' && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-papeliz-diff-added-ink">
            <Check className="size-3.5" aria-hidden="true" /> {isTrashProposal ? 'Moved to .trash' : isCreateProposal ? 'Created' : 'Accepted'}
          </span>
        )}
        {assistantProposal.proposalStatus === 'rejected' && (
          <span className="flex items-center gap-1.5 text-[13px] text-papeliz-ink-subtle">
            <X className="size-3.5" aria-hidden="true" /> Rejected
          </span>
        )}
        {assistantProposal.proposalStatus === 'failed' && (
          <span role="alert" className="flex items-center gap-1.5 text-[13px] text-papeliz-diff-removed-ink">
            <CircleAlert className="size-3.5 flex-none" aria-hidden="true" /> Not applied: {assistantProposal.proposalProblem}
          </span>
        )}
      </div>
    </div>
  )
}
