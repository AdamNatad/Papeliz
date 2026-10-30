import { FileQuestion, GitMerge } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import type { PapelizVaultNoteMergeChoice } from '../vault/papeliz-vault-note-merge'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import type { PapelizVaultNoteSaveConflict } from './papeliz-workspace-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// A clash with another device through Papeliz Sync: the dialog names that device ("On Phone"), and
// Save hands the choices to Sync instead of saving this tab's note.
export interface PapelizSyncNoteClashOtherDevice {
  otherSyncDeviceName: string | null
  onSyncNoteClashSave: (mergeChoicesByConflictId: Record<string, PapelizVaultNoteMergeChoice>) => void
}

type PapelizNoteSaveConflictDialogProps = {
  vaultNoteSaveConflict: PapelizVaultNoteSaveConflict
  onSaveConflictDialogClose: () => void
} & ({ loadedNoteSessionId: number; syncNoteClashOtherDevice?: undefined } | { loadedNoteSessionId?: undefined; syncNoteClashOtherDevice: PapelizSyncNoteClashOtherDevice })

function listMergeChoices(otherSideKeepLabel: string): ReadonlyArray<{ vaultNoteMergeChoice: PapelizVaultNoteMergeChoice; mergeChoiceLabel: string }> {
  return [
    { vaultNoteMergeChoice: 'both', mergeChoiceLabel: 'Keep both' },
    { vaultNoteMergeChoice: 'saved', mergeChoiceLabel: otherSideKeepLabel },
    { vaultNoteMergeChoice: 'mine', mergeChoiceLabel: 'Keep mine' },
  ]
}

