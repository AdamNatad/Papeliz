import type { ReactNode } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

interface PapelizLoadingPicturePlaceholderProps {
  // `square` stands where a new picture will go; `text-lines` where words about a picture will go.
  picturePlaceholderShape: 'square' | 'text-lines'
  className?: string
}

// A calm placeholder the shape of what is coming, swept by a soft sheen. With reduced motion the sheen
// stops and the placeholder breathes instead.
export function PapelizLoadingPicturePlaceholder({ picturePlaceholderShape, className }: PapelizLoadingPicturePlaceholderProps) {
  if (picturePlaceholderShape === 'text-lines') {
    return (
      <div className={joinPapelizClassNames('papeliz-loading-picture-text-lines', className)} aria-hidden="true">
        <span className="papeliz-loading-sheen" />
        <span className="papeliz-loading-sheen" />
      </div>
    )
  }
  return (
    <div className={joinPapelizClassNames('papeliz-loading-picture-frame', className)} aria-hidden="true">
      <span className="papeliz-loading-sheen papeliz-loading-sheen-square" />
    </div>
  )
}

// A picture being changed: it stays in view, dimmed, with the sheen sweeping over it.
export function PapelizLoadingPictureUnderSheen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={joinPapelizClassNames('papeliz-loading-picture-under-sheen', className)}>
      {children}
      <span className="papeliz-loading-sheen papeliz-loading-sheen-over" aria-hidden="true" />
    </div>
  )
}
