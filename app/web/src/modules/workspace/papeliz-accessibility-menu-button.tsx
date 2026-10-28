import { Accessibility, Keyboard, Lock, LockOpen, Maximize2, Minus, Monitor, Moon, Plus, RotateCcw, Sun } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { usePapelizThemeStore, type PapelizThemePreference } from '../ui/papeliz-theme'
import { PapelizKeyBindingsDialog } from './papeliz-key-bindings-dialog'
import { usePapelizKeyBindingShortcutLabel } from './papeliz-key-bindings-store'
import {
  papelizDefaultNoteTypography,
  papelizNoteFontSizeLimits,
  usePapelizNoteTypographyStore,
  type PapelizNoteColumnWidth,
  type PapelizNoteFontFamily,
} from './papeliz-note-typography-store'
import { usePapelizNoteTabsLayoutStore, type PapelizNoteTabsLayout } from './papeliz-note-tabs-layout-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

const papelizThemeChoices = [
  { papelizThemePreference: 'light', themeChoiceLabel: 'Light', ThemeChoiceIcon: Sun },
  { papelizThemePreference: 'dark', themeChoiceLabel: 'Dark', ThemeChoiceIcon: Moon },
  { papelizThemePreference: 'system', themeChoiceLabel: 'Device', ThemeChoiceIcon: Monitor },
] as const satisfies ReadonlyArray<{ papelizThemePreference: PapelizThemePreference; themeChoiceLabel: string; ThemeChoiceIcon: typeof Sun }>

const papelizNoteFontFamilyChoices: ReadonlyArray<{ noteFontFamily: PapelizNoteFontFamily; fontChoiceLabel: string; fontChoiceFontClassName: string }> = [
  { noteFontFamily: 'sans', fontChoiceLabel: 'Sans', fontChoiceFontClassName: 'font-sans' },
  { noteFontFamily: 'serif', fontChoiceLabel: 'Serif', fontChoiceFontClassName: 'font-serif' },
  { noteFontFamily: 'mono', fontChoiceLabel: 'Mono', fontChoiceFontClassName: 'font-mono' },
]

const papelizNoteColumnWidthChoices: ReadonlyArray<{ noteColumnWidth: PapelizNoteColumnWidth; widthChoiceLabel: string }> = [
  { noteColumnWidth: 'narrow', widthChoiceLabel: 'Narrow' },
  { noteColumnWidth: 'normal', widthChoiceLabel: 'Normal' },
  { noteColumnWidth: 'wide', widthChoiceLabel: 'Wide' },
  { noteColumnWidth: 'full', widthChoiceLabel: 'Full' },
]

const papelizNoteTabsLayoutChoices: ReadonlyArray<{ noteTabsLayout: PapelizNoteTabsLayout; tabsLayoutChoiceLabel: string; tabsLayoutChoiceTitle: string }> = [
  { noteTabsLayout: 'scroll', tabsLayoutChoiceLabel: 'Scroll', tabsLayoutChoiceTitle: 'One row of tabs, with a scrollbar when they don’t fit' },
  { noteTabsLayout: 'stack', tabsLayoutChoiceLabel: 'Stack', tabsLayoutChoiceTitle: 'Tabs wrap onto more rows, so every one shows' },
]

const papelizAccessibilityMenuRowClassName =
  'flex w-full items-center gap-2.5 rounded-xl border border-papeliz-line px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-papeliz-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue disabled:pointer-events-none disabled:opacity-45'

interface PapelizAccessibilityMenuButtonProps {
  // The workspace adds the note's text (font, size, width), the tabs' layout, Lock All Notes, Key
  // Bindings and focus mode; the start page has only the theme.
  isNoteDisplaySettingsShown: boolean
}

