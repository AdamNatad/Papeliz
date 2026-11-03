import { ArrowLeft, ChartNoAxesColumn, History, ImagePlus, ListChecks, MessageCircleQuestion, NotebookPen, PenLine, SquarePen, WandSparkles, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizAssistantChatView } from './papeliz-assistant-chat-view'
import { PapelizAssistantComposer } from './papeliz-assistant-composer'
import {
  isPapelizAssistantPlanChatEntry,
  selectPapelizAssistantBuildingPlanEntry,
  usePapelizAssistantConversationStore,
} from './papeliz-assistant-conversation-store'
import { PapelizAssistantImagineView } from './papeliz-assistant-imagine-view'
import { usePapelizAssistantPanelUiStore, type PapelizAssistantPanelTab } from './papeliz-assistant-panel-ui-store'
import { papelizAssistantPlanModeHintText } from './papeliz-assistant-plan-card'
import { findPapelizAssistantPlanActiveStep } from './papeliz-assistant-plan-document'
import { usePapelizAssistantRunOptionsStore, type PapelizAssistantMode } from './papeliz-assistant-run-options-store'
import { PapelizAssistantSessionsView } from './papeliz-assistant-sessions-view'
import { PapelizAssistantUsageView } from './papeliz-assistant-usage-view'
import { PapelizEndToEndVaultAssistantLine } from '../workspace/papeliz-vault-encryption-parts'

interface PapelizAssistantPanelProps {
  onAssistantPanelClose: () => void
}

// The tabs under the header: Notes (the conversation about your notes, kept under the panel store's
// older `chat` value, which other screens set) and Imagine.
type PapelizAssistantPanelPageTab = Extract<PapelizAssistantPanelTab, 'chat' | 'imagine'>

const papelizAssistantPanelPageTabs: ReadonlyArray<{
  assistantPanelPageTab: PapelizAssistantPanelPageTab
  // For the tab's and its page's ids.
  assistantPanelPageTabIdName: 'notes' | 'imagine'
  assistantPanelPageTabLabel: string
  AssistantPanelPageTabIcon: typeof PenLine
}> = [
  { assistantPanelPageTab: 'chat', assistantPanelPageTabIdName: 'notes', assistantPanelPageTabLabel: 'Notes', AssistantPanelPageTabIcon: NotebookPen },
  { assistantPanelPageTab: 'imagine', assistantPanelPageTabIdName: 'imagine', assistantPanelPageTabLabel: 'Imagine', AssistantPanelPageTabIcon: ImagePlus },
]

function readAssistantPanelPageTabElementId(assistantPanelPageTabIdName: 'notes' | 'imagine'): string {
  return `papeliz-assistant-panel-page-tab-${assistantPanelPageTabIdName}`
}

// The modes for your notes, in the blue switch on the Notes tab.
const papelizAssistantModeChoices: ReadonlyArray<{
  assistantMode: PapelizAssistantMode
  assistantModeLabel: string
  AssistantModeIcon: typeof PenLine
}> = [
  { assistantMode: 'ask', assistantModeLabel: 'Ask', AssistantModeIcon: MessageCircleQuestion },
  { assistantMode: 'plan', assistantModeLabel: 'Plan', AssistantModeIcon: ListChecks },
  { assistantMode: 'write', assistantModeLabel: 'Write', AssistantModeIcon: PenLine },
]

// The views the header opens in place of the tabs' pages, and the heading over each.
type PapelizAssistantPanelHeaderView = Exclude<PapelizAssistantPanelTab, PapelizAssistantPanelPageTab>

const papelizAssistantPanelHeaderViewTitles: Readonly<Record<PapelizAssistantPanelHeaderView, string>> = {
  sessions: 'Sessions',
  usage: 'Usage',
}

// On a phone's touch screen the panel fills the screen, and its header buttons grow to 40 px (the
// header to 48 px) so a finger finds them.
const papelizAssistantPanelHeaderButtonTouchClassName = 'max-md:pointer-coarse:size-10'

