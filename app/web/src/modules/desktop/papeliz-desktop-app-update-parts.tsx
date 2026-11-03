import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { CircleArrowDown, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizDesktopAppUpdateStore } from './papeliz-desktop-app-update-store'
import { usePapelizDesktopPlatformStore } from './papeliz-desktop-platform-store'

// The three places that say a newer Papeliz for Windows is ready (the toast, the gear's menu row and
// its dot, the status bar's line), and the gear's Updates page. Each shows only in a direct download
// of the desktop app, and only once a check found one. The web build gets stand-ins that show nothing,
// so it carries none of them.

// The newer version's number while one waits to be installed (or is being installed), otherwise null.
function usePapelizReadyDesktopAppUpdateVersionInDesktopApp(): string | null {
  return usePapelizDesktopAppUpdateStore((desktopAppUpdateState) =>
    desktopAppUpdateState.readyDesktopAppUpdate === null ? null : desktopAppUpdateState.readyDesktopAppUpdate.desktopAppUpdateVersion,
  )
}

// Whether this is a direct download of the desktop app, the one kind that checks for updates itself.
function useIsPapelizDesktopAppSelfUpdatingInDesktopApp(): boolean {
  return usePapelizDesktopPlatformStore((desktopPlatformState) => desktopPlatformState.papelizDesktopPlatform?.desktopAppDistribution === 'direct-download')
}

function describeDesktopAppUpdateInstallLabel(isDesktopAppUpdateInstalling: boolean): string {
  return isDesktopAppUpdateInstalling ? 'Restarting…' : 'Restart to Update'
}

// The toast, above the app's own notices at the bottom right, once per start: "Papeliz 0.2.0 is
// ready." with Restart to Update. It stays until pressed or closed.
function PapelizDesktopAppUpdateToastInDesktopApp() {
  const readyDesktopAppUpdateVersion = usePapelizReadyDesktopAppUpdateVersionInDesktopApp()
  const desktopAppUpdateCheckState = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.desktopAppUpdateCheckState)
  const isDesktopAppUpdateToastClosed = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.isDesktopAppUpdateToastClosed)
  const installReadyDesktopAppUpdate = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.installReadyDesktopAppUpdate)
  const closeDesktopAppUpdateToast = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.closeDesktopAppUpdateToast)
  if (readyDesktopAppUpdateVersion === null || isDesktopAppUpdateToastClosed) return null
  const isDesktopAppUpdateInstalling = desktopAppUpdateCheckState === 'installing'
  return (
    <div
      role="status"
      className="papeliz-notice-enter pointer-events-auto flex w-max max-w-[min(420px,calc(100vw-32px))] items-center gap-2.5 rounded-[12px] border border-papeliz-line bg-papeliz-surface py-1.5 pr-1.5 pl-3.5 text-[13px] leading-snug text-papeliz-ink shadow-papeliz-pop max-sm:w-full max-sm:max-w-none"
    >
      <CircleArrowDown className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
      <span className="min-w-0">
        {desktopAppUpdateCheckState === 'install-failed'
          ? `Papeliz ${readyDesktopAppUpdateVersion} didn’t install. Try again in a moment.`
          : `Papeliz ${readyDesktopAppUpdateVersion} is ready.`}
      </span>
      <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" disabled={isDesktopAppUpdateInstalling} onClick={() => void installReadyDesktopAppUpdate()}>
        {isDesktopAppUpdateInstalling && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
        {describeDesktopAppUpdateInstallLabel(isDesktopAppUpdateInstalling)}
      </PapelizPillButton>
      <PapelizIconButton iconButtonLabel="Dismiss" iconButtonSize="small" iconButtonTone="surface" onClick={closeDesktopAppUpdateToast}>
        <X className="size-[14px]" aria-hidden="true" />
      </PapelizIconButton>
    </div>
  )
}

// The gear's own dot, on its top right corner, while an update is ready.
function PapelizDesktopAppUpdateGearDotInDesktopApp() {
  const readyDesktopAppUpdateVersion = usePapelizReadyDesktopAppUpdateVersionInDesktopApp()
  if (readyDesktopAppUpdateVersion === null) return null
  return <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-papeliz-topbar bg-[#ffb020]" />
}

// The status bar's line at its right end, pressed to restart into the update.
function PapelizDesktopAppUpdateStatusBarLineInDesktopApp() {
  const readyDesktopAppUpdateVersion = usePapelizReadyDesktopAppUpdateVersionInDesktopApp()
  const desktopAppUpdateCheckState = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.desktopAppUpdateCheckState)
  const installReadyDesktopAppUpdate = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.installReadyDesktopAppUpdate)
  if (readyDesktopAppUpdateVersion === null) return null
  const isDesktopAppUpdateInstalling = desktopAppUpdateCheckState === 'installing'
  return (
    <button
      type="button"
      disabled={isDesktopAppUpdateInstalling}
      onClick={() => void installReadyDesktopAppUpdate()}
      title={`Install Papeliz ${readyDesktopAppUpdateVersion} and restart`}
      className="flex-none rounded-full bg-white/18 px-2.5 py-px text-[11.5px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-white/28 disabled:opacity-70"
    >
      {isDesktopAppUpdateInstalling ? 'Restarting…' : `Update ${readyDesktopAppUpdateVersion} ready · Restart`}
    </button>
  )
}

