'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { papelizSiteHeaderResourcesMenuItems, papelizSiteHeaderResourcesMenuLabel } from '@/lib/papeliz-site-navigation'
import { createPapelizSiteHeaderLinkClassName } from './papeliz-site-header-navigation'

// A pointer leaving the control closes the menu after this pause, so crossing the gap is safe.
const papelizSiteHeaderResourcesMenuCloseDelayMilliseconds = 140
// A click this soon after hovering opened the menu is the same gesture: it keeps the menu open.
const papelizSiteHeaderResourcesMenuHoverClickWindowMilliseconds = 400

// "Resources" in the top bar, looking like the page links: it opens a menu of Roadmap, Changelog, Help,
// About and AI Providers, as the Use App menu opens (hover with a mouse, click, Escape to close). On one
// of those pages it turns white and carries the page links' underline (aria-current="true").
export function PapelizSiteHeaderResourcesMenu() {
  const papelizSiteCurrentPathname = usePathname()
  const [papelizSiteHeaderResourcesMenuIsOpen, setPapelizSiteHeaderResourcesMenuIsOpen] = useState(false)
  const papelizSiteHeaderResourcesMenuRef = useRef<HTMLDivElement>(null)
  const papelizSiteHeaderResourcesMenuToggleRef = useRef<HTMLButtonElement>(null)
  const papelizSiteHeaderResourcesMenuCloseTimerRef = useRef<number | null>(null)
  const papelizSiteHeaderResourcesMenuHoverOpenedAtRef = useRef(0)
  const papelizSiteHeaderResourcesMenuHoldsCurrentPage = papelizSiteHeaderResourcesMenuItems.some(
    (papelizSiteHeaderResourcesMenuItem) =>
      !papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationIsExternal &&
      papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref === papelizSiteCurrentPathname,
  )

  const cancelPapelizSiteHeaderResourcesMenuClose = () => {
    if (papelizSiteHeaderResourcesMenuCloseTimerRef.current === null) return
    window.clearTimeout(papelizSiteHeaderResourcesMenuCloseTimerRef.current)
    papelizSiteHeaderResourcesMenuCloseTimerRef.current = null
  }

  useEffect(() => {
    if (!papelizSiteHeaderResourcesMenuIsOpen) return
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!papelizSiteHeaderResourcesMenuRef.current?.contains(pointerEvent.target as Node)) setPapelizSiteHeaderResourcesMenuIsOpen(false)
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      setPapelizSiteHeaderResourcesMenuIsOpen(false)
      papelizSiteHeaderResourcesMenuToggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [papelizSiteHeaderResourcesMenuIsOpen])

  useEffect(() => cancelPapelizSiteHeaderResourcesMenuClose, [])

  return (
    <div
      ref={papelizSiteHeaderResourcesMenuRef}
      className="relative flex items-center self-stretch"
      onPointerEnter={(pointerEvent) => {
        if (pointerEvent.pointerType !== 'mouse') return
        cancelPapelizSiteHeaderResourcesMenuClose()
        if (!papelizSiteHeaderResourcesMenuIsOpen) papelizSiteHeaderResourcesMenuHoverOpenedAtRef.current = performance.now()
        setPapelizSiteHeaderResourcesMenuIsOpen(true)
      }}
      onPointerLeave={(pointerEvent) => {
        if (pointerEvent.pointerType !== 'mouse') return
        cancelPapelizSiteHeaderResourcesMenuClose()
        papelizSiteHeaderResourcesMenuCloseTimerRef.current = window.setTimeout(() => {
          setPapelizSiteHeaderResourcesMenuIsOpen(false)
          papelizSiteHeaderResourcesMenuCloseTimerRef.current = null
        }, papelizSiteHeaderResourcesMenuCloseDelayMilliseconds)
      }}
      onBlur={(focusEvent) => {
        if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) setPapelizSiteHeaderResourcesMenuIsOpen(false)
      }}
    >
      <button
        ref={papelizSiteHeaderResourcesMenuToggleRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={papelizSiteHeaderResourcesMenuIsOpen}
        aria-controls="papeliz-site-header-resources-menu-panel"
        aria-current={papelizSiteHeaderResourcesMenuHoldsCurrentPage ? 'true' : undefined}
        onClick={(clickEvent) => {
          if (
            clickEvent.detail > 0 &&
            performance.now() - papelizSiteHeaderResourcesMenuHoverOpenedAtRef.current < papelizSiteHeaderResourcesMenuHoverClickWindowMilliseconds
          ) {
            setPapelizSiteHeaderResourcesMenuIsOpen(true)
            return
          }
          setPapelizSiteHeaderResourcesMenuIsOpen((papelizSiteHeaderResourcesMenuWasOpen) => !papelizSiteHeaderResourcesMenuWasOpen)
        }}
        className={`inline-flex cursor-pointer items-center gap-1 ${createPapelizSiteHeaderLinkClassName(papelizSiteHeaderResourcesMenuHoldsCurrentPage)}`}
      >
        <span data-papeliz-site-header-link-label>{papelizSiteHeaderResourcesMenuLabel}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${papelizSiteHeaderResourcesMenuIsOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {papelizSiteHeaderResourcesMenuIsOpen && (
        // The pt-2 gap belongs to the panel's box, so a pointer crossing it stays inside the control.
        // The menu is the top bar's blue, with white text, as the Use App menu.
        <div id="papeliz-site-header-resources-menu-panel" className="absolute top-[calc(100%-6px)] left-0 z-50 w-[300px] pt-2">
          <div className="papeliz-pop-enter grid gap-1 rounded-2xl border border-white/15 bg-papeliz-topbar p-2 text-white shadow-papeliz-pop [transform-origin:top_left]">
            {papelizSiteHeaderResourcesMenuItems.map((papelizSiteHeaderResourcesMenuItem) => {
              const papelizSiteHeaderResourcesMenuItemIsCurrent =
                !papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationIsExternal &&
                papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref === papelizSiteCurrentPathname
              const papelizSiteHeaderResourcesMenuItemClassName = `flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-white ${
                papelizSiteHeaderResourcesMenuItemIsCurrent ? 'bg-white/15' : 'hover:bg-white/10'
              }`
              const papelizSiteHeaderResourcesMenuItemContent = (
                <>
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-papeliz-blue-soft text-papeliz-blue">
                    <papelizSiteHeaderResourcesMenuItem.PapelizSiteHeaderResourcesMenuItemIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationLabel}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/75">
                      {papelizSiteHeaderResourcesMenuItem.papelizSiteHeaderResourcesMenuItemDescription}
                    </span>
                  </span>
                </>
              )
              return papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationIsExternal ? (
                <a
                  key={papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref}
                  href={papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref}
                  className={papelizSiteHeaderResourcesMenuItemClassName}
                >
                  {papelizSiteHeaderResourcesMenuItemContent}
                </a>
              ) : (
                <Link
                  key={papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref}
                  href={papelizSiteHeaderResourcesMenuItem.papelizSiteNavigationHref}
                  aria-current={papelizSiteHeaderResourcesMenuItemIsCurrent ? 'page' : undefined}
                  onClick={() => setPapelizSiteHeaderResourcesMenuIsOpen(false)}
                  className={papelizSiteHeaderResourcesMenuItemClassName}
                >
                  {papelizSiteHeaderResourcesMenuItemContent}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
