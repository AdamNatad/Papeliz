import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from './papeliz-class-names'

const papelizTooltipBubbleWidthPx = 240
const papelizTooltipBubbleEdgeGapPx = 8
const papelizTooltipBubbleAnchorGapPx = 6
// Under the anchor when this much room is left below it, above it otherwise.
const papelizTooltipBubbleRoomNeededBelowPx = 120

type PapelizTooltipBubblePlacement = { tooltipBubbleLeftPx: number } & ({ tooltipBubbleTopPx: number } | { tooltipBubbleBottomPx: number })

function placeTooltipBubbleBeside(tooltipAnchorElement: HTMLElement): PapelizTooltipBubblePlacement {
  const tooltipAnchorRect = tooltipAnchorElement.getBoundingClientRect()
  const tooltipBubbleLeftPx = Math.min(
    Math.max(tooltipAnchorRect.left, papelizTooltipBubbleEdgeGapPx),
    window.innerWidth - papelizTooltipBubbleWidthPx - papelizTooltipBubbleEdgeGapPx,
  )
  return window.innerHeight - tooltipAnchorRect.bottom >= papelizTooltipBubbleRoomNeededBelowPx
    ? { tooltipBubbleLeftPx, tooltipBubbleTopPx: tooltipAnchorRect.bottom + papelizTooltipBubbleAnchorGapPx }
    : { tooltipBubbleLeftPx, tooltipBubbleBottomPx: window.innerHeight - tooltipAnchorRect.top + papelizTooltipBubbleAnchorGapPx }
}

interface PapelizTooltipBubbleProps {
  tooltipAnchorElement: HTMLElement
  tooltipBubbleContent: ReactNode
  // A scroll or a resize would leave the bubble behind, so it asks to close.
  onTooltipBubbleLeftBehind: () => void
}

// The dark tooltip bubble, the Sync Options tooltip's look, drawn over the whole page under its anchor
// (above it when the window has no room below), so a scrolling list never cuts it off. Screen readers
// get its words from the element that takes focus, so the bubble itself is hidden from them.
export function PapelizTooltipBubble({ tooltipAnchorElement, tooltipBubbleContent, onTooltipBubbleLeftBehind }: PapelizTooltipBubbleProps) {
  const [tooltipBubblePlacement] = useState(() => placeTooltipBubbleBeside(tooltipAnchorElement))
  useEffect(() => {
    window.addEventListener('scroll', onTooltipBubbleLeftBehind, { capture: true, passive: true })
    window.addEventListener('resize', onTooltipBubbleLeftBehind)
    return () => {
      window.removeEventListener('scroll', onTooltipBubbleLeftBehind, { capture: true })
      window.removeEventListener('resize', onTooltipBubbleLeftBehind)
    }
  }, [onTooltipBubbleLeftBehind])
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        left: tooltipBubblePlacement.tooltipBubbleLeftPx,
        top: 'tooltipBubbleTopPx' in tooltipBubblePlacement ? tooltipBubblePlacement.tooltipBubbleTopPx : undefined,
        bottom: 'tooltipBubbleBottomPx' in tooltipBubblePlacement ? tooltipBubblePlacement.tooltipBubbleBottomPx : undefined,
        maxWidth: papelizTooltipBubbleWidthPx,
      }}
      className="papeliz-pop-enter pointer-events-none fixed z-50 flex flex-col gap-1.5 rounded-lg bg-papeliz-ink px-2.5 py-1.5 text-left text-[11.5px] leading-snug font-normal whitespace-normal text-papeliz-surface shadow-papeliz-pop"
    >
      {tooltipBubbleContent}
    </div>,
    document.body,
  )
}

// One tooltip's words: a bold name, then a sentence.
export function PapelizTooltipLine({ tooltipLineTitle, tooltipLineText }: { tooltipLineTitle: string; tooltipLineText: string }) {
  return (
    <span className="block">
      <b className="block font-semibold">{tooltipLineTitle}</b>
      {tooltipLineText}
    </span>
  )
}

interface PapelizHoverTooltipProps {
  tooltipLineTitle: string
  tooltipLineText: string
  className?: string
  children: ReactNode
}

// Something that shows information but takes no focus of its own, such as a badge inside a row's
// button: its tooltip shows while the pointer is over it. The element that takes focus says the same
// words to screen readers, and shows them on keyboard focus.
export function PapelizHoverTooltip({ tooltipLineTitle, tooltipLineText, className, children }: PapelizHoverTooltipProps) {
  const [hoveredTooltipAnchorElement, setHoveredTooltipAnchorElement] = useState<HTMLElement | null>(null)
  return (
    <span
      onMouseEnter={(mouseEnterEvent) => setHoveredTooltipAnchorElement(mouseEnterEvent.currentTarget)}
      onMouseLeave={() => setHoveredTooltipAnchorElement(null)}
      className={joinPapelizClassNames('cursor-help', className)}
    >
      {children}
      {hoveredTooltipAnchorElement !== null && (
        <PapelizTooltipBubble
          tooltipAnchorElement={hoveredTooltipAnchorElement}
          tooltipBubbleContent={<PapelizTooltipLine tooltipLineTitle={tooltipLineTitle} tooltipLineText={tooltipLineText} />}
          onTooltipBubbleLeftBehind={() => setHoveredTooltipAnchorElement(null)}
        />
      )}
    </span>
  )
}
