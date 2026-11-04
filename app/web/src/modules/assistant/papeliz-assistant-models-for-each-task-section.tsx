import { AudioLines, ImagePlus, Plus, Settings, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizHoverTooltip, PapelizTooltipBubble, PapelizTooltipLine } from '../ui/papeliz-hover-tooltip'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import {
  usePapelizAssistantMediaModelChoicesStore,
  type PapelizAssistantOfferedMediaModel,
  type PapelizAssistantPickedModelMediaKind,
} from './papeliz-assistant-media-model-choices-store'
import { PapelizAssistantMediaOtherModelForm, usePapelizChosenAssistantMediaModel } from './papeliz-assistant-media-parts'
import { papelizAssistantImageGenerationPresetsByProviderId, papelizAssistantTranscriptionPresetsByProviderId } from './papeliz-assistant-media-provider-presets'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'

// Settings › AI Provider › Models for Transcribe and Draw: a row for each of the two tasks whose model
// is picked here, saying which model it uses (on one line, whole on hover) and opening a menu of the
// models the added providers offer for it: Automatic first (saying what it uses now), each provider's
// models under its name, then Other Model, which types a name the presets don't suggest. Automatic shows
// as a green A, with its tooltip. Chat's model is the chat box's model chip, and Describe Picture always
// uses it, so neither has a row. A task none of the added providers can do is itself Add Provider, with
// the providers that can on hover. The chips' "Models for Transcribe and Draw" open the page scrolled
// here (papeliz-assistant-panel-ui-store.ts).

interface PapelizModelsForEachTaskRowWords {
  modelsForEachTaskRowTitle: string
  ModelsForEachTaskRowIcon: LucideIcon
  // The green A's tooltip, under its title "Automatic".
  automaticModelTooltipText: string
  noProviderCanDoTaskLine: string
  // "The Meta Model API, OpenAI and Groq transcribe.", from the presets.
  providersThatCanDoTaskSentence: string
}

// "The Meta Model API, OpenAI and Groq transcribe.": who can do a task none of the added providers
// can, from the presets.
function describePapelizProvidersThatCanDoTask(papelizAssistantProviderIds: readonly string[], taskVerbWords: string): string {
  const providerDisplayNames = papelizAssistantProviderIds.map((papelizAssistantProviderId) => findPapelizAssistantProviderPreset(papelizAssistantProviderId).providerPresetDisplayName)
  const providerNamesWords =
    providerDisplayNames.length <= 1 ? (providerDisplayNames[0] ?? '') : `${providerDisplayNames.slice(0, -1).join(', ')} and ${providerDisplayNames.at(-1)}`
  return `${providerNamesWords.replace(/^Meta Model API/, 'The Meta Model API')} ${taskVerbWords}.`
}

const papelizModelsForEachTaskRowWords: Record<PapelizAssistantPickedModelMediaKind, PapelizModelsForEachTaskRowWords> = {
  transcription: {
    modelsForEachTaskRowTitle: 'Transcribe',
    ModelsForEachTaskRowIcon: AudioLines,
    automaticModelTooltipText: 'Uses the first of your providers that transcribes, the Meta Model API first.',
    noProviderCanDoTaskLine: 'None of your providers transcribes.',
    providersThatCanDoTaskSentence: describePapelizProvidersThatCanDoTask(Object.keys(papelizAssistantTranscriptionPresetsByProviderId), 'transcribe'),
  },
  'image-generation': {
    modelsForEachTaskRowTitle: 'Draw',
    ModelsForEachTaskRowIcon: ImagePlus,
    automaticModelTooltipText: 'Uses the first of your providers that makes pictures, the Meta Model API first.',
    noProviderCanDoTaskLine: 'None of your providers makes pictures.',
    providersThatCanDoTaskSentence: describePapelizProvidersThatCanDoTask(Object.keys(papelizAssistantImageGenerationPresetsByProviderId), 'make pictures'),
  },
}

// The order the rows sit in.
const papelizModelsForEachTaskRowKinds: readonly PapelizAssistantPickedModelMediaKind[] = ['transcription', 'image-generation']

// A row is its task's button: the task's icon, its title over its line, and a gear or a + at the end.
const papelizModelsForEachTaskRowButtonClassName =
  'flex min-h-[54px] w-full items-center gap-3 py-[9px] pr-2 pl-3 text-left transition-colors hover:bg-papeliz-hover focus-visible:bg-papeliz-hover focus-visible:outline-none'
