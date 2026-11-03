import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import {
  usePapelizAssistantMediaModelChoicesStore,
  type PapelizAssistantMediaKind,
  type PapelizAssistantOfferedMediaModel,
} from './papeliz-assistant-media-model-choices-store'
import { PapelizAssistantMediaOtherModelForm, usePapelizChosenAssistantMediaModel } from './papeliz-assistant-media-parts'
import { papelizAssistantImageGenerationPresetsByProviderId, papelizAssistantTranscriptionPresetsByProviderId } from './papeliz-assistant-media-provider-presets'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  listPapelizEnabledProviderModelNames,
  listPapelizSavedAssistantProviderIds,
  resolvePapelizActiveAssistantProviderModel,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'

// Settings › AI Provider › Models for Each Task: one row per task, drawn like Saved Providers, each
// saying which model it uses and opening a menu of the models the added providers offer for it.
// - Chat is the chat box's model chip: the same choice, so it has no Automatic.
// - Transcribe and Draw: Automatic first (saying what it uses now), each provider's models under its
//   name, then Other Model, which types a name the presets don't suggest.
// - Describe Picture: "Same as Chat" first, then the known vision models, then Other Model.
// A task none of the added providers can do says so, with Add Provider. The chips' "Models for Each
// Task" rows open the page scrolled here (papeliz-assistant-panel-ui-store.ts).

interface PapelizModelsForEachTaskMediaRowWords {
  modelsForEachTaskRowTitle: string
  // What the first item is called: Automatic, or Same as Chat for Describe Picture.
  automaticMenuItemLabel: string
  // Said when no added provider can do the task (Describe Picture can always follow Chat).
  noProviderCanDoTaskLine: string | null
}

const papelizModelsForEachTaskMediaRowWords: Record<PapelizAssistantMediaKind, PapelizModelsForEachTaskMediaRowWords> = {
  transcription: { modelsForEachTaskRowTitle: 'Transcribe', automaticMenuItemLabel: 'Automatic', noProviderCanDoTaskLine: 'None of your providers transcribes.' },
  'image-generation': { modelsForEachTaskRowTitle: 'Draw', automaticMenuItemLabel: 'Automatic', noProviderCanDoTaskLine: 'None of your providers makes pictures.' },
  'picture-description': { modelsForEachTaskRowTitle: 'Describe Picture', automaticMenuItemLabel: 'Same as Chat', noProviderCanDoTaskLine: null },
}

// The order the rows sit in, after Chat.
const papelizModelsForEachTaskMediaRowKinds: readonly PapelizAssistantMediaKind[] = ['transcription', 'image-generation', 'picture-description']

// "The Meta Model API, OpenAI and Groq transcribe.": who can do a task none of the added providers
// can, from the presets.
function describePapelizProvidersThatCanDoTask(papelizAssistantProviderIds: readonly string[], taskVerbWords: string): string {
  const providerDisplayNames = papelizAssistantProviderIds.map((papelizAssistantProviderId) => findPapelizAssistantProviderPreset(papelizAssistantProviderId).providerPresetDisplayName)
  const providerNamesWords =
    providerDisplayNames.length <= 1 ? (providerDisplayNames[0] ?? '') : `${providerDisplayNames.slice(0, -1).join(', ')} and ${providerDisplayNames.at(-1)}`
  return `${providerNamesWords.replace(/^Meta Model API/, 'The Meta Model API')} ${taskVerbWords}.`
}

// A row's small grey tag after its title: Automatic, or Typed for a model the person typed.
function PapelizModelsForEachTaskRowTag({ children, isTypedModelTag = false }: { children: ReactNode; isTypedModelTag?: boolean }) {
  return (
    <span
      className={joinPapelizClassNames(
        'rounded-full px-[7px] text-[11px] leading-[17px] font-medium whitespace-nowrap',
        isTypedModelTag ? 'bg-papeliz-blue-soft text-papeliz-blue' : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
      )}
    >
      {children}
    </span>
  )
}

// The row's model, then its provider (or what it follows), kept whole on the line.
function PapelizModelsForEachTaskRowModelLine({ rowModelName, rowModelPlaceName }: { rowModelName: string; rowModelPlaceName: string }) {
  return (
    <span className="block text-[12px] leading-[1.35] [overflow-wrap:anywhere] text-papeliz-ink-muted">
      {rowModelName} · <span className="whitespace-nowrap">{rowModelPlaceName}</span>
    </span>
  )
}

