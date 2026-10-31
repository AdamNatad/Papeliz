// How far the account page's loading bar has come. The page moves through real steps, each with its
// mark on the bar, and the bar never goes back. Between steps it creeps toward the next mark without
// reaching it, and when a finished screen is ready it fills to the end before that screen shows
// (`PapelizAccountAfterLoadingBar`). One record for the whole page, so each new loading screen (the
// page's code arriving, Clerk starting, signing in) carries on from the last one.

export type PapelizAccountLoadingStep = 'page-shown' | 'code-loaded' | 'clerk-loaded' | 'signing-in' | 'handing-over'

const papelizAccountLoadingStepOrder: readonly PapelizAccountLoadingStep[] = ['page-shown', 'code-loaded', 'clerk-loaded', 'signing-in', 'handing-over']

const papelizAccountLoadingStepPercents: Record<PapelizAccountLoadingStep, number> = {
  'page-shown': 8,
  'code-loaded': 35,
  'clerk-loaded': 60,
  'signing-in': 75,
  'handing-over': 88,
}

// How short the creep stops of the next step's mark, how quickly it slows, and how it creeps after
// the last step.
const papelizAccountLoadingCreepGapPercent = 4
const papelizAccountLoadingCreepMilliseconds = 2600
const papelizAccountLoadingLastStepCeilingPercent = 95

// The fill to the end: short and fixed, so a fast load finishes fast.
export const papelizAccountLoadingFinishMilliseconds = 200

interface PapelizAccountLoadingProgress {
  reachedLoadingStep: PapelizAccountLoadingStep
  // On the page's clock (`performance.now()`): the page starts at 0.
  reachedLoadingStepAt: number
  // What the bar last showed, so a new bar starts there instead of at the beginning.
  lastShownLoadingPercent: number
  // A loading screen is showing and its bar hasn't filled to the end yet.
  loadingBarIsUnfinished: boolean
  lastLoadingTitle: string
  lastLoadingText: string | undefined
}

const papelizAccountLoadingProgress: PapelizAccountLoadingProgress = {
  reachedLoadingStep: 'page-shown',
  reachedLoadingStepAt: 0,
  lastShownLoadingPercent: papelizAccountLoadingStepPercents['page-shown'],
  loadingBarIsUnfinished: false,
  lastLoadingTitle: 'Loading your account',
  lastLoadingText: undefined,
}

// A loading screen arrived. A later step moves the bar on; an earlier one (after a finished screen,
// a new wait begins) starts the bar again from the beginning.
export function reachPapelizAccountLoadingStep(loadingStep: PapelizAccountLoadingStep, loadingTitle: string, loadingText: string | undefined): void {
  const loadingStepIndex = papelizAccountLoadingStepOrder.indexOf(loadingStep)
  const reachedLoadingStepIndex = papelizAccountLoadingStepOrder.indexOf(papelizAccountLoadingProgress.reachedLoadingStep)
  if (!papelizAccountLoadingProgress.loadingBarIsUnfinished && papelizAccountLoadingProgress.lastShownLoadingPercent >= 100) {
    papelizAccountLoadingProgress.lastShownLoadingPercent = 0
    papelizAccountLoadingProgress.reachedLoadingStep = loadingStep
    papelizAccountLoadingProgress.reachedLoadingStepAt = performance.now()
  } else if (loadingStepIndex > reachedLoadingStepIndex) {
    papelizAccountLoadingProgress.reachedLoadingStep = loadingStep
    papelizAccountLoadingProgress.reachedLoadingStepAt = performance.now()
  }
  papelizAccountLoadingProgress.loadingBarIsUnfinished = true
  papelizAccountLoadingProgress.lastLoadingTitle = loadingTitle
  papelizAccountLoadingProgress.lastLoadingText = loadingText
}

// Where the bar should be now: the reached step's mark, plus a creep that slows as it nears the next.
// With reduced motion, the step's mark alone.
export function readPapelizAccountLoadingTargetPercent(loadingMotionIsReduced: boolean): number {
  const reachedLoadingStepPercent = papelizAccountLoadingStepPercents[papelizAccountLoadingProgress.reachedLoadingStep]
  if (loadingMotionIsReduced) return reachedLoadingStepPercent
  const nextLoadingStep = papelizAccountLoadingStepOrder[papelizAccountLoadingStepOrder.indexOf(papelizAccountLoadingProgress.reachedLoadingStep) + 1]
  const loadingCreepCeilingPercent = nextLoadingStep
    ? papelizAccountLoadingStepPercents[nextLoadingStep] - papelizAccountLoadingCreepGapPercent
    : papelizAccountLoadingLastStepCeilingPercent
  const loadingCreepShare = 1 - Math.exp(-(performance.now() - papelizAccountLoadingProgress.reachedLoadingStepAt) / papelizAccountLoadingCreepMilliseconds)
  return reachedLoadingStepPercent + (loadingCreepCeilingPercent - reachedLoadingStepPercent) * loadingCreepShare
}

export function readPapelizAccountLastShownLoadingPercent(): number {
  return papelizAccountLoadingProgress.lastShownLoadingPercent
}

// Records what a bar shows; never less than before, so the bar only goes forward.
export function showPapelizAccountLoadingPercent(loadingPercent: number): number {
  papelizAccountLoadingProgress.lastShownLoadingPercent = Math.max(papelizAccountLoadingProgress.lastShownLoadingPercent, Math.min(loadingPercent, 100))
  return papelizAccountLoadingProgress.lastShownLoadingPercent
}

export function readPapelizAccountLoadingBarIsUnfinished(): boolean {
  return papelizAccountLoadingProgress.loadingBarIsUnfinished
}

export function finishPapelizAccountLoadingBar(): void {
  papelizAccountLoadingProgress.loadingBarIsUnfinished = false
  papelizAccountLoadingProgress.lastShownLoadingPercent = 100
}

export function readPapelizAccountLastLoadingWords(): { lastLoadingTitle: string; lastLoadingText: string | undefined } {
  return { lastLoadingTitle: papelizAccountLoadingProgress.lastLoadingTitle, lastLoadingText: papelizAccountLoadingProgress.lastLoadingText }
}

export function readPapelizAccountLoadingMotionIsReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
