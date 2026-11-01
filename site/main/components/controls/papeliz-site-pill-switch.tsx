'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import styles from './papeliz-site-pill-switch.module.css'

export type PapelizSitePillSwitchOption<PapelizSitePillSwitchValue extends string> = {
  papelizSitePillSwitchOptionValue: PapelizSitePillSwitchValue
  papelizSitePillSwitchOptionLabel: ReactNode
  // Beside the label, above the pill: a badge, a count.
  papelizSitePillSwitchOptionExtra?: ReactNode
  // The option's name for a screen reader, when the label and extra together don't read as one, such
  // as an icon, a name and a bare count.
  papelizSitePillSwitchOptionAccessibleName?: string
  papelizSitePillSwitchOptionDescribedById?: string
}

// How the switch reads to a screen reader: two buttons, the chosen one pressed; or a tab list whose
// tabs show one panel, with the arrow keys moving between them.
export type PapelizSitePillSwitchRole =
  | { papelizSitePillSwitchRoleKind: 'pressed-buttons' }
  | { papelizSitePillSwitchRoleKind: 'tabs'; papelizSitePillSwitchTabIdPrefix: string; papelizSitePillSwitchTabPanelId: string }

type PapelizSitePillSwitchProps<PapelizSitePillSwitchValue extends string> = {
  papelizSitePillSwitchChosenValue: PapelizSitePillSwitchValue
  papelizSitePillSwitchOptions: readonly PapelizSitePillSwitchOption<PapelizSitePillSwitchValue>[]
  onPapelizSitePillSwitchChoose: (papelizSitePillSwitchValue: PapelizSitePillSwitchValue) => void
  papelizSitePillSwitchLabel: string
  papelizSitePillSwitchRole?: PapelizSitePillSwitchRole
  // Round and centered on the Pricing and Sync pages; compact and left-aligned inside the account page.
  papelizSitePillSwitchVariant?: 'round' | 'compact'
  // Each option as wide as its content, or all equal and filling the space the switch is given.
  papelizSitePillSwitchOptionWidths?: 'fit-content' | 'equal'
  // Inside the track after the options, such as a description an option points to.
  papelizSitePillSwitchAfterOptions?: ReactNode
}

type PapelizSitePillSwitchPillBounds = { left: number; right: number; top: number; bottom: number }

