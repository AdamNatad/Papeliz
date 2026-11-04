import type { ReactNode } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'
import { PapelizLoadingBar } from './papeliz-loading-bar'
import { PapelizLoadingWords } from './papeliz-loading-dots'

interface PapelizLoadingCoverCardProps {
  // What is happening: "Opening the vault". A trailing "…" gives way to the stepping dots.
  loadingWords: string
  // `over-pane` lays a near-white ground over a busy pane, which must be positioned; `in-place` puts
  // the card where the pane is still empty.
  loadingCoverPlacement: 'over-pane' | 'in-place'
  // More under the bar, such as a step list.
  children?: ReactNode
  className?: string
}

// The covering card for a busy pane: a small card with the words and stepping dots. Its 6 px bar
// slides only after 300 ms, so a quick wait shows just the words.
export function PapelizLoadingCoverCard({ loadingWords, loadingCoverPlacement, children, className }: PapelizLoadingCoverCardProps) {
  return (
    <div
      className={joinPapelizClassNames(
        loadingCoverPlacement === 'over-pane' ? 'papeliz-loading-cover-over-pane' : 'papeliz-loading-cover-in-place',
        className,
      )}
    >
      <div className="papeliz-loading-cover-card" role="status">
        <PapelizLoadingWords loadingWords={loadingWords} className="papeliz-loading-cover-card-words" />
        <PapelizLoadingBar loadingBarPercent={null} loadingBarLabel={loadingWords} loadingBarSize="card" className="papeliz-loading-cover-card-bar" />
        {children}
      </div>
    </div>
  )
}
