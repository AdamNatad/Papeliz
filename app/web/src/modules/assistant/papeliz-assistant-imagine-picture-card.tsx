import { FileInput, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { describePapelizRemovedImageMetadata, hasPapelizContentCredentials } from './papeliz-assistant-image-metadata-strip'
import { PapelizImaginePictureLightbox } from './papeliz-assistant-imagine-picture-lightbox'
import { usePapelizImagineStore, type PapelizImaginePicture, type PapelizImaginePictureInsertion } from './papeliz-assistant-imagine-store'
import { PapelizAssistantMediaNoteDiffCard, PapelizAssistantMediaProblemLine, PapelizAssistantRemoveMetadataSwitch } from './papeliz-assistant-media-parts'

// What a picture carries, and what Remove Metadata does with it, in one line under the picture.
export function describePapelizImaginePictureMetadataLine(imaginePicture: PapelizImaginePicture): string {
  if (imaginePicture.removedMetadataNamesWhenSaved !== null) {
    return imaginePicture.removedMetadataNamesWhenSaved.length > 0
      ? `Saved without ${describePapelizRemovedImageMetadata(imaginePicture.removedMetadataNamesWhenSaved)}.`
      : imaginePicture.isRemoveMetadataOn
        ? 'Saved. It carried no metadata.'
        : 'Saved as it came, metadata and all.'
  }
  const imaginePictureMetadataNames = imaginePicture.imaginePictureMetadataNames
  if (imaginePictureMetadataNames === null) return 'This picture can’t be read to clean it, so it can’t be saved cleaned.'
  if (imaginePictureMetadataNames.length === 0) return 'No metadata found.'
  const metadataDescription = describePapelizRemovedImageMetadata(imaginePictureMetadataNames)
  return imaginePicture.isRemoveMetadataOn ? `Carries ${metadataDescription}. Removed when saved.` : `Carries ${metadataDescription}. Kept when saved.`
}

interface PapelizImaginePictureActionButtonsProps {
  imaginePicture: PapelizImaginePicture
  // The lightbox closes before Put in Note, so its diff shows under the picture.
  onPutInNoteStart?: () => void
}

// Put in Note and Save to Vault, each the full width it is given: one under the other on the card, side
// by side in the lightbox when it is wide enough.
function PapelizImaginePictureActionButtons({ imaginePicture, onPutInNoteStart }: PapelizImaginePictureActionButtonsProps) {
  const saveImaginePictureToVault = usePapelizImagineStore((imagineState) => imagineState.saveImaginePictureToVault)
  const proposeImaginePictureInNote = usePapelizImagineStore((imagineState) => imagineState.proposeImaginePictureInNote)
  const isVaultOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault !== null)
  const isMarkdownNoteOpen = usePapelizWorkspaceStore((workspaceState) => selectActiveVaultMarkdownNoteRelativePath(workspaceState) !== null)
  const [isPictureActionRunning, setIsPictureActionRunning] = useState(false)
  const isSaveBlocked = imaginePicture.imaginePictureMetadataNames === null && imaginePicture.isRemoveMetadataOn
  const runPictureAction = async (pictureAction: () => Promise<void>) => {
    setIsPictureActionRunning(true)
    try {
      await pictureAction()
    } finally {
      setIsPictureActionRunning(false)
    }
  }

  return (
    <>
      <PapelizPillButton
        className="w-full"
        pillButtonVariant="primary"
        pillButtonSize="small"
        disabled={!isMarkdownNoteOpen || isSaveBlocked || isPictureActionRunning}
        title={isMarkdownNoteOpen ? 'Put the picture in the open note, after the line the cursor is on' : 'Open a note first'}
        onClick={() => {
          onPutInNoteStart?.()
          void runPictureAction(() => proposeImaginePictureInNote(imaginePicture.imaginePictureId))
        }}
      >
        <FileInput className="size-3.5" aria-hidden="true" />
        Put in Note
      </PapelizPillButton>
      <PapelizPillButton
        className="w-full"
        pillButtonVariant="outline"
        pillButtonSize="small"
        disabled={!isVaultOpen || isSaveBlocked || isPictureActionRunning || imaginePicture.savedVaultFileRelativePath !== null}
        onClick={() => void runPictureAction(() => saveImaginePictureToVault(imaginePicture.imaginePictureId))}
      >
        <Save className="size-3.5" aria-hidden="true" />
        {imaginePicture.savedVaultFileRelativePath === null ? 'Save to Vault' : 'Saved'}
      </PapelizPillButton>
    </>
  )
}

