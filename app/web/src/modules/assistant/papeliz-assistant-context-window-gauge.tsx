import { ArrowRight, SquarePen } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { papelizComposerRowGiveWayClassNames } from './papeliz-assistant-composer-row-fit'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import {
  addUpPapelizAssistantModelCosts,
  describePapelizAssistantAddedUpCost,
  findPapelizAssistantModelPrice,
  usePapelizAssistantModelPricesStore,
  workOutPapelizAssistantModelCost,
} from './papeliz-assistant-model-prices'
import { describePapelizAssistantModelShortName } from './papeliz-assistant-model-short-names'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantModelContextWindowTokenCount, findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  selectActivePapelizAssistantProviderContextWindowTokenCount,
  selectActivePapelizAssistantProviderId,
  selectActivePapelizAssistantProviderModelName,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'
import {
  formatPapelizAssistantContextWindowTokenCountShort,
  formatPapelizAssistantTokenCountInFull,
  formatPapelizAssistantTokenCountShort,
  readPapelizAssistantContextWindowGauge,
  type PapelizAssistantContextWindowFillLevel,
  type PapelizAssistantModelTokenUsageTally,
  type PapelizAssistantTokenUsageTally,
} from './papeliz-assistant-token-usage'

// The context ring beside the model chip: how full the model's context window is for this
// conversation, after the last answer (that request's input plus its output). Always there: an empty
// ring before the first message, and a dashed one when the window's size is not known. It is a button
// whose card tells the figures: on hover with a mouse (after a short pause, and it stays while the
// pointer moves into it), on a tap or a click (which keep it open), and on keyboard focus. Esc or a
// press outside closes it. The ring's name carries the card's first line.

const papelizContextWindowFillLevelClassNames: Record<PapelizAssistantContextWindowFillLevel, string> = {
  roomy: 'text-papeliz-ink-muted',
  filling: 'text-papeliz-warning-ink',
  'nearly-full': 'text-papeliz-diff-removed-ink',
}

// The card's bar is blue while there is room.
const papelizContextWindowBarClassNames: Record<PapelizAssistantContextWindowFillLevel, string> = {
  roomy: 'text-papeliz-blue',
  filling: 'text-papeliz-warning-ink',
  'nearly-full': 'text-papeliz-diff-removed-ink',
}

const papelizContextWindowRingRadius = 6.5
const papelizContextWindowRingCircumference = 2 * Math.PI * papelizContextWindowRingRadius
// The least of the ring drawn once anything is sent, so 1% still shows.
const papelizContextWindowRingLeastFilledFraction = 0.035
// The ring's percent shows beside it from this full.
const papelizContextWindowRingPercentShownFraction = 0.8
const papelizContextWindowCardHoverOpenMilliseconds = 280
const papelizContextWindowCardHoverCloseMilliseconds = 220
// The sizes the card offers for a window that is not known.
const papelizContextWindowCommonTokenCounts = [32_768, 131_072, 262_144, 1_048_576]

type PapelizContextWindowCardOpenWay = 'closed' | 'hover' | 'focus' | 'pinned'

interface PapelizAssistantContextWindowRingProps {
  contextTokenCount: number
  isContextTokenCountEstimated: boolean
  // This conversation's totals, and the same by model for its cost.
  conversationTokenUsageTally: PapelizAssistantTokenUsageTally
  conversationModelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[]
  // A strip along the box's top edge, where the card opens.
  contextWindowCardHostElement: HTMLElement | null
  // Left out where a conversation can't be started afresh from the card.
  onNewConversation?: () => void
}

