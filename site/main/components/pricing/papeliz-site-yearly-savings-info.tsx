'use client'

import { Info } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  formatPapelizSiteSyncUsd,
  papelizSiteSyncPlans,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  readPapelizSiteSyncPlanYearlyMonthsSaved,
  readPapelizSiteSyncPlanYearlySavingUsd,
  type PapelizSiteSyncPlan,
} from '@/lib/papeliz-site-sync-plans'

// Hovering waits this long before the table opens, so a pointer passing over the mark does not open it.
const papelizSiteYearlySavingsTipShowDelayMilliseconds = 380
const papelizSiteYearlySavingsTipGapPixels = 8
const papelizSiteYearlySavingsTipWidthPixels = 320

// Every plan saves the same number of months, so the badge names Standard's.
export const papelizSiteSyncYearlyMonthsSaved = readPapelizSiteSyncPlanYearlyMonthsSaved(papelizSiteSyncPlans[0]!)

// The plain-text twin of the table, read with the Yearly choice. Built from the plans, so it can
// never disagree with the prices.
export function describePapelizSiteSyncYearlySavings(): string {
  return papelizSiteSyncPlans
    .map((papelizSiteSyncPlan) => {
      const papelizSiteSyncPlanYearlyMonthlyRate = formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly'))
      return `${papelizSiteSyncPlan.papelizSiteSyncPlanName}: ${formatPapelizSiteSyncUsd(papelizSiteSyncPlan.papelizSiteSyncPlanMonthlyPriceUsd)} a month billed monthly, ${papelizSiteSyncPlanYearlyMonthlyRate} a month billed yearly. You save ${formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanYearlySavingUsd(papelizSiteSyncPlan))} a year, which is ${readPapelizSiteSyncPlanYearlyMonthsSaved(papelizSiteSyncPlan)} months at ${papelizSiteSyncPlanYearlyMonthlyRate}.`
    })
    .join(' ')
}

const papelizSiteYearlySavingsCellClassName = 'border-b border-white/15 px-1.5 py-[3px] text-right whitespace-nowrap first:pl-0 first:text-left last:pr-0'

