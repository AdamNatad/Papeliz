import {
  CalendarCheck,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CirclePause,
  Eye,
  FilePlus,
  FileText,
  Folder,
  GripVertical,
  Hammer,
  Library,
  ListChecks,
  LoaderCircle,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultEntryName, getVaultEntryParentFolderRelativePath, getVaultNoteTitle, papelizVaultRootFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { readLatestPapelizVaultNoteText } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizVaultWikilinkActivation } from '../workspace/papeliz-vault-wikilink-activation'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import {
  isPapelizAssistantPlanChatEntry,
  papelizAssistantPlanFixMessageText,
  selectPapelizAssistantBuildingPlanEntry,
  usePapelizAssistantConversationStore,
  type PapelizAssistantChatEntry,
  type PapelizAssistantPlanChatEntry,
} from './papeliz-assistant-conversation-store'
import {
  addPapelizAssistantPlanStep,
  countPapelizAssistantPlanProgress,
  deletePapelizAssistantPlanStep,
  describePapelizAssistantPlanStepWords,
  findPapelizAssistantPlanActiveStep,
  findPapelizAssistantPlanStepToBuild,
  isPapelizAssistantPlanStepTicked,
  listPapelizAssistantPlanStepWikilinkTargets,
  movePapelizAssistantPlanStep,
  papelizAssistantPlansFolderName,
  parsePapelizAssistantPlanNote,
  setPapelizAssistantPlanStepWords,
  togglePapelizAssistantPlanStepTicked,
  type PapelizAssistantPlanDocument,
  type PapelizAssistantPlanStep,
} from './papeliz-assistant-plan-document'
import { PapelizAssistantProposalCard } from './papeliz-assistant-proposal-card'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'
import { PapelizAssistantReplyProviderModelLabel, PapelizAssistantToolActivityRow } from './papeliz-assistant-tool-activity-row'

// The hint under the mode switch in Plan.
export const papelizAssistantPlanModeHintText = 'Asks what it needs, then writes steps you can edit. Nothing changes until you press Build.'

// Where the card is drawn: in the conversation (up to about 380 px, then it scrolls), opened to the
// panel's full height, or in Focus mode's answer card.
export type PapelizAssistantPlanCardPlacement = 'conversation' | 'full-height' | 'focus'

interface PapelizAssistantPlanCardProps {
  planEntry: PapelizAssistantPlanChatEntry
  planCardPlacement: PapelizAssistantPlanCardPlacement
}

// Where a step is dropped while its handle is dragged: before the step at this place in the list
// (the list's length, after the last).
interface PapelizPlanStepDrag {
  draggedPlanStepId: string
  dropBeforePlanStepIndex: number | null
}

const papelizPlanStepRowAttributeName = 'data-papeliz-assistant-plan-step-id'
// What takes focus in a step row after it moves.
const papelizPlanStepFocusAttributeName = 'data-papeliz-assistant-plan-step-focus'

// "Plans", "Projects", or "the top of the vault", for where a plan's note went.
function describePlanNoteFolder(planVaultNoteRelativePath: string): string {
  const planNoteFolderRelativePath = getVaultEntryParentFolderRelativePath(planVaultNoteRelativePath)
  return planNoteFolderRelativePath === papelizVaultRootFolderRelativePath ? 'the top of the vault' : getVaultEntryName(planNoteFolderRelativePath)
}

interface PapelizPlanEditableTextProps {
  planText: string
  planTextLabel: string
  isPlanTextEditable: boolean
  isEditingPlanText: boolean
  onEditingPlanTextChange: (isEditingPlanText: boolean) => void
  onPlanTextCommit: (committedPlanText: string) => void
  // Alt+Up and Alt+Down while the words are changed: the step moves, with the words kept.
  onPlanTextMoveKey?: (committedPlanText: string, moveKey: 'ArrowUp' | 'ArrowDown') => void
  planTextClassName: string
  children: ReactNode
}

// A plan's title, goal or step words: they read as text, and a click (or Enter on them) changes
// them in place. Enter or leaving keeps the change; Esc puts it back.
function PapelizPlanEditableText({
  planText,
  planTextLabel,
  isPlanTextEditable,
  isEditingPlanText,
  onEditingPlanTextChange,
  onPlanTextCommit,
  onPlanTextMoveKey,
  planTextClassName,
  children,
}: PapelizPlanEditableTextProps) {
  const [draftPlanText, setDraftPlanText] = useState(planText)
  // Enter or Esc already ended the change; the blur that follows the box going away does nothing.
  const isPlanTextChangeEndedRef = useRef(false)
  if (!isPlanTextEditable || !isEditingPlanText) {
    if (!isPlanTextEditable) return <div className={planTextClassName}>{children}</div>
    return (
      <button
        type="button"
        {...{ [papelizPlanStepFocusAttributeName]: '' }}
        title="Click to change"
        onClick={() => {
          isPlanTextChangeEndedRef.current = false
          setDraftPlanText(planText)
          onEditingPlanTextChange(true)
        }}
        className={joinPapelizClassNames(planTextClassName, 'block w-full cursor-text rounded-lg text-left hover:bg-papeliz-hover')}
      >
        {children}
      </button>
    )
  }
  const endPlanTextChange = (isChangeKept: boolean) => {
    if (isPlanTextChangeEndedRef.current) return
    isPlanTextChangeEndedRef.current = true
    if (isChangeKept) onPlanTextCommit(draftPlanText)
    onEditingPlanTextChange(false)
  }
  return (
    <textarea
      autoFocus
      value={draftPlanText}
      aria-label={planTextLabel}
      rows={Math.max(1, Math.ceil(draftPlanText.length / 52))}
      onFocus={(focusEvent) => focusEvent.currentTarget.setSelectionRange(focusEvent.currentTarget.value.length, focusEvent.currentTarget.value.length)}
      onChange={(changeEvent) => setDraftPlanText(changeEvent.target.value.replace(/[\r\n]+/g, ' '))}
      onBlur={() => endPlanTextChange(true)}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Enter') {
          keyboardEvent.preventDefault()
          endPlanTextChange(true)
        } else if (keyboardEvent.key === 'Escape') {
          keyboardEvent.preventDefault()
          keyboardEvent.stopPropagation()
          endPlanTextChange(false)
        } else if (keyboardEvent.altKey && (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key === 'ArrowDown') && onPlanTextMoveKey !== undefined) {
          keyboardEvent.preventDefault()
          keyboardEvent.stopPropagation()
          isPlanTextChangeEndedRef.current = true
          onEditingPlanTextChange(false)
          onPlanTextMoveKey(draftPlanText, keyboardEvent.key)
        }
      }}
      className={joinPapelizClassNames(
        planTextClassName,
        'block w-full resize-none rounded-lg bg-papeliz-surface shadow-[0_0_0_1.5px_var(--color-papeliz-blue)] outline-none [field-sizing:content]',
      )}
    />
  )
}

