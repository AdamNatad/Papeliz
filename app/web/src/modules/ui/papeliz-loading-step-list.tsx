import { joinPapelizClassNames } from './papeliz-class-names'
import { describePapelizLoadingStepCount, type PapelizLoadingStep } from './papeliz-loading-progress-count'

interface PapelizLoadingStepListProps {
  loadingSteps: readonly PapelizLoadingStep[]
  // The Total row's words ("5 KB · 3 s"); left out when null.
  loadingTotalWords?: string | null
  // `panel` sits in its own bordered box; `bare` is the list alone, inside something that already
  // frames it.
  loadingStepListFrame?: 'panel' | 'bare'
  className?: string
}

const papelizLoadingStepStateWords: Readonly<Record<PapelizLoadingStep['loadingStepState'], string>> = {
  waiting: 'still to come',
  running: 'running',
  done: 'done',
  failed: 'didn’t finish',
}

// Each step of a job with its mark (a faint ring still to come, a turning arc while it runs, a filled
// dot once done) and its count, and a Total row under them.
export function PapelizLoadingStepList({ loadingSteps, loadingTotalWords = null, loadingStepListFrame = 'panel', className }: PapelizLoadingStepListProps) {
  return (
    <div className={joinPapelizClassNames('papeliz-loading-step-panel', loadingStepListFrame === 'bare' && 'papeliz-loading-step-panel-bare', className)}>
      <ul className="papeliz-loading-steps" aria-label="Steps">
        {loadingSteps.map((loadingStep, loadingStepIndex) => (
          <li key={`${loadingStepIndex}-${loadingStep.loadingStepLabel}`} className="papeliz-loading-step" data-papeliz-loading-step-state={loadingStep.loadingStepState}>
            <span className="papeliz-loading-step-mark" aria-hidden="true" />
            <span className="papeliz-loading-step-label">
              {loadingStep.loadingStepLabel}
              <span className="sr-only">, {papelizLoadingStepStateWords[loadingStep.loadingStepState]}</span>
            </span>
            <span className="papeliz-loading-step-count">{describePapelizLoadingStepCount(loadingStep)}</span>
          </li>
        ))}
      </ul>
      {loadingTotalWords !== null && (
        <div className="papeliz-loading-step-total">
          <span aria-hidden="true" />
          <span>Total</span>
          <span>{loadingTotalWords}</span>
        </div>
      )}
    </div>
  )
}
