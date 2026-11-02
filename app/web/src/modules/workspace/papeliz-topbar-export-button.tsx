import { Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { subscribeToPapelizWindowWidthChange } from '../ui/papeliz-window-width-change'
import { PapelizSettingsGearExportPage } from './papeliz-settings-gear-export-page'
import { PapelizTopbarFrostedSquareButton } from './papeliz-topbar-frosted-square-button'

// The Export panel's height, the Settings panel's: the notes and formats fit, a long tree scrolls.
const papelizTopbarExportPanelHeightPixels = 520

// The panel hangs below the button, its right edge in line with the button's.
function measureTopbarExportPanelAnchor(topbarExportButtonElement: HTMLElement): { anchorRight: number; anchorTop: number } {
  const topbarExportButtonRect = topbarExportButtonElement.getBoundingClientRect()
  return { anchorRight: window.innerWidth - topbarExportButtonRect.right, anchorTop: topbarExportButtonRect.bottom + 6 }
}

// Export on the blue top bar, between AI Assistant and Settings: it opens the Export page (the notes to
// tick, the formats with their gears, Export) in a panel under the button. Esc, a click outside or a
// change in window width closes it, as the Settings panel does; Esc in a format's settings dialog
// closes only that dialog.
export function PapelizTopbarExportButton() {
  const [topbarExportPanelAnchor, setTopbarExportPanelAnchor] = useState<{ anchorRight: number; anchorTop: number } | null>(null)
  const topbarExportButtonRef = useRef<HTMLButtonElement>(null)
  const topbarExportPanelRef = useRef<HTMLDivElement>(null)
  const isTopbarExportPanelOpen = topbarExportPanelAnchor !== null

  useEffect(() => {
    if (!isTopbarExportPanelOpen) return
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pointerTarget = pointerEvent.target as Node
      if (!topbarExportPanelRef.current?.contains(pointerTarget) && !topbarExportButtonRef.current?.contains(pointerTarget)) setTopbarExportPanelAnchor(null)
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return
      // The workspace leaves focus mode on Esc too; this Esc only closes the panel.
      keyboardEvent.preventDefault()
      setTopbarExportPanelAnchor(null)
      topbarExportButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    const stopWatchingWindowWidth = subscribeToPapelizWindowWidthChange(() => setTopbarExportPanelAnchor(null))
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      stopWatchingWindowWidth()
    }
  }, [isTopbarExportPanelOpen])

  return (
    <>
      <PapelizTopbarFrostedSquareButton
        ref={topbarExportButtonRef}
        topbarFrostedSquareButtonLabel="Export"
        aria-haspopup="dialog"
        aria-expanded={isTopbarExportPanelOpen}
        onClick={(clickEvent) => setTopbarExportPanelAnchor(isTopbarExportPanelOpen ? null : measureTopbarExportPanelAnchor(clickEvent.currentTarget))}
      >
        <Share className="size-[17px]" aria-hidden="true" />
      </PapelizTopbarFrostedSquareButton>
      {topbarExportPanelAnchor !== null &&
        createPortal(
          <div
            ref={topbarExportPanelRef}
            role="dialog"
            aria-label="Export"
            className="papeliz-pop-enter fixed z-50 flex w-[min(320px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-papeliz-line bg-papeliz-surface text-papeliz-ink shadow-papeliz-pop"
            style={{
              right: Math.max(8, topbarExportPanelAnchor.anchorRight),
              top: topbarExportPanelAnchor.anchorTop,
              maxHeight: `min(${papelizTopbarExportPanelHeightPixels}px, calc(100dvh - ${topbarExportPanelAnchor.anchorTop + 8}px))`,
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 papeliz-settings-gear-scroller">
              <p className="mb-2.5 text-[14px] font-semibold">Export</p>
              <PapelizSettingsGearExportPage />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