interface PapelizImaginePictureCardProps {
  imaginePicture: PapelizImaginePicture
  // Gallery's line under the picture: the prompt it came from, or "Brought in: name.png".
  pictureCardCaption?: string
  // Gallery's lightbox also offers Show in Draw, for the Draw entry the picture came from.
  showInDrawThreadEntryId?: string | null
}

// One picture in Draw, in Gallery and in the chat: the picture, which opens in a lightbox when pressed,
// Remove Metadata, and what can be done with it.
export function PapelizImaginePictureCard({ imaginePicture, pictureCardCaption, showInDrawThreadEntryId = null }: PapelizImaginePictureCardProps) {
  const setImaginePictureRemoveMetadata = usePapelizImagineStore((imagineState) => imagineState.setImaginePictureRemoveMetadata)
  const removeImaginePicture = usePapelizImagineStore((imagineState) => imagineState.removeImaginePicture)
  const [isPictureLightboxOpen, setIsPictureLightboxOpen] = useState(false)
  const pictureLightboxOpenButtonRef = useRef<HTMLButtonElement>(null)
  // A brought-in picture's caption already says so.
  const pictureModelLine = imaginePicture.imaginePictureModelLabel ?? (pictureCardCaption === undefined ? 'Brought in' : '')
  const isContentCredentialsCarried = hasPapelizContentCredentials(imaginePicture.imaginePictureMetadataNames ?? [])
  const pictureMetadataLine = describePapelizImaginePictureMetadataLine(imaginePicture)
  const closePictureLightbox = () => {
    setIsPictureLightboxOpen(false)
    // Focus goes back to the picture that opened it, once the dialog has let go of it.
    requestAnimationFrame(() => pictureLightboxOpenButtonRef.current?.focus({ preventScroll: true }))
  }

  return (
    <li
      className="flex min-w-0 flex-col gap-2 rounded-2xl bg-papeliz-surface p-2 shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]"
      aria-label={imaginePicture.imaginePictureOrigin === 'generated' ? `Picture of ${imaginePicture.imaginePictureDescriptionText}` : imaginePicture.imaginePictureDescriptionText}
    >
      <div className="relative overflow-hidden rounded-xl bg-papeliz-surface-soft">
        <button
          ref={pictureLightboxOpenButtonRef}
          type="button"
          title="Open larger"
          onClick={() => setIsPictureLightboxOpen(true)}
          className="block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-papeliz-blue"
        >
          <img src={imaginePicture.imaginePicturePreviewUrl} alt={imaginePicture.imaginePictureDescriptionText} className="block aspect-square w-full object-contain" draggable={false} />
        </button>
        <PapelizIconButton
          iconButtonLabel="Remove from Imagine"
          iconButtonSize="small"
          className="absolute top-1.5 right-1.5 bg-papeliz-surface/90 shadow-[0_1px_2px_rgb(16_24_40/0.12)]"
          onClick={() => removeImaginePicture(imaginePicture.imaginePictureId)}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </PapelizIconButton>
      </div>
      {pictureCardCaption !== undefined && (
        <p className="line-clamp-2 px-0.5 text-[12.5px] leading-snug break-words text-papeliz-ink" title={pictureCardCaption}>
          {pictureCardCaption}
        </p>
      )}
      {(pictureModelLine.length > 0 || isContentCredentialsCarried) && (
        <p className="truncate px-0.5 text-[12px] text-papeliz-ink-muted" title={imaginePicture.imaginePictureModelLabel ?? imaginePicture.imaginePictureDescriptionText}>
          {pictureModelLine}
          {isContentCredentialsCarried && (
            <span className={joinPapelizClassNames('rounded-full bg-papeliz-blue-soft px-1.5 py-px text-[11px] font-semibold text-papeliz-blue', pictureModelLine.length > 0 && 'ml-1.5')}>
              C2PA
            </span>
          )}
        </p>
      )}
      <div className="flex flex-col gap-1 px-0.5">
        <PapelizAssistantRemoveMetadataSwitch
          isRemoveMetadataOn={imaginePicture.isRemoveMetadataOn}
          isRemoveMetadataSwitchDisabled={imaginePicture.savedVaultFileRelativePath !== null}
          onRemoveMetadataToggle={(isRemoveMetadataOn) => setImaginePictureRemoveMetadata(imaginePicture.imaginePictureId, isRemoveMetadataOn)}
        />
        <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle" aria-live="polite">
          {pictureMetadataLine}
        </p>
      </div>
      {imaginePicture.savedVaultFileRelativePath !== null && (
        <p className="truncate px-0.5 text-[11.5px] text-papeliz-ink-muted" title={imaginePicture.savedVaultFileRelativePath}>
          In the vault: {getVaultEntryName(imaginePicture.savedVaultFileRelativePath)}
        </p>
      )}
      {imaginePicture.imaginePictureProblem !== null && <PapelizAssistantMediaProblemLine>{imaginePicture.imaginePictureProblem}</PapelizAssistantMediaProblemLine>}
      <div className="flex flex-col gap-1.5">
        <PapelizImaginePictureActionButtons imaginePicture={imaginePicture} />
      </div>
      {isPictureLightboxOpen && (
        <PapelizImaginePictureLightbox
          imaginePicture={imaginePicture}
          pictureLightboxCaption={
            pictureCardCaption ??
            (imaginePicture.imaginePictureOrigin === 'brought-in' ? `Brought in: ${imaginePicture.imaginePictureDescriptionText}` : imaginePicture.imaginePictureDescriptionText)
          }
          pictureLightboxDetailLine={`${imaginePicture.imaginePictureModelLabel ?? 'Brought in'} · ${pictureMetadataLine}`}
          pictureLightboxActionButtons={<PapelizImaginePictureActionButtons imaginePicture={imaginePicture} onPutInNoteStart={closePictureLightbox} />}
          showInDrawThreadEntryId={showInDrawThreadEntryId}
          onPictureLightboxClose={closePictureLightbox}
        />
      )}
    </li>
  )
}

