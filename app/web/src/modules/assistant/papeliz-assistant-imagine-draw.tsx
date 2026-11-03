import { ChevronDown, ImagePlus, ImageUp, Paintbrush, SlidersHorizontal, TextCursorInput } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import type { PapelizPopoverMenuItem } from '../ui/papeliz-popover-menu'
import {
  PapelizImagineBox,
  PapelizImagineBoxMenuButton,
  PapelizImagineBoxNotice,
  PapelizImagineBoxSendButton,
  PapelizImagineBoxStopButton,
} from './papeliz-assistant-imagine-box'
import {
  findPapelizAssistantImageAspectRatioDisplay,
  listPapelizAssistantImageAspectRatioChoices,
  resolvePapelizAssistantImageAspectRatioChoice,
} from './papeliz-assistant-image-aspect-ratios'
import { PapelizImaginePictureCard, PapelizImaginePictureInsertionCard } from './papeliz-assistant-imagine-picture-card'
import { usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import {
  describePapelizImagineMakingLine,
  papelizImagineMaximumGeneratedPictureCount,
  selectIsPapelizImagineMaking,
  usePapelizImagineStore,
  type PapelizImagineThreadEntry,
} from './papeliz-assistant-imagine-store'
import { usePapelizAssistantMediaModelChoicesStore } from './papeliz-assistant-media-model-choices-store'
import { PapelizAssistantMediaOtherModelForm, PapelizAssistantMediaProblemLine, usePapelizChosenAssistantMediaModel } from './papeliz-assistant-media-parts'
import { findPapelizAssistantImageGenerationPreset } from './papeliz-assistant-media-provider-presets'
import { useIsPapelizOnePressMicBusy, usePapelizOnePressMic } from './papeliz-assistant-one-press-mic'
import { joinPapelizTranscribedWordsToText } from './papeliz-assistant-one-press-mic-controller'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'

// Prompts the empty thread offers; a press puts one in the box, to send as it is or after a change.
const papelizImagineExamplePromptTexts = [
  'A watercolor lighthouse at dawn',
  'A flat blue and white icon of a notebook',
  'A cozy reading corner in warm afternoon light',
  'A pencil sketch of a mountain trail map',
] as const

// How long an entry stays marked after Show in Draw brings it into view.
const papelizShownDrawThreadEntryMarkMilliseconds = 1600

// Puts the caret at the end of a box's text and focuses it, once the text has landed.
export function focusPapelizImagineBoxTextAtEnd(boxTextArea: HTMLTextAreaElement | null): void {
  requestAnimationFrame(() => {
    if (boxTextArea === null) return
    boxTextArea.focus()
    boxTextArea.setSelectionRange(boxTextArea.value.length, boxTextArea.value.length)
  })
}

// One entry in Draw's thread: the prompt as the person's message and the pictures it made under it
// (or "Making the picture with …", or what went wrong), or a picture brought in.
function PapelizImagineDrawThreadEntryView({ imagineThreadEntry, isDrawThreadEntryMarked }: { imagineThreadEntry: PapelizImagineThreadEntry; isDrawThreadEntryMarked: boolean }) {
  const imaginePictures = usePapelizImagineStore((imagineState) => imagineState.imaginePictures)
  const imaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.imaginePictureInsertion)
  const entryImaginePictures = imaginePictures.filter((imaginePicture) => imagineThreadEntry.imaginePictureIds.includes(imaginePicture.imaginePictureId))
  const isEntryInsertionShown = imaginePictureInsertion !== null && imagineThreadEntry.imaginePictureIds.includes(imaginePictureInsertion.imaginePictureId)
  const entryProblem = imagineThreadEntry.imagineThreadEntryKind === 'prompt' ? imagineThreadEntry.imaginePromptProblem : imagineThreadEntry.broughtInPictureProblem

  return (
    <section
      data-papeliz-imagine-thread-entry-id={imagineThreadEntry.imagineThreadEntryId}
      aria-label={
        imagineThreadEntry.imagineThreadEntryKind === 'prompt' ? `Imagine: ${imagineThreadEntry.imaginePromptText}` : `Brought in: ${imagineThreadEntry.broughtInPictureFileName}`
      }
      className={joinPapelizClassNames(
        'papeliz-pop-enter flex flex-col gap-2 rounded-[22px] transition-[box-shadow,background-color] duration-300',
        isDrawThreadEntryMarked && 'bg-papeliz-blue-soft shadow-[0_0_0_6px_var(--color-papeliz-blue-soft)]',
      )}
    >
      <div className="flex flex-col items-end gap-1">
        {imagineThreadEntry.imagineThreadEntryKind === 'prompt' && imagineThreadEntry.imaginePromptPlace !== 'imagine' && (
          <span className="px-2 text-[11.5px] text-papeliz-ink-subtle">{imagineThreadEntry.imaginePromptPlace === 'chat' ? 'From the Notes tab' : 'From a note'}</span>
        )}
        <div className="papeliz-selectable-text flex max-w-[88%] min-w-0 items-start gap-2 rounded-[20px] bg-papeliz-surface-gray px-3.5 py-2.5 text-sm whitespace-pre-wrap">
          {imagineThreadEntry.imagineThreadEntryKind === 'prompt' ? (
            <span className="min-w-0 break-words">{imagineThreadEntry.imaginePromptText}</span>
          ) : (
            <>
              <ImageUp className="mt-0.5 size-4 flex-none text-papeliz-blue" aria-hidden="true" />
              <span className="min-w-0 break-all">Brought in: {imagineThreadEntry.broughtInPictureFileName}</span>
            </>
          )}
        </div>
      </div>
      {imagineThreadEntry.imagineThreadEntryKind === 'prompt' && imagineThreadEntry.imaginePromptStage === 'making' ? (
        <p className="flex items-center gap-2 text-[13px] text-papeliz-ink-muted" aria-live="polite">
          <span className="papeliz-saving-dot size-1.5 flex-none rounded-full bg-papeliz-blue" aria-hidden="true" />
          {describePapelizImagineMakingLine(imagineThreadEntry.requestedPictureCount, imagineThreadEntry.imageModelLabel)}
        </p>
      ) : imagineThreadEntry.imagineThreadEntryKind === 'prompt' && imagineThreadEntry.imaginePromptStage === 'stopped' ? (
        <p className="text-[13px] text-papeliz-ink-subtle">Stopped. Nothing was made.</p>
      ) : entryProblem !== null ? (
        <PapelizAssistantMediaProblemLine>{entryProblem}</PapelizAssistantMediaProblemLine>
      ) : (
        <ul aria-label="Pictures" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2.5">
          {entryImaginePictures.map((imaginePicture) => (
            <PapelizImaginePictureCard key={imaginePicture.imaginePictureId} imaginePicture={imaginePicture} />
          ))}
        </ul>
      )}
      {isEntryInsertionShown && <PapelizImaginePictureInsertionCard imaginePictureInsertion={imaginePictureInsertion} />}
    </section>
  )
}

