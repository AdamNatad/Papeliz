import { create } from 'zustand'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { selectActiveVaultMarkdownNoteRelativePath, selectActiveVaultNoteLockingEntry, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { generatePapelizAssistantImages } from './papeliz-assistant-image-and-audio-client'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'
import {
  detectPapelizAssistantImageFileFormat,
  papelizAssistantImageFileExtensions,
  stripPapelizAssistantImageMetadata,
  type PapelizAssistantImageFileFormat,
} from './papeliz-assistant-image-metadata-strip'
import { buildPapelizAssistantMediaProviderConnection, type PapelizAssistantMediaModelChoice } from './papeliz-assistant-media-model-choices-store'
import { resolvePapelizAssistantImageAspectRatioChoice } from './papeliz-assistant-image-aspect-ratios'
import { findPapelizAssistantImageGenerationPreset, type PapelizAssistantImageAspectRatio } from './papeliz-assistant-media-provider-presets'
import {
  buildPapelizMediaFileBaseName,
  buildPapelizPictureLinkMarkdown,
  buildPapelizVaultFileLinkPathFromNote,
  insertPapelizBlockAfterCursorLine,
  pickPapelizFreeMediaFileRelativePath,
  writePapelizMediaFileToVault,
  type PapelizNoteTextInsertion,
} from './papeliz-assistant-media-vault-files'
import { readPapelizActiveNoteCursorTextOffset, readPapelizCurrentVaultNoteText } from './papeliz-assistant-media-note-text'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'

// Imagine: pictures made with the person's own provider and key, and pictures the person brings in,
// each with Remove Metadata (on by default), which strips content credentials and other metadata before a
// picture is saved. Nothing is sent until Send. A picture goes into the vault's `Attachments/` folder
// on Save to Vault, or into the open note on Put in Note, which first shows the change as a diff and
// saves nothing until it is accepted. Pictures live in this page's memory until then, and the Imagine
// tab shows them as a thread: each prompt with the pictures it made, and each picture brought in.

export interface PapelizImaginePicture {
  imaginePictureId: string
  imaginePictureOrigin: 'generated' | 'brought-in'
  // As it arrived, metadata included.
  imaginePictureBlob: Blob
  imaginePicturePreviewUrl: string
  imaginePictureFormat: PapelizAssistantImageFileFormat
  // What Remove Metadata takes out of it, or null when it can't be read (a damaged file).
  imaginePictureMetadataNames: string[] | null
  isRemoveMetadataOn: boolean
  // The prompt, or the file's name: the picture link's alt text and the saved file's name.
  imaginePictureDescriptionText: string
  // "muse-image-1 · Meta Model API", for a generated picture.
  imaginePictureModelLabel: string | null
  savedVaultFileRelativePath: string | null
  // What was removed when it was saved, to show under it.
  removedMetadataNamesWhenSaved: string[] | null
  imaginePictureProblem: string | null
}

// Put in Note's change, shown as a diff until it is accepted or rejected.
export interface PapelizImaginePictureInsertion {
  imaginePictureId: string
  vaultNoteRelativePath: string
  // The note as it was when the diff was made; Accept is refused if it changed since.
  vaultNoteTextWhenProposed: string
  plannedPictureVaultFileRelativePath: string
  pictureNoteTextInsertion: PapelizNoteTextInsertion
  insertionStage: 'proposed' | 'accepting' | 'failed'
  insertionProblem: string | null
}

// Where a prompt was written: the Imagine tab's box, the chat box (+, Imagine a Picture), or a note
// (Imagine Here and Edit Picture).
export type PapelizImaginePromptPlace = 'imagine' | 'chat' | 'note'

// One entry in the Imagine tab's thread, which runs oldest first.
export type PapelizImagineThreadEntry =
  | {
      imagineThreadEntryId: string
      imagineThreadEntryKind: 'prompt'
      imaginePromptText: string
      imaginePromptPlace: PapelizImaginePromptPlace
      // "muse-image-1.0 · Meta Model API".
      imageModelLabel: string
      requestedPictureCount: number
      imaginePromptStage: 'making' | 'made' | 'failed' | 'stopped'
      imaginePromptProblem: string | null
      imaginePictureIds: string[]
    }
  | {
      imagineThreadEntryId: string
      imagineThreadEntryKind: 'brought-in'
      broughtInPictureFileName: string
      // Why the file was turned away (too large, or not a picture).
      broughtInPictureProblem: string | null
      imaginePictureIds: string[]
    }

interface PapelizImagineState {
  // What is typed in the Imagine tab's box.
  imaginePromptText: string
  // The shape chosen in Draw's menu, kept as its ratio ("16:9"), and used wherever a picture is made;
  // null until one is chosen, for 1:1.
  imagineImageAspectRatio: PapelizAssistantImageAspectRatio | null
  imagineGeneratedPictureCount: number
  imaginePictures: PapelizImaginePicture[]
  imagineThreadEntries: PapelizImagineThreadEntry[]
  imaginePictureInsertion: PapelizImaginePictureInsertion | null
  setImaginePromptText: (imaginePromptText: string) => void
  setImagineImageAspectRatio: (imagineImageAspectRatio: PapelizAssistantImageAspectRatio | null) => void
  setImagineGeneratedPictureCount: (imagineGeneratedPictureCount: number) => void
  // Sends what is typed as a prompt: it joins the thread, the box empties, and the pictures show under it.
  sendImaginePrompt: (imageModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
  stopImagineGeneration: () => void
  bringInImaginePictureFiles: (pictureFiles: readonly File[]) => Promise<void>
  setImaginePictureRemoveMetadata: (imaginePictureId: string, isRemoveMetadataOn: boolean) => void
  removeImaginePicture: (imaginePictureId: string) => void
  saveImaginePictureToVault: (imaginePictureId: string) => Promise<void>
  proposeImaginePictureInNote: (imaginePictureId: string) => Promise<void>
  acceptImaginePictureInsertion: () => Promise<void>
  rejectImaginePictureInsertion: () => void
}

// A picture brought in may be up to 20 MB; generated ones are far smaller.
const papelizImagineBroughtInPictureByteLimit = 20 * 1024 * 1024
export const papelizImagineMaximumGeneratedPictureCount = 4

let nextImaginePictureNumber = 1
let nextImagineThreadEntryNumber = 1
let activeImagineGenerationAbortController: AbortController | null = null

function createImagineThreadEntryId(): string {
  return `papeliz-imagine-thread-entry-${nextImagineThreadEntryNumber++}`
}

// True while the Imagine tab's box is making pictures: its Send is Stop until they come.
export function selectIsPapelizImagineMaking(imagineState: Pick<PapelizImagineState, 'imagineThreadEntries'>): boolean {
  return imagineState.imagineThreadEntries.some(
    (imagineThreadEntry) =>
      imagineThreadEntry.imagineThreadEntryKind === 'prompt' && imagineThreadEntry.imaginePromptPlace === 'imagine' && imagineThreadEntry.imaginePromptStage === 'making',
  )
}

// "Making the picture with muse-image-1.0 · Meta Model API…", or "Making 3 pictures with …".
export function describePapelizImagineMakingLine(requestedPictureCount: number, imageModelLabel: string): string {
  return `Making ${requestedPictureCount > 1 ? `${requestedPictureCount} pictures` : 'the picture'} with ${imageModelLabel}…`
}

// A picture removed from Imagine leaves the thread; so does an entry once its last picture is gone.
export function removePapelizImaginePictureFromThread(imagineThreadEntries: readonly PapelizImagineThreadEntry[], removedImaginePictureId: string): PapelizImagineThreadEntry[] {
  return imagineThreadEntries.flatMap((imagineThreadEntry) => {
    if (!imagineThreadEntry.imaginePictureIds.includes(removedImaginePictureId)) return [imagineThreadEntry]
    const keptImaginePictureIds = imagineThreadEntry.imaginePictureIds.filter((imaginePictureId) => imaginePictureId !== removedImaginePictureId)
    return keptImaginePictureIds.length === 0 ? [] : [{ ...imagineThreadEntry, imaginePictureIds: keptImaginePictureIds }]
  })
}

function readImaginePictureMetadataNames(imagePictureBytes: Uint8Array): string[] | null {
  try {
    return stripPapelizAssistantImageMetadata(imagePictureBytes).removedImageMetadataNames
  } catch {
    return null
  }
}

async function createImaginePicture(
  imaginePictureBlob: Blob,
  imaginePictureOrigin: PapelizImaginePicture['imaginePictureOrigin'],
  imaginePictureDescriptionText: string,
  imaginePictureModelLabel: string | null,
): Promise<PapelizImaginePicture | null> {
  const imagePictureBytes = new Uint8Array(await imaginePictureBlob.arrayBuffer())
  const imaginePictureFormat = detectPapelizAssistantImageFileFormat(imagePictureBytes)
  if (imaginePictureFormat === null) return null
  return {
    imaginePictureId: `papeliz-imagine-picture-${nextImaginePictureNumber++}`,
    imaginePictureOrigin,
    imaginePictureBlob,
    imaginePicturePreviewUrl: URL.createObjectURL(imaginePictureBlob),
    imaginePictureFormat,
    imaginePictureMetadataNames: readImaginePictureMetadataNames(imagePictureBytes),
    isRemoveMetadataOn: true,
    imaginePictureDescriptionText,
    imaginePictureModelLabel,
    savedVaultFileRelativePath: null,
    removedMetadataNamesWhenSaved: null,
    imaginePictureProblem: null,
  }
}

// The bytes a picture is saved with: cleaned while Remove Metadata is on, as it arrived while it is off.
async function readImaginePictureBytesToSave(imaginePicture: PapelizImaginePicture): Promise<{ savedPictureBlob: Blob; removedMetadataNames: string[] }> {
  if (!imaginePicture.isRemoveMetadataOn) return { savedPictureBlob: imaginePicture.imaginePictureBlob, removedMetadataNames: [] }
  const metadataStripResult = stripPapelizAssistantImageMetadata(new Uint8Array(await imaginePicture.imaginePictureBlob.arrayBuffer()))
  return {
    savedPictureBlob: new Blob([metadataStripResult.strippedImageFileBytes], { type: imaginePicture.imaginePictureBlob.type || 'application/octet-stream' }),
    removedMetadataNames: metadataStripResult.removedImageMetadataNames,
  }
}

function buildImaginePictureFileBaseName(imaginePicture: PapelizImaginePicture): string {
  const descriptionWithoutExtension = imaginePicture.imaginePictureDescriptionText.replace(/\.(png|jpe?g|webp)$/i, '')
  return buildPapelizMediaFileBaseName(imaginePicture.imaginePictureOrigin === 'generated' ? 'imagine' : 'picture', new Date(), descriptionWithoutExtension)
}

export const usePapelizImagineStore = create<PapelizImagineState>()((setImagineState, getImagineState) => {
  const updateImaginePicture = (imaginePictureId: string, imaginePictureChanges: Partial<PapelizImaginePicture>) =>
    setImagineState((imagineState) => ({
      imaginePictures: imagineState.imaginePictures.map((imaginePicture) =>
        imaginePicture.imaginePictureId === imaginePictureId ? { ...imaginePicture, ...imaginePictureChanges } : imaginePicture,
      ),
    }))
  const findImaginePicture = (imaginePictureId: string) => getImagineState().imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === imaginePictureId)
  const updateImaginePromptEntry = (
    imagineThreadEntryId: string,
    imaginePromptEntryChanges: Partial<Pick<Extract<PapelizImagineThreadEntry, { imagineThreadEntryKind: 'prompt' }>, 'imaginePromptStage' | 'imaginePromptProblem' | 'imaginePictureIds'>>,
  ) =>
    setImagineState((imagineState) => ({
      imagineThreadEntries: imagineState.imagineThreadEntries.map((imagineThreadEntry) =>
        imagineThreadEntry.imagineThreadEntryId === imagineThreadEntryId && imagineThreadEntry.imagineThreadEntryKind === 'prompt'
          ? { ...imagineThreadEntry, ...imaginePromptEntryChanges }
          : imagineThreadEntry,
      ),
    }))

  return {
    imaginePromptText: '',
    imagineImageAspectRatio: null,
    imagineGeneratedPictureCount: 1,
    imaginePictures: [],
    imagineThreadEntries: [],
    imaginePictureInsertion: null,

    setImaginePromptText: (imaginePromptText) => setImagineState({ imaginePromptText }),
    setImagineImageAspectRatio: (imagineImageAspectRatio) => setImagineState({ imagineImageAspectRatio }),
    setImagineGeneratedPictureCount: (imagineGeneratedPictureCount) =>
      setImagineState({ imagineGeneratedPictureCount: Math.max(1, Math.min(papelizImagineMaximumGeneratedPictureCount, Math.round(imagineGeneratedPictureCount))) }),

    sendImaginePrompt: async (imageModelChoice) => {
      const { imaginePromptText, imagineImageAspectRatio, imagineGeneratedPictureCount } = getImagineState()
      const sentPromptText = imaginePromptText.trim()
      // One prompt at a time: while pictures are being made, the box's Send is Stop.
      if (sentPromptText.length === 0 || selectIsPapelizImagineMaking(getImagineState())) return
      const imagineGenerationAbortController = new AbortController()
      activeImagineGenerationAbortController = imagineGenerationAbortController
      const imagineThreadEntryId = createImagineThreadEntryId()
      setImagineState((imagineState) => ({
        imaginePromptText: '',
        imagineThreadEntries: [
          ...imagineState.imagineThreadEntries,
          {
            imagineThreadEntryId,
            imagineThreadEntryKind: 'prompt',
            imaginePromptText: sentPromptText,
            imaginePromptPlace: 'imagine',
            imageModelLabel: `${imageModelChoice.providerModelName} · ${findPapelizAssistantProviderPreset(imageModelChoice.papelizAssistantProviderId).providerPresetDisplayName}`,
            requestedPictureCount: imagineGeneratedPictureCount,
            imaginePromptStage: 'making',
            imaginePromptProblem: null,
            imaginePictureIds: [],
          },
        ],
      }))
      try {
        const madeImaginePictures = await makePapelizImaginePictures({
          imageModelChoice,
          imagePromptText: sentPromptText,
          storedImageShapeText: imagineImageAspectRatio,
          pictureCount: imagineGeneratedPictureCount,
          abortSignal: imagineGenerationAbortController.signal,
          imaginePromptPlace: 'imagine',
        })
        if (madeImaginePictures.length === 0) throw new PapelizAssistantProviderError('The provider sent a picture Papeliz can’t read.', null)
        updateImaginePromptEntry(imagineThreadEntryId, {
          imaginePromptStage: 'made',
          imaginePictureIds: madeImaginePictures.map((imaginePicture) => imaginePicture.imaginePictureId),
        })
      } catch (imagineGenerationError) {
        // Stop has already marked the entry.
        if (imagineGenerationError instanceof DOMException && imagineGenerationError.name === 'AbortError') return
        updateImaginePromptEntry(imagineThreadEntryId, { imaginePromptStage: 'failed', imaginePromptProblem: describePapelizAssistantMediaProblem(imagineGenerationError) })
      } finally {
        if (activeImagineGenerationAbortController === imagineGenerationAbortController) activeImagineGenerationAbortController = null
      }
    },

    stopImagineGeneration: () => {
      activeImagineGenerationAbortController?.abort()
      activeImagineGenerationAbortController = null
      setImagineState((imagineState) => ({
        imagineThreadEntries: imagineState.imagineThreadEntries.map((imagineThreadEntry) =>
          imagineThreadEntry.imagineThreadEntryKind === 'prompt' && imagineThreadEntry.imaginePromptPlace === 'imagine' && imagineThreadEntry.imaginePromptStage === 'making'
            ? { ...imagineThreadEntry, imaginePromptStage: 'stopped' }
            : imagineThreadEntry,
        ),
      }))
    },

    // Each file joins the thread as its own entry: the picture, or why it was turned away.
    bringInImaginePictureFiles: async (pictureFiles) => {
      const broughtInPictures: PapelizImaginePicture[] = []
      const broughtInThreadEntries: PapelizImagineThreadEntry[] = []
      for (const pictureFile of pictureFiles) {
        const broughtInPictureFileName = pictureFile.name || 'picture'
        const broughtInPicture =
          pictureFile.size > papelizImagineBroughtInPictureByteLimit ? null : await createImaginePicture(pictureFile, 'brought-in', broughtInPictureFileName, null)
        if (broughtInPicture !== null) broughtInPictures.push(broughtInPicture)
        broughtInThreadEntries.push({
          imagineThreadEntryId: createImagineThreadEntryId(),
          imagineThreadEntryKind: 'brought-in',
          broughtInPictureFileName,
          broughtInPictureProblem:
            broughtInPicture !== null
              ? null
              : pictureFile.size > papelizImagineBroughtInPictureByteLimit
                ? `${broughtInPictureFileName} is over 20 MB.`
                : `${pictureFile.name || 'That file'} isn’t a PNG, JPEG or WebP picture.`,
          imaginePictureIds: broughtInPicture === null ? [] : [broughtInPicture.imaginePictureId],
        })
      }
      setImagineState((imagineState) => ({
        imaginePictures: [...broughtInPictures, ...imagineState.imaginePictures],
        imagineThreadEntries: [...imagineState.imagineThreadEntries, ...broughtInThreadEntries],
      }))
    },

    setImaginePictureRemoveMetadata: (imaginePictureId, isRemoveMetadataOn) => updateImaginePicture(imaginePictureId, { isRemoveMetadataOn }),

    removeImaginePicture: (imaginePictureId) => {
      const imaginePicture = findImaginePicture(imaginePictureId)
      if (imaginePicture !== undefined) URL.revokeObjectURL(imaginePicture.imaginePicturePreviewUrl)
      setImagineState((imagineState) => ({
        imaginePictures: imagineState.imaginePictures.filter((keptPicture) => keptPicture.imaginePictureId !== imaginePictureId),
        imagineThreadEntries: removePapelizImaginePictureFromThread(imagineState.imagineThreadEntries, imaginePictureId),
        imaginePictureInsertion: imagineState.imaginePictureInsertion?.imaginePictureId === imaginePictureId ? null : imagineState.imaginePictureInsertion,
      }))
    },

    saveImaginePictureToVault: async (imaginePictureId) => {
      const imaginePicture = findImaginePicture(imaginePictureId)
      if (imaginePicture === undefined) return
      try {
        await savePapelizImaginePictureAt(imaginePictureId, await pickPapelizImaginePictureFileRelativePath(imaginePictureId))
      } catch (pictureSaveError) {
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: describePapelizAssistantMediaProblem(pictureSaveError) })
      }
    },

    proposeImaginePictureInNote: async (imaginePictureId) => {
      const imaginePicture = findImaginePicture(imaginePictureId)
      if (imaginePicture === undefined) return
      const workspaceState = usePapelizWorkspaceStore.getState()
      const vaultNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(workspaceState)
      if (workspaceState.openVault === null || vaultNoteRelativePath === null) {
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: 'Open a note first: the picture goes in at its cursor.' })
        return
      }
      if (selectActiveVaultNoteLockingEntry(workspaceState) !== null) {
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: 'This note is locked. Unlock it to put a picture in.' })
        return
      }
      const vaultNoteTextWhenProposed = readPapelizCurrentVaultNoteText(vaultNoteRelativePath)
      if (vaultNoteTextWhenProposed === null) {
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: 'The note is still opening. Try again in a moment.' })
        return
      }
      try {
        // The saved copy keeps the picture's own format, so its file name and link are known now.
        const plannedPictureVaultFileRelativePath = imaginePicture.savedVaultFileRelativePath ?? (await pickPapelizImaginePictureFileRelativePath(imaginePictureId))
        const pictureLinkMarkdown = buildPapelizImaginePictureLinkMarkdown(imaginePicture, vaultNoteRelativePath, plannedPictureVaultFileRelativePath)
        setImagineState({
          imaginePictureInsertion: {
            imaginePictureId,
            vaultNoteRelativePath,
            vaultNoteTextWhenProposed,
            plannedPictureVaultFileRelativePath,
            pictureNoteTextInsertion: insertPapelizBlockAfterCursorLine(vaultNoteTextWhenProposed, readPapelizActiveNoteCursorTextOffset(vaultNoteTextWhenProposed), pictureLinkMarkdown),
            insertionStage: 'proposed',
            insertionProblem: null,
          },
        })
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: null })
      } catch (pictureInsertionError) {
        updateImaginePicture(imaginePictureId, { imaginePictureProblem: describePapelizAssistantMediaProblem(pictureInsertionError) })
      }
    },

    acceptImaginePictureInsertion: async () => {
      const imaginePictureInsertion = getImagineState().imaginePictureInsertion
      if (imaginePictureInsertion === null || imaginePictureInsertion.insertionStage === 'accepting') return
      const imaginePicture = findImaginePicture(imaginePictureInsertion.imaginePictureId)
      const failInsertion = (insertionProblem: string) =>
        setImagineState({ imaginePictureInsertion: { ...imaginePictureInsertion, insertionStage: 'failed', insertionProblem } })
      if (imaginePicture === undefined) return failInsertion('The picture was removed.')
      if (readPapelizCurrentVaultNoteText(imaginePictureInsertion.vaultNoteRelativePath) !== imaginePictureInsertion.vaultNoteTextWhenProposed) {
        return failInsertion(`“${getVaultNoteTitle(imaginePictureInsertion.vaultNoteRelativePath)}” changed since. Press Put in Note again.`)
      }
      setImagineState({ imaginePictureInsertion: { ...imaginePictureInsertion, insertionStage: 'accepting', insertionProblem: null } })
      try {
        if (imaginePicture.savedVaultFileRelativePath !== imaginePictureInsertion.plannedPictureVaultFileRelativePath) {
          await savePapelizImaginePictureAt(imaginePicture.imaginePictureId, imaginePictureInsertion.plannedPictureVaultFileRelativePath)
        }
        await usePapelizWorkspaceStore
          .getState()
          .writeVaultNoteTextFromAssistant(imaginePictureInsertion.vaultNoteRelativePath, imaginePictureInsertion.pictureNoteTextInsertion.editedVaultNoteText)
        setImagineState({ imaginePictureInsertion: null })
      } catch (pictureInsertionError) {
        failInsertion(describePapelizAssistantMediaProblem(pictureInsertionError))
      }
    },

    rejectImaginePictureInsertion: () => setImagineState({ imaginePictureInsertion: null }),
  }
})

