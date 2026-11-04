import { useEffect, useState } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'
import { formatPapelizLoadingElapsedClock } from './papeliz-loading-progress-count'

// When a wait began, fixed at the first draw of whatever shows it.
export function usePapelizLoadingStartedAtMilliseconds(): number {
  const [loadingStartedAtMilliseconds] = useState(() => performance.now())
  return loadingStartedAtMilliseconds
}

// The time since a wait began, read again four times a second.
export function usePapelizLoadingElapsedMilliseconds(loadingStartedAtMilliseconds: number): number {
  const [loadingElapsedMilliseconds, setLoadingElapsedMilliseconds] = useState(() => performance.now() - loadingStartedAtMilliseconds)
  useEffect(() => {
    const loadingClockInterval = window.setInterval(() => setLoadingElapsedMilliseconds(performance.now() - loadingStartedAtMilliseconds), 250)
    return () => window.clearInterval(loadingClockInterval)
  }, [loadingStartedAtMilliseconds])
  return loadingElapsedMilliseconds
}

interface PapelizLoadingClockProps {
  loadingStartedAtMilliseconds: number
  className?: string
}

// A running clock, "0:04", for a wait nobody can count.
export function PapelizLoadingClock({ loadingStartedAtMilliseconds, className }: PapelizLoadingClockProps) {
  const loadingElapsedMilliseconds = usePapelizLoadingElapsedMilliseconds(loadingStartedAtMilliseconds)
  return (
    <span className={joinPapelizClassNames('papeliz-loading-clock', className)} role="timer" aria-label="Time so far">
      {formatPapelizLoadingElapsedClock(loadingElapsedMilliseconds)}
    </span>
  )
}
