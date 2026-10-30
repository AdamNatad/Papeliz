import type { CSSProperties } from 'react'
import { papelizNoteFontSizeLimits, usePapelizNoteTypographyStore } from './papeliz-note-typography-store'

const { minimumNoteFontSize, maximumNoteFontSize } = papelizNoteFontSizeLimits
const papelizNoteTextSizeStopCount = maximumNoteFontSize - minimumNoteFontSize + 1

// Text size in the Settings gear's Accessibility page: the sliding choices' gray track with the
// white pill as the thumb, one dot per size. A native range input lies over it (papeliz-webapp.css),
// so dragging, clicking anywhere on the track, the arrow keys, Home, End, Page Up and Page Down all
// work, and screen readers hear "Text size, 17 px".
export function PapelizNoteTextSizeSlider() {
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const changeNoteTypography = usePapelizNoteTypographyStore((typographyState) => typographyState.changeNoteTypography)
  const noteTextSizeFraction = (noteFontSize - minimumNoteFontSize) / (maximumNoteFontSize - minimumNoteFontSize)

  return (
    <div className="papeliz-note-text-size-slider" style={{ '--papeliz-note-text-size-fraction': noteTextSizeFraction } as CSSProperties}>
      <span aria-hidden="true" className="papeliz-note-text-size-slider-fill" />
      <span aria-hidden="true" className="papeliz-note-text-size-slider-stops">
        {Array.from({ length: papelizNoteTextSizeStopCount }, (_, noteTextSizeStopIndex) => (
          <i key={noteTextSizeStopIndex} data-papeliz-note-text-size-stop-passed={minimumNoteFontSize + noteTextSizeStopIndex < noteFontSize} />
        ))}
      </span>
      <span aria-hidden="true" className="papeliz-note-text-size-slider-pill">
        {noteFontSize}
        <small>px</small>
      </span>
      <input
        type="range"
        aria-label="Text size"
        aria-valuetext={`${noteFontSize} px`}
        min={minimumNoteFontSize}
        max={maximumNoteFontSize}
        step={1}
        value={noteFontSize}
        onChange={(changeEvent) => changeNoteTypography({ noteFontSize: Number(changeEvent.target.value) })}
        className="papeliz-note-text-size-slider-input"
      />
    </div>
  )
}
