import { FileAudio, FileInput, ImagePlus, ImageUp, Plus, Save, Sparkles, Square, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizListboxSelect } from '../ui/papeliz-listbox-select'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { describePapelizRemovedImageMetadata, hasPapelizContentCredentials } from './papeliz-assistant-image-metadata-strip'
import { papelizImagineMaximumGeneratedPictureCount, usePapelizImagineStore, type PapelizImaginePicture } from './papeliz-assistant-imagine-store'
import {
  PapelizAssistantMediaModelPicker,
  PapelizAssistantMediaNoteDiffCard,
  PapelizAssistantMediaProblemLine,
  PapelizAssistantMediaSectionHeading,
  PapelizAssistantMediaSetupCard,
  PapelizAssistantMediaSwitch,
  usePapelizChosenAssistantMediaModel,
} from './papeliz-assistant-media-parts'
import { findPapelizAssistantImageGenerationPreset } from './papeliz-assistant-media-provider-presets'
import {
  PapelizOnePressMicAudioFileInput,
  PapelizOnePressMicButton,
  PapelizOnePressMicProblemLine,
  PapelizOnePressMicRecorderRow,
  handlePapelizOnePressMicKey,
  useIsPapelizOnePressMicBusy,
  usePapelizOnePressMic,
} from './papeliz-assistant-one-press-mic'
import { joinPapelizTranscribedWordsToText } from './papeliz-assistant-one-press-mic-controller'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'

// What a picture carries, and what Remove C2PA does with it, in one line under the picture.
function describeImaginePictureMetadataLine(imaginePicture: PapelizImaginePicture): string {
  if (imaginePicture.removedMetadataNamesWhenSaved !== null) {
    return imaginePicture.removedMetadataNamesWhenSaved.length > 0
      ? `Saved without ${describePapelizRemovedImageMetadata(imaginePicture.removedMetadataNamesWhenSaved)}.`
      : imaginePicture.isRemoveC2paOn
        ? 'Saved. It carried no metadata.'
        : 'Saved as it came, metadata and all.'
  }
  const imaginePictureMetadataNames = imaginePicture.imaginePictureMetadataNames
  if (imaginePictureMetadataNames === null) return 'This picture can’t be read to clean it, so it can’t be saved cleaned.'
  if (imaginePictureMetadataNames.length === 0) return 'No metadata found.'
  const metadataDescription = describePapelizRemovedImageMetadata(imaginePictureMetadataNames)
  return imaginePicture.isRemoveC2paOn ? `Carries ${metadataDescription}. Removed when saved.` : `Carries ${metadataDescription}. Kept when saved.`
}

