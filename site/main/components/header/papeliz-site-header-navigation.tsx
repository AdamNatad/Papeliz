'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'
import { papelizSiteHeaderLinks } from '@/lib/papeliz-site-navigation'

type PapelizSiteHeaderIndicatorPlacement = {
  papelizSiteHeaderIndicatorLeft: number
  papelizSiteHeaderIndicatorTop: number
  papelizSiteHeaderIndicatorWidth: number
  papelizSiteHeaderIndicatorIsShown: boolean
}

// The underline is this share of its label's width, centered under it.
const papelizSiteHeaderIndicatorLabelShare = 0.6
// The underline's top sits this many pixels above the current link's bottom edge, just under the
// label, rather than down at the bottom of the header bar.
const papelizSiteHeaderIndicatorRiseAboveLinkBottom = 6

// A header link's look: the page links here, and Community at the header's right.
export function createPapelizSiteHeaderLinkClassName(papelizSiteHeaderLinkIsCurrent: boolean) {
  return `rounded-full px-2 py-1.5 text-[15px] whitespace-nowrap transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-white lg:px-3 ${
    papelizSiteHeaderLinkIsCurrent ? 'font-medium text-white' : 'text-white/90'
  }`
}

// The header's page links, with a white underline under the current page. The underline is placed
// within the whole header bar (marked data-papeliz-site-header-bar), so it also reaches Community at
// the right. Moving to another page, the underline slides there; on first load, or coming from a
// page with no link in the header (home), it grows in place; a resize or a font arriving moves it
// without motion. Phones rely on the footer's links for now.
export function PapelizSiteHeaderNavigation() {
  const papelizSiteCurrentPathname = usePathname()
  const papelizSiteHeaderNavigationRef = useRef<HTMLElement>(null)
  const [papelizSiteHeaderIndicatorPlacement, setPapelizSiteHeaderIndicatorPlacement] = useState<PapelizSiteHeaderIndicatorPlacement>({
    papelizSiteHeaderIndicatorLeft: 0,
    papelizSiteHeaderIndicatorTop: 0,
    papelizSiteHeaderIndicatorWidth: 0,
    papelizSiteHeaderIndicatorIsShown: false,
  })
  // Off while the underline is placed without motion; on once it may slide to a new page.
  const [papelizSiteHeaderIndicatorSlides, setPapelizSiteHeaderIndicatorSlides] = useState(false)
  const papelizSiteHeaderIndicatorWasShownRef = useRef(false)

  useLayoutEffect(() => {
    const papelizSiteHeaderNavigationElement = papelizSiteHeaderNavigationRef.current
    const papelizSiteHeaderBarElement = papelizSiteHeaderNavigationElement?.closest<HTMLElement>('[data-papeliz-site-header-bar]')
    if (!papelizSiteHeaderNavigationElement || !papelizSiteHeaderBarElement) return
    let papelizSiteHeaderMeasureFrame = 0
    let papelizSiteHeaderRevealFrame = 0
    let papelizSiteHeaderNavigationIsDisposed = false

    const placePapelizSiteHeaderIndicator = (papelizSiteHeaderIndicatorMaySlide: boolean) => {
      const papelizSiteCurrentLinkLabel = papelizSiteHeaderBarElement.querySelector<HTMLElement>(
        '[aria-current="page"] [data-papeliz-site-header-link-label]',
      )
      const papelizSiteHeaderBarRect = papelizSiteHeaderBarElement.getBoundingClientRect()
      // No link for this page, or the links are hidden (phones): no underline.
      if (
        !papelizSiteCurrentLinkLabel ||
        papelizSiteHeaderNavigationElement.getBoundingClientRect().width === 0 ||
        papelizSiteCurrentLinkLabel.getBoundingClientRect().width === 0
      ) {
        papelizSiteHeaderIndicatorWasShownRef.current = false
        setPapelizSiteHeaderIndicatorSlides(false)
        setPapelizSiteHeaderIndicatorPlacement((papelizSiteHeaderIndicatorCurrentPlacement) => ({
          ...papelizSiteHeaderIndicatorCurrentPlacement,
          papelizSiteHeaderIndicatorIsShown: false,
        }))
        return
      }
      const papelizSiteCurrentLinkLabelRect = papelizSiteCurrentLinkLabel.getBoundingClientRect()
      const papelizSiteHeaderIndicatorWidth = papelizSiteCurrentLinkLabelRect.width * papelizSiteHeaderIndicatorLabelShare
      const papelizSiteHeaderIndicatorLeft =
        papelizSiteCurrentLinkLabelRect.left -
        papelizSiteHeaderBarRect.left +
        (papelizSiteCurrentLinkLabelRect.width - papelizSiteHeaderIndicatorWidth) / 2
      const papelizSiteCurrentLinkRect = (papelizSiteCurrentLinkLabel.closest('[aria-current="page"]') ?? papelizSiteCurrentLinkLabel).getBoundingClientRect()
      const papelizSiteHeaderIndicatorTop =
        papelizSiteCurrentLinkRect.bottom - papelizSiteHeaderBarRect.top - papelizSiteHeaderIndicatorRiseAboveLinkBottom
      const papelizSiteHeaderIndicatorSlidesHere = papelizSiteHeaderIndicatorMaySlide && papelizSiteHeaderIndicatorWasShownRef.current
      setPapelizSiteHeaderIndicatorSlides(papelizSiteHeaderIndicatorSlidesHere)
      setPapelizSiteHeaderIndicatorPlacement({
        papelizSiteHeaderIndicatorLeft,
        papelizSiteHeaderIndicatorTop,
        papelizSiteHeaderIndicatorWidth,
        papelizSiteHeaderIndicatorIsShown: papelizSiteHeaderIndicatorSlidesHere,
      })
      if (!papelizSiteHeaderIndicatorSlidesHere) {
        // Placed without motion and scaled to zero first, then grown in place two frames later.
        cancelAnimationFrame(papelizSiteHeaderRevealFrame)
        papelizSiteHeaderRevealFrame = requestAnimationFrame(() => {
          papelizSiteHeaderRevealFrame = requestAnimationFrame(() => {
            if (papelizSiteHeaderNavigationIsDisposed) return
            setPapelizSiteHeaderIndicatorSlides(true)
            setPapelizSiteHeaderIndicatorPlacement((papelizSiteHeaderIndicatorCurrentPlacement) => ({
              ...papelizSiteHeaderIndicatorCurrentPlacement,
              papelizSiteHeaderIndicatorIsShown: true,
            }))
          })
        })
      }
      papelizSiteHeaderIndicatorWasShownRef.current = true
    }

    const placePapelizSiteHeaderIndicatorWithoutMotion = () => {
      cancelAnimationFrame(papelizSiteHeaderMeasureFrame)
      papelizSiteHeaderMeasureFrame = requestAnimationFrame(() => {
        if (papelizSiteHeaderNavigationIsDisposed) return
        const papelizSiteHeaderIndicatorWasShown = papelizSiteHeaderIndicatorWasShownRef.current
        placePapelizSiteHeaderIndicator(true)
        // A layout change keeps the underline shown: only its place changes, without sliding.
        if (papelizSiteHeaderIndicatorWasShown) setPapelizSiteHeaderIndicatorSlides(false)
      })
    }

    // A new page: slide if the underline is already showing, otherwise grow in place.
    placePapelizSiteHeaderIndicator(true)

    // A ResizeObserver reports once as soon as it starts watching; that report is skipped so it does
    // not cut short the slide that has just begun.
    let papelizSiteHeaderResizeObserverHasReported = false
    const papelizSiteHeaderResizeObserver = new ResizeObserver(() => {
      if (!papelizSiteHeaderResizeObserverHasReported) {
        papelizSiteHeaderResizeObserverHasReported = true
        return
      }
      placePapelizSiteHeaderIndicatorWithoutMotion()
    })
    // The bar, not just the page links: Community's place changes with the window's width.
    papelizSiteHeaderResizeObserver.observe(papelizSiteHeaderBarElement)
    document.fonts.addEventListener('loadingdone', placePapelizSiteHeaderIndicatorWithoutMotion)
    return () => {
      papelizSiteHeaderNavigationIsDisposed = true
      cancelAnimationFrame(papelizSiteHeaderMeasureFrame)
      cancelAnimationFrame(papelizSiteHeaderRevealFrame)
      papelizSiteHeaderResizeObserver.disconnect()
      document.fonts.removeEventListener('loadingdone', placePapelizSiteHeaderIndicatorWithoutMotion)
    }
  }, [papelizSiteCurrentPathname])

  return (
    // Not positioned itself: the underline below is placed within the header bar.
    <nav ref={papelizSiteHeaderNavigationRef} aria-label="Main" className="hidden items-center gap-0.5 self-stretch md:flex">
      {papelizSiteHeaderLinks.map((papelizSiteHeaderLink) => {
        const papelizSiteHeaderLinkIsCurrent = papelizSiteHeaderLink.papelizSiteNavigationHref === papelizSiteCurrentPathname
        const papelizSiteHeaderLinkClassName = createPapelizSiteHeaderLinkClassName(papelizSiteHeaderLinkIsCurrent)
        const papelizSiteHeaderLinkLabel = <span data-papeliz-site-header-link-label>{papelizSiteHeaderLink.papelizSiteNavigationLabel}</span>
        return papelizSiteHeaderLink.papelizSiteNavigationIsExternal ? (
          <a key={papelizSiteHeaderLink.papelizSiteNavigationHref} href={papelizSiteHeaderLink.papelizSiteNavigationHref} className={papelizSiteHeaderLinkClassName}>
            {papelizSiteHeaderLinkLabel}
          </a>
        ) : (
          <Link
            key={papelizSiteHeaderLink.papelizSiteNavigationHref}
            href={papelizSiteHeaderLink.papelizSiteNavigationHref}
            aria-current={papelizSiteHeaderLinkIsCurrent ? 'page' : undefined}
            className={papelizSiteHeaderLinkClassName}
          >
            {papelizSiteHeaderLinkLabel}
          </Link>
        )
      })}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 h-0.5 origin-center rounded-full bg-white shadow-[0_0_12px_rgb(255_255_255/0.45)] ${
          papelizSiteHeaderIndicatorSlides ? 'transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'transition-none'
        } ${papelizSiteHeaderIndicatorPlacement.papelizSiteHeaderIndicatorIsShown ? 'opacity-100' : 'opacity-0'}`}
        style={{
          top: papelizSiteHeaderIndicatorPlacement.papelizSiteHeaderIndicatorTop,
          width: papelizSiteHeaderIndicatorPlacement.papelizSiteHeaderIndicatorWidth,
          transform: `translateX(${papelizSiteHeaderIndicatorPlacement.papelizSiteHeaderIndicatorLeft}px) scaleX(${
            papelizSiteHeaderIndicatorPlacement.papelizSiteHeaderIndicatorIsShown ? 1 : 0
          })`,
        }}
      />
    </nav>
  )
}
