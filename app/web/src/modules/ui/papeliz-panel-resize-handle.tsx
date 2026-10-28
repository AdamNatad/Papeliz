import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

interface PapelizPanelResizeHandleProps {
  resizeHandleLabel: string
  // Which side of the window the panel sits on. Dragging away from that side widens it.
  resizedPanelSide: 'left' | 'right'
  panelWidth: number
  minimumPanelWidth: number
  defaultPanelWidth: number
  maximumPanelWidth: number
  onPanelWidthChange: (panelWidth: number) => void
  onPanelResizeEnd: () => void
}

const papelizPanelResizeKeyboardStep = 16

// The draggable edge between a side panel and the note. It sits on the seam and reaches a few
// pixels to the side without a scrollbar; on hover and while dragging the seam turns blue.
// Arrow keys resize it too, and a double-click puts back the default width. The panel itself is
// `relative`, and this handle is placed inside it.
export function PapelizPanelResizeHandle({
  resizeHandleLabel,
  resizedPanelSide,
  panelWidth,
  minimumPanelWidth,
  defaultPanelWidth,
  maximumPanelWidth,
  onPanelWidthChange,
  onPanelResizeEnd,
}: PapelizPanelResizeHandleProps) {
  const [isPanelBeingResized, setPanelBeingResized] = useState(false)
  const resizeDragStartRef = useRef<{ pointerStartX: number; panelStartWidth: number } | null>(null)
  const widenDirection = resizedPanelSide === 'left' ? 1 : -1

  const stopResizing = (pointerEvent: PointerEvent<HTMLDivElement>) => {
    if (resizeDragStartRef.current === null) return
    resizeDragStartRef.current = null
    setPanelBeingResized(false)
    delete document.documentElement.dataset.papelizPanelResizing
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId)
    onPanelResizeEnd()
  }

  const resizeWithKeyboard = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const keyboardWidthChanges: Record<string, number> = {
      ArrowLeft: -papelizPanelResizeKeyboardStep * widenDirection,
      ArrowRight: papelizPanelResizeKeyboardStep * widenDirection,
    }
    let nextPanelWidth: number | null = null
    if (keyboardEvent.key in keyboardWidthChanges) nextPanelWidth = panelWidth + (keyboardWidthChanges[keyboardEvent.key] ?? 0)
    if (keyboardEvent.key === 'Home') nextPanelWidth = minimumPanelWidth
    if (keyboardEvent.key === 'End') nextPanelWidth = maximumPanelWidth
    if (keyboardEvent.key === 'Enter') nextPanelWidth = defaultPanelWidth
    if (nextPanelWidth === null) return
    keyboardEvent.preventDefault()
    onPanelWidthChange(nextPanelWidth)
    onPanelResizeEnd()
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={resizeHandleLabel}
      aria-orientation="vertical"
      aria-valuenow={panelWidth}
      aria-valuemin={minimumPanelWidth}
      aria-valuemax={maximumPanelWidth}
      title={`${resizeHandleLabel}. Double-click for the default width.`}
      data-papeliz-panel-resizing={isPanelBeingResized ? 'true' : undefined}
      className={joinPapelizClassNames(
        'papeliz-panel-resize-handle absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none select-none',
        resizedPanelSide === 'left' ? '-right-2' : 'left-0',
      )}
      onPointerDown={(pointerEvent) => {
        if (pointerEvent.button !== 0) return
        pointerEvent.preventDefault()
        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
        resizeDragStartRef.current = { pointerStartX: pointerEvent.clientX, panelStartWidth: panelWidth }
        setPanelBeingResized(true)
        document.documentElement.dataset.papelizPanelResizing = 'true'
      }}
      onPointerMove={(pointerEvent) => {
        const resizeDragStart = resizeDragStartRef.current
        if (resizeDragStart === null) return
        onPanelWidthChange(resizeDragStart.panelStartWidth + (pointerEvent.clientX - resizeDragStart.pointerStartX) * widenDirection)
      }}
      onPointerUp={stopResizing}
      onPointerCancel={stopResizing}
      onLostPointerCapture={stopResizing}
      onDoubleClick={() => {
        onPanelWidthChange(defaultPanelWidth)
        onPanelResizeEnd()
      }}
      onKeyDown={resizeWithKeyboard}
    />
  )
}