// Draw's box: the prompt, then + (bring in a picture, or transcribe an audio file into the prompt), the
// picture model, its aspect ratio and how many, the one-press mic and Send, which is Stop while
// pictures are being made. Before a provider that makes pictures is added the box still shows, with a
// line to choose one, and the mic opens the settings.
function PapelizImagineDrawBox({
  promptTextAreaRef,
  isPictureDraggedOverDraw,
  onBringInPictureFiles,
}: {
  promptTextAreaRef: RefObject<HTMLTextAreaElement | null>
  isPictureDraggedOverDraw: boolean
  onBringInPictureFiles: (pictureFiles: readonly File[]) => void
}) {
  const { offeredMediaModels, chosenMediaModel, isMediaModelChosenAutomatically, mediaCapableSavedProviderIds } = usePapelizChosenAssistantMediaModel('image-generation')
  const chooseAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModel)
  const chooseAssistantMediaModelAutomatically = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModelAutomatically)
  const imaginePromptText = usePapelizImagineStore((imagineState) => imagineState.imaginePromptText)
  const imagineImageAspectRatio = usePapelizImagineStore((imagineState) => imagineState.imagineImageAspectRatio)
  const imagineGeneratedPictureCount = usePapelizImagineStore((imagineState) => imagineState.imagineGeneratedPictureCount)
  const isImagineMaking = usePapelizImagineStore(selectIsPapelizImagineMaking)
  const setImaginePromptText = usePapelizImagineStore((imagineState) => imagineState.setImaginePromptText)
  const setImagineImageAspectRatio = usePapelizImagineStore((imagineState) => imagineState.setImagineImageAspectRatio)
  const setImagineGeneratedPictureCount = usePapelizImagineStore((imagineState) => imagineState.setImagineGeneratedPictureCount)
  const sendImaginePrompt = usePapelizImagineStore((imagineState) => imagineState.sendImaginePrompt)
  const stopImagineGeneration = usePapelizImagineStore((imagineState) => imagineState.stopImagineGeneration)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const [isOtherImageModelFormOpen, setIsOtherImageModelFormOpen] = useState(false)
  const pictureFileInputRef = useRef<HTMLInputElement>(null)
  // The spoken words join the prompt, and the prompt takes focus with the caret after them.
  const drawOnePressMicStore = usePapelizOnePressMic((transcribedWords) => {
    const { imaginePromptText: typedPromptText, setImaginePromptText: setTypedPromptText } = usePapelizImagineStore.getState()
    setTypedPromptText(joinPapelizTranscribedWordsToText(typedPromptText, transcribedWords))
    focusPapelizImagineBoxTextAtEnd(promptTextAreaRef.current)
  })
  const isDrawMicBusy = useIsPapelizOnePressMicBusy(drawOnePressMicStore)

  const imageGenerationPreset = chosenMediaModel === null ? null : findPapelizAssistantImageGenerationPreset(chosenMediaModel.papelizAssistantProviderId)
  const chosenImageModelName = chosenMediaModel?.providerModelName ?? ''
  // Only the shapes the chosen model makes; one it can't make is left out, not greyed.
  const offeredImageAspectRatioChoices = listPapelizAssistantImageAspectRatioChoices(imageGenerationPreset, chosenImageModelName)
  const shownImageAspectRatioChoice = resolvePapelizAssistantImageAspectRatioChoice(imageGenerationPreset, chosenImageModelName, imagineImageAspectRatio)
  const shownImageAspectRatioDisplay = shownImageAspectRatioChoice === null ? null : findPapelizAssistantImageAspectRatioDisplay(shownImageAspectRatioChoice.imageAspectRatio)
  const imagineGeneratedPictureCountLabel = imagineGeneratedPictureCount === 1 ? '1 Picture' : `${imagineGeneratedPictureCount} Pictures`
  const canSendPrompt = chosenMediaModel !== null && imaginePromptText.trim().length > 0 && !isImagineMaking && !isDrawMicBusy
  const sendPrompt = () => {
    if (canSendPrompt) void sendImaginePrompt(chosenMediaModel)
  }

  // Automatic first (the first model offered, the Meta Model API's when it is added), then each
  // provider's models under its name, then Other Model and Models for Each Task. The chip and Draw's row
  // in Models for Each Task are one setting.
  const pictureModelMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'automatic',
      menuItemLabel: offeredMediaModels[0] === undefined ? 'Automatic' : `Automatic · ${offeredMediaModels[0].providerModelName}`,
      isMenuItemChecked: isMediaModelChosenAutomatically,
      onMenuItemSelect: () => void chooseAssistantMediaModelAutomatically('image-generation'),
    },
    ...offeredMediaModels.map((offeredMediaModel, offeredMediaModelIndex) => ({
      menuItemKey: `${offeredMediaModel.papelizAssistantProviderId}/${offeredMediaModel.providerModelName}`,
      menuItemLabel: offeredMediaModel.providerModelName,
      isMenuItemChecked:
        !isMediaModelChosenAutomatically &&
        chosenMediaModel !== null &&
        offeredMediaModel.papelizAssistantProviderId === chosenMediaModel.papelizAssistantProviderId &&
        offeredMediaModel.providerModelName === chosenMediaModel.providerModelName,
      // Each provider's models under its name.
      ...(offeredMediaModels[offeredMediaModelIndex - 1]?.papelizAssistantProviderId === offeredMediaModel.papelizAssistantProviderId
        ? {}
        : { menuItemGroupHeading: offeredMediaModel.providerDisplayName }),
      onMenuItemSelect: () =>
        void chooseAssistantMediaModel('image-generation', { papelizAssistantProviderId: offeredMediaModel.papelizAssistantProviderId, providerModelName: offeredMediaModel.providerModelName }),
    })),
    { menuItemKey: 'other-model', menuItemLabel: 'Other Model', MenuItemIcon: TextCursorInput, menuItemGroupHeading: 'Settings', onMenuItemSelect: () => setIsOtherImageModelFormOpen(true) },
    // Opens Settings › AI Provider, where Models for Each Task sits under the saved providers. It opens
    // at the top of the page: scrolling to the section needs the panel's own request for it.
    { menuItemKey: 'models-for-each-task', menuItemLabel: 'Models for Each Task', MenuItemIcon: SlidersHorizontal, onMenuItemSelect: () => requestAssistantProviderSettingsPage() },
  ]
  // Each shape as its ratio beside an outline drawn in it, then how many pictures, under a line.
  const aspectRatioAndCountMenuItems: PapelizPopoverMenuItem[] = [
    ...offeredImageAspectRatioChoices.map((imageAspectRatioChoice) => {
      const { imageAspectRatioLabel, ImageAspectRatioIcon } = findPapelizAssistantImageAspectRatioDisplay(imageAspectRatioChoice.imageAspectRatio)
      return {
        menuItemKey: `aspect-ratio-${imageAspectRatioChoice.imageAspectRatio}`,
        menuItemLabel: imageAspectRatioLabel,
        MenuItemIcon: ImageAspectRatioIcon,
        isMenuItemChecked: imageAspectRatioChoice.imageAspectRatio === shownImageAspectRatioChoice?.imageAspectRatio,
        onMenuItemSelect: () => setImagineImageAspectRatio(imageAspectRatioChoice.imageAspectRatio),
      }
    }),
    ...Array.from({ length: papelizImagineMaximumGeneratedPictureCount }, (_, countIndex) => countIndex + 1).map((pictureCount) => ({
      menuItemKey: `count-${pictureCount}`,
      menuItemLabel: pictureCount === 1 ? '1 Picture' : `${pictureCount} Pictures`,
      isMenuItemChecked: pictureCount === imagineGeneratedPictureCount,
      ...(pictureCount === 1 ? { menuItemGroupHeading: 'Pictures' } : {}),
      onMenuItemSelect: () => setImagineGeneratedPictureCount(pictureCount),
    })),
  ]

  return (
    <>
      <PapelizImagineBox
        boxTextAreaRef={promptTextAreaRef}
        boxText={imaginePromptText}
        boxTextLabel="Describe a picture"
        boxPlaceholder="Describe a picture…"
        onBoxTextChange={setImaginePromptText}
        onBoxSend={sendPrompt}
        onBoxPictureFilesPaste={onBringInPictureFiles}
        boxNotice={
          <>
            {chosenMediaModel === null &&
              (mediaCapableSavedProviderIds.length === 0 ? (
                <PapelizImagineBoxNotice
                  boxNoticeIcon={<ImagePlus className="size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />}
                  boxNoticeText="Choose a provider that makes pictures"
                  boxNoticeAction={
                    <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => requestAssistantProviderSettingsPage()}>
                      Choose a Provider
                    </PapelizPillButton>
                  }
                />
              ) : (
                // A provider that makes pictures is added, but none of its picture models is known yet.
                <PapelizImagineBoxNotice
                  boxNoticeIcon={<ImagePlus className="size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />}
                  boxNoticeText="Type the picture model your provider offers"
                  boxNoticeAction={
                    <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => setIsOtherImageModelFormOpen(true)}>
                      Other Model
                    </PapelizPillButton>
                  }
                />
              ))}
            {isOtherImageModelFormOpen && (
              <div className="mb-2 -ml-1.5">
                <PapelizAssistantMediaOtherModelForm assistantMediaKind="image-generation" onOtherModelFormClose={() => setIsOtherImageModelFormOpen(false)} />
              </div>
            )}
          </>
        }
        boxAddMenuItems={[{ menuItemKey: 'picture', menuItemLabel: 'Bring In a Picture', MenuItemIcon: ImageUp, onMenuItemSelect: () => pictureFileInputRef.current?.click() }]}
        boxAddButtonTitle="Bring in a picture (or paste or drop one here), or transcribe an audio file into the prompt"
        audioFileInputLabel="Transcribe an audio file into the prompt"
        boxChips={
          chosenMediaModel !== null && (
            <>
              <PapelizImagineBoxMenuButton
                menuLabel="Picture Model"
                menuItems={pictureModelMenuItems}
                menuButtonAriaLabel={`Picture model: ${chosenMediaModel.providerModelName}`}
                menuButtonTitle={`Picture model, on ${chosenMediaModel.providerDisplayName}. Click to change.`}
                menuButtonClassName="max-w-[45%] flex-shrink"
              >
                <span className="truncate">{chosenMediaModel.providerModelName}</span>
                <ChevronDown className="size-3 flex-none opacity-70" aria-hidden="true" />
              </PapelizImagineBoxMenuButton>
              <PapelizImagineBoxMenuButton
                menuLabel={shownImageAspectRatioDisplay === null ? 'Pictures' : 'Aspect Ratio and Pictures'}
                menuItems={aspectRatioAndCountMenuItems}
                menuButtonAriaLabel={`${shownImageAspectRatioDisplay === null ? '' : `Aspect ratio: ${shownImageAspectRatioDisplay.imageAspectRatioLabel}, `}${imagineGeneratedPictureCountLabel.toLowerCase()}`}
                menuButtonTitle={
                  shownImageAspectRatioDisplay === null ? 'How many pictures to make. Click to change.' : 'The aspect ratio, and how many pictures to make. Click to change.'
                }
              >
                {shownImageAspectRatioDisplay === null ? (
                  // The model offers no shape: only the count shows.
                  <span className="tabular-nums">{imagineGeneratedPictureCountLabel}</span>
                ) : (
                  <>
                    <shownImageAspectRatioDisplay.ImageAspectRatioIcon className="size-3.5 flex-none" aria-hidden="true" />
                    {/* On a narrow box the ratio shows as its icon and the count, so the model keeps its name. */}
                    <span className="hidden @min-[20rem]:inline">{shownImageAspectRatioDisplay.imageAspectRatioLabel} ·</span>
                    <span className="tabular-nums">{imagineGeneratedPictureCount}</span>
                  </>
                )}
                <ChevronDown className="size-3 flex-none opacity-70" aria-hidden="true" />
              </PapelizImagineBoxMenuButton>
            </>
          )
        }
        onePressMicStore={drawOnePressMicStore}
        // Before a provider that makes pictures is added there is nothing to send the words to: the mic opens the settings.
        onMicPressInstead={chosenMediaModel === null ? () => requestAssistantProviderSettingsPage() : undefined}
        boxSendControls={
          isImagineMaking ? (
            <PapelizImagineBoxStopButton stopButtonTitle="Stop making the picture" onStop={stopImagineGeneration} />
          ) : (
            <PapelizImagineBoxSendButton
              sendButtonTitle={chosenMediaModel === null ? 'Choose a provider that makes pictures first' : 'Make the picture (Enter)'}
              isSendDisabled={!canSendPrompt}
              onSend={sendPrompt}
            />
          )
        }
        isBoxLit={isPictureDraggedOverDraw}
      />
      <input
        ref={pictureFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        aria-label="Bring in a picture"
        onChange={(fileInputEvent) => {
          onBringInPictureFiles([...(fileInputEvent.target.files ?? [])])
          fileInputEvent.target.value = ''
        }}
      />
    </>
  )
}

