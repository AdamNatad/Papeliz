import { CircleAlert, Info, X } from 'lucide-react'
import { useEffect } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

const papelizInfoNoticeDurationMilliseconds = 5000
const papelizErrorNoticeDurationMilliseconds = 9000

interface PapelizWorkspaceNoticeProps {
  // The docked Assistant panel's width, when it shows: the toast keeps left of it, so the panel's
  // own buttons stay in reach.
  dockedAssistantPanelWidth?: number | null
}

// A short message at the top right, just under the topbar ("Moved “Inbox.md” to .trash/Inbox.md"),
// in the workspace and on the start screen, with a button such as Try again when there is one. An
// error's toast is red.
export function PapelizWorkspaceNotice({ dockedAssistantPanelWidth = null }: PapelizWorkspaceNoticeProps) {
  const workspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.workspaceNotice)
  const dismissWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.dismissWorkspaceNotice)

  useEffect(() => {
    if (workspaceNotice === null) return
    const dismissTimer = setTimeout(
      dismissWorkspaceNotice,
      workspaceNotice.workspaceNoticeKind === 'error' ? papelizErrorNoticeDurationMilliseconds : papelizInfoNoticeDurationMilliseconds,
    )
    return () => clearTimeout(dismissTimer)
  }, [workspaceNotice, dismissWorkspaceNotice])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-[60px] z-40 flex justify-end pl-4"
      style={{ right: dockedAssistantPanelWidth === null ? 16 : `calc(min(${dockedAssistantPanelWidth}px, 45vw) + 16px)` }}
    >
      {workspaceNotice !== null && (
        <div
          key={workspaceNotice.workspaceNoticeId}
          role={workspaceNotice.workspaceNoticeKind === 'error' ? 'alert' : 'status'}
          className={joinPapelizClassNames(
            'papeliz-notice-enter-from-right pointer-events-auto flex w-max max-w-[min(420px,calc(100vw-32px))] items-center gap-2.5 rounded-[12px] border py-1.5 pr-1.5 pl-3.5 text-[13px] leading-snug shadow-papeliz-pop',
            workspaceNotice.workspaceNoticeKind === 'error'
              ? 'border-papeliz-error-notice-line bg-papeliz-error-notice-ground font-medium text-papeliz-error-notice-ink'
              : 'border-papeliz-line bg-papeliz-surface text-papeliz-ink',
          )}
        >
          {workspaceNotice.workspaceNoticeKind === 'error' ? (
            <CircleAlert className="size-4 flex-none text-papeliz-error-notice-icon" aria-hidden="true" />
          ) : (
            <Info className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
          )}
          <span className="min-w-0">{workspaceNotice.workspaceNoticeMessage}</span>
          {workspaceNotice.workspaceNoticeAction !== null && (
            <PapelizPillButton
              pillButtonVariant={workspaceNotice.workspaceNoticeKind === 'error' ? 'on-error-notice' : 'line'}
              pillButtonSize="small"
              onClick={() => {
                workspaceNotice.workspaceNoticeAction?.onWorkspaceNoticeAction()
                dismissWorkspaceNotice()
              }}
            >
              {workspaceNotice.workspaceNoticeAction.workspaceNoticeActionLabel}
            </PapelizPillButton>
          )}
          <PapelizIconButton
            iconButtonLabel="Dismiss"
            iconButtonSize="small"
            iconButtonTone={workspaceNotice.workspaceNoticeKind === 'error' ? 'error-notice' : 'surface'}
            onClick={dismissWorkspaceNotice}
          >
            <X className="size-[14px]" aria-hidden="true" />
          </PapelizIconButton>
        </div>
      )}
    </div>
  )
}