// One picture in the grid (and in the chat): the picture, Remove C2PA, and what can be done with it.
export function PapelizImaginePictureCard({ imaginePicture }: { imaginePicture: PapelizImaginePicture }) {
  const setImaginePictureRemoveC2pa = usePapelizImagineStore((imagineState) => imagineState.setImaginePictureRemoveC2pa)
  const saveImaginePictureToVault = usePapelizImagineStore((imagineState) => imagineState.saveImaginePictureToVault)
  const proposeImaginePictureInNote = usePapelizImagineStore((imagineState) => imagineState.proposeImaginePictureInNote)
  const removeImaginePicture = usePapelizImagineStore((imagineState) => imagineState.removeImaginePicture)
  const isVaultOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault !== null)
  const isMarkdownNoteOpen = usePapelizWorkspaceStore((workspaceState) => selectActiveVaultMarkdownNoteRelativePath(workspaceState) !== null)
  const [isPictureActionRunning, setIsPictureActionRunning] = useState(false)
  const isPictureUnreadable = imaginePicture.imaginePictureMetadataNames === null
  const isSaveBlocked = isPictureUnreadable && imaginePicture.isRemoveC2paOn
  const runPictureAction = async (pictureAction: () => Promise<void>) => {
    setIsPictureActionRunning(true)
    try {
      await pictureAction()
    } finally {
      setIsPictureActionRunning(false)
    }
  }

  return (
    <li
      className="flex min-w-0 flex-col gap-2 rounded-2xl bg-papeliz-surface p-2 shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]"
      aria-label={imaginePicture.imaginePictureOrigin === 'generated' ? `Picture of ${imaginePicture.imaginePictureDescriptionText}` : imaginePicture.imaginePictureDescriptionText}
    >
      <div className="relative overflow-hidden rounded-xl bg-papeliz-surface-soft">
        <img
          src={imaginePicture.imaginePicturePreviewUrl}
          alt={imaginePicture.imaginePictureDescriptionText}
          className="block aspect-square w-full object-contain"
          draggable={false}
        />
        <PapelizIconButton
          iconButtonLabel="Remove from Imagine"
          iconButtonSize="small"
          className="absolute top-1.5 right-1.5 bg-papeliz-surface/90 shadow-[0_1px_2px_rgb(16_24_40/0.12)]"
          onClick={() => removeImaginePicture(imaginePicture.imaginePictureId)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </PapelizIconButton>
      </div>
      <p className="truncate px-0.5 text-[12px] text-papeliz-ink-muted" title={imaginePicture.imaginePictureModelLabel ?? imaginePicture.imaginePictureDescriptionText}>
        {imaginePicture.imaginePictureModelLabel ?? 'Brought in'}
        {hasPapelizContentCredentials(imaginePicture.imaginePictureMetadataNames ?? []) && (
          <span className="ml-1.5 rounded-full bg-papeliz-blue-soft px-1.5 py-px text-[11px] font-semibold text-papeliz-blue">C2PA</span>
        )}
      </p>
      <div className="flex flex-col gap-1 px-0.5">
        <PapelizAssistantMediaSwitch
          mediaSwitchLabel="Remove C2PA"
          isMediaSwitchOn={imaginePicture.isRemoveC2paOn}
          isMediaSwitchDisabled={imaginePicture.savedVaultFileRelativePath !== null}
          onMediaSwitchToggle={(isRemoveC2paOn) => setImaginePictureRemoveC2pa(imaginePicture.imaginePictureId, isRemoveC2paOn)}
        />
        <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle" aria-live="polite">
          {describeImaginePictureMetadataLine(imaginePicture)}
        </p>
      </div>
      {imaginePicture.savedVaultFileRelativePath !== null && (
        <p className="truncate px-0.5 text-[11.5px] text-papeliz-ink-muted" title={imaginePicture.savedVaultFileRelativePath}>
          In the vault: {getVaultEntryName(imaginePicture.savedVaultFileRelativePath)}
        </p>
      )}
      {imaginePicture.imaginePictureProblem !== null && <PapelizAssistantMediaProblemLine>{imaginePicture.imaginePictureProblem}</PapelizAssistantMediaProblemLine>}
      <div className="flex flex-wrap items-center gap-1.5">
        <PapelizPillButton
          pillButtonVariant="primary"
          pillButtonSize="small"
          disabled={!isMarkdownNoteOpen || isSaveBlocked || isPictureActionRunning}
          title={isMarkdownNoteOpen ? 'Put the picture in the open note, after the line the cursor is on' : 'Open a note first'}
          onClick={() => void runPictureAction(() => proposeImaginePictureInNote(imaginePicture.imaginePictureId))}
        >
          <FileInput className="size-3.5" aria-hidden="true" />
          Put in Note
        </PapelizPillButton>
        <PapelizPillButton
          pillButtonVariant="outline"
          pillButtonSize="small"
          disabled={!isVaultOpen || isSaveBlocked || isPictureActionRunning || imaginePicture.savedVaultFileRelativePath !== null}
          onClick={() => void runPictureAction(() => saveImaginePictureToVault(imaginePicture.imaginePictureId))}
        >
          <Save className="size-3.5" aria-hidden="true" />
          {imaginePicture.savedVaultFileRelativePath === null ? 'Save to Vault' : 'Saved'}
        </PapelizPillButton>
      </div>
    </li>
  )
}