// Put in Note's change, as a diff to accept, beside the picture it puts in.
export function PapelizImaginePictureInsertionCard({ imaginePictureInsertion }: { imaginePictureInsertion: PapelizImaginePictureInsertion }) {
  const isInsertedPictureRemoveMetadataOn = usePapelizImagineStore(
    (imagineState) => imagineState.imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === imaginePictureInsertion.imaginePictureId)?.isRemoveMetadataOn !== false,
  )
  const acceptImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.acceptImaginePictureInsertion)
  const rejectImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.rejectImaginePictureInsertion)
  const insertionCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    insertionCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  return (
    <div ref={insertionCardRef}>
      <PapelizAssistantMediaNoteDiffCard
        vaultNoteRelativePath={imaginePictureInsertion.vaultNoteRelativePath}
        isNewVaultNote={false}
        addedNoteText={imaginePictureInsertion.pictureNoteTextInsertion.insertedNoteText}
        noteDiffCardNote={
          <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle">
            Accept saves the picture as {imaginePictureInsertion.plannedPictureVaultFileRelativePath}
            {isInsertedPictureRemoveMetadataOn ? ', with C2PA and other metadata removed,' : ', with its metadata,'} and puts the link after the cursor’s line.
          </p>
        }
        isAccepting={imaginePictureInsertion.insertionStage === 'accepting'}
        noteDiffProblem={imaginePictureInsertion.insertionProblem}
        onNoteDiffAccept={() => void acceptImaginePictureInsertion()}
        onNoteDiffReject={rejectImaginePictureInsertion}
      />
    </div>
  )
}
