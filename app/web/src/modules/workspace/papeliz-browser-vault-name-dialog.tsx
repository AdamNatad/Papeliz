import { Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizSolidCircleCheckIcon, PapelizSolidCircleXIcon } from '../ui/papeliz-solid-circle-icons'
import { findPapelizBrowserVaultNameProblem, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { PapelizBrowserVaultNameField } from './papeliz-browser-vault-name-field'

// Cancel and Rename: flat, square-cornered and one width (the footer's ref sets it).
const browserVaultNameDialogFooterButtonClassName =
  'inline-flex h-7 flex-none items-center justify-center gap-1.5 rounded border border-black/10 px-2.5 text-xs font-medium whitespace-nowrap text-white transition-[filter,transform] duration-150 ease-out hover:brightness-[.94] active:scale-[.99] disabled:pointer-events-none disabled:opacity-50'

interface PapelizBrowserVaultNameDialogProps {
  renamedBrowserVaultRecord: PapelizBrowserVaultRecord
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  onBrowserVaultRenameConfirm: (typedBrowserVaultName: string) => void
  onBrowserVaultRenameCancel: () => void
}

// Rename for a browser vault, on the browser's own <dialog> (focus stays inside, Esc cancels): a header
// with an icon tile, the Name field, and Cancel at the left edge with Rename at the right. Rename waits
// for a new name that can be used.
export function PapelizBrowserVaultNameDialog({
  renamedBrowserVaultRecord,
  existingBrowserVaultRecords,
  onBrowserVaultRenameConfirm,
  onBrowserVaultRenameCancel,
}: PapelizBrowserVaultNameDialogProps) {
  const browserVaultNameDialogRef = useRef<HTMLDialogElement>(null)
  const browserVaultNameInputRef = useRef<HTMLInputElement>(null)
  const browserVaultNameDialogFooterRef = usePapelizFooterEqualButtonWidthRef()
  const browserVaultNameDialogIdPrefix = useId()
  const browserVaultNameDialogTitleId = `${browserVaultNameDialogIdPrefix}-title`
  const [typedBrowserVaultName, setTypedBrowserVaultName] = useState(renamedBrowserVaultRecord.papelizVaultDisplayName)
  const browserVaultNameProblem = findPapelizBrowserVaultNameProblem(typedBrowserVaultName, existingBrowserVaultRecords, renamedBrowserVaultRecord.papelizVaultId)
  const isRenameUnchanged = typedBrowserVaultName.trim() === renamedBrowserVaultRecord.papelizVaultDisplayName

  // Shown as a modal; focus goes back to what had it before, unless something else took it meanwhile.
  useEffect(() => {
    const browserVaultNameDialogElement = browserVaultNameDialogRef.current
    if (browserVaultNameDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    browserVaultNameDialogElement.showModal()
    return () => {
      browserVaultNameDialogElement.close()
      if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
        focusedBeforeDialog.focus()
      }
    }
  }, [])

  // The name opens chosen, ready to type over. The effect above has shown the dialog by now.
  useEffect(() => {
    browserVaultNameInputRef.current?.focus()
    browserVaultNameInputRef.current?.select()
  }, [])

  const confirmBrowserVaultRename = () => {
    if (browserVaultNameProblem !== null || isRenameUnchanged) return
    onBrowserVaultRenameConfirm(typedBrowserVaultName.trim())
  }

  return (
    <dialog
      ref={browserVaultNameDialogRef}
      aria-labelledby={browserVaultNameDialogTitleId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onBrowserVaultRenameCancel()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === browserVaultNameDialogRef.current) onBrowserVaultRenameCancel()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(384px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-2xl backdrop:bg-papeliz-backdrop"
    >
      <div className="flex items-center gap-2.5 border-b border-papeliz-line px-4 py-3">
        <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-lg bg-papeliz-chosen-tab-ground text-white">
          <Pencil className="size-4" />
        </span>
        <h2 id={browserVaultNameDialogTitleId} className="min-w-0 truncate text-sm font-semibold">
          Rename “{renamedBrowserVaultRecord.papelizVaultDisplayName}”
        </h2>
      </div>

      <div className="p-4 text-[13px] leading-relaxed">
        <PapelizBrowserVaultNameField
          browserVaultNameInputRef={browserVaultNameInputRef}
          typedBrowserVaultName={typedBrowserVaultName}
          browserVaultNameProblem={browserVaultNameProblem}
          browserVaultNameProblemId={`${browserVaultNameDialogIdPrefix}-name-problem`}
          onBrowserVaultNameType={setTypedBrowserVaultName}
          onBrowserVaultNameSubmit={confirmBrowserVaultRename}
        />
      </div>

      {/* Cancel at the left edge, Rename at the right, so the two never sit side by side. */}
      <div ref={browserVaultNameDialogFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line px-4 py-3">
        <button
          type="button"
          onClick={onBrowserVaultRenameCancel}
          className={joinPapelizClassNames(browserVaultNameDialogFooterButtonClassName, 'bg-papeliz-red-gradient-start')}
        >
          <PapelizSolidCircleXIcon className="size-3.5 flex-none" />
          Cancel
        </button>
        <button
          type="button"
          disabled={browserVaultNameProblem !== null || isRenameUnchanged}
          onClick={confirmBrowserVaultRename}
          className={joinPapelizClassNames(browserVaultNameDialogFooterButtonClassName, 'bg-papeliz-chosen-tab-ground')}
        >
          <PapelizSolidCircleCheckIcon className="size-3.5 flex-none" />
          Rename
        </button>
      </div>
    </dialog>
  )
}
