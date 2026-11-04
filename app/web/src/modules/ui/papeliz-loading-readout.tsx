import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'
import { PapelizLoadingBar } from './papeliz-loading-bar'
import { usePapelizLoadingElapsedMilliseconds } from './papeliz-loading-clock'
import { PapelizLoadingDots } from './papeliz-loading-dots'
import {
  countPapelizLoadingProgressPercent,
  formatPapelizLoadingTotalTime,
  hasPapelizLoadingFailedStep,
  removePapelizLoadingWordsTrailingEllipsis,
  type PapelizLoadingStep,
} from './papeliz-loading-progress-count'
import { PapelizLoadingStepList } from './papeliz-loading-step-list'

interface PapelizLoadingReadoutProps {
  // What is happening, without dots: "Exporting".
  loadingWords: string
  loadingSteps: readonly PapelizLoadingStep[]
  loadingStartedAtMilliseconds: number
  // The size so far ("5 KB"), when the job knows it; the Total row adds the time.
  loadingSizeWords?: string
  className?: string
}

// A counted job's readout: the 3 px bar, and under it one pill with the percentage and what is
// happening ("44% · Exporting..."). More info hangs open under the pill every time a readout appears:
// each step with its mark and count, and the Total row. Pressing the pill folds it for this job only.
export function PapelizLoadingReadout({ loadingWords, loadingSteps, loadingStartedAtMilliseconds, loadingSizeWords, className }: PapelizLoadingReadoutProps) {
  const [isLoadingMoreInfoOpen, setIsLoadingMoreInfoOpen] = useState(true)
  const loadingMoreInfoId = useId()
  const loadingElapsedMilliseconds = usePapelizLoadingElapsedMilliseconds(loadingStartedAtMilliseconds)
  const loadingPercent = countPapelizLoadingProgressPercent(loadingSteps)
  const isLoadingFinished = loadingSteps.length > 0 && loadingSteps.every((loadingStep) => loadingStep.loadingStepState === 'done')
  const isLoadingFailed = hasPapelizLoadingFailedStep(loadingSteps)
  // Before any count exists the bar slides, and the pill shows no percentage.
  const isLoadingCounted = loadingPercent > 0 || isLoadingFinished
  const shownLoadingWords = isLoadingFinished ? 'Done' : removePapelizLoadingWordsTrailingEllipsis(loadingWords)
  const loadingTotalWords = `${loadingSizeWords === undefined ? '' : `${loadingSizeWords} · `}${formatPapelizLoadingTotalTime(loadingElapsedMilliseconds)}`

  return (
    <div className={joinPapelizClassNames('papeliz-loading-readout', className)}>
      <PapelizLoadingBar loadingBarPercent={isLoadingCounted ? loadingPercent : null} loadingBarLabel={shownLoadingWords} />
      <div className="papeliz-loading-readout-hang">
        <button
          type="button"
          className="papeliz-loading-readout-pill"
          data-papeliz-loading-readout-failed={isLoadingFailed || undefined}
          aria-expanded={isLoadingMoreInfoOpen}
          aria-controls={loadingMoreInfoId}
          title={isLoadingMoreInfoOpen ? 'Less Info' : 'More Info'}
          onClick={() => setIsLoadingMoreInfoOpen((wasLoadingMoreInfoOpen) => !wasLoadingMoreInfoOpen)}
        >
          <span className="papeliz-loading-readout-pill-words">
            {isLoadingCounted && (
              <>
                {loadingPercent}%<span aria-hidden="true"> · </span>
              </>
            )}
            {shownLoadingWords}
            {!isLoadingFinished && !isLoadingFailed && <PapelizLoadingDots />}
          </span>
          <ChevronDown className="papeliz-loading-readout-chevron" strokeWidth={2.25} aria-hidden="true" />
        </button>
        <div id={loadingMoreInfoId} className="papeliz-loading-more-info" data-papeliz-loading-more-info-open={isLoadingMoreInfoOpen}>
          <div className="papeliz-loading-more-info-clip">
            <PapelizLoadingStepList loadingSteps={loadingSteps} loadingTotalWords={loadingTotalWords} />
          </div>
        </div>
      </div>
    </div>
  )
}