interface PapelizModelsForEachTaskRowButtonProps {
  modelsForEachTaskRowTitle: string
  rowTagWords: string | null
  isRowTagTypedModel?: boolean
  rowModelLine: ReactNode
  isRowMenuOpen: boolean
  onRowMenuOpen: (rowMenuPosition: PapelizPopoverMenuPosition) => void
}

// A task's row: its title (with Automatic or Typed), the model it uses, and the chevron; pressing it
// opens the row's menu under it.
function PapelizModelsForEachTaskRowButton({ modelsForEachTaskRowTitle, rowTagWords, isRowTagTypedModel, rowModelLine, isRowMenuOpen, onRowMenuOpen }: PapelizModelsForEachTaskRowButtonProps) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isRowMenuOpen}
      onClick={(rowClickEvent) => {
        const rowRect = rowClickEvent.currentTarget.getBoundingClientRect()
        onRowMenuOpen({ menuAnchorLeft: rowRect.left + 6, menuAnchorTop: rowRect.bottom + 4 })
      }}
      className={joinPapelizClassNames(
        'flex min-h-[46px] w-full items-center gap-2 py-[7px] pr-2 pl-3.5 text-left transition-colors hover:bg-papeliz-hover focus-visible:bg-papeliz-hover focus-visible:outline-none',
        isRowMenuOpen && 'bg-papeliz-hover',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
          {modelsForEachTaskRowTitle}
          {rowTagWords !== null && <PapelizModelsForEachTaskRowTag isTypedModelTag={isRowTagTypedModel}>{rowTagWords}</PapelizModelsForEachTaskRowTag>}
        </span>
        {rowModelLine}
      </span>
      <ChevronDown className="size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
    </button>
  )
}

// Chat: the chat box's model chip, as a row. Its menu lists every model switched on, under each
// provider's name, and a pick here is the chip's pick.
function PapelizModelsForEachTaskChatRow() {
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeAssistantProviderModelName = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderModelName)
  const chooseActiveAssistantProviderModel = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.chooseActiveAssistantProviderModel)
  const [chatRowMenuPosition, setChatRowMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const activeChatProviderModel = resolvePapelizActiveAssistantProviderModel({ activeAssistantProviderId, activeAssistantProviderModelName, providerSettingsByProviderId })
  const isActiveChatProviderModel = (papelizAssistantProviderId: string, providerModelName: string) =>
    activeChatProviderModel !== null && activeChatProviderModel.papelizAssistantProviderId === papelizAssistantProviderId && activeChatProviderModel.providerModelName === providerModelName

  const chatRowMenuItems: PapelizPopoverMenuItem[] = listPapelizSavedAssistantProviderIds(providerSettingsByProviderId).flatMap((savedProviderId) =>
    listPapelizEnabledProviderModelNames(providerSettingsByProviderId[savedProviderId]).map((enabledProviderModelName, enabledProviderModelIndex) => ({
      menuItemKey: `${savedProviderId}/${enabledProviderModelName}`,
      menuItemLabel: enabledProviderModelName,
      isMenuItemChecked: isActiveChatProviderModel(savedProviderId, enabledProviderModelName),
      ...(enabledProviderModelIndex === 0 ? { menuItemGroupHeading: findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName } : {}),
      onMenuItemSelect: () => {
        if (isActiveChatProviderModel(savedProviderId, enabledProviderModelName)) return
        void chooseActiveAssistantProviderModel({ papelizAssistantProviderId: savedProviderId, providerModelName: enabledProviderModelName }).catch(() => undefined)
      },
    })),
  )

  return (
    <li>
      {activeChatProviderModel === null ? (
        <div className="flex min-h-[46px] flex-col justify-center py-[7px] pr-2 pl-3.5">
          <span className="text-[13.5px] font-medium">Chat</span>
          <span className="text-[12px] text-papeliz-ink-muted">No model is switched on. Turn one on with its provider’s gear.</span>
        </div>
      ) : (
        <PapelizModelsForEachTaskRowButton
          modelsForEachTaskRowTitle="Chat"
          rowTagWords={null}
          rowModelLine={
            <PapelizModelsForEachTaskRowModelLine
              rowModelName={activeChatProviderModel.providerModelName}
              rowModelPlaceName={findPapelizAssistantProviderPreset(activeChatProviderModel.papelizAssistantProviderId).providerPresetDisplayName}
            />
          }
          isRowMenuOpen={chatRowMenuPosition !== null}
          onRowMenuOpen={setChatRowMenuPosition}
        />
      )}
      {chatRowMenuPosition !== null && (
        <PapelizPopoverMenu menuLabel="Chat Model" menuPosition={chatRowMenuPosition} menuItems={chatRowMenuItems} onMenuClose={() => setChatRowMenuPosition(null)} />
      )}
    </li>
  )
}

