import {
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  FileText,
  Library,
  ListPlus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Square,
  TextSelect,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { PapelizAssistantContextWindowGauge } from './papeliz-assistant-context-window-gauge'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore, type PapelizAssistantReasoningEffort } from './papeliz-assistant-run-options-store'

const papelizAssistantReasoningEffortChoices: ReadonlyArray<{
  assistantReasoningEffort: PapelizAssistantReasoningEffort
  reasoningEffortLabel: string
  ReasoningEffortIcon: typeof SignalLow
}> = [
  { assistantReasoningEffort: 'low', reasoningEffortLabel: 'Low', ReasoningEffortIcon: SignalLow },
  { assistantReasoningEffort: 'medium', reasoningEffortLabel: 'Medium', ReasoningEffortIcon: SignalMedium },
  { assistantReasoningEffort: 'high', reasoningEffortLabel: 'High', ReasoningEffortIcon: SignalHigh },
]

// The quiet text buttons along the bottom of the box.
const papelizComposerQuietButtonClassName =
  'flex h-7 min-w-0 flex-none items-center gap-1 rounded-lg px-1.5 text-[12.5px] text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:bg-papeliz-hover'

// Which of the composer's chip menus is open, and where.
type PapelizComposerChipMenu = { composerChipMenuKind: 'effort' | 'permission'; composerChipMenuPosition: PapelizPopoverMenuPosition }

interface PapelizAssistantComposerProps {
  // `floating` is focus mode's large composer at the bottom of the note.
  composerPlacement: 'panel' | 'floating'
}

