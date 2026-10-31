'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { PapelizAccountBrand, PapelizAccountCardFrame, PapelizAccountCardMark, papelizAccountPrimaryButtonClassName } from './papeliz-account-card-frame'
import {
  finishPapelizAccountLoadingBar,
  papelizAccountLoadingFinishMilliseconds,
  reachPapelizAccountLoadingStep,
  readPapelizAccountLastLoadingWords,
  readPapelizAccountLastShownLoadingPercent,
  readPapelizAccountLoadingBarIsUnfinished,
  readPapelizAccountLoadingMotionIsReduced,
  readPapelizAccountLoadingTargetPercent,
  showPapelizAccountLoadingPercent,
  type PapelizAccountLoadingStep,
} from './papeliz-account-loading-progress'
import papelizAccountStyles from './papeliz-account.module.css'

// How quickly the bar follows its target while creeping, and into a new step's mark.
const papelizAccountLoadingFollowMilliseconds = 260

// Three dots after a loading title that build up one by one. Screen readers hear the title once,
// without the dots; an invisible copy before the title keeps the words themselves centred.
function PapelizAccountLoadingEllipsis({ isPapelizAccountLoadingEllipsisSpacer = false }: { isPapelizAccountLoadingEllipsisSpacer?: boolean }) {
  return (
    <span aria-hidden="true" className={isPapelizAccountLoadingEllipsisSpacer ? 'invisible' : papelizAccountStyles.papelizAccountLoadingEllipsis}>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  )
}

type PapelizAccountStateScreenProps = {
  // `loading` is the sign-in card's frame and mark with a filling bar, `error` the red card, `done`
  // a plain card.
  papelizAccountStateKind: 'loading' | 'error' | 'done'
  papelizAccountStateTitle: string
  papelizAccountStateText?: ReactNode
  papelizAccountStateActionLabel?: string
  onPapelizAccountStateAction?: () => void
  papelizAccountStateActionHref?: string
  // The page's step this loading screen stands for; the bar moves to its mark.
  papelizAccountLoadingStep?: PapelizAccountLoadingStep
  // Shown by `PapelizAccountAfterLoadingBar` while the bar fills to the end.
  isPapelizAccountLoadingFinishing?: boolean
}

// Wraps a finished screen (the sign-in card, the account, an error) that replaces a loading screen.
// While a loading bar is unfinished, the bar first fills to the end in a short, fixed time, then the
// screen shows, so a fast load finishes fast. With reduced motion, or in a hidden tab, it shows at once.
export function PapelizAccountAfterLoadingBar({ children }: { children: ReactNode }) {
  const [papelizAccountLoadingBarIsFinishing, setPapelizAccountLoadingBarIsFinishing] = useState(
    () => readPapelizAccountLoadingBarIsUnfinished() && !readPapelizAccountLoadingMotionIsReduced() && document.visibilityState === 'visible',
  )
  const [papelizAccountLastLoadingWords] = useState(readPapelizAccountLastLoadingWords)

  useEffect(() => {
    if (!papelizAccountLoadingBarIsFinishing) {
      finishPapelizAccountLoadingBar()
      return
    }
    const loadingBarFinishTimer = window.setTimeout(() => {
      finishPapelizAccountLoadingBar()
      setPapelizAccountLoadingBarIsFinishing(false)
    }, papelizAccountLoadingFinishMilliseconds + 40)
    return () => window.clearTimeout(loadingBarFinishTimer)
  }, [papelizAccountLoadingBarIsFinishing])

  if (papelizAccountLoadingBarIsFinishing) {
    return (
      <PapelizAccountStateScreen
        papelizAccountStateKind="loading"
        papelizAccountStateTitle={papelizAccountLastLoadingWords.lastLoadingTitle}
        papelizAccountStateText={papelizAccountLastLoadingWords.lastLoadingText}
        isPapelizAccountLoadingFinishing
      />
    )
  }
  return <>{children}</>
}

