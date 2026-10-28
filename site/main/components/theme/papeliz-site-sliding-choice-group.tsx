'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

export type PapelizSiteSlidingChoice<PapelizSiteSlidingChoiceValue extends string> = {
  papelizSiteSlidingChoiceValue: PapelizSiteSlidingChoiceValue
  papelizSiteSlidingChoiceContent: ReactNode
}

type PapelizSiteSlidingChoiceGroupProps<PapelizSiteSlidingChoiceValue extends string> = {
  papelizSiteSlidingChoiceGroupLabel: string
  papelizSiteSlidingChoices: ReadonlyArray<PapelizSiteSlidingChoice<PapelizSiteSlidingChoiceValue>>
  papelizSiteChosenSlidingChoiceValue: PapelizSiteSlidingChoiceValue
  onPapelizSiteSlidingChoiceSelect: (papelizSiteSlidingChoiceValue: PapelizSiteSlidingChoiceValue) => void
}

// The app's sliding switch, as a radio group: equal choices on a gray track with a white pill under
// the chosen one. The motion lives in globals.css (.papeliz-sliding-choice-group).
export function PapelizSiteSlidingChoiceGroup<PapelizSiteSlidingChoiceValue extends string>({
  papelizSiteSlidingChoiceGroupLabel,
  papelizSiteSlidingChoices,
  papelizSiteChosenSlidingChoiceValue,
  onPapelizSiteSlidingChoiceSelect,
}: PapelizSiteSlidingChoiceGroupProps<PapelizSiteSlidingChoiceValue>) {
  const papelizSiteChosenSlidingChoiceIndex = Math.max(
    0,
    papelizSiteSlidingChoices.findIndex(
      (papelizSiteSlidingChoice) => papelizSiteSlidingChoice.papelizSiteSlidingChoiceValue === papelizSiteChosenSlidingChoiceValue,
    ),
  )
  // Which way the pill last moved, so its leading edge goes first.
  const [papelizSiteShownSlidingChoiceIndex, setPapelizSiteShownSlidingChoiceIndex] = useState(papelizSiteChosenSlidingChoiceIndex)
  const [papelizSiteSlidingChoiceMoveDirection, setPapelizSiteSlidingChoiceMoveDirection] = useState<'forward' | 'backward'>('forward')
  if (papelizSiteShownSlidingChoiceIndex !== papelizSiteChosenSlidingChoiceIndex) {
    setPapelizSiteSlidingChoiceMoveDirection(papelizSiteChosenSlidingChoiceIndex > papelizSiteShownSlidingChoiceIndex ? 'forward' : 'backward')
    setPapelizSiteShownSlidingChoiceIndex(papelizSiteChosenSlidingChoiceIndex)
  }

  return (
    <div
      role="radiogroup"
      aria-label={papelizSiteSlidingChoiceGroupLabel}
      data-papeliz-sliding-choice-move={papelizSiteSlidingChoiceMoveDirection}
      className="papeliz-sliding-choice-group"
      style={
        {
          '--papeliz-sliding-choice-count': papelizSiteSlidingChoices.length,
          '--papeliz-chosen-sliding-choice-index': papelizSiteChosenSlidingChoiceIndex,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="papeliz-sliding-choice-pill" />
      {papelizSiteSlidingChoices.map((papelizSiteSlidingChoice) => {
        const papelizSiteSlidingChoiceIsChosen = papelizSiteSlidingChoice.papelizSiteSlidingChoiceValue === papelizSiteChosenSlidingChoiceValue
        return (
          <button
            key={papelizSiteSlidingChoice.papelizSiteSlidingChoiceValue}
            type="button"
            role="radio"
            aria-checked={papelizSiteSlidingChoiceIsChosen}
            data-papeliz-sliding-choice-chosen={papelizSiteSlidingChoiceIsChosen}
            onClick={() => onPapelizSiteSlidingChoiceSelect(papelizSiteSlidingChoice.papelizSiteSlidingChoiceValue)}
            className="papeliz-sliding-choice"
          >
            {papelizSiteSlidingChoice.papelizSiteSlidingChoiceContent}
          </button>
        )
      })}
    </div>
  )
}
