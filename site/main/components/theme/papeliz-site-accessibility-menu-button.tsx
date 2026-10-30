'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { FaUniversalAccess } from 'react-icons/fa'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { PapelizSiteSlidingChoiceGroup } from '@/components/theme/papeliz-site-sliding-choice-group'
import { choosePapelizSiteThemePreference, readPapelizSiteThemePreference, type PapelizSiteThemePreference } from '@/lib/papeliz-site-theme'

const papelizSiteThemeChoices = [
  { papelizSiteThemePreference: 'light', papelizSiteThemeChoiceLabel: 'Light', PapelizSiteThemeChoiceIcon: Sun },
  { papelizSiteThemePreference: 'dark', papelizSiteThemeChoiceLabel: 'Dark', PapelizSiteThemeChoiceIcon: Moon },
  { papelizSiteThemePreference: 'system', papelizSiteThemeChoiceLabel: 'Device', PapelizSiteThemeChoiceIcon: Monitor },
] as const

const papelizSiteAccessibilityMenuWidth = 288
const papelizSiteAccessibilityMenuEdgeGap = 8

// The app's Accessibility button for the blue top bar: it opens the same card, with the theme
// (Light, the default; Dark; or the device's). A choice shows at once and is remembered.
export function PapelizSiteAccessibilityMenuButton() {
  const [papelizSiteAccessibilityMenuAnchor, setPapelizSiteAccessibilityMenuAnchor] = useState<{
    papelizSiteMenuAnchorRight: number
    papelizSiteMenuAnchorTop: number
  } | null>(null)
  const papelizSiteAccessibilityMenuButtonRef = useRef<HTMLButtonElement>(null)
  const papelizSiteAccessibilityMenuPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (papelizSiteAccessibilityMenuAnchor === null) return
    const closePapelizSiteAccessibilityMenu = () => setPapelizSiteAccessibilityMenuAnchor(null)
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pointerTarget = pointerEvent.target as Node
      if (
        !papelizSiteAccessibilityMenuPanelRef.current?.contains(pointerTarget) &&
        !papelizSiteAccessibilityMenuButtonRef.current?.contains(pointerTarget)
      ) {
        closePapelizSiteAccessibilityMenu()
      }
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      closePapelizSiteAccessibilityMenu()
      papelizSiteAccessibilityMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closePapelizSiteAccessibilityMenu)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closePapelizSiteAccessibilityMenu)
    }
  }, [papelizSiteAccessibilityMenuAnchor])

  return (
    <>
      <button
        ref={papelizSiteAccessibilityMenuButtonRef}
        type="button"
        aria-label="Accessibility: theme"
        title="Accessibility: theme"
        aria-haspopup="dialog"
        aria-expanded={papelizSiteAccessibilityMenuAnchor !== null}
        onClick={(clickEvent) => {
          if (papelizSiteAccessibilityMenuAnchor !== null) {
            setPapelizSiteAccessibilityMenuAnchor(null)
            return
          }
          const papelizSiteAccessibilityMenuButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          // Under the button, kept inside the window on a phone, where the button is not at the edge.
          const papelizSiteMenuAnchorRight = Math.max(
            papelizSiteAccessibilityMenuEdgeGap,
            Math.min(
              window.innerWidth - papelizSiteAccessibilityMenuButtonRect.right,
              window.innerWidth - papelizSiteAccessibilityMenuWidth - papelizSiteAccessibilityMenuEdgeGap,
            ),
          )
          setPapelizSiteAccessibilityMenuAnchor({
            papelizSiteMenuAnchorRight,
            papelizSiteMenuAnchorTop: papelizSiteAccessibilityMenuButtonRect.bottom + 6,
          })
        }}
        className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-full text-white/90 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/15 hover:text-white focus-visible:outline-white active:scale-[.94] aria-expanded:bg-white/15"
      >
        {/* A solid mark, as the GitHub mark beside it, so it reads clearly on the blue bar (Adam, 2026-10-31). */}
        <FaUniversalAccess className="size-[18px]" aria-hidden="true" />
      </button>
      {papelizSiteAccessibilityMenuAnchor !== null && (
        <PapelizSiteAccessibilityMenuPanel
          papelizSiteAccessibilityMenuPanelRef={papelizSiteAccessibilityMenuPanelRef}
          papelizSiteMenuAnchorRight={papelizSiteAccessibilityMenuAnchor.papelizSiteMenuAnchorRight}
          papelizSiteMenuAnchorTop={papelizSiteAccessibilityMenuAnchor.papelizSiteMenuAnchorTop}
        />
      )}
    </>
  )
}

type PapelizSiteAccessibilityMenuPanelProps = {
  papelizSiteAccessibilityMenuPanelRef: RefObject<HTMLDivElement | null>
  papelizSiteMenuAnchorRight: number
  papelizSiteMenuAnchorTop: number
}

// Mounted only while open, in the browser, so it reads the saved choice directly.
function PapelizSiteAccessibilityMenuPanel({
  papelizSiteAccessibilityMenuPanelRef,
  papelizSiteMenuAnchorRight,
  papelizSiteMenuAnchorTop,
}: PapelizSiteAccessibilityMenuPanelProps) {
  const [papelizSiteThemePreference, setPapelizSiteThemePreference] = useState<PapelizSiteThemePreference>(readPapelizSiteThemePreference)

  useLayoutEffect(() => {
    papelizSiteAccessibilityMenuPanelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [papelizSiteAccessibilityMenuPanelRef])

  return (
    <div
      ref={papelizSiteAccessibilityMenuPanelRef}
      role="dialog"
      aria-label="Accessibility"
      className="papeliz-site-selection-on-surface papeliz-pop-enter fixed z-50 w-[288px] max-w-[calc(100vw-16px)] rounded-2xl border border-papeliz-line bg-papeliz-surface p-3.5 text-papeliz-ink shadow-papeliz-pop"
      style={{ right: papelizSiteMenuAnchorRight, top: papelizSiteMenuAnchorTop }}
    >
      <p className="text-[13px] font-semibold">Accessibility</p>
      <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Theme</p>
      <PapelizSiteSlidingChoiceGroup
        papelizSiteSlidingChoiceGroupLabel="Theme"
        papelizSiteChosenSlidingChoiceValue={papelizSiteThemePreference}
        onPapelizSiteSlidingChoiceSelect={(papelizSiteChosenThemePreference) => {
          choosePapelizSiteThemePreference(papelizSiteChosenThemePreference)
          setPapelizSiteThemePreference(papelizSiteChosenThemePreference)
        }}
        papelizSiteSlidingChoices={papelizSiteThemeChoices.map((papelizSiteThemeChoice) => ({
          papelizSiteSlidingChoiceValue: papelizSiteThemeChoice.papelizSiteThemePreference,
          papelizSiteSlidingChoiceContent: (
            <>
              <papelizSiteThemeChoice.PapelizSiteThemeChoiceIcon className="size-3.5" aria-hidden="true" />
              {papelizSiteThemeChoice.papelizSiteThemeChoiceLabel}
            </>
          ),
        }))}
      />
    </div>
  )
}