const papelizAssistantPanelPageId = 'papeliz-assistant-panel-page'

// The blue line under the chosen tab: its edges, measured from the tab row's sides, and how it last
// moved. It slides as the sliding switch's pill does (papeliz-sliding-choice-group.tsx): the edge on
// the way leads, the other follows a moment later, so it stretches and settles. The first draw and a
// resize put it in place without sliding.
interface PapelizAssistantPanelPageTabUnderline {
  underlineLeftEdge: number
  underlineRightEdge: number
  underlineMotion: 'in-place' | 'forward' | 'backward'
}

const papelizAssistantPanelPageTabUnderlineEase = 'cubic-bezier(0.22, 1, 0.36, 1)'

function readAssistantPanelPageTabUnderlineTransition(underlineMotion: PapelizAssistantPanelPageTabUnderline['underlineMotion']): string {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'none'
  const underlineFade = 'opacity 150ms ease-out'
  if (underlineMotion === 'in-place') return underlineFade
  const [leadingUnderlineEdge, trailingUnderlineEdge] = underlineMotion === 'forward' ? ['right', 'left'] : ['left', 'right']
  return `${leadingUnderlineEdge} 200ms ${papelizAssistantPanelPageTabUnderlineEase}, ${trailingUnderlineEdge} 280ms ${papelizAssistantPanelPageTabUnderlineEase} 20ms, ${underlineFade}`
}

// The line under the mode switch: what the mode does.
function describeAssistantModeHint(assistantMode: PapelizAssistantMode, isBypassPermissionOn: boolean): string {
  if (assistantMode === 'ask') return 'Answers from your notes and never changes them.'
  if (assistantMode === 'plan') return papelizAssistantPlanModeHintText
  return isBypassPermissionOn ? 'Edits, adds and deletes notes. Bypass permission is on, so changes apply at once.' : 'Edits, adds and deletes notes. You review each change.'
}

