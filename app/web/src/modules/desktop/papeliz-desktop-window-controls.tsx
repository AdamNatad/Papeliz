import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import type { PapelizDesktopMaximizeButtonPointerState, PapelizDesktopWindow } from './papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from './papeliz-desktop-platform-store'

// What on the blue bar keeps its own presses; a press anywhere else on the bar moves the window.
const papelizDesktopWindowBarInteractiveElementSelector =
  'button, a, input, select, textarea, label, summary, [role="button"], [role="group"], [role="switch"], [role="tab"], [contenteditable="true"]'

// A press on the blue bar: on its empty space, a left press moves the window and the second press of
// a double-click maximizes or restores it (Windows took the first to move the window, so the bar sees
// this one, as Windows' own title bar does). A press on anything that keeps its own presses is left
// alone.
export function pressPapelizDesktopWindowBar(
  barPress: Pick<MouseEvent, 'button' | 'detail' | 'target' | 'preventDefault'>,
  desktopWindow: Pick<PapelizDesktopWindow, 'startDesktopWindowDragging' | 'toggleDesktopWindowMaximized'>,
): void {
  if (barPress.button !== 0 || !(barPress.target instanceof Element)) return
  if (barPress.target.closest(papelizDesktopWindowBarInteractiveElementSelector) !== null) return
  barPress.preventDefault()
  if (barPress.detail === 2) void desktopWindow.toggleDesktopWindowMaximized()
  else void desktopWindow.startDesktopWindowDragging()
}

// Papeliz for Windows: the blue bar stands in for Windows' title bar. Spread on the bar; in the web
// app it gives nothing.
export function usePapelizDesktopWindowBarDragHandlers(): { onMouseDown?: (barMouseDownEvent: MouseEvent<HTMLElement>) => void } {
  const papelizDesktopPlatform = usePapelizDesktopPlatformStore((desktopPlatformState) => desktopPlatformState.papelizDesktopPlatform)
  if (!isPapelizDesktopApp || papelizDesktopPlatform === null) return {}
  return { onMouseDown: (barMouseDownEvent) => pressPapelizDesktopWindowBar(barMouseDownEvent, papelizDesktopPlatform.desktopWindow) }
}

const papelizDesktopWindowButtonClassName =
  'grid h-12 w-[46px] flex-none place-items-center text-white outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white'

// Windows 11's own glyphs, drawn thin and white, 10 px across.
function PapelizDesktopMinimizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5.5h10" stroke="currentColor" />
    </svg>
  )
}

function PapelizDesktopMaximizeGlyph({ isDesktopWindowMaximized }: { isDesktopWindowMaximized: boolean }) {
  return isDesktopWindowMaximized ? (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" />
      <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" stroke="currentColor" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" />
    </svg>
  )
}

function PapelizDesktopCloseGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" />
    </svg>
  )
}