// The notes a step names, as links: one that exists opens; an outlined one is a note the step creates.
function PapelizPlanStepNoteLinks({ planStepWords }: { planStepWords: string }) {
  const { resolveWikilinkTarget } = usePapelizVaultWikilinkActivation()
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const wikilinkTargetNoteNames = listPapelizAssistantPlanStepWikilinkTargets(planStepWords)
  if (wikilinkTargetNoteNames.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {wikilinkTargetNoteNames.map((wikilinkTargetNoteName) => {
        const linkedVaultNoteRelativePath = resolveWikilinkTarget(wikilinkTargetNoteName, null)
        const noteLinkTitle = getVaultNoteTitle(wikilinkTargetNoteName) || wikilinkTargetNoteName
        return linkedVaultNoteRelativePath === null ? (
          <span
            key={wikilinkTargetNoteName}
            title="A note this step creates"
            className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[12px] font-medium text-papeliz-blue shadow-[inset_0_0_0_1px_var(--color-papeliz-blue-line)]"
          >
            <FilePlus className="size-3 flex-none" aria-hidden="true" />
            {noteLinkTitle}
          </span>
        ) : (
          <button
            key={wikilinkTargetNoteName}
            type="button"
            title={`Open ${linkedVaultNoteRelativePath}`}
            onClick={() => void openVaultNote(linkedVaultNoteRelativePath)}
            className="max-w-full truncate rounded-full bg-papeliz-blue-soft px-2 py-0.5 text-[12px] font-medium text-papeliz-blue hover:bg-papeliz-blue-soft-hover"
          >
            {noteLinkTitle}
          </button>
        )
      })}
    </div>
  )
}

const papelizPlanStepTagClassNames = {
  running: 'bg-papeliz-surface text-papeliz-blue',
  'needs-review': 'bg-papeliz-surface text-papeliz-warning-ink',
  failed: 'bg-papeliz-surface text-papeliz-diff-removed-ink',
  muted: 'bg-papeliz-surface-gray text-papeliz-ink-subtle',
}

// The tag under a step's words while the plan builds: "Running", "Needs review", "Failed", and so on.
function describePlanStepTag(planStep: PapelizAssistantPlanStep, isPlanBuilt: boolean): { planStepTagText: string; planStepTagClassName: string } | null {
  switch (planStep.planStepStatus) {
    case 'running':
      return { planStepTagText: 'Running', planStepTagClassName: papelizPlanStepTagClassNames.running }
    case 'needs-review':
      return { planStepTagText: 'Needs review', planStepTagClassName: papelizPlanStepTagClassNames['needs-review'] }
    case 'failed':
      return { planStepTagText: 'Failed', planStepTagClassName: papelizPlanStepTagClassNames.failed }
    case 'stopped':
      return { planStepTagText: 'Stopped', planStepTagClassName: papelizPlanStepTagClassNames.muted }
    case 'skipped':
      return { planStepTagText: 'Skipped', planStepTagClassName: papelizPlanStepTagClassNames.muted }
    case 'ticked':
      return isPlanBuilt ? { planStepTagText: 'Ticked, skipped', planStepTagClassName: papelizPlanStepTagClassNames.muted } : null
    default:
      return null
  }
}

// What a step's latest run did, under it: what it looked at, and its proposals to Accept or Reject;
// and, when it failed, why, with Retry Step and Skip Step. The step's own reply isn't repeated here:
// its proposals say what it did, and a failure says why.
function PapelizPlanStepBuildActivity({
  planChatEntryId,
  planStep,
  planStepChatEntries,
}: {
  planChatEntryId: string
  planStep: PapelizAssistantPlanStep
  planStepChatEntries: readonly PapelizAssistantChatEntry[]
}) {
  const retryAssistantPlanStep = usePapelizAssistantConversationStore((conversationState) => conversationState.retryAssistantPlanStep)
  const skipAssistantPlanStep = usePapelizAssistantConversationStore((conversationState) => conversationState.skipAssistantPlanStep)
  // Each run starts with the message Build sent for the step; only the latest run shows.
  const latestRunChatEntries = planStepChatEntries.slice(planStepChatEntries.findLastIndex((chatEntry) => chatEntry.chatEntryKind === 'user-message') + 1)
  const latestRunActivityEntries = latestRunChatEntries.filter((chatEntry) => chatEntry.chatEntryKind === 'tool-activity' || chatEntry.chatEntryKind === 'proposal')
  return (
    <div className="col-start-3 col-end-5 mt-2 flex min-w-0 flex-col gap-2 pr-1">
      {latestRunActivityEntries.map((chatEntry) =>
        chatEntry.chatEntryKind === 'tool-activity' ? (
          <PapelizAssistantToolActivityRow key={chatEntry.chatEntryId} chatEntry={chatEntry} />
        ) : chatEntry.chatEntryKind === 'proposal' ? (
          <PapelizAssistantProposalCard key={chatEntry.chatEntryId} assistantProposalId={chatEntry.assistantProposalId} />
        ) : null,
      )}
      {planStep.planStepStatus === 'running' && latestRunActivityEntries.length === 0 && <p className="text-[12.5px] text-papeliz-ink-subtle">Working on it…</p>}
      {planStep.planStepStatus === 'stopped' && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle">
          <CirclePause className="size-3.5 flex-none" aria-hidden="true" />
          Stopped. Continue starts this step again.
        </p>
      )}
      {planStep.planStepStatus === 'failed' && (
        <>
          <p role="alert" className="flex items-start gap-1.5 text-[12.5px] leading-snug text-papeliz-diff-removed-ink">
            <CircleAlert className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
            <span className="papeliz-selectable-text min-w-0">{planStep.planStepProblem ?? 'The step couldn’t be done.'}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="h-[26px] px-2.5 text-[12.5px]" onClick={() => retryAssistantPlanStep(planChatEntryId, planStep.planStepId)}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry Step
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" className="h-[26px] px-2.5 text-[12.5px]" onClick={() => skipAssistantPlanStep(planChatEntryId, planStep.planStepId)}>
              <SkipForward className="size-3.5" aria-hidden="true" />
              Skip Step
            </PapelizPillButton>
          </div>
        </>
      )}
    </div>
  )
}

