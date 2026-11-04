import { joinPapelizClassNames } from './papeliz-class-names'

interface PapelizLoadingRingProps {
  // `on-blue` is the white ring for a blue button.
  loadingRingTone?: 'blue' | 'on-blue'
  className?: string
}

// The one small ring for a busy button or line: a blue arc turning on a faint ring. With reduced
// motion it stands still and breathes.
export function PapelizLoadingRing({ loadingRingTone = 'blue', className }: PapelizLoadingRingProps) {
  return <span className={joinPapelizClassNames('papeliz-loading-ring', loadingRingTone === 'on-blue' && 'papeliz-loading-ring-on-blue', className)} aria-hidden="true" />
}
