'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'
import { papelizSiteHeaderPhoneRowLinks } from '@/lib/papeliz-site-navigation'
import {
  createPapelizSiteHeaderIndicatorClassName,
  createPapelizSiteHeaderLinkClassName,
  papelizSiteHeaderIndicatorLabelShare,
  papelizSiteHeaderIndicatorRiseAboveLinkBottom,
  papelizSiteHeaderIndicatorSlideMilliseconds,
} from './papeliz-site-header-navigation'

type PapelizSiteHeaderPhoneRowIndicatorPlacement = {
  papelizSiteHeaderPhoneRowIndicatorLeft: number
  papelizSiteHeaderPhoneRowIndicatorTop: number
  papelizSiteHeaderPhoneRowIndicatorWidth: number
  papelizSiteHeaderPhoneRowIndicatorIsShown: boolean
}

type PapelizSiteHeaderPhoneRowScrollEdges = {
  papelizSiteHeaderPhoneRowHasLinksBefore: boolean
  papelizSiteHeaderPhoneRowHasLinksAfter: boolean
}

const papelizSiteHeaderPhoneRowFadeClassName = 'pointer-events-none absolute inset-y-0 w-9 from-papeliz-topbar to-transparent transition-opacity duration-200'

// The underline's ease-out curve, cubic-bezier(0.22, 1, 0.36, 1), as a function, for a glide with
// no slide to follow (the underline growing in place).
function easePapelizSiteHeaderPhoneRowGlide(papelizSiteHeaderPhoneRowGlideProgress: number) {
  return 1 - (1 - papelizSiteHeaderPhoneRowGlideProgress) ** 5
}

