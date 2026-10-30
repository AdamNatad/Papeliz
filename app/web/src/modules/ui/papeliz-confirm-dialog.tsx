import { useEffect, useRef, type ReactNode } from 'react'
import { PapelizPillButton } from './papeliz-buttons'

interface PapelizConfirmDialogProps {
  confirmDialogTitle: string
  confirmDialogBody: ReactNode
  confirmButtonLabel: string
  // Red for an action that erases something for good.
  isConfirmActionDangerous?: boolean
  // Holds the action back until the body's own condition is met (a typed name, say).
  isConfirmButtonDisabled?: boolean
  // A second, harmless action beside the main one (Download backup before Close vault, say).
  confirmDialogSecondaryAction?: { secondaryActionLabel: string; isSecondaryActionDisabled?: boolean; onSecondaryActionSelect: () => void }
  onConfirm: () => void
  onCancel: () => void
}

// A modal question with one action and Cancel, on the browser's own <dialog> (focus stays inside,
// Esc cancels). Focus starts on Cancel, so Enter never confirms a destructive action by accident.
export function PapelizConfirmDialog({
  confirmDialogTitle,
  confirmDialogBody,
  confirmButtonLabel,
  isConfirmActionDangerous = false,
  isConfirmButtonDisabled = false,
  confirmDialogSecondaryAction,
  onConfirm,
  onCancel,
}: PapelizConfirmDialogProps) {
  const confirmDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const confirmDialogElement = confirmDialogRef.current
    if (confirmDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    confirmDialogElement.showModal()
    return () => {
      confirmDialogElement.close()
      if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
        focusedBeforeDialog.focus()
      }
    }
  }, [])

  return (
    <dialog
      ref={confirmDialogRef}
      aria-labelledby="papeliz-confirm-dialog-title"
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onCancel()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === confirmDialogRef.current) onCancel()
      }}
      className="papeliz-dialog-enter m-auto w-[min(440px,calc(100vw-32px))] rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="p-6">
        <h2 id="papeliz-confirm-dialog-title" className="text-lg font-semibold">
          {confirmDialogTitle}
        </h2>
        <div className="mt-2 text-[15px] text-papeliz-ink-muted">{confirmDialogBody}</div>
        {/* Cancel at the left edge, the action at the right, so the two never sit side by side. */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <PapelizPillButton pillButtonVariant="red-primary" onClick={onCancel}>
            Cancel
          </PapelizPillButton>
          <span className="flex flex-wrap items-center justify-end gap-2">
            {confirmDialogSecondaryAction !== undefined && (
              <PapelizPillButton
                pillButtonVariant="line"
                disabled={confirmDialogSecondaryAction.isSecondaryActionDisabled}
                onClick={confirmDialogSecondaryAction.onSecondaryActionSelect}
              >
                {confirmDialogSecondaryAction.secondaryActionLabel}
              </PapelizPillButton>
            )}
            <PapelizPillButton pillButtonVariant={isConfirmActionDangerous ? 'danger' : 'primary'} disabled={isConfirmButtonDisabled} onClick={onConfirm}>
              {confirmButtonLabel}
            </PapelizPillButton>
          </span>
        </div>
      </div>
    </dialog>
  )
}