// Transcribe, Draw or Describe Picture: the model it uses now and its menu, or, when no added provider
// can do it, why, with Add Provider. Other Model opens its form under the row.
function PapelizModelsForEachTaskMediaRow({ assistantMediaKind, onAddProvider }: { assistantMediaKind: PapelizAssistantMediaKind; onAddProvider: () => void }) {
  const { modelsForEachTaskRowTitle, automaticMenuItemLabel, noProviderCanDoTaskLine } = papelizModelsForEachTaskMediaRowWords[assistantMediaKind]
  const { offeredMediaModels, chosenMediaModel, isMediaModelChosenAutomatically } = usePapelizChosenAssistantMediaModel(assistantMediaKind)
  const chooseAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModel)
  const chooseAssistantMediaModelAutomatically = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModelAutomatically)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeAssistantProviderModelName = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderModelName)
  const [mediaRowMenuPosition, setMediaRowMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const [isOtherModelFormOpen, setIsOtherModelFormOpen] = useState(false)
  const isPictureDescriptionRow = assistantMediaKind === 'picture-description'
  // What Automatic uses now: the first model offered, or the chat's for Describe Picture.
  const activeChatProviderModel = resolvePapelizActiveAssistantProviderModel({ activeAssistantProviderId, activeAssistantProviderModelName, providerSettingsByProviderId })
  const automaticMediaModelName = isPictureDescriptionRow ? (activeChatProviderModel?.providerModelName ?? null) : (offeredMediaModels[0]?.providerModelName ?? null)

  if (!isPictureDescriptionRow && offeredMediaModels.length === 0) {
    return (
      <li className="flex min-h-[46px] flex-col justify-center py-[7px] pr-2 pl-3.5">
        <span className="text-[13.5px] font-medium">{modelsForEachTaskRowTitle}</span>
        <span className="text-[12px] leading-[1.35] text-papeliz-ink-muted">
          {noProviderCanDoTaskLine}{' '}
          <button
            type="button"
            aria-label={`Add Provider for ${modelsForEachTaskRowTitle}`}
            onClick={onAddProvider}
            className="font-semibold text-papeliz-blue underline-offset-2 hover:underline"
          >
            Add Provider
          </button>
        </span>
      </li>
    )
  }

  const isOfferedMediaModelChosen = (offeredMediaModel: PapelizAssistantOfferedMediaModel) =>
    !isMediaModelChosenAutomatically &&
    chosenMediaModel !== null &&
    chosenMediaModel.papelizAssistantProviderId === offeredMediaModel.papelizAssistantProviderId &&
    chosenMediaModel.providerModelName === offeredMediaModel.providerModelName
  const mediaRowMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'automatic',
      menuItemLabel: automaticMenuItemLabel,
      ...(automaticMediaModelName === null ? {} : { menuItemDetailText: `${automaticMediaModelName} now` }),
      isMenuItemChecked: isMediaModelChosenAutomatically,
      onMenuItemSelect: () => void chooseAssistantMediaModelAutomatically(assistantMediaKind),
    },
    ...offeredMediaModels.map((offeredMediaModel, offeredMediaModelIndex) => ({
      menuItemKey: `${offeredMediaModel.papelizAssistantProviderId}/${offeredMediaModel.providerModelName}`,
      menuItemLabel: offeredMediaModel.providerModelName,
      ...(offeredMediaModel.isMediaModelTypedByPerson ? { menuItemDetailText: 'Typed' } : {}),
      isMenuItemChecked: isOfferedMediaModelChosen(offeredMediaModel),
      ...(offeredMediaModelIndex === 0 || offeredMediaModels[offeredMediaModelIndex - 1]?.papelizAssistantProviderId !== offeredMediaModel.papelizAssistantProviderId
        ? { menuItemGroupHeading: offeredMediaModel.providerDisplayName }
        : {}),
      onMenuItemSelect: () =>
        void chooseAssistantMediaModel(assistantMediaKind, { papelizAssistantProviderId: offeredMediaModel.papelizAssistantProviderId, providerModelName: offeredMediaModel.providerModelName }),
    })),
    {
      menuItemKey: 'other-model',
      menuItemLabel: 'Other Model',
      MenuItemIcon: Plus,
      menuItemGroupHeading: 'Settings',
      onMenuItemSelect: () => setIsOtherModelFormOpen(true),
    },
  ]

  return (
    <li>
      <PapelizModelsForEachTaskRowButton
        modelsForEachTaskRowTitle={modelsForEachTaskRowTitle}
        rowTagWords={isMediaModelChosenAutomatically ? 'Automatic' : chosenMediaModel?.isMediaModelTypedByPerson === true ? 'Typed' : null}
        isRowTagTypedModel={!isMediaModelChosenAutomatically}
        rowModelLine={
          chosenMediaModel !== null ? (
            <PapelizModelsForEachTaskRowModelLine rowModelName={chosenMediaModel.providerModelName} rowModelPlaceName={chosenMediaModel.providerDisplayName} />
          ) : activeChatProviderModel !== null ? (
            <PapelizModelsForEachTaskRowModelLine rowModelName="Same as Chat" rowModelPlaceName={activeChatProviderModel.providerModelName} />
          ) : (
            <span className="block text-[12px] text-papeliz-ink-muted">Same as Chat</span>
          )
        }
        isRowMenuOpen={mediaRowMenuPosition !== null}
        onRowMenuOpen={setMediaRowMenuPosition}
      />
      {isOtherModelFormOpen && (
        <div className="px-2 pb-2">
          <PapelizAssistantMediaOtherModelForm assistantMediaKind={assistantMediaKind} onOtherModelFormClose={() => setIsOtherModelFormOpen(false)} />
        </div>
      )}
      {mediaRowMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel={`${modelsForEachTaskRowTitle} Model`}
          menuPosition={mediaRowMenuPosition}
          menuItems={mediaRowMenuItems}
          onMenuClose={() => setMediaRowMenuPosition(null)}
        />
      )}
    </li>
  )
}

