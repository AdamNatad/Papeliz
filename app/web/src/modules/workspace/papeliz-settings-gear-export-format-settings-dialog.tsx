import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'

interface PapelizSettingsGearExportFormatSettingsDialogProps {
  // "Word Settings", "Template Settings".
  exportFormatSettingsTitle: string
  ExportFormatSettingsIcon: LucideIcon
  onExportFormatSettingsClose: () => void
  children: ReactNode
}

// One export format's settings (papeliz-settings-gear-export-page.tsx), opened by the gear on its row:
// a modal on the browser's own <dialog> over the Settings panel, its settings kept as they change, and
// Done to close. Esc and a press outside close it too, and only it: the panel stays open under it.
export function PapelizSettingsGearExportFormatSettingsDialog({
  exportFormatSettingsTitle,
  ExportFormatSettingsIcon,
  onExportFormatSettingsClose,
  children,
}: PapelizSettingsGearExportFormatSettingsDialogProps) {
  const exportFormatSettingsDialogRef = useRef<HTMLDialogElement>(null)
  const exportFormatSettingsTitleId = useId()

  // Shown as a modal; focus goes back to the gear that opened it, unless something else took it meanwhile.
  useEffect(() => {
    const exportFormatSettingsDialogElement = exportFormatSettingsDialogRef.current
    if (exportFormatSettingsDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    exportFormatSettingsDialogElement.showModal()
    return () => {
      exportFormatSettingsDialogElement.close()
      if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
        focusedBeforeDialog.focus()
      }
    }
  }, [])

  return (
    <dialog
      ref={exportFormatSettingsDialogRef}
      aria-labelledby={exportFormatSettingsTitleId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onExportFormatSettingsClose()
      }}
      onKeyDown={(keyboardEvent) => {
        // Handled here, before the panel's own Esc, which then leaves the panel open. A list open
        // inside the dialog closes itself first and stops the key.
        if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return
        keyboardEvent.preventDefault()
        onExportFormatSettingsClose()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === exportFormatSettingsDialogRef.current) onExportFormatSettingsClose()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(460px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="flex items-center gap-2.5 border-b border-papeliz-line px-4 py-3">
        <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-lg bg-papeliz-chosen-tab-ground text-white">
          <ExportFormatSettingsIcon className="size-4" />
        </span>
        <h2 id={exportFormatSettingsTitleId} className="min-w-0 truncate text-sm font-semibold">
          {exportFormatSettingsTitle}
        </h2>
      </div>
      <div className="p-4">{children}</div>
      <div className="flex justify-end border-t border-papeliz-line px-4 py-3">
        <PapelizPillButton pillButtonVariant="dialog-confirm" className="min-w-28" onClick={onExportFormatSettingsClose}>
          Done
        </PapelizPillButton>
      </div>
    </dialog>
  )
}
