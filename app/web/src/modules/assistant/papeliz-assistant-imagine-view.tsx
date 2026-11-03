import { useState, type DragEvent } from 'react'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizImagineAskSection } from './papeliz-assistant-imagine-ask'
import { PapelizImagineDrawSection } from './papeliz-assistant-imagine-draw'
import { PapelizImagineGallerySection } from './papeliz-assistant-imagine-gallery'
import { papelizImagineSectionChoices, readPapelizImagineSectionLabel, usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import { usePapelizImagineStore } from './papeliz-assistant-imagine-store'

// A picture dragged over a section that takes pictures (Draw and Gallery) is brought in on drop.
function usePapelizImaginePictureDrop() {
  const bringInImaginePictureFiles = usePapelizImagineStore((imagineState) => imagineState.bringInImaginePictureFiles)
  const [isPictureDraggedOverSection, setIsPictureDraggedOverSection] = useState(false)
  const bringInPictureFiles = (pictureFiles: readonly File[]) => {
    if (pictureFiles.length > 0) void bringInImaginePictureFiles(pictureFiles)
  }
  const pictureDropHandlers = {
    onDragOver: (pictureDragEvent: DragEvent<HTMLElement>) => {
      if (![...pictureDragEvent.dataTransfer.types].includes('Files')) return
      pictureDragEvent.preventDefault()
      pictureDragEvent.dataTransfer.dropEffect = 'copy'
      setIsPictureDraggedOverSection(true)
    },
    onDragLeave: (pictureDragEvent: DragEvent<HTMLElement>) => {
      if (!pictureDragEvent.currentTarget.contains(pictureDragEvent.relatedTarget as Node | null)) setIsPictureDraggedOverSection(false)
    },
    onDrop: (pictureDropEvent: DragEvent<HTMLElement>) => {
      if (pictureDropEvent.dataTransfer.files.length === 0) return
      pictureDropEvent.preventDefault()
      setIsPictureDraggedOverSection(false)
      bringInPictureFiles([...pictureDropEvent.dataTransfer.files])
    },
  }
  return { isPictureDraggedOverSection, bringInPictureFiles, pictureDropHandlers }
}

// Imagine, under its tab: a quiet switch at the top (a white pill, quieter than the blue Ask, Plan and
// Write switch and the tabs above it) between Ask (talk a picture through first), Draw (prompts and
// the pictures they make, opened first) and Gallery (every picture, newest first). A new picture shows
// in Draw and Gallery at once. Pictures made or brought in, and Ask's talk, last while the page is open.
export function PapelizAssistantImagineView() {
  const chosenImagineSection = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.chosenImagineSection)
  const chooseImagineSection = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.chooseImagineSection)
  const { isPictureDraggedOverSection, bringInPictureFiles, pictureDropHandlers } = usePapelizImaginePictureDrop()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="@container flex-none px-3.5 pt-2.5">
        <PapelizSlidingChoiceGroup
          slidingChoiceGroupLabel="Imagine"
          slidingChoiceGroupRole="tablist"
          slidingChoiceGroupTone="white-pill"
          chosenSlidingChoiceValue={chosenImagineSection}
          onSlidingChoiceSelect={chooseImagineSection}
          slidingChoices={papelizImagineSectionChoices.map(({ imagineSection, imagineSectionLabel, ImagineSectionIcon }) => ({
            slidingChoiceValue: imagineSection,
            slidingChoiceTitle: imagineSectionLabel,
            slidingChoiceContent: (
              <>
                <ImagineSectionIcon className="size-3.5 flex-none" aria-hidden="true" />
                <span className="truncate @max-[15rem]:sr-only">{imagineSectionLabel}</span>
              </>
            ),
          }))}
        />
      </div>
      <div
        role="tabpanel"
        aria-label={readPapelizImagineSectionLabel(chosenImagineSection)}
        className="flex min-h-0 flex-1 flex-col"
        {...(chosenImagineSection === 'ask' ? {} : pictureDropHandlers)}
      >
        {chosenImagineSection === 'ask' ? (
          <PapelizImagineAskSection />
        ) : chosenImagineSection === 'draw' ? (
          <PapelizImagineDrawSection onBringInPictureFiles={bringInPictureFiles} isPictureDraggedOverSection={isPictureDraggedOverSection} />
        ) : (
          <PapelizImagineGallerySection isPictureDraggedOverSection={isPictureDraggedOverSection} />
        )}
      </div>
    </div>
  )
}