export function PapelizAssistantModelsForEachTaskSection({ onAddProvider }: { onAddProvider: () => void }) {
  const modelsForEachTaskHeadingId = useId()
  const modelsForEachTaskSectionRef = useRef<HTMLElement>(null)
  const isModelsForEachTaskSectionRequested = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.isAssistantModelsForEachTaskSectionRequested)
  const { offeredMediaModels: offeredTranscriptionModels } = usePapelizChosenAssistantMediaModel('transcription')
  const { offeredMediaModels: offeredImageGenerationModels } = usePapelizChosenAssistantMediaModel('image-generation')

  // Opened from a chip's "Models for Each Task": the page comes here, then takes the request back.
  useEffect(() => {
    if (!isModelsForEachTaskSectionRequested) return
    const isMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    modelsForEachTaskSectionRef.current?.scrollIntoView({ block: 'start', behavior: isMotionReduced ? 'auto' : 'smooth' })
    usePapelizAssistantPanelUiStore.getState().clearAssistantModelsForEachTaskSectionRequest()
  }, [isModelsForEachTaskSectionRequested])

  return (
    <section ref={modelsForEachTaskSectionRef} aria-labelledby={modelsForEachTaskHeadingId} className="mt-[18px] scroll-mt-2">
      <h3 id={modelsForEachTaskHeadingId} className="text-sm font-medium">
        Models for Each Task
      </h3>
      <ul aria-labelledby={modelsForEachTaskHeadingId} className="mt-2 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
        <PapelizModelsForEachTaskChatRow />
        {papelizModelsForEachTaskMediaRowKinds.map((assistantMediaKind) => (
          <PapelizModelsForEachTaskMediaRow key={assistantMediaKind} assistantMediaKind={assistantMediaKind} onAddProvider={onAddProvider} />
        ))}
      </ul>
      {offeredTranscriptionModels.length === 0 && (
        <p className="mx-0.5 mt-1.5 text-[12px] leading-[1.35] text-papeliz-ink-subtle">
          {describePapelizProvidersThatCanDoTask(Object.keys(papelizAssistantTranscriptionPresetsByProviderId), 'transcribe')}
        </p>
      )}
      {offeredImageGenerationModels.length === 0 && (
        <p className="mx-0.5 mt-1.5 text-[12px] leading-[1.35] text-papeliz-ink-subtle">
          {describePapelizProvidersThatCanDoTask(Object.keys(papelizAssistantImageGenerationPresetsByProviderId), 'make pictures')}
        </p>
      )}
      <p className="mx-0.5 mt-1.5 text-[12px] leading-[1.35] text-papeliz-ink-subtle">
        Automatic is the first provider that can, the Meta Model API first. Chat is the chat box’s model chip too, and Written Up, in Transcribe, uses it.
      </p>
    </section>
  )
}
