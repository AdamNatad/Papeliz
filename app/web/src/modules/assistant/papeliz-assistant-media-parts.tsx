import { Check, CircleAlert, FilePlus, FileText, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizListboxSelect } from '../ui/papeliz-listbox-select'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import {
  describePapelizAssistantMediaModelChoiceValue,
  listPapelizMediaCapableSavedProviderIds,
  listPapelizOfferedAssistantMediaModels,
  readPapelizAssistantMediaModelChoiceValue,
  resolvePapelizChosenAssistantMediaModel,
  usePapelizAssistantMediaModelChoicesStore,
  type PapelizAssistantMediaKind,
  type PapelizAssistantOfferedMediaModel,
} from './papeliz-assistant-media-model-choices-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { PapelizTextDiffView } from './papeliz-assistant-proposal-card'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { diffPapelizTextByWords } from './papeliz-assistant-text-diff'

// The pieces Imagine and Transcribe share: a switch, the media model picker, the line that says where
// a request goes, and the diff card for a change to a note.

interface PapelizAssistantMediaSwitchProps {
  mediaSwitchLabel: string
  isMediaSwitchOn: boolean
  isMediaSwitchDisabled?: boolean
  onMediaSwitchToggle: (isMediaSwitchOn: boolean) => void
}

export function PapelizAssistantMediaSwitch({ mediaSwitchLabel, isMediaSwitchOn, isMediaSwitchDisabled = false, onMediaSwitchToggle }: PapelizAssistantMediaSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isMediaSwitchOn}
      disabled={isMediaSwitchDisabled}
      onClick={() => onMediaSwitchToggle(!isMediaSwitchOn)}
      className="inline-flex min-h-6 items-center gap-2 rounded-full pr-1 text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={joinPapelizClassNames(
          'relative h-4 w-7 flex-none rounded-full transition-colors after:absolute after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgb(17_17_18/0.25)] after:transition-[left] after:duration-150',
          isMediaSwitchOn ? 'bg-papeliz-blue after:left-3.5' : 'bg-papeliz-line-strong after:left-0.5',
        )}
      />
      {mediaSwitchLabel}
    </button>
  )
}

export function PapelizAssistantMediaProblemLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[12.5px] leading-snug text-papeliz-diff-removed-ink">
      <CircleAlert className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

export function PapelizAssistantMediaSectionHeading({ children }: { children: ReactNode }) {
  return <h4 className="px-0.5 text-[12px] font-semibold tracking-wide text-papeliz-ink-subtle uppercase">{children}</h4>
}

// The models offered now and the one in use, read again whenever the providers or the picks change.
export function usePapelizChosenAssistantMediaModel(assistantMediaKind: PapelizAssistantMediaKind): {
  offeredMediaModels: PapelizAssistantOfferedMediaModel[]
  chosenMediaModel: PapelizAssistantOfferedMediaModel | null
  mediaCapableSavedProviderIds: string[]
} {
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const loadAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.loadAssistantProviderSettings)
  const loadAssistantMediaModelChoices = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.loadAssistantMediaModelChoices)
  const typedMediaModels = usePapelizAssistantMediaModelChoicesStore((choicesState) =>
    assistantMediaKind === 'image-generation' ? choicesState.typedImageGenerationModels : choicesState.typedTranscriptionModels,
  )
  const chosenMediaModelChoice = usePapelizAssistantMediaModelChoicesStore((choicesState) =>
    assistantMediaKind === 'image-generation' ? choicesState.chosenImageGenerationModel : choicesState.chosenTranscriptionModel,
  )
  useEffect(() => {
    void loadAssistantProviderSettings()
    void loadAssistantMediaModelChoices()
  }, [loadAssistantProviderSettings, loadAssistantMediaModelChoices])
  return useMemo(() => {
    const offeredMediaModels = listPapelizOfferedAssistantMediaModels(assistantMediaKind, providerSettingsByProviderId, typedMediaModels)
    return {
      offeredMediaModels,
      chosenMediaModel: resolvePapelizChosenAssistantMediaModel(offeredMediaModels, chosenMediaModelChoice),
      mediaCapableSavedProviderIds: listPapelizMediaCapableSavedProviderIds(assistantMediaKind, providerSettingsByProviderId),
    }
  }, [assistantMediaKind, providerSettingsByProviderId, typedMediaModels, chosenMediaModelChoice])
}

