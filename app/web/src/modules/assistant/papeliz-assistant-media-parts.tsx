import { Check, CircleAlert, FilePlus, FileText, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizTooltipBubble } from '../ui/papeliz-hover-tooltip'
import { PapelizListboxSelect } from '../ui/papeliz-listbox-select'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import {
  describePapelizAssistantMediaModelInUse,
  listPapelizMediaCapableSavedProviderIds,
  listPapelizOfferedAssistantMediaModels,
  resolvePapelizChosenAssistantMediaModel,
  selectPapelizChosenAssistantMediaModelChoice,
  selectPapelizTypedAssistantMediaModels,
  usePapelizAssistantMediaModelChoicesStore,
  type PapelizAssistantMediaKind,
  type PapelizAssistantMediaModelInUse,
  type PapelizAssistantOfferedMediaModel,
} from './papeliz-assistant-media-model-choices-store'
import { PapelizTextDiffView } from './papeliz-assistant-proposal-card'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { diffPapelizTextByWords } from './papeliz-assistant-text-diff'

// The pieces Imagine, Transcribe, Describe Picture and Models for Each Task share: a switch, the problem
// line, the models offered for a task and the one in use, the form to type another, and the diff card
// for a change to a note.

// A switch's tooltip: the bubble's words, and the same words as one sentence for screen readers.
interface PapelizAssistantMediaSwitchTooltip {
  mediaSwitchTooltipContent: ReactNode
  mediaSwitchTooltipDescriptionText: string
}

interface PapelizAssistantMediaSwitchProps {
  mediaSwitchLabel: string
  // Shown on hover: what the switch does, when the label alone doesn't say.
  mediaSwitchTitle?: string
  // The app's tooltip bubble instead of the browser's title, on hover and on keyboard focus.
  mediaSwitchTooltip?: PapelizAssistantMediaSwitchTooltip
  isMediaSwitchOn: boolean
  isMediaSwitchDisabled?: boolean
  onMediaSwitchToggle: (isMediaSwitchOn: boolean) => void
}

export function PapelizAssistantMediaSwitch({
  mediaSwitchLabel,
  mediaSwitchTitle,
  mediaSwitchTooltip,
  isMediaSwitchOn,
  isMediaSwitchDisabled = false,
  onMediaSwitchToggle,
}: PapelizAssistantMediaSwitchProps) {
  const mediaSwitchTooltipDescriptionId = useId()
  // The wrapper the bubble sits under, while the pointer is over it or the switch has keyboard focus.
  const [pointerOverTooltipAnchorElement, setPointerOverTooltipAnchorElement] = useState<HTMLElement | null>(null)
  const [keyboardFocusedTooltipAnchorElement, setKeyboardFocusedTooltipAnchorElement] = useState<HTMLElement | null>(null)
  const shownTooltipAnchorElement = pointerOverTooltipAnchorElement ?? keyboardFocusedTooltipAnchorElement
  const hideMediaSwitchTooltip = useCallback(() => {
    setPointerOverTooltipAnchorElement(null)
    setKeyboardFocusedTooltipAnchorElement(null)
  }, [])

  return (
    // The hover sits on a wrapper, so the tooltip still shows once the switch is disabled.
    <span
      className="inline-flex"
      onMouseEnter={mediaSwitchTooltip === undefined ? undefined : (mouseEnterEvent) => setPointerOverTooltipAnchorElement(mouseEnterEvent.currentTarget)}
      onMouseLeave={mediaSwitchTooltip === undefined ? undefined : () => setPointerOverTooltipAnchorElement(null)}
    >
      <button
        type="button"
        role="switch"
        title={mediaSwitchTitle}
        aria-checked={isMediaSwitchOn}
        aria-describedby={mediaSwitchTooltip === undefined ? undefined : mediaSwitchTooltipDescriptionId}
        disabled={isMediaSwitchDisabled}
        onClick={() => onMediaSwitchToggle(!isMediaSwitchOn)}
        onFocus={(focusEvent) => {
          if (mediaSwitchTooltip !== undefined && focusEvent.currentTarget.matches(':focus-visible')) setKeyboardFocusedTooltipAnchorElement(focusEvent.currentTarget.parentElement)
        }}
        onBlur={() => setKeyboardFocusedTooltipAnchorElement(null)}
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
      {mediaSwitchTooltip !== undefined && (
        <span id={mediaSwitchTooltipDescriptionId} className="sr-only">
          {mediaSwitchTooltip.mediaSwitchTooltipDescriptionText}
        </span>
      )}
      {mediaSwitchTooltip !== undefined && shownTooltipAnchorElement !== null && (
        <PapelizTooltipBubble
          tooltipAnchorElement={shownTooltipAnchorElement}
          tooltipBubbleContent={mediaSwitchTooltip.mediaSwitchTooltipContent}
          onTooltipBubbleLeftBehind={hideMediaSwitchTooltip}
        />
      )}
    </span>
  )
}

