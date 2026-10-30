'use client'

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PapelizSiteSyncBillingPeriod } from '@/lib/papeliz-site-sync-plans'
import styles from './papeliz-site-billing-period-switch.module.css'

export type PapelizSiteBillingPeriodChoice = {
  papelizSiteBillingPeriodChoiceValue: PapelizSiteSyncBillingPeriod
  papelizSiteBillingPeriodChoiceLabel: string
  papelizSiteBillingPeriodChoiceBadge?: string
}

type PapelizSiteBillingPeriodSwitchProps = {
  papelizSiteChosenBillingPeriod: PapelizSiteSyncBillingPeriod
  papelizSiteBillingPeriodChoices: readonly PapelizSiteBillingPeriodChoice[]
  onPapelizSiteBillingPeriodChoose: (papelizSiteBillingPeriod: PapelizSiteSyncBillingPeriod) => void
  papelizSiteBillingPeriodSwitchLabel: string
  // Explains the badge: the trigger sits inside the badge, the description is read with its choice.
  papelizSiteBillingPeriodBadgeInfo?: { papelizSiteBillingPeriodBadgeInfoTrigger: ReactNode; papelizSiteBillingPeriodBadgeInfoDescription: string }
}

type PapelizSiteBillingPeriodPillBounds = { left: number; right: number; top: number; bottom: number }

