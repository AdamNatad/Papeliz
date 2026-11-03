import { ImagePlus } from 'lucide-react'
import { usePapelizChatImagineStore } from './papeliz-assistant-chat-imagine-store'
import { usePapelizImagineStore } from './papeliz-assistant-imagine-store'
import { PapelizImaginePictureCard } from './papeliz-assistant-imagine-picture-card'
import { PapelizAssistantMediaNoteDiffCard, PapelizAssistantMediaProblemLine } from './papeliz-assistant-media-parts'

interface PapelizAssistantChatImaginePicturesProps {
  chatImagineRunId: string
  imaginePromptText: string
}

// A chat entry for the chat box's Imagine: the prompt, then the pictures with Remove C2PA, Save to
// Vault and Put in Note, whose change to the note shows here as a diff to accept.
export function PapelizAssistantChatImaginePictures({ chatImagineRunId, imaginePromptText }: PapelizAssistantChatImaginePicturesProps) {
  const chatImagineRun = usePapelizChatImagineStore((chatImagineState) => chatImagineState.chatImagineRunsById[chatImagineRunId])
  const imaginePictures = usePapelizImagineStore((imagineState) => imagineState.imaginePictures)
  const imaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.imaginePictureInsertion)
  const acceptImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.acceptImaginePictureInsertion)
  const rejectImaginePictureInsertion = usePapelizImagineStore((imagineState) => imagineState.rejectImaginePictureInsertion)
  const runImaginePictures = imaginePictures.filter((imaginePicture) => chatImagineRun?.imaginePictureIds.includes(imaginePicture.imaginePictureId) === true)
  const isRunInsertionShown = imaginePictureInsertion !== null && chatImagineRun?.imaginePictureIds.includes(imaginePictureInsertion.imaginePictureId) === true

  return (
    <section aria-label={`Imagine: ${imaginePromptText}`} className="papeliz-pop-enter flex flex-col gap-2">
      <div className="flex justify-end">
        <div className="papeliz-selectable-text flex max-w-[88%] items-start gap-2 rounded-[20px] bg-papeliz-surface-gray px-3.5 py-2.5 text-sm whitespace-pre-wrap">
          <ImagePlus className="mt-0.5 size-4 flex-none text-papeliz-blue" aria-label="Imagine" />
          <span>{imaginePromptText}</span>
        </div>
      </div>
      {chatImagineRun === undefined ? (
        <p className="text-[12.5px] text-papeliz-ink-subtle">These pictures were made earlier; the Imagine tab keeps the ones made since the page opened.</p>
      ) : chatImagineRun.chatImagineRunStage === 'making' ? (
        <p className="text-[13px] text-papeliz-ink-muted" aria-live="polite">
          Making the picture{chatImagineRun.imageModelLabel === null ? '' : ` with ${chatImagineRun.imageModelLabel}`}…
        </p>
      ) : chatImagineRun.chatImagineRunStage === 'failed' ? (
        <PapelizAssistantMediaProblemLine>{chatImagineRun.chatImagineRunProblem}</PapelizAssistantMediaProblemLine>
      ) : (
        <ul aria-label="Pictures" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2.5">
          {runImaginePictures.map((imaginePicture) => (
            <PapelizImaginePictureCard key={imaginePicture.imaginePictureId} imaginePicture={imaginePicture} />
          ))}
        </ul>
      )}
      {isRunInsertionShown && imaginePictureInsertion !== null && (
        <PapelizAssistantMediaNoteDiffCard
          vaultNoteRelativePath={imaginePictureInsertion.vaultNoteRelativePath}
          isNewVaultNote={false}
          addedNoteText={imaginePictureInsertion.pictureNoteTextInsertion.insertedNoteText}
          noteDiffCardNote={
            <p className="text-[11.5px] leading-snug text-papeliz-ink-subtle">
              Accept saves the picture as {imaginePictureInsertion.plannedPictureVaultFileRelativePath} and puts the link after the cursor’s line.
            </p>
          }
          isAccepting={imaginePictureInsertion.insertionStage === 'accepting'}
          noteDiffProblem={imaginePictureInsertion.insertionProblem}
          onNoteDiffAccept={() => void acceptImaginePictureInsertion()}
          onNoteDiffReject={rejectImaginePictureInsertion}
        />
      )}
    </section>
  )
}