const papelizModelsForEachTaskRowLineClassName = 'mt-0.5 block truncate text-[12px] leading-[1.35] text-papeliz-ink-muted'

// Automatic, as a green A after the row's title. The row's button says the tooltip's words to screen
// readers and shows them on keyboard focus.
function PapelizModelsForEachTaskAutomaticMark({ automaticModelTooltipText }: { automaticModelTooltipText: string }) {
  return (
    <PapelizHoverTooltip tooltipLineTitle="Automatic" tooltipLineText={automaticModelTooltipText} className="inline-grid flex-none">
      <span
        role="img"
        aria-label="Automatic"
        data-papeliz-automatic-model-mark
        className="grid size-4 place-items-center rounded-full bg-papeliz-diff-added text-[10.5px] leading-none font-bold text-papeliz-diff-added-ink"
      >
        A
      </span>
    </PapelizHoverTooltip>
  )
}

// A model the person typed, after the row's title.
function PapelizModelsForEachTaskTypedModelTag() {
  return <span className="rounded-full bg-papeliz-blue-soft px-[7px] text-[11px] leading-[17px] font-medium whitespace-nowrap text-papeliz-blue">Typed</span>
}

// Transcribe or Draw: the model it uses now and its menu, or, when no added provider can do it, Add
// Provider. Other Model opens its form under the row.
function PapelizModelsForEachTaskRow({ assistantMediaKind, onAddProvider }: { assistantMediaKind: PapelizAssistantPickedModelMediaKind; onAddProvider: () => void }) {
  const { modelsForEachTaskRowTitle, ModelsForEachTaskRowIcon, automaticModelTooltipText, noProviderCanDoTaskLine, providersThatCanDoTaskSentence } =
    papelizModelsForEachTaskRowWords[assistantMediaKind]
  const { offeredMediaModels, chosenMediaModel, isMediaModelChosenAutomatically } = usePapelizChosenAssistantMediaModel(assistantMediaKind)
  const chooseAssistantMediaModel = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModel)
  const chooseAssistantMediaModelAutomatically = usePapelizAssistantMediaModelChoicesStore((choicesState) => choicesState.chooseAssistantMediaModelAutomatically)
  const [mediaRowMenuPosition, setMediaRowMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const [isOtherModelFormOpen, setIsOtherModelFormOpen] = useState(false)
  // The A the tooltip sits under while the row has keyboard focus.
  const [keyboardFocusedAutomaticMarkElement, setKeyboardFocusedAutomaticMarkElement] = useState<HTMLElement | null>(null)
  const hideKeyboardFocusedAutomaticTooltip = useCallback(() => setKeyboardFocusedAutomaticMarkElement(null), [])
  const modelsForEachTaskRowId = useId()
  const rowIcon = <ModelsForEachTaskRowIcon className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />

  if (chosenMediaModel === null) {
    return (
      <li>
        <button
          type="button"
          aria-label={`Add Provider for ${modelsForEachTaskRowTitle}`}
          aria-describedby={`${modelsForEachTaskRowId}-line ${modelsForEachTaskRowId}-providers`}
          title={`${noProviderCanDoTaskLine} ${providersThatCanDoTaskSentence}`}
          onClick={onAddProvider}
          className={papelizModelsForEachTaskRowButtonClassName}
        >
          {rowIcon}
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">{modelsForEachTaskRowTitle}</span>
            <span id={`${modelsForEachTaskRowId}-line`} className={papelizModelsForEachTaskRowLineClassName}>
              {noProviderCanDoTaskLine}
            </span>
          </span>
          <span title={`Add Provider for ${modelsForEachTaskRowTitle}`} className="grid flex-none place-items-center text-papeliz-blue">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </button>
        <span id={`${modelsForEachTaskRowId}-providers`} className="sr-only">
          {providersThatCanDoTaskSentence}
        </span>
      </li>
    )
  }

  const isOfferedMediaModelChosen = (offeredMediaModel: PapelizAssistantOfferedMediaModel) =>
    !isMediaModelChosenAutomatically &&
    chosenMediaModel.papelizAssistantProviderId === offeredMediaModel.papelizAssistantProviderId &&
    chosenMediaModel.providerModelName === offeredMediaModel.providerModelName
  const mediaRowMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'automatic',
      menuItemLabel: 'Automatic',
      ...(offeredMediaModels[0] === undefined ? {} : { menuItemDetailText: `${offeredMediaModels[0].providerModelName} now` }),
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
  const rowModelLineText = `${chosenMediaModel.providerModelName} · ${chosenMediaModel.providerDisplayName}`

  return (
    <li>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={mediaRowMenuPosition !== null}
        aria-describedby={isMediaModelChosenAutomatically ? `${modelsForEachTaskRowId}-automatic` : undefined}
        onClick={(rowClickEvent) => {
          setKeyboardFocusedAutomaticMarkElement(null)
          const rowRect = rowClickEvent.currentTarget.getBoundingClientRect()
          setMediaRowMenuPosition({ menuAnchorLeft: rowRect.left + 6, menuAnchorTop: rowRect.bottom + 4 })
        }}
        onFocus={(focusEvent) => {
          const automaticMarkElement = focusEvent.currentTarget.querySelector<HTMLElement>('[data-papeliz-automatic-model-mark]')
          if (automaticMarkElement === null || !focusEvent.currentTarget.matches(':focus-visible')) return
          // Focus can scroll the row into view, and the bubble closes on a scroll, so it shows a frame
          // later, once that scroll's event has passed.
          const focusedRowElement = focusEvent.currentTarget
          requestAnimationFrame(() => {
            if (document.activeElement === focusedRowElement) setKeyboardFocusedAutomaticMarkElement(automaticMarkElement)
          })
        }}
        onBlur={hideKeyboardFocusedAutomaticTooltip}
        className={joinPapelizClassNames(papelizModelsForEachTaskRowButtonClassName, mediaRowMenuPosition !== null && 'bg-papeliz-hover')}
      >
        {rowIcon}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
            {modelsForEachTaskRowTitle}
            {isMediaModelChosenAutomatically ? (
              <PapelizModelsForEachTaskAutomaticMark automaticModelTooltipText={automaticModelTooltipText} />
            ) : (
              chosenMediaModel.isMediaModelTypedByPerson && <PapelizModelsForEachTaskTypedModelTag />
            )}
          </span>
          <span title={rowModelLineText} className={papelizModelsForEachTaskRowLineClassName}>
            {rowModelLineText}
          </span>
        </span>
        <Settings className="size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
      </button>
      {isMediaModelChosenAutomatically && (
        <span id={`${modelsForEachTaskRowId}-automatic`} className="sr-only">
          {automaticModelTooltipText}
        </span>
      )}
      {keyboardFocusedAutomaticMarkElement !== null && (
        <PapelizTooltipBubble
          tooltipAnchorElement={keyboardFocusedAutomaticMarkElement}
          tooltipBubbleContent={<PapelizTooltipLine tooltipLineTitle="Automatic" tooltipLineText={automaticModelTooltipText} />}
          onTooltipBubbleLeftBehind={hideKeyboardFocusedAutomaticTooltip}
        />
      )}
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

  // Opened from a chip's "Models for Transcribe and Draw": the page comes here (when a short window
  // makes it scroll), then takes the request back.
  useEffect(() => {
    if (!isModelsForEachTaskSectionRequested) return
    const isMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    modelsForEachTaskSectionRef.current?.scrollIntoView({ block: 'start', behavior: isMotionReduced ? 'auto' : 'smooth' })
    usePapelizAssistantPanelUiStore.getState().clearAssistantModelsForEachTaskSectionRequest()
  }, [isModelsForEachTaskSectionRequested])

  return (
    <section ref={modelsForEachTaskSectionRef} aria-labelledby={modelsForEachTaskHeadingId} className="mt-3 scroll-mt-2">
      <h3 id={modelsForEachTaskHeadingId} className="text-sm font-semibold">
        Models for Transcribe and Draw
      </h3>
      <p className="mt-0.5 text-[12.5px] leading-[1.35] text-papeliz-ink-muted">Configure which AI model each task uses.</p>
      <ul aria-labelledby={modelsForEachTaskHeadingId} className="mt-2 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
        {papelizModelsForEachTaskRowKinds.map((assistantMediaKind) => (
          <PapelizModelsForEachTaskRow key={assistantMediaKind} assistantMediaKind={assistantMediaKind} onAddProvider={onAddProvider} />
        ))}
      </ul>
    </section>
  )
}
