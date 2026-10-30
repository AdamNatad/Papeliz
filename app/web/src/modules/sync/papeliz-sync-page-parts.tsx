import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

// The small pieces the gear's Account and Sync pages and Sync's dialogs share, in the gear's look.

export function PapelizSyncPageLabel({ children, isFirstLabel = false }: { children: ReactNode; isFirstLabel?: boolean }) {
  return <p className={`${isFirstLabel ? '' : 'mt-3.5 '}mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle`}>{children}</p>
}

export function PapelizSyncPageTitle({ children, pageTitleChip }: { children: ReactNode; pageTitleChip?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 text-[15px] font-semibold">{children}</p>
      {pageTitleChip}
    </div>
  )
}

export function PapelizSyncPageText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={joinPapelizClassNames('text-[12.5px] leading-[1.45] text-papeliz-ink-muted', className)}>{children}</p>
}

export function PapelizSyncPageSmallText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={joinPapelizClassNames('text-[11.5px] leading-[1.4] text-papeliz-ink-subtle', className)}>{children}</p>
}

// Paid Add-on in green, a plan in blue: the chips of the gear's earlier Sync page.
export function PapelizSyncChip({ syncChipTone, children }: { syncChipTone: 'paid' | 'plan'; children: ReactNode }) {
  return (
    <span
      className={joinPapelizClassNames(
        'inline-flex h-[22px] flex-none items-center rounded-full border px-2.5 text-[11.5px] font-semibold',
        syncChipTone === 'paid' ? 'border-papeliz-ok/45 bg-papeliz-ok/12 text-papeliz-ok' : 'border-papeliz-blue-line bg-papeliz-blue-soft text-papeliz-blue',
      )}
    >
      {children}
    </span>
  )
}

export function PapelizSyncPageBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={joinPapelizClassNames('divide-y divide-papeliz-line overflow-hidden rounded-xl border border-papeliz-line bg-papeliz-surface', className)}>{children}</div>
}

interface PapelizSyncPageRowProps {
  SyncPageRowIcon?: LucideIcon
  syncPageRowTitle: ReactNode
  syncPageRowDetail?: ReactNode
  syncPageRowEnd?: ReactNode
  className?: string
}

export function PapelizSyncPageRow({ SyncPageRowIcon, syncPageRowTitle, syncPageRowDetail, syncPageRowEnd, className }: PapelizSyncPageRowProps) {
  return (
    <div className={joinPapelizClassNames('flex min-h-11 items-center gap-2.5 px-3 py-2', className)}>
      {SyncPageRowIcon !== undefined && <SyncPageRowIcon className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium">{syncPageRowTitle}</div>
        {syncPageRowDetail !== undefined && <div className="text-[11.5px] leading-[1.35] text-papeliz-ink-subtle">{syncPageRowDetail}</div>}
      </div>
      {syncPageRowEnd}
    </div>
  )
}

interface PapelizSyncSwitchProps {
  syncSwitchLabel: string
  isSyncSwitchOn: boolean
  isSyncSwitchDisabled?: boolean
  onSyncSwitchToggle: () => void
}

// The gear's switch (Lock All Notes, Focus Mode), for one setting.
export function PapelizSyncSwitch({ syncSwitchLabel, isSyncSwitchOn, isSyncSwitchDisabled = false, onSyncSwitchToggle }: PapelizSyncSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSyncSwitchOn}
      aria-label={syncSwitchLabel}
      disabled={isSyncSwitchDisabled}
      onClick={onSyncSwitchToggle}
      className="grid h-6 flex-none place-items-center rounded-full px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={joinPapelizClassNames(
          'relative h-4 w-7 rounded-full transition-colors after:absolute after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgb(17_17_18/0.25)] after:transition-[left] after:duration-150',
          isSyncSwitchOn ? 'bg-papeliz-blue after:left-3.5' : 'bg-papeliz-line-strong after:left-0.5',
        )}
      />
    </button>
  )
}

export function PapelizSyncFailureLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={joinPapelizClassNames('text-[12px] leading-[1.4] text-papeliz-diff-removed-ink', className)}>
      {children}
    </p>
  )
}

// A note in the page about something to act on: storage full, a payment, a pause.
export function PapelizSyncPageNotice({ children, syncPageNoticeAction }: { children: ReactNode; syncPageNoticeAction?: ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-papeliz-warning-ink/25 bg-papeliz-warning px-3 py-2.5 text-[12px] leading-[1.45] text-papeliz-warning-ink">
      <div>{children}</div>
      {syncPageNoticeAction !== undefined && <div className="mt-2 flex flex-wrap gap-2">{syncPageNoticeAction}</div>}
    </div>
  )
}

export function PapelizSyncLoadingLine({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 py-2 text-[12.5px] text-papeliz-ink-subtle">
      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      {children}
    </p>
  )
}