export function PapelizAssistantContextWindowRing({
  contextTokenCount,
  isContextTokenCountEstimated,
  conversationTokenUsageTally,
  conversationModelTokenUsageTallies,
  contextWindowCardHostElement,
  onNewConversation,
}: PapelizAssistantContextWindowRingProps) {
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderModelName)
  // A context window set in the provider's Advanced settings counts before the model's listed one.
  const activeProviderContextWindowTokenCount = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderContextWindowTokenCount)
  const listedContextWindowTokenCount = findPapelizAssistantModelContextWindowTokenCount(activeProviderModelName)
  const modelContextWindowTokenCount = activeProviderContextWindowTokenCount ?? listedContextWindowTokenCount
  const contextWindowGaugeReading = readPapelizAssistantContextWindowGauge(contextTokenCount, isContextTokenCountEstimated, modelContextWindowTokenCount)
  const contextWindowRingButtonRef = useRef<HTMLButtonElement>(null)
  const contextWindowCardRef = useRef<HTMLDivElement>(null)
  const contextWindowCardId = useId()
  const [contextWindowCardOpenWay, setContextWindowCardOpenWay] = useState<PapelizContextWindowCardOpenWay>('closed')
  const contextWindowCardHoverTimerRef = useRef<number | null>(null)
  // Focus given back to the ring as the card closes doesn't open it again.
  const isRingFocusFromClosingCardRef = useRef(false)
  const isContextWindowCardOpen = contextWindowCardOpenWay !== 'closed' && contextWindowCardHostElement !== null

  const clearContextWindowCardHoverTimer = () => {
    if (contextWindowCardHoverTimerRef.current !== null) window.clearTimeout(contextWindowCardHoverTimerRef.current)
    contextWindowCardHoverTimerRef.current = null
  }
  const openContextWindowCardAfterHover = () => {
    clearContextWindowCardHoverTimer()
    contextWindowCardHoverTimerRef.current = window.setTimeout(
      () => setContextWindowCardOpenWay((openWay) => (openWay === 'closed' ? 'hover' : openWay)),
      papelizContextWindowCardHoverOpenMilliseconds,
    )
  }
  const closeContextWindowCardAfterLeave = () => {
    clearContextWindowCardHoverTimer()
    contextWindowCardHoverTimerRef.current = window.setTimeout(
      () => setContextWindowCardOpenWay((openWay) => (openWay === 'hover' ? 'closed' : openWay)),
      papelizContextWindowCardHoverCloseMilliseconds,
    )
  }
  const closeContextWindowCard = (shouldFocusRing: boolean) => {
    clearContextWindowCardHoverTimer()
    setContextWindowCardOpenWay('closed')
    if (!shouldFocusRing) return
    isRingFocusFromClosingCardRef.current = true
    contextWindowRingButtonRef.current?.focus({ preventScroll: true })
    isRingFocusFromClosingCardRef.current = false
  }
  const isInsideContextWindowRingOrCard = (eventTarget: EventTarget | null) =>
    eventTarget instanceof Node && (contextWindowRingButtonRef.current?.contains(eventTarget) === true || contextWindowCardRef.current?.contains(eventTarget) === true)

  useEffect(() => clearContextWindowCardHoverTimer, [])
  useEffect(() => {
    if (contextWindowCardOpenWay === 'closed') return
    // A press anywhere else closes it.
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!isInsideContextWindowRingOrCard(pointerEvent.target)) closeContextWindowCard(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextWindowCardOpenWay])

  const shownFilledFraction = contextWindowGaugeReading.contextWindowFilledFraction === null ? null : Math.min(1, contextWindowGaugeReading.contextWindowFilledFraction)
  const isRingPercentShown = shownFilledFraction !== null && shownFilledFraction >= papelizContextWindowRingPercentShownFraction
  return (
    <>
      <button
        ref={contextWindowRingButtonRef}
        type="button"
        data-papeliz-assistant-context-window-ring
        aria-haspopup="dialog"
        aria-expanded={isContextWindowCardOpen}
        aria-controls={isContextWindowCardOpen ? contextWindowCardId : undefined}
        aria-label={`${contextWindowGaugeReading.contextWindowGaugeDescription}. Show details`}
        onPointerEnter={(pointerEvent) => pointerEvent.pointerType === 'mouse' && openContextWindowCardAfterHover()}
        onPointerLeave={(pointerEvent) => pointerEvent.pointerType === 'mouse' && closeContextWindowCardAfterLeave()}
        onClick={(clickEvent) => {
          clearContextWindowCardHoverTimer()
          if (contextWindowCardOpenWay === 'pinned') {
            setContextWindowCardOpenWay('closed')
            return
          }
          setContextWindowCardOpenWay('pinned')
          // From the keyboard, Enter or Space moves into the card.
          if (clickEvent.detail === 0) {
            window.requestAnimationFrame(() => contextWindowCardRef.current?.querySelector<HTMLElement>('button, input, a[href]')?.focus({ preventScroll: true }))
          }
        }}
        onFocus={(focusEvent) => {
          if (isRingFocusFromClosingCardRef.current || !focusEvent.currentTarget.matches(':focus-visible')) return
          setContextWindowCardOpenWay((openWay) => (openWay === 'closed' ? 'focus' : openWay))
        }}
        onBlur={(focusEvent) => {
          if (contextWindowCardOpenWay === 'focus' && !isInsideContextWindowRingOrCard(focusEvent.relatedTarget)) closeContextWindowCard(false)
        }}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key !== 'Escape' || contextWindowCardOpenWay === 'closed') return
          keyboardEvent.preventDefault()
          keyboardEvent.stopPropagation()
          closeContextWindowCard(false)
        }}
        className={joinPapelizClassNames(
          'flex h-[30px] min-w-[30px] flex-none items-center justify-center gap-[5px] rounded-lg px-1.5 text-[11.5px] font-medium whitespace-nowrap tabular-nums transition-colors hover:bg-papeliz-hover aria-expanded:bg-papeliz-hover pointer-coarse:h-10 pointer-coarse:min-w-10',
          papelizContextWindowFillLevelClassNames[contextWindowGaugeReading.contextWindowFillLevel],
          isRingPercentShown && 'font-semibold',
          papelizComposerRowGiveWayClassNames.contextRingTight,
        )}
      >
        <svg viewBox="0 0 18 18" className="size-[18px] flex-none -rotate-90" aria-hidden="true">
          {shownFilledFraction === null ? (
            <circle cx="9" cy="9" r={papelizContextWindowRingRadius} fill="none" strokeWidth="2" strokeDasharray="2.2 2.4" className="stroke-papeliz-line-strong" />
          ) : (
            <>
              <circle cx="9" cy="9" r={papelizContextWindowRingRadius} fill="none" strokeWidth="2.5" className="stroke-papeliz-line-strong" />
              {contextTokenCount > 0 && (
                <circle
                  cx="9"
                  cy="9"
                  r={papelizContextWindowRingRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={papelizContextWindowRingCircumference}
                  strokeDashoffset={papelizContextWindowRingCircumference * (1 - Math.max(shownFilledFraction, papelizContextWindowRingLeastFilledFraction))}
                  className="transition-[stroke-dashoffset] duration-300"
                />
              )}
            </>
          )}
        </svg>
        {isRingPercentShown && (
          <span data-papeliz-composer-give-way-ring-percent className={papelizComposerRowGiveWayClassNames.contextRingPercent}>
            {contextWindowGaugeReading.contextWindowFilledPercentageLabel}
          </span>
        )}
      </button>
      {isContextWindowCardOpen &&
        createPortal(
          <div
            ref={contextWindowCardRef}
            id={contextWindowCardId}
            role="dialog"
            aria-label="Context window"
            // Takes focus back when the part that had it goes, such as the size once it is saved.
            tabIndex={-1}
            onPointerEnter={(pointerEvent) => pointerEvent.pointerType === 'mouse' && clearContextWindowCardHoverTimer()}
            onPointerLeave={(pointerEvent) => pointerEvent.pointerType === 'mouse' && contextWindowCardOpenWay === 'hover' && closeContextWindowCardAfterLeave()}
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key !== 'Escape') return
              keyboardEvent.preventDefault()
              keyboardEvent.stopPropagation()
              closeContextWindowCard(true)
            }}
            onBlur={(focusEvent) => {
              if (focusEvent.relatedTarget !== null && !isInsideContextWindowRingOrCard(focusEvent.relatedTarget)) closeContextWindowCard(false)
            }}
            className="papeliz-pop-enter absolute right-0 bottom-0 mb-2 w-[min(286px,100%)] rounded-2xl outline-none border border-papeliz-line bg-papeliz-surface px-3.5 pt-3 pb-2.5 text-left text-[12.5px] text-papeliz-ink shadow-papeliz-pop"
          >
            <PapelizAssistantContextWindowCardRows
              contextTokenCount={contextTokenCount}
              isContextTokenCountEstimated={isContextTokenCountEstimated}
              modelContextWindowTokenCount={modelContextWindowTokenCount}
              isContextWindowSetInAdvanced={activeProviderContextWindowTokenCount !== null}
              contextWindowFilledPercentageLabel={contextWindowGaugeReading.contextWindowFilledPercentageLabel}
              contextWindowFillLevel={contextWindowGaugeReading.contextWindowFillLevel}
              shownFilledFraction={shownFilledFraction}
              activeProviderModelName={activeProviderModelName}
              conversationTokenUsageTally={conversationTokenUsageTally}
              conversationModelTokenUsageTallies={conversationModelTokenUsageTallies}
              onNewConversation={
                onNewConversation === undefined
                  ? undefined
                  : () => {
                      closeContextWindowCard(false)
                      onNewConversation()
                    }
              }
              onContextWindowCardLeave={() => closeContextWindowCard(false)}
            />
          </div>,
          contextWindowCardHostElement,
        )}
    </>
  )
}

