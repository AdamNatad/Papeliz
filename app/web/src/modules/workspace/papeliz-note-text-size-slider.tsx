import type { CSSProperties } from 'react'
import { papelizNoteFontSizeLimits, usePapelizNoteTypographyStore } from './papeliz-note-typography-store'

const { minimumNoteFontSize, maximumNoteFontSize } = papelizNoteFontSizeLimits
const papelizNoteTextSizeStopCount = maximumNoteFontSize - minimumNoteFontSize + 1

interface PapelizNoteTextSizeSliderProps {
  // A size of its own (Export › HTML's), changed through `onNoteFontSizeChoose`; missing, the notes'
  // own text size from the typography store.
  chosenNoteFontSize?: number
  onNoteFontSizeChoose?: (chosenNoteFontSize: number) => void
}

// Text size on the Settings gear's Accessibility page: the sliding choices' gray track with the
// white pill as the thumb, one dot per size. A native range input lies over it (papeliz-webapp.css),
// so dragging, clicking anywhere on the track, the arrow keys, Home, End, Page Up and Page Down all
// work, and screen readers hear "Text size, 17 px".
export function PapelizNoteTextSizeSlider({ chosenNoteFontSize, onNoteFontSizeChoose }: PapelizNoteTextSizeSliderProps = {}) {
  const storedNoteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const changeNoteTypography = usePapelizNoteTypographyStore((typographyState) => typographyState.changeNoteTypography)
  const noteFontSize = chosenNoteFontSize ?? storedNoteFontSize
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
        aria-label="Text Size"
        aria-valuetext={`${noteFontSize} px`}
        min={minimumNoteFontSize}
        max={maximumNoteFontSize}
        step={1}
        value={noteFontSize}
        onChange={(changeEvent) =>
          onNoteFontSizeChoose !== undefined ? onNoteFontSizeChoose(Number(changeEvent.target.value)) : changeNoteTypography({ noteFontSize: Number(changeEvent.target.value) })
        }
        className="papeliz-note-text-size-slider-input"
      />
    </div>
  )
}