// What Remove Metadata takes out of a picture when it is saved; the picture itself stays as it is.
const papelizRemoveMetadataTooltip: PapelizAssistantMediaSwitchTooltip = {
  mediaSwitchTooltipContent: (
    <span className="block">
      <b className="block font-semibold">Removed when saved</b>
      <span className="block">C2PA content credentials</span>
      <span className="block">EXIF: camera, date and location</span>
      <span className="block">XMP and IPTC</span>
      <span className="block">Text chunks and comments</span>
      <span className="mt-1 block text-papeliz-surface/75">The picture itself is untouched.</span>
    </span>
  ),
  mediaSwitchTooltipDescriptionText:
    'Removed when saved: C2PA content credentials, EXIF (camera, date and location), XMP and IPTC, text chunks and comments. The picture itself is untouched.',
}

interface PapelizAssistantRemoveMetadataSwitchProps {
  isRemoveMetadataOn: boolean
  isRemoveMetadataSwitchDisabled?: boolean
  onRemoveMetadataToggle: (isRemoveMetadataOn: boolean) => void
}

// Remove Metadata on a picture in Draw, Gallery, the chat and a note's Imagine and Edit Picture cards,
// with a tooltip that says what it removes.
export function PapelizAssistantRemoveMetadataSwitch({ isRemoveMetadataOn, isRemoveMetadataSwitchDisabled = false, onRemoveMetadataToggle }: PapelizAssistantRemoveMetadataSwitchProps) {
  return (
    <PapelizAssistantMediaSwitch
      mediaSwitchLabel="Remove Metadata"
      mediaSwitchTooltip={papelizRemoveMetadataTooltip}
      isMediaSwitchOn={isRemoveMetadataOn}
      isMediaSwitchDisabled={isRemoveMetadataSwitchDisabled}
      onMediaSwitchToggle={onRemoveMetadataToggle}
    />
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

// The models offered now for a task and the one in use, read again whenever the providers or the
// picks change: the menus of Draw's chip and of Models for Each Task. `chosenMediaModel` is null while
// nothing can do the task, and for Describe Picture on Same as Chat.
export function usePapelizChosenAssistantMediaModel(assistantMediaKind: PapelizAssistantMediaKind): {
  offeredMediaModels: PapelizAssistantOfferedMediaModel[]
  chosenMediaModel: PapelizAssistantOfferedMediaModel | null
  // Nothing chosen, or the chosen model is no longer offered: Automatic (Same as Chat) is checked.
  isMediaModelChosenAutomatically: boolean
  mediaCapableSavedProviderIds: string[]
} {
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const loadAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.loadAssistantProviderSettings)
  const loadAssistantMediaModelChoices = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.loadAssistantMediaModelChoices)
  const typedMediaModels = usePapelizAssistantMediaModelChoicesStore((choicesState) => selectPapelizTypedAssistantMediaModels(choicesState, assistantMediaKind))
  const chosenMediaModelChoice = usePapelizAssistantMediaModelChoicesStore((choicesState) => selectPapelizChosenAssistantMediaModelChoice(choicesState, assistantMediaKind))
  useEffect(() => {
    void loadAssistantProviderSettings()
    void loadAssistantMediaModelChoices()
  }, [loadAssistantProviderSettings, loadAssistantMediaModelChoices])
  return useMemo(() => {
    const offeredMediaModels = listPapelizOfferedAssistantMediaModels(assistantMediaKind, providerSettingsByProviderId, typedMediaModels)
    const chosenMediaModel = resolvePapelizChosenAssistantMediaModel(offeredMediaModels, chosenMediaModelChoice, assistantMediaKind)
    return {
      offeredMediaModels,
      chosenMediaModel,
      isMediaModelChosenAutomatically:
        chosenMediaModelChoice === null ||
        !offeredMediaModels.some(
          (offeredMediaModel) =>
            offeredMediaModel.papelizAssistantProviderId === chosenMediaModelChoice.papelizAssistantProviderId &&
            offeredMediaModel.providerModelName === chosenMediaModelChoice.providerModelName,
        ),
      mediaCapableSavedProviderIds: listPapelizMediaCapableSavedProviderIds(assistantMediaKind, providerSettingsByProviderId),
    }
  }, [assistantMediaKind, providerSettingsByProviderId, typedMediaModels, chosenMediaModelChoice])
}