// The site's pill switch, after the app's MD Code | MD View switch. The blue pill is measured from the
// chosen option, so it fits labels and badges of any width, and slides when the choice changes.
export function PapelizSitePillSwitch<PapelizSitePillSwitchValue extends string>({
  papelizSitePillSwitchChosenValue,
  papelizSitePillSwitchOptions,
  onPapelizSitePillSwitchChoose,
  papelizSitePillSwitchLabel,
  papelizSitePillSwitchRole = { papelizSitePillSwitchRoleKind: 'pressed-buttons' },
  papelizSitePillSwitchVariant = 'round',
  papelizSitePillSwitchOptionWidths = 'fit-content',
  papelizSitePillSwitchAfterOptions,
}: PapelizSitePillSwitchProps<PapelizSitePillSwitchValue>) {
  const papelizSitePillSwitchTrackRef = useRef<HTMLDivElement>(null)
  const papelizSitePillSwitchOptionRefs = useRef<Partial<Record<PapelizSitePillSwitchValue, HTMLButtonElement | null>>>({})
  const [papelizSitePillSwitchPillBounds, setPapelizSitePillSwitchPillBounds] = useState<PapelizSitePillSwitchPillBounds | null>(null)
  const [papelizSitePillSwitchMotionIsReady, setPapelizSitePillSwitchMotionIsReady] = useState(false)

  useLayoutEffect(() => {
    const papelizSitePillSwitchTrack = papelizSitePillSwitchTrackRef.current
    if (!papelizSitePillSwitchTrack) return
    const measurePapelizSitePillSwitchPill = () => {
      const papelizSitePillSwitchChosenOption = papelizSitePillSwitchTrack.querySelector<HTMLButtonElement>('button[data-papeliz-pill-switch-chosen="true"]')
      if (!papelizSitePillSwitchChosenOption) return
      const papelizSitePillSwitchTrackRect = papelizSitePillSwitchTrack.getBoundingClientRect()
      const papelizSitePillSwitchChosenOptionRect = papelizSitePillSwitchChosenOption.getBoundingClientRect()
      const papelizSitePillSwitchNextPillBounds: PapelizSitePillSwitchPillBounds = {
        left: papelizSitePillSwitchChosenOptionRect.left - papelizSitePillSwitchTrackRect.left - papelizSitePillSwitchTrack.clientLeft,
        right: papelizSitePillSwitchTrackRect.right - papelizSitePillSwitchChosenOptionRect.right - papelizSitePillSwitchTrack.clientLeft,
        top: papelizSitePillSwitchChosenOptionRect.top - papelizSitePillSwitchTrackRect.top - papelizSitePillSwitchTrack.clientTop,
        bottom: papelizSitePillSwitchTrackRect.bottom - papelizSitePillSwitchChosenOptionRect.bottom - papelizSitePillSwitchTrack.clientTop,
      }
      setPapelizSitePillSwitchPillBounds((papelizSitePillSwitchCurrentPillBounds) =>
        papelizSitePillSwitchCurrentPillBounds &&
        (Object.keys(papelizSitePillSwitchNextPillBounds) as (keyof PapelizSitePillSwitchPillBounds)[]).every(
          (papelizSitePillSwitchPillEdge) =>
            Math.abs(papelizSitePillSwitchCurrentPillBounds[papelizSitePillSwitchPillEdge] - papelizSitePillSwitchNextPillBounds[papelizSitePillSwitchPillEdge]) < 0.1,
        )
          ? papelizSitePillSwitchCurrentPillBounds
          : papelizSitePillSwitchNextPillBounds,
      )
    }
    measurePapelizSitePillSwitchPill()
    const papelizSitePillSwitchResizeObserver = new ResizeObserver(measurePapelizSitePillSwitchPill)
    papelizSitePillSwitchResizeObserver.observe(papelizSitePillSwitchTrack)
    papelizSitePillSwitchTrack.querySelectorAll('button').forEach((papelizSitePillSwitchOptionButton) => papelizSitePillSwitchResizeObserver.observe(papelizSitePillSwitchOptionButton))
    return () => papelizSitePillSwitchResizeObserver.disconnect()
  }, [papelizSitePillSwitchChosenValue, papelizSitePillSwitchOptions])

  useLayoutEffect(() => {
    // Place the first pill without motion, then animate later choices.
    let papelizSitePillSwitchSecondFrame = 0
    const papelizSitePillSwitchFirstFrame = requestAnimationFrame(() => {
      papelizSitePillSwitchSecondFrame = requestAnimationFrame(() => setPapelizSitePillSwitchMotionIsReady(true))
    })
    return () => {
      cancelAnimationFrame(papelizSitePillSwitchFirstFrame)
      cancelAnimationFrame(papelizSitePillSwitchSecondFrame)
    }
  }, [])

  const papelizSitePillSwitchChosenIndex = papelizSitePillSwitchOptions.findIndex(
    (papelizSitePillSwitchOption) => papelizSitePillSwitchOption.papelizSitePillSwitchOptionValue === papelizSitePillSwitchChosenValue,
  )
  const papelizSitePillSwitchIsTabs = papelizSitePillSwitchRole.papelizSitePillSwitchRoleKind === 'tabs'

  // A tab list's keys: Left, Right, Home and End move to a tab and show it.
  function moveBetweenPapelizSitePillSwitchTabs(papelizSitePillSwitchKeyEvent: KeyboardEvent<HTMLButtonElement>) {
    const papelizSitePillSwitchLastIndex = papelizSitePillSwitchOptions.length - 1
    const papelizSitePillSwitchNextIndex = {
      ArrowLeft: papelizSitePillSwitchChosenIndex - 1,
      ArrowRight: papelizSitePillSwitchChosenIndex + 1,
      Home: 0,
      End: papelizSitePillSwitchLastIndex,
    }[papelizSitePillSwitchKeyEvent.key]
    if (papelizSitePillSwitchNextIndex === undefined) return
    papelizSitePillSwitchKeyEvent.preventDefault()
    const papelizSitePillSwitchNextOption =
      papelizSitePillSwitchOptions[(papelizSitePillSwitchNextIndex + papelizSitePillSwitchOptions.length) % papelizSitePillSwitchOptions.length]
    if (!papelizSitePillSwitchNextOption) return
    onPapelizSitePillSwitchChoose(papelizSitePillSwitchNextOption.papelizSitePillSwitchOptionValue)
    papelizSitePillSwitchOptionRefs.current[papelizSitePillSwitchNextOption.papelizSitePillSwitchOptionValue]?.focus()
  }

  return (
    <div
      ref={papelizSitePillSwitchTrackRef}
      role={papelizSitePillSwitchIsTabs ? 'tablist' : 'group'}
      aria-label={papelizSitePillSwitchLabel}
      className={styles.track}
      data-papeliz-pill-switch-variant={papelizSitePillSwitchVariant}
      data-papeliz-pill-switch-option-widths={papelizSitePillSwitchOptionWidths}
      data-papeliz-pill-switch-chosen-side={papelizSitePillSwitchChosenIndex < papelizSitePillSwitchOptions.length / 2 ? 'left' : 'right'}
      data-papeliz-pill-switch-measured={papelizSitePillSwitchPillBounds !== null}
    >
      <span
        aria-hidden="true"
        className={styles.pill}
        data-papeliz-pill-switch-motion-ready={papelizSitePillSwitchMotionIsReady}
        style={
          {
            '--papeliz-pill-switch-pill-left': `${papelizSitePillSwitchPillBounds?.left ?? 0}px`,
            '--papeliz-pill-switch-pill-right': `${papelizSitePillSwitchPillBounds?.right ?? 0}px`,
            top: papelizSitePillSwitchPillBounds?.top ?? 0,
            bottom: papelizSitePillSwitchPillBounds?.bottom ?? 0,
            opacity: papelizSitePillSwitchPillBounds ? 1 : 0,
          } as CSSProperties
        }
      />
      {papelizSitePillSwitchOptions.map((papelizSitePillSwitchOption) => {
        const papelizSitePillSwitchOptionValue = papelizSitePillSwitchOption.papelizSitePillSwitchOptionValue
        const papelizSitePillSwitchOptionIsChosen = papelizSitePillSwitchOptionValue === papelizSitePillSwitchChosenValue
        return (
          <button
            key={papelizSitePillSwitchOptionValue}
            ref={(papelizSitePillSwitchOptionButton) => {
              papelizSitePillSwitchOptionRefs.current[papelizSitePillSwitchOptionValue] = papelizSitePillSwitchOptionButton
            }}
            type="button"
            data-papeliz-pill-switch-chosen={papelizSitePillSwitchOptionIsChosen}
            aria-label={papelizSitePillSwitchOption.papelizSitePillSwitchOptionAccessibleName}
            aria-describedby={papelizSitePillSwitchOption.papelizSitePillSwitchOptionDescribedById}
            {...(papelizSitePillSwitchRole.papelizSitePillSwitchRoleKind === 'tabs'
              ? {
                  role: 'tab',
                  id: `${papelizSitePillSwitchRole.papelizSitePillSwitchTabIdPrefix}-${papelizSitePillSwitchOptionValue}-tab`,
                  'aria-selected': papelizSitePillSwitchOptionIsChosen,
                  'aria-controls': papelizSitePillSwitchRole.papelizSitePillSwitchTabPanelId,
                  tabIndex: papelizSitePillSwitchOptionIsChosen ? 0 : -1,
                  onKeyDown: moveBetweenPapelizSitePillSwitchTabs,
                }
              : { 'aria-pressed': papelizSitePillSwitchOptionIsChosen })}
            onClick={() => onPapelizSitePillSwitchChoose(papelizSitePillSwitchOptionValue)}
          >
            <span className={styles.optionLabel}>{papelizSitePillSwitchOption.papelizSitePillSwitchOptionLabel}</span>
            {papelizSitePillSwitchOption.papelizSitePillSwitchOptionExtra ? (
              <span className={styles.optionExtra}>{papelizSitePillSwitchOption.papelizSitePillSwitchOptionExtra}</span>
            ) : null}
          </button>
        )
      })}
      {papelizSitePillSwitchAfterOptions}
    </div>
  )
}
