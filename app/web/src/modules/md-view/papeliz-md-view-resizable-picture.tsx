import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PapelizMdViewMedia, type PapelizMdViewMediaProps } from './papeliz-md-view-media'
import { clampPapelizMdViewPictureWidthPixels, papelizMdViewPictureSmallestWidthPixels, papelizMdViewPictureWidthStepsAcrossColumn } from './papeliz-md-view-picture-width'

// A picture in the editable MD View with a handle on its lower right corner (just outside it, on a
// small picture), shown on hover and on focus. Dragging the handle resizes the picture, keeping its proportions, and the width it is let go
// at is written into the note's Markdown once. The handle is a slider: Left and Down make the picture
// smaller by a tenth of the note's column, Right and Up larger, Home goes to the smallest width and
// End to the column's. The handle shows only while there is a picture to resize, not while a vault
// file is read or when it isn't found.

export interface PapelizMdViewResizablePictureProps extends PapelizMdViewMediaProps {
  // The width of the note's column, which the picture never grows past.
  measureNoteColumnWidthPixels: () => number
  // Writes the new width into the note's Markdown. A drag is one step to undo.
  onPictureWidthCommit: (pictureWidthPixels: number, isPictureWidthDragged: boolean) => void
}

// A picture narrower or shorter than this has its handle outside its corner.
const papelizMdViewPictureInnerHandleSmallestSidePixels = 80

interface PapelizMdViewPictureDrag {
  dragPointerId: number
  dragStartClientX: number
  dragStartPictureWidthPixels: number
  dragNoteColumnWidthPixels: number
}

// The picture beside the handle, once it shows.
function findShownPictureElement(pictureResizeHandleElement: HTMLElement | null): HTMLImageElement | null {
  return pictureResizeHandleElement?.parentElement?.querySelector<HTMLImageElement>('img.papeliz-md-view-picture') ?? null
}

