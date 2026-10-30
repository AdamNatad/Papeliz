import { ChevronRight, CircleAlert, CircleCheck, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, PlugZap, RefreshCw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizListboxSelect, type PapelizListboxSelectOption } from '../ui/papeliz-listbox-select'
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
} from './papeliz-assistant-provider-presets'
import {
  createDefaultPapelizAssistantProviderSettings,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'
import { listPapelizProviderModelNames, testPapelizProviderConnection } from './papeliz-openai-compatible-client'

// Which check ran, so its answer shows under the field it belongs to: Test connection under the API
// key, Load models under the model.
type PapelizProviderCheckSubject = 'connection-test' | 'model-list'

type PapelizProviderCheckState =
  | { providerCheckKind: 'idle' }
  | { providerCheckKind: 'running'; providerCheckSubject: PapelizProviderCheckSubject; providerCheckLabel: string }
  | { providerCheckKind: 'passed'; providerCheckSubject: PapelizProviderCheckSubject; providerCheckMessage: string }
  | { providerCheckKind: 'failed'; providerCheckSubject: PapelizProviderCheckSubject; providerCheckMessage: string }

// A check's answer: a spinner while it runs, then green for passed or red for failed.
function PapelizProviderCheckMessage({ providerCheckState }: { providerCheckState: Exclude<PapelizProviderCheckState, { providerCheckKind: 'idle' }> }) {
  return (
    <p
      role={providerCheckState.providerCheckKind === 'failed' ? 'alert' : 'status'}
      className={`mt-2 flex items-start gap-2 rounded-2xl px-4 py-2.5 text-[13px] ${
        providerCheckState.providerCheckKind === 'failed'
          ? 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink'
          : providerCheckState.providerCheckKind === 'passed'
            ? 'bg-papeliz-diff-added text-papeliz-diff-added-ink'
            : 'bg-papeliz-surface-gray text-papeliz-ink-muted'
      }`}
    >
      {providerCheckState.providerCheckKind === 'running' && <LoaderCircle className="mt-0.5 size-4 flex-none animate-spin" aria-hidden="true" />}
      {providerCheckState.providerCheckKind === 'passed' && <CircleCheck className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      {providerCheckState.providerCheckKind === 'failed' && <CircleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />}
      <span>{providerCheckState.providerCheckKind === 'running' ? providerCheckState.providerCheckLabel : providerCheckState.providerCheckMessage}</span>
    </p>
  )
}

function describeProviderHost(providerBaseUrl: string): string {
  try {
    return new URL(providerBaseUrl).host
  } catch {
    return 'the address above'
  }
}

// One look for every field: a full-width 40 px pill; the label above it (with its one action, such
// as Get a key or Load models, at the right end of the label's row) and its help line below, all on
// the same left edge.
const papelizProviderFieldClassName = 'h-10 w-full rounded-full border border-papeliz-line-strong bg-papeliz-surface px-4 text-papeliz-ink'
const papelizProviderFieldLabelRowClassName = 'mt-4 flex min-h-5 items-center justify-between gap-3'
const papelizProviderFieldLabelClassName = 'block text-sm font-medium'
const papelizProviderFieldHelpClassName = 'mt-1.5 text-[12.5px] leading-snug text-papeliz-ink-muted'
const papelizProviderFieldActionClassName =
  'inline-flex flex-none items-center gap-1 text-[13px] font-medium text-papeliz-blue hover:underline disabled:pointer-events-none disabled:text-papeliz-ink-subtle'

interface PapelizAssistantProviderSettingsDialogProps {
  onProviderSettingsDialogClose: () => void
}

// Bring-your-own-key settings: pick a provider, paste the key, load and pick a model, test. A preset
// brings its own base URL, so the Base URL field shows only for Custom, or for a preset saved
// earlier with an address of its own (a local server on another port, say). For every preset except Custom
// the model must come from the provider's own list, so a mistyped model name cannot be saved;
// Custom also takes a typed name.
export function PapelizAssistantProviderSettingsDialog({ onProviderSettingsDialogClose }: PapelizAssistantProviderSettingsDialogProps) {
  const providerSettingsDialogRef = useRef<HTMLDialogElement>(null)
  const providerFieldIdPrefix = useId()
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const saveAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.saveAssistantProviderSettings)
  const forgetAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.forgetAssistantProviderSettings)

  const [editedProviderSettings, setEditedProviderSettings] = useState<PapelizAssistantProviderSettingsRecord>(
    () => providerSettingsByProviderId[activeAssistantProviderId] ?? createDefaultPapelizAssistantProviderSettings(activeAssistantProviderId),
  )
  const [isApiKeyShown, setIsApiKeyShown] = useState(false)
  // Null until Load models has answered for the current base URL and key.
  const [loadedProviderModelNames, setLoadedProviderModelNames] = useState<string[] | null>(null)
  const [providerCheckState, setProviderCheckState] = useState<PapelizProviderCheckState>({ providerCheckKind: 'idle' })
  const userModelPrices = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.userModelPrices)
  const setUserModelPrice = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.setUserModelPrice)
  // Model price: the chosen model's price as typed, per model name; empty boxes mean the listed price.
  const [typedModelPricesByModelName, setTypedModelPricesByModelName] = useState<Record<string, { typedInputPriceText: string; typedOutputPriceText: string }>>({})
  const providerPreset = findPapelizAssistantProviderPreset(editedProviderSettings.papelizAssistantProviderId)
  const savedProviderSettings = providerSettingsByProviderId[editedProviderSettings.papelizAssistantProviderId]
  const isSavedProvider = savedProviderSettings !== undefined
  const isModelListRequired = editedProviderSettings.papelizAssistantProviderId !== papelizCustomAssistantProviderId
  // A preset's base URL comes from its template (it is filled in when the provider is chosen and
  // saved as is); only Custom asks for one. An address that differs from the template stays in view,
  // so it can be seen and changed.
  const isProviderBaseUrlFieldShown =
    editedProviderSettings.papelizAssistantProviderId === papelizCustomAssistantProviderId ||
    editedProviderSettings.providerBaseUrl !== providerPreset.providerBaseUrl
  const isProviderApiKeyMissing = providerPreset.isProviderApiKeyRequired && editedProviderSettings.providerApiKey.trim().length === 0

  useEffect(() => {
    const providerSettingsDialogElement = providerSettingsDialogRef.current
    if (providerSettingsDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    providerSettingsDialogElement.showModal()
    return () => {
      providerSettingsDialogElement.close()
      if (focusedBeforeDialog?.isConnected) focusedBeforeDialog.focus()
    }
  }, [])

  const chooseProvider = (papelizAssistantProviderId: string) => {
    setEditedProviderSettings(providerSettingsByProviderId[papelizAssistantProviderId] ?? createDefaultPapelizAssistantProviderSettings(papelizAssistantProviderId))
    setLoadedProviderModelNames(null)
    setProviderCheckState({ providerCheckKind: 'idle' })
  }

  const editProviderSetting = (providerSettingChanges: Partial<PapelizAssistantProviderSettingsRecord>) => {
    setEditedProviderSettings((currentProviderSettings) => ({ ...currentProviderSettings, ...providerSettingChanges }))
    setProviderCheckState({ providerCheckKind: 'idle' })
    // Another address or key may serve other models.
    if (providerSettingChanges.providerBaseUrl !== undefined || providerSettingChanges.providerApiKey !== undefined) setLoadedProviderModelNames(null)
  }

  const runProviderCheck = async (providerCheckSubject: PapelizProviderCheckSubject, providerCheckLabel: string, providerCheck: () => Promise<string>) => {
    setProviderCheckState({ providerCheckKind: 'running', providerCheckSubject, providerCheckLabel })
    try {
      setProviderCheckState({ providerCheckKind: 'passed', providerCheckSubject, providerCheckMessage: await providerCheck() })
    } catch (providerCheckError) {
      setProviderCheckState({
        providerCheckKind: 'failed',
        providerCheckSubject,
        providerCheckMessage: providerCheckError instanceof Error ? providerCheckError.message : 'The check failed.',
      })
    }
  }

  const providerConnection = {
    providerBaseUrl: editedProviderSettings.providerBaseUrl,
    providerApiKey: editedProviderSettings.providerApiKey,
    providerModelName: editedProviderSettings.providerModelName,
  }
  const suggestedModelNames = [...new Set([...providerPreset.suggestedProviderModelNames, ...(loadedProviderModelNames ?? [])])]
  // The models that can be picked from the list: the loaded ones, plus the one saved earlier for
  // this provider, which stays usable without loading again.
  const savedProviderModelName = savedProviderSettings?.providerBaseUrl === editedProviderSettings.providerBaseUrl ? savedProviderSettings.providerModelName : ''
  const pickableModelNames = [...new Set([...(savedProviderModelName.length > 0 ? [savedProviderModelName] : []), ...(loadedProviderModelNames ?? [])])]
  const isChosenModelPickable = pickableModelNames.includes(editedProviderSettings.providerModelName)

  const providerListboxOptions: PapelizListboxSelectOption[] = listPapelizOfferedAssistantProviderPresets(editedProviderSettings.papelizAssistantProviderId).map((assistantProviderPreset) => ({
    listboxOptionValue: assistantProviderPreset.papelizAssistantProviderId,
    listboxOptionLabel: assistantProviderPreset.providerPresetDisplayName,
    listboxOptionNote: providerSettingsByProviderId[assistantProviderPreset.papelizAssistantProviderId] !== undefined ? 'saved' : undefined,
  }))
  const modelListboxOptions: PapelizListboxSelectOption[] = pickableModelNames.map((pickableModelName) => ({
    listboxOptionValue: pickableModelName,
    listboxOptionLabel: pickableModelName,
    listboxOptionNote: loadedProviderModelNames === null && pickableModelName === savedProviderModelName ? 'saved' : undefined,
  }))

  const chosenModelName = editedProviderSettings.providerModelName.trim()
  const savedUserModelPrice = userModelPrices[chosenModelName.toLowerCase()]
  const papelizModelPrice = findPapelizAssistantModelPrice(chosenModelName, {})
  const typedModelPrice = typedModelPricesByModelName[chosenModelName] ?? {
    typedInputPriceText: savedUserModelPrice === undefined ? '' : String(savedUserModelPrice.inputUsdPerMillionTokens),
    typedOutputPriceText: savedUserModelPrice === undefined ? '' : String(savedUserModelPrice.outputUsdPerMillionTokens),
  }
  const readTypedPrice = (typedPriceText: string) => {
    const typedPrice = Number(typedPriceText.trim().replace(/^\$/, ''))
    return typedPriceText.trim().length > 0 && Number.isFinite(typedPrice) && typedPrice >= 0 ? typedPrice : null
  }
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
  const isTypedModelPriceHalfFilled =
    (readTypedPrice(typedModelPrice.typedInputPriceText) === null) !== (readTypedPrice(typedModelPrice.typedOutputPriceText) === null) ||
    (typedModelPrice.typedInputPriceText.trim().length > 0 && readTypedPrice(typedModelPrice.typedInputPriceText) === null) ||
    (typedModelPrice.typedOutputPriceText.trim().length > 0 && readTypedPrice(typedModelPrice.typedOutputPriceText) === null)

  const loadProviderModelNames = () =>
    void runProviderCheck('model-list', 'Loading models…', async () => {
      const providerModelNames = await listPapelizProviderModelNames(providerConnection)
      setLoadedProviderModelNames(providerModelNames)
      if (isModelListRequired && !providerModelNames.includes(editedProviderSettings.providerModelName)) {
        // Keep a model the preset recommends when the provider has it; otherwise the user picks.
        const recommendedModelName = providerPreset.suggestedProviderModelNames.find((suggestedModelName) => providerModelNames.includes(suggestedModelName))
        setEditedProviderSettings((currentProviderSettings) => ({ ...currentProviderSettings, providerModelName: recommendedModelName ?? '' }))
      }
      if (providerModelNames.length === 0) {
        throw new Error(
          isModelListRequired
            ? 'The provider listed no models. To type a model name yourself, choose Custom with the same base URL.'
            : 'The provider listed no models. Type the model name instead.',
        )
      }
      return `${providerModelNames.length} ${providerModelNames.length === 1 ? 'model' : 'models'} loaded. Pick one in the Model field.`
    })

  // Test connection sits by the API key, but it needs a model too: it sends one tiny request.
  const isProviderModelMissing = editedProviderSettings.providerModelName.trim().length === 0
  const testProviderConnection = () =>
    void runProviderCheck('connection-test', 'Testing the connection…', async () => {
      const providerReply = await testPapelizProviderConnection(providerConnection)
      return `Connected. The model answered: “${providerReply.slice(0, 60) || '(empty)'}”`
    })

  // Model price, in a few words for the closed section's row: the price Usage will use.
  const typedInputPrice = readTypedPrice(typedModelPrice.typedInputPriceText)
  const typedOutputPrice = readTypedPrice(typedModelPrice.typedOutputPriceText)
  const isTypedModelPriceComplete = typedInputPrice !== null && typedOutputPrice !== null
  const describeModelPricePair = (inputUsdPerMillionTokens: number, outputUsdPerMillionTokens: number) =>
    `$${formatPapelizAssistantModelPricePerMillionTokens(inputUsdPerMillionTokens)} in · $${formatPapelizAssistantModelPricePerMillionTokens(outputUsdPerMillionTokens)} out`
  const modelPriceSummaryText =
    chosenModelName.length === 0
      ? ''
      : isTypedModelPriceComplete
        ? `Yours: ${describeModelPricePair(typedInputPrice, typedOutputPrice)}`
        : papelizModelPrice !== null
          ? describeModelPricePair(papelizModelPrice.modelPrice.inputUsdPerMillionTokens, papelizModelPrice.modelPrice.outputUsdPerMillionTokens)
          : 'Not listed'
  const isModelPriceSummaryAPrice = chosenModelName.length > 0 && (isTypedModelPriceComplete || papelizModelPrice !== null)
  const isRequestCostReportedByProvider = papelizRequestCostReportingAssistantProviderIds.includes(editedProviderSettings.papelizAssistantProviderId)
  const modelPriceHelpText = isTypedModelPriceHalfFilled
    ? 'Fill in both prices, as numbers, or leave both empty.'
    : isTypedModelPriceComplete
      ? `Usage uses your price.${papelizModelPrice === null ? '' : ' Clear both boxes to go back to the listed price.'}`
      : papelizModelPrice !== null
        ? `Empty boxes use the listed price, from the provider’s price page (checked ${papelizAssistantBuiltInModelPricesCheckedOnLabel}).`
        : chosenModelName.length === 0
          ? 'Pick a model first.'
          : 'Papeliz has no listed price for this model, so Usage shows no cost for it. Type the price from your provider’s price page.'

  return (
    <dialog
      ref={providerSettingsDialogRef}
      aria-labelledby={`${providerFieldIdPrefix}-title`}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onProviderSettingsDialogClose()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <form
        className="p-6"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          saveTypedModelPrices()
          void saveAssistantProviderSettings(editedProviderSettings, true).then(onProviderSettingsDialogClose)
        }}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
            <KeyRound className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${providerFieldIdPrefix}-title`} className="text-lg font-semibold">
              AI Assistant provider
            </h2>
            <p className="text-sm text-papeliz-ink-muted">Bring your own key. Papeliz has no server; the assistant talks straight to the provider you pick.</p>
          </div>
          <PapelizIconButton iconButtonLabel="Close" iconButtonSize="small" onClick={onProviderSettingsDialogClose}>
            <X className="size-4" aria-hidden="true" />
          </PapelizIconButton>
        </div>

        <label id={`${providerFieldIdPrefix}-provider-label`} className={`mt-5 ${papelizProviderFieldLabelClassName}`} htmlFor={`${providerFieldIdPrefix}-provider`}>
          Provider
        </label>
        <PapelizListboxSelect
          listboxSelectTriggerId={`${providerFieldIdPrefix}-provider`}
          listboxSelectLabelId={`${providerFieldIdPrefix}-provider-label`}
          listboxSelectOptions={providerListboxOptions}
          chosenListboxOptionValue={editedProviderSettings.papelizAssistantProviderId}
          onListboxOptionChoose={chooseProvider}
          className="mt-1.5"
        />
        <p className={papelizProviderFieldHelpClassName}>
          {providerPreset.providerPresetDescription}
          {!providerPreset.isBrowserAccessConfirmed && providerPreset.providerBaseUrl.length > 0 && ' Calls from a browser are not checked for this one yet; Test connection tells you.'}
        </p>

        {isProviderBaseUrlFieldShown && (
          <>
            <div className={papelizProviderFieldLabelRowClassName}>
              <label className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-base-url`}>
                Base URL
              </label>
              {editedProviderSettings.papelizAssistantProviderId !== papelizCustomAssistantProviderId && (
                <button
                  type="button"
                  className={papelizProviderFieldActionClassName}
                  onClick={() => editProviderSetting({ providerBaseUrl: providerPreset.providerBaseUrl })}
                >
                  Use {describeProviderHost(providerPreset.providerBaseUrl)}
                </button>
              )}
            </div>
            <input
              id={`${providerFieldIdPrefix}-base-url`}
              type="url"
              required
              placeholder="https://…/v1"
              value={editedProviderSettings.providerBaseUrl}
              onChange={(changeEvent) => editProviderSetting({ providerBaseUrl: changeEvent.target.value })}
              className={`mt-1.5 ${papelizProviderFieldClassName} font-mono text-[13px]`}
            />
          </>
        )}

        {/* Get a key sits beside the label; Test connection, the key's check, at the row's right end. */}
        <div className={papelizProviderFieldLabelRowClassName}>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <label className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-api-key`}>
              API key {!providerPreset.isProviderApiKeyRequired && <span className="font-normal text-papeliz-ink-subtle">(not needed for most local servers)</span>}
            </label>
            {providerPreset.providerApiKeyHelpUrl !== null && (
              <a href={providerPreset.providerApiKeyHelpUrl} target="_blank" rel="noopener noreferrer" className={papelizProviderFieldActionClassName}>
                Get a key <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </span>
          <button
            type="button"
            className={papelizProviderFieldActionClassName}
            disabled={providerCheckState.providerCheckKind === 'running' || isProviderApiKeyMissing || isProviderModelMissing}
            title={isProviderApiKeyMissing ? 'Paste the API key first' : isProviderModelMissing ? 'Pick a model first' : 'Send one tiny request with this key and model'}
            onClick={testProviderConnection}
          >
            {providerCheckState.providerCheckKind === 'running' && providerCheckState.providerCheckSubject === 'connection-test' ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="size-3.5" aria-hidden="true" />
            )}
            Test connection
          </button>
        </div>
        {/* The show/hide eye sits inside the field, so the field is as wide as the others. */}
        <div className="relative mt-1.5">
          <input
            id={`${providerFieldIdPrefix}-api-key`}
            type={isApiKeyShown ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            required={providerPreset.isProviderApiKeyRequired}
            value={editedProviderSettings.providerApiKey}
            onChange={(changeEvent) => editProviderSetting({ providerApiKey: changeEvent.target.value })}
            className={`${papelizProviderFieldClassName} pr-12 font-mono text-[13px]`}
          />
          <PapelizIconButton
            iconButtonLabel={isApiKeyShown ? 'Hide the key' : 'Show the key'}
            iconButtonSize="small"
            className="absolute top-1.5 right-1.5"
            onClick={() => setIsApiKeyShown(!isApiKeyShown)}
          >
            {isApiKeyShown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </PapelizIconButton>
        </div>
        {providerCheckState.providerCheckKind !== 'idle' && providerCheckState.providerCheckSubject === 'connection-test' && (
          <PapelizProviderCheckMessage providerCheckState={providerCheckState} />
        )}

        <div className={papelizProviderFieldLabelRowClassName}>
          <label id={`${providerFieldIdPrefix}-model-label`} className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-model`}>
            Model
          </label>
          <button
            type="button"
            className={papelizProviderFieldActionClassName}
            disabled={providerCheckState.providerCheckKind === 'running' || isProviderApiKeyMissing}
            title={isProviderApiKeyMissing ? 'Paste the API key first' : 'Ask the provider which models it serves'}
            onClick={loadProviderModelNames}
          >
            <RefreshCw
              className={`size-3.5 ${providerCheckState.providerCheckKind === 'running' && providerCheckState.providerCheckSubject === 'model-list' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loadedProviderModelNames === null ? 'Load models' : 'Load again'}
          </button>
        </div>
        <div className="mt-1.5">
          {isModelListRequired ? (
            // Save stays off until a listed model is chosen, so this needs no `required`.
            <PapelizListboxSelect
              listboxSelectTriggerId={`${providerFieldIdPrefix}-model`}
              listboxSelectLabelId={`${providerFieldIdPrefix}-model-label`}
              listboxSelectOptions={modelListboxOptions}
              chosenListboxOptionValue={isChosenModelPickable ? editedProviderSettings.providerModelName : ''}
              listboxSelectPlaceholder={pickableModelNames.length === 0 ? 'Load models first' : 'Pick a model'}
              isListboxSelectDisabled={pickableModelNames.length === 0}
              onListboxOptionChoose={(chosenProviderModelName) => editProviderSetting({ providerModelName: chosenProviderModelName })}
            />
          ) : (
            <>
              <input
                id={`${providerFieldIdPrefix}-model`}
                list={`${providerFieldIdPrefix}-model-names`}
                required
                placeholder="Type a model name or load the list"
                value={editedProviderSettings.providerModelName}
                onChange={(changeEvent) => editProviderSetting({ providerModelName: changeEvent.target.value })}
                className={`${papelizProviderFieldClassName} text-sm`}
              />
              <datalist id={`${providerFieldIdPrefix}-model-names`}>
                {suggestedModelNames.map((suggestedModelName) => (
                  <option key={suggestedModelName} value={suggestedModelName} />
                ))}
              </datalist>
            </>
          )}
        </div>
        {isModelListRequired && (
          <p className={papelizProviderFieldHelpClassName}>Load the models this provider serves with your key, then pick one. Only listed models can be saved.</p>
        )}
        {providerCheckState.providerCheckKind !== 'idle' && providerCheckState.providerCheckSubject === 'model-list' && (
          <PapelizProviderCheckMessage providerCheckState={providerCheckState} />
        )}

        {/* Model price: only for Usage's cost estimate, and only needed when the listed price is wrong or missing. */}
        <details className="group/model-price mt-4 rounded-2xl border border-papeliz-line px-4 py-2.5" open={savedUserModelPrice !== undefined || undefined}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold select-none [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 flex-none transition-transform group-open/model-price:rotate-90" aria-hidden="true" />
            <span className="whitespace-nowrap">Model price</span>
            {/* On a phone only the prices show; "per 1M tokens" is under the boxes. */}
            <span className="ml-auto min-w-0 truncate pl-3 text-[12.5px] font-normal text-papeliz-ink-muted tabular-nums">
              {modelPriceSummaryText}
              {isModelPriceSummaryAPrice && <span className="max-sm:hidden"> per 1M tokens</span>}
            </span>
          </summary>
          <p className={papelizProviderFieldHelpClassName}>
            Usage uses this price to estimate what the assistant costs you. Papeliz itself is free; your provider bills you.
            {isRequestCostReportedByProvider && ` ${providerPreset.providerPresetDisplayName} reports what each request costs, and Usage uses that first.`}
          </p>
          <div className="mt-2.5 flex gap-2">
            {(
              [
                ['Input', 'typedInputPriceText', papelizModelPrice?.modelPrice.inputUsdPerMillionTokens],
                ['Output', 'typedOutputPriceText', papelizModelPrice?.modelPrice.outputUsdPerMillionTokens],
              ] as const
            ).map(([priceBoxLabel, typedPriceField, listedPrice]) => (
              <label key={typedPriceField} className="flex min-w-0 flex-1 flex-col gap-1 text-[12.5px] font-medium">
                <span>
                  {priceBoxLabel} <span className="font-normal text-papeliz-ink-muted">per 1M tokens</span>
                </span>
                {/* The dollar sign sits inside the field, so only the number is typed. */}
                <span className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-papeliz-ink-muted" aria-hidden="true">
                    $
                  </span>
                  <input
                    inputMode="decimal"
                    disabled={chosenModelName.length === 0}
                    placeholder={listedPrice === undefined ? '0.00' : formatPapelizAssistantModelPricePerMillionTokens(listedPrice)}
                    value={typedModelPrice[typedPriceField]}
                    onChange={(changeEvent) =>
                      setTypedModelPricesByModelName((currentTypedPrices) => ({
                        ...currentTypedPrices,
                        [chosenModelName]: { ...typedModelPrice, [typedPriceField]: changeEvent.target.value },
                      }))
                    }
                    className={`${papelizProviderFieldClassName} pl-7 text-sm tabular-nums`}
                  />
                </span>
              </label>
            ))}
          </div>
          <p
            role={isTypedModelPriceHalfFilled ? 'alert' : undefined}
            className={isTypedModelPriceHalfFilled ? 'mt-1.5 text-[12.5px] leading-snug text-papeliz-diff-removed-ink' : papelizProviderFieldHelpClassName}
          >
            {modelPriceHelpText}
          </p>
        </details>

        <div className="mt-4 rounded-2xl bg-papeliz-surface-soft px-4 py-3 text-[13px] text-papeliz-ink-muted">
          <b className="font-semibold text-papeliz-ink">Where your key goes.</b> It is saved only in this browser (IndexedDB) and sent only to{' '}
          <span className="font-mono text-papeliz-ink">{describeProviderHost(editedProviderSettings.providerBaseUrl)}</span>, with each request you make.
          The notes the assistant reads are sent there too, and that provider’s terms apply.
        </div>

        {/* No Cancel: the close button and Esc leave without saving. */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {isSavedProvider && (
            <PapelizPillButton
              pillButtonVariant="gray"
              className="text-papeliz-diff-removed-ink"
              onClick={() => {
                void forgetAssistantProviderSettings(editedProviderSettings.papelizAssistantProviderId)
                setEditedProviderSettings(createDefaultPapelizAssistantProviderSettings(editedProviderSettings.papelizAssistantProviderId))
              }}
            >
              Forget this key
            </PapelizPillButton>
          )}
          <PapelizPillButton
            type="submit"
            pillButtonVariant="primary"
            className="ml-auto"
            disabled={(isModelListRequired && !isChosenModelPickable) || isTypedModelPriceHalfFilled}
            title={isModelListRequired && !isChosenModelPickable ? 'Load models and pick one first' : undefined}
          >
            Save
          </PapelizPillButton>
        </div>
      </form>
    </dialog>
  )
}