// The Accessibility button in the blue topbar: one dropdown for the theme (Light, the default;
// Dark; or the device's), the note's font, size and width, how the tabs sit (Scroll or Stack), Lock
// All Notes, Key Bindings (a dialog of its own), and focus mode. Changes show at once and are
// remembered.
export function PapelizAccessibilityMenuButton({ isNoteDisplaySettingsShown }: PapelizAccessibilityMenuButtonProps) {
  const papelizThemePreference = usePapelizThemeStore((themeState) => themeState.papelizThemePreference)
  const setPapelizThemePreference = usePapelizThemeStore((themeState) => themeState.setPapelizThemePreference)
  const noteFontFamily = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontFamily)
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const noteColumnWidth = usePapelizNoteTypographyStore((typographyState) => typographyState.noteColumnWidth)
  const changeNoteTypography = usePapelizNoteTypographyStore((typographyState) => typographyState.changeNoteTypography)
  const setFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.setFocusModeOn)
  const isWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.isWholeVaultEditingLocked)
  const setWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.setWholeVaultEditingLocked)
  const noteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.noteTabsLayout)
  const setNoteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.setNoteTabsLayout)
  const focusModeShortcutLabel = usePapelizKeyBindingShortcutLabel('focus-mode-toggle')
  const [accessibilityMenuAnchor, setAccessibilityMenuAnchor] = useState<{ anchorRight: number; anchorTop: number } | null>(null)
  const [isKeyBindingsDialogOpen, setIsKeyBindingsDialogOpen] = useState(false)
  const accessibilityMenuPanelRef = useRef<HTMLDivElement>(null)
  const accessibilityMenuButtonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (accessibilityMenuAnchor !== null) accessibilityMenuPanelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [accessibilityMenuAnchor])

  useEffect(() => {
    if (accessibilityMenuAnchor === null) return
    const closeAccessibilityMenu = () => setAccessibilityMenuAnchor(null)
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pointerTarget = pointerEvent.target as Node
      if (!accessibilityMenuPanelRef.current?.contains(pointerTarget) && !accessibilityMenuButtonRef.current?.contains(pointerTarget)) {
        closeAccessibilityMenu()
      }
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      closeAccessibilityMenu()
      accessibilityMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeAccessibilityMenu)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeAccessibilityMenu)
    }
  }, [accessibilityMenuAnchor])

  const isDefaultTypography =
    noteFontFamily === papelizDefaultNoteTypography.noteFontFamily &&
    noteFontSize === papelizDefaultNoteTypography.noteFontSize &&
    noteColumnWidth === papelizDefaultNoteTypography.noteColumnWidth

  return (
    <>
      <PapelizIconButton
        ref={accessibilityMenuButtonRef}
        iconButtonLabel={isNoteDisplaySettingsShown ? 'Accessibility: theme, text, tabs, lock, key bindings and focus' : 'Accessibility: theme'}
        iconButtonTone="topbar"
        aria-haspopup="dialog"
        aria-expanded={accessibilityMenuAnchor !== null}
        onClick={(clickEvent) => {
          if (accessibilityMenuAnchor !== null) {
            setAccessibilityMenuAnchor(null)
            return
          }
          const accessibilityMenuButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setAccessibilityMenuAnchor({ anchorRight: window.innerWidth - accessibilityMenuButtonRect.right, anchorTop: accessibilityMenuButtonRect.bottom + 6 })
        }}
      >
        <Accessibility className="size-[18px]" aria-hidden="true" />
      </PapelizIconButton>
      {accessibilityMenuAnchor !== null &&
        createPortal(
          <div
            ref={accessibilityMenuPanelRef}
            role="dialog"
            aria-label="Accessibility"
            className="papeliz-pop-enter fixed z-50 w-[288px] max-w-[calc(100vw-16px)] rounded-2xl border border-papeliz-line bg-papeliz-surface p-3.5 text-papeliz-ink shadow-papeliz-pop"
            style={{ right: Math.max(8, accessibilityMenuAnchor.anchorRight), top: accessibilityMenuAnchor.anchorTop }}
          >
            <p className="text-[13px] font-semibold">Accessibility</p>

            <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Theme</p>
            <PapelizSlidingChoiceGroup
              slidingChoiceGroupLabel="Theme"
              slidingChoiceGroupRole="radiogroup"
              chosenSlidingChoiceValue={papelizThemePreference}
              onSlidingChoiceSelect={setPapelizThemePreference}
              slidingChoices={papelizThemeChoices.map((themeChoice) => ({
                slidingChoiceValue: themeChoice.papelizThemePreference,
                slidingChoiceContent: (
                  <>
                    <themeChoice.ThemeChoiceIcon className="size-3.5" aria-hidden="true" />
                    {themeChoice.themeChoiceLabel}
                  </>
                ),
              }))}
            />

            {isNoteDisplaySettingsShown && (
              <>
                <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Font</p>
                <PapelizSlidingChoiceGroup
                  slidingChoiceGroupLabel="Font"
                  slidingChoiceGroupRole="radiogroup"
                  chosenSlidingChoiceValue={noteFontFamily}
                  onSlidingChoiceSelect={(chosenNoteFontFamily) => changeNoteTypography({ noteFontFamily: chosenNoteFontFamily })}
                  slidingChoices={papelizNoteFontFamilyChoices.map((fontChoice) => ({
                    slidingChoiceValue: fontChoice.noteFontFamily,
                    slidingChoiceContent: fontChoice.fontChoiceLabel,
                    slidingChoiceClassName: fontChoice.fontChoiceFontClassName,
                  }))}
                />

                <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Text size</p>
                <div className="flex items-center gap-2">
                  <PapelizIconButton
                    iconButtonLabel="Smaller text"
                    iconButtonSize="small"
                    disabled={noteFontSize <= papelizNoteFontSizeLimits.minimumNoteFontSize}
                    onClick={() => changeNoteTypography({ noteFontSize: usePapelizNoteTypographyStore.getState().noteFontSize - 1 })}
                    className="disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </PapelizIconButton>
                  <input
                    type="range"
                    aria-label="Text size"
                    min={papelizNoteFontSizeLimits.minimumNoteFontSize}
                    max={papelizNoteFontSizeLimits.maximumNoteFontSize}
                    step={1}
                    value={noteFontSize}
                    onChange={(changeEvent) => changeNoteTypography({ noteFontSize: Number(changeEvent.target.value) })}
                    className="min-w-0 flex-1 accent-papeliz-blue"
                  />
                  <PapelizIconButton
                    iconButtonLabel="Larger text"
                    iconButtonSize="small"
                    disabled={noteFontSize >= papelizNoteFontSizeLimits.maximumNoteFontSize}
                    onClick={() => changeNoteTypography({ noteFontSize: usePapelizNoteTypographyStore.getState().noteFontSize + 1 })}
                    className="disabled:opacity-40"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </PapelizIconButton>
                  <span className="w-11 flex-none text-right text-[12.5px] text-papeliz-ink-muted tabular-nums">{noteFontSize} px</span>
                </div>

                <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Text width</p>
                <PapelizSlidingChoiceGroup
                  slidingChoiceGroupLabel="Text width"
                  slidingChoiceGroupRole="radiogroup"
                  chosenSlidingChoiceValue={noteColumnWidth}
                  onSlidingChoiceSelect={(chosenNoteColumnWidth) => changeNoteTypography({ noteColumnWidth: chosenNoteColumnWidth })}
                  slidingChoices={papelizNoteColumnWidthChoices.map((widthChoice) => ({
                    slidingChoiceValue: widthChoice.noteColumnWidth,
                    slidingChoiceContent: widthChoice.widthChoiceLabel,
                  }))}
                />

                <button
                  type="button"
                  disabled={isDefaultTypography}
                  title="Font, text size and text width back to their defaults"
                  onClick={() => changeNoteTypography(papelizDefaultNoteTypography)}
                  className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-papeliz-blue hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Reset Text Settings
                </button>

                <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Tabs</p>
                <PapelizSlidingChoiceGroup
                  slidingChoiceGroupLabel="Tabs"
                  slidingChoiceGroupRole="radiogroup"
                  chosenSlidingChoiceValue={noteTabsLayout}
                  onSlidingChoiceSelect={setNoteTabsLayout}
                  slidingChoices={papelizNoteTabsLayoutChoices.map((tabsLayoutChoice) => ({
                    slidingChoiceValue: tabsLayoutChoice.noteTabsLayout,
                    slidingChoiceContent: tabsLayoutChoice.tabsLayoutChoiceLabel,
                    slidingChoiceTitle: tabsLayoutChoice.tabsLayoutChoiceTitle,
                  }))}
                />

                {/* Lock All Notes: every note can be read but not changed. Each note's and folder's own
                    lock stays as it was underneath, so unlocking brings them back. The panel stays
                    open, so the new state shows on the row at once. */}
                <button
                  type="button"
                  aria-pressed={isWholeVaultEditingLocked}
                  title={
                    isWholeVaultEditingLocked
                      ? 'Every note is locked. Unlock them; notes you locked one by one stay locked.'
                      : 'Lock every note in this vault, so they can be read but not changed'
                  }
                  onClick={() => setWholeVaultEditingLocked(!isWholeVaultEditingLocked)}
                  className={`mt-3 ${papelizAccessibilityMenuRowClassName} aria-pressed:border-papeliz-blue-line aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue`}
                >
                  {isWholeVaultEditingLocked ? (
                    <Lock key="whole-vault-locked" className="papeliz-icon-swap-enter size-4 flex-none" aria-hidden="true" />
                  ) : (
                    <LockOpen key="whole-vault-unlocked" className="papeliz-icon-swap-enter size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
                  )}
                  <span className="flex-1">{isWholeVaultEditingLocked ? 'Unlock All Notes' : 'Lock All Notes'}</span>
                  {isWholeVaultEditingLocked && <span className="text-[11.5px] font-semibold">Locked</span>}
                </button>

                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    // Focus waits on the Accessibility button, so it comes back there when the
                    // dialog closes.
                    accessibilityMenuButtonRef.current?.focus()
                    setAccessibilityMenuAnchor(null)
                    setIsKeyBindingsDialogOpen(true)
                  }}
                  className={`mt-2 ${papelizAccessibilityMenuRowClassName}`}
                >
                  <Keyboard className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
                  <span className="flex-1">Key Bindings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccessibilityMenuAnchor(null)
                    setFocusModeOn(true)
                  }}
                  className={`mt-2 ${papelizAccessibilityMenuRowClassName}`}
                >
                  <Maximize2 className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
                  <span className="flex-1">Focus mode</span>
                  <kbd className="font-sans text-[11.5px] text-papeliz-ink-subtle">{focusModeShortcutLabel}</kbd>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {isKeyBindingsDialogOpen && createPortal(<PapelizKeyBindingsDialog onKeyBindingsDialogClose={() => setIsKeyBindingsDialogOpen(false)} />, document.body)}
    </>
  )
}
