import type { LucideIcon } from 'lucide-react'
import { joinPapelizClassNames } from './papeliz-class-names'
import { PapelizLoadingClock, usePapelizLoadingStartedAtMilliseconds } from './papeliz-loading-clock'
import { PapelizLoadingPicturePlaceholder } from './papeliz-loading-picture-placeholder'

interface PapelizLoadingWorkHeaderProps {
  // What is being made, as the job says it: "Editing the picture with muse-image-1.0…".
  loadingWords: string
  LoadingMarkIcon: LucideIcon
  loadingStartedAtMilliseconds: number
  className?: string
}

// The head of a wait for generated work: a round blue mark that rocks, a sparkle beside it that
// pulses, the words, and a running clock. It never shows a percentage, since nobody can count it.
export function PapelizLoadingWorkHeader({ loadingWords, LoadingMarkIcon, loadingStartedAtMilliseconds, className }: PapelizLoadingWorkHeaderProps) {
  return (
    <div className={joinPapelizClassNames('papeliz-loading-work-header', className)} role="status">
      <span className="papeliz-loading-work-mark" aria-hidden="true">
        <LoadingMarkIcon className="size-3.5" strokeWidth={2.2} />
        <svg className="papeliz-loading-work-spark" viewBox="0 0 24 24">
          <path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6-2.6 7.9-2.6-7.9-7.9-2.6 7.9-2.6z" />
        </svg>
      </span>
      <span className="papeliz-loading-work-words">{loadingWords}</span>
      <PapelizLoadingClock loadingStartedAtMilliseconds={loadingStartedAtMilliseconds} />
    </div>
  )
}

interface PapelizLoadingWorkWaitProps {
  loadingWords: string
  LoadingMarkIcon: LucideIcon
  // What stands where the result will go: a square for a new picture, two lines for words about one,
  // or nothing when the result goes elsewhere.
  picturePlaceholderShape?: 'square' | 'text-lines' | null
  className?: string
}

// A whole wait for generated work: the head with its clock, counted from when the wait first shows,
// and the placeholder under it.
export function PapelizLoadingWorkWait({ loadingWords, LoadingMarkIcon, picturePlaceholderShape = null, className }: PapelizLoadingWorkWaitProps) {
  const loadingStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  return (
    <div className={joinPapelizClassNames('flex flex-col gap-2.5', className)}>
      <PapelizLoadingWorkHeader loadingWords={loadingWords} LoadingMarkIcon={LoadingMarkIcon} loadingStartedAtMilliseconds={loadingStartedAtMilliseconds} />
      {picturePlaceholderShape !== null && <PapelizLoadingPicturePlaceholder picturePlaceholderShape={picturePlaceholderShape} />}
    </div>
  )
}
