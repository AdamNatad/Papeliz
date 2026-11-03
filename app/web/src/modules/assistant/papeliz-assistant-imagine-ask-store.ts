import { create } from 'zustand'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { resolvePapelizAssistantMediaModelNow } from './papeliz-assistant-media-model-choices-store'
import { getActivePapelizAssistantProviderConnection, selectActivePapelizAssistantProviderModelName, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { streamPapelizChatCompletion, type PapelizChatMessage } from './papeliz-openai-compatible-client'

// Imagine's Ask: a talk with the chat model chosen for the AI Assistant about a picture before it is
// drawn. The model answers in words and draws nothing; a prompt it thinks worth drawing comes in a
// fenced block (```draw), which shows with Draw This. Ask keeps its own thread while the page is
// open, apart from the notes chat. Nothing is sent until Send.

export type PapelizImagineAskEntry =
  | { imagineAskEntryId: string; imagineAskEntryKind: 'question'; askQuestionText: string }
  | {
      imagineAskEntryId: string
      imagineAskEntryKind: 'answer'
      askAnswerText: string
      isAskAnswerStreaming: boolean
      askAnswerModelName: string
      askAnswerProblem: string | null
      isAskAnswerStopped: boolean
    }

// A piece of an answer: its words, or a prompt worth drawing (still arriving while the block is open).
export type PapelizImagineAskAnswerPart =
  | { askAnswerPartKind: 'words'; askAnswerWordsText: string }
  | { askAnswerPartKind: 'draw-prompt'; drawPromptText: string; isDrawPromptComplete: boolean }

interface PapelizImagineAskState {
  imagineAskDraftText: string
  imagineAskEntries: PapelizImagineAskEntry[]
  setImagineAskDraftText: (imagineAskDraftText: string) => void
  sendImagineAskQuestion: () => Promise<void>
  stopImagineAskAnswer: () => void
}

let nextImagineAskEntryNumber = 1
let activeImagineAskAbortController: AbortController | null = null

function createImagineAskEntryId(): string {
  return `papeliz-imagine-ask-entry-${nextImagineAskEntryNumber++}`
}

// What the chat model is told: it helps describe a picture, and marks a prompt worth drawing.
export function buildPapelizImagineAskSystemMessage(imageModelName: string | null): string {
  return [
    `You help someone work out a picture before they draw it with an image model${imageModelName === null ? '' : ` (${imageModelName})`}.`,
    'Talk it through in words: ask about what is unclear, and suggest the subject, the composition, the style, the light and the colours. Keep answers short.',
    'You cannot draw or show pictures, so never say you made one.',
    'When you have a prompt worth drawing, put it alone in a fenced block marked draw, as one paragraph written for the image model:',
    '```draw',
    'the whole prompt',
    '```',
    'Give at most three such blocks in one answer.',
  ].join('\n')
}

// Splits an answer into its words and its ```draw blocks; a block still open is a prompt still arriving.
export function splitPapelizImagineAskAnswer(askAnswerText: string): PapelizImagineAskAnswerPart[] {
  const askAnswerParts: PapelizImagineAskAnswerPart[] = []
  const pushAnswerWords = (askAnswerWordsText: string) => {
    if (askAnswerWordsText.trim().length > 0) askAnswerParts.push({ askAnswerPartKind: 'words', askAnswerWordsText: askAnswerWordsText.trim() })
  }
  const drawBlockOpeningPattern = /^```draw[^\S\n]*\n/gm
  let readUpToIndex = 0
  for (let drawBlockOpening = drawBlockOpeningPattern.exec(askAnswerText); drawBlockOpening !== null; drawBlockOpening = drawBlockOpeningPattern.exec(askAnswerText)) {
    pushAnswerWords(askAnswerText.slice(readUpToIndex, drawBlockOpening.index))
    const drawPromptStartIndex = drawBlockOpening.index + drawBlockOpening[0].length
    const drawBlockClosingIndex = askAnswerText.slice(drawPromptStartIndex).search(/^```[^\S\n]*$/m)
    const drawPromptEndIndex = drawBlockClosingIndex === -1 ? askAnswerText.length : drawPromptStartIndex + drawBlockClosingIndex
    const drawPromptText = askAnswerText.slice(drawPromptStartIndex, drawPromptEndIndex).trim()
    if (drawPromptText.length > 0) askAnswerParts.push({ askAnswerPartKind: 'draw-prompt', drawPromptText, isDrawPromptComplete: drawBlockClosingIndex !== -1 })
    if (drawBlockClosingIndex === -1) return askAnswerParts
    readUpToIndex = askAnswerText.indexOf('\n', drawPromptEndIndex) === -1 ? askAnswerText.length : askAnswerText.indexOf('\n', drawPromptEndIndex) + 1
    drawBlockOpeningPattern.lastIndex = readUpToIndex
  }
  pushAnswerWords(askAnswerText.slice(readUpToIndex))
  return askAnswerParts
}

