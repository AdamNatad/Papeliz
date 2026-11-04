import { describe, expect, it } from 'vitest'
import {
  countPapelizLoadingProgressPercent,
  describePapelizLoadingStepCount,
  findPapelizLoadingRunningStep,
  formatPapelizLoadingElapsedClock,
  formatPapelizLoadingTotalTime,
  hasPapelizLoadingFailedStep,
  readPapelizLoadingPartFromWords,
  removePapelizLoadingWordsTrailingEllipsis,
  type PapelizLoadingStep,
} from './papeliz-loading-progress-count'

describe('the loading step counter', () => {
  it('counts nothing before any step finishes, and 100 only once every step is done', () => {
    const waitingSteps: PapelizLoadingStep[] = [
      { loadingStepLabel: 'Reading the theme', loadingStepState: 'running' },
      { loadingStepLabel: 'Opening the start page', loadingStepState: 'waiting' },
    ]
    expect(countPapelizLoadingProgressPercent(waitingSteps)).toBe(0)
    expect(countPapelizLoadingProgressPercent(waitingSteps.map((loadingStep) => ({ ...loadingStep, loadingStepState: 'done' as const })))).toBe(100)
    expect(countPapelizLoadingProgressPercent([])).toBe(0)
  })

  it('shares the percentage between steps by their weight', () => {
    const weightedSteps: PapelizLoadingStep[] = [
      { loadingStepLabel: 'Code', loadingStepState: 'done', loadingStepWeight: 1 },
      { loadingStepLabel: 'Notes', loadingStepState: 'waiting', loadingStepWeight: 3 },
    ]
    expect(countPapelizLoadingProgressPercent(weightedSteps)).toBe(25)
  })

  it('moves a counted step by its finished units, rounding down', () => {
    const exportSteps: PapelizLoadingStep[] = [
      { loadingStepLabel: 'Exporting', loadingStepState: 'running', loadingStepDoneUnitCount: 5, loadingStepUnitCount: 9, loadingStepUnitWord: 'notes' },
    ]
    expect(countPapelizLoadingProgressPercent(exportSteps)).toBe(55)
    expect(countPapelizLoadingProgressPercent([{ ...exportSteps[0]!, loadingStepDoneUnitCount: 1, loadingStepUnitCount: 3 }])).toBe(33)
    expect(countPapelizLoadingProgressPercent([{ ...exportSteps[0]!, loadingStepDoneUnitCount: 12 }])).toBe(100)
  })

  it('does not move a running step that has no count', () => {
    expect(countPapelizLoadingProgressPercent([{ loadingStepLabel: 'Waiting for the reply', loadingStepState: 'running' }])).toBe(0)
  })

  it('finds the running step and a failed one', () => {
    const loadingSteps: PapelizLoadingStep[] = [
      { loadingStepLabel: 'One', loadingStepState: 'done' },
      { loadingStepLabel: 'Two', loadingStepState: 'running' },
    ]
    expect(findPapelizLoadingRunningStep(loadingSteps)?.loadingStepLabel).toBe('Two')
    expect(findPapelizLoadingRunningStep([])).toBeNull()
    expect(hasPapelizLoadingFailedStep(loadingSteps)).toBe(false)
    expect(hasPapelizLoadingFailedStep([{ loadingStepLabel: 'One', loadingStepState: 'failed' }])).toBe(true)
  })

  it('writes each counted step as "5 of 9 notes", and nothing while it waits', () => {
    const countedStep: PapelizLoadingStep = { loadingStepLabel: 'Exporting', loadingStepState: 'running', loadingStepDoneUnitCount: 5, loadingStepUnitCount: 9, loadingStepUnitWord: 'notes' }
    expect(describePapelizLoadingStepCount(countedStep)).toBe('5 of 9 notes')
    expect(describePapelizLoadingStepCount({ ...countedStep, loadingStepState: 'done' })).toBe('9 of 9 notes')
    expect(describePapelizLoadingStepCount({ ...countedStep, loadingStepState: 'waiting' })).toBe('')
    expect(describePapelizLoadingStepCount({ loadingStepLabel: 'Saving', loadingStepState: 'running' })).toBe('')
    expect(describePapelizLoadingStepCount({ loadingStepLabel: 'Part', loadingStepState: 'running', loadingStepDoneUnitCount: 1, loadingStepUnitCount: 3 })).toBe('1 of 3')
  })
})

describe('the loading clock and words', () => {
  it('runs a clock as minutes and seconds', () => {
    expect(formatPapelizLoadingElapsedClock(0)).toBe('0:00')
    expect(formatPapelizLoadingElapsedClock(4_900)).toBe('0:04')
    expect(formatPapelizLoadingElapsedClock(65_000)).toBe('1:05')
    expect(formatPapelizLoadingElapsedClock(-20)).toBe('0:00')
  })

  it('writes the Total row’s time in seconds under a minute', () => {
    expect(formatPapelizLoadingTotalTime(3_400)).toBe('3 s')
    expect(formatPapelizLoadingTotalTime(75_000)).toBe('1:15')
  })

  it('reads the part running from words that name one', () => {
    expect(readPapelizLoadingPartFromWords('Transcribing part 2 of 3…')).toEqual({ runningPartNumber: 2, loadingPartCount: 3 })
    expect(readPapelizLoadingPartFromWords('Part 1 of 4 · muse-voice-transcribe-1.0')).toEqual({ runningPartNumber: 1, loadingPartCount: 4 })
    expect(readPapelizLoadingPartFromWords('Transcribing with Groq…')).toBeNull()
    expect(readPapelizLoadingPartFromWords('Transcribing part 5 of 3…')).toBeNull()
    expect(readPapelizLoadingPartFromWords('Transcribing part 0 of 3…')).toBeNull()
  })

  it('takes a trailing ellipsis off waiting words', () => {
    expect(removePapelizLoadingWordsTrailingEllipsis('Thinking…')).toBe('Thinking')
    expect(removePapelizLoadingWordsTrailingEllipsis('Reading the folder...')).toBe('Reading the folder')
    expect(removePapelizLoadingWordsTrailingEllipsis('Exporting 3 of 9 …')).toBe('Exporting 3 of 9')
    expect(removePapelizLoadingWordsTrailingEllipsis('Opening Sample vault')).toBe('Opening Sample vault')
  })
})
