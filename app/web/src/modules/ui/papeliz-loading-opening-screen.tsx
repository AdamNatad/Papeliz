import { PapelizMark } from './papeliz-mark'
import { joinPapelizClassNames } from './papeliz-class-names'
import type { PapelizLoadingStep } from './papeliz-loading-progress-count'
import { PapelizLoadingReadout } from './papeliz-loading-readout'

interface PapelizLoadingOpeningScreenProps {
  // What the app is doing: "Starting Papeliz", "Opening Sample vault".
  loadingWords: string
  loadingSteps: readonly PapelizLoadingStep[]
  loadingStartedAtMilliseconds: number
  // Leaving: it fades out over what has been drawn under it.
  isOpeningScreenLeaving?: boolean
}

// The screen the app opens on, so the page is never blank while it starts or opens a vault: the
// Papeliz tile, its name, and the readout with its steps.
export function PapelizLoadingOpeningScreen({ loadingWords, loadingSteps, loadingStartedAtMilliseconds, isOpeningScreenLeaving = false }: PapelizLoadingOpeningScreenProps) {
  return (
    <div className={joinPapelizClassNames('papeliz-loading-opening-screen', isOpeningScreenLeaving && 'papeliz-loading-opening-screen-leaving')} aria-busy={!isOpeningScreenLeaving}>
      <div className="papeliz-loading-opening-screen-group">
        <span className="papeliz-loading-opening-screen-tile" aria-hidden="true">
          <PapelizMark papelizMarkSize={30} papelizMarkTone="on-blue" />
        </span>
        <p className="papeliz-loading-opening-screen-name">Papeliz</p>
        <PapelizLoadingReadout loadingWords={loadingWords} loadingSteps={loadingSteps} loadingStartedAtMilliseconds={loadingStartedAtMilliseconds} />
      </div>
    </div>
  )
}
