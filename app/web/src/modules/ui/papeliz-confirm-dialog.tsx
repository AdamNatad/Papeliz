import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PapelizPillButton } from './papeliz-buttons'
import { givePapelizFocusBackWithTitleHeldBack } from './papeliz-focus-back-with-title-held-back'

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
  // What focus goes back to when the dialog closes: read once, before the dialog takes focus (an
  // effect that runs again, as React's development checks do, would find the dialog's own button). A
  // dialog opened from a menu finds what the menu gave focus back to before its item ran
  // (papeliz-popover-menu.tsx).
  const [focusedBeforeDialog] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null))

  useEffect(() => {
    const confirmDialogElement = confirmDialogRef.current
    if (confirmDialogElement === null) return
    confirmDialogElement.showModal()
    return () => {
      // The browser may give focus back as the dialog closes; otherwise it goes back here.
      const giveFocusBack = () => {
        confirmDialogElement.close()
        if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
          focusedBeforeDialog.focus()
        }
      }
      if (focusedBeforeDialog?.isConnected) givePapelizFocusBackWithTitleHeldBack(focusedBeforeDialog, giveFocusBack)
      else giveFocusBack()
    }
  }, [focusedBeforeDialog])

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
          <PapelizPillButton pillButtonVariant="dialog-cancel" className="min-w-28" onClick={onCancel}>
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
            <PapelizPillButton
              pillButtonVariant={isConfirmActionDangerous ? 'dialog-confirm-danger' : 'dialog-confirm'}
              className="min-w-28"
              disabled={isConfirmButtonDisabled}
              onClick={onConfirm}
            >
              {confirmButtonLabel}
            </PapelizPillButton>
          </span>
        </div>
      </div>
    </dialog>
  )
}