function findImaginePictureById(imaginePictureId: string): PapelizImaginePicture | undefined {
  return usePapelizImagineStore.getState().imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === imaginePictureId)
}

function updateImaginePictureById(imaginePictureId: string, imaginePictureChanges: Partial<PapelizImaginePicture>): void {
  usePapelizImagineStore.setState((imagineState) => ({
    imaginePictures: imagineState.imaginePictures.map((imaginePicture) =>
      imaginePicture.imaginePictureId === imaginePictureId ? { ...imaginePicture, ...imaginePictureChanges } : imaginePicture,
    ),
  }))
}

interface PapelizImaginePictureMakingRequest {
  imageModelChoice: PapelizAssistantMediaModelChoice
  imagePromptText: string
  // The chosen shape ("16:9", or an older "Landscape"), made as it is when the model makes it, else as
  // 1:1 or the model's first; null for 1:1.
  storedImageShapeText: string | null
  pictureCount: number
  abortSignal?: AbortSignal
  imaginePromptPlace: PapelizImaginePromptPlace
}

// Makes pictures of a prompt with the chosen image model, for the Imagine tab, the chat and Imagine
// Here. They join Imagine's pictures, newest first, and are given back. Throws when the provider
// can't make them.
export async function makePapelizImaginePictures(pictureMakingRequest: PapelizImaginePictureMakingRequest): Promise<PapelizImaginePicture[]> {
  const { imageModelChoice, imagePromptText, storedImageShapeText, pictureCount, abortSignal, imaginePromptPlace } = pictureMakingRequest
  const imageGenerationPreset = findPapelizAssistantImageGenerationPreset(imageModelChoice.papelizAssistantProviderId)
  const mediaConnection = buildPapelizAssistantMediaProviderConnection('image-generation', imageModelChoice)
  if (mediaConnection.mediaConnectionOutcome !== 'ready') throw new PapelizAssistantProviderError(mediaConnection.mediaSetupProblem, null)
  if (imageGenerationPreset === null) throw new PapelizAssistantProviderError('This provider doesn’t make pictures.', null)
  const imageAspectRatioChoice = resolvePapelizAssistantImageAspectRatioChoice(imageGenerationPreset, imageModelChoice.providerModelName, storedImageShapeText)
  const generatedImages = await generatePapelizAssistantImages({
    providerConnection: mediaConnection.providerConnection,
    imageGenerationProviderPath: imageGenerationPreset.imageGenerationProviderPath,
    imagePromptText: imagePromptText.trim(),
    imageSizeValue: imageAspectRatioChoice?.imageSizeValue ?? null,
    imageSizeFieldStyle: imageGenerationPreset.imageSizeFieldStyle,
    generatedImageCount: Math.max(1, Math.min(papelizImagineMaximumGeneratedPictureCount, pictureCount)),
    imageResponseFormatValue: imageGenerationPreset.imageResponseFormatValue,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  if (abortSignal?.aborted === true) throw new DOMException('Stopped.', 'AbortError')
  return addPapelizMadeImaginePictures(
    generatedImages.map((generatedImage) => generatedImage.generatedImageBlob),
    imagePromptText,
    `${imageModelChoice.providerModelName} · ${mediaConnection.providerDisplayName}`,
    imaginePromptPlace,
  )
}

// Pictures a provider made (or changed, for Edit Picture) join Imagine's pictures, newest first. Made
// from the chat or a note, they also join the Imagine tab's thread under their prompt; the tab's own
// prompts are in the thread already.
export async function addPapelizMadeImaginePictures(
  madePictureBlobs: readonly Blob[],
  madePictureDescriptionText: string,
  imageModelLabel: string,
  imaginePromptPlace: PapelizImaginePromptPlace,
): Promise<PapelizImaginePicture[]> {
  const madeImaginePictures = (
    await Promise.all(madePictureBlobs.map((madePictureBlob) => createImaginePicture(madePictureBlob, 'generated', madePictureDescriptionText.trim(), imageModelLabel)))
  ).filter((imaginePicture): imaginePicture is PapelizImaginePicture => imaginePicture !== null)
  usePapelizImagineStore.setState((imagineState) => ({
    imaginePictures: [...madeImaginePictures, ...imagineState.imaginePictures],
    imagineThreadEntries:
      imaginePromptPlace === 'imagine' || madeImaginePictures.length === 0
        ? imagineState.imagineThreadEntries
        : [
            ...imagineState.imagineThreadEntries,
            {
              imagineThreadEntryId: createImagineThreadEntryId(),
              imagineThreadEntryKind: 'prompt',
              imaginePromptText: madePictureDescriptionText.trim(),
              imaginePromptPlace,
              imageModelLabel,
              requestedPictureCount: madeImaginePictures.length,
              imaginePromptStage: 'made',
              imaginePromptProblem: null,
              imaginePictureIds: madeImaginePictures.map((imaginePicture) => imaginePicture.imaginePictureId),
            },
          ],
  }))
  return madeImaginePictures
}

// A free path in `Attachments/` for a picture: "imagine-2026-11-03-0612-a-red-fox.webp".
export async function pickPapelizImaginePictureFileRelativePath(imaginePictureId: string): Promise<string> {
  const imaginePicture = findImaginePictureById(imaginePictureId)
  if (imaginePicture === undefined) throw new PapelizAssistantProviderError('The picture was removed.', null)
  return pickPapelizFreeMediaFileRelativePath(buildImaginePictureFileBaseName(imaginePicture), papelizAssistantImageFileExtensions[imaginePicture.imaginePictureFormat])
}

// `![prompt](../Attachments/…)` for a note, the path taken from the note's own folder.
export function buildPapelizImaginePictureLinkMarkdown(imaginePicture: PapelizImaginePicture, vaultNoteRelativePath: string, pictureVaultFileRelativePath: string): string {
  return buildPapelizPictureLinkMarkdown(
    imaginePicture.imaginePictureDescriptionText.replace(/\.(png|jpe?g|webp)$/i, ''),
    buildPapelizVaultFileLinkPathFromNote(vaultNoteRelativePath, pictureVaultFileRelativePath),
  )
}

// Saves a picture at a path (cleaned while Remove Metadata is on, as it came while it is off). Once saved,
// the picture shown is the file in the vault.
export async function savePapelizImaginePictureAt(imaginePictureId: string, pictureVaultFileRelativePath: string): Promise<void> {
  const imaginePicture = findImaginePictureById(imaginePictureId)
  if (imaginePicture === undefined) throw new PapelizAssistantProviderError('The picture was removed.', null)
  const { savedPictureBlob, removedMetadataNames } = await readImaginePictureBytesToSave(imaginePicture)
  await writePapelizMediaFileToVault(pictureVaultFileRelativePath, savedPictureBlob)
  const savedPicturePreviewUrl = savedPictureBlob === imaginePicture.imaginePictureBlob ? imaginePicture.imaginePicturePreviewUrl : URL.createObjectURL(savedPictureBlob)
  if (savedPicturePreviewUrl !== imaginePicture.imaginePicturePreviewUrl) URL.revokeObjectURL(imaginePicture.imaginePicturePreviewUrl)
  updateImaginePictureById(imaginePictureId, {
    imaginePictureBlob: savedPictureBlob,
    imaginePicturePreviewUrl: savedPicturePreviewUrl,
    savedVaultFileRelativePath: pictureVaultFileRelativePath,
    removedMetadataNamesWhenSaved: removedMetadataNames,
    imaginePictureProblem: null,
  })
}