// One table: what each plan costs for a month and for twelve.
function PapelizSiteYearlySavingsCostTable({
  papelizSiteYearlySavingsCostTableTitle,
  papelizSiteYearlySavingsCostTablePlanHeading,
  readPapelizSiteYearlySavingsCostTableMonthlyRateUsd,
}: {
  papelizSiteYearlySavingsCostTableTitle: string
  papelizSiteYearlySavingsCostTablePlanHeading: string
  readPapelizSiteYearlySavingsCostTableMonthlyRateUsd: (papelizSiteSyncPlan: PapelizSiteSyncPlan) => number
}) {
  return (
    <section className="grid gap-1.5">
      <strong className="block border-b border-white/25 pb-[7px] text-center text-xs font-semibold">{papelizSiteYearlySavingsCostTableTitle}</strong>
      <table className="w-full table-fixed border-collapse tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[34%] font-semibold text-white`}>
              {papelizSiteYearlySavingsCostTablePlanHeading}
            </th>
            <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[28%] font-semibold text-white/75`}>Monthly</th>
            <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[38%] font-semibold text-white/75`}>12 Months</th>
          </tr>
        </thead>
        <tbody>
          {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => (
            <tr key={papelizSiteSyncPlan.papelizSiteSyncPlanId}>
              <th scope="row" className={`${papelizSiteYearlySavingsCellClassName} font-normal`}>{papelizSiteSyncPlan.papelizSiteSyncPlanName}</th>
              <td className={papelizSiteYearlySavingsCellClassName}>{formatPapelizSiteSyncUsd(readPapelizSiteYearlySavingsCostTableMonthlyRateUsd(papelizSiteSyncPlan))}</td>
              <td className={papelizSiteYearlySavingsCellClassName}>{formatPapelizSiteSyncUsd(readPapelizSiteYearlySavingsCostTableMonthlyRateUsd(papelizSiteSyncPlan) * 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// The table behind the Yearly badge: what you pay monthly, what you pay
// yearly, and why yearly saves you its months.
function PapelizSiteYearlySavingsTables() {
  return (
    <div className="grid gap-[22px]">
      <PapelizSiteYearlySavingsCostTable
        papelizSiteYearlySavingsCostTableTitle="What You Pay Monthly"
        papelizSiteYearlySavingsCostTablePlanHeading="Plan: Monthly"
        readPapelizSiteYearlySavingsCostTableMonthlyRateUsd={(papelizSiteSyncPlan) => readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'monthly')}
      />
      <PapelizSiteYearlySavingsCostTable
        papelizSiteYearlySavingsCostTableTitle="What You Pay Yearly"
        papelizSiteYearlySavingsCostTablePlanHeading="Plan: Yearly"
        readPapelizSiteYearlySavingsCostTableMonthlyRateUsd={(papelizSiteSyncPlan) => readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly')}
      />
      <section className="grid gap-1.5">
        <strong className="block border-b border-white/25 pb-[7px] text-center text-xs font-semibold">
          Why Yearly Saves You {papelizSiteSyncYearlyMonthsSaved} Months?
        </strong>
        <table className="w-full table-fixed border-collapse tabular-nums">
          <thead>
            <tr>
              <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[34%] font-semibold text-white`}>Plan: Yearly</th>
              <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[28%] font-semibold text-white/75`}>You save</th>
              <th scope="col" className={`${papelizSiteYearlySavingsCellClassName} w-[38%] font-semibold text-white/75`}>Same as</th>
            </tr>
          </thead>
          <tbody>
            {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => (
              <tr key={papelizSiteSyncPlan.papelizSiteSyncPlanId}>
                <th scope="row" className={`${papelizSiteYearlySavingsCellClassName} font-normal`}>{papelizSiteSyncPlan.papelizSiteSyncPlanName}</th>
                <td className={`${papelizSiteYearlySavingsCellClassName} font-bold`}>{formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanYearlySavingUsd(papelizSiteSyncPlan))}</td>
                <td className={`${papelizSiteYearlySavingsCellClassName} font-bold`}>
                  {readPapelizSiteSyncPlanYearlyMonthsSaved(papelizSiteSyncPlan)} months at{' '}
                  {formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly'))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

// The info mark inside the Yearly badge. Hovering it opens the table; a click or tap pins it open
// without changing the period, and a second click, a press outside or Escape closes it. The open table
// is placed under the mark, or above it when there is no room below, and follows it on scroll.
function PapelizSiteYearlySavingsInfoMark() {
  const papelizSiteYearlySavingsTipId = useId()
  const papelizSiteYearlySavingsMarkRef = useRef<HTMLSpanElement>(null)
  const papelizSiteYearlySavingsTipRef = useRef<HTMLDivElement>(null)
  const papelizSiteYearlySavingsShowTimerRef = useRef<number | null>(null)
  const papelizSiteYearlySavingsTipIsPinnedRef = useRef(false)
  const [papelizSiteYearlySavingsTipIsOpen, setPapelizSiteYearlySavingsTipIsOpen] = useState(false)

  const cancelPapelizSiteYearlySavingsShow = () => {
    if (papelizSiteYearlySavingsShowTimerRef.current === null) return
    window.clearTimeout(papelizSiteYearlySavingsShowTimerRef.current)
    papelizSiteYearlySavingsShowTimerRef.current = null
  }

  const closePapelizSiteYearlySavingsTip = useCallback(() => {
    cancelPapelizSiteYearlySavingsShow()
    papelizSiteYearlySavingsTipIsPinnedRef.current = false
    setPapelizSiteYearlySavingsTipIsOpen(false)
  }, [])

  useLayoutEffect(() => {
    if (!papelizSiteYearlySavingsTipIsOpen) return
    const placePapelizSiteYearlySavingsTip = () => {
      const papelizSiteYearlySavingsMark = papelizSiteYearlySavingsMarkRef.current
      const papelizSiteYearlySavingsTip = papelizSiteYearlySavingsTipRef.current
      if (!papelizSiteYearlySavingsMark || !papelizSiteYearlySavingsTip) return
      const papelizSiteYearlySavingsMarkRect = papelizSiteYearlySavingsMark.getBoundingClientRect()
      const papelizSiteViewportWidth = window.visualViewport?.width ?? window.innerWidth
      const papelizSiteViewportHeight = window.visualViewport?.height ?? window.innerHeight
      const papelizSiteYearlySavingsTipWidth = papelizSiteYearlySavingsTip.offsetWidth
      const papelizSiteYearlySavingsTipHeight = papelizSiteYearlySavingsTip.offsetHeight
      const papelizSiteYearlySavingsTipLeft = Math.max(
        papelizSiteYearlySavingsTipGapPixels,
        Math.min(
          papelizSiteYearlySavingsMarkRect.left + papelizSiteYearlySavingsMarkRect.width / 2 - papelizSiteYearlySavingsTipWidth / 2,
          papelizSiteViewportWidth - papelizSiteYearlySavingsTipWidth - papelizSiteYearlySavingsTipGapPixels,
        ),
      )
      const papelizSiteYearlySavingsTipOpensAbove =
        papelizSiteViewportHeight - papelizSiteYearlySavingsMarkRect.bottom - papelizSiteYearlySavingsTipGapPixels < papelizSiteYearlySavingsTipHeight &&
        papelizSiteYearlySavingsMarkRect.top > papelizSiteYearlySavingsTipHeight
      papelizSiteYearlySavingsTip.style.left = `${papelizSiteYearlySavingsTipLeft}px`
      papelizSiteYearlySavingsTip.style.top = `${
        papelizSiteYearlySavingsTipOpensAbove
          ? papelizSiteYearlySavingsMarkRect.top - papelizSiteYearlySavingsTipGapPixels - papelizSiteYearlySavingsTipHeight
          : papelizSiteYearlySavingsMarkRect.bottom + papelizSiteYearlySavingsTipGapPixels
      }px`
      papelizSiteYearlySavingsTip.style.visibility = 'visible'
    }
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!papelizSiteYearlySavingsMarkRef.current?.contains(pointerEvent.target as Node)) closePapelizSiteYearlySavingsTip()
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') closePapelizSiteYearlySavingsTip()
    }
    placePapelizSiteYearlySavingsTip()
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', placePapelizSiteYearlySavingsTip, true)
    window.addEventListener('resize', placePapelizSiteYearlySavingsTip)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', placePapelizSiteYearlySavingsTip, true)
      window.removeEventListener('resize', placePapelizSiteYearlySavingsTip)
    }
  }, [papelizSiteYearlySavingsTipIsOpen, closePapelizSiteYearlySavingsTip])

  useEffect(() => cancelPapelizSiteYearlySavingsShow, [])

  return (
    <>
      <span
        ref={papelizSiteYearlySavingsMarkRef}
        aria-hidden="true"
        className="-mr-0.5 inline-flex size-3.5 cursor-help items-center justify-center rounded-full hover:bg-papeliz-diff-added-ink/15"
        onMouseEnter={() => {
          cancelPapelizSiteYearlySavingsShow()
          papelizSiteYearlySavingsShowTimerRef.current = window.setTimeout(() => {
            papelizSiteYearlySavingsShowTimerRef.current = null
            setPapelizSiteYearlySavingsTipIsOpen(true)
          }, papelizSiteYearlySavingsTipShowDelayMilliseconds)
        }}
        onMouseLeave={() => {
          if (!papelizSiteYearlySavingsTipIsPinnedRef.current) closePapelizSiteYearlySavingsTip()
        }}
        // A pinning click belongs to the mark alone: it does not choose Yearly.
        onClick={(clickEvent: MouseEvent) => {
          clickEvent.stopPropagation()
          if (papelizSiteYearlySavingsTipIsPinnedRef.current) {
            closePapelizSiteYearlySavingsTip()
            return
          }
          cancelPapelizSiteYearlySavingsShow()
          papelizSiteYearlySavingsTipIsPinnedRef.current = true
          setPapelizSiteYearlySavingsTipIsOpen(true)
        }}
      >
        <Info className="size-3" strokeWidth={2.25} />
      </span>
      {papelizSiteYearlySavingsTipIsOpen &&
        createPortal(
          // Hidden until placed, so it never shows at the corner first.
          <div
            ref={papelizSiteYearlySavingsTipRef}
            id={papelizSiteYearlySavingsTipId}
            role="tooltip"
            className="papeliz-site-selection-on-color pointer-events-none invisible fixed top-0 left-0 z-50 rounded-xl border border-white/15 bg-papeliz-topbar px-3.5 py-3 text-left text-xs leading-snug font-normal text-white shadow-papeliz-pop"
            style={{ width: `min(${papelizSiteYearlySavingsTipWidthPixels}px, calc(100vw - ${papelizSiteYearlySavingsTipGapPixels * 2}px))` }}
          >
            <PapelizSiteYearlySavingsTables />
          </div>,
          document.body,
        )}
    </>
  )
}

// The info mark inside the Yearly badge and its screen-reader description.
export function createPapelizSiteYearlySavingsBadgeInfo() {
  return {
    papelizSiteBillingPeriodBadgeInfoTrigger: <PapelizSiteYearlySavingsInfoMark />,
    papelizSiteBillingPeriodBadgeInfoDescription: describePapelizSiteSyncYearlySavings(),
  }
}
