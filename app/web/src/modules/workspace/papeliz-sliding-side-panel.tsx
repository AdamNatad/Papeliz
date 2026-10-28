import { useEffect, useState, type ReactNode } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

// How long a side panel takes to slide open or shut.
const papelizSidePanelSlideMilliseconds = 280

// A side panel's life: off, sliding open, open, sliding shut. Opening plays a keyframe from shut, so
// it needs no frame drawn shut first; shutting slides to shut, then the panel goes.
type PapelizSidePanelSlidePhase = 'hidden' | 'opening' | 'shown' | 'closing'

interface PapelizSlidingSidePanelProps {
  isSidePanelShown: boolean
  sidePanelSide: 'left' | 'right'
  // Docked beside the note (the note makes room as it slides), or a drawer over it on a phone.
  sidePanelPlacement: 'docked' | 'drawer'
  sidePanelWidth: number
  // The widest it may be, as CSS (a share of the window).
  sidePanelMaximumWidth: string
  // A drawer's backdrop was clicked.
  onSidePanelBackdropClick?: () => void
  children: ReactNode
}

// The file list and the Assistant: they slide open and shut. Docked, the panel's width grows from
// nothing, so the note moves over as the panel slides in from the window's edge, and it slides back
// out before it goes. On a phone it is a drawer that slides over the note, with a backdrop that
// fades. Dragging the panel's edge resizes it at once, with no slide.
export function PapelizSlidingSidePanel({
  isSidePanelShown,
  sidePanelSide,
  sidePanelPlacement,
  sidePanelWidth,
  sidePanelMaximumWidth,
  onSidePanelBackdropClick,
  children,
}: PapelizSlidingSidePanelProps) {
  const [sidePanelSlidePhase, setSidePanelSlidePhase] = useState<PapelizSidePanelSlidePhase>(isSidePanelShown ? 'shown' : 'hidden')
  const [wasSidePanelShown, setWasSidePanelShown] = useState(isSidePanelShown)
  if (wasSidePanelShown !== isSidePanelShown) {
    setWasSidePanelShown(isSidePanelShown)
    setSidePanelSlidePhase(isSidePanelShown ? 'opening' : 'closing')
  }

  useEffect(() => {
    if (sidePanelSlidePhase === 'opening' || sidePanelSlidePhase === 'closing') {
      const slideEndTimer = window.setTimeout(
        () => setSidePanelSlidePhase(sidePanelSlidePhase === 'opening' ? 'shown' : 'hidden'),
        papelizSidePanelSlideMilliseconds,
      )
      return () => window.clearTimeout(slideEndTimer)
    }
  }, [sidePanelSlidePhase])

  if (sidePanelSlidePhase === 'hidden') return null
  const isSidePanelDrawnShut = sidePanelSlidePhase === 'closing'
  const isSidePanelOpening = sidePanelSlidePhase === 'opening'
  const sidePanelContentWidth = `min(${sidePanelWidth}px, ${sidePanelMaximumWidth})`

  if (sidePanelPlacement === 'drawer') {
    return (
      <>
        <div
          aria-hidden="true"
          className={joinPapelizClassNames('papeliz-side-panel-backdrop fixed inset-0 z-30 bg-papeliz-backdrop', isSidePanelOpening && 'papeliz-side-panel-backdrop-opening')}
          data-papeliz-side-panel-drawn-shut={isSidePanelDrawnShut}
          onClick={onSidePanelBackdropClick}
        />
        <div
          className={joinPapelizClassNames(
            'papeliz-side-panel-drawer fixed inset-y-0 z-30 shadow-papeliz-pop',
            sidePanelSide === 'left' ? 'left-0 border-r border-papeliz-line' : 'right-0 border-l border-papeliz-line',
            isSidePanelOpening && 'papeliz-side-panel-drawer-opening',
          )}
          data-papeliz-side-panel-side={sidePanelSide}
          data-papeliz-side-panel-drawn-shut={isSidePanelDrawnShut}
          style={{ width: sidePanelContentWidth }}
        >
          {children}
        </div>
      </>
    )
  }

  // Docked: the outer box's width slides; the contents keep their full width, pinned to the edge the
  // panel slides from, so they move in and out rather than squeezing. Only a sliding panel clips its
  // contents: an open one lets its resize handle reach past its edge.
  return (
    <div
      className={joinPapelizClassNames(
        'papeliz-side-panel-docked relative flex-none',
        sidePanelSlidePhase !== 'shown' && 'overflow-hidden',
        isSidePanelOpening && 'papeliz-side-panel-docked-opening',
        isSidePanelDrawnShut && 'papeliz-side-panel-docked-closing',
      )}
      style={{ width: isSidePanelDrawnShut ? 0 : sidePanelContentWidth }}
    >
      <div
        className={joinPapelizClassNames(
          'absolute inset-y-0 bg-papeliz-surface',
          sidePanelSide === 'left' ? 'right-0 border-r border-papeliz-line' : 'left-0 border-l border-papeliz-line',
        )}
        style={{ width: sidePanelContentWidth }}
      >
        {children}
      </div>
    </div>
  )
}
