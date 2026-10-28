'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

export type PapelizHelpSlidingChoice<PapelizHelpSlidingChoiceValue extends string> = {
  papelizHelpSlidingChoiceValue: PapelizHelpSlidingChoiceValue
  papelizHelpSlidingChoiceContent: ReactNode
}

type PapelizHelpSlidingChoiceGroupProps<PapelizHelpSlidingChoiceValue extends string> = {
  papelizHelpSlidingChoiceGroupLabel: string
  papelizHelpSlidingChoices: ReadonlyArray<PapelizHelpSlidingChoice<PapelizHelpSlidingChoiceValue>>
  papelizHelpChosenSlidingChoiceValue: PapelizHelpSlidingChoiceValue
  onPapelizHelpSlidingChoiceSelect: (papelizHelpSlidingChoiceValue: PapelizHelpSlidingChoiceValue) => void
}

// The app's sliding switch, as a radio group: equal choices on a gray track with a white pill under
// the chosen one. The motion lives in app/globals.css (.papeliz-sliding-choice-group).
export function PapelizHelpSlidingChoiceGroup<PapelizHelpSlidingChoiceValue extends string>({
  papelizHelpSlidingChoiceGroupLabel,
  papelizHelpSlidingChoices,
  papelizHelpChosenSlidingChoiceValue,
  onPapelizHelpSlidingChoiceSelect,
}: PapelizHelpSlidingChoiceGroupProps<PapelizHelpSlidingChoiceValue>) {
  const papelizHelpChosenSlidingChoiceIndex = Math.max(
    0,
    papelizHelpSlidingChoices.findIndex(
      (papelizHelpSlidingChoice) => papelizHelpSlidingChoice.papelizHelpSlidingChoiceValue === papelizHelpChosenSlidingChoiceValue,
    ),
  )
  // Which way the pill last moved, so its leading edge goes first.
  const [papelizHelpShownSlidingChoiceIndex, setPapelizHelpShownSlidingChoiceIndex] = useState(papelizHelpChosenSlidingChoiceIndex)
  const [papelizHelpSlidingChoiceMoveDirection, setPapelizHelpSlidingChoiceMoveDirection] = useState<'forward' | 'backward'>('forward')
  if (papelizHelpShownSlidingChoiceIndex !== papelizHelpChosenSlidingChoiceIndex) {
    setPapelizHelpSlidingChoiceMoveDirection(papelizHelpChosenSlidingChoiceIndex > papelizHelpShownSlidingChoiceIndex ? 'forward' : 'backward')
    setPapelizHelpShownSlidingChoiceIndex(papelizHelpChosenSlidingChoiceIndex)
  }

  return (
    <div
      role="radiogroup"
      aria-label={papelizHelpSlidingChoiceGroupLabel}
      data-papeliz-sliding-choice-move={papelizHelpSlidingChoiceMoveDirection}
      className="papeliz-sliding-choice-group"
      style={
        {
          '--papeliz-sliding-choice-count': papelizHelpSlidingChoices.length,
          '--papeliz-chosen-sliding-choice-index': papelizHelpChosenSlidingChoiceIndex,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="papeliz-sliding-choice-pill" />
      {papelizHelpSlidingChoices.map((papelizHelpSlidingChoice) => {
        const papelizHelpSlidingChoiceIsChosen = papelizHelpSlidingChoice.papelizHelpSlidingChoiceValue === papelizHelpChosenSlidingChoiceValue
        return (
          <button
            key={papelizHelpSlidingChoice.papelizHelpSlidingChoiceValue}
            type="button"
            role="radio"
            aria-checked={papelizHelpSlidingChoiceIsChosen}
            data-papeliz-sliding-choice-chosen={papelizHelpSlidingChoiceIsChosen}
            onClick={() => onPapelizHelpSlidingChoiceSelect(papelizHelpSlidingChoice.papelizHelpSlidingChoiceValue)}
            className="papeliz-sliding-choice"
          >
            {papelizHelpSlidingChoice.papelizHelpSlidingChoiceContent}
          </button>
        )
      })}
    </div>
  )
}
