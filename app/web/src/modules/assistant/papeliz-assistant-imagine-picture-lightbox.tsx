import { Paintbrush, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { readPapelizImagineSectionLabel, usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import type { PapelizImaginePicture } from './papeliz-assistant-imagine-store'

interface PapelizImaginePictureLightboxProps {
  imaginePicture: PapelizImaginePicture
  // The prompt the picture came from, or "Brought in: name.png", in full.
  pictureLightboxCaption: string
  // The model that made the picture and its provider, or "Brought in".
  pictureLightboxModelLine: string
  // The card's own Put in Note and Save to Vault, so they stay in reach.
  pictureLightboxActionButtons: ReactNode
  // Gallery's pictures also offer Show in Draw.
  showInDrawThreadEntryId: string | null
  onPictureLightboxClose: () => void
}

// A picture opened from its card, as large as the window allows over a dark backdrop, with its caption
// and the card's actions under it. It is the browser's own modal <dialog>, so focus stays inside and the
// page behind can't be scrolled or pressed; Esc, Close or a press beside the picture closes it.
export function PapelizImaginePictureLightbox({
  imaginePicture,
  pictureLightboxCaption,
  pictureLightboxModelLine,
  pictureLightboxActionButtons,
  showInDrawThreadEntryId,
  onPictureLightboxClose,
}: PapelizImaginePictureLightboxProps) {
  const pictureLightboxDialogRef = useRef<HTMLDialogElement>(null)
  const drawSectionLabel = readPapelizImagineSectionLabel('draw')

  useEffect(() => {
    const pictureLightboxDialogElement = pictureLightboxDialogRef.current
    if (pictureLightboxDialogElement === null) return
    pictureLightboxDialogElement.showModal()
    return () => pictureLightboxDialogElement.close()
  }, [])

  return (
    <dialog
      ref={pictureLightboxDialogRef}
      aria-label={pictureLightboxCaption}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onPictureLightboxClose()
      }}
      onClick={(clickEvent) => {
        // The dialog fills the window; a press on its empty space, beside the picture and its details, closes it.
        if (clickEvent.target instanceof HTMLElement && clickEvent.target.dataset.papelizPictureLightboxBackdrop === 'true') onPictureLightboxClose()
      }}
      data-papeliz-picture-lightbox-backdrop="true"
      className="papeliz-dialog-enter m-0 size-full max-h-none max-w-none overflow-hidden overscroll-contain border-0 bg-transparent p-0 text-papeliz-ink backdrop:bg-[rgb(10_10_12/0.86)]"
    >
      <div data-papeliz-picture-lightbox-backdrop="true" className="flex size-full flex-col items-center gap-3 px-4 pt-3 pb-4 sm:px-6 sm:pb-6">
        <div data-papeliz-picture-lightbox-backdrop="true" className="flex w-full flex-none justify-end">
          <PapelizIconButton iconButtonLabel="Close" iconButtonTone="topbar" onClick={onPictureLightboxClose}>
            <X className="size-5" aria-hidden="true" />
          </PapelizIconButton>
        </div>
        <div data-papeliz-picture-lightbox-backdrop="true" className="flex min-h-0 w-full flex-1 items-center justify-center">
          {/* A small picture grows to 28rem, or the room there is, so the lightbox never shows it smaller
              than its card does. */}
          <img
            src={imaginePicture.imaginePicturePreviewUrl}
            alt={imaginePicture.imaginePictureDescriptionText}
            className="max-h-full min-h-[min(100%,28rem)] max-w-full min-w-[min(100%,28rem)] rounded-xl object-contain"
            draggable={false}
          />
        </div>
        <div className="flex w-full max-w-[40rem] flex-none flex-col gap-2 rounded-2xl bg-papeliz-surface p-3 shadow-papeliz-pop">
          <p className="papeliz-selectable-text max-h-[4.5rem] overflow-y-auto text-[14px] leading-snug break-words whitespace-pre-wrap">{pictureLightboxCaption}</p>
          <p className="text-[12px] leading-snug text-papeliz-ink-muted">{pictureLightboxModelLine}</p>
          <div className="grid grid-cols-1 gap-2 sm:auto-cols-fr sm:grid-flow-col">
            {pictureLightboxActionButtons}
            {showInDrawThreadEntryId !== null && (
              <PapelizPillButton
                className="w-full"
                pillButtonVariant="outline"
                pillButtonSize="small"
                onClick={() => {
                  onPictureLightboxClose()
                  usePapelizImagineSectionStore.getState().showDrawThreadEntry(showInDrawThreadEntryId)
                }}
              >
                <Paintbrush className="size-3.5" aria-hidden="true" />
                Show in {drawSectionLabel}
              </PapelizPillButton>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}
