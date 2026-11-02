'use client'

import { Info } from 'lucide-react'
import { useEffect, useId, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'

const papelizAccountSyncPlanInfoTipWidthPixels = 288
const papelizAccountSyncPlanInfoTipEdgeGapPixels = 8
const papelizAccountSyncPlanInfoTipIconGapPixels = 6
// Below the icon when this much room is left under it, above it otherwise.
const papelizAccountSyncPlanInfoTipRoomNeededBelowPixels = 220

type PapelizAccountSyncPlanInfoTipPlacement = { syncPlanInfoTipLeftPixels: number } & ({ syncPlanInfoTipTopPixels: number } | { syncPlanInfoTipBottomPixels: number })

// The info icon beside a plan's name, the app's own: its limits (a title and a few points) show on hover
// and on keyboard focus, and stay open after a click or tap until a second one, Esc, or a scroll. The
// points are drawn over the whole page, under the icon or above it when the window has no room below;
// screen readers get the same words as the icon's description.
export function PapelizAccountSyncPlanInfoTip({
  syncPlanInfoTipButtonLabel,
  syncPlanInfoTipTitle,
  syncPlanInfoTipLines,
}: {
  syncPlanInfoTipButtonLabel: string
  syncPlanInfoTipTitle: string
  syncPlanInfoTipLines: readonly string[]
}) {
  const syncPlanInfoTipTextId = useId()
  const [isSyncPlanInfoTipHovered, setSyncPlanInfoTipHovered] = useState(false)
  const [isSyncPlanInfoTipFocusShown, setSyncPlanInfoTipFocusShown] = useState(false)
  const [isSyncPlanInfoTipPinned, setSyncPlanInfoTipPinned] = useState(false)
  const [syncPlanInfoTipPlacement, setSyncPlanInfoTipPlacement] = useState<PapelizAccountSyncPlanInfoTipPlacement | null>(null)
  const isSyncPlanInfoTipShown = (isSyncPlanInfoTipHovered || isSyncPlanInfoTipFocusShown || isSyncPlanInfoTipPinned) && syncPlanInfoTipPlacement !== null

  const placeSyncPlanInfoTipBeside = (syncPlanInfoTipButton: HTMLElement) => {
    const syncPlanInfoTipButtonRect = syncPlanInfoTipButton.getBoundingClientRect()
    const syncPlanInfoTipLeftPixels = Math.min(
      Math.max(syncPlanInfoTipButtonRect.left + syncPlanInfoTipButtonRect.width / 2 - papelizAccountSyncPlanInfoTipWidthPixels / 2, papelizAccountSyncPlanInfoTipEdgeGapPixels),
      window.innerWidth - papelizAccountSyncPlanInfoTipWidthPixels - papelizAccountSyncPlanInfoTipEdgeGapPixels,
    )
    setSyncPlanInfoTipPlacement(
      window.innerHeight - syncPlanInfoTipButtonRect.bottom >= papelizAccountSyncPlanInfoTipRoomNeededBelowPixels
        ? { syncPlanInfoTipLeftPixels, syncPlanInfoTipTopPixels: syncPlanInfoTipButtonRect.bottom + papelizAccountSyncPlanInfoTipIconGapPixels }
        : { syncPlanInfoTipLeftPixels, syncPlanInfoTipBottomPixels: window.innerHeight - syncPlanInfoTipButtonRect.top + papelizAccountSyncPlanInfoTipIconGapPixels },
    )
  }

  const hideSyncPlanInfoTip = () => {
    setSyncPlanInfoTipHovered(false)
    setSyncPlanInfoTipFocusShown(false)
    setSyncPlanInfoTipPinned(false)
  }

  // A scroll would leave the points behind, so they close.
  useEffect(() => {
    if (!isSyncPlanInfoTipShown) return
    window.addEventListener('scroll', hideSyncPlanInfoTip, { capture: true, passive: true })
    window.addEventListener('resize', hideSyncPlanInfoTip)
    return () => {
      window.removeEventListener('scroll', hideSyncPlanInfoTip, { capture: true })
      window.removeEventListener('resize', hideSyncPlanInfoTip)
    }
  }, [isSyncPlanInfoTipShown])

  return (
    <>
      <button
        type="button"
        aria-label={syncPlanInfoTipButtonLabel}
        aria-describedby={syncPlanInfoTipTextId}
        aria-expanded={isSyncPlanInfoTipPinned}
        onMouseEnter={(mouseEnterEvent: ReactMouseEvent<HTMLButtonElement>) => {
          placeSyncPlanInfoTipBeside(mouseEnterEvent.currentTarget)
          setSyncPlanInfoTipHovered(true)
        }}
        onMouseLeave={() => setSyncPlanInfoTipHovered(false)}
        onFocus={(focusEvent) => {
          // A keyboard user sees it on focus; a click decides for itself below.
          if (!focusEvent.currentTarget.matches(':focus-visible')) return
          placeSyncPlanInfoTipBeside(focusEvent.currentTarget)
          setSyncPlanInfoTipFocusShown(true)
        }}
        onBlur={() => {
          setSyncPlanInfoTipFocusShown(false)
          setSyncPlanInfoTipPinned(false)
        }}
        onClick={(clickEvent) => {
          placeSyncPlanInfoTipBeside(clickEvent.currentTarget)
          setSyncPlanInfoTipPinned(!isSyncPlanInfoTipPinned)
        }}
        onKeyDown={(keyDownEvent) => {
          if (keyDownEvent.key !== 'Escape' || !isSyncPlanInfoTipShown) return
          // Esc closes only the points, not a dialog around them.
          keyDownEvent.preventDefault()
          hideSyncPlanInfoTip()
        }}
        className="-my-0.5 ml-1 inline-grid size-[18px] flex-none cursor-help place-items-center rounded-full align-middle text-papeliz-ink-subtle transition-colors hover:bg-papeliz-blue-soft hover:text-papeliz-blue focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue aria-expanded:bg-papeliz-blue-soft aria-expanded:text-papeliz-blue"
      >
        <Info className="size-[13px]" aria-hidden="true" />
      </button>
      <span id={syncPlanInfoTipTextId} className="sr-only">
        {`${syncPlanInfoTipTitle}. ${syncPlanInfoTipLines.join('. ')}.`}
      </span>
      {isSyncPlanInfoTipShown &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              left: syncPlanInfoTipPlacement.syncPlanInfoTipLeftPixels,
              top: 'syncPlanInfoTipTopPixels' in syncPlanInfoTipPlacement ? syncPlanInfoTipPlacement.syncPlanInfoTipTopPixels : undefined,
              bottom: 'syncPlanInfoTipBottomPixels' in syncPlanInfoTipPlacement ? syncPlanInfoTipPlacement.syncPlanInfoTipBottomPixels : undefined,
              width: `min(${papelizAccountSyncPlanInfoTipWidthPixels}px, calc(100vw - ${papelizAccountSyncPlanInfoTipEdgeGapPixels * 2}px))`,
            }}
            className="pointer-events-none fixed z-50 rounded-xl bg-papeliz-ink px-3.5 py-3 text-left font-normal whitespace-normal text-papeliz-surface shadow-papeliz-pop"
          >
            <p className="text-[12.5px] leading-snug font-semibold">{syncPlanInfoTipTitle}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-[1.45] marker:text-papeliz-surface/50">
              {syncPlanInfoTipLines.map((syncPlanInfoTipLine) => (
                <li key={syncPlanInfoTipLine} className="pl-0.5 text-papeliz-surface/90">
                  {syncPlanInfoTipLine}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