// The docked AI Assistant panel, for the AI only, in two levels. Under the header, quiet tabs pick the
// page: Notes, or Imagine (every picture made or brought in, to make more, clean and save). The Notes
// page has the blue Ask | Plan | Write switch, then the conversation and its box; the Imagine page is
// the Imagine view alone, at full height, with its own box. Going to Imagine and back keeps the mode.
// Sessions (every conversation saved in this vault) and Usage (the tokens and cost the assistant used
// here) open from the header in place of the page, with a way back; the tabs stay, with neither picked,
// and pressing one leaves them. The open note's Outline and Backlinks are under the file
// list, as This note. Until a provider is set up, the box under the conversation offers to choose one.
// While a plan is open to the page's full height the mode switch steps aside, and while a plan builds
// and Notes isn't the page open, a dot on the Notes tab says so.
export function PapelizAssistantPanel({ onAssistantPanelClose }: PapelizAssistantPanelProps) {
  const assistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.assistantPanelTab)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  const assistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantMode)
  const setAssistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantMode)
  const isBypassPermissionOn = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantChangePermission === 'bypass-permission')
  const isAssistantPlanOpenToFullHeight = usePapelizAssistantConversationStore(
    (conversationState) =>
      conversationState.fullHeightAssistantPlanChatEntryId !== null &&
      conversationState.chatEntries.some(
        (chatEntry) => chatEntry.chatEntryId === conversationState.fullHeightAssistantPlanChatEntryId && isPapelizAssistantPlanChatEntry(chatEntry),
      ),
  )
  const buildingPlanEntry = usePapelizAssistantConversationStore(selectPapelizAssistantBuildingPlanEntry)
  const buildingPlanActiveStepStatus = buildingPlanEntry === null ? null : (findPapelizAssistantPlanActiveStep(buildingPlanEntry.assistantPlanDocument)?.planStepStatus ?? null)
  // A plan building waits for the user while a step's changes wait for review, or a step failed.
  const isBuildingPlanWaitingForUser = buildingPlanActiveStepStatus === 'needs-review' || buildingPlanActiveStepStatus === 'failed'

  // Sessions and Usage open in place of the page; pressed again, they go back to Notes.
  const toggleAssistantPanelView = (assistantPanelView: PapelizAssistantPanelHeaderView) =>
    setAssistantPanelTab(assistantPanelTab === assistantPanelView ? 'chat' : assistantPanelView)
  const isAssistantPanelPageTabOpen = assistantPanelTab === 'chat' || assistantPanelTab === 'imagine'

  // The underline follows the chosen tab: measured once the tab row is laid out, again whenever the row
  // changes width (a narrow panel shows the icons alone), and left where it was, faded, while Sessions
  // or Usage is open.
  const assistantPanelPageTabListRef = useRef<HTMLDivElement>(null)
  const [assistantPanelPageTabUnderline, setAssistantPanelPageTabUnderline] = useState<PapelizAssistantPanelPageTabUnderline | null>(null)
  useLayoutEffect(() => {
    const assistantPanelPageTabList = assistantPanelPageTabListRef.current
    if (assistantPanelPageTabList === null) return
    const measureChosenPageTabEdges = () => {
      const chosenPageTab = assistantPanelPageTabList.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      if (chosenPageTab === null) return null
      return {
        underlineLeftEdge: chosenPageTab.offsetLeft,
        underlineRightEdge: assistantPanelPageTabList.clientWidth - chosenPageTab.offsetLeft - chosenPageTab.offsetWidth,
      }
    }
    // Placed before the frame is painted, so the line never shows in the wrong place (and a page the
    // browser holds hidden, which runs no frames, still gets it).
    const chosenPageTabEdges = measureChosenPageTabEdges()
    if (chosenPageTabEdges !== null) {
      setAssistantPanelPageTabUnderline((previousUnderline) => ({
        ...chosenPageTabEdges,
        underlineMotion:
          previousUnderline === null || previousUnderline.underlineLeftEdge === chosenPageTabEdges.underlineLeftEdge
            ? 'in-place'
            : chosenPageTabEdges.underlineLeftEdge > previousUnderline.underlineLeftEdge
              ? 'forward'
              : 'backward',
      }))
    }
    let measuredPageTabListWidth = assistantPanelPageTabList.clientWidth
    const pageTabListResizeObserver = new ResizeObserver(() => {
      if (assistantPanelPageTabList.clientWidth === measuredPageTabListWidth) return
      measuredPageTabListWidth = assistantPanelPageTabList.clientWidth
      const resizedPageTabEdges = measureChosenPageTabEdges()
      if (resizedPageTabEdges !== null) setAssistantPanelPageTabUnderline({ ...resizedPageTabEdges, underlineMotion: 'in-place' })
    })
    pageTabListResizeObserver.observe(assistantPanelPageTabList)
    return () => pageTabListResizeObserver.disconnect()
  }, [assistantPanelTab])

  return (
    <aside aria-label="AI Assistant" className="flex h-full min-h-0 flex-col bg-papeliz-surface-soft">
      <div className="flex h-10 flex-none items-center gap-2.5 bg-papeliz-tab-strip pt-1.5 pr-3 pl-[18px] shadow-[inset_0_-1px_0_var(--color-papeliz-line)] max-md:pointer-coarse:h-12 max-md:pointer-coarse:pt-0 max-md:pointer-coarse:pr-1.5">
        <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
          <WandSparkles className="size-3" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 truncate text-[15px] font-semibold">AI Assistant</h2>
        {/* New conversation, Sessions, Usage and Close. Notes and Imagine are the tabs below. The provider's
            settings open from the gear's AI Assistant page and from the composer's model chip. */}
        <div className="ml-auto flex items-center gap-0.5">
          <PapelizIconButton
            iconButtonLabel="New Conversation"
            iconButtonSize="small"
            className={papelizAssistantPanelHeaderButtonTouchClassName}
            onClick={() => {
              startNewAssistantChat()
              setAssistantPanelTab('chat')
            }}
          >
            <SquarePen className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton
            iconButtonLabel="Sessions"
            iconButtonSize="small"
            className={papelizAssistantPanelHeaderButtonTouchClassName}
            aria-pressed={assistantPanelTab === 'sessions'}
            onClick={() => toggleAssistantPanelView('sessions')}
          >
            <History className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton
            iconButtonLabel="Usage"
            iconButtonSize="small"
            className={papelizAssistantPanelHeaderButtonTouchClassName}
            aria-pressed={assistantPanelTab === 'usage'}
            onClick={() => toggleAssistantPanelView('usage')}
          >
            <ChartNoAxesColumn className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton
            iconButtonLabel="Close the AI Assistant Panel"
            iconButtonSize="small"
            className={papelizAssistantPanelHeaderButtonTouchClassName}
            onClick={onAssistantPanelClose}
          >
            <X className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
        </div>
      </div>

      {/* The pages: quiet tabs with a blue underline that slides between them, like a page's tabs, so
          they don't look like the mode switch under them. Hovering a tab previews a light underline.
          Icon and label, or the icon alone (the label as its tooltip) when the panel is narrow. */}
      <div
        ref={assistantPanelPageTabListRef}
        role="tablist"
        aria-label="AI Assistant pages"
        className="@container relative flex flex-none items-end gap-4 border-b border-papeliz-line px-4"
      >
        {papelizAssistantPanelPageTabs.map(({ assistantPanelPageTab, assistantPanelPageTabIdName, assistantPanelPageTabLabel, AssistantPanelPageTabIcon }) => {
          const isAssistantPanelPageTabChosen = assistantPanelTab === assistantPanelPageTab
          return (
            <button
              key={assistantPanelPageTab}
              type="button"
              role="tab"
              aria-selected={isAssistantPanelPageTabChosen}
              aria-controls={isAssistantPanelPageTabChosen ? papelizAssistantPanelPageId : undefined}
              id={readAssistantPanelPageTabElementId(assistantPanelPageTabIdName)}
              title={assistantPanelPageTabLabel}
              onClick={() => setAssistantPanelTab(assistantPanelPageTab)}
              className={joinPapelizClassNames(
                'relative flex h-9 items-center gap-1.5 px-0.5 text-[13px] font-medium transition-colors duration-200 ease-out motion-reduce:transition-none max-md:pointer-coarse:h-11',
                isAssistantPanelPageTabChosen
                  ? 'text-papeliz-ink'
                  : 'text-papeliz-ink-muted hover:text-papeliz-ink after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-papeliz-blue/25 after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-100',
              )}
            >
              <AssistantPanelPageTabIcon
                className={joinPapelizClassNames(
                  'size-[15px] flex-none transition-colors duration-200 ease-out motion-reduce:transition-none',
                  isAssistantPanelPageTabChosen && 'text-papeliz-blue',
                )}
                aria-hidden="true"
              />
              <span className="@max-[15rem]:sr-only">{assistantPanelPageTabLabel}</span>
              {assistantPanelPageTab === 'chat' && buildingPlanEntry !== null && !isAssistantPanelPageTabChosen && (
                <span
                  data-papeliz-assistant-panel-plan-dot=""
                  title={isBuildingPlanWaitingForUser ? 'A plan is waiting for you' : 'A plan is building'}
                  className={joinPapelizClassNames(
                    'absolute top-1.5 -right-1 size-[7px] rounded-full ring-2 ring-papeliz-surface-soft max-md:pointer-coarse:top-2.5',
                    isBuildingPlanWaitingForUser ? 'bg-papeliz-warning-ink' : 'bg-papeliz-blue',
                  )}
                >
                  <span className="sr-only">{isBuildingPlanWaitingForUser ? '(a plan is waiting for you)' : '(a plan is building)'}</span>
                </span>
              )}
            </button>
          )
        })}
        {assistantPanelPageTabUnderline !== null && (
          <span
            aria-hidden="true"
            data-papeliz-assistant-panel-page-tab-underline=""
            className="pointer-events-none absolute -bottom-px h-0.5 rounded-full bg-papeliz-blue"
            style={
              {
                left: assistantPanelPageTabUnderline.underlineLeftEdge,
                right: assistantPanelPageTabUnderline.underlineRightEdge,
                opacity: isAssistantPanelPageTabOpen ? 1 : 0,
                transition: readAssistantPanelPageTabUnderlineTransition(assistantPanelPageTabUnderline.underlineMotion),
              } satisfies CSSProperties
            }
          />
        )}
      </div>

      {/* The modes for your notes: a solid blue sliding switch, so the chosen one stands out in both themes.
          They follow the panel's width: icon and label when wide, the label alone at the default
          width, and the icon alone (the label as its tooltip) when narrow. */}
      {assistantPanelTab === 'chat' && !isAssistantPlanOpenToFullHeight && (
        <div className="@container flex-none px-3.5 pt-2.5">
          <PapelizSlidingChoiceGroup
            slidingChoiceGroupLabel="AI Assistant mode"
            slidingChoiceGroupRole="radiogroup"
            slidingChoiceGroupTone="solid-blue"
            chosenSlidingChoiceValue={assistantMode}
            onSlidingChoiceSelect={setAssistantMode}
            slidingChoices={papelizAssistantModeChoices.map(({ assistantMode: modeValue, assistantModeLabel, AssistantModeIcon }) => ({
              slidingChoiceValue: modeValue,
              slidingChoiceTitle: assistantModeLabel,
              slidingChoiceContent: (
                <>
                  <AssistantModeIcon className="hidden size-3.5 @max-[17.5rem]:block @min-[26rem]:block" aria-hidden="true" />
                  <span className="truncate @max-[17.5rem]:sr-only">{assistantModeLabel}</span>
                </>
              ),
            }))}
          />
          <p className="mt-1.5 px-1 text-[12px] leading-snug text-papeliz-ink-muted">{describeAssistantModeHint(assistantMode, isBypassPermissionOn)}</p>
        </div>
      )}
      {!isAssistantPanelPageTabOpen && (
        <div className="flex flex-none items-center gap-1.5 px-2.5 pt-2">
          <PapelizIconButton
            iconButtonLabel="Back to Notes"
            iconButtonSize="small"
            className={papelizAssistantPanelHeaderButtonTouchClassName}
            onClick={() => setAssistantPanelTab('chat')}
          >
            <ArrowLeft className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <h3 className="text-[14px] font-semibold">{papelizAssistantPanelHeaderViewTitles[assistantPanelTab]}</h3>
        </div>
      )}

      {isAssistantPanelPageTabOpen && (
        <div
          id={papelizAssistantPanelPageId}
          role="tabpanel"
          aria-labelledby={readAssistantPanelPageTabElementId(assistantPanelTab === 'chat' ? 'notes' : 'imagine')}
          className="flex min-h-0 flex-1 flex-col"
        >
          {assistantPanelTab === 'chat' ? (
            <>
              <PapelizAssistantChatView />
              {/* In an End-to-end vault: the notes it reads go decrypted to the provider. */}
              <PapelizEndToEndVaultAssistantLine />
              {/* Before a provider is set up the box carries the way to set one up (and an earlier conversation can still be read). */}
              <div className="flex-none px-3.5 pb-2">
                <PapelizAssistantComposer composerPlacement="panel" />
              </div>
            </>
          ) : (
            <PapelizAssistantImagineView />
          )}
        </div>
      )}
      {assistantPanelTab === 'sessions' && <PapelizAssistantSessionsView />}
      {assistantPanelTab === 'usage' && <PapelizAssistantUsageView />}
    </aside>
  )
}