// The Monthly / Yearly switch above Papeliz Sync's plans. The blue pill is measured from the chosen
// button, so it fits labels and badges of any width, and slides when the period changes.
export function PapelizSiteBillingPeriodSwitch({
  papelizSiteChosenBillingPeriod,
  papelizSiteBillingPeriodChoices,
  onPapelizSiteBillingPeriodChoose,
  papelizSiteBillingPeriodSwitchLabel,
  papelizSiteBillingPeriodBadgeInfo,
}: PapelizSiteBillingPeriodSwitchProps) {
  const papelizSiteBillingPeriodBadgeInfoId = useId()
  const papelizSiteBillingPeriodTrackRef = useRef<HTMLDivElement>(null)
  const [papelizSiteBillingPeriodPillBounds, setPapelizSiteBillingPeriodPillBounds] = useState<PapelizSiteBillingPeriodPillBounds | null>(null)
  const [papelizSiteBillingPeriodMotionIsReady, setPapelizSiteBillingPeriodMotionIsReady] = useState(false)

  useLayoutEffect(() => {
    const papelizSiteBillingPeriodTrack = papelizSiteBillingPeriodTrackRef.current
    if (!papelizSiteBillingPeriodTrack) return
    const measurePapelizSiteBillingPeriodPill = () => {
      const papelizSiteChosenBillingPeriodButton = papelizSiteBillingPeriodTrack.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      if (!papelizSiteChosenBillingPeriodButton) return
      const papelizSiteBillingPeriodTrackRect = papelizSiteBillingPeriodTrack.getBoundingClientRect()
      const papelizSiteChosenBillingPeriodButtonRect = papelizSiteChosenBillingPeriodButton.getBoundingClientRect()
      const papelizSiteBillingPeriodNextPillBounds: PapelizSiteBillingPeriodPillBounds = {
        left: papelizSiteChosenBillingPeriodButtonRect.left - papelizSiteBillingPeriodTrackRect.left - papelizSiteBillingPeriodTrack.clientLeft,
        right: papelizSiteBillingPeriodTrackRect.right - papelizSiteChosenBillingPeriodButtonRect.right - papelizSiteBillingPeriodTrack.clientLeft,
        top: papelizSiteChosenBillingPeriodButtonRect.top - papelizSiteBillingPeriodTrackRect.top - papelizSiteBillingPeriodTrack.clientTop,
        bottom: papelizSiteBillingPeriodTrackRect.bottom - papelizSiteChosenBillingPeriodButtonRect.bottom - papelizSiteBillingPeriodTrack.clientTop,
      }
      setPapelizSiteBillingPeriodPillBounds((papelizSiteBillingPeriodCurrentPillBounds) =>
        papelizSiteBillingPeriodCurrentPillBounds &&
        (Object.keys(papelizSiteBillingPeriodNextPillBounds) as (keyof PapelizSiteBillingPeriodPillBounds)[]).every(
          (papelizSiteBillingPeriodPillEdge) =>
            Math.abs(papelizSiteBillingPeriodCurrentPillBounds[papelizSiteBillingPeriodPillEdge] - papelizSiteBillingPeriodNextPillBounds[papelizSiteBillingPeriodPillEdge]) < 0.1,
        )
          ? papelizSiteBillingPeriodCurrentPillBounds
          : papelizSiteBillingPeriodNextPillBounds,
      )
    }
    measurePapelizSiteBillingPeriodPill()
    const papelizSiteBillingPeriodResizeObserver = new ResizeObserver(measurePapelizSiteBillingPeriodPill)
    papelizSiteBillingPeriodResizeObserver.observe(papelizSiteBillingPeriodTrack)
    papelizSiteBillingPeriodTrack.querySelectorAll('button').forEach((papelizSiteBillingPeriodButton) => papelizSiteBillingPeriodResizeObserver.observe(papelizSiteBillingPeriodButton))
    return () => papelizSiteBillingPeriodResizeObserver.disconnect()
  }, [papelizSiteChosenBillingPeriod, papelizSiteBillingPeriodChoices])

  useLayoutEffect(() => {
    // Place the first pill without motion, then animate later choices.
    let papelizSiteBillingPeriodSecondFrame = 0
    const papelizSiteBillingPeriodFirstFrame = requestAnimationFrame(() => {
      papelizSiteBillingPeriodSecondFrame = requestAnimationFrame(() => setPapelizSiteBillingPeriodMotionIsReady(true))
    })
    return () => {
      cancelAnimationFrame(papelizSiteBillingPeriodFirstFrame)
      cancelAnimationFrame(papelizSiteBillingPeriodSecondFrame)
    }
  }, [])

  const papelizSiteChosenBillingPeriodIndex = papelizSiteBillingPeriodChoices.findIndex(
    (papelizSiteBillingPeriodChoice) => papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceValue === papelizSiteChosenBillingPeriod,
  )

  return (
    <div
      ref={papelizSiteBillingPeriodTrackRef}
      role="group"
      aria-label={papelizSiteBillingPeriodSwitchLabel}
      className={styles.track}
      data-papeliz-billing-period-chosen-side={papelizSiteChosenBillingPeriodIndex < papelizSiteBillingPeriodChoices.length / 2 ? 'left' : 'right'}
      data-papeliz-billing-period-measured={papelizSiteBillingPeriodPillBounds !== null}
    >
      <span
        aria-hidden="true"
        className={styles.pill}
        data-papeliz-billing-period-motion-ready={papelizSiteBillingPeriodMotionIsReady}
        style={
          {
            '--papeliz-billing-period-pill-left': `${papelizSiteBillingPeriodPillBounds?.left ?? 0}px`,
            '--papeliz-billing-period-pill-right': `${papelizSiteBillingPeriodPillBounds?.right ?? 0}px`,
            top: papelizSiteBillingPeriodPillBounds?.top ?? 0,
            bottom: papelizSiteBillingPeriodPillBounds?.bottom ?? 0,
            opacity: papelizSiteBillingPeriodPillBounds ? 1 : 0,
          } as CSSProperties
        }
      />
      {papelizSiteBillingPeriodChoices.map((papelizSiteBillingPeriodChoice) => (
        <button
          key={papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceValue}
          type="button"
          aria-pressed={papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceValue === papelizSiteChosenBillingPeriod}
          aria-describedby={
            papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge && papelizSiteBillingPeriodBadgeInfo ? papelizSiteBillingPeriodBadgeInfoId : undefined
          }
          onClick={() => onPapelizSiteBillingPeriodChoose(papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceValue)}
        >
          <span className={styles.label}>{papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceLabel}</span>
          {papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge ? (
            <span className={styles.badge}>
              {papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge}
              {papelizSiteBillingPeriodBadgeInfo?.papelizSiteBillingPeriodBadgeInfoTrigger}
            </span>
          ) : null}
        </button>
      ))}
      {papelizSiteBillingPeriodBadgeInfo ? (
        <span id={papelizSiteBillingPeriodBadgeInfoId} className={styles.srOnly}>
          {papelizSiteBillingPeriodBadgeInfo.papelizSiteBillingPeriodBadgeInfoDescription}
        </span>
      ) : null}
    </div>
  )
}
