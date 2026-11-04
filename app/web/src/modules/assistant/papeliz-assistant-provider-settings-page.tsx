import { Plus, Settings } from 'lucide-react'
import { useId, useState } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import {
  describePapelizProviderHost,
  PapelizAssistantProviderEditorDialog,
  type PapelizAssistantProviderEditorRequest,
} from './papeliz-assistant-provider-editor-dialog'
import { PapelizAssistantModelsForEachTaskSection } from './papeliz-assistant-models-for-each-task-section'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { listPapelizEnabledProviderModelNames, listPapelizSavedAssistantProviderIds, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'

// Where the assistant's calls start, in the page's words: this browser on the web, this computer in
// the desktop app.
const papelizAssistantCallsFromPlaceName = isPapelizDesktopApp ? 'this computer' : 'this browser'

// Settings › AI Provider: the saved providers, all in use at once, each with the models switched on
// for it. A row per provider: its name, where its key goes and how many of its models are on, and the
// gear that opens its modal with the key, the models and Advanced. Add Provider opens one modal: a
// Provider dropdown over the chosen provider's key, test and models. A provider is saved only once its
// test passes (papeliz-assistant-provider-editor-dialog.tsx). Once there is one, Models for Transcribe
// and Draw sits under them.
// The page fits the Settings panel without scrolling. The providers sit in a box four rows tall (three
// below 768 px, under the panel's Back bar) whatever the number saved, and more scroll inside it, so the
// rows under it never move. The panel's page is a flex column (papeliz-settings-gear-button.tsx), so in
// a shorter window the box gives up its room first, down to one row.
export function PapelizAssistantProviderSettingsPage() {
  const savedProvidersHeadingId = useId()
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const [providerEditorRequest, setProviderEditorRequest] = useState<PapelizAssistantProviderEditorRequest | null>(null)
  const savedProviderIds = listPapelizSavedAssistantProviderIds(providerSettingsByProviderId)

  return (
    <>
      <h3 id={savedProvidersHeadingId} className="text-sm font-semibold">
        Saved Providers
      </h3>
      {savedProviderIds.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] leading-snug text-papeliz-ink-muted">
          No providers yet. Add one with your own API key: the assistant talks straight from {papelizAssistantCallsFromPlaceName} to that provider.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-[12.5px] leading-[1.35] text-papeliz-ink-muted">Manage your configured API Keys.</p>
          {/* Four 54 px rows and their lines (three below 768 px), inside the border. */}
          <ul
            aria-labelledby={savedProvidersHeadingId}
            className="papeliz-settings-gear-scroller mt-2 h-[166px] min-h-14 divide-y divide-papeliz-line overflow-y-auto overscroll-contain rounded-2xl border border-papeliz-line md:h-[221px]"
          >
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
        </>
      )}
      <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="mt-2.5 w-full" onClick={() => setProviderEditorRequest({ providerEditorKind: 'add' })}>
        <Plus className="size-3.5" aria-hidden="true" />
        Add Provider
      </PapelizPillButton>
      {savedProviderIds.length > 0 && <PapelizAssistantModelsForEachTaskSection onAddProvider={() => setProviderEditorRequest({ providerEditorKind: 'add' })} />}
      {providerEditorRequest !== null && (
        <PapelizAssistantProviderEditorDialog providerEditorRequest={providerEditorRequest} onProviderEditorClose={() => setProviderEditorRequest(null)} />
      )}
    </>
  )
}