// A link-like button inside a sentence, as Reset Text Settings and Select all are.
export function PapelizSyncTextButton({ children, onClick, disabled = false, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={joinPapelizClassNames('font-semibold text-papeliz-blue hover:underline disabled:opacity-40', className)}>
      {children}
    </button>
  )
}

interface PapelizSyncDialogFrameProps {
  syncDialogTitleId: string
  SyncDialogIcon: LucideIcon
  syncDialogTitle: ReactNode
  syncDialogIntro?: ReactNode
  // Above the title: the set-up dialog's steps.
  syncDialogSteps?: ReactNode
  children?: ReactNode
  syncDialogFooter: ReactNode
  // Esc. A click on the backdrop never closes these dialogs, so a stray click loses nothing.
  onSyncDialogCancel: () => void
  // Inside the Settings gear on the start page the dialog stays in the gear's own tree, so a click in
  // it doesn't count as a click outside the gear. Everywhere else it is drawn on the page body.
  isSyncDialogDrawnInPlace: boolean
  syncDialogWidthClassName?: string
}

// Sync's dialogs, on the browser's own <dialog> like the app's other dialogs.
export function PapelizSyncDialogFrame({
  syncDialogTitleId,
  SyncDialogIcon,
  syncDialogTitle,
  syncDialogIntro,
  syncDialogSteps,
  children,
  syncDialogFooter,
  onSyncDialogCancel,
  isSyncDialogDrawnInPlace,
  syncDialogWidthClassName = 'w-[min(520px,calc(100vw-32px))]',
}: PapelizSyncDialogFrameProps) {
  const syncDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const syncDialogElement = syncDialogRef.current
    if (syncDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    syncDialogElement.showModal()
    return () => {
      syncDialogElement.close()
      if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) focusedBeforeDialog.focus()
    }
  }, [])

  const syncDialog = (
    <dialog
      ref={syncDialogRef}
      aria-labelledby={syncDialogTitleId}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') return
        // Handled here, so the gear behind doesn't close on the same Esc.
        keyboardEvent.preventDefault()
        keyboardEvent.stopPropagation()
        onSyncDialogCancel()
      }}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onSyncDialogCancel()
      }}
      className={joinPapelizClassNames(
        'papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] overflow-y-auto rounded-3xl border border-papeliz-line bg-papeliz-surface p-6 text-left text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop max-sm:p-5',
        syncDialogWidthClassName,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
          <SyncDialogIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {syncDialogSteps}
          <h2 id={syncDialogTitleId} className={joinPapelizClassNames('text-lg leading-snug font-semibold', syncDialogSteps !== undefined && 'mt-1.5')}>
            {syncDialogTitle}
          </h2>
          {syncDialogIntro !== undefined && <div className="mt-1 text-sm leading-[1.45] text-papeliz-ink-muted">{syncDialogIntro}</div>}
        </div>
      </div>
      {children}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{syncDialogFooter}</div>
    </dialog>
  )
  return isSyncDialogDrawnInPlace ? syncDialog : createPortal(syncDialog, document.body)
}

// The set-up dialog's steps: done, this one, still to come.
export function PapelizSyncDialogSteps({ syncDialogStepLabels, currentSyncDialogStepIndex }: { syncDialogStepLabels: readonly string[]; currentSyncDialogStepIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] font-semibold text-papeliz-ink-subtle" aria-label="Steps">
      {syncDialogStepLabels.map((syncDialogStepLabel, syncDialogStepIndex) => (
        <li key={syncDialogStepLabel} className="flex items-center gap-1.5" aria-current={syncDialogStepIndex === currentSyncDialogStepIndex ? 'step' : undefined}>
          {syncDialogStepIndex > 0 && <span aria-hidden="true" className="h-px w-3 bg-papeliz-line-strong" />}
          <span
            className={joinPapelizClassNames(
              syncDialogStepIndex < currentSyncDialogStepIndex && 'text-papeliz-ok',
              syncDialogStepIndex === currentSyncDialogStepIndex && 'text-papeliz-blue',
            )}
          >
            {syncDialogStepIndex < currentSyncDialogStepIndex ? '✓' : syncDialogStepIndex + 1} {syncDialogStepLabel}
          </span>
        </li>
      ))}
    </ol>
  )
}

// How far a first upload, download or Connect has come.
export function PapelizSyncProgressBar({ syncProgressFraction, syncProgressLabel }: { syncProgressFraction: number; syncProgressLabel: string }) {
  const syncProgressPercent = Math.round(Math.min(1, Math.max(0, syncProgressFraction)) * 100)
  return (
    <div role="progressbar" aria-label={syncProgressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={syncProgressPercent} className="h-1.5 overflow-hidden rounded-full bg-papeliz-surface-gray">
      <span className="block h-full rounded-full bg-papeliz-blue transition-[width] duration-300" style={{ width: `${syncProgressPercent}%` }} />
    </div>
  )
}
