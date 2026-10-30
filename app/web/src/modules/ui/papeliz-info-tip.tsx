import { Info } from 'lucide-react'
import { useEffect, useId, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from './papeliz-class-names'

const papelizInfoTipWidthPx = 288
const papelizInfoTipEdgeGapPx = 8
const papelizInfoTipIconGapPx = 6
// Below the icon when this much room is left under it, above it otherwise.
const papelizInfoTipRoomNeededBelowPx = 220

interface PapelizInfoTipProps {
  // The icon's accessible name, such as "About Temporary in Browser Storage".
  infoTipButtonLabel: string
  infoTipTitle: string
  // One short sentence each, shown as spaced points under the title.
  infoTipLines: readonly string[]
  infoTipButtonClassName?: string
}

type PapelizInfoTipPlacement = { infoTipLeftPx: number } & ({ infoTipTopPx: number } | { infoTipBottomPx: number })

// A small info icon whose explanation (a title and a few spaced points) shows on hover and on keyboard
// focus, and stays open after a click or tap until a second one, Esc, or a scroll. The explanation is
// drawn over the whole page, under the icon or above it when the window has no room below, so a
// scrolling table or panel never cuts it off; screen readers get the same words as the icon's
// description.
export function PapelizInfoTip({ infoTipButtonLabel, infoTipTitle, infoTipLines, infoTipButtonClassName }: PapelizInfoTipProps) {
  const infoTipTextId = useId()
  const [isInfoTipHovered, setInfoTipHovered] = useState(false)
  const [isInfoTipFocusShown, setInfoTipFocusShown] = useState(false)
  const [isInfoTipPinned, setInfoTipPinned] = useState(false)
  const [infoTipPlacement, setInfoTipPlacement] = useState<PapelizInfoTipPlacement | null>(null)
  const isInfoTipShown = (isInfoTipHovered || isInfoTipFocusShown || isInfoTipPinned) && infoTipPlacement !== null

  const placeInfoTipBeside = (infoTipButtonElement: HTMLElement) => {
    const infoTipButtonRect = infoTipButtonElement.getBoundingClientRect()
    const infoTipLeftPx = Math.min(
      Math.max(infoTipButtonRect.left + infoTipButtonRect.width / 2 - papelizInfoTipWidthPx / 2, papelizInfoTipEdgeGapPx),
      window.innerWidth - papelizInfoTipWidthPx - papelizInfoTipEdgeGapPx,
    )
    setInfoTipPlacement(
      window.innerHeight - infoTipButtonRect.bottom >= papelizInfoTipRoomNeededBelowPx
        ? { infoTipLeftPx, infoTipTopPx: infoTipButtonRect.bottom + papelizInfoTipIconGapPx }
        : { infoTipLeftPx, infoTipBottomPx: window.innerHeight - infoTipButtonRect.top + papelizInfoTipIconGapPx },
    )
  }

  const hideInfoTip = () => {
    setInfoTipHovered(false)
    setInfoTipFocusShown(false)
    setInfoTipPinned(false)
  }

  // A scroll would leave the explanation behind, so it closes.
  useEffect(() => {
    if (!isInfoTipShown) return
    window.addEventListener('scroll', hideInfoTip, { capture: true, passive: true })
    window.addEventListener('resize', hideInfoTip)
    return () => {
      window.removeEventListener('scroll', hideInfoTip, { capture: true })
      window.removeEventListener('resize', hideInfoTip)
    }
  }, [isInfoTipShown])

  return (
    <>
      <button
        type="button"
        aria-label={infoTipButtonLabel}
        aria-describedby={infoTipTextId}
        aria-expanded={isInfoTipPinned}
        onMouseEnter={(mouseEnterEvent: ReactMouseEvent<HTMLButtonElement>) => {
          placeInfoTipBeside(mouseEnterEvent.currentTarget)
          setInfoTipHovered(true)
        }}
        onMouseLeave={() => setInfoTipHovered(false)}
        onFocus={(focusEvent) => {
          // A keyboard user sees it on focus; a click decides for itself below.
          if (!focusEvent.currentTarget.matches(':focus-visible')) return
          placeInfoTipBeside(focusEvent.currentTarget)
          setInfoTipFocusShown(true)
        }}
        onBlur={() => {
          setInfoTipFocusShown(false)
          setInfoTipPinned(false)
        }}
        onClick={(clickEvent) => {
          placeInfoTipBeside(clickEvent.currentTarget)
          setInfoTipPinned(!isInfoTipPinned)
        }}
        onKeyDown={(keyDownEvent) => {
          if (keyDownEvent.key !== 'Escape' || !isInfoTipShown) return
          // Esc closes only the explanation, not the form or dialog around it.
          keyDownEvent.preventDefault()
          hideInfoTip()
        }}
        className={joinPapelizClassNames(
          'inline-grid size-[18px] flex-none place-items-center rounded-full align-middle text-papeliz-ink-subtle transition-colors hover:bg-papeliz-blue-soft hover:text-papeliz-blue aria-expanded:bg-papeliz-blue-soft aria-expanded:text-papeliz-blue',
          infoTipButtonClassName,
        )}
      >
        <Info className="size-[13px]" aria-hidden="true" />
      </button>
      <span id={infoTipTextId} className="sr-only">
        {`${infoTipTitle}. ${infoTipLines.join(' ')}`}
      </span>
      {isInfoTipShown &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              left: infoTipPlacement.infoTipLeftPx,
              top: 'infoTipTopPx' in infoTipPlacement ? infoTipPlacement.infoTipTopPx : undefined,
              bottom: 'infoTipBottomPx' in infoTipPlacement ? infoTipPlacement.infoTipBottomPx : undefined,
              width: papelizInfoTipWidthPx,
            }}
            className="pointer-events-none fixed z-50 rounded-xl bg-papeliz-ink px-3.5 py-3 text-left font-normal whitespace-normal text-papeliz-surface shadow-papeliz-pop"
          >
            <p className="text-[12.5px] leading-snug font-semibold">{infoTipTitle}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-[12px] leading-[1.45] marker:text-papeliz-surface/50">
              {infoTipLines.map((infoTipLine) => (
                <li key={infoTipLine} className="pl-0.5 text-papeliz-surface/90">
                  {infoTipLine}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