// One label-and-value row of the card, its value right-aligned with an optional quieter line under it.
function PapelizContextWindowCardRow({ rowLabel, rowValue, rowValueDetail }: { rowLabel: string; rowValue: ReactNode; rowValueDetail?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex-none text-papeliz-ink-subtle">{rowLabel}</dt>
      <dd className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">
        {rowValue}
        {rowValueDetail !== undefined && <small className="block text-[11.5px] text-papeliz-ink-subtle">{rowValueDetail}</small>}
      </dd>
    </div>
  )
}

const papelizContextWindowCardLinkClassName = 'font-medium text-papeliz-blue hover:underline'

// The card, top to bottom: how full, a bar, then Model, Window, this conversation's tokens and cost,
// a line when it fills, and the way to Usage.
function PapelizAssistantContextWindowCardRows({
  contextTokenCount,
  isContextTokenCountEstimated,
  modelContextWindowTokenCount,
  isContextWindowSetInAdvanced,
  contextWindowFilledPercentageLabel,
  contextWindowFillLevel,
  shownFilledFraction,
  activeProviderModelName,
  conversationTokenUsageTally,
  conversationModelTokenUsageTallies,
  onNewConversation,
  onContextWindowCardLeave,
}: {
  contextTokenCount: number
  isContextTokenCountEstimated: boolean
  modelContextWindowTokenCount: number | null
  isContextWindowSetInAdvanced: boolean
  contextWindowFilledPercentageLabel: string | null
  contextWindowFillLevel: PapelizAssistantContextWindowFillLevel
  shownFilledFraction: number | null
  activeProviderModelName: string
  conversationTokenUsageTally: PapelizAssistantTokenUsageTally
  conversationModelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[]
  onNewConversation: (() => void) | undefined
  onContextWindowCardLeave: () => void
}) {
  const userModelPrices = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.userModelPrices)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const openAssistantProviderSettingsPage = () => {
    onContextWindowCardLeave()
    requestAssistantProviderSettingsPage()
  }
  const shortContextTokenCount = `${isContextTokenCountEstimated ? 'about ' : ''}${formatPapelizAssistantTokenCountShort(contextTokenCount)}`
  const conversationAddedUpCost = addUpPapelizAssistantModelCosts(
    conversationModelTokenUsageTallies.map((modelTokenUsageTally) =>
      workOutPapelizAssistantModelCost(modelTokenUsageTally, findPapelizAssistantModelPrice(modelTokenUsageTally.providerModelName, userModelPrices)),
    ),
  )
  const conversationRequestCount = conversationTokenUsageTally.assistantRequestCount
  const isMetaModel = /^muse-/i.test(activeProviderModelName.slice(activeProviderModelName.lastIndexOf('/') + 1))

  return (
    <>
      <div className="flex items-baseline justify-between text-[11.5px] font-semibold tracking-[0.02em] text-papeliz-ink-subtle uppercase">
        <span>Context</span>
        {contextWindowFilledPercentageLabel !== null && (
          <span className={joinPapelizClassNames('text-[12.5px] tracking-normal normal-case tabular-nums', papelizContextWindowFillLevelClassNames[contextWindowFillLevel])}>
            {contextWindowFilledPercentageLabel}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums">
        {shortContextTokenCount}{' '}
        <span className="text-[13px] font-medium text-papeliz-ink-muted">
          {modelContextWindowTokenCount === null ? 'tokens' : `of ${formatPapelizAssistantContextWindowTokenCountShort(modelContextWindowTokenCount)} tokens`}
        </span>
      </p>
      {shownFilledFraction !== null && (
        <div className={joinPapelizClassNames('mt-2 mb-2.5 h-[5px] overflow-hidden rounded-full bg-papeliz-surface-gray', papelizContextWindowBarClassNames[contextWindowFillLevel])}>
          <i className="block h-full rounded-[inherit] bg-current" style={{ width: `${shownFilledFraction * 100}%`, minWidth: contextTokenCount > 0 ? 3 : 0 }} />
        </div>
      )}
      {modelContextWindowTokenCount === null && activeProviderModelName.length > 0 && <PapelizAssistantContextWindowSizeSetter />}
      <dl className={joinPapelizClassNames('flex flex-col gap-[5px]', shownFilledFraction === null && 'mt-2.5')}>
        <PapelizContextWindowCardRow
          rowLabel="Model"
          rowValue={activeProviderModelName.length > 0 ? activeProviderModelName : 'None chosen yet'}
          {...(describePapelizAssistantModelShortName(activeProviderModelName).isContributorModel ? { rowValueDetail: 'Contributor mode' } : {})}
        />
        <PapelizContextWindowCardRow
          rowLabel="Window"
          rowValue={modelContextWindowTokenCount === null ? 'Not known' : formatPapelizAssistantTokenCountInFull(modelContextWindowTokenCount)}
          {...(modelContextWindowTokenCount === null
            ? {}
            : {
                rowValueDetail: isContextWindowSetInAdvanced ? (
                  <>
                    Set in Advanced ·{' '}
                    <button type="button" onClick={openAssistantProviderSettingsPage} className={papelizContextWindowCardLinkClassName}>
                      Change
                    </button>
                  </>
                ) : isMetaModel ? (
                  'Meta’s listed size'
                ) : (
                  'Listed size'
                ),
              })}
        />
        {conversationRequestCount > 0 && (
          <>
            <PapelizContextWindowCardRow
              rowLabel="This conversation"
              rowValue={`${conversationTokenUsageTally.isAssistantTokenCountEstimated ? 'about ' : ''}${formatPapelizAssistantTokenCountShort(conversationTokenUsageTally.assistantInputTokenCount)} in · ${formatPapelizAssistantTokenCountShort(conversationTokenUsageTally.assistantOutputTokenCount)} out`}
              rowValueDetail={conversationRequestCount === 1 ? '1 request' : `${conversationRequestCount} requests`}
            />
            <PapelizContextWindowCardRow
              rowLabel="Cost"
              rowValue={conversationAddedUpCost === null ? 'No price' : describePapelizAssistantAddedUpCost(conversationAddedUpCost)}
              rowValueDetail={
                conversationAddedUpCost === null ? (
                  <button type="button" onClick={openAssistantProviderSettingsPage} className={papelizContextWindowCardLinkClassName}>
                    Add a price
                  </button>
                ) : conversationAddedUpCost.isCostEstimated ? (
                  'From the price list'
                ) : (
                  'The provider’s figure'
                )
              }
            />
          </>
        )}
      </dl>
      {contextTokenCount === 0 ? (
        <p className="mt-2.5 rounded-xl bg-papeliz-surface-soft px-2.5 py-2 leading-snug text-papeliz-ink-muted">Nothing sent yet in this conversation.</p>
      ) : contextWindowFillLevel === 'nearly-full' ? (
        <div className="mt-2.5 rounded-xl bg-papeliz-diff-removed px-2.5 py-2 leading-snug text-papeliz-diff-removed-ink">
          <b className="font-semibold">Nearly full.</b> The model starts to lose the beginning of this conversation.
          {onNewConversation !== undefined && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={onNewConversation} className="h-7 bg-papeliz-surface px-2.5 text-[12px]">
                <SquarePen className="size-3.5" aria-hidden="true" />
                New conversation
              </PapelizPillButton>
            </div>
          )}
        </div>
      ) : contextWindowFillLevel === 'filling' ? (
        <p className="mt-2.5 rounded-xl bg-papeliz-warning px-2.5 py-2 leading-snug text-papeliz-warning-ink">
          Filling up. A new conversation keeps answers sharp.
          {onNewConversation !== undefined && (
            <>
              {' '}
              <button type="button" onClick={onNewConversation} className={papelizContextWindowCardLinkClassName}>
                New conversation
              </button>
            </>
          )}
        </p>
      ) : null}
      <div className="-mx-3.5 mt-2.5 mb-2 h-px bg-papeliz-line" />
      <div className="flex items-center justify-between gap-2 text-[12px] text-papeliz-ink-subtle">
        <span>Tokens and cost for the vault</span>
        <button
          type="button"
          onClick={() => {
            onContextWindowCardLeave()
            setAssistantPanelTab('usage')
          }}
          className={joinPapelizClassNames('inline-flex items-center gap-1', papelizContextWindowCardLinkClassName)}
        >
          Usage
          <ArrowRight className="size-[13px]" aria-hidden="true" />
        </button>
      </div>
    </>
  )
}

