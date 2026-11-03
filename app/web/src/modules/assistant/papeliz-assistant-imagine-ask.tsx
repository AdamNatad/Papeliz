import { ChevronDown, MessageCircleQuestion, Paintbrush, Settings, WandSparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import type { PapelizPopoverMenuItem } from '../ui/papeliz-popover-menu'
import {
  selectIsPapelizImagineAskAnswering,
  splitPapelizImagineAskAnswer,
  usePapelizImagineAskStore,
  type PapelizImagineAskEntry,
} from './papeliz-assistant-imagine-ask-store'
import {
  PapelizImagineBox,
  PapelizImagineBoxMenuButton,
  PapelizImagineBoxNotice,
  PapelizImagineBoxSendButton,
  PapelizImagineBoxStopButton,
} from './papeliz-assistant-imagine-box'
import { focusPapelizImagineBoxTextAtEnd } from './papeliz-assistant-imagine-draw'
import { readPapelizImagineSectionLabel, usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import { usePapelizImagineStore } from './papeliz-assistant-imagine-store'
import { PapelizAssistantMediaProblemLine } from './papeliz-assistant-media-parts'
import { PapelizAssistantMessageMarkdown } from './papeliz-assistant-message-markdown'
import { useIsPapelizOnePressMicBusy, usePapelizOnePressMic } from './papeliz-assistant-one-press-mic'
import { joinPapelizTranscribedWordsToText } from './papeliz-assistant-one-press-mic-controller'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  getActivePapelizAssistantProviderConnection,
  listPapelizEnabledProviderModelNames,
  listPapelizSavedAssistantProviderIds,
  selectActivePapelizAssistantProviderId,
  selectActivePapelizAssistantProviderModelName,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'

// Questions the empty Ask offers; a press puts one in the box, to send as it is or after a change.
const papelizImagineAskExampleQuestionTexts = [
  'Help me describe a cozy reading corner',
  'Which styles suit a children’s book cover?',
  'Make my idea of a city at night more vivid',
] as const

// A prompt the answer thinks worth drawing, with Draw This, which puts it in Draw's box.
function PapelizImagineAskDrawPromptCard({ drawPromptText, isDrawPromptComplete }: { drawPromptText: string; isDrawPromptComplete: boolean }) {
  const drawSectionLabel = readPapelizImagineSectionLabel('draw')
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-papeliz-line bg-papeliz-surface p-3">
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-papeliz-ink-subtle uppercase">
        <Paintbrush className="size-3.5 text-papeliz-blue" aria-hidden="true" />
        Prompt
      </span>
      <p className="papeliz-selectable-text text-[13.5px] leading-relaxed whitespace-pre-wrap">{drawPromptText}</p>
      <PapelizPillButton
        className="self-start"
        pillButtonVariant="primary"
        pillButtonSize="small"
        disabled={!isDrawPromptComplete}
        title={`Put this prompt in ${drawSectionLabel}'s box. Nothing is sent until Send.`}
        onClick={() => {
          usePapelizImagineStore.getState().setImaginePromptText(drawPromptText)
          usePapelizImagineSectionStore.getState().openDrawWithBoxFocused()
        }}
      >
        <Paintbrush className="size-3.5" aria-hidden="true" />
        {drawSectionLabel} This
      </PapelizPillButton>
    </div>
  )
}

function PapelizImagineAskEntryView({ imagineAskEntry }: { imagineAskEntry: PapelizImagineAskEntry }) {
  if (imagineAskEntry.imagineAskEntryKind === 'question') {
    return (
      <div className="papeliz-pop-enter flex justify-end">
        <div className="papeliz-selectable-text max-w-[88%] rounded-[16px_16px_4px_16px] bg-papeliz-surface-soft px-[13px] py-[9px] text-sm break-words whitespace-pre-wrap">{imagineAskEntry.askQuestionText}</div>
      </div>
    )
  }
  const askAnswerParts = splitPapelizImagineAskAnswer(imagineAskEntry.askAnswerText)
  return (
    <section aria-label="Answer" className="papeliz-pop-enter flex flex-col gap-2">
      {/* "Assistant · model", one quiet line, as in Notes. */}
      <div className="-mb-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle">
        <b className="font-semibold text-papeliz-ink-muted">Assistant</b>
        {imagineAskEntry.askAnswerModelName.length > 0 && (
          <>
            <span className="text-papeliz-line-strong" aria-hidden="true">
              ·
            </span>
            <span className="min-w-0 truncate">{imagineAskEntry.askAnswerModelName}</span>
          </>
        )}
        {imagineAskEntry.isAskAnswerStreaming && askAnswerParts.length > 0 && (
          <span className="papeliz-saving-dot size-1.5 flex-none rounded-full bg-papeliz-blue motion-reduce:animate-none" aria-label="Writing" />
        )}
      </div>
      {askAnswerParts.length === 0 && imagineAskEntry.isAskAnswerStreaming && (
        <p className="flex items-center gap-2 text-sm text-papeliz-ink-subtle">
          <span className="papeliz-saving-dot size-1.5 flex-none rounded-full bg-papeliz-blue motion-reduce:animate-none" aria-label="Writing" />
          Thinking…
        </p>
      )}
      {askAnswerParts.map((askAnswerPart, askAnswerPartIndex) =>
        askAnswerPart.askAnswerPartKind === 'words' ? (
          <PapelizAssistantMessageMarkdown key={askAnswerPartIndex} assistantMessageText={askAnswerPart.askAnswerWordsText} />
        ) : (
          <PapelizImagineAskDrawPromptCard key={askAnswerPartIndex} drawPromptText={askAnswerPart.drawPromptText} isDrawPromptComplete={askAnswerPart.isDrawPromptComplete} />
        ),
      )}
      {imagineAskEntry.isAskAnswerStopped && <p className="text-[13px] text-papeliz-ink-subtle">Stopped.</p>}
      {imagineAskEntry.askAnswerProblem !== null && <PapelizAssistantMediaProblemLine>{imagineAskEntry.askAnswerProblem}</PapelizAssistantMediaProblemLine>}
    </section>
  )
}

// Ask: a talk with the AI Assistant's chat model about a picture before it is drawn. The thread on
// top, oldest first, scrolled to the newest, and the box below it: the question, then + (transcribe an
// audio file into it), the chat model, the one-press mic and Send. Before a chat provider is set up
// the box still shows, with the way to choose one. Nothing is sent until Send.
export function PapelizImagineAskSection() {
  const imagineAskEntries = usePapelizImagineAskStore((imagineAskState) => imagineAskState.imagineAskEntries)
  const imagineAskDraftText = usePapelizImagineAskStore((imagineAskState) => imagineAskState.imagineAskDraftText)
  const imagineAskTokenUsage = usePapelizImagineAskStore((imagineAskState) => imagineAskState.imagineAskTokenUsage)
  const isImagineAskAnswering = usePapelizImagineAskStore(selectIsPapelizImagineAskAnswering)
  const setImagineAskDraftText = usePapelizImagineAskStore((imagineAskState) => imagineAskState.setImagineAskDraftText)
  const sendImagineAskQuestion = usePapelizImagineAskStore((imagineAskState) => imagineAskState.sendImagineAskQuestion)
  const stopImagineAskAnswer = usePapelizImagineAskStore((imagineAskState) => imagineAskState.stopImagineAskAnswer)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderId)
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderModelName)
  const chooseActiveAssistantProviderModel = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.chooseActiveAssistantProviderModel)
  const loadAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.loadAssistantProviderSettings)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const threadScrollAreaRef = useRef<HTMLDivElement>(null)
  const questionTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const hasThreadScrolledRef = useRef(false)
  const newestImagineAskEntry = imagineAskEntries.at(-1)
  // The spoken words join the question, and the box takes focus with the caret after them.
  const askOnePressMicStore = usePapelizOnePressMic((transcribedWords) => {
    const { imagineAskDraftText: typedQuestionText, setImagineAskDraftText: setTypedQuestionText } = usePapelizImagineAskStore.getState()
    setTypedQuestionText(joinPapelizTranscribedWordsToText(typedQuestionText, transcribedWords))
    focusPapelizImagineBoxTextAtEnd(questionTextAreaRef.current)
  })
  const isAskMicBusy = useIsPapelizOnePressMicBusy(askOnePressMicStore)
  // The settings above are read, so this follows the provider as it is set up.
  const isChatProviderReady = getActivePapelizAssistantProviderConnection().providerConnectionOutcome === 'ready'
  const canSendQuestion = isChatProviderReady && imagineAskDraftText.trim().length > 0 && !isImagineAskAnswering && !isAskMicBusy
  const sendQuestion = () => {
    if (canSendQuestion) void sendImagineAskQuestion()
  }

  useEffect(() => {
    void loadAssistantProviderSettings()
  }, [loadAssistantProviderSettings])

  useEffect(() => {
    // To the newest entry: at once when Ask opens, smoothly as the answer comes in.
    const threadScrollArea = threadScrollAreaRef.current
    if (threadScrollArea === null) return
    threadScrollArea.scrollTo({ top: threadScrollArea.scrollHeight, behavior: hasThreadScrolledRef.current ? 'smooth' : 'auto' })
    hasThreadScrolledRef.current = true
  }, [imagineAskEntries.length, newestImagineAskEntry])

  // The chat models switched on in Settings › AI Provider, by provider, as in the notes chat's model chip.
  const chatModelMenuItems: PapelizPopoverMenuItem[] = [
    ...listPapelizSavedAssistantProviderIds(providerSettingsByProviderId).flatMap((savedProviderId) =>
      listPapelizEnabledProviderModelNames(providerSettingsByProviderId[savedProviderId]).map((enabledProviderModelName, enabledProviderModelIndex) => ({
        menuItemKey: `${savedProviderId}/${enabledProviderModelName}`,
        menuItemLabel: enabledProviderModelName,
        isMenuItemChecked: savedProviderId === activeAssistantProviderId && enabledProviderModelName === activeProviderModelName,
        ...(enabledProviderModelIndex === 0 ? { menuItemGroupHeading: findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName } : {}),
        onMenuItemSelect: () => {
          void chooseActiveAssistantProviderModel({ papelizAssistantProviderId: savedProviderId, providerModelName: enabledProviderModelName }).catch(() => undefined)
        },
      })),
    ),
    { menuItemKey: 'ai-provider-settings', menuItemLabel: 'AI Provider', MenuItemIcon: Settings, menuItemGroupHeading: 'Settings', onMenuItemSelect: () => requestAssistantProviderSettingsPage() },
  ]

  return (
    <>
      <div ref={threadScrollAreaRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-3 pb-3">
        {imagineAskEntries.length === 0 ? (
          <div className="papeliz-pop-enter m-auto flex max-w-[320px] flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
              <MessageCircleQuestion className="size-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm text-papeliz-ink-muted">
              Talk a picture through before you draw it: the subject, the style, the light. When an answer has a prompt worth drawing, {readPapelizImagineSectionLabel('draw')}{' '}
              This puts it in {readPapelizImagineSectionLabel('draw')}. Nothing is sent until Send.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {papelizImagineAskExampleQuestionTexts.map((exampleQuestionText) => (
                <button
                  key={exampleQuestionText}
                  type="button"
                  className="papeliz-assistant-suggestion-chip"
                  onClick={() => {
                    setImagineAskDraftText(exampleQuestionText)
                    focusPapelizImagineBoxTextAtEnd(questionTextAreaRef.current)
                  }}
                >
                  {exampleQuestionText}
                </button>
              ))}
            </div>
          </div>
        ) : (
          imagineAskEntries.map((imagineAskEntry) => <PapelizImagineAskEntryView key={imagineAskEntry.imagineAskEntryId} imagineAskEntry={imagineAskEntry} />)
        )}
      </div>
      <PapelizImagineBox
        boxTextAreaRef={questionTextAreaRef}
        boxText={imagineAskDraftText}
        boxTextLabel="Ask about a picture"
        boxPlaceholder="Ask about a picture…"
        onBoxTextChange={setImagineAskDraftText}
        onBoxSend={sendQuestion}
        boxNotice={
          !isChatProviderReady && (
            <PapelizImagineBoxNotice
              boxNoticeIcon={<WandSparkles className="size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />}
              boxNoticeText="Choose a provider to type or speak"
              boxNoticeAction={
                <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => requestAssistantProviderSettingsPage()}>
                  Choose a Provider
                </PapelizPillButton>
              }
            />
          )
        }
        boxAddMenuItems={[]}
        boxAddButtonTitle="Transcribe an audio file into the question"
        audioFileInputLabel="Transcribe an audio file into the question"
        boxContextTokenUsage={isChatProviderReady ? imagineAskTokenUsage : undefined}
        boxChips={
          isChatProviderReady && (
            <PapelizImagineBoxMenuButton
              menuLabel="Model"
              menuItems={chatModelMenuItems}
              menuButtonAriaLabel={`Model: ${activeProviderModelName}`}
              menuButtonTitle="The chat model that answers. Click to change."
              menuButtonClassName="max-w-[55%] flex-shrink"
            >
              <span className="truncate">{activeProviderModelName}</span>
              <ChevronDown className="size-3 flex-none opacity-70" aria-hidden="true" />
            </PapelizImagineBoxMenuButton>
          )
        }
        onePressMicStore={askOnePressMicStore}
        // Before a chat provider is set up there is nothing to send the words to: the mic opens the settings.
        onMicPressInstead={isChatProviderReady ? undefined : () => requestAssistantProviderSettingsPage()}
        boxSendControls={
          isImagineAskAnswering ? (
            <PapelizImagineBoxStopButton stopButtonTitle="Stop the answer" onStop={stopImagineAskAnswer} />
          ) : (
            <PapelizImagineBoxSendButton sendButtonTitle={isChatProviderReady ? 'Send (Enter)' : 'Choose a provider first'} isSendDisabled={!canSendQuestion} onSend={sendQuestion} />
          )
        }
      />
    </>
  )
}