export const usePapelizImagineAskStore = create<PapelizImagineAskState>()((setImagineAskState, getImagineAskState) => {
  const updateAskAnswerEntry = (imagineAskEntryId: string, buildAnswerChanges: (askAnswerText: string) => Partial<Extract<PapelizImagineAskEntry, { imagineAskEntryKind: 'answer' }>>) =>
    setImagineAskState((imagineAskState) => ({
      imagineAskEntries: imagineAskState.imagineAskEntries.map((imagineAskEntry) =>
        imagineAskEntry.imagineAskEntryId === imagineAskEntryId && imagineAskEntry.imagineAskEntryKind === 'answer'
          ? { ...imagineAskEntry, ...buildAnswerChanges(imagineAskEntry.askAnswerText) }
          : imagineAskEntry,
      ),
    }))

  return {
    imagineAskDraftText: '',
    imagineAskEntries: [],
    setImagineAskDraftText: (imagineAskDraftText) => setImagineAskState({ imagineAskDraftText }),

    sendImagineAskQuestion: async () => {
      const { imagineAskDraftText, imagineAskEntries } = getImagineAskState()
      const askQuestionText = imagineAskDraftText.trim()
      const activeProviderConnection = getActivePapelizAssistantProviderConnection()
      // One answer at a time, and nothing before a chat provider is set up.
      if (askQuestionText.length === 0 || activeImagineAskAbortController !== null || activeProviderConnection.providerConnectionOutcome !== 'ready') return
      const imagineAskAbortController = new AbortController()
      activeImagineAskAbortController = imagineAskAbortController
      // The talk so far: each question with the words of its answer (an answer that failed is left out).
      const earlierChatMessages: PapelizChatMessage[] = imagineAskEntries.flatMap((imagineAskEntry): PapelizChatMessage[] =>
        imagineAskEntry.imagineAskEntryKind === 'question'
          ? [{ role: 'user', content: imagineAskEntry.askQuestionText }]
          : imagineAskEntry.askAnswerText.trim().length > 0
            ? [{ role: 'assistant', content: imagineAskEntry.askAnswerText }]
            : [],
      )
      const askAnswerEntryId = createImagineAskEntryId()
      setImagineAskState((imagineAskState) => ({
        imagineAskDraftText: '',
        imagineAskEntries: [
          ...imagineAskState.imagineAskEntries,
          { imagineAskEntryId: createImagineAskEntryId(), imagineAskEntryKind: 'question', askQuestionText },
          {
            imagineAskEntryId: askAnswerEntryId,
            imagineAskEntryKind: 'answer',
            askAnswerText: '',
            isAskAnswerStreaming: true,
            askAnswerModelName: selectActivePapelizAssistantProviderModelName(usePapelizAssistantProviderSettingsStore.getState()),
            askAnswerProblem: null,
            isAskAnswerStopped: false,
          },
        ],
      }))
      try {
        const askCompletionResult = await streamPapelizChatCompletion({
          providerConnection: activeProviderConnection.providerConnection,
          chatMessages: [
            { role: 'system', content: buildPapelizImagineAskSystemMessage(resolvePapelizAssistantMediaModelNow('image-generation')?.providerModelName ?? null) },
            ...earlierChatMessages,
            { role: 'user', content: askQuestionText },
          ],
          abortSignal: imagineAskAbortController.signal,
          onAssistantTextDelta: (askAnswerTextDelta) => updateAskAnswerEntry(askAnswerEntryId, (askAnswerText) => ({ askAnswerText: askAnswerText + askAnswerTextDelta })),
        })
        updateAskAnswerEntry(askAnswerEntryId, () => ({
          askAnswerText: askCompletionResult.assistantText,
          isAskAnswerStreaming: false,
          askAnswerProblem: askCompletionResult.assistantText.trim().length === 0 ? 'The model sent no answer. Try asking again.' : null,
        }))
      } catch (imagineAskError) {
        const isAskAnswerStopped = imagineAskError instanceof DOMException && imagineAskError.name === 'AbortError'
        updateAskAnswerEntry(askAnswerEntryId, () => ({
          isAskAnswerStreaming: false,
          isAskAnswerStopped,
          askAnswerProblem: isAskAnswerStopped ? null : describePapelizAssistantMediaProblem(imagineAskError),
        }))
      } finally {
        if (activeImagineAskAbortController === imagineAskAbortController) activeImagineAskAbortController = null
      }
    },

    stopImagineAskAnswer: () => {
      activeImagineAskAbortController?.abort()
    },
  }
})

export function selectIsPapelizImagineAskAnswering(imagineAskState: Pick<PapelizImagineAskState, 'imagineAskEntries'>): boolean {
  return imagineAskState.imagineAskEntries.some((imagineAskEntry) => imagineAskEntry.imagineAskEntryKind === 'answer' && imagineAskEntry.isAskAnswerStreaming)
}