// Draw: the thread on top, oldest first, scrolled to the newest, and the box pinned below it. Each
// prompt shows as the person's message with the pictures it made under it; a picture brought in shows
// as its own entry. A picture can be brought in with +, pasted in the box, or dropped on Draw.
// Nothing is sent until Send.
export function PapelizImagineDrawSection({ onBringInPictureFiles, isPictureDraggedOverSection }: { onBringInPictureFiles: (pictureFiles: readonly File[]) => void; isPictureDraggedOverSection: boolean }) {
  const imagineThreadEntries = usePapelizImagineStore((imagineState) => imagineState.imagineThreadEntries)
  const setImaginePromptText = usePapelizImagineStore((imagineState) => imagineState.setImaginePromptText)
  const drawThreadEntryIdToShow = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.drawThreadEntryIdToShow)
  const isDrawBoxFocusPending = usePapelizImagineSectionStore((imagineSectionState) => imagineSectionState.isDrawBoxFocusPending)
  const threadScrollAreaRef = useRef<HTMLDivElement>(null)
  const promptTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const hasThreadScrolledRef = useRef(false)
  const newestImagineThreadEntry = imagineThreadEntries.at(-1)

  useEffect(() => {
    // To the newest entry: at once when Draw opens, smoothly as entries come and change.
    const threadScrollArea = threadScrollAreaRef.current
    if (threadScrollArea === null) return
    threadScrollArea.scrollTo({ top: threadScrollArea.scrollHeight, behavior: hasThreadScrolledRef.current ? 'smooth' : 'auto' })
    hasThreadScrolledRef.current = true
  }, [imagineThreadEntries.length, newestImagineThreadEntry])

  useEffect(() => {
    // Show in Draw: the entry comes into view, marked until the moment passes.
    if (drawThreadEntryIdToShow === null) return
    const shownEntryElement = threadScrollAreaRef.current?.querySelector(`[data-papeliz-imagine-thread-entry-id="${CSS.escape(drawThreadEntryIdToShow)}"]`)
    shownEntryElement?.scrollIntoView({ block: 'center', behavior: 'auto' })
    const markTimeout = window.setTimeout(() => usePapelizImagineSectionStore.getState().finishShowingDrawThreadEntry(), papelizShownDrawThreadEntryMarkMilliseconds)
    return () => window.clearTimeout(markTimeout)
  }, [drawThreadEntryIdToShow])

  useEffect(() => {
    // Draw This, from Ask: the prompt is in the box, ready to send or change.
    if (!isDrawBoxFocusPending) return
    usePapelizImagineSectionStore.getState().finishFocusingDrawBox()
    focusPapelizImagineBoxTextAtEnd(promptTextAreaRef.current)
  }, [isDrawBoxFocusPending])

  const fillPromptWithExample = (examplePromptText: string) => {
    setImaginePromptText(examplePromptText)
    focusPapelizImagineBoxTextAtEnd(promptTextAreaRef.current)
  }

  return (
    <>
      <div ref={threadScrollAreaRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-3 pb-3">
        {imagineThreadEntries.length === 0 ? (
          <div className="papeliz-pop-enter m-auto flex max-w-[320px] flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
              <Paintbrush className="size-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm text-papeliz-ink-muted">
              Describe a picture, and your provider makes it with your own key, straight from {isPapelizDesktopApp ? 'this computer' : 'this browser'}. Nothing is sent
              until Send.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {papelizImagineExamplePromptTexts.map((examplePromptText) => (
                <button key={examplePromptText} type="button" className="papeliz-assistant-suggestion-chip" onClick={() => fillPromptWithExample(examplePromptText)}>
                  {examplePromptText}
                </button>
              ))}
            </div>
            <p className={joinPapelizClassNames('text-xs text-papeliz-ink-subtle', isPictureDraggedOverSection && 'font-medium text-papeliz-blue')}>
              Bring in a picture with +, or drop one here, to clean it of C2PA and save it.
            </p>
          </div>
        ) : (
          imagineThreadEntries.map((imagineThreadEntry) => (
            <PapelizImagineDrawThreadEntryView
              key={imagineThreadEntry.imagineThreadEntryId}
              imagineThreadEntry={imagineThreadEntry}
              isDrawThreadEntryMarked={imagineThreadEntry.imagineThreadEntryId === drawThreadEntryIdToShow}
            />
          ))
        )}
      </div>
      <PapelizImagineDrawBox promptTextAreaRef={promptTextAreaRef} isPictureDraggedOverDraw={isPictureDraggedOverSection} onBringInPictureFiles={onBringInPictureFiles} />
    </>
  )
}