// A whole-page state. Loading sits in the sign-in card's own frame, so the card is already in place
// when the page is ready. Errors and endings show the brand, one card, then the action.
export function PapelizAccountStateScreen({
  papelizAccountStateKind,
  papelizAccountStateTitle,
  papelizAccountStateText,
  papelizAccountStateActionLabel,
  onPapelizAccountStateAction,
  papelizAccountStateActionHref,
  papelizAccountLoadingStep = 'page-shown',
  isPapelizAccountLoadingFinishing = false,
}: PapelizAccountStateScreenProps) {
  const papelizAccountStateIsError = papelizAccountStateKind === 'error'
  const papelizAccountLoadingBarRef = useRef<HTMLElement>(null)
  // Where this bar starts, fixed the first time its effect runs: a second run (React runs effects
  // twice while developing) must not start it again from the target it has meanwhile moved to.
  const papelizAccountLoadingBarStartRef = useRef<{ loadingBarStartKey: string; loadingBarStartPercent: number } | null>(null)
  const papelizAccountLoadingWordsText = typeof papelizAccountStateText === 'string' ? papelizAccountStateText : undefined

  // The bar follows the page's loading progress, not this screen's own clock. The stylesheet moves
  // it until this code runs; from then on it starts where the last bar was (each new loading screen
  // carries on), creeps toward the next step, and when finishing fills to the end. Before paint,
  // so a new screen never shows its bar back at the start.
  useLayoutEffect(() => {
    const papelizAccountLoadingBar = papelizAccountLoadingBarRef.current
    if (papelizAccountStateKind !== 'loading' || !papelizAccountLoadingBar) return
    const loadingMotionIsReduced = readPapelizAccountLoadingMotionIsReduced()
    const loadingBarStartKey = `${papelizAccountLoadingStep}|${isPapelizAccountLoadingFinishing}`
    if (papelizAccountLoadingBarStartRef.current?.loadingBarStartKey !== loadingBarStartKey) {
      if (!isPapelizAccountLoadingFinishing) {
        // Starts where the bar should be by now, before this screen's step (the stylesheet's creep
        // runs a little behind this, so taking over never steps back), then eases into the new step.
        showPapelizAccountLoadingPercent(readPapelizAccountLoadingTargetPercent(loadingMotionIsReduced))
        reachPapelizAccountLoadingStep(papelizAccountLoadingStep, papelizAccountStateTitle, papelizAccountLoadingWordsText)
      }
      papelizAccountLoadingBarStartRef.current = { loadingBarStartKey, loadingBarStartPercent: readPapelizAccountLastShownLoadingPercent() }
    }
    papelizAccountLoadingBar.style.animation = 'none'
    papelizAccountLoadingBar.style.transition = 'none'
    papelizAccountLoadingBar.style.width = `${papelizAccountLoadingBarStartRef.current.loadingBarStartPercent}%`
    // Settles the starting width, so the first move below runs as a transition from it.
    void papelizAccountLoadingBar.offsetWidth
    let papelizAccountLoadingBarFrame = requestAnimationFrame(function drawPapelizAccountLoadingBar() {
      const shownLoadingPercent = showPapelizAccountLoadingPercent(
        isPapelizAccountLoadingFinishing ? 100 : readPapelizAccountLoadingTargetPercent(loadingMotionIsReduced),
      )
      papelizAccountLoadingBar.style.transition = loadingMotionIsReduced
        ? 'none'
        : `width ${isPapelizAccountLoadingFinishing ? papelizAccountLoadingFinishMilliseconds : papelizAccountLoadingFollowMilliseconds}ms ease-out`
      papelizAccountLoadingBar.style.width = `${shownLoadingPercent}%`
      if (!isPapelizAccountLoadingFinishing) papelizAccountLoadingBarFrame = requestAnimationFrame(drawPapelizAccountLoadingBar)
    })
    return () => cancelAnimationFrame(papelizAccountLoadingBarFrame)
  }, [papelizAccountStateKind, papelizAccountLoadingStep, isPapelizAccountLoadingFinishing, papelizAccountStateTitle, papelizAccountLoadingWordsText])

  if (papelizAccountStateKind === 'loading') {
    return (
      <PapelizAccountCardFrame>
        <div role="status" className="flex flex-col items-center text-center">
          <PapelizAccountCardMark />
          <h1 className="text-xl leading-tight font-semibold tracking-[-0.01em] text-balance">
            <PapelizAccountLoadingEllipsis isPapelizAccountLoadingEllipsisSpacer />
            {papelizAccountStateTitle}
            <PapelizAccountLoadingEllipsis />
          </h1>
          {papelizAccountStateText && <p className="mt-1.5 text-sm text-balance text-papeliz-ink-muted">{papelizAccountStateText}</p>}
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-papeliz-surface-gray" aria-hidden="true">
            <i ref={papelizAccountLoadingBarRef} className={`block h-full rounded-full bg-papeliz-gradient-start ${papelizAccountStyles.papelizAccountLoadingBar}`} />
          </div>
        </div>
      </PapelizAccountCardFrame>
    )
  }
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-3.5">
        <PapelizAccountBrand />
        <div
          role={papelizAccountStateIsError ? 'alert' : 'status'}
          className={`w-full rounded-[10px] border px-[18px] py-4 text-center ${
            papelizAccountStateIsError
              ? 'border-papeliz-diff-removed-ink/40 bg-papeliz-diff-removed text-papeliz-diff-removed-ink'
              : 'border-papeliz-line bg-papeliz-surface'
          }`}
        >
          <h1 className="mb-1.5 text-lg font-bold text-balance">{papelizAccountStateTitle}</h1>
          {papelizAccountStateText && (
            <p className={`text-sm text-balance ${papelizAccountStateIsError ? '' : 'text-papeliz-ink-muted'}`}>{papelizAccountStateText}</p>
          )}
        </div>
        {papelizAccountStateActionLabel &&
          (papelizAccountStateActionHref ? (
            <a href={papelizAccountStateActionHref} className={papelizAccountPrimaryButtonClassName}>
              {papelizAccountStateActionLabel}
            </a>
          ) : (
            <button type="button" onClick={onPapelizAccountStateAction} className={papelizAccountPrimaryButtonClassName}>
              {papelizAccountStateActionLabel}
            </button>
          ))}
      </div>
    </div>
  )
}