// Minimize, maximize or restore, and close, at the right end of the blue bar, shaped and sized as
// in every Windows 11 app: 46 px wide and the bar's full 48 px high. Windows itself answers the
// pointer over the maximize button, so it shows Snap Layouts there; that button's place goes to the
// native side whenever it moves, and its hover and pressed looks come from the native side too.
// Nothing shows in the web app.
export function PapelizDesktopWindowControls() {
  const papelizDesktopPlatform = usePapelizDesktopPlatformStore((desktopPlatformState) => desktopPlatformState.papelizDesktopPlatform)
  const desktopMaximizeButtonRef = useRef<HTMLButtonElement>(null)
  const [isDesktopWindowMaximized, setIsDesktopWindowMaximized] = useState(false)
  const [desktopMaximizeButtonPointerState, setDesktopMaximizeButtonPointerState] = useState<PapelizDesktopMaximizeButtonPointerState>('idle')

  useEffect(() => {
    if (papelizDesktopPlatform === null) return
    const { desktopWindow } = papelizDesktopPlatform
    let isDesktopWindowControlsShown = true
    void desktopWindow.isDesktopWindowMaximized().then((isMaximizedAtStart) => {
      if (isDesktopWindowControlsShown) setIsDesktopWindowMaximized(isMaximizedAtStart)
    })
    const stopListeningToMaximized = desktopWindow.subscribeToDesktopWindowMaximized(setIsDesktopWindowMaximized)
    const stopListeningToMaximizeButtonPointer = desktopWindow.subscribeToDesktopMaximizeButtonPointerState(setDesktopMaximizeButtonPointerState)
    return () => {
      isDesktopWindowControlsShown = false
      stopListeningToMaximized()
      stopListeningToMaximizeButtonPointer()
    }
  }, [papelizDesktopPlatform])

  // Tells the native side where the maximize button is, again whenever the window's size or the
  // button's own changes, and that it's gone once the bar is.
  useLayoutEffect(() => {
    const desktopMaximizeButtonElement = desktopMaximizeButtonRef.current
    if (papelizDesktopPlatform === null || desktopMaximizeButtonElement === null) return
    const { desktopWindow } = papelizDesktopPlatform
    const sendDesktopMaximizeButtonBounds = () => {
      const desktopMaximizeButtonRect = desktopMaximizeButtonElement.getBoundingClientRect()
      if (desktopMaximizeButtonRect.width === 0 || desktopMaximizeButtonRect.height === 0) return
      void desktopWindow.setDesktopMaximizeButtonBounds({
        desktopMaximizeButtonLeft: desktopMaximizeButtonRect.left,
        desktopMaximizeButtonTop: desktopMaximizeButtonRect.top,
        desktopMaximizeButtonWidth: desktopMaximizeButtonRect.width,
        desktopMaximizeButtonHeight: desktopMaximizeButtonRect.height,
      })
    }
    sendDesktopMaximizeButtonBounds()
    const desktopMaximizeButtonResizeObserver = new ResizeObserver(sendDesktopMaximizeButtonBounds)
    desktopMaximizeButtonResizeObserver.observe(desktopMaximizeButtonElement)
    window.addEventListener('resize', sendDesktopMaximizeButtonBounds)
    return () => {
      desktopMaximizeButtonResizeObserver.disconnect()
      window.removeEventListener('resize', sendDesktopMaximizeButtonBounds)
      void desktopWindow.setDesktopMaximizeButtonBounds(null)
    }
  }, [papelizDesktopPlatform, isDesktopWindowMaximized])

  if (!isPapelizDesktopApp || papelizDesktopPlatform === null) return null
  const { desktopWindow } = papelizDesktopPlatform
  const desktopMaximizeButtonLabel = isDesktopWindowMaximized ? 'Restore Down' : 'Maximize'

  return (
    <div className="flex flex-none self-stretch" role="group" aria-label="Window">
      <button
        type="button"
        aria-label="Minimize"
        title="Minimize"
        onClick={() => void desktopWindow.minimizeDesktopWindow()}
        className={`${papelizDesktopWindowButtonClassName} hover:bg-white/15 active:bg-white/25`}
      >
        <PapelizDesktopMinimizeGlyph />
      </button>
      <button
        ref={desktopMaximizeButtonRef}
        type="button"
        aria-label={desktopMaximizeButtonLabel}
        // A pointer's press is Windows' own (it maximizes there); only Enter or Space reach the page.
        onKeyDown={(maximizeButtonKeyEvent: KeyboardEvent<HTMLButtonElement>) => {
          if (maximizeButtonKeyEvent.key !== 'Enter' && maximizeButtonKeyEvent.key !== ' ') return
          maximizeButtonKeyEvent.preventDefault()
          void desktopWindow.toggleDesktopWindowMaximized()
        }}
        className={joinPapelizClassNames(
          papelizDesktopWindowButtonClassName,
          desktopMaximizeButtonPointerState === 'hovered' && 'bg-white/15',
          desktopMaximizeButtonPointerState === 'pressed' && 'bg-white/25',
        )}
      >
        <PapelizDesktopMaximizeGlyph isDesktopWindowMaximized={isDesktopWindowMaximized} />
      </button>
      <button
        type="button"
        aria-label="Close"
        title="Close"
        onClick={() => void desktopWindow.closeDesktopWindow()}
        className={`${papelizDesktopWindowButtonClassName} hover:bg-[#c42b1c] active:bg-[#c42b1c]/85`}
      >
        <PapelizDesktopCloseGlyph />
      </button>
    </div>
  )
}
