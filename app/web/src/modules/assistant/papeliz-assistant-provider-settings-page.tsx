import { Lock, Plus, Settings } from 'lucide-react'
import { useId, useState } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import {
  describePapelizProviderHost,
  PapelizAssistantProviderEditorDialog,
  type PapelizAssistantProviderEditorRequest,
} from './papeliz-assistant-provider-editor-dialog'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { listPapelizEnabledProviderModelNames, listPapelizSavedAssistantProviderIds, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'

// Where the assistant's calls start and the keys stay, in the page's words: this browser on the web,
// this computer in the desktop app.
const papelizAssistantProviderKeyPlaceWords = isPapelizDesktopApp
  ? { assistantCallsFromPlaceName: 'this computer', assistantProviderKeyStaysPlaceWords: 'on this computer' }
  : { assistantCallsFromPlaceName: 'this browser', assistantProviderKeyStaysPlaceWords: 'in this browser' }

// Settings › AI Provider: the saved providers, all in use at once, each with the models switched on
// for it. A row per provider: its name, where its key goes and how many of its models are on, and the
// gear that opens its modal with the key, the models and Advanced. Add Provider opens one modal: a
// Provider dropdown over the chosen provider's key, test and models. A provider is saved only once its
// test passes (papeliz-assistant-provider-editor-dialog.tsx), and the model chip in the assistant picks
// among every model switched on.
export function PapelizAssistantProviderSettingsPage() {
  const savedProvidersHeadingId = useId()
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const [providerEditorRequest, setProviderEditorRequest] = useState<PapelizAssistantProviderEditorRequest | null>(null)
  const savedProviderIds = listPapelizSavedAssistantProviderIds(providerSettingsByProviderId)

  return (
    <>
      <h3 id={savedProvidersHeadingId} className="text-sm font-medium">
        Saved Providers
      </h3>
      {savedProviderIds.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] leading-snug text-papeliz-ink-muted">
          No providers yet. Add one with your own API key: the assistant talks straight from {papelizAssistantProviderKeyPlaceWords.assistantCallsFromPlaceName} to
          that provider.
        </p>
      ) : (
        <ul aria-labelledby={savedProvidersHeadingId} className="mt-2 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
          {savedProviderIds.map((savedProviderId) => {
            const savedProviderSettings = providerSettingsByProviderId[savedProviderId]!
            const savedProviderDisplayName = findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName
            const enabledModelCount = listPapelizEnabledProviderModelNames(savedProviderSettings).length
            return (
              <li key={savedProviderId} className="flex items-center gap-2 py-2 pr-1.5 pl-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{savedProviderDisplayName}</span>
                  <span className="block truncate text-[12px] text-papeliz-ink-muted">
                    <span className="font-mono">{describePapelizProviderHost(savedProviderSettings.providerBaseUrl)}</span>
                    {' · '}
                    {enabledModelCount === 0 ? 'No models on' : `${enabledModelCount} ${enabledModelCount === 1 ? 'model' : 'models'} on`}
                  </span>
                </span>
                <PapelizIconButton
                  iconButtonLabel={`${savedProviderDisplayName} Settings`}
                  iconButtonSize="small"
                  onClick={() => setProviderEditorRequest({ providerEditorKind: 'edit', papelizAssistantProviderId: savedProviderId })}
                >
                  <Settings className="size-4" aria-hidden="true" />
                </PapelizIconButton>
              </li>
            )
          })}
        </ul>
      )}
      <PapelizPillButton
        pillButtonVariant={savedProviderIds.length === 0 ? 'primary' : 'line'}
        pillButtonSize="small"
        className="mt-2.5 w-full"
        onClick={() => setProviderEditorRequest({ providerEditorKind: 'add' })}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add Provider
      </PapelizPillButton>
      <p className="mt-3.5 flex items-start gap-2 rounded-2xl bg-papeliz-surface-soft px-4 py-2.5 text-[12.5px] leading-snug text-papeliz-ink-muted">
        <Lock className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
        <span>
          Each key stays {papelizAssistantProviderKeyPlaceWords.assistantProviderKeyStaysPlaceWords} and goes only to the address under its provider’s name. The
          model chip in the assistant picks the model for each message.
        </span>
      </p>
      {providerEditorRequest !== null && (
        <PapelizAssistantProviderEditorDialog providerEditorRequest={providerEditorRequest} onProviderEditorClose={() => setProviderEditorRequest(null)} />
      )}
    </>
  )
}
