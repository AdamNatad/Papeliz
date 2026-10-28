'use client'

import { ChevronDown, Download, Rocket, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizSiteComingSoonPill } from '@/components/marketing/papeliz-site-coming-soon-pill'
import { papelizSiteAccountUrl, papelizSiteAppUrl, papelizSiteDownloadUrl } from '@/lib/papeliz-site-config'

type PapelizSiteUseAppMenuItem = {
  papelizSiteUseAppMenuItemLabel: string
  papelizSiteUseAppMenuItemDescription: string
  papelizSiteUseAppMenuItemUrl: string | null
  PapelizSiteUseAppMenuItemIcon: LucideIcon
  papelizSiteUseAppMenuItemTileClassName: string
}

const papelizSiteUseAppMenuItems: readonly PapelizSiteUseAppMenuItem[] = [
  {
    papelizSiteUseAppMenuItemLabel: 'Download',
    papelizSiteUseAppMenuItemDescription: 'Install Papeliz on your computer.',
    papelizSiteUseAppMenuItemUrl: papelizSiteDownloadUrl,
    PapelizSiteUseAppMenuItemIcon: Download,
    papelizSiteUseAppMenuItemTileClassName: 'bg-papeliz-diff-added text-papeliz-diff-added-ink',
  },
  {
    papelizSiteUseAppMenuItemLabel: 'My Account',
    papelizSiteUseAppMenuItemDescription: 'Sign in and manage your account.',
    papelizSiteUseAppMenuItemUrl: papelizSiteAccountUrl,
    PapelizSiteUseAppMenuItemIcon: UserRound,
    papelizSiteUseAppMenuItemTileClassName: 'bg-papeliz-blue-soft text-papeliz-blue',
  },
]

// A pointer leaving the control closes the menu after this pause, so crossing the gap is safe.
const papelizSiteUseAppMenuCloseDelayMilliseconds = 140
// A click this soon after hovering opened the menu is the same gesture: it keeps the menu open.
const papelizSiteUseAppMenuHoverClickWindowMilliseconds = 400

const papelizSiteUseAppPartClassName =
  'inline-flex h-9 items-center justify-center bg-white text-sm font-semibold whitespace-nowrap text-papeliz-gradient-start transition-colors hover:bg-white/90 focus-visible:outline-white'

