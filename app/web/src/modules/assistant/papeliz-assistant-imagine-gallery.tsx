import { Images, Paintbrush, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizImaginePictureCard, PapelizImaginePictureInsertionCard, describePapelizImaginePictureMetadataLine } from './papeliz-assistant-imagine-picture-card'
import { readPapelizImagineSectionLabel, usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import { usePapelizImagineStore, type PapelizImaginePicture, type PapelizImagineThreadEntry } from './papeliz-assistant-imagine-store'

// The Draw entry a picture belongs to, and the words that say where it came from: the prompt, or
// "Brought in: name.png".
export function describePapelizImagineGalleryPicture(
  imaginePicture: PapelizImaginePicture,
  imagineThreadEntries: readonly PapelizImagineThreadEntry[],
): { galleryPictureCaption: string; drawThreadEntryId: string | null } {
  const drawThreadEntry = imagineThreadEntries.find((imagineThreadEntry) => imagineThreadEntry.imaginePictureIds.includes(imaginePicture.imaginePictureId))
  if (drawThreadEntry === undefined) {
    return {
      galleryPictureCaption: imaginePicture.imaginePictureOrigin === 'brought-in' ? `Brought in: ${imaginePicture.imaginePictureDescriptionText}` : imaginePicture.imaginePictureDescriptionText,
      drawThreadEntryId: null,
    }
  }
  return {
    galleryPictureCaption:
      drawThreadEntry.imagineThreadEntryKind === 'prompt' ? drawThreadEntry.imaginePromptText : `Brought in: ${drawThreadEntry.broughtInPictureFileName}`,
    drawThreadEntryId: drawThreadEntry.imagineThreadEntryId,
  }
}

interface PapelizImagineGalleryLargerViewProps {
  imaginePicture: PapelizImaginePicture
  galleryPictureCaption: string
  drawThreadEntryId: string | null
  onLargerViewClose: () => void
}

// A picture opened from Gallery, as large as the window allows, with its whole prompt and Show in
// Draw, on the browser's own <dialog> (focus stays inside, Esc closes).
function PapelizImagineGalleryLargerView({ imaginePicture, galleryPictureCaption, drawThreadEntryId, onLargerViewClose }: PapelizImagineGalleryLargerViewProps) {
  const largerViewDialogRef = useRef<HTMLDialogElement>(null)
  const drawSectionLabel = readPapelizImagineSectionLabel('draw')
  // What focus goes back to when the dialog closes, read once before the dialog takes focus.
  const [focusedBeforeLargerView] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null))

  useEffect(() => {
    const largerViewDialogElement = largerViewDialogRef.current
    if (largerViewDialogElement === null) return
    largerViewDialogElement.showModal()
    return () => {
      largerViewDialogElement.close()
      if (focusedBeforeLargerView?.isConnected && (document.activeElement === null || document.activeElement === document.body)) focusedBeforeLargerView.focus()
    }
  }, [focusedBeforeLargerView])

  return (
    <dialog
      ref={largerViewDialogRef}
      aria-label={galleryPictureCaption}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onLargerViewClose()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === largerViewDialogRef.current) onLargerViewClose()
      }}
      className="papeliz-dialog-enter m-auto flex max-h-[calc(100dvh-32px)] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="flex flex-none items-center justify-end p-2 pb-0">
        <PapelizIconButton iconButtonLabel="Close" iconButtonSize="small" onClick={onLargerViewClose}>
          <X className="size-4" aria-hidden="true" />
        </PapelizIconButton>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5">
        <img
          src={imaginePicture.imaginePicturePreviewUrl}
          alt={imaginePicture.imaginePictureDescriptionText}
          className="max-h-[60dvh] w-full rounded-2xl bg-papeliz-surface-soft object-contain"
          draggable={false}
        />
        <p className="papeliz-selectable-text text-[14.5px] leading-relaxed break-words whitespace-pre-wrap">{galleryPictureCaption}</p>
        <p className="text-[12.5px] text-papeliz-ink-muted">
          {imaginePicture.imaginePictureModelLabel ?? 'Brought in'} · {describePapelizImaginePictureMetadataLine(imaginePicture)}
        </p>
        {drawThreadEntryId !== null && (
          <PapelizPillButton
            className="self-start"
            pillButtonVariant="outline"
            pillButtonSize="small"
            onClick={() => {
              onLargerViewClose()
              usePapelizImagineSectionStore.getState().showDrawThreadEntry(drawThreadEntryId)
            }}
          >
            <Paintbrush className="size-3.5" aria-hidden="true" />
            Show in {drawSectionLabel}
          </PapelizPillButton>
        )}
      </div>
    </dialog>
  )
}

// Gallery: every picture made or brought in since the page opened, newest first, two across in the
// panel and more when it is wider. Each keeps Remove C2PA, Save to Vault and Put in Note, and opens
// larger when pressed. A picture dropped here is brought in.
export function PapelizImagineGallerySection({ isPictureDraggedOverSection }: { isPictureDraggedOverSection: boolean }) {
  const imaginePictures = usePapelizImagineStore((imagineState) => imagineState.imaginePictures)
  const imagineThreadEntries = usePapelizImagineStore((imagineState) => imagineState.imagineThreadEntries)
  const imaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.imaginePictureInsertion)
  const chooseImagineSection = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.chooseImagineSection)
  const [openedImaginePictureId, setOpenedImaginePictureId] = useState<string | null>(null)
  const openedImaginePicture = imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === openedImaginePictureId) ?? null
  const isInsertionPictureShown = imaginePictureInsertion !== null && imaginePictures.some((imaginePicture) => imaginePicture.imaginePictureId === imaginePictureInsertion.imaginePictureId)
  const drawSectionLabel = readPapelizImagineSectionLabel('draw')

  return (
    <div
      className={joinPapelizClassNames(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-3 pb-4',
        isPictureDraggedOverSection && 'rounded-2xl outline-2 -outline-offset-4 outline-papeliz-blue outline-dashed',
      )}
    >
      {imaginePictures.length === 0 ? (
        <div className="papeliz-pop-enter m-auto flex max-w-[300px] flex-col items-center gap-3 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
            <Images className="size-[18px]" aria-hidden="true" />
          </span>
          <p className="text-sm text-papeliz-ink-muted">Every picture you draw or bring in shows here, newest first.</p>
          <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => chooseImagineSection('draw')}>
            <Paintbrush className="size-3.5" aria-hidden="true" />
            Go to {drawSectionLabel}
          </PapelizPillButton>
        </div>
      ) : (
        <>
          {isInsertionPictureShown && imaginePictureInsertion !== null && <PapelizImaginePictureInsertionCard imaginePictureInsertion={imaginePictureInsertion} />}
          <ul aria-label="Gallery" className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2.5">
            {imaginePictures.map((imaginePicture) => (
              <PapelizImaginePictureCard
                key={imaginePicture.imaginePictureId}
                imaginePicture={imaginePicture}
                pictureCardCaption={describePapelizImagineGalleryPicture(imaginePicture, imagineThreadEntries).galleryPictureCaption}
                onPictureCardOpen={() => setOpenedImaginePictureId(imaginePicture.imaginePictureId)}
              />
            ))}
          </ul>
        </>
      )}
      {openedImaginePicture !== null && (
        <PapelizImagineGalleryLargerView
          imaginePicture={openedImaginePicture}
          {...describePapelizImagineGalleryPicture(openedImaginePicture, imagineThreadEntries)}
          onLargerViewClose={() => setOpenedImaginePictureId(null)}
        />
      )}
    </div>
  )
}