// Where the user writes to the assistant, laid out compactly: the text, then one row of
// quiet buttons. On the left: + (add files and pictures, which can also be pasted or dropped on the
// box), what the assistant will see (this note, or the vault) and, in Write, whether its changes
// wait for review or apply at once (Bypass permission, in red). On the right: the context gauge,
// the model, how hard it thinks (Effort, left out for a model that refused it) and Send. Enter
// sends, Shift+Enter starts a new line. While the assistant answers, Enter steers it (it reads the
// message before its next step), and Queue keeps the message for when the answer ends.
export function PapelizAssistantComposer({ composerPlacement }: PapelizAssistantComposerProps) {
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const composerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.composerDraftText)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const assistantContextMode = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantContextMode)
  const pendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.pendingSelectionContext)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const stopAssistant = usePapelizAssistantConversationStore((conversationState) => conversationState.stopAssistant)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const setAssistantContextMode = usePapelizAssistantConversationStore((conversationState) => conversationState.setAssistantContextMode)
  const setPendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.setPendingSelectionContext)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(
    (settingsState) => settingsState.providerSettingsByProviderId[settingsState.activeAssistantProviderId]?.providerModelName,
  )
  const queuedAssistantMessages = usePapelizAssistantConversationStore((conversationState) => conversationState.queuedAssistantMessages)
  const steerAssistant = usePapelizAssistantConversationStore((conversationState) => conversationState.steerAssistant)
  const queueAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.queueAssistantMessage)
  const removeQueuedAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.removeQueuedAssistantMessage)
  const sendQueuedAssistantMessageNow = usePapelizAssistantConversationStore((conversationState) => conversationState.sendQueuedAssistantMessageNow)
  const isAssistantQuestionOpen = usePapelizAssistantConversationStore((conversationState) =>
    conversationState.chatEntries.some((chatEntry) => chatEntry.chatEntryKind === 'question' && chatEntry.questionAnswerText === null),
  )
  const assistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantMode)
  const assistantReasoningEffort = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantReasoningEffort)
  const assistantChangePermission = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantChangePermission)
  const setAssistantReasoningEffort = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantReasoningEffort)
  const setAssistantChangePermission = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantChangePermission)
  const isReasoningEffortRefusedByModel = usePapelizAssistantRunOptionsStore((runOptionsState) =>
    runOptionsState.providerModelNamesRefusingReasoningEffort.includes(activeProviderModelName ?? ''),
  )
  const [openComposerChipMenu, setOpenComposerChipMenu] = useState<PapelizComposerChipMenu | null>(null)
  const pendingAssistantAttachments = usePapelizAssistantConversationStore((conversationState) => conversationState.pendingAssistantAttachments)
  const addAssistantAttachmentFiles = usePapelizAssistantConversationStore((conversationState) => conversationState.addAssistantAttachmentFiles)
  const removePendingAssistantAttachment = usePapelizAssistantConversationStore((conversationState) => conversationState.removePendingAssistantAttachment)
  const attachmentFileInputRef = useRef<HTMLInputElement>(null)
  const [isFileDraggedOverComposer, setIsFileDraggedOverComposer] = useState(false)
  const composerFocusRequestCount = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.composerFocusRequestCount)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)

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

  // Enter sends, or steers the answer running now.
  const sendComposerDraft = () => {
    if (isAssistantRunning) steerAssistant(composerDraftText)
    else void sendAssistantMessage(composerDraftText)
  }
  const isNoteContextShown = assistantContextMode === 'active-note' && activeVaultNoteRelativePath !== null
  const providerChipLabel = activeProviderModelName ?? findPapelizAssistantProviderPreset(activeAssistantProviderId).providerPresetDisplayName
  const isComposerDraftEmpty = composerDraftText.trim().length === 0 && pendingAssistantAttachments.length === 0
  const isBypassPermissionOn = assistantChangePermission === 'bypass-permission'
  const chosenReasoningEffortChoice =
    papelizAssistantReasoningEffortChoices.find((reasoningEffortChoice) => reasoningEffortChoice.assistantReasoningEffort === assistantReasoningEffort) ??
    papelizAssistantReasoningEffortChoices[1]!
  const ChosenReasoningEffortIcon = chosenReasoningEffortChoice.ReasoningEffortIcon

  const openComposerChipMenuBelow = (composerChipMenuKind: PapelizComposerChipMenu['composerChipMenuKind'], clickEvent: MouseEvent<HTMLButtonElement>) => {
    const chipRect = clickEvent.currentTarget.getBoundingClientRect()
    // The menu opens above the chip; the popover keeps it inside the window.
    setOpenComposerChipMenu({ composerChipMenuKind, composerChipMenuPosition: { menuAnchorLeft: chipRect.left, menuAnchorTop: chipRect.top - 150 } })
  }
  const composerChipMenuItems: PapelizPopoverMenuItem[] =
    openComposerChipMenu?.composerChipMenuKind === 'effort'
      ? papelizAssistantReasoningEffortChoices.map((reasoningEffortChoice, reasoningEffortChoiceIndex) => ({
          menuItemKey: reasoningEffortChoice.assistantReasoningEffort,
          menuItemLabel: reasoningEffortChoice.reasoningEffortLabel,
          MenuItemIcon: reasoningEffortChoice.ReasoningEffortIcon,
          isMenuItemChecked: reasoningEffortChoice.assistantReasoningEffort === assistantReasoningEffort,
          ...(reasoningEffortChoiceIndex === 0 ? { menuItemGroupHeading: 'Effort' } : {}),
          onMenuItemSelect: () => setAssistantReasoningEffort(reasoningEffortChoice.assistantReasoningEffort),
        }))
      : [
          {
            menuItemKey: 'review-changes',
            menuItemLabel: 'Review changes',
            MenuItemIcon: ShieldCheck,
            isMenuItemChecked: !isBypassPermissionOn,
            menuItemGroupHeading: 'In Write',
            onMenuItemSelect: () => setAssistantChangePermission('review-changes'),
          },
          {
            menuItemKey: 'bypass-permission',
            menuItemLabel: 'Bypass permission',
            MenuItemIcon: ShieldAlert,
            isMenuItemChecked: isBypassPermissionOn,
            isDangerousMenuItem: true,
            onMenuItemSelect: () => setAssistantChangePermission('bypass-permission'),
          },
        ]

  return (
    <div
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
      className={joinPapelizClassNames(
        'rounded-[22px] border border-papeliz-line bg-papeliz-surface pt-2.5 pr-2 pb-2 pl-3.5 shadow-papeliz-card transition-[border-color,box-shadow] duration-150 focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_4px_var(--color-papeliz-blue-soft),var(--shadow-papeliz-card)]',
        composerPlacement === 'floating' && 'shadow-papeliz-pop',
        isFileDraggedOverComposer && 'border-papeliz-blue shadow-[0_0_0_4px_var(--color-papeliz-blue-soft),var(--shadow-papeliz-card)]',
      )}
    >
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
                Send now
              </button>
              <PapelizIconButton
                iconButtonLabel={`Remove “${queuedMessage.queuedMessageText}” from the queue`}
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
          <PapelizIconButton iconButtonLabel="Remove the selection" iconButtonSize="extra-small" onClick={() => setPendingSelectionContext(null)}>
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
            ? 'Steer the answer, or queue a message'
            : isAssistantQuestionOpen
              ? 'Pick an answer above, or write your own'
              : isNoteContextShown
                ? 'Ask about this note, or ask for a change'
                : 'Ask about your notes'
        }
        onChange={(changeEvent) => setComposerDraftText(changeEvent.target.value)}
        // A pasted picture or file is added to the message.
        onPaste={(pasteEvent) => {
          if (pasteEvent.clipboardData.files.length === 0) return
          pasteEvent.preventDefault()
          void addAssistantAttachmentFiles([...pasteEvent.clipboardData.files])
        }}
        onKeyDown={(keyboardEvent) => {
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
      {/* On a narrow panel the note, Review and the effort show as icons, so the model keeps its name. */}
      <div className="@container mt-1.5 flex min-w-0 items-center gap-0.5">
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
        <button
          type="button"
          aria-label="Add files or pictures"
          title="Add files or pictures (or paste or drop them here)"
          onClick={() => attachmentFileInputRef.current?.click()}
          className="mr-0.5 grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setAssistantContextMode(assistantContextMode === 'active-note' ? 'whole-vault' : 'active-note')}
          title="What the assistant sees with your message. Click to switch."
          aria-label={isNoteContextShown ? `Sees ${getVaultNoteTitle(activeVaultNoteRelativePath)}` : 'Sees the whole vault'}
          className={joinPapelizClassNames(papelizComposerQuietButtonClassName, 'max-w-[30%] flex-shrink')}
        >
          {isNoteContextShown ? <FileText className="size-3.5 flex-none" aria-hidden="true" /> : <Library className="size-3.5 flex-none" aria-hidden="true" />}
          <span className="hidden truncate @min-[26rem]:inline">{isNoteContextShown ? getVaultNoteTitle(activeVaultNoteRelativePath) : 'Whole vault'}</span>
        </button>
        {assistantMode === 'write' && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openComposerChipMenu?.composerChipMenuKind === 'permission'}
            onClick={(clickEvent) => openComposerChipMenuBelow('permission', clickEvent)}
            title={isBypassPermissionOn ? 'Bypass permission: changes apply at once. Click to change.' : 'Review changes: each change waits for you. Click to change.'}
            className={joinPapelizClassNames(
              papelizComposerQuietButtonClassName,
              isBypassPermissionOn && 'font-medium text-papeliz-error-notice-icon hover:text-papeliz-error-notice-icon',
            )}
          >
            {isBypassPermissionOn ? <ShieldAlert className="size-3.5 flex-none" aria-hidden="true" /> : <ShieldCheck className="size-3.5 flex-none" aria-hidden="true" />}
            <span className={joinPapelizClassNames('truncate', !isBypassPermissionOn && 'hidden @min-[24rem]:inline')}>{isBypassPermissionOn ? 'Bypass' : 'Review'}</span>
          </button>
        )}
        <span className="min-w-1 flex-1" />
        <PapelizAssistantContextWindowGauge />
        <button
          type="button"
          onClick={() => setProviderSettingsDialogOpen(true)}
          title="Provider and model. Click to change."
          className={joinPapelizClassNames(papelizComposerQuietButtonClassName, 'max-w-[48%] flex-shrink')}
        >
          <span className="truncate">{providerChipLabel}</span>
          <ChevronDown className="size-3 flex-none opacity-70" aria-hidden="true" />
        </button>
        {!isReasoningEffortRefusedByModel && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openComposerChipMenu?.composerChipMenuKind === 'effort'}
            onClick={(clickEvent) => openComposerChipMenuBelow('effort', clickEvent)}
            title="Effort: how long the model thinks before it answers. Click to change."
            className={papelizComposerQuietButtonClassName}
          >
            <ChosenReasoningEffortIcon className="size-3.5 flex-none" aria-hidden="true" />
            <span className="hidden @min-[22rem]:inline">{chosenReasoningEffortChoice.reasoningEffortLabel}</span>
            <ChevronDown className="size-3 flex-none opacity-70" aria-hidden="true" />
          </button>
        )}
        {isAssistantRunning ? (
          <span className="ml-1 flex flex-none items-center gap-1.5">
            {!isComposerDraftEmpty && (
              <>
                <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" title="Send when the answer ends" onClick={() => queueAssistantMessage(composerDraftText)}>
                  <ListPlus className="size-3.5" aria-hidden="true" />
                  Queue
                </PapelizPillButton>
                <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" title="Read before the assistant’s next step (Enter)" onClick={sendComposerDraft}>
                  Steer
                  <CornerDownLeft className="size-3.5" aria-hidden="true" />
                </PapelizPillButton>
              </>
            )}
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              onClick={stopAssistant}
              className="grid size-8 flex-none place-items-center rounded-full bg-papeliz-ink text-papeliz-surface transition-transform active:scale-90"
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label="Send"
            title="Send (Enter)"
            disabled={isComposerDraftEmpty}
            onClick={sendComposerDraft}
            className="ml-1 grid size-8 flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity,background-color] hover:brightness-95 active:scale-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>
      {openComposerChipMenu !== null && (
        <PapelizPopoverMenu
          menuLabel={openComposerChipMenu.composerChipMenuKind === 'effort' ? 'Effort' : 'Changes in Write'}
          menuPosition={openComposerChipMenu.composerChipMenuPosition}
          menuItems={composerChipMenuItems}
          onMenuClose={() => setOpenComposerChipMenu(null)}
        />
      )}
    </div>
  )
}
