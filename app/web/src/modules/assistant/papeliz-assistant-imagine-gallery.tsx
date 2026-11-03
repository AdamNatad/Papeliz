import { Images, Paintbrush } from 'lucide-react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizImaginePictureCard, PapelizImaginePictureInsertionCard } from './papeliz-assistant-imagine-picture-card'
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

// Gallery: every picture made or brought in since the page opened, newest first, two across in the
// panel and more when it is wider. Each keeps Remove Metadata, Save to Vault and Put in Note, and opens
// in the lightbox when pressed, with Show in Draw. A picture dropped here is brought in.
export function PapelizImagineGallerySection({ isPictureDraggedOverSection }: { isPictureDraggedOverSection: boolean }) {
  const imaginePictures = usePapelizImagineStore((imagineState) => imagineState.imaginePictures)
  const imagineThreadEntries = usePapelizImagineStore((imagineState) => imagineState.imagineThreadEntries)
  const imaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.imaginePictureInsertion)
  const chooseImagineSection = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.chooseImagineSection)
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
          <ul aria-label="Gallery" className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-5">
            {imaginePictures.map((imaginePicture) => {
              const { galleryPictureCaption, drawThreadEntryId } = describePapelizImagineGalleryPicture(imaginePicture, imagineThreadEntries)
              return (
                <PapelizImaginePictureCard
                  key={imaginePicture.imaginePictureId}
                  imaginePicture={imaginePicture}
                  pictureCardCaption={galleryPictureCaption}
                  showInDrawThreadEntryId={drawThreadEntryId}
                />
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