// The gear's Updates page: the check at start, on by default, and Check Now beside the version this is.
function PapelizDesktopAppUpdatesPageInDesktopApp() {
  const papelizDesktopPlatform = usePapelizDesktopPlatformStore((desktopPlatformState) => desktopPlatformState.papelizDesktopPlatform)
  const desktopAppUpdateCheckState = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.desktopAppUpdateCheckState)
  const isDesktopAppUpdateCheckAtStartOn = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.isDesktopAppUpdateCheckAtStartOn)
  const setDesktopAppUpdateCheckAtStartOn = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.setDesktopAppUpdateCheckAtStartOn)
  const checkForDesktopAppUpdateNow = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.checkForDesktopAppUpdateNow)
  const installReadyDesktopAppUpdate = usePapelizDesktopAppUpdateStore((desktopAppUpdateState) => desktopAppUpdateState.installReadyDesktopAppUpdate)
  const readyDesktopAppUpdateVersion = usePapelizReadyDesktopAppUpdateVersionInDesktopApp()
  if (papelizDesktopPlatform === null) return null
  const isDesktopAppUpdateChecking = desktopAppUpdateCheckState === 'checking'
  const isDesktopAppUpdateInstalling = desktopAppUpdateCheckState === 'installing'
  const desktopAppUpdateCheckLine: Record<typeof desktopAppUpdateCheckState, string | null> = {
    'not-checked': null,
    checking: 'Looking for a newer Papeliz…',
    newest: 'You have the newest Papeliz.',
    'update-ready': `Papeliz ${readyDesktopAppUpdateVersion ?? ''} is ready.`,
    'check-failed': 'Couldn’t look for updates. Check your connection, then try again.',
    installing: `Installing Papeliz ${readyDesktopAppUpdateVersion ?? ''}…`,
    'install-failed': `Papeliz ${readyDesktopAppUpdateVersion ?? ''} didn’t install. Try again in a moment.`,
  }
  const shownDesktopAppUpdateCheckLine = desktopAppUpdateCheckLine[desktopAppUpdateCheckState]
  return (
    <div className="flex flex-col">
      <button
        type="button"
        role="switch"
        aria-checked={isDesktopAppUpdateCheckAtStartOn}
        onClick={() => setDesktopAppUpdateCheckAtStartOn(!isDesktopAppUpdateCheckAtStartOn)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-papeliz-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-papeliz-blue"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Check for Updates at Start</span>
          <span className="block text-[12px] text-papeliz-ink-muted">Looks for a newer Papeliz once when it opens. Nothing about you or your notes is sent.</span>
        </span>
        <span
          aria-hidden="true"
          className={joinPapelizClassNames(
            'relative h-4 w-7 flex-none rounded-full transition-colors after:absolute after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgb(17_17_18/0.25)] after:transition-[left] after:duration-150',
            isDesktopAppUpdateCheckAtStartOn ? 'bg-papeliz-blue after:left-3.5' : 'bg-papeliz-line-strong after:left-0.5',
          )}
        />
      </button>
      <div className="mx-3 h-px bg-papeliz-line" />
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Papeliz {papelizDesktopPlatform.desktopAppVersion}</span>
          <span role="status" className="block text-[12px] text-papeliz-ink-muted">
            {shownDesktopAppUpdateCheckLine ?? 'The version you have.'}
          </span>
        </span>
        {readyDesktopAppUpdateVersion !== null ? (
          <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={isDesktopAppUpdateInstalling} onClick={() => void installReadyDesktopAppUpdate()}>
            {describeDesktopAppUpdateInstallLabel(isDesktopAppUpdateInstalling)}
          </PapelizPillButton>
        ) : (
          <PapelizPillButton
            pillButtonVariant="line"
            pillButtonSize="small"
            disabled={isDesktopAppUpdateChecking}
            onClick={() => void checkForDesktopAppUpdateNow(papelizDesktopPlatform)}
          >
            <RefreshCw className={joinPapelizClassNames('size-3.5', isDesktopAppUpdateChecking && 'animate-spin')} aria-hidden="true" />
            Check Now
          </PapelizPillButton>
        )}
      </div>
    </div>
  )
}

const showPapelizNothing = () => null

export const usePapelizReadyDesktopAppUpdateVersion: () => string | null = isPapelizDesktopApp ? usePapelizReadyDesktopAppUpdateVersionInDesktopApp : showPapelizNothing
export const useIsPapelizDesktopAppSelfUpdating: () => boolean = isPapelizDesktopApp ? useIsPapelizDesktopAppSelfUpdatingInDesktopApp : () => false
export const PapelizDesktopAppUpdateToast = isPapelizDesktopApp ? PapelizDesktopAppUpdateToastInDesktopApp : showPapelizNothing
export const PapelizDesktopAppUpdateGearDot = isPapelizDesktopApp ? PapelizDesktopAppUpdateGearDotInDesktopApp : showPapelizNothing
export const PapelizDesktopAppUpdateStatusBarLine = isPapelizDesktopApp ? PapelizDesktopAppUpdateStatusBarLineInDesktopApp : showPapelizNothing
export const PapelizDesktopAppUpdatesPage = isPapelizDesktopApp ? PapelizDesktopAppUpdatesPageInDesktopApp : showPapelizNothing