export function PapelizMdViewResizablePicture({ measureNoteColumnWidthPixels, onPictureWidthCommit, ...mediaProps }: PapelizMdViewResizablePictureProps) {
  const pictureResizeHandleRef = useRef<HTMLSpanElement>(null)
  const pictureDragRef = useRef<PapelizMdViewPictureDrag | null>(null)
  const [draggedPictureWidthPixels, setDraggedPictureWidthPixels] = useState<number | null>(null)
  const [shownPictureWidthPixels, setShownPictureWidthPixels] = useState<number | null>(null)
  const [shownPictureHeightPixels, setShownPictureHeightPixels] = useState<number | null>(null)
  const [noteColumnWidthPixels, setNoteColumnWidthPixels] = useState<number | null>(null)
  const { onMediaSizeChange } = mediaProps

  const readShownPictureElement = () => findShownPictureElement(pictureResizeHandleRef.current)

  // The slider's value and its largest value follow the picture and the column as they change size.
  useEffect(() => {
    const pictureBoxElement = pictureResizeHandleRef.current?.parentElement
    if (pictureBoxElement === null || pictureBoxElement === undefined || typeof ResizeObserver === 'undefined') return
    const pictureBoxObserver = new ResizeObserver(() => {
      const shownPictureElement = findShownPictureElement(pictureResizeHandleRef.current)
      setShownPictureWidthPixels(shownPictureElement?.offsetWidth ?? null)
      setShownPictureHeightPixels(shownPictureElement?.offsetHeight ?? null)
      setNoteColumnWidthPixels(Math.floor(measureNoteColumnWidthPixels()))
    })
    pictureBoxObserver.observe(pictureBoxElement)
    return () => pictureBoxObserver.disconnect()
  }, [measureNoteColumnWidthPixels])

  // The picture's line grows and shrinks with it while it is dragged.
  useEffect(() => {
    if (draggedPictureWidthPixels !== null) onMediaSizeChange?.()
  }, [draggedPictureWidthPixels, onMediaSizeChange])

  const endPictureDrag = (isPictureWidthKept: boolean) => {
    const finishedPictureDrag = pictureDragRef.current
    pictureDragRef.current = null
    if (finishedPictureDrag !== null && isPictureWidthKept && draggedPictureWidthPixels !== null && draggedPictureWidthPixels !== finishedPictureDrag.dragStartPictureWidthPixels) {
      onPictureWidthCommit(draggedPictureWidthPixels, true)
    }
    setDraggedPictureWidthPixels(null)
  }

  const startPictureDrag = (pointerDownEvent: PointerEvent<HTMLSpanElement>) => {
    const shownPictureElement = readShownPictureElement()
    if (pointerDownEvent.button !== 0 || shownPictureElement === null) return
    // The press stays off the note's text: no cursor moves, no text is selected.
    pointerDownEvent.preventDefault()
    pointerDownEvent.stopPropagation()
    pointerDownEvent.currentTarget.focus({ preventScroll: true })
    pointerDownEvent.currentTarget.setPointerCapture(pointerDownEvent.pointerId)
    const dragNoteColumnWidthPixels = measureNoteColumnWidthPixels()
    setNoteColumnWidthPixels(Math.floor(dragNoteColumnWidthPixels))
    pictureDragRef.current = {
      dragPointerId: pointerDownEvent.pointerId,
      dragStartClientX: pointerDownEvent.clientX,
      dragStartPictureWidthPixels: shownPictureElement.offsetWidth,
      dragNoteColumnWidthPixels,
    }
  }

  const movePictureDrag = (pointerMoveEvent: PointerEvent<HTMLSpanElement>) => {
    const pictureDrag = pictureDragRef.current
    if (pictureDrag === null || pointerMoveEvent.pointerId !== pictureDrag.dragPointerId) return
    const draggedWidthPixels = pictureDrag.dragStartPictureWidthPixels + pointerMoveEvent.clientX - pictureDrag.dragStartClientX
    setDraggedPictureWidthPixels(clampPapelizMdViewPictureWidthPixels(draggedWidthPixels, pictureDrag.dragNoteColumnWidthPixels))
  }

  const stepPictureWidth = (keyDownEvent: KeyboardEvent<HTMLSpanElement>) => {
    if (pictureDragRef.current !== null) {
      // Esc lets go of a drag and leaves the width as it was.
      if (keyDownEvent.key === 'Escape') {
        keyDownEvent.preventDefault()
        endPictureDrag(false)
      }
      return
    }
    if (keyDownEvent.altKey || keyDownEvent.ctrlKey || keyDownEvent.metaKey) return
    const shownPictureElement = readShownPictureElement()
    if (shownPictureElement === null) return
    const keyNoteColumnWidthPixels = measureNoteColumnWidthPixels()
    const pictureWidthStepPixels = Math.max(1, Math.round(keyNoteColumnWidthPixels / papelizMdViewPictureWidthStepsAcrossColumn))
    const currentPictureWidthPixels = shownPictureElement.offsetWidth
    let requestedPictureWidthPixels: number
    if (keyDownEvent.key === 'ArrowLeft' || keyDownEvent.key === 'ArrowDown') requestedPictureWidthPixels = currentPictureWidthPixels - pictureWidthStepPixels
    else if (keyDownEvent.key === 'ArrowRight' || keyDownEvent.key === 'ArrowUp') requestedPictureWidthPixels = currentPictureWidthPixels + pictureWidthStepPixels
    else if (keyDownEvent.key === 'Home') requestedPictureWidthPixels = papelizMdViewPictureSmallestWidthPixels
    else if (keyDownEvent.key === 'End') requestedPictureWidthPixels = keyNoteColumnWidthPixels
    else return
    // The key is the slider's own, not the note's.
    keyDownEvent.preventDefault()
    keyDownEvent.stopPropagation()
    setNoteColumnWidthPixels(Math.floor(keyNoteColumnWidthPixels))
    const nextPictureWidthPixels = clampPapelizMdViewPictureWidthPixels(requestedPictureWidthPixels, keyNoteColumnWidthPixels)
    if (nextPictureWidthPixels !== mediaProps.mediaWidthPixels) onPictureWidthCommit(nextPictureWidthPixels, false)
  }

  const isPictureDragged = draggedPictureWidthPixels !== null
  const sliderPictureWidthPixels = draggedPictureWidthPixels ?? shownPictureWidthPixels
  // On a small picture the handle sits just outside its corner, so it never covers the picture's own
  // clicks.
  const isPictureResizeHandleOutside =
    shownPictureWidthPixels !== null &&
    shownPictureHeightPixels !== null &&
    (shownPictureWidthPixels < papelizMdViewPictureInnerHandleSmallestSidePixels || shownPictureHeightPixels < papelizMdViewPictureInnerHandleSmallestSidePixels)
  const pictureName = mediaProps.mediaAlternativeText || 'untitled'
  return (
    <>
      <PapelizMdViewMedia
        {...mediaProps}
        // A dragged picture takes the dragged width and its own proportions.
        mediaWidthPixels={draggedPictureWidthPixels ?? mediaProps.mediaWidthPixels}
        mediaHeightPixels={isPictureDragged ? null : mediaProps.mediaHeightPixels}
      />
      <span
        ref={pictureResizeHandleRef}
        className="papeliz-md-view-picture-resize-handle"
        data-papeliz-picture-dragged={isPictureDragged ? 'true' : undefined}
        data-papeliz-picture-resize-handle-outside={isPictureResizeHandleOutside ? 'true' : undefined}
        role="slider"
        tabIndex={0}
        aria-label={`Resize picture: ${pictureName}`}
        aria-orientation="horizontal"
        aria-valuemin={papelizMdViewPictureSmallestWidthPixels}
        aria-valuemax={noteColumnWidthPixels ?? undefined}
        aria-valuenow={sliderPictureWidthPixels ?? undefined}
        aria-valuetext={sliderPictureWidthPixels === null ? undefined : `${sliderPictureWidthPixels} pixels wide`}
        title="Drag to resize. Arrow keys resize too."
        onPointerDown={startPictureDrag}
        onPointerMove={movePictureDrag}
        onPointerUp={() => endPictureDrag(true)}
        onPointerCancel={() => endPictureDrag(false)}
        onKeyDown={stepPictureWidth}
      />
      {isPictureDragged && (
        <span className="papeliz-md-view-picture-resize-width" aria-hidden="true">
          {draggedPictureWidthPixels} px
        </span>
      )}
    </>
  )
}