// For a window whose size is not known: type it, or pick a common size, and Save. It is kept in the
// provider's Advanced settings, where it can be changed later, and the ring fills from then on.
function PapelizAssistantContextWindowSizeSetter() {
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore(selectActivePapelizAssistantProviderId)
  const activeProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId[activeAssistantProviderId])
  const saveAssistantProviderSettings = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.saveAssistantProviderSettings)
  const [contextWindowSizeText, setContextWindowSizeText] = useState('')
  const [contextWindowSizeProblem, setContextWindowSizeProblem] = useState<string | null>(null)
  if (activeProviderSettings === undefined) return null

  const saveContextWindowSize = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const typedContextWindowTokenCount = Number(contextWindowSizeText.replace(/[\s,_]/g, ''))
    if (!Number.isInteger(typedContextWindowTokenCount) || typedContextWindowTokenCount < 1) {
      setContextWindowSizeProblem('Type a whole number of tokens.')
      return
    }
    setContextWindowSizeProblem(null)
    // The setter goes once the size is known, so the card keeps the focus it had.
    submitEvent.currentTarget.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true })
    void saveAssistantProviderSettings([{ ...activeProviderSettings, providerContextWindowTokenCount: typedContextWindowTokenCount }])
  }
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="text-[11.5px] leading-snug text-papeliz-ink-subtle">The size of this model’s window isn’t known. Set it and the ring fills:</span>
      <form onSubmit={saveContextWindowSize} className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={contextWindowSizeText}
          aria-label="Context window, in tokens"
          aria-invalid={contextWindowSizeProblem !== null}
          placeholder="Tokens, e.g. 131072"
          onChange={(changeEvent) => setContextWindowSizeText(changeEvent.target.value)}
          className="h-[30px] w-full min-w-0 rounded-full border border-papeliz-line-strong bg-papeliz-surface px-3 text-[12.5px] tabular-nums outline-none placeholder:text-papeliz-ink-subtle focus:border-papeliz-blue-line"
        />
        <PapelizPillButton type="submit" pillButtonVariant="primary" pillButtonSize="small" className="h-[30px]">
          Save
        </PapelizPillButton>
      </form>
      {contextWindowSizeProblem !== null && <span className="text-[11.5px] text-papeliz-diff-removed-ink">{contextWindowSizeProblem}</span>}
      <div role="group" aria-label="Common sizes" className="flex flex-wrap gap-1">
        {papelizContextWindowCommonTokenCounts.map((commonContextWindowTokenCount) => (
          <button
            key={commonContextWindowTokenCount}
            type="button"
            aria-label={`${formatPapelizAssistantTokenCountInFull(commonContextWindowTokenCount)} tokens`}
            onClick={() => setContextWindowSizeText(String(commonContextWindowTokenCount))}
            className="h-6 rounded-full border border-papeliz-line px-2.5 text-[11.5px] text-papeliz-ink-muted hover:bg-papeliz-hover"
          >
            {formatPapelizAssistantContextWindowTokenCountShort(commonContextWindowTokenCount)}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] text-papeliz-ink-subtle">Saved in {findPapelizAssistantProviderPreset(activeProviderSettings.papelizAssistantProviderId).providerPresetDisplayName}’s Advanced settings.</span>
    </div>
  )
}

// The chat box's ring: the notes conversation's figures, and New conversation in its card.
export function PapelizAssistantContextWindowGauge({ contextWindowCardHostElement }: { contextWindowCardHostElement: HTMLElement | null }) {
  const chatSessionTokenUsage = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionTokenUsage)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  return (
    <PapelizAssistantContextWindowRing
      contextTokenCount={chatSessionTokenUsage.chatSessionContextTokenCount}
      isContextTokenCountEstimated={chatSessionTokenUsage.isChatSessionContextTokenCountEstimated}
      conversationTokenUsageTally={chatSessionTokenUsage.chatSessionTokenUsageTally}
      conversationModelTokenUsageTallies={chatSessionTokenUsage.chatSessionModelTokenUsageTallies}
      contextWindowCardHostElement={contextWindowCardHostElement}
      onNewConversation={startNewAssistantChat}
    />
  )
}
