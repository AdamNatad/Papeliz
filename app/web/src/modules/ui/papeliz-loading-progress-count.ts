// What a job that waits reports, step by step, and what its readout works out from that: the
// percentage, the step running now, each step's count, and the time so far. A step without a count
// (one request, one file read) moves the percentage only once it is done, so the bar never claims
// work nobody can measure.

export type PapelizLoadingStepState = 'waiting' | 'running' | 'done' | 'failed'

export interface PapelizLoadingStep {
  loadingStepLabel: string
  loadingStepState: PapelizLoadingStepState
  // The step's share of the whole job; 1 when left out.
  loadingStepWeight?: number
  // A step made of things that can be counted ("5 of 9 notes").
  loadingStepDoneUnitCount?: number
  loadingStepUnitCount?: number
  loadingStepUnitWord?: string
}

function readPapelizLoadingStepWeight(loadingStep: PapelizLoadingStep): number {
  return loadingStep.loadingStepWeight !== undefined && loadingStep.loadingStepWeight > 0 ? loadingStep.loadingStepWeight : 1
}

// How much of one step is finished, from 0 to 1.
function readPapelizLoadingStepFinishedShare(loadingStep: PapelizLoadingStep): number {
  if (loadingStep.loadingStepState === 'done') return 1
  if (loadingStep.loadingStepState !== 'running') return 0
  const { loadingStepDoneUnitCount, loadingStepUnitCount } = loadingStep
  if (loadingStepDoneUnitCount === undefined || loadingStepUnitCount === undefined || loadingStepUnitCount <= 0) return 0
  return Math.min(1, Math.max(0, loadingStepDoneUnitCount / loadingStepUnitCount))
}

// The whole job's percentage, rounded down, so it reads 100 only once every step is done.
export function countPapelizLoadingProgressPercent(loadingSteps: readonly PapelizLoadingStep[]): number {
  const totalWeight = loadingSteps.reduce((weightSum, loadingStep) => weightSum + readPapelizLoadingStepWeight(loadingStep), 0)
  if (totalWeight === 0) return 0
  const finishedWeight = loadingSteps.reduce(
    (weightSum, loadingStep) => weightSum + readPapelizLoadingStepWeight(loadingStep) * readPapelizLoadingStepFinishedShare(loadingStep),
    0,
  )
  return Math.min(100, Math.floor((finishedWeight / totalWeight) * 100 + 1e-9))
}

export function findPapelizLoadingRunningStep(loadingSteps: readonly PapelizLoadingStep[]): PapelizLoadingStep | null {
  return loadingSteps.find((loadingStep) => loadingStep.loadingStepState === 'running') ?? null
}

export function hasPapelizLoadingFailedStep(loadingSteps: readonly PapelizLoadingStep[]): boolean {
  return loadingSteps.some((loadingStep) => loadingStep.loadingStepState === 'failed')
}

// "5 of 9 notes" beside a counted step; nothing beside one still waiting or without a count.
export function describePapelizLoadingStepCount(loadingStep: PapelizLoadingStep): string {
  const { loadingStepDoneUnitCount, loadingStepUnitCount, loadingStepUnitWord } = loadingStep
  if (loadingStepUnitCount === undefined || loadingStep.loadingStepState === 'waiting') return ''
  const shownDoneUnitCount = loadingStep.loadingStepState === 'done' ? loadingStepUnitCount : Math.min(loadingStepUnitCount, loadingStepDoneUnitCount ?? 0)
  return `${shownDoneUnitCount} of ${loadingStepUnitCount}${loadingStepUnitWord === undefined ? '' : ` ${loadingStepUnitWord}`}`
}

// A running clock: "0:04", "1:05", "12:00".
export function formatPapelizLoadingElapsedClock(elapsedMilliseconds: number): string {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000))
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`
}

// The Total row's time: "3 s" under a minute, then the clock.
export function formatPapelizLoadingTotalTime(elapsedMilliseconds: number): string {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000))
  return elapsedSeconds < 60 ? `${elapsedSeconds} s` : formatPapelizLoadingElapsedClock(elapsedMilliseconds)
}

// A job sent in parts says so in its words ("Transcribing part 2 of 3…"): the part running and how
// many there are, or null when its words name no part.
export function readPapelizLoadingPartFromWords(loadingWords: string): { runningPartNumber: number; loadingPartCount: number } | null {
  const partWordsMatch = /\bpart (\d+) of (\d+)\b/iu.exec(loadingWords)
  if (partWordsMatch === null) return null
  const runningPartNumber = Number(partWordsMatch[1])
  const loadingPartCount = Number(partWordsMatch[2])
  if (!(loadingPartCount > 0) || !(runningPartNumber > 0) || runningPartNumber > loadingPartCount) return null
  return { runningPartNumber, loadingPartCount }
}

// Waiting words end in dots that step on their own, so a trailing "…" or "..." comes off first.
export function removePapelizLoadingWordsTrailingEllipsis(loadingWords: string): string {
  return loadingWords.replace(/\s*(?:…|\.{3})$/u, '')
}
