import { useState, type CSSProperties, type ReactNode } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

export interface PapelizSlidingChoice<SlidingChoiceValue extends string> {
  slidingChoiceValue: SlidingChoiceValue
  slidingChoiceContent: ReactNode
  slidingChoiceTitle?: string
  slidingChoiceClassName?: string
}

interface PapelizSlidingChoiceGroupProps<SlidingChoiceValue extends string> {
  slidingChoiceGroupLabel: string
  // A radio group (a setting) or a tab list (which part of a panel shows).
  slidingChoiceGroupRole: 'radiogroup' | 'tablist'
  slidingChoices: ReadonlyArray<PapelizSlidingChoice<SlidingChoiceValue>>
  chosenSlidingChoiceValue: SlidingChoiceValue
  onSlidingChoiceSelect: (slidingChoiceValue: SlidingChoiceValue) => void
  slidingChoiceGroupClassName?: string
  // A white pill (settings), or a solid blue one with white words (the AI Assistant's tabs and This
  // note's tabs, which need to stand out in both themes).
  slidingChoiceGroupTone?: 'white-pill' | 'solid-blue'
}

// Equal choices side by side on a gray track, with a pill under the chosen one. The pill
// slides to a new choice the way the MD Code | MD View switch does: its leading edge first, so it
// stretches and settles, and pressing another choice leans it that way. The motion lives in
// papeliz-webapp.css (.papeliz-sliding-choice-group).
export function PapelizSlidingChoiceGroup<SlidingChoiceValue extends string>({
  slidingChoiceGroupLabel,
  slidingChoiceGroupRole,
  slidingChoices,
  chosenSlidingChoiceValue,
  onSlidingChoiceSelect,
  slidingChoiceGroupClassName,
  slidingChoiceGroupTone = 'white-pill',
}: PapelizSlidingChoiceGroupProps<SlidingChoiceValue>) {
  const chosenSlidingChoiceIndex = Math.max(
    0,
    slidingChoices.findIndex((slidingChoice) => slidingChoice.slidingChoiceValue === chosenSlidingChoiceValue),
  )
  // Which way the pill last moved, so its leading edge goes first.
  const [shownSlidingChoiceIndex, setShownSlidingChoiceIndex] = useState(chosenSlidingChoiceIndex)
  const [slidingChoiceMoveDirection, setSlidingChoiceMoveDirection] = useState<'forward' | 'backward'>('forward')
  if (shownSlidingChoiceIndex !== chosenSlidingChoiceIndex) {
    setSlidingChoiceMoveDirection(chosenSlidingChoiceIndex > shownSlidingChoiceIndex ? 'forward' : 'backward')
    setShownSlidingChoiceIndex(chosenSlidingChoiceIndex)
  }

  return (
    <div
      role={slidingChoiceGroupRole}
      aria-label={slidingChoiceGroupLabel}
      data-papeliz-sliding-choice-move={slidingChoiceMoveDirection}
      data-papeliz-sliding-choice-tone={slidingChoiceGroupTone}
      className={joinPapelizClassNames('papeliz-sliding-choice-group', slidingChoiceGroupClassName)}
      style={
        {
          '--papeliz-sliding-choice-count': slidingChoices.length,
          '--papeliz-chosen-sliding-choice-index': chosenSlidingChoiceIndex,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="papeliz-sliding-choice-pill" />
      {/* Solid blue: the words again, in white, cut to the pill as it slides (papeliz-webapp.css). */}
      {slidingChoiceGroupTone === 'solid-blue' && (
        <span aria-hidden="true" className="papeliz-sliding-choice-pill-words-left-edge">
          <span className="papeliz-sliding-choice-pill-words-right-edge">
            {slidingChoices.map((slidingChoice) => (
              <span
                key={slidingChoice.slidingChoiceValue}
                data-papeliz-sliding-choice-chosen={slidingChoice.slidingChoiceValue === chosenSlidingChoiceValue}
                className={joinPapelizClassNames('papeliz-sliding-choice-pill-word', slidingChoice.slidingChoiceClassName)}
              >
                {slidingChoice.slidingChoiceContent}
              </span>
            ))}
          </span>
        </span>
      )}
      {slidingChoices.map((slidingChoice) => {
        const isSlidingChoiceChosen = slidingChoice.slidingChoiceValue === chosenSlidingChoiceValue
        return (
          <button
            key={slidingChoice.slidingChoiceValue}
            type="button"
            role={slidingChoiceGroupRole === 'radiogroup' ? 'radio' : 'tab'}
            aria-checked={slidingChoiceGroupRole === 'radiogroup' ? isSlidingChoiceChosen : undefined}
            aria-selected={slidingChoiceGroupRole === 'tablist' ? isSlidingChoiceChosen : undefined}
            title={slidingChoice.slidingChoiceTitle}
            data-papeliz-sliding-choice-chosen={isSlidingChoiceChosen}
            onClick={() => onSlidingChoiceSelect(slidingChoice.slidingChoiceValue)}
            className={joinPapelizClassNames('papeliz-sliding-choice', slidingChoice.slidingChoiceClassName)}
          >
            {slidingChoice.slidingChoiceContent}
          </button>
        )
      })}
    </div>
  )
}
