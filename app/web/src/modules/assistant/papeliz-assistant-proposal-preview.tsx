import { Check, Eye } from 'lucide-react'
import { useMemo } from 'react'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizMdViewRenderedPage } from '../md-view/papeliz-md-view-rendered-page'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'

// An AI Assistant proposal shown whole, as MD View draws it, in place of the open note: what the
// note would read once accepted (or the new note). It is read-only and held in memory; Accept and
// Reject decide it here as on its card, and either closes the preview.
export function PapelizAssistantProposalPreview() {
  const assistantProposalPreview = usePapelizWorkspaceStore((workspaceState) => workspaceState.assistantProposalPreview)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const assistantProposal = usePapelizAssistantConversationStore((conversationState) =>
    assistantProposalPreview === null ? undefined : conversationState.assistantProposalsById[assistantProposalPreview.previewedAssistantProposalId],
  )
  const acceptAssistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.acceptAssistantProposal)
  const rejectAssistantProposal = usePapelizAssistantConversationStore((conversationState) => conversationState.rejectAssistantProposal)
  const resolveWikilinkTarget = useMemo(
    () =>
      createPapelizWikilinkTargetResolver(
        vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
      ),
    [vaultTreeEntries],
  )

  if (assistantProposalPreview === null) return null
  const isCreateProposal = assistantProposal?.assistantProposalKind === 'create-note'
  const previewedVaultNoteRelativePath = assistantProposalPreview.previewedVaultNoteRelativePath

  return (
    <div
      id="papeliz-assistant-proposal-preview"
      role="region"
      aria-label={`Proposed ${getVaultNoteTitle(previewedVaultNoteRelativePath)}, read-only`}
      className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-24 sm:px-10 sm:pt-[30px]"
    >
      <div
        className="papeliz-pop-enter mx-auto mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-papeliz-blue-soft px-4 py-3 text-[13.5px] text-papeliz-ink"
        style={{ maxWidth: 'calc(var(--papeliz-note-column-width) + 60px)' }}
      >
        <Eye className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">{isCreateProposal ? 'Proposed new note' : 'Proposed edit'}</b>, read-only. Nothing is written until you accept.
        </span>
        {assistantProposal?.proposalStatus === 'pending' && (
          <span className="flex flex-none gap-2">
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => void acceptAssistantProposal(assistantProposal.assistantProposalId)}>
              <Check className="size-3.5" aria-hidden="true" />
              {isCreateProposal ? 'Create note' : 'Accept'}
            </PapelizPillButton>
            <PapelizPillButton pillButtonSize="small" onClick={() => rejectAssistantProposal(assistantProposal.assistantProposalId)}>
              Reject
            </PapelizPillButton>
          </span>
        )}
      </div>
      <div className="papeliz-note-view-enter">
        <PapelizMdViewRenderedPage
          vaultNoteText={assistantProposalPreview.previewedVaultNoteText}
          vaultNoteRelativePath={previewedVaultNoteRelativePath}
          resolveWikilinkTarget={resolveWikilinkTarget}
          onWikilinkActivate={(wikilinkTargetNoteName) => {
            const linkedVaultNoteRelativePath = resolveWikilinkTarget(wikilinkTargetNoteName, previewedVaultNoteRelativePath)
            if (linkedVaultNoteRelativePath !== null) void openVaultNote(linkedVaultNoteRelativePath)
          }}
          onRelativeNoteLinkActivate={() => undefined}
        />
      </div>
    </div>
  )
}
