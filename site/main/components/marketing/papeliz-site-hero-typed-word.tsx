'use client'

import { useEffect, useState } from 'react'

type PapelizSiteHeroTypedWordProps = {
  papelizSiteHeroTypedWords: readonly string[]
}

const papelizSiteHeroTypingMillisecondsPerLetter = 75
const papelizSiteHeroErasingMillisecondsPerLetter = 40
const papelizSiteHeroWordHoldMilliseconds = 1900
const papelizSiteHeroEmptyHoldMilliseconds = 320

// The end of the home page's title: each word types itself out, holds, and erases before the next.
// The first word is there from the start (and stays, with reduced motion). The slot is as wide as
// the longest word, so changing words never moves the page. Screen readers read the h1's label.
export function PapelizSiteHeroTypedWord({ papelizSiteHeroTypedWords }: PapelizSiteHeroTypedWordProps) {
  const [papelizSiteHeroShownText, setPapelizSiteHeroShownText] = useState(papelizSiteHeroTypedWords[0] ?? '')
  const papelizSiteHeroLongestWord = papelizSiteHeroTypedWords.reduce(
    (papelizSiteHeroLongestSoFar, papelizSiteHeroTypedWord) =>
      papelizSiteHeroTypedWord.length > papelizSiteHeroLongestSoFar.length ? papelizSiteHeroTypedWord : papelizSiteHeroLongestSoFar,
    '',
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || papelizSiteHeroTypedWords.length < 2) return
    let papelizSiteHeroWordIndex = 0
    let papelizSiteHeroLetterCount = papelizSiteHeroTypedWords[0].length
    let papelizSiteHeroIsErasing = true
    let papelizSiteHeroTimer = window.setTimeout(stepPapelizSiteHeroTyping, papelizSiteHeroWordHoldMilliseconds)

    function stepPapelizSiteHeroTyping() {
      const papelizSiteHeroCurrentWord = papelizSiteHeroTypedWords[papelizSiteHeroWordIndex]
      let papelizSiteHeroNextDelay: number
      if (papelizSiteHeroIsErasing) {
        papelizSiteHeroLetterCount -= 1
        papelizSiteHeroNextDelay = papelizSiteHeroErasingMillisecondsPerLetter
        if (papelizSiteHeroLetterCount <= 0) {
          papelizSiteHeroLetterCount = 0
          papelizSiteHeroIsErasing = false
          papelizSiteHeroWordIndex = (papelizSiteHeroWordIndex + 1) % papelizSiteHeroTypedWords.length
          papelizSiteHeroNextDelay = papelizSiteHeroEmptyHoldMilliseconds
        }
        setPapelizSiteHeroShownText(papelizSiteHeroCurrentWord.slice(0, papelizSiteHeroLetterCount))
      } else {
        const papelizSiteHeroWordBeingTyped = papelizSiteHeroTypedWords[papelizSiteHeroWordIndex]
        papelizSiteHeroLetterCount += 1
        papelizSiteHeroNextDelay = papelizSiteHeroTypingMillisecondsPerLetter
        if (papelizSiteHeroLetterCount >= papelizSiteHeroWordBeingTyped.length) {
          papelizSiteHeroLetterCount = papelizSiteHeroWordBeingTyped.length
          papelizSiteHeroIsErasing = true
          papelizSiteHeroNextDelay = papelizSiteHeroWordHoldMilliseconds
        }
        setPapelizSiteHeroShownText(papelizSiteHeroWordBeingTyped.slice(0, papelizSiteHeroLetterCount))
      }
      papelizSiteHeroTimer = window.setTimeout(stepPapelizSiteHeroTyping, papelizSiteHeroNextDelay)
    }

    return () => window.clearTimeout(papelizSiteHeroTimer)
  }, [papelizSiteHeroTypedWords])

  return (
    <span className="inline-grid text-left align-top whitespace-nowrap">
      {/* Holds the slot open at the longest word's width, caret included. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {papelizSiteHeroLongestWord}
        <span className="papeliz-site-hero-caret">|</span>
      </span>
      <span className="col-start-1 row-start-1">
        {papelizSiteHeroShownText}
        <span aria-hidden="true" className="papeliz-site-hero-caret">
          |
        </span>
      </span>
    </span>
  )
}
