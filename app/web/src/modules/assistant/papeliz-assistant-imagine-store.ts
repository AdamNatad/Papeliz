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
import { findPapelizAssistantImageGenerationPreset } from './papeliz-assistant-media-provider-presets'
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

// Imagine: pictures made with the person's own provider and key, and pictures the person brings in,
// each with Remove C2PA (on by default), which strips content credentials and other metadata before a
// picture is saved. Nothing is sent until Generate. A picture goes into the vault's `Attachments/`
// folder on Save to Vault, or into the open note on Put in Note, which first shows the change as a diff
// and saves nothing until it is accepted. Pictures live in this page's memory until then.

export interface PapelizImaginePicture {
  imaginePictureId: string
  imaginePictureOrigin: 'generated' | 'brought-in'
  // As it arrived, metadata included.
  imaginePictureBlob: Blob
  imaginePicturePreviewUrl: string
  imaginePictureFormat: PapelizAssistantImageFileFormat
  // What Remove C2PA takes out of it, or null when it can't be read (a damaged file).
  imaginePictureMetadataNames: string[] | null
  isRemoveC2paOn: boolean
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

export type PapelizImagineGenerationStage = 'idle' | 'generating' | 'failed'

interface PapelizImagineState {
  imaginePromptText: string
  imagineImageSizeText: string | null
  imagineGeneratedPictureCount: number
  imagineGenerationStage: PapelizImagineGenerationStage
  imagineGenerationProblem: string | null
  imaginePictures: PapelizImaginePicture[]
  imaginePictureInsertion: PapelizImaginePictureInsertion | null
  setImaginePromptText: (imaginePromptText: string) => void
  setImagineImageSizeText: (imagineImageSizeText: string | null) => void
  setImagineGeneratedPictureCount: (imagineGeneratedPictureCount: number) => void
  generateImaginePictures: (imageModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
  stopImagineGeneration: () => void
  bringInImaginePictureFiles: (pictureFiles: readonly File[]) => Promise<string | null>
  setImaginePictureRemoveC2pa: (imaginePictureId: string, isRemoveC2paOn: boolean) => void
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
let activeImagineGenerationAbortController: AbortController | null = null

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
    isRemoveC2paOn: true,
    imaginePictureDescriptionText,
    imaginePictureModelLabel,
    savedVaultFileRelativePath: null,
    removedMetadataNamesWhenSaved: null,
    imaginePictureProblem: null,
  }
}

// The bytes a picture is saved with: cleaned while Remove C2PA is on, as it arrived while it is off.
async function readImaginePictureBytesToSave(imaginePicture: PapelizImaginePicture): Promise<{ savedPictureBlob: Blob; removedMetadataNames: string[] }> {
  if (!imaginePicture.isRemoveC2paOn) return { savedPictureBlob: imaginePicture.imaginePictureBlob, removedMetadataNames: [] }
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

  return {
    imaginePromptText: '',
    imagineImageSizeText: null,
    imagineGeneratedPictureCount: 1,
    imagineGenerationStage: 'idle',
    imagineGenerationProblem: null,
    imaginePictures: [],
    imaginePictureInsertion: null,

    setImaginePromptText: (imaginePromptText) => setImagineState({ imaginePromptText }),
    setImagineImageSizeText: (imagineImageSizeText) => setImagineState({ imagineImageSizeText }),
    setImagineGeneratedPictureCount: (imagineGeneratedPictureCount) =>
      setImagineState({ imagineGeneratedPictureCount: Math.max(1, Math.min(papelizImagineMaximumGeneratedPictureCount, Math.round(imagineGeneratedPictureCount))) }),

    generateImaginePictures: async (imageModelChoice) => {
      const { imaginePromptText, imagineImageSizeText, imagineGeneratedPictureCount } = getImagineState()
      if (imaginePromptText.trim().length === 0) return
      activeImagineGenerationAbortController?.abort()
      const imagineGenerationAbortController = new AbortController()
      activeImagineGenerationAbortController = imagineGenerationAbortController
      setImagineState({ imagineGenerationStage: 'generating', imagineGenerationProblem: null })
      try {
        await makePapelizImaginePictures({
          imageModelChoice,
          imagePromptText: imaginePromptText,
          imageSizeText: imagineImageSizeText,
          pictureCount: imagineGeneratedPictureCount,
          abortSignal: imagineGenerationAbortController.signal,
        })
        if (activeImagineGenerationAbortController !== imagineGenerationAbortController) return
        activeImagineGenerationAbortController = null
        setImagineState({ imagineGenerationStage: 'idle' })
      } catch (imagineGenerationError) {
        if (imagineGenerationError instanceof DOMException && imagineGenerationError.name === 'AbortError') return
        if (activeImagineGenerationAbortController !== imagineGenerationAbortController) return
        activeImagineGenerationAbortController = null
        setImagineState({ imagineGenerationStage: 'failed', imagineGenerationProblem: describePapelizAssistantMediaProblem(imagineGenerationError) })
      }
    },

    stopImagineGeneration: () => {
      activeImagineGenerationAbortController?.abort()
      activeImagineGenerationAbortController = null
      setImagineState({ imagineGenerationStage: 'idle' })
    },

    // Gives back why a file was turned away, or null when every file came in.
    bringInImaginePictureFiles: async (pictureFiles) => {
      let refusedPictureProblem: string | null = null
      const broughtInPictures: PapelizImaginePicture[] = []
      for (const pictureFile of pictureFiles) {
        if (pictureFile.size > papelizImagineBroughtInPictureByteLimit) {
          refusedPictureProblem = `${pictureFile.name} is over 20 MB.`
          continue
        }
        const broughtInPicture = await createImaginePicture(pictureFile, 'brought-in', pictureFile.name || 'picture', null)
        if (broughtInPicture === null) refusedPictureProblem = `${pictureFile.name || 'That file'} isn’t a PNG, JPEG or WebP picture.`
        else broughtInPictures.push(broughtInPicture)
      }
      setImagineState((imagineState) => ({ imaginePictures: [...broughtInPictures, ...imagineState.imaginePictures] }))
      return refusedPictureProblem
    },

    setImaginePictureRemoveC2pa: (imaginePictureId, isRemoveC2paOn) => updateImaginePicture(imaginePictureId, { isRemoveC2paOn }),

    removeImaginePicture: (imaginePictureId) => {
      const imaginePicture = findImaginePicture(imaginePictureId)
      if (imaginePicture !== undefined) URL.revokeObjectURL(imaginePicture.imaginePicturePreviewUrl)
      setImagineState((imagineState) => ({
        imaginePictures: imagineState.imaginePictures.filter((keptPicture) => keptPicture.imaginePictureId !== imaginePictureId),
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
  // A size the provider offers, or null (or one it doesn't offer) for its first.
  imageSizeText: string | null
  pictureCount: number
  abortSignal?: AbortSignal
}

// Makes pictures of a prompt with the chosen image model, for the Imagine tab, the chat and Imagine
// Here. They join Imagine's pictures, newest first, and are given back. Throws when the provider
// can't make them.
export async function makePapelizImaginePictures(pictureMakingRequest: PapelizImaginePictureMakingRequest): Promise<PapelizImaginePicture[]> {
  const { imageModelChoice, imagePromptText, imageSizeText, pictureCount, abortSignal } = pictureMakingRequest
  const imageGenerationPreset = findPapelizAssistantImageGenerationPreset(imageModelChoice.papelizAssistantProviderId)
  const mediaConnection = buildPapelizAssistantMediaProviderConnection('image-generation', imageModelChoice)
  if (mediaConnection.mediaConnectionOutcome !== 'ready') throw new PapelizAssistantProviderError(mediaConnection.mediaSetupProblem, null)
  if (imageGenerationPreset === null) throw new PapelizAssistantProviderError('This provider doesn’t make pictures.', null)
  const sentImageSizeText = imageGenerationPreset.imageSizeChoices.some((imageSizeChoice) => imageSizeChoice.imageSizeText === imageSizeText)
    ? imageSizeText
    : (imageGenerationPreset.imageSizeChoices[0]?.imageSizeText ?? null)
  const generatedImages = await generatePapelizAssistantImages({
    providerConnection: mediaConnection.providerConnection,
    imageGenerationProviderPath: imageGenerationPreset.imageGenerationProviderPath,
    imagePromptText: imagePromptText.trim(),
    imageSizeText: sentImageSizeText,
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
  )
}

// Pictures a provider made (or changed, for Edit Picture) join Imagine's pictures, newest first.
export async function addPapelizMadeImaginePictures(madePictureBlobs: readonly Blob[], madePictureDescriptionText: string, imageModelLabel: string): Promise<PapelizImaginePicture[]> {
  const madeImaginePictures = (
    await Promise.all(madePictureBlobs.map((madePictureBlob) => createImaginePicture(madePictureBlob, 'generated', madePictureDescriptionText.trim(), imageModelLabel)))
  ).filter((imaginePicture): imaginePicture is PapelizImaginePicture => imaginePicture !== null)
  usePapelizImagineStore.setState((imagineState) => ({ imaginePictures: [...madeImaginePictures, ...imagineState.imaginePictures] }))
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

// Saves a picture at a path (cleaned while Remove C2PA is on, as it came while it is off). Once saved,
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