// Phones get the page links and Community as a second row under the bar, scrolling sideways when
// they do not all fit (about 515 px). A fade at either end shows that more links are that way.
// The current page has the larger screens' underline. Moving to another page, the underline slides
// there while the row glides to center the new link, the glide keeping pace with the slide. On first
// load the row is placed at once; then, and coming from a page with no link here (home), the
// underline grows in place. A resize or a font arriving moves it without motion, once any glide,
// slide or growth under way has finished.
export function PapelizSiteHeaderPhoneRow() {
  const papelizSiteCurrentPathname = usePathname()
  const papelizSiteHeaderPhoneRowRef = useRef<HTMLElement>(null)
  const papelizSiteHeaderPhoneRowIndicatorRef = useRef<HTMLSpanElement>(null)
  // Off until the row has been placed once: the first page places it at once, later pages glide.
  const papelizSiteHeaderPhoneRowHasPlacedRef = useRef(false)
  const [papelizSiteHeaderPhoneRowIndicatorPlacement, setPapelizSiteHeaderPhoneRowIndicatorPlacement] = useState<PapelizSiteHeaderPhoneRowIndicatorPlacement>({
    papelizSiteHeaderPhoneRowIndicatorLeft: 0,
    papelizSiteHeaderPhoneRowIndicatorTop: 0,
    papelizSiteHeaderPhoneRowIndicatorWidth: 0,
    papelizSiteHeaderPhoneRowIndicatorIsShown: false,
  })
  // Off while the underline is placed without motion; on once it may slide to a new page.
  const [papelizSiteHeaderPhoneRowIndicatorSlides, setPapelizSiteHeaderPhoneRowIndicatorSlides] = useState(false)
  const papelizSiteHeaderPhoneRowIndicatorWasShownRef = useRef(false)
  const [papelizSiteHeaderPhoneRowScrollEdges, setPapelizSiteHeaderPhoneRowScrollEdges] = useState<PapelizSiteHeaderPhoneRowScrollEdges>({
    papelizSiteHeaderPhoneRowHasLinksBefore: false,
    papelizSiteHeaderPhoneRowHasLinksAfter: false,
  })

  useLayoutEffect(() => {
    const papelizSiteHeaderPhoneRowElement = papelizSiteHeaderPhoneRowRef.current
    if (!papelizSiteHeaderPhoneRowElement) return
    let papelizSiteHeaderPhoneRowMeasureFrame = 0
    let papelizSiteHeaderPhoneRowRevealFrame = 0
    let papelizSiteHeaderPhoneRowGlideFrame = 0
    let papelizSiteHeaderPhoneRowGlideIsRunning = false
    let papelizSiteHeaderPhoneRowIndicatorMotionTimer = 0
    let papelizSiteHeaderPhoneRowIndicatorMotionIsRunning = false
    // A resize or a font arriving while the row glides or the underline slides or grows waits for
    // both to end, so it cannot cut them short; the underline is then placed again without motion.
    let papelizSiteHeaderPhoneRowPlacesAfterMotion = false
    let papelizSiteHeaderPhoneRowIsDisposed = false

    const placePapelizSiteHeaderPhoneRowIndicatorAfterMotion = () => {
      if (papelizSiteHeaderPhoneRowGlideIsRunning || papelizSiteHeaderPhoneRowIndicatorMotionIsRunning || !papelizSiteHeaderPhoneRowPlacesAfterMotion) return
      papelizSiteHeaderPhoneRowPlacesAfterMotion = false
      placePapelizSiteHeaderPhoneRowIndicatorWithoutMotion()
    }

    const holdPapelizSiteHeaderPhoneRowIndicatorMotion = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      papelizSiteHeaderPhoneRowIndicatorMotionIsRunning = true
      window.clearTimeout(papelizSiteHeaderPhoneRowIndicatorMotionTimer)
      papelizSiteHeaderPhoneRowIndicatorMotionTimer = window.setTimeout(() => {
        papelizSiteHeaderPhoneRowIndicatorMotionIsRunning = false
        placePapelizSiteHeaderPhoneRowIndicatorAfterMotion()
      }, papelizSiteHeaderIndicatorSlideMilliseconds)
    }

    // The underline's slide position right now, within the row's content: its transition's live value.
    const readPapelizSiteHeaderPhoneRowIndicatorLeft = () => {
      const papelizSiteHeaderPhoneRowIndicatorElement = papelizSiteHeaderPhoneRowIndicatorRef.current
      const papelizSiteHeaderPhoneRowIndicatorTransform = papelizSiteHeaderPhoneRowIndicatorElement ? getComputedStyle(papelizSiteHeaderPhoneRowIndicatorElement).transform : 'none'
      return papelizSiteHeaderPhoneRowIndicatorTransform === 'none' ? 0 : new DOMMatrixReadOnly(papelizSiteHeaderPhoneRowIndicatorTransform).m41
    }

    const finishPapelizSiteHeaderPhoneRowGlide = () => {
      cancelAnimationFrame(papelizSiteHeaderPhoneRowGlideFrame)
      papelizSiteHeaderPhoneRowGlideIsRunning = false
      placePapelizSiteHeaderPhoneRowIndicatorAfterMotion()
    }

    // Glides the row's scroll to a place, or jumps there when it may not move. While the underline
    // slides, the scroll follows the underline's own progress frame by frame, so the two start and
    // land together and the underline never runs past its link; otherwise the scroll keeps the same
    // curve and time by itself.
    const scrollPapelizSiteHeaderPhoneRowTo = (
      papelizSiteHeaderPhoneRowTargetScrollLeft: number,
      papelizSiteHeaderPhoneRowMayGlide: boolean,
      papelizSiteHeaderPhoneRowFollowedSlide: { papelizSiteHeaderPhoneRowSlideFromLeft: number; papelizSiteHeaderPhoneRowSlideToLeft: number } | null,
    ) => {
      cancelAnimationFrame(papelizSiteHeaderPhoneRowGlideFrame)
      const papelizSiteHeaderPhoneRowMaxScrollLeft = papelizSiteHeaderPhoneRowElement.scrollWidth - papelizSiteHeaderPhoneRowElement.clientWidth
      const papelizSiteHeaderPhoneRowEndScrollLeft = Math.min(Math.max(papelizSiteHeaderPhoneRowTargetScrollLeft, 0), papelizSiteHeaderPhoneRowMaxScrollLeft)
      const papelizSiteHeaderPhoneRowStartScrollLeft = papelizSiteHeaderPhoneRowElement.scrollLeft
      if (!papelizSiteHeaderPhoneRowMayGlide || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        papelizSiteHeaderPhoneRowElement.scrollLeft = papelizSiteHeaderPhoneRowEndScrollLeft
        finishPapelizSiteHeaderPhoneRowGlide()
        return
      }
      const papelizSiteHeaderPhoneRowFollowsSlide =
        papelizSiteHeaderPhoneRowFollowedSlide !== null &&
        Math.abs(papelizSiteHeaderPhoneRowFollowedSlide.papelizSiteHeaderPhoneRowSlideToLeft - papelizSiteHeaderPhoneRowFollowedSlide.papelizSiteHeaderPhoneRowSlideFromLeft) > 0.5
      const papelizSiteHeaderPhoneRowGlideStart = performance.now()
      const stepPapelizSiteHeaderPhoneRowGlide = (papelizSiteHeaderPhoneRowGlideNow: number) => {
        const papelizSiteHeaderPhoneRowGlideElapsed = Math.max(papelizSiteHeaderPhoneRowGlideNow - papelizSiteHeaderPhoneRowGlideStart, 0)
        const papelizSiteHeaderPhoneRowGlideProgress =
          papelizSiteHeaderPhoneRowFollowsSlide && papelizSiteHeaderPhoneRowFollowedSlide
            ? Math.min(
                Math.max(
                  (readPapelizSiteHeaderPhoneRowIndicatorLeft() - papelizSiteHeaderPhoneRowFollowedSlide.papelizSiteHeaderPhoneRowSlideFromLeft) /
                    (papelizSiteHeaderPhoneRowFollowedSlide.papelizSiteHeaderPhoneRowSlideToLeft - papelizSiteHeaderPhoneRowFollowedSlide.papelizSiteHeaderPhoneRowSlideFromLeft),
                  0,
                ),
                1,
              )
            : easePapelizSiteHeaderPhoneRowGlide(Math.min(papelizSiteHeaderPhoneRowGlideElapsed / papelizSiteHeaderIndicatorSlideMilliseconds, 1))
        papelizSiteHeaderPhoneRowElement.scrollLeft =
          papelizSiteHeaderPhoneRowStartScrollLeft + (papelizSiteHeaderPhoneRowEndScrollLeft - papelizSiteHeaderPhoneRowStartScrollLeft) * papelizSiteHeaderPhoneRowGlideProgress
        // A slide cut short still lands: after twice its time the row goes straight to the end.
        if (papelizSiteHeaderPhoneRowGlideProgress < 1 && papelizSiteHeaderPhoneRowGlideElapsed < papelizSiteHeaderIndicatorSlideMilliseconds * 2) {
          papelizSiteHeaderPhoneRowGlideFrame = requestAnimationFrame(stepPapelizSiteHeaderPhoneRowGlide)
          return
        }
        papelizSiteHeaderPhoneRowElement.scrollLeft = papelizSiteHeaderPhoneRowEndScrollLeft
        finishPapelizSiteHeaderPhoneRowGlide()
      }
      papelizSiteHeaderPhoneRowGlideIsRunning = true
      papelizSiteHeaderPhoneRowGlideFrame = requestAnimationFrame(stepPapelizSiteHeaderPhoneRowGlide)
    }

    // Returns whether the underline slides from its last place.
    const placePapelizSiteHeaderPhoneRowIndicator = (papelizSiteHeaderPhoneRowIndicatorMaySlide: boolean, papelizSiteHeaderPhoneRowMayScroll: boolean) => {
      const papelizSiteCurrentLinkLabel = papelizSiteHeaderPhoneRowElement.querySelector<HTMLElement>(
        '[aria-current="page"] [data-papeliz-site-header-phone-row-link-label]',
      )
      // No link for this page, or the row is hidden (larger screens): no underline. The row stays
      // where it is, so the next page glides from there.
      if (!papelizSiteCurrentLinkLabel || papelizSiteCurrentLinkLabel.getBoundingClientRect().width === 0) {
        papelizSiteHeaderPhoneRowHasPlacedRef.current = true
        papelizSiteHeaderPhoneRowIndicatorWasShownRef.current = false
        setPapelizSiteHeaderPhoneRowIndicatorSlides(false)
        setPapelizSiteHeaderPhoneRowIndicatorPlacement((papelizSiteHeaderPhoneRowIndicatorCurrentPlacement) => ({
          ...papelizSiteHeaderPhoneRowIndicatorCurrentPlacement,
          papelizSiteHeaderPhoneRowIndicatorIsShown: false,
        }))
        return false
      }
      // Placed within the row's scrolling content, so it moves with the links when the row scrolls.
      const papelizSiteHeaderPhoneRowRect = papelizSiteHeaderPhoneRowElement.getBoundingClientRect()
      const papelizSiteCurrentLinkLabelRect = papelizSiteCurrentLinkLabel.getBoundingClientRect()
      const papelizSiteCurrentLinkRect = (papelizSiteCurrentLinkLabel.closest('[aria-current="page"]') ?? papelizSiteCurrentLinkLabel).getBoundingClientRect()
      const papelizSiteHeaderPhoneRowIndicatorWidth = papelizSiteCurrentLinkLabelRect.width * papelizSiteHeaderIndicatorLabelShare
      const papelizSiteHeaderPhoneRowIndicatorLeft =
        papelizSiteCurrentLinkLabelRect.left -
        papelizSiteHeaderPhoneRowRect.left +
        papelizSiteHeaderPhoneRowElement.scrollLeft +
        (papelizSiteCurrentLinkLabelRect.width - papelizSiteHeaderPhoneRowIndicatorWidth) / 2
      const papelizSiteHeaderPhoneRowIndicatorTop =
        papelizSiteCurrentLinkRect.bottom - papelizSiteHeaderPhoneRowRect.top - papelizSiteHeaderIndicatorRiseAboveLinkBottom
      const papelizSiteHeaderPhoneRowIndicatorSlidesHere = papelizSiteHeaderPhoneRowIndicatorMaySlide && papelizSiteHeaderPhoneRowIndicatorWasShownRef.current
      if (papelizSiteHeaderPhoneRowMayScroll) {
        // The current link is centered, as far as the row can scroll: at once on the first page,
        // gliding after that.
        const papelizSiteHeaderPhoneRowCenteredScrollLeft =
          papelizSiteHeaderPhoneRowElement.scrollLeft +
          papelizSiteCurrentLinkRect.left -
          papelizSiteHeaderPhoneRowRect.left -
          (papelizSiteHeaderPhoneRowRect.width - papelizSiteCurrentLinkRect.width) / 2
        scrollPapelizSiteHeaderPhoneRowTo(
          papelizSiteHeaderPhoneRowCenteredScrollLeft,
          papelizSiteHeaderPhoneRowHasPlacedRef.current,
          papelizSiteHeaderPhoneRowIndicatorSlidesHere
            ? {
                papelizSiteHeaderPhoneRowSlideFromLeft: readPapelizSiteHeaderPhoneRowIndicatorLeft(),
                papelizSiteHeaderPhoneRowSlideToLeft: papelizSiteHeaderPhoneRowIndicatorLeft,
              }
            : null,
        )
      }
      papelizSiteHeaderPhoneRowHasPlacedRef.current = true
      setPapelizSiteHeaderPhoneRowIndicatorSlides(papelizSiteHeaderPhoneRowIndicatorSlidesHere)
      setPapelizSiteHeaderPhoneRowIndicatorPlacement({
        papelizSiteHeaderPhoneRowIndicatorLeft,
        papelizSiteHeaderPhoneRowIndicatorTop,
        papelizSiteHeaderPhoneRowIndicatorWidth,
        papelizSiteHeaderPhoneRowIndicatorIsShown: papelizSiteHeaderPhoneRowIndicatorSlidesHere,
      })
      if (!papelizSiteHeaderPhoneRowIndicatorSlidesHere) {
        // Placed without motion and scaled to zero first, then grown in place two frames later.
        cancelAnimationFrame(papelizSiteHeaderPhoneRowRevealFrame)
        papelizSiteHeaderPhoneRowRevealFrame = requestAnimationFrame(() => {
          papelizSiteHeaderPhoneRowRevealFrame = requestAnimationFrame(() => {
            if (papelizSiteHeaderPhoneRowIsDisposed) return
            holdPapelizSiteHeaderPhoneRowIndicatorMotion()
            setPapelizSiteHeaderPhoneRowIndicatorSlides(true)
            setPapelizSiteHeaderPhoneRowIndicatorPlacement((papelizSiteHeaderPhoneRowIndicatorCurrentPlacement) => ({
              ...papelizSiteHeaderPhoneRowIndicatorCurrentPlacement,
              papelizSiteHeaderPhoneRowIndicatorIsShown: true,
            }))
          })
        })
      }
      papelizSiteHeaderPhoneRowIndicatorWasShownRef.current = true
      return papelizSiteHeaderPhoneRowIndicatorSlidesHere
    }

    // A finger or wheel on the row takes over from a glide still under way.
    const stopPapelizSiteHeaderPhoneRowGlide = () => {
      if (papelizSiteHeaderPhoneRowGlideIsRunning) finishPapelizSiteHeaderPhoneRowGlide()
    }

    function placePapelizSiteHeaderPhoneRowIndicatorWithoutMotion() {
      if (papelizSiteHeaderPhoneRowGlideIsRunning || papelizSiteHeaderPhoneRowIndicatorMotionIsRunning) {
        papelizSiteHeaderPhoneRowPlacesAfterMotion = true
        return
      }
      cancelAnimationFrame(papelizSiteHeaderPhoneRowMeasureFrame)
      papelizSiteHeaderPhoneRowMeasureFrame = requestAnimationFrame(() => {
        if (papelizSiteHeaderPhoneRowIsDisposed) return
        const papelizSiteHeaderPhoneRowIndicatorWasShown = papelizSiteHeaderPhoneRowIndicatorWasShownRef.current
        placePapelizSiteHeaderPhoneRowIndicator(true, false)
        // A layout change keeps the underline shown: only its place changes, without sliding.
        if (papelizSiteHeaderPhoneRowIndicatorWasShown) setPapelizSiteHeaderPhoneRowIndicatorSlides(false)
      })
    }

    // A new page: slide and glide if the underline is already showing, otherwise place and grow.
    if (placePapelizSiteHeaderPhoneRowIndicator(true, true)) holdPapelizSiteHeaderPhoneRowIndicatorMotion()

    // A ResizeObserver reports once as soon as it starts watching; that report is skipped so it does
    // not cut short the slide that has just begun.
    let papelizSiteHeaderPhoneRowResizeObserverHasReported = false
    const papelizSiteHeaderPhoneRowResizeObserver = new ResizeObserver(() => {
      if (!papelizSiteHeaderPhoneRowResizeObserverHasReported) {
        papelizSiteHeaderPhoneRowResizeObserverHasReported = true
        return
      }
      placePapelizSiteHeaderPhoneRowIndicatorWithoutMotion()
    })
    papelizSiteHeaderPhoneRowResizeObserver.observe(papelizSiteHeaderPhoneRowElement)
    document.fonts.addEventListener('loadingdone', placePapelizSiteHeaderPhoneRowIndicatorWithoutMotion)
    papelizSiteHeaderPhoneRowElement.addEventListener('pointerdown', stopPapelizSiteHeaderPhoneRowGlide)
    papelizSiteHeaderPhoneRowElement.addEventListener('touchstart', stopPapelizSiteHeaderPhoneRowGlide, { passive: true })
    papelizSiteHeaderPhoneRowElement.addEventListener('wheel', stopPapelizSiteHeaderPhoneRowGlide, { passive: true })
    return () => {
      papelizSiteHeaderPhoneRowIsDisposed = true
      cancelAnimationFrame(papelizSiteHeaderPhoneRowMeasureFrame)
      cancelAnimationFrame(papelizSiteHeaderPhoneRowRevealFrame)
      cancelAnimationFrame(papelizSiteHeaderPhoneRowGlideFrame)
      window.clearTimeout(papelizSiteHeaderPhoneRowIndicatorMotionTimer)
      papelizSiteHeaderPhoneRowResizeObserver.disconnect()
      document.fonts.removeEventListener('loadingdone', placePapelizSiteHeaderPhoneRowIndicatorWithoutMotion)
      papelizSiteHeaderPhoneRowElement.removeEventListener('pointerdown', stopPapelizSiteHeaderPhoneRowGlide)
      papelizSiteHeaderPhoneRowElement.removeEventListener('touchstart', stopPapelizSiteHeaderPhoneRowGlide)
      papelizSiteHeaderPhoneRowElement.removeEventListener('wheel', stopPapelizSiteHeaderPhoneRowGlide)
    }
  }, [papelizSiteCurrentPathname])

  // The fades follow the scroll position, the row's width and the font arriving.
  useLayoutEffect(() => {
    const papelizSiteHeaderPhoneRowElement = papelizSiteHeaderPhoneRowRef.current
    if (!papelizSiteHeaderPhoneRowElement) return
    const updatePapelizSiteHeaderPhoneRowScrollEdges = () => {
      const papelizSiteHeaderPhoneRowMaxScrollLeft = papelizSiteHeaderPhoneRowElement.scrollWidth - papelizSiteHeaderPhoneRowElement.clientWidth
      const papelizSiteHeaderPhoneRowHasLinksBefore = papelizSiteHeaderPhoneRowElement.scrollLeft > 1
      const papelizSiteHeaderPhoneRowHasLinksAfter = papelizSiteHeaderPhoneRowElement.scrollLeft < papelizSiteHeaderPhoneRowMaxScrollLeft - 1
      setPapelizSiteHeaderPhoneRowScrollEdges((papelizSiteHeaderPhoneRowCurrentScrollEdges) =>
        papelizSiteHeaderPhoneRowCurrentScrollEdges.papelizSiteHeaderPhoneRowHasLinksBefore === papelizSiteHeaderPhoneRowHasLinksBefore &&
        papelizSiteHeaderPhoneRowCurrentScrollEdges.papelizSiteHeaderPhoneRowHasLinksAfter === papelizSiteHeaderPhoneRowHasLinksAfter
          ? papelizSiteHeaderPhoneRowCurrentScrollEdges
          : { papelizSiteHeaderPhoneRowHasLinksBefore, papelizSiteHeaderPhoneRowHasLinksAfter },
      )
    }
    updatePapelizSiteHeaderPhoneRowScrollEdges()
    papelizSiteHeaderPhoneRowElement.addEventListener('scroll', updatePapelizSiteHeaderPhoneRowScrollEdges, { passive: true })
    const papelizSiteHeaderPhoneRowResizeObserver = new ResizeObserver(updatePapelizSiteHeaderPhoneRowScrollEdges)
    papelizSiteHeaderPhoneRowResizeObserver.observe(papelizSiteHeaderPhoneRowElement)
    document.fonts.addEventListener('loadingdone', updatePapelizSiteHeaderPhoneRowScrollEdges)
    return () => {
      papelizSiteHeaderPhoneRowElement.removeEventListener('scroll', updatePapelizSiteHeaderPhoneRowScrollEdges)
      papelizSiteHeaderPhoneRowResizeObserver.disconnect()
      document.fonts.removeEventListener('loadingdone', updatePapelizSiteHeaderPhoneRowScrollEdges)
    }
  }, [])

  return (
    <div className="relative border-t border-white/12 md:hidden">
      {/* The first label lines up with the mark above: 8 px row padding plus the link's 8 px (4 + 8 below 360 px). */}
      <nav
        ref={papelizSiteHeaderPhoneRowRef}
        aria-label="Main"
        className="relative flex h-11 items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 [scrollbar-width:none] max-[359px]:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {papelizSiteHeaderPhoneRowLinks.map((papelizSiteHeaderPhoneRowLink) => {
          const papelizSiteHeaderPhoneRowLinkIsCurrent = papelizSiteHeaderPhoneRowLink.papelizSiteNavigationHref === papelizSiteCurrentPathname
          const papelizSiteHeaderPhoneRowLinkClassName = `flex-none ${createPapelizSiteHeaderLinkClassName(papelizSiteHeaderPhoneRowLinkIsCurrent)}`
          const papelizSiteHeaderPhoneRowLinkLabel = (
            <span data-papeliz-site-header-phone-row-link-label>{papelizSiteHeaderPhoneRowLink.papelizSiteNavigationLabel}</span>
          )
          return papelizSiteHeaderPhoneRowLink.papelizSiteNavigationIsExternal ? (
            <a key={papelizSiteHeaderPhoneRowLink.papelizSiteNavigationHref} href={papelizSiteHeaderPhoneRowLink.papelizSiteNavigationHref} className={papelizSiteHeaderPhoneRowLinkClassName}>
              {papelizSiteHeaderPhoneRowLinkLabel}
            </a>
          ) : (
            <Link
              key={papelizSiteHeaderPhoneRowLink.papelizSiteNavigationHref}
              href={papelizSiteHeaderPhoneRowLink.papelizSiteNavigationHref}
              aria-current={papelizSiteHeaderPhoneRowLinkIsCurrent ? 'page' : undefined}
              className={papelizSiteHeaderPhoneRowLinkClassName}
            >
              {papelizSiteHeaderPhoneRowLinkLabel}
            </Link>
          )
        })}
        <span
          ref={papelizSiteHeaderPhoneRowIndicatorRef}
          aria-hidden="true"
          className={createPapelizSiteHeaderIndicatorClassName(
            papelizSiteHeaderPhoneRowIndicatorSlides,
            papelizSiteHeaderPhoneRowIndicatorPlacement.papelizSiteHeaderPhoneRowIndicatorIsShown,
          )}
          style={{
            top: papelizSiteHeaderPhoneRowIndicatorPlacement.papelizSiteHeaderPhoneRowIndicatorTop,
            width: papelizSiteHeaderPhoneRowIndicatorPlacement.papelizSiteHeaderPhoneRowIndicatorWidth,
            transform: `translateX(${papelizSiteHeaderPhoneRowIndicatorPlacement.papelizSiteHeaderPhoneRowIndicatorLeft}px) scaleX(${
              papelizSiteHeaderPhoneRowIndicatorPlacement.papelizSiteHeaderPhoneRowIndicatorIsShown ? 1 : 0
            })`,
          }}
        />
      </nav>
      <span
        aria-hidden="true"
        className={`${papelizSiteHeaderPhoneRowFadeClassName} left-0 bg-linear-to-r ${
          papelizSiteHeaderPhoneRowScrollEdges.papelizSiteHeaderPhoneRowHasLinksBefore ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span
        aria-hidden="true"
        className={`${papelizSiteHeaderPhoneRowFadeClassName} right-0 bg-linear-to-l ${
          papelizSiteHeaderPhoneRowScrollEdges.papelizSiteHeaderPhoneRowHasLinksAfter ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
