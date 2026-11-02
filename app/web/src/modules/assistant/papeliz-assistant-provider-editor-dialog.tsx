import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, ExternalLink, Eye, EyeOff, LoaderCircle, Lock, PlugZap, RefreshCw, Search, X } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import {
  findPapelizAssistantModelPrice,
  formatPapelizAssistantModelPricePerMillionTokens,
  papelizAssistantBuiltInModelPricesCheckedOnLabel,
  usePapelizAssistantModelPricesStore,
} from './papeliz-assistant-model-prices'
import {
  findPapelizAssistantProviderPreset,
  listPapelizOfferedAssistantProviderPresets,
  papelizCustomAssistantProviderId,
  papelizRequestCostReportingAssistantProviderIds,
  type PapelizAssistantProviderPreset,
} from './papeliz-assistant-provider-presets'
import {
  buildPapelizAssistantProviderConnection,
  createDefaultPapelizAssistantProviderSettings,
  listPapelizEnabledProviderModelNames,
  readPapelizProviderTemperature,
  readPapelizProviderTokenCount,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'
import { listPapelizProviderModelNames, testPapelizProviderConnection } from './papeliz-openai-compatible-client'

// What the provider modal opens for: Add Provider, or one saved provider's gear.
export type PapelizAssistantProviderEditorRequest = { providerEditorKind: 'add' } | { providerEditorKind: 'edit'; papelizAssistantProviderId: string }

// Which check ran, so its answer shows under the field it belongs to: Test Connection under the API
// key, Load Models under the models.
type PapelizProviderCheckSubject = 'connection-test' | 'model-list'

type PapelizProviderCheckState =
  | { providerCheckKind: 'idle' }
  | { providerCheckKind: 'running'; providerCheckSubject: PapelizProviderCheckSubject; providerCheckLabel: string }
  | { providerCheckKind: 'passed' | 'failed' | 'waiting'; providerCheckSubject: PapelizProviderCheckSubject; providerCheckMessage: string }

// Thrown by a check that needs the person first ("switch on a model, then test again"): shown gray,
// not as a failure.
class PapelizProviderCheckWaitingError extends Error {}

// A check's answer: a spinner while it runs, then green for passed, red for failed, gray for waiting.
function PapelizProviderCheckMessage({ providerCheckState }: { providerCheckState: Exclude<PapelizProviderCheckState, { providerCheckKind: 'idle' }> }) {
  return (
    <p
      role={providerCheckState.providerCheckKind === 'failed' ? 'alert' : 'status'}
      className={joinPapelizClassNames(
        'mt-2 flex items-start gap-2 rounded-2xl px-4 py-2.5 text-[13px]',
        providerCheckState.providerCheckKind === 'failed' && 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink',
        providerCheckState.providerCheckKind === 'passed' && 'bg-papeliz-diff-added text-papeliz-diff-added-ink',
        (providerCheckState.providerCheckKind === 'running' || providerCheckState.providerCheckKind === 'waiting') && 'bg-papeliz-surface-gray text-papeliz-ink-muted',
      )}
    >
      {providerCheckState.providerCheckKind === 'running' && <LoaderCircle className="mt-0.5 size-4 flex-none animate-spin" aria-hidden="true" />}
      {providerCheckState.providerCheckKind === 'passed' && <CircleCheck className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      {providerCheckState.providerCheckKind === 'failed' && <CircleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      <span>{providerCheckState.providerCheckKind === 'running' ? providerCheckState.providerCheckLabel : providerCheckState.providerCheckMessage}</span>
    </p>
  )
}

export function describePapelizProviderHost(providerBaseUrl: string): string {
  try {
    return new URL(providerBaseUrl).host
  } catch {
    return 'the address above'
  }
}

// One look for every field: a full-width 40 px pill; the label above it (with its actions, such as
// Get a key or Test Connection, on the label's row) and its help line below, on the same left edge.
const papelizProviderFieldClassName = 'h-10 w-full rounded-full border border-papeliz-line-strong bg-papeliz-surface px-4 text-papeliz-ink'
const papelizProviderFieldLabelRowClassName = 'flex min-h-5 items-center justify-between gap-3'
const papelizProviderFieldLabelClassName = 'block text-sm font-medium'
const papelizProviderFieldHelpClassName = 'mt-1.5 text-[12.5px] leading-snug text-papeliz-ink-muted'
const papelizProviderFieldActionClassName =
  'inline-flex flex-none items-center gap-1 text-[13px] font-medium text-papeliz-blue hover:underline disabled:pointer-events-none disabled:text-papeliz-ink-subtle'
const papelizProviderSectionTitleClassName = 'mt-5 flex min-h-5 items-center justify-between gap-3 text-sm font-semibold'

// More models than this, and the models get a search box.
const papelizProviderModelSearchShownFromCount = 8

// Add Provider's groups, by where each provider runs. The hosted ones come first with no heading
// (Adam, 2026-11-03: "remove that Hosted Line and the Local change it to Local").
const papelizProviderPresetPlaceHeadings: Record<PapelizAssistantProviderPreset['providerPresetPlace'], string | null> = {
  hosted: null,
  'this-computer': 'Local',
  'any-address': 'Any Other',
}

// The modal's frame: the browser's own <dialog> over the Settings panel. Esc and the close button
// leave without saving, and only the modal closes: the panel stays open under it. A press outside
// does not close it, so a key being typed is not lost.
function PapelizAssistantProviderDialogFrame({
  providerDialogTitleId,
  onProviderDialogClose,
  children,
}: {
  providerDialogTitleId: string
  onProviderDialogClose: () => void
  children: ReactNode
}) {
  const providerDialogRef = useRef<HTMLDialogElement>(null)

  // Shown as a modal; focus goes back to what opened it, unless something else took it meanwhile.
  useEffect(() => {
    const providerDialogElement = providerDialogRef.current
    if (providerDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    providerDialogElement.showModal()
    return () => {
      providerDialogElement.close()
      if (focusedBeforeDialog?.isConnected && (document.activeElement === null || document.activeElement === document.body)) focusedBeforeDialog.focus()
    }
  }, [])

  return (
    <dialog
      ref={providerDialogRef}
      aria-labelledby={providerDialogTitleId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onProviderDialogClose()
      }}
      onKeyDown={(keyboardEvent) => {
        // Handled here, before the panel's own Esc, which then leaves the panel open. A list or a
        // question open inside the modal closes itself first and stops the key.
        if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return
        keyboardEvent.preventDefault()
        onProviderDialogClose()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(500px,calc(100vw-32px))] rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="flex max-h-[calc(100dvh-34px)] flex-col">{children}</div>
    </dialog>
  )
}

// The modal's sides: 24 px, or 18 px on a phone, the same for its header, body and footer.
const papelizProviderDialogSidesClassName = 'px-[18px] sm:px-6'

function PapelizAssistantProviderDialogHeader({
  providerDialogTitleId,
  providerDialogTitle,
  providerDialogSubtitle,
  onProviderDialogClose,
}: {
  providerDialogTitleId: string
  providerDialogTitle: string
  providerDialogSubtitle: string | null
  onProviderDialogClose: () => void
}) {
  return (
    <div className={`flex flex-none items-start gap-3 pt-5 pb-2 ${papelizProviderDialogSidesClassName}`}>
      <div className="min-w-0 flex-1">
        <h2 id={providerDialogTitleId} className="text-lg font-semibold">
          {providerDialogTitle}
        </h2>
        {providerDialogSubtitle !== null && <p className="mt-0.5 text-[13px] leading-snug text-papeliz-ink-muted">{providerDialogSubtitle}</p>}
      </div>
      <PapelizIconButton iconButtonLabel="Close" iconButtonSize="small" className="-mr-2" onClick={onProviderDialogClose}>
        <X className="size-4" aria-hidden="true" />
      </PapelizIconButton>
    </div>
  )
}

// A key's name on a hint, such as Enter beside the blue row.
const papelizProviderKeyHintClassName = 'rounded-md border border-papeliz-line-strong bg-papeliz-surface px-1.5 text-[11px] leading-[18px] font-medium text-papeliz-ink-muted'
const papelizProviderPresetPlaceOrder = ['hosted', 'this-computer', 'any-address'] as const

// Add Provider, step 1: a search box with every offered provider listed right under it, the hosted
// ones first, then Local and Any Other (Adam, 2026-11-03, "1D · Search list, like OpenCode"). The
// cursor starts in the box and typing narrows the list; Up and Down move the blue row, Enter picks it,
// and a click picks too. One already saved shows as Saved and can't be picked again.
function PapelizAssistantProviderPresetChoice({
  providerDialogTitleId,
  onProviderPresetChoose,
  onProviderDialogClose,
}: {
  providerDialogTitleId: string
  onProviderPresetChoose: (papelizAssistantProviderId: string) => void
  onProviderDialogClose: () => void
}) {
  const providerPresetListIdPrefix = useId()
  const providerPresetSearchFieldRef = useRef<HTMLInputElement>(null)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const [providerPresetSearchText, setProviderPresetSearchText] = useState('')
  // The row moved to with the keys or the pointer; null means the first one that can be picked.
  const [highlightedProviderPresetId, setHighlightedProviderPresetId] = useState<string | null>(null)
  const trimmedProviderPresetSearchText = providerPresetSearchText.trim().toLowerCase()
  const shownProviderPresets = papelizProviderPresetPlaceOrder.flatMap((providerPresetPlace) =>
    listPapelizOfferedAssistantProviderPresets('').filter(
      (offeredProviderPreset) =>
        offeredProviderPreset.providerPresetPlace === providerPresetPlace &&
        `${offeredProviderPreset.providerPresetDisplayName} ${offeredProviderPreset.providerPresetDescription} ${offeredProviderPreset.isProviderPresetRecommended === true ? 'recommended' : ''}`
          .toLowerCase()
          .includes(trimmedProviderPresetSearchText),
    ),
  )
  const pickableProviderPresets = shownProviderPresets.filter((shownProviderPreset) => providerSettingsByProviderId[shownProviderPreset.papelizAssistantProviderId] === undefined)
  const highlightedProviderPreset =
    pickableProviderPresets.find((pickableProviderPreset) => pickableProviderPreset.papelizAssistantProviderId === highlightedProviderPresetId) ?? pickableProviderPresets[0]
  const describeProviderPresetOptionId = (papelizAssistantProviderId: string) => `${providerPresetListIdPrefix}-option-${papelizAssistantProviderId}`

  // The cursor goes to the search, and again when Back returns here from step 2. Queued, so it runs
  // after the frame's own effect has shown the modal, which focuses the modal's first button.
  useEffect(() => {
    queueMicrotask(() => providerPresetSearchFieldRef.current?.focus())
  }, [])

  // Up and Down go round the rows that can be picked, keeping the blue one in view.
  const moveProviderPresetHighlight = (highlightStep: 1 | -1) => {
    if (highlightedProviderPreset === undefined) return
    const highlightedPickableIndex = pickableProviderPresets.indexOf(highlightedProviderPreset)
    const nextProviderPreset = pickableProviderPresets[(highlightedPickableIndex + highlightStep + pickableProviderPresets.length) % pickableProviderPresets.length]
    if (nextProviderPreset === undefined) return
    setHighlightedProviderPresetId(nextProviderPreset.papelizAssistantProviderId)
    document.getElementById(describeProviderPresetOptionId(nextProviderPreset.papelizAssistantProviderId))?.scrollIntoView({ block: 'nearest' })
  }

  const renderProviderPresetOption = (shownProviderPreset: PapelizAssistantProviderPreset) => {
    const isProviderPresetSaved = providerSettingsByProviderId[shownProviderPreset.papelizAssistantProviderId] !== undefined
    const isProviderPresetHighlighted = shownProviderPreset === highlightedProviderPreset
    return (
      <div
        key={shownProviderPreset.papelizAssistantProviderId}
        id={describeProviderPresetOptionId(shownProviderPreset.papelizAssistantProviderId)}
        role="option"
        aria-selected={isProviderPresetHighlighted}
        aria-disabled={isProviderPresetSaved || undefined}
        // Keeps the cursor in the search, so typing can go on after a pointer moved over the list.
        onMouseDown={(mouseDownEvent) => mouseDownEvent.preventDefault()}
        onMouseMove={() => {
          if (!isProviderPresetSaved) setHighlightedProviderPresetId(shownProviderPreset.papelizAssistantProviderId)
        }}
        onClick={() => {
          if (!isProviderPresetSaved) onProviderPresetChoose(shownProviderPreset.papelizAssistantProviderId)
        }}
        className={joinPapelizClassNames(
          'flex h-[38px] items-center gap-2.5 rounded-full px-3 text-sm font-medium',
          isProviderPresetSaved ? 'text-papeliz-ink-subtle' : 'cursor-pointer',
          isProviderPresetHighlighted && 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink',
        )}
      >
        <span className="flex-none">{shownProviderPreset.providerPresetDisplayName}</span>
        {shownProviderPreset.isProviderPresetRecommended === true && (
          <span className="flex-none rounded-full bg-papeliz-gradient-start px-2 py-px text-[11px] font-semibold text-white">Recommended</span>
        )}
        {/* Custom's name alone says nothing, so it keeps a short line. */}
        {shownProviderPreset.papelizAssistantProviderId === papelizCustomAssistantProviderId && (
          <span className={joinPapelizClassNames('min-w-0 truncate text-[12.5px] font-normal', isProviderPresetHighlighted ? 'text-papeliz-chosen-row-ink' : 'text-papeliz-ink-muted')}>
            Any OpenAI-compatible API
          </span>
        )}
        <span className="flex-1" />
        {isProviderPresetSaved && <span className="flex-none rounded-full bg-papeliz-surface-gray px-2 py-px text-[11.5px] font-normal text-papeliz-ink-muted">Saved</span>}
        {isProviderPresetHighlighted && (
          <kbd aria-hidden="true" className={`hidden flex-none sm:inline ${papelizProviderKeyHintClassName}`}>
            Enter
          </kbd>
        )}
      </div>
    )
  }

  return (
    <>
      <PapelizAssistantProviderDialogHeader
        providerDialogTitleId={providerDialogTitleId}
        providerDialogTitle="Add Provider"
        providerDialogSubtitle={null}
        onProviderDialogClose={onProviderDialogClose}
      />
      {/* The search stays put while the list under it scrolls. */}
      <div className={`flex-none pt-2 ${papelizProviderDialogSidesClassName}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-papeliz-ink-subtle" aria-hidden="true" />
          <input
            ref={providerPresetSearchFieldRef}
            type="text"
            role="combobox"
            aria-label="Search Providers"
            aria-expanded="true"
            aria-controls={`${providerPresetListIdPrefix}-list`}
            aria-autocomplete="list"
            aria-activedescendant={highlightedProviderPreset === undefined ? undefined : describeProviderPresetOptionId(highlightedProviderPreset.papelizAssistantProviderId)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search providers"
            value={providerPresetSearchText}
            onChange={(changeEvent) => {
              setProviderPresetSearchText(changeEvent.target.value)
              setHighlightedProviderPresetId(null)
            }}
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'ArrowUp') {
                keyboardEvent.preventDefault()
                moveProviderPresetHighlight(keyboardEvent.key === 'ArrowDown' ? 1 : -1)
              } else if (keyboardEvent.key === 'Enter') {
                keyboardEvent.preventDefault()
                if (highlightedProviderPreset !== undefined) onProviderPresetChoose(highlightedProviderPreset.papelizAssistantProviderId)
              }
            }}
            className={`${papelizProviderFieldClassName} pl-10 text-sm placeholder:text-papeliz-ink-subtle`}
          />
        </div>
      </div>
      {/* As tall as the whole list, so the modal holds still while typing narrows it; a short window
          shrinks it, and it scrolls. */}
      <div className={`h-[504px] min-h-0 flex-[0_1_auto] overflow-y-auto pt-1.5 pb-4 ${papelizProviderDialogSidesClassName}`}>
        <div id={`${providerPresetListIdPrefix}-list`} role="listbox" aria-label="Providers">
          {papelizProviderPresetPlaceOrder.map((providerPresetPlace) => {
            const placeProviderPresets = shownProviderPresets.filter((shownProviderPreset) => shownProviderPreset.providerPresetPlace === providerPresetPlace)
            if (placeProviderPresets.length === 0) return null
            const providerPresetPlaceHeading = papelizProviderPresetPlaceHeadings[providerPresetPlace]
            if (providerPresetPlaceHeading === null) return <Fragment key={providerPresetPlace}>{placeProviderPresets.map(renderProviderPresetOption)}</Fragment>
            const providerPresetPlaceHeadingId = `${providerPresetListIdPrefix}-group-${providerPresetPlace}`
            return (
              <div key={providerPresetPlace} role="group" aria-labelledby={providerPresetPlaceHeadingId}>
                <div id={providerPresetPlaceHeadingId} role="presentation" className="mt-3 mb-1 px-3 text-xs font-semibold text-papeliz-ink-subtle">
                  {providerPresetPlaceHeading}
                </div>
                {placeProviderPresets.map(renderProviderPresetOption)}
              </div>
            )
          })}
        </div>
        {shownProviderPresets.length === 0 && (
          <p role="status" className={`px-3 ${papelizProviderFieldHelpClassName}`}>
            No provider matches the search.
          </p>
        )}
      </div>
      {/* The keys, for a keyboard; a phone has none to show. */}
      <div aria-hidden="true" className={`hidden flex-none items-center gap-4 border-t border-papeliz-line py-2.5 text-xs text-papeliz-ink-subtle sm:flex ${papelizProviderDialogSidesClassName}`}>
        <span className="flex items-center gap-1">
          <kbd className={papelizProviderKeyHintClassName}>↑</kbd>
          <kbd className={papelizProviderKeyHintClassName}>↓</kbd> Move
        </span>
        <span className="flex items-center gap-1">
          <kbd className={papelizProviderKeyHintClassName}>Enter</kbd> Pick
        </span>
        <span className="flex items-center gap-1">
          <kbd className={papelizProviderKeyHintClassName}>Esc</kbd> Close
        </span>
      </div>
    </>
  )
}

// A typed Advanced number: empty is the provider's default (undefined), anything else must read.
function readTypedAdvancedNumber(typedNumberText: string, readTypedNumber: (typedNumber: unknown) => number | undefined): { isTypedNumberValid: boolean; typedNumber: number | undefined } {
  const trimmedTypedNumberText = typedNumberText.trim()
  if (trimmedTypedNumberText.length === 0) return { isTypedNumberValid: true, typedNumber: undefined }
  const typedNumber = readTypedNumber(Number(trimmedTypedNumberText))
  return { isTypedNumberValid: typedNumber !== undefined, typedNumber }
}

// Add Provider's step 2, or a saved provider's gear: one page in sections. Key: the API key (and
// Custom's base URL), Get a key and Test Connection. Models: load the provider's models and switch
// on the ones the assistant's model chip offers, each with its price for Usage. Advanced, folded:
// the base URL of a preset, the context window, the longest answer and the temperature. A provider is
// added, or saved after its key or address changed, only once Test Connection passes for them.
// Switching models, prices or the other Advanced settings needs no new test.
function PapelizAssistantProviderSettingsForm({
  papelizAssistantProviderId,
  providerEditorKind,
  providerDialogTitleId,
  onProviderEditorBack,
  onProviderDialogClose,
}: {
  papelizAssistantProviderId: string
  providerEditorKind: 'add' | 'edit'
  providerDialogTitleId: string
  onProviderEditorBack: () => void
  onProviderDialogClose: () => void
}) {
  const providerFieldIdPrefix = useId()
  const savedProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId[papelizAssistantProviderId])
  const saveAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.saveAssistantProviderSettings)
  const forgetAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.forgetAssistantProviderSettings)
  const providerPreset = findPapelizAssistantProviderPreset(papelizAssistantProviderId)
  const isCustomProvider = papelizAssistantProviderId === papelizCustomAssistantProviderId

  const [editedProviderSettings, setEditedProviderSettings] = useState<PapelizAssistantProviderSettingsRecord>(() =>
    savedProviderSettings === undefined
      ? createDefaultPapelizAssistantProviderSettings(papelizAssistantProviderId)
      : { ...savedProviderSettings, enabledProviderModelNames: listPapelizEnabledProviderModelNames(savedProviderSettings) },
  )
  const [isApiKeyShown, setIsApiKeyShown] = useState(false)
  // Null until Load Models (or a test) has answered for the current base URL and key.
  const [loadedProviderModelNames, setLoadedProviderModelNames] = useState<string[] | null>(null)
  const [providerCheckState, setProviderCheckState] = useState<PapelizProviderCheckState>({ providerCheckKind: 'idle' })
  const [isConnectionTestPassed, setIsConnectionTestPassed] = useState(false)
  const [providerModelSearchText, setProviderModelSearchText] = useState('')
  const [typedCustomProviderModelName, setTypedCustomProviderModelName] = useState('')
  const [openPriceProviderModelName, setOpenPriceProviderModelName] = useState<string | null>(null)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [typedContextWindowText, setTypedContextWindowText] = useState(() => String(savedProviderSettings?.providerContextWindowTokenCount ?? ''))
  const [typedMaximumOutputText, setTypedMaximumOutputText] = useState(() => String(savedProviderSettings?.providerMaximumOutputTokenCount ?? ''))
  const [typedTemperatureText, setTypedTemperatureText] = useState(() => String(savedProviderSettings?.providerTemperature ?? ''))
  const [isRemovalQuestionOpen, setIsRemovalQuestionOpen] = useState(false)
  const userModelPrices = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.userModelPrices)
  const setUserModelPrice = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.setUserModelPrice)
  // Each model's price as typed, per model name; empty boxes mean the listed price.
  const [typedModelPricesByModelName, setTypedModelPricesByModelName] = useState<Record<string, { typedInputPriceText: string; typedOutputPriceText: string }>>({})

  const enabledProviderModelNames = listPapelizEnabledProviderModelNames(editedProviderSettings)
  const isProviderApiKeyMissing = providerPreset.isProviderApiKeyRequired && editedProviderSettings.providerApiKey.trim().length === 0
  const isProviderBaseUrlMissing = editedProviderSettings.providerBaseUrl.trim().length === 0
  // A saved provider needs a new test only when what the test checks, its address or key, changed.
  const isKeyOrAddressChanged =
    savedProviderSettings === undefined ||
    savedProviderSettings.providerBaseUrl !== editedProviderSettings.providerBaseUrl.trim() ||
    savedProviderSettings.providerApiKey !== editedProviderSettings.providerApiKey.trim()

  const editProviderSetting = (providerSettingChanges: Partial<PapelizAssistantProviderSettingsRecord>) => {
    setEditedProviderSettings((currentProviderSettings) => ({ ...currentProviderSettings, ...providerSettingChanges }))
    // Another address or key may serve other models, and needs its own test.
    if (providerSettingChanges.providerBaseUrl !== undefined || providerSettingChanges.providerApiKey !== undefined) {
      setLoadedProviderModelNames(null)
      setIsConnectionTestPassed(false)
      setProviderCheckState({ providerCheckKind: 'idle' })
    }
  }

  // A model switched on joins the end of the provider's list; switched off, it leaves it.
  const switchProviderModel = (providerModelName: string, isProviderModelEnabled: boolean) =>
    setEditedProviderSettings((currentProviderSettings) => {
      const currentEnabledModelNames = listPapelizEnabledProviderModelNames(currentProviderSettings).filter(
        (enabledProviderModelName) => enabledProviderModelName !== providerModelName,
      )
      return { ...currentProviderSettings, enabledProviderModelNames: isProviderModelEnabled ? [...currentEnabledModelNames, providerModelName] : currentEnabledModelNames }
    })

  const runProviderCheck = async (providerCheckSubject: PapelizProviderCheckSubject, providerCheckLabel: string, providerCheck: () => Promise<string>) => {
    setProviderCheckState({ providerCheckKind: 'running', providerCheckSubject, providerCheckLabel })
    try {
      setProviderCheckState({ providerCheckKind: 'passed', providerCheckSubject, providerCheckMessage: await providerCheck() })
    } catch (providerCheckError) {
      setProviderCheckState({
        providerCheckKind: providerCheckError instanceof PapelizProviderCheckWaitingError ? 'waiting' : 'failed',
        providerCheckSubject,
        providerCheckMessage: providerCheckError instanceof Error ? providerCheckError.message : 'The check failed.',
      })
    }
  }

  // The provider's models: its own list, or, when it lists none from a browser page, the models its
  // preset names. Only Custom also takes a typed name.
  const fetchProviderModelNames = async (): Promise<{ providerModelNames: string[]; isPresetModelList: boolean }> => {
    try {
      const providerModelNames = await listPapelizProviderModelNames(buildPapelizAssistantProviderConnection(editedProviderSettings, ''))
      if (providerModelNames.length > 0 || providerPreset.suggestedProviderModelNames.length === 0) return { providerModelNames, isPresetModelList: false }
    } catch (modelListError) {
      if (providerPreset.suggestedProviderModelNames.length === 0) throw modelListError
    }
    return { providerModelNames: [...providerPreset.suggestedProviderModelNames], isPresetModelList: true }
  }

  const loadProviderModelNames = () =>
    void runProviderCheck('model-list', 'Loading models…', async () => {
      const { providerModelNames, isPresetModelList } = await fetchProviderModelNames()
      setLoadedProviderModelNames(providerModelNames)
      if (providerModelNames.length === 0) {
        throw new Error(isCustomProvider ? 'The server listed no models. Type the model name instead.' : 'The provider listed no models.')
      }
      if (isPresetModelList) return `${providerPreset.providerPresetDisplayName} didn’t list its models here, so these are the ones Papeliz knows. Switch on the ones you want.`
      return `${providerModelNames.length} ${providerModelNames.length === 1 ? 'model' : 'models'} loaded. Switch on the ones you want.`
    })

  // One tiny request to the first model switched on. With none on yet, the models load first and the
  // preset's recommended one is switched on; without one, the person picks.
  const testProviderConnection = () =>
    void runProviderCheck('connection-test', 'Testing the connection…', async () => {
      let testProviderModelName = enabledProviderModelNames[0]
      if (testProviderModelName === undefined) {
        const { providerModelNames } = await fetchProviderModelNames()
        setLoadedProviderModelNames(providerModelNames)
        testProviderModelName =
          providerPreset.suggestedProviderModelNames.find((suggestedModelName) => providerModelNames.includes(suggestedModelName)) ??
          (providerModelNames.length === 1 ? providerModelNames[0] : undefined)
        if (testProviderModelName === undefined) {
          throw new PapelizProviderCheckWaitingError(
            providerModelNames.length === 0
              ? 'Add a model under Models, then test again.'
              : `${providerModelNames.length} models found. Switch on the ones you want under Models, then test again.`,
          )
        }
        switchProviderModel(testProviderModelName, true)
      }
      const providerReply = await testPapelizProviderConnection(buildPapelizAssistantProviderConnection(editedProviderSettings, testProviderModelName))
      setIsConnectionTestPassed(true)
      return `Connected. ${testProviderModelName} answered: “${providerReply.slice(0, 60) || '(empty)'}”`
    })

  // The models shown: those switched on first, then the rest the provider listed.
  const listedProviderModelNames = [...new Set([...enabledProviderModelNames, ...(loadedProviderModelNames ?? [])])]
  const trimmedProviderModelSearchText = providerModelSearchText.trim().toLowerCase()
  const shownProviderModelNames =
    trimmedProviderModelSearchText.length === 0
      ? listedProviderModelNames
      : listedProviderModelNames.filter((listedProviderModelName) => listedProviderModelName.toLowerCase().includes(trimmedProviderModelSearchText))
  const addTypedCustomProviderModel = () => {
    const trimmedTypedModelName = typedCustomProviderModelName.trim()
    if (trimmedTypedModelName.length === 0) return
    switchProviderModel(trimmedTypedModelName, true)
    setTypedCustomProviderModelName('')
  }

  // Prices, per model, for Usage's estimate.
  const readTypedPrice = (typedPriceText: string) => {
    const typedPrice = Number(typedPriceText.trim().replace(/^\$/, ''))
    return typedPriceText.trim().length > 0 && Number.isFinite(typedPrice) && typedPrice >= 0 ? typedPrice : null
  }
  const readTypedModelPrice = (providerModelName: string) => {
    const savedUserModelPrice = userModelPrices[providerModelName.toLowerCase()]
    return (
      typedModelPricesByModelName[providerModelName] ?? {
        typedInputPriceText: savedUserModelPrice === undefined ? '' : String(savedUserModelPrice.inputUsdPerMillionTokens),
        typedOutputPriceText: savedUserModelPrice === undefined ? '' : String(savedUserModelPrice.outputUsdPerMillionTokens),
      }
    )
  }
  const isTypedPriceHalfFilled = (typedPrice: { typedInputPriceText: string; typedOutputPriceText: string }) =>
    (readTypedPrice(typedPrice.typedInputPriceText) === null) !== (readTypedPrice(typedPrice.typedOutputPriceText) === null) ||
    (typedPrice.typedInputPriceText.trim().length > 0 && readTypedPrice(typedPrice.typedInputPriceText) === null) ||
    (typedPrice.typedOutputPriceText.trim().length > 0 && readTypedPrice(typedPrice.typedOutputPriceText) === null)
  const isAnyTypedModelPriceHalfFilled = Object.values(typedModelPricesByModelName).some(isTypedPriceHalfFilled)
  // Both boxes filled: that price is saved for the model. Both empty: the listed price applies again.
  const saveTypedModelPrices = () => {
    for (const [typedModelName, typedPrice] of Object.entries(typedModelPricesByModelName)) {
      const typedInputPrice = readTypedPrice(typedPrice.typedInputPriceText)
      const typedOutputPrice = readTypedPrice(typedPrice.typedOutputPriceText)
      if (typedInputPrice !== null && typedOutputPrice !== null) {
        setUserModelPrice(typedModelName, { inputUsdPerMillionTokens: typedInputPrice, outputUsdPerMillionTokens: typedOutputPrice })
      } else if (typedPrice.typedInputPriceText.trim().length === 0 && typedPrice.typedOutputPriceText.trim().length === 0) {
        setUserModelPrice(typedModelName, null)
      }
    }
  }
  const isRequestCostReportedByProvider = papelizRequestCostReportingAssistantProviderIds.includes(papelizAssistantProviderId)

  const typedContextWindow = readTypedAdvancedNumber(typedContextWindowText, readPapelizProviderTokenCount)
  const typedMaximumOutput = readTypedAdvancedNumber(typedMaximumOutputText, readPapelizProviderTokenCount)
  const typedTemperature = readTypedAdvancedNumber(typedTemperatureText, readPapelizProviderTemperature)
  const isAdvancedTypingValid = typedContextWindow.isTypedNumberValid && typedMaximumOutput.isTypedNumberValid && typedTemperature.isTypedNumberValid

  // Why Save or Add Provider is off, or null when it can go.
  const providerSaveProblem = isProviderBaseUrlMissing
    ? 'Type the base URL first'
    : isProviderApiKeyMissing
      ? 'Paste the API key first'
      : isKeyOrAddressChanged && !isConnectionTestPassed
        ? 'Test the connection first'
        : providerEditorKind === 'add' && enabledProviderModelNames.length === 0
          ? 'Switch on a model first'
          : isAnyTypedModelPriceHalfFilled
            ? 'Fill in both prices, or leave both empty'
            : !isAdvancedTypingValid
              ? 'Fix the Advanced settings first'
              : null

  const saveProviderSettings = () => {
    if (providerSaveProblem !== null) return
    saveTypedModelPrices()
    const savedAdvancedSettings: Partial<PapelizAssistantProviderSettingsRecord> = {}
    if (typedContextWindow.typedNumber !== undefined) savedAdvancedSettings.providerContextWindowTokenCount = typedContextWindow.typedNumber
    if (typedMaximumOutput.typedNumber !== undefined) savedAdvancedSettings.providerMaximumOutputTokenCount = typedMaximumOutput.typedNumber
    if (typedTemperature.typedNumber !== undefined) savedAdvancedSettings.providerTemperature = typedTemperature.typedNumber
    void saveAssistantProviderSettings([
      {
        papelizAssistantProviderId,
        providerBaseUrl: editedProviderSettings.providerBaseUrl,
        providerApiKey: editedProviderSettings.providerApiKey,
        enabledProviderModelNames,
        ...savedAdvancedSettings,
      },
    ]).then(onProviderDialogClose)
  }

  const resetProviderToPreset = () => {
    if (!isCustomProvider) editProviderSetting({ providerBaseUrl: providerPreset.providerBaseUrl })
    setTypedContextWindowText('')
    setTypedMaximumOutputText('')
    setTypedTemperatureText('')
  }

  const providerHost = describePapelizProviderHost(editedProviderSettings.providerBaseUrl)
  const renderProviderBaseUrlField = (providerBaseUrlFieldHelp: string | null) => (
    <>
      <div className={papelizProviderFieldLabelRowClassName}>
        <label className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-base-url`}>
          Base URL
        </label>
        {!isCustomProvider && editedProviderSettings.providerBaseUrl !== providerPreset.providerBaseUrl && (
          <button type="button" className={papelizProviderFieldActionClassName} onClick={() => editProviderSetting({ providerBaseUrl: providerPreset.providerBaseUrl })}>
            Use {describePapelizProviderHost(providerPreset.providerBaseUrl)}
          </button>
        )}
      </div>
      <input
        id={`${providerFieldIdPrefix}-base-url`}
        type="url"
        placeholder="https://…/v1"
        value={editedProviderSettings.providerBaseUrl}
        onChange={(changeEvent) => editProviderSetting({ providerBaseUrl: changeEvent.target.value })}
        className={`mt-1.5 ${papelizProviderFieldClassName} font-mono text-[13px]`}
      />
      {providerBaseUrlFieldHelp !== null && <p className={papelizProviderFieldHelpClassName}>{providerBaseUrlFieldHelp}</p>}
    </>
  )

  return (
    <>
      <PapelizAssistantProviderDialogHeader
        providerDialogTitleId={providerDialogTitleId}
        providerDialogTitle={providerEditorKind === 'add' ? `Add ${providerPreset.providerPresetDisplayName}` : providerPreset.providerPresetDisplayName}
        providerDialogSubtitle={providerPreset.providerPresetDescription}
        onProviderDialogClose={onProviderDialogClose}
      />
      <div className={`min-h-0 flex-1 overflow-y-auto pt-2 pb-5 ${papelizProviderDialogSidesClassName}`}>
        {isCustomProvider && <div className="mb-3.5">{renderProviderBaseUrlField(null)}</div>}

        {/* Key: Get a key at the label row's end; Test Connection, the key's check, right of the field
            (Adam, 2026-11-03, "2A · Test beside the key"). */}
        <div className={papelizProviderFieldLabelRowClassName}>
          <label className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-api-key`}>
            API Key {!providerPreset.isProviderApiKeyRequired && <span className="font-normal text-papeliz-ink-subtle">(not needed for most local servers)</span>}
          </label>
          {providerPreset.providerApiKeyHelpUrl !== null && (
            <a href={providerPreset.providerApiKeyHelpUrl} target="_blank" rel="noopener noreferrer" className={papelizProviderFieldActionClassName}>
              Get a key <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {/* The field takes the row; on a phone, where both don't fit, Test Connection drops under it at
            full width. The show/hide eye sits inside the field. */}
        <div className="mt-1.5 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-[999_1_180px]">
            <input
              id={`${providerFieldIdPrefix}-api-key`}
              type={isApiKeyShown ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={editedProviderSettings.providerApiKey}
              onChange={(changeEvent) => editProviderSetting({ providerApiKey: changeEvent.target.value })}
              className={`${papelizProviderFieldClassName} pr-12 font-mono text-[13px]`}
            />
            <PapelizIconButton
              iconButtonLabel={isApiKeyShown ? 'Hide the Key' : 'Show the Key'}
              iconButtonSize="small"
              className="absolute top-1.5 right-1.5"
              onClick={() => setIsApiKeyShown(!isApiKeyShown)}
            >
              {isApiKeyShown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </PapelizIconButton>
          </div>
          <PapelizPillButton
            pillButtonVariant="outline"
            className="h-10 flex-[1_0_auto]"
            disabled={providerCheckState.providerCheckKind === 'running' || isProviderApiKeyMissing || isProviderBaseUrlMissing}
            title={isProviderBaseUrlMissing ? 'Type the base URL first' : isProviderApiKeyMissing ? 'Paste the API key first' : 'Send one tiny request with this key'}
            onClick={testProviderConnection}
          >
            {providerCheckState.providerCheckKind === 'running' && providerCheckState.providerCheckSubject === 'connection-test' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="size-3.5" aria-hidden="true" />
            )}
            Test Connection
          </PapelizPillButton>
        </div>
        {providerCheckState.providerCheckKind !== 'idle' && providerCheckState.providerCheckSubject === 'connection-test' && (
          <PapelizProviderCheckMessage providerCheckState={providerCheckState} />
        )}
        <p role="note" aria-label="Where your key goes" className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-papeliz-ink-muted">
          <Lock className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
          <span>
            Kept only in this browser and sent only to <span className="font-mono text-papeliz-ink">{providerHost}</span>, with your messages and the notes the assistant
            reads.
          </span>
        </p>

        {/* Models: switched on, the model chip in the assistant offers them. */}
        <div className={papelizProviderSectionTitleClassName}>
          <p id={`${providerFieldIdPrefix}-models-label`}>
            Models
            {listedProviderModelNames.length > 0 && (
              <span className="ml-1.5 font-normal text-papeliz-ink-subtle tabular-nums">
                {enabledProviderModelNames.length} on{loadedProviderModelNames !== null && ` · ${loadedProviderModelNames.length} listed`}
              </span>
            )}
          </p>
          <PapelizPillButton
            pillButtonVariant="outline"
            pillButtonSize="small"
            disabled={providerCheckState.providerCheckKind === 'running' || isProviderApiKeyMissing || isProviderBaseUrlMissing}
            title={isProviderApiKeyMissing ? 'Paste the API key first' : 'Ask the provider which models it serves'}
            onClick={loadProviderModelNames}
          >
            <RefreshCw
              className={joinPapelizClassNames(
                'size-3.5',
                providerCheckState.providerCheckKind === 'running' && providerCheckState.providerCheckSubject === 'model-list' && 'animate-spin',
              )}
              aria-hidden="true"
            />
            {loadedProviderModelNames === null ? 'Load Models' : 'Load Again'}
          </PapelizPillButton>
        </div>
        {/* Until there are models to switch, one line says what to do. */}
        {listedProviderModelNames.length === 0 && (
          <p className={papelizProviderFieldHelpClassName}>
            {isCustomProvider
              ? 'Load the models this server lists, or type a model’s name, then switch on the ones the assistant offers.'
              : 'Load the models, then switch on the ones the assistant offers.'}
          </p>
        )}
        {providerCheckState.providerCheckKind !== 'idle' && providerCheckState.providerCheckSubject === 'model-list' && (
          <PapelizProviderCheckMessage providerCheckState={providerCheckState} />
        )}
        {isCustomProvider && (
          <div className="mt-2.5 flex gap-2">
            <label className="sr-only" htmlFor={`${providerFieldIdPrefix}-typed-model`}>
              Model Name
            </label>
            <input
              id={`${providerFieldIdPrefix}-typed-model`}
              placeholder="Model name"
              value={typedCustomProviderModelName}
              onChange={(changeEvent) => setTypedCustomProviderModelName(changeEvent.target.value)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key !== 'Enter') return
                keyboardEvent.preventDefault()
                addTypedCustomProviderModel()
              }}
              className={`${papelizProviderFieldClassName} min-w-0 flex-1 text-sm`}
            />
            <PapelizPillButton pillButtonVariant="line" className="flex-none" disabled={typedCustomProviderModelName.trim().length === 0} onClick={addTypedCustomProviderModel}>
              Add Model
            </PapelizPillButton>
          </div>
        )}
        {listedProviderModelNames.length > papelizProviderModelSearchShownFromCount && (
          <input
            type="search"
            aria-label="Search Models"
            placeholder="Search models"
            value={providerModelSearchText}
            onChange={(changeEvent) => setProviderModelSearchText(changeEvent.target.value)}
            className={`mt-2.5 ${papelizProviderFieldClassName} text-sm`}
          />
        )}
        {shownProviderModelNames.length > 0 && (
          <ul aria-labelledby={`${providerFieldIdPrefix}-models-label`} className="mt-2.5 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-papeliz-line p-1">
            {shownProviderModelNames.map((shownProviderModelName, shownProviderModelIndex) => {
              const isProviderModelEnabled = enabledProviderModelNames.includes(shownProviderModelName)
              const providerModelSwitchId = `${providerFieldIdPrefix}-model-switch-${shownProviderModelIndex}`
              const isPriceOpen = openPriceProviderModelName === shownProviderModelName
              const typedModelPrice = readTypedModelPrice(shownProviderModelName)
              const papelizModelPrice = findPapelizAssistantModelPrice(shownProviderModelName, {})
              return (
                <li key={shownProviderModelName} className="rounded-xl hover:bg-papeliz-hover">
                  <div className="flex min-h-9 items-center gap-2 px-3 py-1">
                    {/* The name labels the switch, so pressing it switches the model too. */}
                    <label htmlFor={providerModelSwitchId} className="min-w-0 flex-1 cursor-pointer font-mono text-[12.5px] break-all">
                      {shownProviderModelName}
                    </label>
                    <button
                      type="button"
                      aria-expanded={isPriceOpen}
                      aria-label={`Price of ${shownProviderModelName}`}
                      onClick={() => setOpenPriceProviderModelName(isPriceOpen ? null : shownProviderModelName)}
                      className="flex-none rounded-full px-2 py-0.5 text-[12px] font-medium text-papeliz-blue hover:bg-papeliz-blue-soft"
                    >
                      Price
                    </button>
                    <button
                      id={providerModelSwitchId}
                      type="button"
                      role="switch"
                      aria-checked={isProviderModelEnabled}
                      onClick={() => switchProviderModel(shownProviderModelName, !isProviderModelEnabled)}
                      className={joinPapelizClassNames(
                        'relative h-[18px] w-8 flex-none rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue',
                        isProviderModelEnabled ? 'bg-papeliz-blue' : 'bg-papeliz-line-strong',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={joinPapelizClassNames(
                          'absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform',
                          isProviderModelEnabled && 'translate-x-3.5',
                        )}
                      />
                    </button>
                  </div>
                  {isPriceOpen && (
                    <div className="px-3 pb-2.5">
                      <div className="flex gap-2">
                        {(
                          [
                            ['Input', 'typedInputPriceText', papelizModelPrice?.modelPrice.inputUsdPerMillionTokens],
                            ['Output', 'typedOutputPriceText', papelizModelPrice?.modelPrice.outputUsdPerMillionTokens],
                          ] as const
                        ).map(([priceBoxLabel, typedPriceField, listedPrice]) => (
                          <label key={typedPriceField} className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-medium">
                            <span>
                              {priceBoxLabel} <span className="font-normal text-papeliz-ink-muted">per 1M tokens</span>
                            </span>
                            {/* The dollar sign sits inside the field, so only the number is typed. */}
                            <span className="relative">
                              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-papeliz-ink-muted" aria-hidden="true">
                                $
                              </span>
                              <input
                                inputMode="decimal"
                                placeholder={listedPrice === undefined ? '0.00' : formatPapelizAssistantModelPricePerMillionTokens(listedPrice)}
                                value={typedModelPrice[typedPriceField]}
                                onChange={(changeEvent) =>
                                  setTypedModelPricesByModelName((currentTypedPrices) => ({
                                    ...currentTypedPrices,
                                    [shownProviderModelName]: { ...typedModelPrice, [typedPriceField]: changeEvent.target.value },
                                  }))
                                }
                                className="h-9 w-full rounded-full border border-papeliz-line-strong bg-papeliz-surface pr-3 pl-6 text-[13px] text-papeliz-ink tabular-nums"
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                      <p
                        role={isTypedPriceHalfFilled(typedModelPrice) ? 'alert' : undefined}
                        className={
                          isTypedPriceHalfFilled(typedModelPrice) ? 'mt-1.5 text-[12px] leading-snug text-papeliz-diff-removed-ink' : 'mt-1.5 text-[12px] leading-snug text-papeliz-ink-muted'
                        }
                      >
                        {isTypedPriceHalfFilled(typedModelPrice)
                          ? 'Fill in both prices, as numbers, or leave both empty.'
                          : papelizModelPrice !== null
                            ? `For Usage’s estimate. Empty boxes use the listed price, from the provider’s price page (checked ${papelizAssistantBuiltInModelPricesCheckedOnLabel}).`
                            : 'For Usage’s estimate. Papeliz has no listed price for this model; type the one from your provider’s price page.'}
                        {isRequestCostReportedByProvider && ` ${providerPreset.providerPresetDisplayName} reports what each request costs, and Usage uses that first.`}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {listedProviderModelNames.length > 0 && shownProviderModelNames.length === 0 && <p className={papelizProviderFieldHelpClassName}>No model matches the search.</p>}

        {/* Advanced, folded: what a preset fills in, and limits for its requests. */}
        <button
          type="button"
          aria-expanded={isAdvancedOpen}
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="mt-5 flex h-10 w-full items-center justify-between border-t border-papeliz-line text-left text-sm font-semibold"
        >
          Advanced
          <span className="flex items-center gap-1 text-[12.5px] font-normal text-papeliz-ink-subtle">
            {!isAdvancedOpen && (isCustomProvider ? 'Limits' : 'Base URL, limits')}
            {isAdvancedOpen ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
          </span>
        </button>
        {isAdvancedOpen && (
          <div className="pb-1">
            {!isCustomProvider && renderProviderBaseUrlField('Change it only if the provider moved its API. A new address needs a new test.')}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
              {(
                [
                  ['Context Window', 'tokens', typedContextWindowText, setTypedContextWindowText, 'Model’s own', typedContextWindow.isTypedNumberValid],
                  ['Max Output', 'tokens', typedMaximumOutputText, setTypedMaximumOutputText, 'Provider’s default', typedMaximumOutput.isTypedNumberValid],
                  ['Temperature', '0 to 2', typedTemperatureText, setTypedTemperatureText, 'Provider’s default', typedTemperature.isTypedNumberValid],
                ] as const
              ).map(([advancedFieldLabel, advancedFieldUnit, typedAdvancedText, setTypedAdvancedText, advancedFieldPlaceholder, isAdvancedFieldValid]) => (
                <label key={advancedFieldLabel} className="flex min-w-0 flex-col gap-1 text-[12.5px] font-medium">
                  <span>
                    {advancedFieldLabel} <span className="font-normal text-papeliz-ink-muted">{advancedFieldUnit}</span>
                  </span>
                  <input
                    inputMode="decimal"
                    aria-invalid={!isAdvancedFieldValid}
                    placeholder={advancedFieldPlaceholder}
                    value={typedAdvancedText}
                    onChange={(changeEvent) => setTypedAdvancedText(changeEvent.target.value)}
                    className={joinPapelizClassNames(
                      'h-9 w-full rounded-full border bg-papeliz-surface px-3.5 text-[13px] text-papeliz-ink tabular-nums',
                      isAdvancedFieldValid ? 'border-papeliz-line-strong' : 'border-papeliz-diff-removed-ink',
                    )}
                  />
                </label>
              ))}
            </div>
            <p
              role={isAdvancedTypingValid ? undefined : 'alert'}
              className={isAdvancedTypingValid ? papelizProviderFieldHelpClassName : 'mt-1.5 text-[12.5px] leading-snug text-papeliz-diff-removed-ink'}
            >
              {isAdvancedTypingValid
                ? 'Only for this provider. Empty boxes keep the provider’s own defaults.'
                : 'Use whole numbers for tokens, and a number from 0 to 2 for Temperature.'}
            </p>
            <button type="button" className={`mt-2 ${papelizProviderFieldActionClassName}`} onClick={resetProviderToPreset}>
              Reset to Preset
            </button>
          </div>
        )}
      </div>

      {/* The footer's buttons look like every other dialog's: outlined Back or Cancel, the blue action. */}
      <div className={`flex flex-none flex-wrap items-center gap-2 border-t border-papeliz-line py-3.5 ${papelizProviderDialogSidesClassName}`}>
        {providerEditorKind === 'edit' ? (
          <PapelizPillButton pillButtonVariant="gray" className="text-papeliz-diff-removed-ink" onClick={() => setIsRemovalQuestionOpen(true)}>
            Remove Provider
          </PapelizPillButton>
        ) : (
          <PapelizPillButton pillButtonVariant="dialog-cancel" className="min-w-28" onClick={onProviderEditorBack}>
            Back
          </PapelizPillButton>
        )}
        {providerEditorKind === 'edit' && (
          <PapelizPillButton pillButtonVariant="dialog-cancel" className="ml-auto min-w-28" onClick={onProviderDialogClose}>
            Cancel
          </PapelizPillButton>
        )}
        <PapelizPillButton
          pillButtonVariant="dialog-confirm"
          className={providerEditorKind === 'add' ? 'ml-auto min-w-28' : 'min-w-28'}
          disabled={providerSaveProblem !== null}
          title={providerSaveProblem ?? undefined}
          onClick={saveProviderSettings}
        >
          {providerEditorKind === 'add' ? 'Add Provider' : 'Save'}
        </PapelizPillButton>
      </div>

      {isRemovalQuestionOpen && (
        // Esc cancels only the question, and the modal under it stays open.
        <div
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key !== 'Escape') return
            keyboardEvent.preventDefault()
            setIsRemovalQuestionOpen(false)
          }}
        >
          <PapelizConfirmDialog
            confirmDialogTitle={`Remove ${providerPreset.providerPresetDisplayName}?`}
            confirmDialogBody={
              <p>Its API key and its models are erased from this browser, and the assistant stops offering them. Your chats, notes and Usage stay as they are.</p>
            }
            confirmButtonLabel="Remove Provider"
            isConfirmActionDangerous
            onCancel={() => setIsRemovalQuestionOpen(false)}
            onConfirm={() => {
              setIsRemovalQuestionOpen(false)
              void forgetAssistantProviderSettings(papelizAssistantProviderId)
              onProviderDialogClose()
            }}
          />
        </div>
      )}
    </>
  )
}

// Settings › AI Provider's modal: Add Provider (pick a provider, then its key, test and models), or
// one saved provider's settings, opened by its gear.
export function PapelizAssistantProviderEditorDialog({
  providerEditorRequest,
  onProviderEditorClose,
}: {
  providerEditorRequest: PapelizAssistantProviderEditorRequest
  onProviderEditorClose: () => void
}) {
  const providerDialogTitleId = useId()
  // Add Provider's pick from step 1; a gear's provider from the start.
  const [chosenProviderId, setChosenProviderId] = useState<string | null>(
    providerEditorRequest.providerEditorKind === 'edit' ? providerEditorRequest.papelizAssistantProviderId : null,
  )

  return (
    <PapelizAssistantProviderDialogFrame providerDialogTitleId={providerDialogTitleId} onProviderDialogClose={onProviderEditorClose}>
      {chosenProviderId === null ? (
        <PapelizAssistantProviderPresetChoice
          providerDialogTitleId={providerDialogTitleId}
          onProviderPresetChoose={setChosenProviderId}
          onProviderDialogClose={onProviderEditorClose}
        />
      ) : (
        <PapelizAssistantProviderSettingsForm
          key={chosenProviderId}
          papelizAssistantProviderId={chosenProviderId}
          providerEditorKind={providerEditorRequest.providerEditorKind}
          providerDialogTitleId={providerDialogTitleId}
          onProviderEditorBack={() => setChosenProviderId(null)}
          onProviderDialogClose={onProviderEditorClose}
        />
      )}
    </PapelizAssistantProviderDialogFrame>
  )
}
