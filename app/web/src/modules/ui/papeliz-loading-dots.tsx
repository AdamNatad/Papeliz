import { joinPapelizClassNames } from './papeliz-class-names'
import { removePapelizLoadingWordsTrailingEllipsis } from './papeliz-loading-progress-count'

// Dots after waiting words that step: none, one, two, three. They sit in a slot of their own width,
// so the line never twitches; with reduced motion they stand at three.
export function PapelizLoadingDots({ className }: { className?: string }) {
  return <span className={joinPapelizClassNames('papeliz-loading-dots', className)} aria-hidden="true" />
}

// Waiting words, with the stepping dots in place of their "…".
export function PapelizLoadingWords({ loadingWords, className }: { loadingWords: string; className?: string }) {
  return (
    <span className={className}>
      {removePapelizLoadingWordsTrailingEllipsis(loadingWords)}
      <PapelizLoadingDots />
    </span>
  )
}