interface PapelizAssistantMediaModelPickerProps {
  assistantMediaKind: PapelizAssistantMediaKind
  mediaModelPickerLabel: string
  isMediaModelPickerDisabled?: boolean
}

// The model for pictures or speech, by provider, and "Other Model" to type one a provider offers.
export function PapelizAssistantMediaModelPicker({ assistantMediaKind, mediaModelPickerLabel, isMediaModelPickerDisabled = false }: PapelizAssistantMediaModelPickerProps) {
  const { offeredMediaModels, chosenMediaModel, mediaCapableSavedProviderIds } = usePapelizChosenAssistantMediaModel(assistantMediaKind)
  const chooseAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModel)
  const addTypedAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.addTypedAssistantMediaModel)
  const [isOtherModelFormOpen, setIsOtherModelFormOpen] = useState(false)
  const [otherModelProviderId, setOtherModelProviderId] = useState('')
  const [typedOtherModelName, setTypedOtherModelName] = useState('')
  const modelPickerId = useId()
  const otherModelProviderLabelId = `${modelPickerId}-other-provider-label`
  const shownOtherModelProviderId = mediaCapableSavedProviderIds.includes(otherModelProviderId) ? otherModelProviderId : (mediaCapableSavedProviderIds[0] ?? '')

  const addOtherModel = () => {
    if (shownOtherModelProviderId.length === 0 || typedOtherModelName.trim().length === 0) return
    addTypedAssistantMediaModel(assistantMediaKind, { papelizAssistantProviderId: shownOtherModelProviderId, providerModelName: typedOtherModelName })
    setTypedOtherModelName('')
    setIsOtherModelFormOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label id={`${modelPickerId}-label`} htmlFor={`${modelPickerId}-trigger`} className="text-[12.5px] font-semibold">
          {mediaModelPickerLabel}
        </label>
        <button
          type="button"
          className="text-[12px] font-medium text-papeliz-blue hover:underline disabled:opacity-50"
          aria-expanded={isOtherModelFormOpen}
          disabled={isMediaModelPickerDisabled}
          onClick={() => setIsOtherModelFormOpen((isOpen) => !isOpen)}
        >
          Other Model
        </button>
      </div>
      {offeredMediaModels.length > 0 ? (
        <PapelizListboxSelect
          listboxSelectTriggerId={`${modelPickerId}-trigger`}
          listboxSelectLabelId={`${modelPickerId}-label`}
          isListboxSelectDisabled={isMediaModelPickerDisabled}
          chosenListboxOptionValue={chosenMediaModel === null ? '' : describePapelizAssistantMediaModelChoiceValue(chosenMediaModel)}
          listboxSelectOptions={offeredMediaModels.map((offeredMediaModel) => ({
            listboxOptionValue: describePapelizAssistantMediaModelChoiceValue(offeredMediaModel),
            listboxOptionLabel: offeredMediaModel.providerModelName,
            listboxOptionNote: offeredMediaModel.providerDisplayName,
          }))}
          onListboxOptionChoose={(listboxOptionValue) => {
            const mediaModelChoice = readPapelizAssistantMediaModelChoiceValue(listboxOptionValue)
            if (mediaModelChoice !== null) chooseAssistantMediaModel(assistantMediaKind, mediaModelChoice)
          }}
        />
      ) : (
        <p className="text-[12.5px] text-papeliz-ink-muted">No model yet. Type the one your provider offers with Other Model.</p>
      )}
      {isOtherModelFormOpen && (
        <form
          className="flex flex-col gap-1.5 rounded-xl bg-papeliz-surface p-2 shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]"
          onSubmit={(formSubmitEvent) => {
            formSubmitEvent.preventDefault()
            addOtherModel()
          }}
        >
          {mediaCapableSavedProviderIds.length > 1 && (
            <>
              <span id={otherModelProviderLabelId} className="text-[12px] text-papeliz-ink-muted">
                Provider
              </span>
              <PapelizListboxSelect
                listboxSelectTriggerId={`${modelPickerId}-other-provider`}
                listboxSelectLabelId={otherModelProviderLabelId}
                chosenListboxOptionValue={shownOtherModelProviderId}
                listboxSelectOptions={mediaCapableSavedProviderIds.map((savedProviderId) => ({
                  listboxOptionValue: savedProviderId,
                  listboxOptionLabel: findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName,
                }))}
                onListboxOptionChoose={setOtherModelProviderId}
              />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <input
              aria-label={`Model name${shownOtherModelProviderId.length > 0 ? ` for ${findPapelizAssistantProviderPreset(shownOtherModelProviderId).providerPresetDisplayName}` : ''}`}
              className="h-[30px] min-w-0 flex-1 rounded-full border border-papeliz-line-strong bg-papeliz-surface px-3 text-[13px] outline-none focus-visible:border-papeliz-blue"
              placeholder="Model name"
              value={typedOtherModelName}
              spellCheck={false}
              autoComplete="off"
              onChange={(inputChangeEvent) => setTypedOtherModelName(inputChangeEvent.target.value)}
            />
            <PapelizPillButton type="submit" pillButtonVariant="outline" pillButtonSize="small" disabled={typedOtherModelName.trim().length === 0}>
              Add
            </PapelizPillButton>
          </div>
        </form>
      )}
    </div>
  )
}

// Shown while no added provider offers pictures or speech.
export function PapelizAssistantMediaSetupCard({ mediaSetupTitle, mediaSetupText }: { mediaSetupTitle: string; mediaSetupText: string }) {
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-papeliz-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]">
      <p className="text-[13.5px] font-semibold">{mediaSetupTitle}</p>
      <p className="text-[12.5px] leading-relaxed text-papeliz-ink-muted">{mediaSetupText}</p>
      <PapelizPillButton className="self-start" pillButtonVariant="primary" pillButtonSize="small" onClick={() => requestAssistantProviderSettingsPage()}>
        Choose a Provider
      </PapelizPillButton>
    </div>
  )
}