// The plan the assistant wrote, as a to-do list to work on. Before it is built: change the title, the
// goal or a step's words by clicking them, tick a step already done (Build skips it), drag a step by
// its handle (or Alt+Up and Alt+Down) to reorder it, delete one, or Add Step. Build saves the plan in
// Plans/ and builds it one step at a time; each step's changes come as proposals under it, and the next
// step starts once they are answered. The corner button opens the card to the panel's full height.
export function PapelizAssistantPlanCard({ planEntry, planCardPlacement }: PapelizAssistantPlanCardProps) {
  const planDocument = planEntry.assistantPlanDocument
  const planChatEntryId = planEntry.chatEntryId
  const chatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const changeAssistantPlanDocument = usePapelizAssistantConversationStore((conversationState) => conversationState.changeAssistantPlanDocument)
  const changeAssistantPlanAssumptions = usePapelizAssistantConversationStore((conversationState) => conversationState.changeAssistantPlanAssumptions)
  const buildAssistantPlan = usePapelizAssistantConversationStore((conversationState) => conversationState.buildAssistantPlan)
  const stopAssistantPlanBuild = usePapelizAssistantConversationStore((conversationState) => conversationState.stopAssistantPlanBuild)
  const saveAssistantPlanAsNote = usePapelizAssistantConversationStore((conversationState) => conversationState.saveAssistantPlanAsNote)
  const setFullHeightAssistantPlanChatEntryId = usePapelizAssistantConversationStore((conversationState) => conversationState.setFullHeightAssistantPlanChatEntryId)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const activeVaultMarkdownNoteRelativePath = usePapelizWorkspaceStore(selectActiveVaultMarkdownNoteRelativePath)
  const { resolveWikilinkTarget } = usePapelizVaultWikilinkActivation()
  const [editingPlanTextKey, setEditingPlanTextKey] = useState<string | null>(null)
  const [planStepDrag, setPlanStepDrag] = useState<PapelizPlanStepDrag | null>(null)
  const [saveAsNoteMenuPosition, setSaveAsNoteMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const planStepListRef = useRef<HTMLOListElement>(null)
  const planScrollAreaRef = useRef<HTMLDivElement>(null)
  // A step that moved, to give focus back to once it is drawn in its new place.
  const planStepIdToFocusRef = useRef<string | null>(null)

  const { planBuildPhase, planSteps } = planDocument
  const isPlanEditable = planBuildPhase === 'draft'
  const isPlanBuilding = planBuildPhase === 'building'
  const isPlanBuilt = planBuildPhase !== 'draft'
  const { planStepDoneCount, planStepCount } = countPapelizAssistantPlanProgress(planSteps)
  const tickedPlanStepCount = planSteps.filter((planStep) => planStep.planStepStatus === 'ticked').length
  const activePlanStep = findPapelizAssistantPlanActiveStep(planDocument)
  const activePlanStepNumber = activePlanStep === null ? null : planSteps.indexOf(activePlanStep) + 1
  const stoppedPlanStep = planSteps.find((planStep) => planStep.planStepStatus === 'stopped' || planStep.planStepStatus === 'needs-review') ?? findPapelizAssistantPlanStepToBuild(planDocument)
  const savedPlanVaultNoteRelativePath = planEntry.savedPlanVaultNoteRelativePath ?? null

  // Each step's entries from its build, in order.
  const planStepChatEntriesByPlanStepId = useMemo(() => {
    const groupedChatEntries = new Map<string, PapelizAssistantChatEntry[]>()
    for (const chatEntry of chatEntries) {
      if (chatEntry.assistantPlanStepRun?.planChatEntryId !== planChatEntryId) continue
      const planStepId = chatEntry.assistantPlanStepRun.planStepId
      groupedChatEntries.set(planStepId, [...(groupedChatEntries.get(planStepId) ?? []), chatEntry])
    }
    return groupedChatEntries
  }, [chatEntries, planChatEntryId])

  // The notes the plan creates: those its steps name that aren't in the vault yet.
  const createdNoteNames = useMemo(() => {
    const createdWikilinkTargetNames: string[] = []
    for (const planStep of planSteps) {
      for (const wikilinkTargetNoteName of listPapelizAssistantPlanStepWikilinkTargets(planStep.planStepWords)) {
        if (resolveWikilinkTarget(wikilinkTargetNoteName, null) !== null) continue
        if (!createdWikilinkTargetNames.some((listedName) => listedName.toLowerCase() === wikilinkTargetNoteName.toLowerCase())) createdWikilinkTargetNames.push(wikilinkTargetNoteName)
      }
    }
    return createdWikilinkTargetNames
  }, [planSteps, resolveWikilinkTarget])

  // The step the build is on stays in sight inside the card.
  const activePlanStepId = activePlanStep?.planStepId ?? null
  useEffect(() => {
    const planScrollArea = planScrollAreaRef.current
    if (activePlanStepId === null || planScrollArea === null) return
    const activePlanStepRow = planScrollArea.querySelector(`[${papelizPlanStepRowAttributeName}="${CSS.escape(activePlanStepId)}"]`)
    if (activePlanStepRow === null) return
    const rowTopInScrollArea = activePlanStepRow.getBoundingClientRect().top - planScrollArea.getBoundingClientRect().top
    if (rowTopInScrollArea < 0 || rowTopInScrollArea > planScrollArea.clientHeight - 40) planScrollArea.scrollTop += rowTopInScrollArea - 8
  }, [activePlanStepId])

  // A step moved with Alt+Up or Alt+Down keeps focus in its new place.
  useLayoutEffect(() => {
    const planStepIdToFocus = planStepIdToFocusRef.current
    if (planStepIdToFocus === null) return
    planStepIdToFocusRef.current = null
    planStepListRef.current
      ?.querySelector<HTMLElement>(`[${papelizPlanStepRowAttributeName}="${CSS.escape(planStepIdToFocus)}"] [${papelizPlanStepFocusAttributeName}]`)
      ?.focus()
  })

  const changePlan = (changePlanDocument: (planDocument: PapelizAssistantPlanDocument) => PapelizAssistantPlanDocument) => changeAssistantPlanDocument(planChatEntryId, changePlanDocument)

  const movePlanStepBy = (planStepId: string, planStepIndexChange: number) => {
    const planStepIndex = planSteps.findIndex((planStep) => planStep.planStepId === planStepId)
    const targetPlanStepIndex = planStepIndex + planStepIndexChange
    if (planStepIndex === -1 || targetPlanStepIndex < 0 || targetPlanStepIndex >= planSteps.length) return
    planStepIdToFocusRef.current = planStepId
    changePlan((latestPlanDocument) => movePapelizAssistantPlanStep(latestPlanDocument, planStepId, targetPlanStepIndex))
  }

  const commitPlanStepWords = (planStepId: string, committedPlanStepWords: string) => {
    // A step left with no words goes, as one added and never written does.
    if (committedPlanStepWords.trim().length === 0) changePlan((latestPlanDocument) => deletePapelizAssistantPlanStep(latestPlanDocument, planStepId))
    else changePlan((latestPlanDocument) => setPapelizAssistantPlanStepWords(latestPlanDocument, planStepId, committedPlanStepWords))
  }

  const addPlanStep = () => {
    changePlan((latestPlanDocument) => addPapelizAssistantPlanStep(latestPlanDocument))
    const changedPlanEntry = usePapelizAssistantConversationStore.getState().chatEntries.find((chatEntry) => chatEntry.chatEntryId === planChatEntryId)
    const addedPlanStep = changedPlanEntry !== undefined && isPapelizAssistantPlanChatEntry(changedPlanEntry) ? changedPlanEntry.assistantPlanDocument.planSteps.at(-1) : undefined
    if (addedPlanStep !== undefined) setEditingPlanTextKey(`step:${addedPlanStep.planStepId}`)
  }

  // Dragging a step by its handle: the step under the pointer marks where it would go, and letting go
  // puts it there. Works with a finger too.
  const findDropBeforePlanStepIndex = (pointerEvent: PointerEvent<HTMLElement>): number | null => {
    const planStepRowUnderPointer = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest<HTMLElement>(`[${papelizPlanStepRowAttributeName}]`)
    if (planStepRowUnderPointer === null || planStepRowUnderPointer === undefined || !planStepListRef.current?.contains(planStepRowUnderPointer)) return null
    const planStepRowIndex = planSteps.findIndex((planStep) => planStep.planStepId === planStepRowUnderPointer.getAttribute(papelizPlanStepRowAttributeName))
    if (planStepRowIndex === -1) return null
    const planStepRowRect = planStepRowUnderPointer.getBoundingClientRect()
    return pointerEvent.clientY < planStepRowRect.top + planStepRowRect.height / 2 ? planStepRowIndex : planStepRowIndex + 1
  }
  const finishPlanStepDrag = () => {
    if (planStepDrag !== null && planStepDrag.dropBeforePlanStepIndex !== null) {
      const draggedPlanStepIndex = planSteps.findIndex((planStep) => planStep.planStepId === planStepDrag.draggedPlanStepId)
      const targetPlanStepIndex = planStepDrag.dropBeforePlanStepIndex > draggedPlanStepIndex ? planStepDrag.dropBeforePlanStepIndex - 1 : planStepDrag.dropBeforePlanStepIndex
      if (draggedPlanStepIndex !== -1 && targetPlanStepIndex !== draggedPlanStepIndex) {
        const { draggedPlanStepId } = planStepDrag
        changePlan((latestPlanDocument) => movePapelizAssistantPlanStep(latestPlanDocument, draggedPlanStepId, targetPlanStepIndex))
      }
    }
    setPlanStepDrag(null)
  }

  const handlePlanStepRowKeyDown = (keyboardEvent: KeyboardEvent<HTMLLIElement>, planStepId: string) => {
    if (!isPlanEditable || !keyboardEvent.altKey || (keyboardEvent.key !== 'ArrowUp' && keyboardEvent.key !== 'ArrowDown')) return
    keyboardEvent.preventDefault()
    movePlanStepBy(planStepId, keyboardEvent.key === 'ArrowUp' ? -1 : 1)
  }

  const planNoteFolderMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'plans',
      menuItemLabel: papelizAssistantPlansFolderName,
      MenuItemIcon: Folder,
      menuItemGroupHeading: 'Save the plan in',
      onMenuItemSelect: () => void saveAssistantPlanAsNote(planChatEntryId, papelizAssistantPlansFolderName),
    },
    ...(() => {
      const activeNoteFolderRelativePath = activeVaultMarkdownNoteRelativePath === null ? null : getVaultEntryParentFolderRelativePath(activeVaultMarkdownNoteRelativePath)
      if (activeNoteFolderRelativePath === null || activeNoteFolderRelativePath === papelizVaultRootFolderRelativePath || activeNoteFolderRelativePath === papelizAssistantPlansFolderName) return []
      return [
        {
          menuItemKey: 'beside-open-note',
          menuItemLabel: `${getVaultEntryName(activeNoteFolderRelativePath)}, beside ${getVaultNoteTitle(activeVaultMarkdownNoteRelativePath ?? '')}`,
          MenuItemIcon: Folder,
          onMenuItemSelect: () => void saveAssistantPlanAsNote(planChatEntryId, activeNoteFolderRelativePath),
        },
      ]
    })(),
    {
      menuItemKey: 'top-of-vault',
      menuItemLabel: 'Top of the Vault',
      MenuItemIcon: Library,
      onMenuItemSelect: () => void saveAssistantPlanAsNote(planChatEntryId, papelizVaultRootFolderRelativePath),
    },
  ]

  const planHeaderState: ReactNode =
    planBuildPhase === 'draft' ? (
      <PapelizAssistantReplyProviderModelLabel replyProviderModel={planEntry} className="ml-auto max-w-[45%] text-[12.5px] text-papeliz-ink-subtle" />
    ) : planBuildPhase === 'done' ? (
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-medium text-papeliz-diff-added-ink">
        <CircleCheck className="size-3.5 flex-none" aria-hidden="true" />
        Done · {planStepDoneCount} of {planStepCount}
      </span>
    ) : planBuildPhase === 'stopped' ? (
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-papeliz-ink-subtle">
        <CirclePause className="size-3.5 flex-none" aria-hidden="true" />
        {stoppedPlanStep === null ? 'Stopped' : `Stopped at step ${planSteps.indexOf(stoppedPlanStep) + 1}`}
      </span>
    ) : activePlanStep?.planStepStatus === 'needs-review' ? (
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-medium text-papeliz-warning-ink">
        <Eye className="size-3.5 flex-none" aria-hidden="true" />
        Step {activePlanStepNumber} of {planStepCount} · waiting for you
      </span>
    ) : activePlanStep?.planStepStatus === 'failed' ? (
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-medium text-papeliz-diff-removed-ink">
        <CircleAlert className="size-3.5 flex-none" aria-hidden="true" />
        Step {activePlanStepNumber} failed
      </span>
    ) : (
      <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-medium text-papeliz-blue">
        <LoaderCircle className="size-3.5 flex-none animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {activePlanStepNumber === null ? 'Building' : `Step ${activePlanStepNumber} of ${planStepCount}`}
      </span>
    )

  const savedPlanNoteLink =
    savedPlanVaultNoteRelativePath === null ? null : (
      <button
        type="button"
        title={`Open ${savedPlanVaultNoteRelativePath}`}
        onClick={() => void openVaultNote(savedPlanVaultNoteRelativePath)}
        className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-medium text-papeliz-diff-added-ink hover:underline"
      >
        <Check className="size-3.5 flex-none" aria-hidden="true" />
        Saved in {describePlanNoteFolder(savedPlanVaultNoteRelativePath)}
      </button>
    )
  const planStepsToBuildCount = planStepCount - planStepDoneCount

  return (
    <div
      data-papeliz-assistant-plan-card-entry-id={planChatEntryId}
      role="group"
      aria-label={`Plan: ${planDocument.planTitle}`}
      className={joinPapelizClassNames(
        'papeliz-pop-enter flex flex-col overflow-hidden rounded-[18px] border bg-papeliz-surface',
        isPlanBuilding ? 'border-papeliz-blue-line' : 'border-papeliz-line',
        planCardPlacement === 'focus' ? 'flex-none' : 'shadow-papeliz-card',
        planCardPlacement === 'full-height' ? 'min-h-0 flex-1' : 'flex-none',
      )}
    >
      <div className="flex min-h-[42px] flex-none items-center gap-2 border-b border-papeliz-line py-1.5 pr-2 pl-3.5 text-[13px] text-papeliz-ink-muted">
        <ListChecks className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
        <span className="font-semibold text-papeliz-ink">Plan</span>
        {planHeaderState}
        {planCardPlacement !== 'focus' && (
          <button
            type="button"
            aria-label={planCardPlacement === 'full-height' ? 'Back to the Conversation' : 'Open to Full Height'}
            title={planCardPlacement === 'full-height' ? 'Back to the conversation' : 'Open to full height'}
            onClick={() => setFullHeightAssistantPlanChatEntryId(planCardPlacement === 'full-height' ? null : planChatEntryId)}
            className={joinPapelizClassNames(
              'grid size-7 flex-none place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink',
              planBuildPhase === 'draft' && 'ml-0.5',
            )}
          >
            {planCardPlacement === 'full-height' ? <Minimize2 className="size-3.5" aria-hidden="true" /> : <Maximize2 className="size-3.5" aria-hidden="true" />}
          </button>
        )}
      </div>
      {isPlanBuilt && (
        <div className="h-[3px] flex-none bg-papeliz-surface-gray" aria-hidden="true">
          <div
            className="h-full rounded-r-[3px] bg-papeliz-blue transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${planStepCount === 0 ? 0 : (planStepDoneCount / planStepCount) * 100}%` }}
          />
        </div>
      )}

      <div ref={planScrollAreaRef} className={joinPapelizClassNames('min-h-0 overflow-y-auto', planCardPlacement === 'conversation' ? 'max-h-96' : 'flex-1')}>
        <div className="px-3.5 pt-3 pb-2">
          <PapelizPlanEditableText
            planText={planDocument.planTitle}
            planTextLabel="Plan title"
            isPlanTextEditable={isPlanEditable}
            isEditingPlanText={editingPlanTextKey === 'title'}
            onEditingPlanTextChange={(isEditing) => setEditingPlanTextKey(isEditing ? 'title' : null)}
            onPlanTextCommit={(committedPlanTitle) => {
              if (committedPlanTitle.trim().length > 0) changePlan((latestPlanDocument) => ({ ...latestPlanDocument, planTitle: committedPlanTitle.trim() }))
            }}
            planTextClassName="-ml-1.5 px-1.5 py-0.5 text-[16.5px] leading-snug font-bold text-papeliz-ink"
          >
            <h4 className="papeliz-selectable-text">{planDocument.planTitle}</h4>
          </PapelizPlanEditableText>
          {(planDocument.planGoalText.length > 0 || isPlanEditable) && (
            <div className="mt-1">
              <PapelizPlanEditableText
                planText={planDocument.planGoalText}
                planTextLabel="Plan goal"
                isPlanTextEditable={isPlanEditable}
                isEditingPlanText={editingPlanTextKey === 'goal'}
                onEditingPlanTextChange={(isEditing) => setEditingPlanTextKey(isEditing ? 'goal' : null)}
                onPlanTextCommit={(committedPlanGoal) => changePlan((latestPlanDocument) => ({ ...latestPlanDocument, planGoalText: committedPlanGoal.trim() }))}
                planTextClassName="-ml-1.5 px-1.5 py-0.5 text-[13px] leading-normal text-papeliz-ink-muted"
              >
                <p className="papeliz-selectable-text">
                  <b className="font-semibold text-papeliz-ink">Goal</b> · {planDocument.planGoalText.length > 0 ? planDocument.planGoalText : <span className="text-papeliz-ink-subtle">Add a goal</span>}
                </p>
              </PapelizPlanEditableText>
            </div>
          )}
          {planDocument.planAssumedText !== null && (
            <div className="mt-2.5 rounded-xl bg-papeliz-warning px-3 py-2 text-[12.5px] leading-normal text-papeliz-warning-ink">
              <b className="font-semibold">Assumed:</b> <span className="papeliz-selectable-text">{planDocument.planAssumedText}</span>
              {isPlanEditable && (
                <button
                  type="button"
                  onClick={() => changeAssistantPlanAssumptions(planChatEntryId)}
                  className="ml-1 rounded-md px-1.5 py-0.5 font-medium underline underline-offset-2 hover:bg-papeliz-warning-ink/10"
                >
                  Change
                </button>
              )}
            </div>
          )}

          <ol ref={planStepListRef} aria-label="Steps" className="mt-2.5 flex flex-col gap-0.5">
            {planSteps.map((planStep, planStepIndex) => {
              const planStepTag = describePlanStepTag(planStep, isPlanBuilt)
              const isPlanStepTicked = isPapelizAssistantPlanStepTicked(planStep)
              const planStepChatEntries = planStepChatEntriesByPlanStepId.get(planStep.planStepId) ?? []
              const isPlanStepActivityShown =
                planStep.planStepStatus === 'running' || planStep.planStepStatus === 'needs-review' || planStep.planStepStatus === 'failed' || planStep.planStepStatus === 'stopped'
              const isDropBeforeThisStep = planStepDrag?.dropBeforePlanStepIndex === planStepIndex
              const isDropAfterLastStep = planStepIndex === planSteps.length - 1 && planStepDrag?.dropBeforePlanStepIndex === planSteps.length
              const planStepWordsKey = `step:${planStep.planStepId}`
              return (
                <li
                  key={planStep.planStepId}
                  {...{ [papelizPlanStepRowAttributeName]: planStep.planStepId }}
                  onKeyDown={(keyboardEvent) => handlePlanStepRowKeyDown(keyboardEvent, planStep.planStepId)}
                  className={joinPapelizClassNames(
                    'group/plan-step relative grid grid-cols-[14px_20px_minmax(0,1fr)_auto] items-start gap-x-1.5 rounded-xl py-1.5 pr-1',
                    planStep.planStepStatus === 'running'
                      ? 'bg-papeliz-blue-soft'
                      : planStep.planStepStatus === 'needs-review'
                        ? 'bg-papeliz-warning/70'
                        : planStep.planStepStatus === 'failed'
                          ? 'bg-papeliz-diff-removed'
                          : 'hover:bg-papeliz-hover',
                    planStepDrag?.draggedPlanStepId === planStep.planStepId && 'opacity-40',
                    isDropBeforeThisStep && 'shadow-[inset_0_2px_0_var(--color-papeliz-blue)]',
                    isDropAfterLastStep && 'shadow-[inset_0_-2px_0_var(--color-papeliz-blue)]',
                  )}
                >
                  {isPlanEditable ? (
                    <span
                      title="Drag to reorder (or Alt+Up and Alt+Down)"
                      aria-hidden="true"
                      onPointerDown={(pointerEvent) => {
                        if (pointerEvent.button !== 0) return
                        pointerEvent.preventDefault()
                        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
                        setPlanStepDrag({ draggedPlanStepId: planStep.planStepId, dropBeforePlanStepIndex: null })
                      }}
                      onPointerMove={(pointerEvent) => {
                        if (planStepDrag?.draggedPlanStepId !== planStep.planStepId) return
                        const dropBeforePlanStepIndex = findDropBeforePlanStepIndex(pointerEvent)
                        if (dropBeforePlanStepIndex !== planStepDrag.dropBeforePlanStepIndex) setPlanStepDrag({ ...planStepDrag, dropBeforePlanStepIndex })
                      }}
                      onPointerUp={finishPlanStepDrag}
                      onPointerCancel={() => setPlanStepDrag(null)}
                      className="grid h-5 cursor-grab touch-none place-items-center text-papeliz-ink-subtle opacity-0 group-hover/plan-step:opacity-100 active:cursor-grabbing pointer-coarse:opacity-100"
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {planStep.planStepStatus === 'running' ? (
                    <span className="grid size-5 place-items-center text-papeliz-blue">
                      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    </span>
                  ) : planStep.planStepStatus === 'needs-review' ? (
                    <span className="grid size-5 place-items-center text-papeliz-warning-ink">
                      <Eye className="size-4" aria-hidden="true" />
                    </span>
                  ) : planStep.planStepStatus === 'failed' ? (
                    <span className="grid size-5 place-items-center text-papeliz-diff-removed-ink">
                      <CircleAlert className="size-4" aria-hidden="true" />
                    </span>
                  ) : planStep.planStepStatus === 'stopped' ? (
                    <span className="grid size-5 place-items-center text-papeliz-ink-subtle">
                      <CirclePause className="size-4" aria-hidden="true" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isPlanStepTicked}
                      aria-label={`Step ${planStepIndex + 1} Done`}
                      title={isPlanEditable ? (isPlanStepTicked ? 'Done: Build skips it' : 'Tick a step that’s already done, so Build skips it') : undefined}
                      disabled={!isPlanEditable}
                      onClick={() => changePlan((latestPlanDocument) => togglePapelizAssistantPlanStepTicked(latestPlanDocument, planStep.planStepId))}
                      className={joinPapelizClassNames(
                        'mt-px grid size-[18px] place-items-center rounded-[5px] border-[1.5px] transition-colors',
                        isPlanStepTicked
                          ? 'border-papeliz-chosen-tab-ground bg-papeliz-chosen-tab-ground text-white'
                          : 'border-papeliz-line-strong bg-papeliz-surface text-transparent enabled:hover:border-papeliz-blue',
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <PapelizPlanEditableText
                      planText={planStep.planStepWords}
                      planTextLabel={`Step ${planStepIndex + 1}`}
                      isPlanTextEditable={isPlanEditable}
                      isEditingPlanText={editingPlanTextKey === planStepWordsKey}
                      onEditingPlanTextChange={(isEditing) => setEditingPlanTextKey(isEditing ? planStepWordsKey : null)}
                      onPlanTextCommit={(committedPlanStepWords) => commitPlanStepWords(planStep.planStepId, committedPlanStepWords)}
                      onPlanTextMoveKey={(committedPlanStepWords, moveKey) => {
                        commitPlanStepWords(planStep.planStepId, committedPlanStepWords)
                        movePlanStepBy(planStep.planStepId, moveKey === 'ArrowUp' ? -1 : 1)
                      }}
                      planTextClassName={joinPapelizClassNames(
                        '-ml-1 px-1 text-[13.5px] leading-[1.45] [overflow-wrap:anywhere]',
                        isPlanStepTicked && !(planBuildPhase === 'done') ? 'text-papeliz-ink-subtle line-through decoration-papeliz-ink-subtle/60' : '',
                        isPlanStepTicked && planBuildPhase === 'done' ? 'text-papeliz-ink-muted' : '',
                        !isPlanStepTicked && isPlanBuilding && planStep.planStepStatus === 'to-do' ? 'text-papeliz-ink-muted' : '',
                      )}
                    >
                      <span className="papeliz-selectable-text">
                        <span className="mr-[3px] text-papeliz-ink-subtle tabular-nums">{planStepIndex + 1}.</span>
                        {describePapelizAssistantPlanStepWords(planStep.planStepWords) || <span className="text-papeliz-ink-subtle">Write the step</span>}
                      </span>
                    </PapelizPlanEditableText>
                    {planStepTag !== null && (
                      <div className="mt-1">
                        <span className={joinPapelizClassNames('inline-flex h-5 items-center rounded-full px-[7px] text-[11.5px] font-semibold whitespace-nowrap', planStepTag.planStepTagClassName)}>
                          {planStepTag.planStepTagText}
                        </span>
                      </div>
                    )}
                    <PapelizPlanStepNoteLinks planStepWords={planStep.planStepWords} />
                  </div>
                  {isPlanEditable ? (
                    <span className="flex opacity-0 group-focus-within/plan-step:opacity-100 group-hover/plan-step:opacity-100 pointer-coarse:opacity-100">
                      <button
                        type="button"
                        aria-label={`Change Step ${planStepIndex + 1}`}
                        title="Change the step’s words"
                        onClick={() => setEditingPlanTextKey(planStepWordsKey)}
                        className="grid size-6 place-items-center rounded-full text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink"
                      >
                        <Pencil className="size-[13px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete Step ${planStepIndex + 1}`}
                        title="Delete the step"
                        onClick={() => changePlan((latestPlanDocument) => deletePapelizAssistantPlanStep(latestPlanDocument, planStep.planStepId))}
                        className="grid size-6 place-items-center rounded-full text-papeliz-ink-muted hover:bg-papeliz-diff-removed hover:text-papeliz-diff-removed-ink"
                      >
                        <Trash2 className="size-[13px]" aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {isPlanStepActivityShown && (
                    <PapelizPlanStepBuildActivity planChatEntryId={planChatEntryId} planStep={planStep} planStepChatEntries={planStepChatEntries} />
                  )}
                </li>
              )
            })}
          </ol>
          {isPlanEditable && (
            <button
              type="button"
              onClick={addPlanStep}
              className="mt-1 ml-[18px] inline-flex h-[30px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add Step
            </button>
          )}
          {createdNoteNames.length > 0 && (
            <div className="mt-2.5 mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-dashed border-papeliz-line pt-2.5 text-[12px] text-papeliz-ink-subtle">
              <span className="mr-0.5 font-semibold">Creates</span>
              {createdNoteNames.map((createdNoteName) => (
                <span
                  key={createdNoteName}
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-medium text-papeliz-blue shadow-[inset_0_0_0_1px_var(--color-papeliz-blue-line)]"
                >
                  <FilePlus className="size-3 flex-none" aria-hidden="true" />
                  {createdNoteName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-papeliz-line bg-papeliz-surface-soft px-3.5 py-2.5">
        {planBuildPhase === 'draft' && (
          <>
            <PapelizPillButton
              pillButtonVariant="primary"
              pillButtonSize="small"
              disabled={isAssistantRunning || planStepsToBuildCount === 0}
              title={isAssistantRunning ? 'Wait for the answer to finish' : planStepsToBuildCount === 0 ? 'Every step is ticked' : 'Save the plan in Plans, then build it step by step'}
              onClick={() => void buildAssistantPlan(planChatEntryId)}
            >
              <Hammer className="size-3.5" aria-hidden="true" />
              Build
            </PapelizPillButton>
            {savedPlanNoteLink ?? (
              <PapelizPillButton
                pillButtonVariant="line"
                pillButtonSize="small"
                aria-haspopup="menu"
                aria-expanded={saveAsNoteMenuPosition !== null}
                onClick={(clickEvent) => {
                  const saveAsNoteButtonRect = clickEvent.currentTarget.getBoundingClientRect()
                  setSaveAsNoteMenuPosition({ menuAnchorLeft: saveAsNoteButtonRect.left, menuAnchorTop: saveAsNoteButtonRect.bottom + 6 })
                }}
              >
                Save as Note
                <ChevronDown className="size-3" aria-hidden="true" />
              </PapelizPillButton>
            )}
            <span className="ml-auto text-[12px] whitespace-nowrap text-papeliz-ink-subtle">
              {tickedPlanStepCount > 0 ? `Builds ${planStepsToBuildCount} of ${planStepCount} · ${tickedPlanStepCount} ticked` : `${planStepCount} ${planStepCount === 1 ? 'step' : 'steps'}`}
            </span>
          </>
        )}
        {planBuildPhase === 'building' && (
          <>
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => stopAssistantPlanBuild(planChatEntryId)}>
              <Square className="size-3 text-papeliz-diff-removed-ink" aria-hidden="true" />
              Stop
            </PapelizPillButton>
            {savedPlanNoteLink}
            <span className="ml-auto text-[12px] whitespace-nowrap text-papeliz-ink-subtle">
              {activePlanStep?.planStepStatus === 'needs-review'
                ? 'Accept or Reject to go on'
                : activePlanStep?.planStepStatus === 'failed'
                  ? `Paused on step ${activePlanStepNumber}`
                  : `${planStepDoneCount} of ${planStepCount} done`}
            </span>
          </>
        )}
        {planBuildPhase === 'stopped' && (
          <>
            <PapelizPillButton
              pillButtonVariant="primary"
              pillButtonSize="small"
              disabled={isAssistantRunning}
              title={isAssistantRunning ? 'Wait for the answer to finish' : 'Start the stopped step again'}
              onClick={() => void buildAssistantPlan(planChatEntryId)}
            >
              <Play className="size-3.5" aria-hidden="true" />
              Continue
            </PapelizPillButton>
            {savedPlanNoteLink}
            <span className="ml-auto text-[12px] whitespace-nowrap text-papeliz-ink-subtle">
              {planStepDoneCount} of {planStepCount} done
            </span>
          </>
        )}
        {planBuildPhase === 'done' && (
          <>
            {savedPlanVaultNoteRelativePath !== null && (
              <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => void openVaultNote(savedPlanVaultNoteRelativePath)}>
                <FileText className="size-3.5" aria-hidden="true" />
                Open Plan Note
              </PapelizPillButton>
            )}
            <span className="ml-auto text-[12px] whitespace-nowrap text-papeliz-ink-subtle">
              {savedPlanVaultNoteRelativePath === null ? `${planStepDoneCount} of ${planStepCount} done` : `Saved in ${describePlanNoteFolder(savedPlanVaultNoteRelativePath)}`}
            </span>
          </>
        )}
      </div>
      {saveAsNoteMenuPosition !== null && (
        <PapelizPopoverMenu menuLabel="Save the plan in" menuPosition={saveAsNoteMenuPosition} menuItems={planNoteFolderMenuItems} onMenuClose={() => setSaveAsNoteMenuPosition(null)} />
      )}
    </div>
  )
}

// Under a Plan answer that isn't a plan (a question asked in Plan): it says so, and offers to switch
// to Ask, or to plan a fix for what the answer found.
export function PapelizAssistantPlanModeAnswerChips() {
  const setAssistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantMode)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  return (
    <div className="papeliz-pop-enter flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle">
        <MessageCircleQuestion className="size-3.5 flex-none" aria-hidden="true" />A question, so nothing was planned.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="papeliz-assistant-suggestion-chip"
          style={{ background: 'var(--color-papeliz-blue-soft)', color: 'var(--color-papeliz-blue)' }}
          onClick={() => setAssistantMode('ask')}
        >
          <MessageCircleQuestion className="size-3.5" aria-hidden="true" /> Switch to Ask
        </button>
        <button type="button" className="papeliz-assistant-suggestion-chip" disabled={isAssistantRunning} onClick={() => void sendAssistantMessage(papelizAssistantPlanFixMessageText)}>
          <ListChecks className="size-3.5" aria-hidden="true" /> Plan a Fix
        </button>
      </div>
    </div>
  )
}

interface PapelizAssistantPlanInProgress {
  planVaultNoteRelativePath: string
  planTitle: string
  planStepDoneCount: number
  planStepCount: number
}

// The plans in Plans/ with steps left, read from their notes whenever a note comes or goes there.
function usePapelizAssistantPlansInProgress(): PapelizAssistantPlanInProgress[] | null {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const [plansInProgressRead, setPlansInProgressRead] = useState<{ papelizVaultId: string; plansInProgress: PapelizAssistantPlanInProgress[] } | null>(null)
  const planVaultNoteRelativePathsKey = useMemo(
    () =>
      vaultTreeEntries
        .filter(
          (vaultTreeEntry) =>
            vaultTreeEntry.vaultEntryKind === 'note' && getVaultEntryParentFolderRelativePath(vaultTreeEntry.vaultEntryRelativePath) === papelizAssistantPlansFolderName,
        )
        .map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
        .sort()
        .join('\n'),
    [vaultTreeEntries],
  )
  useEffect(() => {
    if (openVault === null) return
    let isPlansReadStale = false
    const planVaultNoteRelativePaths = planVaultNoteRelativePathsKey.length === 0 ? [] : planVaultNoteRelativePathsKey.split('\n')
    void Promise.all(
      planVaultNoteRelativePaths.map(async (planVaultNoteRelativePath): Promise<PapelizAssistantPlanInProgress | null> => {
        const planNote = parsePapelizAssistantPlanNote(await readLatestPapelizVaultNoteText(openVault, planVaultNoteRelativePath).catch(() => ''))
        if (planNote === null || planNote.isPlanNoteDone) return null
        const { planStepDoneCount, planStepCount } = countPapelizAssistantPlanProgress(planNote.planDocument.planSteps)
        if (planStepDoneCount === planStepCount) return null
        return { planVaultNoteRelativePath, planTitle: planNote.planDocument.planTitle, planStepDoneCount, planStepCount }
      }),
    ).then((readPlans) => {
      if (!isPlansReadStale) setPlansInProgressRead({ papelizVaultId: openVault.papelizVaultId, plansInProgress: readPlans.filter((readPlan) => readPlan !== null) })
    })
    return () => {
      isPlansReadStale = true
    }
  }, [openVault, planVaultNoteRelativePathsKey])
  return plansInProgressRead === null || plansInProgressRead.papelizVaultId !== openVault?.papelizVaultId ? null : plansInProgressRead.plansInProgress
}

// Plan's own empty page: what Plan does, the plans in Plans/ still to finish (Continue opens each one's
// chat), and a few places to start.
export function PapelizAssistantPlanEmptyPage() {
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const continueAssistantPlanFromNote = usePapelizAssistantConversationStore((conversationState) => conversationState.continueAssistantPlanFromNote)
  const activeVaultMarkdownNoteRelativePath = usePapelizWorkspaceStore(selectActiveVaultMarkdownNoteRelativePath)
  const plansInProgress = usePapelizAssistantPlansInProgress()
  return (
    <div className="papeliz-pop-enter my-auto flex flex-col gap-3 py-6">
      <p className="text-sm text-papeliz-ink-muted">
        Describe a change across your notes. The assistant asks what it needs, writes the steps, and builds them one by one when you press Build.
      </p>
      {plansInProgress !== null && plansInProgress.length > 0 && (
        <section aria-label="Plans in progress" className="flex flex-col gap-1 rounded-2xl border border-papeliz-line bg-papeliz-surface p-2">
          <h3 className="px-1.5 pt-0.5 pb-1 text-[12px] font-semibold text-papeliz-ink-subtle">Plans in progress</h3>
          {plansInProgress.map((planInProgress) => (
            <div key={planInProgress.planVaultNoteRelativePath} className="flex items-center gap-2.5 rounded-[10px] p-1.5 hover:bg-papeliz-hover">
              <ListChecks className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-medium">{planInProgress.planTitle}</b>
                <span className="block text-xs text-papeliz-ink-subtle">
                  {planInProgress.planStepDoneCount} of {planInProgress.planStepCount} done
                </span>
              </span>
              <PapelizPillButton
                pillButtonVariant="line"
                pillButtonSize="small"
                className="h-[26px] px-2.5 text-[12.5px]"
                aria-label={`Continue ${planInProgress.planTitle}`}
                onClick={() => void continueAssistantPlanFromNote(planInProgress.planVaultNoteRelativePath)}
              >
                Continue
              </PapelizPillButton>
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-1.5">
        {activeVaultMarkdownNoteRelativePath !== null && (
          <button
            type="button"
            className="papeliz-assistant-suggestion-chip"
            onClick={() => void sendAssistantMessage('Make a plan from this note: turn what it describes into steps across my notes.')}
          >
            <ListChecks className="size-3.5" aria-hidden="true" /> Plan from This Note
          </button>
        )}
        <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Plan how to tidy one of my folders.')}>
          <Folder className="size-3.5" aria-hidden="true" /> Tidy a Folder
        </button>
        <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Plan a weekly review for my project notes.')}>
          <CalendarCheck className="size-3.5" aria-hidden="true" /> Plan a Weekly Review
        </button>
      </div>
      <p className="text-xs text-papeliz-ink-subtle">Plans are saved in the {papelizAssistantPlansFolderName} folder when you build them.</p>
    </div>
  )
}

// While a plan builds and its card is scrolled out of sight, a strip at the top of the conversation
// says where the build is ("Weekly review · step 2 of 5 needs review"), with Show.
export function PapelizAssistantPlanBuildStrip({ chatScrollAreaRef }: { chatScrollAreaRef: RefObject<HTMLDivElement | null> }) {
  const buildingPlanEntry = usePapelizAssistantConversationStore(selectPapelizAssistantBuildingPlanEntry)
  const [isPlanCardInSight, setIsPlanCardInSight] = useState(true)
  const buildingPlanChatEntryId = buildingPlanEntry?.chatEntryId ?? null
  useEffect(() => {
    const chatScrollArea = chatScrollAreaRef.current
    if (buildingPlanChatEntryId === null || chatScrollArea === null) return
    const planCardElement = chatScrollArea.querySelector(`[data-papeliz-assistant-plan-card-entry-id="${CSS.escape(buildingPlanChatEntryId)}"]`)
    if (planCardElement === null) return
    const planCardSightObserver = new IntersectionObserver(([planCardSight]) => setIsPlanCardInSight(planCardSight?.isIntersecting ?? true), { root: chatScrollArea })
    planCardSightObserver.observe(planCardElement)
    return () => planCardSightObserver.disconnect()
  }, [buildingPlanChatEntryId, chatScrollAreaRef])
  if (buildingPlanEntry === null || isPlanCardInSight) return null
  const { planSteps, planTitle } = buildingPlanEntry.assistantPlanDocument
  const activePlanStep = findPapelizAssistantPlanActiveStep(buildingPlanEntry.assistantPlanDocument)
  const activePlanStepNumber = activePlanStep === null ? null : planSteps.indexOf(activePlanStep) + 1
  const planBuildWhereText =
    activePlanStep === null
      ? 'building'
      : activePlanStep.planStepStatus === 'needs-review'
        ? `step ${activePlanStepNumber} of ${planSteps.length} needs review`
        : activePlanStep.planStepStatus === 'failed'
          ? `step ${activePlanStepNumber} failed`
          : `step ${activePlanStepNumber} of ${planSteps.length} running`
  return (
    <div
      role="status"
      className="papeliz-pop-enter sticky -top-4 z-10 -mx-[18px] -mt-4 flex flex-none items-center gap-2 border-b border-papeliz-line bg-papeliz-surface/95 py-2 pr-3 pl-4 text-[12.5px] text-papeliz-ink-muted backdrop-blur-sm"
    >
      {activePlanStep?.planStepStatus === 'failed' ? (
        <CircleAlert className="size-[15px] flex-none text-papeliz-diff-removed-ink" aria-hidden="true" />
      ) : activePlanStep?.planStepStatus === 'needs-review' ? (
        <Eye className="size-[15px] flex-none text-papeliz-warning-ink" aria-hidden="true" />
      ) : (
        <LoaderCircle className="size-[15px] flex-none animate-spin text-papeliz-blue motion-reduce:animate-none" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">
        <b className="font-semibold text-papeliz-ink">{planTitle}</b> · {planBuildWhereText}
      </span>
      <PapelizPillButton
        pillButtonVariant="primary"
        pillButtonSize="small"
        className="h-[26px] px-2.5 text-[12.5px]"
        onClick={() =>
          chatScrollAreaRef.current
            ?.querySelector(`[data-papeliz-assistant-plan-card-entry-id="${CSS.escape(buildingPlanEntry.chatEntryId)}"]`)
            ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
        }
      >
        Show
      </PapelizPillButton>
    </div>
  )
}
