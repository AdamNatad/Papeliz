import {
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  FileText,
  ListChecks,
  ListPlus,
  MessageCircleQuestion,
  PenLine,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SlidersHorizontal,
  Square,
  TextSelect,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { PapelizAssistantComposerAddMenu, usePapelizComposerOnePressMic } from './papeliz-assistant-composer-media-buttons'
import {
  papelizComposerEffortFoldedAttributeName,
  papelizComposerRowGiveWayClassNames,
  papelizComposerRowGroupClassName,
  usePapelizComposerRowFit,
} from './papeliz-assistant-composer-row-fit'
import { PapelizAssistantContextChoiceButton } from './papeliz-assistant-context-choice-button'
import { PapelizAssistantContextWindowGauge } from './papeliz-assistant-context-window-gauge'
import { describePapelizAssistantModelShortName, listPapelizAssistantModelNameHyphenCuts } from './papeliz-assistant-model-short-names'
import {
  describePapelizAssistantPlanComposerPlaceholder,
  selectPapelizAssistantBuildingPlanEntry,
  selectPapelizAssistantLatestPlanEntry,
  usePapelizAssistantConversationStore,
} from './papeliz-assistant-conversation-store'
import {
  PapelizOnePressMicAudioFileInput,
  PapelizOnePressMicButton,
  PapelizOnePressMicProblemLine,
  PapelizOnePressMicRecorderRow,
  handlePapelizOnePressMicKey,
  useIsPapelizOnePressMicBusy,
} from './papeliz-assistant-one-press-mic'
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
import { usePapelizAssistantRunOptionsStore, type PapelizAssistantMode, type PapelizAssistantReasoningEffort } from './papeliz-assistant-run-options-store'

const papelizAssistantReasoningEffortChoices: ReadonlyArray<{
  assistantReasoningEffort: PapelizAssistantReasoningEffort
  reasoningEffortLabel: string
  ReasoningEffortIcon: typeof SignalLow
}> = [
  { assistantReasoningEffort: 'low', reasoningEffortLabel: 'Low', ReasoningEffortIcon: SignalLow },
  { assistantReasoningEffort: 'medium', reasoningEffortLabel: 'Medium', ReasoningEffortIcon: SignalMedium },
  { assistantReasoningEffort: 'high', reasoningEffortLabel: 'High', ReasoningEffortIcon: SignalHigh },
]

// The modes, for Focus mode's box, which has no switch above it: a quiet chip opens them as a menu.
const papelizAssistantComposerModeChoices: ReadonlyArray<{
  assistantMode: PapelizAssistantMode
  assistantModeLabel: string
  AssistantModeIcon: typeof SignalLow
}> = [
  { assistantMode: 'ask', assistantModeLabel: 'Ask', AssistantModeIcon: MessageCircleQuestion },
  { assistantMode: 'plan', assistantModeLabel: 'Plan', AssistantModeIcon: ListChecks },
  { assistantMode: 'write', assistantModeLabel: 'Write', AssistantModeIcon: PenLine },
]

// The quiet text buttons along the bottom of the box; on a touch screen at least 40px each way, for a
// finger, even when a narrow box shows only the icon.
const papelizComposerQuietButtonClassName = joinPapelizClassNames(
  'flex h-7 min-w-0 flex-none items-center gap-1 rounded-lg px-1.5 text-[12.5px] text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:bg-papeliz-hover pointer-coarse:h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center',
  papelizComposerRowGiveWayClassNames.quietButtonTight,
)

// Which of the composer's chip menus is open, and where.
// The model's menu carries Effort while the row has folded the Effort chip into it.
type PapelizComposerChipMenu = {
  composerChipMenuKind: 'model' | 'effort' | 'permission' | 'mode'
  composerChipMenuPosition: PapelizPopoverMenuPosition
  isReasoningEffortInModelMenu: boolean
}

// The popover menu's rows (h-9), a group heading with its line, and its padding, so a menu that opens
// above its chip can be placed before it is drawn.
const papelizComposerChipMenuRowHeight = 36
const papelizComposerChipMenuGroupHeadingHeight = 30
const papelizComposerChipMenuFrameHeight = 10

interface PapelizAssistantComposerProps {
  // `floating` is focus mode's large composer at the bottom of the note.
  composerPlacement: 'panel' | 'floating'
}

// Where the user writes to the assistant, laid out compactly: the text, then one row of
// quiet buttons. On the left: + (a menu: add files and pictures, which can also be pasted or dropped
// on the box, transcribe an audio file, or imagine a picture of what is typed), what the assistant
// will see (a menu: this note, the open notes, chosen notes, a folder or the vault) and, in Write,
// whether its changes wait for review or apply at once (Bypass permission, in red). On the right: the
// context ring and its card, the model (a menu of every model switched on in Settings › AI Provider,
// by provider), how hard it thinks (Effort, left out for a model that refused it), the one-press mic
// and Send. A narrow row gives way in measured steps (papeliz-assistant-composer-row-fit.ts). One press on the mic turns the row into the
// recorder (papeliz-assistant-one-press-mic.tsx), and the words land after what is typed. Enter
// sends, Shift+Enter starts a new line. While the assistant answers, Enter steers it (it reads the
// message before its next step), and Queue keeps the message for when the answer ends. Before a
// provider is set up the box still shows, with a line to choose one. In Plan the prompt follows the
// plan on screen (a change to it, or steering its build), and Focus mode's box carries a quiet mode chip,
// since Focus mode has no switch.
export function PapelizAssistantComposer({ composerPlacement }: PapelizAssistantComposerProps) {
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const composerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.composerDraftText)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const assistantContextMode = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantContextMode)
  const pendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.pendingSelectionContext)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const stopAssistant = usePapelizAssistantConversationStore((conversationState) => conversationState.stopAssistant)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const setPendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.setPendingSelectionContext)
  const activeVaultMarkdownNoteRelativePath = usePapelizWorkspaceStore(selectActiveVaultMarkdownNoteRelativePath)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderId)
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderModelName)
  const providerSettingsByProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const chooseActiveAssistantProviderModel = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.chooseActiveAssistantProviderModel)
  const queuedAssistantMessages = usePapelizAssistantConversationStore((conversationState) => conversationState.queuedAssistantMessages)
  const steerAssistant = usePapelizAssistantConversationStore((conversationState) => conversationState.steerAssistant)
  const queueAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.queueAssistantMessage)
  const removeQueuedAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.removeQueuedAssistantMessage)
  const sendQueuedAssistantMessageNow = usePapelizAssistantConversationStore((conversationState) => conversationState.sendQueuedAssistantMessageNow)
  const isAssistantQuestionOpen = usePapelizAssistantConversationStore((conversationState) =>
    conversationState.chatEntries.some((chatEntry) => chatEntry.chatEntryKind === 'question' && chatEntry.questionAnswerText === null),
  )
  const assistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantMode)
  const setAssistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantMode)
  const isAssistantPlanBuilding = usePapelizAssistantConversationStore((conversationState) => selectPapelizAssistantBuildingPlanEntry(conversationState) !== null)
  const assistantPlanComposerPlaceholder = usePapelizAssistantConversationStore((conversationState) =>
    describePapelizAssistantPlanComposerPlaceholder(selectPapelizAssistantLatestPlanEntry(conversationState)),
  )
  const assistantReasoningEffort = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantReasoningEffort)
  const assistantChangePermission = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantChangePermission)
  const setAssistantReasoningEffort = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantReasoningEffort)
  const setAssistantChangePermission = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantChangePermission)
  const isReasoningEffortRefusedByModel = usePapelizAssistantRunOptionsStore((runOptionsState) =>
    runOptionsState.providerModelNamesRefusingReasoningEffort.includes(activeProviderModelName),
  )
  const [openComposerChipMenu, setOpenComposerChipMenu] = useState<PapelizComposerChipMenu | null>(null)
  const pendingAssistantAttachments = usePapelizAssistantConversationStore((conversationState) => conversationState.pendingAssistantAttachments)
  const addAssistantAttachmentFiles = usePapelizAssistantConversationStore((conversationState) => conversationState.addAssistantAttachmentFiles)
  const removePendingAssistantAttachment = usePapelizAssistantConversationStore((conversationState) => conversationState.removePendingAssistantAttachment)
  const attachmentFileInputRef = useRef<HTMLInputElement>(null)
  const [isFileDraggedOverComposer, setIsFileDraggedOverComposer] = useState(false)
  const composerFocusRequestCount = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.composerFocusRequestCount)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const requestAssistantModelsForEachTaskSection = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantModelsForEachTaskSection)

  const audioFileInputRef = useRef<HTMLInputElement>(null)
  // After the words land, the box takes focus with the caret after them, ready to send.
  const composerOnePressMicStore = usePapelizComposerOnePressMic(() =>
    requestAnimationFrame(() => {
      const composerTextArea = composerTextAreaRef.current
      if (composerTextArea === null) return
      composerTextArea.focus()
      composerTextArea.setSelectionRange(composerTextArea.value.length, composerTextArea.value.length)
    }),
  )
  const isComposerMicBusy = useIsPapelizOnePressMicBusy(composerOnePressMicStore)
  // The settings above are read, so this follows the provider as it is set up.
  const isAssistantProviderReady = getActivePapelizAssistantProviderConnection().providerConnectionOutcome === 'ready'

  useEffect(() => {
    if (composerFocusRequestCount > 0) composerTextAreaRef.current?.focus()
  }, [composerFocusRequestCount])

  useEffect(() => {
    // The text area grows with what is typed, up to a few lines.
    const composerTextArea = composerTextAreaRef.current
    if (composerTextArea === null) return
    composerTextArea.style.height = 'auto'
    composerTextArea.style.height = `${Math.min(composerTextArea.scrollHeight, composerPlacement === 'floating' ? 200 : 160)}px`
  }, [composerDraftText, composerPlacement])

  // Enter sends, or steers the answer running now. Nothing goes while the mic records or transcribes,
  // or before a provider is set up.
  const sendComposerDraft = () => {
    if (isComposerMicBusy || !isAssistantProviderReady) return
    if (isAssistantRunning) steerAssistant(composerDraftText)
    else void sendAssistantMessage(composerDraftText)
  }
  // The prompt names what the assistant sees: this note, the notes chosen, or the vault.
  const isNoteContextShown = assistantContextMode === 'active-note' && activeVaultMarkdownNoteRelativePath !== null
  const areChosenNotesShown = assistantContextMode === 'open-notes' || assistantContextMode === 'selected-notes' || assistantContextMode === 'folder'
  // The strip along the box's top edge where the "sees" pickers and the context ring's card open.
  const [composerBoxTopEdgeStripElement, setComposerBoxTopEdgeStripElement] = useState<HTMLDivElement | null>(null)
  const providerChipLabel = activeProviderModelName || findPapelizAssistantProviderPreset(activeAssistantProviderId).providerPresetDisplayName
  // The models on the model chip's menu: each saved provider's switched-on models, under its name.
  const enabledProviderModelGroups = listPapelizSavedAssistantProviderIds(providerSettingsByProviderId)
    .map((savedProviderId) => ({
      papelizAssistantProviderId: savedProviderId,
      enabledProviderModelNames: listPapelizEnabledProviderModelNames(providerSettingsByProviderId[savedProviderId]),
    }))
    .filter((enabledProviderModelGroup) => enabledProviderModelGroup.enabledProviderModelNames.length > 0)
  const isComposerDraftEmpty = composerDraftText.trim().length === 0 && pendingAssistantAttachments.length === 0
  const isModelChipSteppingAside = isAssistantRunning && !isComposerDraftEmpty
  // The model chip's shorter names, for a narrow row.
  const providerChipShortName = describePapelizAssistantModelShortName(providerChipLabel)
  const providerChipNameCuts = listPapelizAssistantModelNameHyphenCuts(providerChipShortName.modelShortName)
  const composerRowRef = useRef<HTMLDivElement>(null)
  usePapelizComposerRowFit(composerRowRef)
  const isBypassPermissionOn = assistantChangePermission === 'bypass-permission'
  const chosenReasoningEffortChoice =
    papelizAssistantReasoningEffortChoices.find((reasoningEffortChoice) => reasoningEffortChoice.assistantReasoningEffort === assistantReasoningEffort) ??
    papelizAssistantReasoningEffortChoices[1]!
  const ChosenReasoningEffortIcon = chosenReasoningEffortChoice.ReasoningEffortIcon
  const chosenComposerModeChoice =
    papelizAssistantComposerModeChoices.find((modeChoice) => modeChoice.assistantMode === assistantMode) ?? papelizAssistantComposerModeChoices[0]!
  const ChosenComposerModeIcon = chosenComposerModeChoice.AssistantModeIcon

  const openComposerChipMenuBelow = (composerChipMenuKind: PapelizComposerChipMenu['composerChipMenuKind'], clickEvent: MouseEvent<HTMLButtonElement>) => {
    const chipRect = clickEvent.currentTarget.getBoundingClientRect()
    const isReasoningEffortInModelMenu =
      composerChipMenuKind === 'model' && !isReasoningEffortRefusedByModel && composerRowRef.current?.hasAttribute(papelizComposerEffortFoldedAttributeName) === true
    // The menu opens above the chip; the popover keeps it inside the window. Its Settings group holds
    // two rows, and Effort its choices when it is folded in.
    const modelMenuHeight =
      (enabledProviderModelGroups.reduce((modelRowCount, enabledProviderModelGroup) => modelRowCount + enabledProviderModelGroup.enabledProviderModelNames.length, 0) +
        2 +
        (isReasoningEffortInModelMenu ? papelizAssistantReasoningEffortChoices.length : 0)) *
        papelizComposerChipMenuRowHeight +
      (enabledProviderModelGroups.length + 1 + (isReasoningEffortInModelMenu ? 1 : 0)) * papelizComposerChipMenuGroupHeadingHeight +
      papelizComposerChipMenuFrameHeight
    setOpenComposerChipMenu({
      composerChipMenuKind,
      composerChipMenuPosition: { menuAnchorLeft: chipRect.left, menuAnchorTop: chipRect.top - (composerChipMenuKind === 'model' ? modelMenuHeight + 6 : 150) },
      isReasoningEffortInModelMenu,
    })
  }
  const reasoningEffortMenuItems: PapelizPopoverMenuItem[] = papelizAssistantReasoningEffortChoices.map((reasoningEffortChoice, reasoningEffortChoiceIndex) => ({
    menuItemKey: reasoningEffortChoice.assistantReasoningEffort,
    menuItemLabel: reasoningEffortChoice.reasoningEffortLabel,
    MenuItemIcon: reasoningEffortChoice.ReasoningEffortIcon,
    isMenuItemChecked: reasoningEffortChoice.assistantReasoningEffort === assistantReasoningEffort,
    ...(reasoningEffortChoiceIndex === 0 ? { menuItemGroupHeading: 'Effort' } : {}),
    onMenuItemSelect: () => setAssistantReasoningEffort(reasoningEffortChoice.assistantReasoningEffort),
  }))
  const isActiveProviderModel = (papelizAssistantProviderId: string, providerModelName: string) =>
    papelizAssistantProviderId === activeAssistantProviderId && providerModelName === activeProviderModelName
  const composerChipMenuItems: PapelizPopoverMenuItem[] =
    openComposerChipMenu?.composerChipMenuKind === 'model'
      ? [
          ...enabledProviderModelGroups.flatMap((enabledProviderModelGroup) =>
            enabledProviderModelGroup.enabledProviderModelNames.map((enabledProviderModelName, enabledProviderModelIndex) => ({
              menuItemKey: `${enabledProviderModelGroup.papelizAssistantProviderId}/${enabledProviderModelName}`,
              menuItemLabel: enabledProviderModelName,
              isMenuItemChecked: isActiveProviderModel(enabledProviderModelGroup.papelizAssistantProviderId, enabledProviderModelName),
              ...(enabledProviderModelIndex === 0
                ? { menuItemGroupHeading: findPapelizAssistantProviderPreset(enabledProviderModelGroup.papelizAssistantProviderId).providerPresetDisplayName }
                : {}),
              onMenuItemSelect: () => {
                if (isActiveProviderModel(enabledProviderModelGroup.papelizAssistantProviderId, enabledProviderModelName)) return
                void chooseActiveAssistantProviderModel({
                  papelizAssistantProviderId: enabledProviderModelGroup.papelizAssistantProviderId,
                  providerModelName: enabledProviderModelName,
                }).catch(() => undefined)
              },
            })),
          ),
          ...(openComposerChipMenu.isReasoningEffortInModelMenu ? reasoningEffortMenuItems : []),
          {
            menuItemKey: 'ai-provider-settings',
            menuItemLabel: 'AI Provider',
            MenuItemIcon: Settings,
            menuItemGroupHeading: 'Settings',
            onMenuItemSelect: () => requestAssistantProviderSettingsPage(),
          },
          // Settings › AI Provider, scrolled to the models each task uses (this chip's is Chat's).
          {
            menuItemKey: 'models-for-each-task',
            menuItemLabel: 'Models for Each Task',
            MenuItemIcon: SlidersHorizontal,
            onMenuItemSelect: () => requestAssistantModelsForEachTaskSection(),
          },
        ]
      : openComposerChipMenu?.composerChipMenuKind === 'mode'
      ? papelizAssistantComposerModeChoices.map((modeChoice, modeChoiceIndex) => ({
          menuItemKey: modeChoice.assistantMode,
          menuItemLabel: modeChoice.assistantModeLabel,
          MenuItemIcon: modeChoice.AssistantModeIcon,
          isMenuItemChecked: modeChoice.assistantMode === assistantMode,
          ...(modeChoiceIndex === 0 ? { menuItemGroupHeading: 'Mode' } : {}),
          onMenuItemSelect: () => setAssistantMode(modeChoice.assistantMode),
        }))
      : openComposerChipMenu?.composerChipMenuKind === 'effort'
      ? reasoningEffortMenuItems
      : [
          {
            menuItemKey: 'review-changes',
            menuItemLabel: 'Review Changes',
            MenuItemIcon: ShieldCheck,
            isMenuItemChecked: !isBypassPermissionOn,
            menuItemGroupHeading: 'In Write',
            onMenuItemSelect: () => setAssistantChangePermission('review-changes'),
          },
          {
            menuItemKey: 'bypass-permission',
            menuItemLabel: 'Bypass Permission',
            MenuItemIcon: ShieldAlert,
            isMenuItemChecked: isBypassPermissionOn,
            isDangerousMenuItem: true,
            onMenuItemSelect: () => setAssistantChangePermission('bypass-permission'),
          },
        ]

  // Send (or, while the assistant answers, Queue, Steer and Stop). While the mic is busy they stay in
  // place, held, so ✓ lands on the mic's own spot; Stop still stops.
  const composerSendControls =
    isAssistantRunning ? (
      <span className={joinPapelizClassNames('ml-1 flex flex-none items-center gap-1.5', papelizComposerRowGiveWayClassNames.sendButtonGap)}>
        {!isComposerDraftEmpty && (
          <>
            <PapelizPillButton
              pillButtonVariant="line"
              pillButtonSize="small"
              aria-label="Queue"
              title="Queue: send when the answer ends"
              disabled={isComposerMicBusy}
              onClick={() => queueAssistantMessage(composerDraftText)}
              className={papelizComposerRowGiveWayClassNames.queueAndSteerPill}
            >
              <ListPlus className="size-3.5" aria-hidden="true" />
              <span data-papeliz-composer-give-way-label="steer" className={papelizComposerRowGiveWayClassNames.queueAndSteerLabel}>
                Queue
              </span>
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="primary"
              pillButtonSize="small"
              aria-label="Steer"
              title="Steer: read before the assistant’s next step (Enter)"
              disabled={isComposerMicBusy}
              onClick={sendComposerDraft}
              className={papelizComposerRowGiveWayClassNames.queueAndSteerPill}
            >
              <span data-papeliz-composer-give-way-label="steer" className={papelizComposerRowGiveWayClassNames.queueAndSteerLabel}>
                Steer
              </span>
              <CornerDownLeft className="size-3.5" aria-hidden="true" />
            </PapelizPillButton>
          </>
        )}
        <button
          type="button"
          aria-label="Stop"
          title="Stop"
          onClick={stopAssistant}
          className={joinPapelizClassNames(
            'grid size-8 flex-none place-items-center rounded-full bg-papeliz-ink text-papeliz-surface transition-transform active:scale-90 pointer-coarse:size-10',
            papelizComposerRowGiveWayClassNames.roundButtonSmall,
          )}
        >
          <Square className="size-3.5 fill-current" aria-hidden="true" />
        </button>
      </span>
    ) : (
      <button
        type="button"
        aria-label="Send"
        title={isAssistantProviderReady ? 'Send (Enter)' : 'Choose a provider first'}
        disabled={isComposerDraftEmpty || isComposerMicBusy || !isAssistantProviderReady}
        onClick={sendComposerDraft}
        className={joinPapelizClassNames(
          'ml-1 grid size-8 flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity,background-color] hover:brightness-95 active:scale-90 disabled:opacity-40 pointer-coarse:size-10',
          papelizComposerRowGiveWayClassNames.sendButtonGap,
          papelizComposerRowGiveWayClassNames.roundButtonSmall,
        )}
      >
        <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
      </button>
    )

  return (
    <>
      {/* Along the box's top edge: the "sees" pickers and the ring's card open here, over the conversation. */}
      <div ref={setComposerBoxTopEdgeStripElement} className="relative z-30 h-0" />
      <div
        // While the mic records, Enter finishes and Esc throws the recording away, wherever focus is.
        onKeyDown={(keyboardEvent) => void handlePapelizOnePressMicKey(keyboardEvent, composerOnePressMicStore)}
        onDragOver={(dragEvent) => {
          if (!dragEvent.dataTransfer.types.includes('Files')) return
          dragEvent.preventDefault()
          dragEvent.dataTransfer.dropEffect = 'copy'
          setIsFileDraggedOverComposer(true)
        }}
        onDragLeave={(dragEvent) => {
          if (!dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) setIsFileDraggedOverComposer(false)
        }}
        onDrop={(dropEvent) => {
          if (dropEvent.dataTransfer.files.length === 0) return
          dropEvent.preventDefault()
          setIsFileDraggedOverComposer(false)
          void addAssistantAttachmentFiles([...dropEvent.dataTransfer.files])
        }}
        // In the panel a hairline frame on the white page, with no shadow; floating over the note in Focus
        // mode it keeps its lift.
        className={joinPapelizClassNames(
          'rounded-[20px] border border-papeliz-line-strong bg-papeliz-surface pt-2.5 pr-2 pb-2 pl-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-papeliz-blue-line',
          composerPlacement === 'floating'
            ? 'shadow-papeliz-pop focus-within:shadow-[0_0_0_4px_var(--color-papeliz-blue-soft),var(--shadow-papeliz-pop)]'
            : 'focus-within:shadow-[0_0_0_4px_var(--color-papeliz-blue-soft)]',
          isFileDraggedOverComposer && 'border-papeliz-blue shadow-[0_0_0_4px_var(--color-papeliz-blue-soft)]',
          isComposerMicBusy && 'border-papeliz-blue-line shadow-[0_0_0_4px_var(--color-papeliz-blue-soft)]',
        )}
      >
        {/* Before a provider is set up the box still shows, mic and all, with the way to set one up. */}
        {!isAssistantProviderReady && (
          <div className="mb-2 -ml-1.5 flex items-center gap-2 rounded-2xl bg-papeliz-blue-soft py-1.5 pr-1.5 pl-2.5 text-[13px] leading-snug text-papeliz-ink-muted">
            <WandSparkles className="size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />
            <span className="min-w-0 flex-1">Choose a provider to type or speak</span>
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => requestAssistantProviderSettingsPage()}>
              Choose a Provider
            </PapelizPillButton>
          </div>
        )}
        {queuedAssistantMessages.length > 0 && (
          <div className="papeliz-pop-enter mb-2 flex flex-col gap-1 rounded-2xl bg-papeliz-surface-soft px-2.5 py-2">
            <span className="px-1 text-[11.5px] font-semibold text-papeliz-ink-subtle">Queued ({queuedAssistantMessages.length})</span>
            {queuedAssistantMessages.map((queuedMessage) => (
              <div key={queuedMessage.queuedMessageId} className="flex items-center gap-1.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate px-1 text-papeliz-ink" title={queuedMessage.queuedMessageText}>
                  {queuedMessage.queuedMessageText}
                </span>
                <button
                  type="button"
                  onClick={() => sendQueuedAssistantMessageNow(queuedMessage.queuedMessageId)}
                  className="flex-none rounded-full px-2 py-0.5 text-[12px] font-medium text-papeliz-blue hover:bg-papeliz-blue-soft"
                >
                  Send Now
                </button>
                <PapelizIconButton
                  iconButtonLabel={`Remove “${queuedMessage.queuedMessageText}” from the Queue`}
                  iconButtonSize="extra-small"
                  onClick={() => removeQueuedAssistantMessage(queuedMessage.queuedMessageId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </PapelizIconButton>
              </div>
            ))}
          </div>
        )}
        {pendingAssistantAttachments.length > 0 && (
          <ul aria-label="Added files" className="mb-2 flex flex-wrap gap-1.5">
            {pendingAssistantAttachments.map((pendingAttachment) => (
              <li
                key={pendingAttachment.assistantAttachmentId}
                className="papeliz-pop-enter flex h-8 max-w-[220px] items-center gap-1.5 rounded-xl border border-papeliz-line bg-papeliz-surface-soft py-0 pr-1 pl-1 text-[12.5px]"
              >
                {pendingAttachment.attachmentImageDataUrl !== null ? (
                  <img src={pendingAttachment.attachmentImageDataUrl} alt="" className="size-6 flex-none rounded-md object-cover" />
                ) : (
                  <FileText className="ml-1 size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
                )}
                <span className="min-w-0 truncate" title={pendingAttachment.attachmentFileName}>
                  {pendingAttachment.attachmentFileName}
                </span>
                <PapelizIconButton
                  iconButtonLabel={`Remove ${pendingAttachment.attachmentFileName}`}
                  iconButtonSize="extra-small"
                  onClick={() => removePendingAssistantAttachment(pendingAttachment.assistantAttachmentId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </PapelizIconButton>
              </li>
            ))}
          </ul>
        )}
        {pendingSelectionContext !== null && (
          <div className="papeliz-pop-enter mb-2 flex items-start gap-2 rounded-2xl bg-papeliz-blue-soft px-3 py-2 text-[13px] text-papeliz-blue">
            <TextSelect className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
            <span className="line-clamp-2 min-w-0 flex-1 text-papeliz-ink-muted">
              <b className="font-semibold text-papeliz-blue">Selection · </b>
              {pendingSelectionContext.selectedText}
            </span>
            <PapelizIconButton iconButtonLabel="Remove the Selection" iconButtonSize="extra-small" onClick={() => setPendingSelectionContext(null)}>
              <X className="size-3" aria-hidden="true" />
            </PapelizIconButton>
          </div>
        )}
        <textarea
          ref={composerTextAreaRef}
          rows={composerPlacement === 'floating' ? 2 : 1}
          value={composerDraftText}
          aria-label="Message the assistant"
          placeholder={
            isAssistantRunning
              ? isAssistantPlanBuilding
                ? 'Steer the build, or queue a message'
                : 'Steer the answer, or queue a message'
              : isAssistantQuestionOpen
                ? 'Pick an answer above, or write your own'
                : // The prompt follows the mode: only Write changes notes. In Plan it follows the plan too.
                  assistantMode === 'write'
                  ? isNoteContextShown
                    ? 'Ask for a change to this note'
                    : areChosenNotesShown
                      ? 'Ask for a change to these notes'
                      : 'Ask for a change'
                  : assistantMode === 'plan'
                    ? (assistantPlanComposerPlaceholder ?? 'Describe what to plan')
                    : isNoteContextShown
                      ? 'Ask about this note'
                      : areChosenNotesShown
                        ? 'Ask about these notes'
                        : 'Ask about your notes'
          }
          onChange={(changeEvent) => setComposerDraftText(changeEvent.target.value)}
          // A pasted picture or file is added to the message.
          onPaste={(pasteEvent) => {
            if (pasteEvent.clipboardData.files.length === 0) return
            pasteEvent.preventDefault()
            void addAssistantAttachmentFiles([...pasteEvent.clipboardData.files])
          }}
          // What is typed stays in view while the mic records; the words then land after it.
          readOnly={isComposerMicBusy}
          onKeyDown={(keyboardEvent) => {
            // While the mic is busy, Enter and Esc belong to it (the box's own key handler, above).
            if (isComposerMicBusy) return
            if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey && !keyboardEvent.nativeEvent.isComposing) {
              keyboardEvent.preventDefault()
              sendComposerDraft()
            }
          }}
          className={joinPapelizClassNames(
            'block min-h-6 w-full resize-none bg-transparent text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle',
            composerPlacement === 'floating' ? 'text-[16px] leading-relaxed' : 'text-[14.5px] leading-normal',
          )}
        />
        {/* When the row is narrow its buttons give way in measured steps (papeliz-assistant-composer-row-fit.ts). */}
        <div
          ref={composerRowRef}
          data-papeliz-composer-row
          className={joinPapelizClassNames(papelizComposerRowGroupClassName, 'mt-1.5 flex min-w-0 items-center gap-0.5 data-[papeliz-composer-gaps-tight]:gap-0')}
        >
          <input
            ref={attachmentFileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,text/*,.md,.markdown,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.js,.ts,.tsx,.py,.sql,.log"
            className="hidden"
            onChange={(changeEvent) => {
              void addAssistantAttachmentFiles([...(changeEvent.target.files ?? [])])
              changeEvent.target.value = ''
            }}
          />
          {isComposerMicBusy ? (
            <PapelizOnePressMicRecorderRow onePressMicStore={composerOnePressMicStore} trailingControls={composerSendControls} />
          ) : (
            <>
              <PapelizAssistantComposerAddMenu
                onAddFilesOrPictures={() => attachmentFileInputRef.current?.click()}
                onTranscribeAudioFile={() => audioFileInputRef.current?.click()}
              />
              <PapelizAssistantContextChoiceButton
                contextChoiceButtonClassName={joinPapelizClassNames(papelizComposerQuietButtonClassName, 'max-w-56')}
                contextPickerSheetHostElement={composerBoxTopEdgeStripElement}
              />
              {composerPlacement === 'floating' && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openComposerChipMenu?.composerChipMenuKind === 'mode'}
                  aria-label={`Mode: ${chosenComposerModeChoice.assistantModeLabel}`}
                  onClick={(clickEvent) => openComposerChipMenuBelow('mode', clickEvent)}
                  title="Mode: Ask answers, Plan writes steps to build, Write changes notes. Click to change."
                  className={papelizComposerQuietButtonClassName}
                >
                  <ChosenComposerModeIcon className="size-3.5 flex-none" aria-hidden="true" />
                  <span data-papeliz-composer-give-way-label="mode" className={papelizComposerRowGiveWayClassNames.contextChoiceLabel}>
                    {chosenComposerModeChoice.assistantModeLabel}
                  </span>
                  <ChevronDown data-papeliz-composer-give-way-chevron className={joinPapelizClassNames('size-3 flex-none opacity-70', papelizComposerRowGiveWayClassNames.chipChevron)} aria-hidden="true" />
                </button>
              )}
              {assistantMode === 'write' && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openComposerChipMenu?.composerChipMenuKind === 'permission'}
                  aria-label={isBypassPermissionOn ? 'Changes in Write: Bypass Permission' : 'Changes in Write: Review Changes'}
                  onClick={(clickEvent) => openComposerChipMenuBelow('permission', clickEvent)}
                  title={isBypassPermissionOn ? 'Bypass permission: changes apply at once. Click to change.' : 'Review changes: each change waits for you. Click to change.'}
                  className={joinPapelizClassNames(
                    papelizComposerQuietButtonClassName,
                    isBypassPermissionOn && 'font-medium text-papeliz-error-notice-icon hover:text-papeliz-error-notice-icon',
                  )}
                >
                  {isBypassPermissionOn ? <ShieldAlert className="size-3.5 flex-none" aria-hidden="true" /> : <ShieldCheck className="size-3.5 flex-none" aria-hidden="true" />}
                  {isBypassPermissionOn ? (
                    <span>Bypass</span>
                  ) : (
                    <span data-papeliz-composer-give-way-label="review" className={papelizComposerRowGiveWayClassNames.contextChoiceLabel}>
                      Review
                    </span>
                  )}
                </button>
              )}
              <span className="min-w-1 flex-1" />
              <PapelizAssistantContextWindowGauge contextWindowCardHostElement={composerBoxTopEdgeStripElement} />
              {/* With a model switched on, a menu of them all; until then, Settings › AI Provider. */}
              <button
                type="button"
                aria-haspopup={enabledProviderModelGroups.length > 0 ? 'menu' : undefined}
                aria-expanded={enabledProviderModelGroups.length > 0 ? openComposerChipMenu?.composerChipMenuKind === 'model' : undefined}
                aria-label={activeProviderModelName.length > 0 ? `Model: ${activeProviderModelName}` : undefined}
                onClick={(clickEvent) => (enabledProviderModelGroups.length > 0 ? openComposerChipMenuBelow('model', clickEvent) : requestAssistantProviderSettingsPage())}
                title={`${providerChipLabel}${providerChipShortName.isContributorModel ? ' (Contributor mode)' : ''}. Click to change.`}
                {...(isModelChipSteppingAside ? { 'data-papeliz-composer-model-chip-steps-aside': '' } : {})}
                className={joinPapelizClassNames(
                  papelizComposerQuietButtonClassName,
                  'max-w-56',
                  isModelChipSteppingAside && papelizComposerRowGiveWayClassNames.modelChipSteppingAside,
                )}
              >
                <span
                  data-papeliz-composer-model-full-name
                  {...(providerChipShortName.modelShortName === providerChipLabel ? { 'data-papeliz-composer-model-name-same-as-short': '' } : {})}
                  className={joinPapelizClassNames('truncate', papelizComposerRowGiveWayClassNames.modelChipFullName)}
                >
                  {providerChipLabel}
                </span>
                <span className={joinPapelizClassNames('truncate', papelizComposerRowGiveWayClassNames.modelChipShortName)}>{providerChipShortName.modelShortName}</span>
                {/* Filled by the row's last step, one hyphen part shorter at a time. */}
                {providerChipNameCuts.length > 0 && (
                  <span
                    data-papeliz-composer-model-name-cut
                    data-papeliz-composer-model-name-cuts={JSON.stringify(providerChipNameCuts)}
                    className={papelizComposerRowGiveWayClassNames.modelChipNameCut}
                  />
                )}
                {providerChipShortName.isContributorModel && (
                  <span
                    aria-hidden="true"
                    className={joinPapelizClassNames(
                      'rounded-[5px] border border-papeliz-line-strong px-1 py-0.5 text-[10px] leading-none font-bold text-papeliz-ink-muted',
                      papelizComposerRowGiveWayClassNames.modelChipContributorTag,
                    )}
                  >
                    C
                  </span>
                )}
                <ChevronDown data-papeliz-composer-give-way-chevron className={joinPapelizClassNames('size-3 flex-none opacity-70', papelizComposerRowGiveWayClassNames.chipChevron)} aria-hidden="true" />
              </button>
              {!isReasoningEffortRefusedByModel && (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openComposerChipMenu?.composerChipMenuKind === 'effort'}
                  onClick={(clickEvent) => openComposerChipMenuBelow('effort', clickEvent)}
                  aria-label={`Effort: ${chosenReasoningEffortChoice.reasoningEffortLabel}`}
                  title="Effort: how long the model thinks before it answers. Click to change."
                  data-papeliz-composer-effort-chip
                  className={joinPapelizClassNames(papelizComposerQuietButtonClassName, papelizComposerRowGiveWayClassNames.effortChip)}
                >
                  <ChosenReasoningEffortIcon className="size-3.5 flex-none" aria-hidden="true" />
                  <span data-papeliz-composer-give-way-label="effort" className={papelizComposerRowGiveWayClassNames.effortChipLabel}>
                    {chosenReasoningEffortChoice.reasoningEffortLabel}
                  </span>
                  <ChevronDown data-papeliz-composer-give-way-chevron className={joinPapelizClassNames('size-3 flex-none opacity-70', papelizComposerRowGiveWayClassNames.chipChevron)} aria-hidden="true" />
                </button>
              )}
              <PapelizOnePressMicButton
                onePressMicStore={composerOnePressMicStore}
                micButtonClassName={papelizComposerRowGiveWayClassNames.roundButtonSmall}
                // Before a provider is set up there is nothing to send the words to: the mic opens the settings.
                onMicPressInstead={isAssistantProviderReady ? undefined : () => requestAssistantProviderSettingsPage()}
              />
              {composerSendControls}
            </>
          )}
        </div>
        {openComposerChipMenu !== null && (
          <PapelizPopoverMenu
            menuLabel={
              openComposerChipMenu.composerChipMenuKind === 'model'
                ? 'Model'
                : openComposerChipMenu.composerChipMenuKind === 'effort'
                  ? 'Effort'
                  : openComposerChipMenu.composerChipMenuKind === 'mode'
                    ? 'Mode'
                    : 'Changes in Write'
            }
            menuPosition={openComposerChipMenu.composerChipMenuPosition}
            menuItems={composerChipMenuItems}
            onMenuClose={() => setOpenComposerChipMenu(null)}
          />
        )}
      </div>
      <PapelizOnePressMicAudioFileInput
        onePressMicStore={composerOnePressMicStore}
        audioFileInputRef={audioFileInputRef}
        audioFileInputLabel="Transcribe an audio file into the chat box"
      />
      <PapelizOnePressMicProblemLine
        onePressMicStore={composerOnePressMicStore}
        onBringAudioFile={() => audioFileInputRef.current?.click()}
        onChooseProvider={() => requestAssistantProviderSettingsPage()}
        // In Focus mode the line sits over the note, so it gets its own ground.
        className={composerPlacement === 'floating' ? 'mt-2 rounded-2xl bg-papeliz-surface px-3 py-2 shadow-papeliz-card' : 'mt-1.5 px-2'}
      />
    </>
  )
}