interface PapelizAssistantMediaNoteDiffCardProps {
  vaultNoteRelativePath: string
  isNewVaultNote: boolean
  // The text the note gets: the whole new note, or what is added.
  addedNoteText: string
  noteDiffCardNote?: ReactNode
  isAccepting: boolean
  noteDiffProblem: string | null
  onNoteDiffAccept: () => void
  onNoteDiffReject: () => void
}

// A change Imagine or Transcribe proposes to a note, as a diff. Nothing is written until Accept.
export function PapelizAssistantMediaNoteDiffCard({
  vaultNoteRelativePath,
  isNewVaultNote,
  addedNoteText,
  noteDiffCardNote,
  isAccepting,
  noteDiffProblem,
  onNoteDiffAccept,
  onNoteDiffReject,
}: PapelizAssistantMediaNoteDiffCardProps) {
  const noteDiffParts = useMemo(() => diffPapelizTextByWords('', addedNoteText), [addedNoteText])
  const NoteDiffIcon = isNewVaultNote ? FilePlus : FileText
  return (
    <section
      aria-label={isNewVaultNote ? `New note ${getVaultNoteTitle(vaultNoteRelativePath)}` : `Change to ${getVaultNoteTitle(vaultNoteRelativePath)}`}
      className="flex flex-col gap-2 rounded-2xl bg-papeliz-surface p-3 shadow-[inset_0_0_0_1px_var(--color-papeliz-line),0_2px_6px_rgb(16_24_40/0.06)]"
    >
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <NoteDiffIcon className="size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />
        <span className="flex-none text-papeliz-ink-muted">{isNewVaultNote ? 'New note' : 'Add to'}</span>
        <span className="min-w-0 truncate font-semibold" title={vaultNoteRelativePath}>
          {getVaultNoteTitle(vaultNoteRelativePath)}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl bg-papeliz-surface-soft px-3 py-2 text-[12.5px] leading-relaxed">
        <PapelizTextDiffView textDiffParts={noteDiffParts} />
      </div>
      {noteDiffCardNote}
      {noteDiffProblem !== null && <PapelizAssistantMediaProblemLine>{noteDiffProblem}</PapelizAssistantMediaProblemLine>}
      <div className="flex items-center justify-end gap-2">
        <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" disabled={isAccepting} onClick={onNoteDiffReject}>
          <X className="size-3.5" aria-hidden="true" />
          Reject
        </PapelizPillButton>
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={isAccepting} onClick={onNoteDiffAccept}>
          <Check className="size-3.5" aria-hidden="true" />
          {isAccepting ? 'Saving…' : 'Accept'}
        </PapelizPillButton>
      </div>
    </section>
  )
}