// Imagine, in place of the chat: a prompt, the image model and size, Generate, and the pictures in a
// grid, with a place to bring in a picture of one's own. The prompt box has its own + (bring in a
// picture, or transcribe an audio file into the prompt) and the one-press mic, which fills the prompt;
// nothing is made until Generate.
export function PapelizAssistantImagineView() {
  const { offeredMediaModels, chosenMediaModel, mediaCapableSavedProviderIds } = usePapelizChosenAssistantMediaModel('image-generation')
  const imaginePromptText = usePapelizImagineStore((imagineState) => imagineState.imaginePromptText)
  const imagineImageSizeText = usePapelizImagineStore((imagineState) => imagineState.imagineImageSizeText)
  const imagineGeneratedPictureCount = usePapelizImagineStore((imagineState) => imagineState.imagineGeneratedPictureCount)
  const imagineGenerationStage = usePapelizImagineStore((imagineState) => imagineState.imagineGenerationStage)
  const imagineGenerationProblem = usePapelizImagineStore((imagineState) => imagineState.imagineGenerationProblem)
  const imaginePictures = usePapelizImagineStore((imagineState) => imagineState.imaginePictures)
  const imaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.imaginePictureInsertion)
  const setImaginePromptText = usePapelizImagineStore((imagineState) => imagineState.setImaginePromptText)
  const setImagineImageSizeText = usePapelizImagineStore((imagineState) => imagineState.setImagineImageSizeText)
  const setImagineGeneratedPictureCount = usePapelizImagineStore((imagineState) => imagineState.setImagineGeneratedPictureCount)
  const generateImaginePictures = usePapelizImagineStore((imagineState) => imagineState.generateImaginePictures)
  const stopImagineGeneration = usePapelizImagineStore((imagineState) => imagineState.stopImagineGeneration)
  const bringInImaginePictureFiles = usePapelizImagineStore((imagineState) => imagineState.bringInImaginePictureFiles)
  const acceptImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.acceptImaginePictureInsertion)
  const rejectImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.rejectImaginePictureInsertion)
  const [broughtInPictureProblem, setBroughtInPictureProblem] = useState<string | null>(null)
  const [isPictureDragOver, setIsPictureDragOver] = useState(false)
  const pictureFileInputRef = useRef<HTMLInputElement>(null)
  const imagineFieldId = useId()
  const promptTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const imagineAudioFileInputRef = useRef<HTMLInputElement>(null)
  const [promptAddMenuPosition, setPromptAddMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  // The spoken words join the prompt, and the prompt takes focus with the caret after them.
  const imagineOnePressMicStore = usePapelizOnePressMic((transcribedWords) => {
    const { imaginePromptText: typedPromptText, setImaginePromptText: setTypedPromptText } = usePapelizImagineStore.getState()
    setTypedPromptText(joinPapelizTranscribedWordsToText(typedPromptText, transcribedWords))
    requestAnimationFrame(() => {
      const promptTextArea = promptTextAreaRef.current
      if (promptTextArea === null) return
      promptTextArea.focus()
      promptTextArea.setSelectionRange(promptTextArea.value.length, promptTextArea.value.length)
    })
  })
  const isImagineMicBusy = useIsPapelizOnePressMicBusy(imagineOnePressMicStore)
  const insertionCardRef = useRef<HTMLDivElement>(null)

  const imageGenerationPreset = chosenMediaModel === null ? null : findPapelizAssistantImageGenerationPreset(chosenMediaModel.papelizAssistantProviderId)
  const imageSizeChoices = imageGenerationPreset?.imageSizeChoices ?? []
  const shownImageSizeText = imageSizeChoices.some((imageSizeChoice) => imageSizeChoice.imageSizeText === imagineImageSizeText)
    ? imagineImageSizeText
    : (imageSizeChoices[0]?.imageSizeText ?? null)
  const isGenerating = imagineGenerationStage === 'generating'
  const canGenerate = chosenMediaModel !== null && imaginePromptText.trim().length > 0 && !isGenerating

  useEffect(() => {
    if (imaginePictureInsertion !== null) insertionCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [imaginePictureInsertion])

  const bringInPictureFiles = async (pictureFiles: readonly File[]) => {
    if (pictureFiles.length === 0) return
    setBroughtInPictureProblem(await bringInImaginePictureFiles(pictureFiles))
  }
  const handlePictureDrop = (pictureDropEvent: DragEvent<HTMLElement>) => {
    pictureDropEvent.preventDefault()
    setIsPictureDragOver(false)
    void bringInPictureFiles([...pictureDropEvent.dataTransfer.files])
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 pt-2.5 pb-4"
      onDragOver={(pictureDragEvent) => {
        if (![...pictureDragEvent.dataTransfer.types].includes('Files')) return
        pictureDragEvent.preventDefault()
        setIsPictureDragOver(true)
      }}
      onDragLeave={(pictureDragEvent) => {
        if (!pictureDragEvent.currentTarget.contains(pictureDragEvent.relatedTarget as Node | null)) setIsPictureDragOver(false)
      }}
      onDrop={handlePictureDrop}
    >
      <p className="text-[12px] leading-snug text-papeliz-ink-muted">
        Make pictures with your own provider and key. Nothing is sent until Generate. Remove C2PA strips content credentials and other metadata before a picture is saved.
      </p>

      {offeredMediaModels.length === 0 && mediaCapableSavedProviderIds.length === 0 ? (
        <PapelizAssistantMediaSetupCard
          mediaSetupTitle="Add a provider that makes pictures"
          mediaSetupText="The Meta Model API (muse-image-1.0), OpenAI, Google Gemini, OpenRouter and Together make pictures. Add one with your key in Settings › AI Provider. You can still bring in a picture below."
        />
      ) : (
        <div className="flex flex-col gap-3" role="group" aria-label="Generate a picture">
          <PapelizAssistantMediaModelPicker assistantMediaKind="image-generation" mediaModelPickerLabel="Image Model" isMediaModelPickerDisabled={isGenerating} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${imagineFieldId}-prompt`} className="text-[12.5px] font-semibold">
              Prompt
            </label>
            {/* One box: the prompt, then + and the mic. While the mic records, Enter finishes and Esc throws it away. */}
            <div
              onKeyDown={(promptBoxKeyEvent) => void handlePapelizOnePressMicKey(promptBoxKeyEvent, imagineOnePressMicStore)}
              className={joinPapelizClassNames(
                'rounded-2xl border border-papeliz-line-strong bg-papeliz-surface pt-2 pr-1.5 pb-1.5 pl-3 transition-colors focus-within:border-papeliz-blue',
                isImagineMicBusy && 'border-papeliz-blue',
              )}
            >
              <textarea
                ref={promptTextAreaRef}
                id={`${imagineFieldId}-prompt`}
                className="block min-h-[56px] w-full resize-y bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-papeliz-ink-subtle"
                placeholder="Describe the picture: what’s in it, the style, the light…"
                value={imaginePromptText}
                disabled={isGenerating}
                readOnly={isImagineMicBusy}
                onChange={(promptChangeEvent) => setImaginePromptText(promptChangeEvent.target.value)}
                onKeyDown={(promptKeyEvent) => {
                  if (isImagineMicBusy) return
                  if (promptKeyEvent.key === 'Enter' && (promptKeyEvent.ctrlKey || promptKeyEvent.metaKey) && canGenerate) {
                    promptKeyEvent.preventDefault()
                    void generateImaginePictures(chosenMediaModel)
                  }
                }}
              />
              <div className="mt-1 flex min-w-0 items-center gap-0.5">
                {isImagineMicBusy ? (
                  <PapelizOnePressMicRecorderRow onePressMicStore={imagineOnePressMicStore} />
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Add"
                      aria-haspopup="menu"
                      aria-expanded={promptAddMenuPosition !== null}
                      title="Bring in a picture, or transcribe an audio file into the prompt"
                      disabled={isGenerating}
                      onClick={(clickEvent) => {
                        const addButtonRect = clickEvent.currentTarget.getBoundingClientRect()
                        setPromptAddMenuPosition({ menuAnchorLeft: addButtonRect.left, menuAnchorTop: addButtonRect.bottom + 4 })
                      }}
                      className="grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-40 aria-expanded:bg-papeliz-hover pointer-coarse:size-10"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-1 flex-1" />
                    <PapelizOnePressMicButton onePressMicStore={imagineOnePressMicStore} isMicDisabled={isGenerating} />
                  </>
                )}
              </div>
            </div>
            {promptAddMenuPosition !== null && (
              <PapelizPopoverMenu
                menuLabel="Add"
                menuPosition={promptAddMenuPosition}
                onMenuClose={() => setPromptAddMenuPosition(null)}
                menuItems={[
                  { menuItemKey: 'picture', menuItemLabel: 'Bring In a Picture', MenuItemIcon: ImageUp, onMenuItemSelect: () => pictureFileInputRef.current?.click() },
                  { menuItemKey: 'audio-file', menuItemLabel: 'Transcribe an Audio File', MenuItemIcon: FileAudio, onMenuItemSelect: () => imagineAudioFileInputRef.current?.click() },
                ]}
              />
            )}
            <PapelizOnePressMicAudioFileInput
              onePressMicStore={imagineOnePressMicStore}
              audioFileInputRef={imagineAudioFileInputRef}
              audioFileInputLabel="Transcribe an audio file into the prompt"
            />
            <PapelizOnePressMicProblemLine
              onePressMicStore={imagineOnePressMicStore}
              onBringAudioFile={() => imagineAudioFileInputRef.current?.click()}
              onChooseProvider={() => requestAssistantProviderSettingsPage()}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {imageSizeChoices.length > 0 && (
              <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1.5">
                <span id={`${imagineFieldId}-size-label`} className="text-[12.5px] font-semibold">
                  Shape
                </span>
                <PapelizListboxSelect
                  listboxSelectTriggerId={`${imagineFieldId}-size`}
                  listboxSelectLabelId={`${imagineFieldId}-size-label`}
                  isListboxSelectDisabled={isGenerating}
                  chosenListboxOptionValue={shownImageSizeText ?? ''}
                  listboxSelectOptions={imageSizeChoices.map((imageSizeChoice) => ({
                    listboxOptionValue: imageSizeChoice.imageSizeText,
                    listboxOptionLabel: imageSizeChoice.imageSizeLabel,
                    ...(imageSizeChoice.imageSizeText === 'auto' ? {} : { listboxOptionNote: imageSizeChoice.imageSizeText.replace('x', '×') }),
                  }))}
                  onListboxOptionChoose={setImagineImageSizeText}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span id={`${imagineFieldId}-count-label`} className="text-[12.5px] font-semibold">
                Pictures
              </span>
              <div role="radiogroup" aria-labelledby={`${imagineFieldId}-count-label`} className="flex h-9 items-center gap-0.5 rounded-full bg-papeliz-tab-strip p-1">
                {Array.from({ length: papelizImagineMaximumGeneratedPictureCount }, (_, countIndex) => countIndex + 1).map((pictureCount) => (
                  <button
                    key={pictureCount}
                    type="button"
                    role="radio"
                    aria-checked={imagineGeneratedPictureCount === pictureCount}
                    disabled={isGenerating}
                    onClick={() => setImagineGeneratedPictureCount(pictureCount)}
                    className={joinPapelizClassNames(
                      'h-7 min-w-7 rounded-full px-2 text-[12.5px] font-medium tabular-nums',
                      imagineGeneratedPictureCount === pictureCount ? 'bg-papeliz-blue text-white' : 'text-papeliz-ink-muted hover:bg-papeliz-hover',
                    )}
                  >
                    {pictureCount}
                  </button>
                ))}
              </div>
            </div>
            {isGenerating ? (
              <PapelizPillButton className="ml-auto" pillButtonVariant="outline" onClick={stopImagineGeneration}>
                <Square className="size-3.5" aria-hidden="true" />
                Stop
              </PapelizPillButton>
            ) : (
              <PapelizPillButton
                className="ml-auto"
                pillButtonVariant="primary"
                disabled={!canGenerate}
                onClick={() => {
                  if (canGenerate) void generateImaginePictures(chosenMediaModel)
                }}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Generate
              </PapelizPillButton>
            )}
          </div>
          {chosenMediaModel !== null && (
            <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle">
              {isGenerating ? 'Making the pictures… ' : ''}Sent from {isPapelizDesktopApp ? 'this computer' : 'this browser'} straight to {chosenMediaModel.providerDisplayName} with your key.
            </p>
          )}
          {imagineGenerationStage === 'failed' && imagineGenerationProblem !== null && <PapelizAssistantMediaProblemLine>{imagineGenerationProblem}</PapelizAssistantMediaProblemLine>}
        </div>
      )}

      {imaginePictureInsertion !== null && (
        <div ref={insertionCardRef}>
          <PapelizAssistantMediaNoteDiffCard
            vaultNoteRelativePath={imaginePictureInsertion.vaultNoteRelativePath}
            isNewVaultNote={false}
            addedNoteText={imaginePictureInsertion.pictureNoteTextInsertion.insertedNoteText}
            noteDiffCardNote={
              <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle">
                Accept saves the picture as {imaginePictureInsertion.plannedPictureVaultFileRelativePath}
                {imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === imaginePictureInsertion.imaginePictureId)?.isRemoveC2paOn === false
                  ? ', with its metadata,'
                  : ', with C2PA and other metadata removed,'}{' '}
                and puts the link after the cursor’s line.
              </p>
            }
            isAccepting={imaginePictureInsertion.insertionStage === 'accepting'}
            noteDiffProblem={imaginePictureInsertion.insertionProblem}
            onNoteDiffAccept={() => void acceptImaginePictureInsertion()}
            onNoteDiffReject={rejectImaginePictureInsertion}
          />
        </div>
      )}

      <section aria-label="Pictures" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <PapelizAssistantMediaSectionHeading>Pictures</PapelizAssistantMediaSectionHeading>
          <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" onClick={() => pictureFileInputRef.current?.click()}>
            <ImagePlus className="size-3.5" aria-hidden="true" />
            Bring In a Picture
          </PapelizPillButton>
          <input
            ref={pictureFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            aria-label="Bring in a picture"
            onChange={(fileInputEvent) => {
              void bringInPictureFiles([...(fileInputEvent.target.files ?? [])])
              fileInputEvent.target.value = ''
            }}
          />
        </div>
        {broughtInPictureProblem !== null && <PapelizAssistantMediaProblemLine>{broughtInPictureProblem}</PapelizAssistantMediaProblemLine>}
        {imaginePictures.length === 0 ? (
          <div
            className={joinPapelizClassNames(
              'rounded-2xl border border-dashed px-4 py-6 text-center text-[12.5px] leading-relaxed text-papeliz-ink-subtle',
              isPictureDragOver ? 'border-papeliz-blue bg-papeliz-blue-soft text-papeliz-blue' : 'border-papeliz-line-strong',
            )}
          >
            Generated pictures show here. Drop a PNG, JPEG or WebP here to clean it of C2PA and save it to the vault.
          </div>
        ) : (
          <ul className={joinPapelizClassNames('grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2.5 rounded-2xl', isPictureDragOver && 'outline-2 outline-papeliz-blue outline-dashed')}>
            {imaginePictures.map((imaginePicture) => (
              <PapelizImaginePictureCard key={imaginePicture.imaginePictureId} imaginePicture={imaginePicture} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