// A save elsewhere (another tab, another app) that this tab's changes can't simply join. Either both
// changed the same lines: the parts that don't touch are already combined, and each clash shows the
// saved lines and this tab's, to keep both (the default, so nothing is lost), the saved ones or
// this tab's. Or the note was moved or trashed: Keep my copy writes it back, Close note lets this
// tab's changes go. Later closes the dialog; the note waits, unsaved, until it is settled. A Sync
// clash shows the other device's lines and this device's the same way.
export function PapelizNoteSaveConflictDialog({ loadedNoteSessionId, vaultNoteSaveConflict, onSaveConflictDialogClose, syncNoteClashOtherDevice }: PapelizNoteSaveConflictDialogProps) {
  const saveConflictDialogRef = useRef<HTMLDialogElement>(null)
  const resolveVaultNoteSaveConflict = usePapelizWorkspaceStore((workspaceState) => workspaceState.resolveVaultNoteSaveConflict)
  const resolveVaultNoteDeletedElsewhere = usePapelizWorkspaceStore((workspaceState) => workspaceState.resolveVaultNoteDeletedElsewhere)
  const [mergeChoicesByConflictId, setMergeChoicesByConflictId] = useState<Record<string, PapelizVaultNoteMergeChoice>>({})
  const isVaultNoteDeletedElsewhere = vaultNoteSaveConflict.vaultNoteSaveConflictKind === 'deleted-elsewhere'
  const mergeConflicts =
    vaultNoteSaveConflict.vaultNoteSaveConflictKind === 'same-lines-changed' && vaultNoteSaveConflict.vaultNoteMergeResult.mergeOutcome === 'conflict'
      ? vaultNoteSaveConflict.vaultNoteMergeResult.mergeConflicts
      : []
  const vaultNoteTitle = getVaultNoteTitle(vaultNoteSaveConflict.vaultNoteRelativePath)
  const SaveConflictIcon = isVaultNoteDeletedElsewhere ? FileQuestion : GitMerge
  const otherSyncDeviceName = syncNoteClashOtherDevice === undefined ? null : (syncNoteClashOtherDevice.otherSyncDeviceName ?? 'the other device')
  const papelizMergeChoices = listMergeChoices(
    syncNoteClashOtherDevice === undefined ? 'Keep saved' : syncNoteClashOtherDevice.otherSyncDeviceName === null ? 'Keep theirs' : `Keep ${syncNoteClashOtherDevice.otherSyncDeviceName}’s`,
  )

  useEffect(() => {
    const saveConflictDialogElement = saveConflictDialogRef.current
    if (saveConflictDialogElement === null) return
    saveConflictDialogElement.showModal()
    return () => saveConflictDialogElement.close()
  }, [])

  // Drawn on the page body, so it takes nothing from the status bar it is opened from.
  return createPortal(
    <dialog
      ref={saveConflictDialogRef}
      aria-labelledby="papeliz-note-save-conflict-title"
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onSaveConflictDialogClose()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(620px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-papeliz-line bg-papeliz-surface p-6 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
          <SaveConflictIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="papeliz-note-save-conflict-title" className="text-lg font-semibold">
            {isVaultNoteDeletedElsewhere
              ? `“${vaultNoteTitle}” was moved or deleted elsewhere`
              : otherSyncDeviceName === null
                ? `“${vaultNoteTitle}” changed elsewhere too`
                : `“${vaultNoteTitle}” changed on ${otherSyncDeviceName} too`}
          </h2>
          <p className="text-sm text-papeliz-ink-muted">
            {isVaultNoteDeletedElsewhere
              ? 'Another tab or app moved this note or put it in the trash while you had unsaved changes. Keep your copy to save it here again, or close it and let your changes go.'
              : otherSyncDeviceName === null
                ? 'Another tab or app saved this note while you were editing it. Papeliz combined the changes that don’t overlap. Where both changed the same lines, choose what to keep.'
                : `Papeliz combined the changes that don’t overlap. Where ${otherSyncDeviceName} and this device changed the same lines, choose what to keep.`}
          </p>
        </div>
      </div>

      <ol className={mergeConflicts.length > 0 ? 'mt-5 flex flex-col gap-4' : 'hidden'}>
        {mergeConflicts.map((mergeConflict, mergeConflictIndex) => (
          <li key={mergeConflict.mergeConflictId} className="rounded-2xl border border-papeliz-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-papeliz-line px-3.5 py-2">
              <span className="text-[13px] font-semibold">
                {mergeConflicts.length > 1 ? `Change ${mergeConflictIndex + 1} of ${mergeConflicts.length}` : 'The lines both changed'}
              </span>
              <PapelizSlidingChoiceGroup
                slidingChoiceGroupLabel={`What to keep, change ${mergeConflictIndex + 1}`}
                slidingChoiceGroupRole="radiogroup"
                slidingChoiceGroupTone="solid-blue"
                slidingChoiceGroupClassName="w-[300px] max-w-full"
                chosenSlidingChoiceValue={mergeChoicesByConflictId[mergeConflict.mergeConflictId] ?? 'both'}
                onSlidingChoiceSelect={(vaultNoteMergeChoice) =>
                  setMergeChoicesByConflictId((currentChoices) => ({ ...currentChoices, [mergeConflict.mergeConflictId]: vaultNoteMergeChoice }))
                }
                slidingChoices={papelizMergeChoices.map(({ vaultNoteMergeChoice, mergeChoiceLabel }) => ({
                  slidingChoiceValue: vaultNoteMergeChoice,
                  slidingChoiceContent: mergeChoiceLabel,
                }))}
              />
            </div>
            <div className="grid gap-px bg-papeliz-line sm:grid-cols-2">
              {(
                [
                  [otherSyncDeviceName === null ? 'Saved' : `On ${otherSyncDeviceName}`, mergeConflict.savedText],
                  [otherSyncDeviceName === null ? 'Yours' : 'On this device', mergeConflict.myText],
                ] as const
              ).map(([mergeSideLabel, mergeSideText]) => (
                <div key={mergeSideLabel} className="bg-papeliz-surface px-3.5 py-2.5">
                  <p className="text-[11.5px] font-semibold text-papeliz-ink-subtle">{mergeSideLabel}</p>
                  <pre className="papeliz-selectable-text mt-1 max-h-48 overflow-y-auto font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
                    {mergeSideText.length > 0 ? mergeSideText : <span className="text-papeliz-ink-subtle italic">(removed)</span>}
                  </pre>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <PapelizPillButton pillButtonVariant="gray" onClick={onSaveConflictDialogClose}>
          Later
        </PapelizPillButton>
        {isVaultNoteDeletedElsewhere && loadedNoteSessionId !== undefined ? (
          <>
            <PapelizPillButton
              pillButtonVariant="gray"
              onClick={() => {
                onSaveConflictDialogClose()
                void resolveVaultNoteDeletedElsewhere(loadedNoteSessionId, 'close-note')
              }}
            >
              Close note
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="primary"
              onClick={() => {
                onSaveConflictDialogClose()
                void resolveVaultNoteDeletedElsewhere(loadedNoteSessionId, 'keep-my-copy')
              }}
            >
              Keep my copy
            </PapelizPillButton>
          </>
        ) : (
          <PapelizPillButton
            pillButtonVariant="primary"
            onClick={() => {
              onSaveConflictDialogClose()
              if (syncNoteClashOtherDevice !== undefined) syncNoteClashOtherDevice.onSyncNoteClashSave(mergeChoicesByConflictId)
              else if (loadedNoteSessionId !== undefined) void resolveVaultNoteSaveConflict(loadedNoteSessionId, mergeChoicesByConflictId)
            }}
          >
            Save
          </PapelizPillButton>
        )}
      </div>
    </dialog>,
    document.body,
  )
}
