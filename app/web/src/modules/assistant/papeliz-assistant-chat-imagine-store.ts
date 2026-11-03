import { create } from 'zustand'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { makePapelizImaginePictures, usePapelizImagineStore } from './papeliz-assistant-imagine-store'
import { resolvePapelizAssistantMediaModelNow } from './papeliz-assistant-media-model-choices-store'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'

// Pictures made from the chat box's Imagine button: what is typed is the prompt, and the pictures
// appear in the chat as an entry of their own, each with Remove C2PA, Save to Vault and Put in Note.
// They are Imagine's pictures too, so the Imagine tab shows them all. Nothing goes to the chat's model.

export interface PapelizChatImagineRun {
  chatImagineRunId: string
  imaginePromptText: string
  chatImagineRunStage: 'making' | 'made' | 'failed'
  imaginePictureIds: string[]
  chatImagineRunProblem: string | null
  // "muse-image-1.0 · Meta Model API".
  imageModelLabel: string | null
}

interface PapelizChatImagineState {
  chatImagineRunsById: Record<string, PapelizChatImagineRun>
  imagineInChat: (imaginePromptText: string) => Promise<void>
}

let nextChatImagineRunNumber = 1

export const usePapelizChatImagineStore = create<PapelizChatImagineState>()((setChatImagineState) => {
  const updateChatImagineRun = (chatImagineRunId: string, chatImagineRunChanges: Partial<PapelizChatImagineRun>) =>
    setChatImagineState((chatImagineState) => {
      const chatImagineRun = chatImagineState.chatImagineRunsById[chatImagineRunId]
      return chatImagineRun === undefined ? chatImagineState : { chatImagineRunsById: { ...chatImagineState.chatImagineRunsById, [chatImagineRunId]: { ...chatImagineRun, ...chatImagineRunChanges } } }
    })

  return {
    chatImagineRunsById: {},
    imagineInChat: async (imaginePromptText) => {
      const trimmedPromptText = imaginePromptText.trim()
      if (trimmedPromptText.length === 0) return
      const chatImagineRunId = `papeliz-chat-imagine-${nextChatImagineRunNumber++}`
      const imageModelChoice = resolvePapelizAssistantMediaModelNow('image-generation')
      setChatImagineState((chatImagineState) => ({
        chatImagineRunsById: {
          ...chatImagineState.chatImagineRunsById,
          [chatImagineRunId]: {
            chatImagineRunId,
            imaginePromptText: trimmedPromptText,
            chatImagineRunStage: imageModelChoice === null ? 'failed' : 'making',
            imaginePictureIds: [],
            chatImagineRunProblem: imageModelChoice === null ? 'Add a provider that makes pictures (the Meta Model API does) in Settings › AI Provider.' : null,
            imageModelLabel:
              imageModelChoice === null
                ? null
                : `${imageModelChoice.providerModelName} · ${findPapelizAssistantProviderPreset(imageModelChoice.papelizAssistantProviderId).providerPresetDisplayName}`,
          },
        },
      }))
      usePapelizAssistantConversationStore.getState().appendImaginePicturesChatEntry(chatImagineRunId, trimmedPromptText)
      if (imageModelChoice === null) return
      try {
        const madeImaginePictures = await makePapelizImaginePictures({
          imageModelChoice,
          imagePromptText: trimmedPromptText,
          imageSizeText: usePapelizImagineStore.getState().imagineImageSizeText,
          pictureCount: 1,
          imaginePromptPlace: 'chat',
        })
        updateChatImagineRun(chatImagineRunId, { chatImagineRunStage: 'made', imaginePictureIds: madeImaginePictures.map((imaginePicture) => imaginePicture.imaginePictureId) })
      } catch (chatImagineError) {
        updateChatImagineRun(chatImagineRunId, { chatImagineRunStage: 'failed', chatImagineRunProblem: describePapelizAssistantMediaProblem(chatImagineError) })
      }
    },
  }
})
