import { CircleCheck, CircleAlert, ExternalLink, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizListboxSelect, type PapelizListboxSelectOption } from '../ui/papeliz-listbox-select'
import { findPapelizAssistantProviderPreset, papelizAssistantProviderPresets, papelizCustomAssistantProviderId } from './papeliz-assistant-provider-presets'
import {
  createDefaultPapelizAssistantProviderSettings,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'
import { listPapelizProviderModelNames, testPapelizProviderConnection } from './papeliz-openai-compatible-client'

type PapelizProviderCheckState =
  | { providerCheckKind: 'idle' }
  | { providerCheckKind: 'running'; providerCheckLabel: string }
  | { providerCheckKind: 'passed'; providerCheckMessage: string }
  | { providerCheckKind: 'failed'; providerCheckMessage: string }

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

  const runProviderCheck = async (providerCheckLabel: string, providerCheck: () => Promise<string>) => {
    setProviderCheckState({ providerCheckKind: 'running', providerCheckLabel })
    try {
      setProviderCheckState({ providerCheckKind: 'passed', providerCheckMessage: await providerCheck() })
    } catch (providerCheckError) {
      setProviderCheckState({ providerCheckKind: 'failed', providerCheckMessage: providerCheckError instanceof Error ? providerCheckError.message : 'The check failed.' })
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

  const providerListboxOptions: PapelizListboxSelectOption[] = papelizAssistantProviderPresets.map((assistantProviderPreset) => ({
    listboxOptionValue: assistantProviderPreset.papelizAssistantProviderId,
    listboxOptionLabel: assistantProviderPreset.providerPresetDisplayName,
    listboxOptionNote: providerSettingsByProviderId[assistantProviderPreset.papelizAssistantProviderId] !== undefined ? 'saved' : undefined,
  }))
  const modelListboxOptions: PapelizListboxSelectOption[] = pickableModelNames.map((pickableModelName) => ({
    listboxOptionValue: pickableModelName,
    listboxOptionLabel: pickableModelName,
    listboxOptionNote: loadedProviderModelNames === null && pickableModelName === savedProviderModelName ? 'saved' : undefined,
  }))

  const loadProviderModelNames = () =>
    void runProviderCheck('Loading models…', async () => {
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

        <div className={papelizProviderFieldLabelRowClassName}>
          <label className={papelizProviderFieldLabelClassName} htmlFor={`${providerFieldIdPrefix}-api-key`}>
            API key {!providerPreset.isProviderApiKeyRequired && <span className="font-normal text-papeliz-ink-subtle">(not needed for most local servers)</span>}
          </label>
          {providerPreset.providerApiKeyHelpUrl !== null && (
            <a href={providerPreset.providerApiKeyHelpUrl} target="_blank" rel="noopener noreferrer" className={papelizProviderFieldActionClassName}>
              Get a key <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
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
              className={`size-3.5 ${providerCheckState.providerCheckKind === 'running' && providerCheckState.providerCheckLabel === 'Loading models…' ? 'animate-spin' : ''}`}
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

        <div className="mt-4 rounded-2xl bg-papeliz-surface-soft px-4 py-3 text-[13px] text-papeliz-ink-muted">
          <b className="font-semibold text-papeliz-ink">Where your key goes.</b> It is saved only in this browser (IndexedDB) and sent only to{' '}
          <span className="font-mono text-papeliz-ink">{describeProviderHost(editedProviderSettings.providerBaseUrl)}</span>, with each request you make.
          The notes the assistant reads are sent there too, and that provider’s terms apply.
        </div>

        {providerCheckState.providerCheckKind !== 'idle' && (
          <p
            role={providerCheckState.providerCheckKind === 'failed' ? 'alert' : 'status'}
            className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-2.5 text-[13px] ${
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
            <span>
              {providerCheckState.providerCheckKind === 'running' ? providerCheckState.providerCheckLabel : providerCheckState.providerCheckMessage}
            </span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <PapelizPillButton
            pillButtonVariant="gray"
            disabled={providerCheckState.providerCheckKind === 'running' || editedProviderSettings.providerModelName.trim().length === 0}
            onClick={() =>
              void runProviderCheck('Testing the connection…', async () => {
                const providerReply = await testPapelizProviderConnection(providerConnection)
                return `Connected. The model answered: “${providerReply.slice(0, 60) || '(empty)'}”`
              })
            }
          >
            Test connection
          </PapelizPillButton>
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
          <div className="ml-auto flex gap-2">
            <PapelizPillButton pillButtonVariant="gray" onClick={onProviderSettingsDialogClose}>
              Cancel
            </PapelizPillButton>
            <PapelizPillButton
              type="submit"
              pillButtonVariant="primary"
              disabled={isModelListRequired && !isChosenModelPickable}
              title={isModelListRequired && !isChosenModelPickable ? 'Load models and pick one first' : undefined}
            >
              Save and use
            </PapelizPillButton>
          </div>
        </div>
      </form>
    </dialog>
  )
}