// The header's Use App control, split in two: "Use App" opens the app, and the chevron opens a
// small menu with Download and My Account. Hovering with a mouse opens the menu too.
export function PapelizSiteUseAppMenu() {
  const [papelizSiteUseAppMenuIsOpen, setPapelizSiteUseAppMenuIsOpen] = useState(false)
  const papelizSiteUseAppMenuRef = useRef<HTMLDivElement>(null)
  const papelizSiteUseAppMenuToggleRef = useRef<HTMLButtonElement>(null)
  const papelizSiteUseAppMenuCloseTimerRef = useRef<number | null>(null)
  const papelizSiteUseAppMenuHoverOpenedAtRef = useRef(0)

  const cancelPapelizSiteUseAppMenuClose = () => {
    if (papelizSiteUseAppMenuCloseTimerRef.current === null) return
    window.clearTimeout(papelizSiteUseAppMenuCloseTimerRef.current)
    papelizSiteUseAppMenuCloseTimerRef.current = null
  }

  useEffect(() => {
    if (!papelizSiteUseAppMenuIsOpen) return
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!papelizSiteUseAppMenuRef.current?.contains(pointerEvent.target as Node)) setPapelizSiteUseAppMenuIsOpen(false)
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      setPapelizSiteUseAppMenuIsOpen(false)
      papelizSiteUseAppMenuToggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [papelizSiteUseAppMenuIsOpen])

  useEffect(() => cancelPapelizSiteUseAppMenuClose, [])

  return (
    <div
      ref={papelizSiteUseAppMenuRef}
      className="relative"
      onPointerEnter={(pointerEvent) => {
        if (pointerEvent.pointerType !== 'mouse') return
        cancelPapelizSiteUseAppMenuClose()
        if (!papelizSiteUseAppMenuIsOpen) papelizSiteUseAppMenuHoverOpenedAtRef.current = performance.now()
        setPapelizSiteUseAppMenuIsOpen(true)
      }}
      onPointerLeave={(pointerEvent) => {
        if (pointerEvent.pointerType !== 'mouse') return
        cancelPapelizSiteUseAppMenuClose()
        papelizSiteUseAppMenuCloseTimerRef.current = window.setTimeout(() => {
          setPapelizSiteUseAppMenuIsOpen(false)
          papelizSiteUseAppMenuCloseTimerRef.current = null
        }, papelizSiteUseAppMenuCloseDelayMilliseconds)
      }}
      onBlur={(focusEvent) => {
        if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) setPapelizSiteUseAppMenuIsOpen(false)
      }}
    >
      <div role="group" aria-label="Use the Papeliz app" className="papeliz-site-selection-on-surface flex items-stretch">
        {papelizSiteAppUrl ? (
          <a href={papelizSiteAppUrl} className={`${papelizSiteUseAppPartClassName} gap-2 rounded-l-full pr-3 pl-4`}>
            <Rocket className="size-4 shrink-0" aria-hidden="true" />
            Use App
          </a>
        ) : (
          <span className={`${papelizSiteUseAppPartClassName} gap-2 rounded-l-full pr-3 pl-4 hover:bg-white`}>
            <Rocket className="size-4 shrink-0" aria-hidden="true" />
            Coming soon
          </span>
        )}
        <button
          ref={papelizSiteUseAppMenuToggleRef}
          type="button"
          aria-label="More ways to use Papeliz"
          aria-haspopup="true"
          aria-expanded={papelizSiteUseAppMenuIsOpen}
          aria-controls="papeliz-site-use-app-menu-panel"
          onClick={(clickEvent) => {
            if (
              clickEvent.detail > 0 &&
              performance.now() - papelizSiteUseAppMenuHoverOpenedAtRef.current < papelizSiteUseAppMenuHoverClickWindowMilliseconds
            ) {
              setPapelizSiteUseAppMenuIsOpen(true)
              return
            }
            setPapelizSiteUseAppMenuIsOpen((papelizSiteUseAppMenuWasOpen) => !papelizSiteUseAppMenuWasOpen)
          }}
          className={`${papelizSiteUseAppPartClassName} w-9 cursor-pointer rounded-r-full border-l border-papeliz-gradient-start/20`}
        >
          <ChevronDown
            className={`size-4 shrink-0 transition-transform duration-200 ${papelizSiteUseAppMenuIsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {papelizSiteUseAppMenuIsOpen && (
        // The pt-2 gap belongs to the panel's box, so a pointer crossing it stays inside the control.
        // The menu is the top bar's blue, with white text; the icon tiles and pills keep their colors.
        <div id="papeliz-site-use-app-menu-panel" className="absolute top-full right-0 z-50 w-[300px] max-w-[calc(100vw-32px)] pt-2">
          <div className="papeliz-pop-enter grid gap-1 rounded-2xl border border-white/15 bg-papeliz-topbar p-2 text-white shadow-papeliz-pop">
            {papelizSiteUseAppMenuItems.map((papelizSiteUseAppMenuItem) => {
              const papelizSiteUseAppMenuItemContent = (
                <>
                  <span
                    className={`grid size-[34px] shrink-0 place-items-center rounded-lg ${papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemTileClassName}`}
                  >
                    <papelizSiteUseAppMenuItem.PapelizSiteUseAppMenuItemIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-semibold">{papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemLabel}</span>
                      {!papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemUrl && <PapelizSiteComingSoonPill />}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/75">
                      {papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemDescription}
                    </span>
                  </span>
                </>
              )
              const papelizSiteUseAppMenuItemClassName = 'flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left'
              return papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemUrl ? (
                <a
                  key={papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemLabel}
                  href={papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemUrl}
                  className={`${papelizSiteUseAppMenuItemClassName} transition-colors hover:bg-white/10 focus-visible:outline-white`}
                >
                  {papelizSiteUseAppMenuItemContent}
                </a>
              ) : (
                <div
                  key={papelizSiteUseAppMenuItem.papelizSiteUseAppMenuItemLabel}
                  aria-disabled="true"
                  className={papelizSiteUseAppMenuItemClassName}
                >
                  {papelizSiteUseAppMenuItemContent}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
