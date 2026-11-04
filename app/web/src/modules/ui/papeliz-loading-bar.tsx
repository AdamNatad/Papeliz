import { joinPapelizClassNames } from './papeliz-class-names'

interface PapelizLoadingBarProps {
  // The finished percentage; null while nothing can be counted, and the bar slides instead.
  loadingBarPercent: number | null
  loadingBarLabel: string
  // `thin` is the 3 px bar under a readout; `card` the 6 px glowing bar in a covering card.
  loadingBarSize?: 'thin' | 'card'
  className?: string
}

// The loading bar: a tinted track whose fill eases to the real percentage, or a short pill sliding
// across it while there is no count.
export function PapelizLoadingBar({ loadingBarPercent, loadingBarLabel, loadingBarSize = 'thin', className }: PapelizLoadingBarProps) {
  const isLoadingBarCounted = loadingBarPercent !== null
  return (
    <div
      role="progressbar"
      aria-label={loadingBarLabel}
      aria-valuemin={isLoadingBarCounted ? 0 : undefined}
      aria-valuemax={isLoadingBarCounted ? 100 : undefined}
      aria-valuenow={isLoadingBarCounted ? loadingBarPercent : undefined}
      className={joinPapelizClassNames('papeliz-loading-bar', loadingBarSize === 'card' && 'papeliz-loading-bar-card', className)}
    >
      {isLoadingBarCounted ? (
        <span className="papeliz-loading-bar-fill" style={{ width: `${Math.min(100, Math.max(0, loadingBarPercent))}%` }} />
      ) : (
        <span className="papeliz-loading-bar-slide" />
      )}
    </div>
  )
}