// The model a task uses now, in words (describePapelizAssistantMediaModelInUse), read again whenever
// the providers, the chat's model or the picks change: for the mic's hover and Models for Each Task.
export function usePapelizAssistantMediaModelInUse(assistantMediaKind: PapelizAssistantMediaKind): PapelizAssistantMediaModelInUse | null {
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeAssistantProviderModelName = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderModelName)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const typedMediaModels = usePapelizAssistantMediaModelChoicesStore((choicesState) => selectPapelizTypedAssistantMediaModels(choicesState, assistantMediaKind))
  const chosenMediaModelChoice = usePapelizAssistantMediaModelChoicesStore((choicesState) => selectPapelizChosenAssistantMediaModelChoice(choicesState, assistantMediaKind))
  const loadAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.loadAssistantProviderSettings)
  const loadAssistantMediaModelChoices = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.loadAssistantMediaModelChoices)
  useEffect(() => {
    void loadAssistantProviderSettings()
    void loadAssistantMediaModelChoices()
  }, [loadAssistantProviderSettings, loadAssistantMediaModelChoices])
  return useMemo(
    () =>
      describePapelizAssistantMediaModelInUse(
        assistantMediaKind,
        { activeAssistantProviderId, activeAssistantProviderModelName, providerSettingsByProviderId },
        { chosenMediaModelChoice, typedMediaModels },
      ),
    [assistantMediaKind, activeAssistantProviderId, activeAssistantProviderModelName, providerSettingsByProviderId, typedMediaModels, chosenMediaModelChoice],
  )
}

interface PapelizAssistantMediaOtherModelFormProps {
  assistantMediaKind: PapelizAssistantMediaKind
  onOtherModelFormClose: () => void
}

// Other Model: a model a provider offers that Papeliz doesn't suggest, typed by its name (and, when
// more than one added provider can do the task, for which one). Adding it picks it. Draw's chip and
// the rows of Models for Each Task open it.
export function PapelizAssistantMediaOtherModelForm({ assistantMediaKind, onOtherModelFormClose }: PapelizAssistantMediaOtherModelFormProps) {
  const { mediaCapableSavedProviderIds } = usePapelizChosenAssistantMediaModel(assistantMediaKind)
  const addTypedAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.addTypedAssistantMediaModel)
  const [otherModelProviderId, setOtherModelProviderId] = useState('')
  const [typedOtherModelName, setTypedOtherModelName] = useState('')
  const otherModelFormId = useId()
  const otherModelNameInputRef = useRef<HTMLInputElement>(null)
  const otherModelProviderLabelId = `${otherModelFormId}-provider-label`
  const shownOtherModelProviderId = mediaCapableSavedProviderIds.includes(otherModelProviderId) ? otherModelProviderId : (mediaCapableSavedProviderIds[0] ?? '')

  useEffect(() => {
    otherModelNameInputRef.current?.focus()
  }, [])

  const addOtherModel = () => {
    if (shownOtherModelProviderId.length === 0 || typedOtherModelName.trim().length === 0) return
    void addTypedAssistantMediaModel(assistantMediaKind, { papelizAssistantProviderId: shownOtherModelProviderId, providerModelName: typedOtherModelName })
    setTypedOtherModelName('')
    onOtherModelFormClose()
  }

  return (
    <form
      aria-label="Other Model"
      className="flex flex-col gap-1.5 rounded-2xl bg-papeliz-surface-soft p-2"
      onKeyDown={(formKeyEvent) => {
        if (formKeyEvent.key !== 'Escape') return
        formKeyEvent.preventDefault()
        formKeyEvent.stopPropagation()
        onOtherModelFormClose()
      }}
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
            listboxSelectTriggerId={`${otherModelFormId}-provider`}
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
          ref={otherModelNameInputRef}
          aria-label={`Model name${shownOtherModelProviderId.length > 0 ? ` for ${findPapelizAssistantProviderPreset(shownOtherModelProviderId).providerPresetDisplayName}` : ''}`}
          className="h-[30px] min-w-0 flex-1 rounded-full border border-papeliz-line-strong bg-papeliz-surface px-3 text-[13px] outline-none focus-visible:border-papeliz-blue pointer-coarse:h-10"
          placeholder="Model name"
          value={typedOtherModelName}
          spellCheck={false}
          autoComplete="off"
          onChange={(inputChangeEvent) => setTypedOtherModelName(inputChangeEvent.target.value)}
        />
        <PapelizPillButton type="submit" pillButtonVariant="outline" pillButtonSize="small" disabled={typedOtherModelName.trim().length === 0}>
          Add
        </PapelizPillButton>
        <PapelizIconButton iconButtonLabel="Close Other Model" iconButtonSize="extra-small" onClick={onOtherModelFormClose}>
          <X className="size-3" aria-hidden="true" />
        </PapelizIconButton>
      </div>
    </form>
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
