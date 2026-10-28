'use client'

import { Accessibility, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { PapelizHelpSlidingChoiceGroup } from './papeliz-help-sliding-choice-group'
import { choosePapelizHelpThemePreference, readPapelizHelpThemePreference, type PapelizHelpThemePreference } from '@/lib/papeliz-help-theme'

const papelizHelpThemeChoices = [
  { papelizHelpThemePreference: 'light', papelizHelpThemeChoiceLabel: 'Light', PapelizHelpThemeChoiceIcon: Sun },
  { papelizHelpThemePreference: 'dark', papelizHelpThemeChoiceLabel: 'Dark', PapelizHelpThemeChoiceIcon: Moon },
  { papelizHelpThemePreference: 'system', papelizHelpThemeChoiceLabel: 'Device', PapelizHelpThemeChoiceIcon: Monitor },
] as const

const papelizHelpAccessibilityMenuWidth = 288
const papelizHelpAccessibilityMenuEdgeGap = 8

// The app's Accessibility button for the blue top bar: it opens the same card, with the theme
// (Light, the default; Dark; or the device's). A choice shows at once and is remembered.
export function PapelizHelpAccessibilityMenuButton() {
  const [papelizHelpAccessibilityMenuAnchor, setPapelizHelpAccessibilityMenuAnchor] = useState<{
    papelizHelpMenuAnchorRight: number
    papelizHelpMenuAnchorTop: number
  } | null>(null)
  const papelizHelpAccessibilityMenuButtonRef = useRef<HTMLButtonElement>(null)
  const papelizHelpAccessibilityMenuPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (papelizHelpAccessibilityMenuAnchor === null) return
    const closePapelizHelpAccessibilityMenu = () => setPapelizHelpAccessibilityMenuAnchor(null)
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pointerTarget = pointerEvent.target as Node
      if (
        !papelizHelpAccessibilityMenuPanelRef.current?.contains(pointerTarget) &&
        !papelizHelpAccessibilityMenuButtonRef.current?.contains(pointerTarget)
      ) {
        closePapelizHelpAccessibilityMenu()
      }
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      closePapelizHelpAccessibilityMenu()
      papelizHelpAccessibilityMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closePapelizHelpAccessibilityMenu)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closePapelizHelpAccessibilityMenu)
    }
  }, [papelizHelpAccessibilityMenuAnchor])

  return (
    <>
      <button
        ref={papelizHelpAccessibilityMenuButtonRef}
        type="button"
        aria-label="Accessibility: theme"
        title="Accessibility: theme"
        aria-haspopup="dialog"
        aria-expanded={papelizHelpAccessibilityMenuAnchor !== null}
        onClick={(clickEvent) => {
          if (papelizHelpAccessibilityMenuAnchor !== null) {
            setPapelizHelpAccessibilityMenuAnchor(null)
            return
          }
          const papelizHelpAccessibilityMenuButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          // Under the button, kept inside the window on a phone, where the button is not at the edge.
          const papelizHelpMenuAnchorRight = Math.max(
            papelizHelpAccessibilityMenuEdgeGap,
            Math.min(
              window.innerWidth - papelizHelpAccessibilityMenuButtonRect.right,
              window.innerWidth - papelizHelpAccessibilityMenuWidth - papelizHelpAccessibilityMenuEdgeGap,
            ),
          )
          setPapelizHelpAccessibilityMenuAnchor({
            papelizHelpMenuAnchorRight,
            papelizHelpMenuAnchorTop: papelizHelpAccessibilityMenuButtonRect.bottom + 6,
          })
        }}
        className="grid size-[34px] flex-none cursor-pointer place-items-center rounded-full text-white/90 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/15 hover:text-white focus-visible:outline-white active:scale-[.94] aria-expanded:bg-white/15"
      >
        <Accessibility className="size-[18px]" aria-hidden="true" />
      </button>
      {papelizHelpAccessibilityMenuAnchor !== null && (
        <PapelizHelpAccessibilityMenuPanel
          papelizHelpAccessibilityMenuPanelRef={papelizHelpAccessibilityMenuPanelRef}
          papelizHelpMenuAnchorRight={papelizHelpAccessibilityMenuAnchor.papelizHelpMenuAnchorRight}
          papelizHelpMenuAnchorTop={papelizHelpAccessibilityMenuAnchor.papelizHelpMenuAnchorTop}
        />
      )}
    </>
  )
}

type PapelizHelpAccessibilityMenuPanelProps = {
  papelizHelpAccessibilityMenuPanelRef: RefObject<HTMLDivElement | null>
  papelizHelpMenuAnchorRight: number
  papelizHelpMenuAnchorTop: number
}

// Mounted only while open, in the browser, so it reads the saved choice directly.
function PapelizHelpAccessibilityMenuPanel({
  papelizHelpAccessibilityMenuPanelRef,
  papelizHelpMenuAnchorRight,
  papelizHelpMenuAnchorTop,
}: PapelizHelpAccessibilityMenuPanelProps) {
  const [papelizHelpThemePreference, setPapelizHelpThemePreference] = useState<PapelizHelpThemePreference>(readPapelizHelpThemePreference)

  useLayoutEffect(() => {
    papelizHelpAccessibilityMenuPanelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [papelizHelpAccessibilityMenuPanelRef])

  return (
    <div
      ref={papelizHelpAccessibilityMenuPanelRef}
      role="dialog"
      aria-label="Accessibility"
      className="papeliz-help-selection-on-surface papeliz-pop-enter fixed z-50 w-[288px] max-w-[calc(100vw-16px)] rounded-2xl border border-papeliz-line bg-papeliz-surface p-3.5 text-papeliz-ink shadow-papeliz-pop"
      style={{ right: papelizHelpMenuAnchorRight, top: papelizHelpMenuAnchorTop }}
    >
      <p className="text-[13px] font-semibold">Accessibility</p>
      <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Theme</p>
      <PapelizHelpSlidingChoiceGroup
        papelizHelpSlidingChoiceGroupLabel="Theme"
        papelizHelpChosenSlidingChoiceValue={papelizHelpThemePreference}
        onPapelizHelpSlidingChoiceSelect={(papelizHelpChosenThemePreference) => {
          choosePapelizHelpThemePreference(papelizHelpChosenThemePreference)
          setPapelizHelpThemePreference(papelizHelpChosenThemePreference)
        }}
        papelizHelpSlidingChoices={papelizHelpThemeChoices.map((papelizHelpThemeChoice) => ({
          papelizHelpSlidingChoiceValue: papelizHelpThemeChoice.papelizHelpThemePreference,
          papelizHelpSlidingChoiceContent: (
            <>
              <papelizHelpThemeChoice.PapelizHelpThemeChoiceIcon className="size-3.5" aria-hidden="true" />
              {papelizHelpThemeChoice.papelizHelpThemeChoiceLabel}
            </>
          ),
        }))}
      />
    </div>
  )
}
