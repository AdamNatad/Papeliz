import { LoaderCircle, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { usePapelizThemeStore, type PapelizThemePreference } from '../ui/papeliz-theme'
import { PapelizKeyBindingsList } from './papeliz-key-bindings-list'
import { PapelizNoteTextSizeSlider } from './papeliz-note-text-size-slider'
import { PapelizSettingsGearReminderTab } from './papeliz-settings-gear-reminder-tab'
import { usePapelizNoteTabsLayoutStore, type PapelizNoteTabsLayout } from './papeliz-note-tabs-layout-store'
import {
  papelizDefaultNoteTypography,
  usePapelizNoteTypographyStore,
  type PapelizNoteColumnWidth,
  type PapelizNoteFontFamily,
} from './papeliz-note-typography-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// The pages the Settings gear's list opens (papeliz-settings-gear-button.tsx).

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

function PapelizSettingsGearFieldLabel({ children, isFirstField = false }: { children: ReactNode; isFirstField?: boolean }) {
  return <p className={`${isFirstField ? '' : 'mt-3 '}mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle`}>{children}</p>
}

interface PapelizSettingsGearAccessibilityPageProps {
  // The workspace adds the note's text (font, size, width) and the note tabs; the start page has
  // only the theme.
  isNoteDisplaySettingsShown: boolean
}

// Accessibility: how notes look. Changes show at once and are remembered.
export function PapelizSettingsGearAccessibilityPage({ isNoteDisplaySettingsShown }: PapelizSettingsGearAccessibilityPageProps) {
  const papelizThemePreference = usePapelizThemeStore((themeState) => themeState.papelizThemePreference)
  const setPapelizThemePreference = usePapelizThemeStore((themeState) => themeState.setPapelizThemePreference)
  const noteFontFamily = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontFamily)
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const noteColumnWidth = usePapelizNoteTypographyStore((typographyState) => typographyState.noteColumnWidth)
  const changeNoteTypography = usePapelizNoteTypographyStore((typographyState) => typographyState.changeNoteTypography)
  const noteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.noteTabsLayout)
  const setNoteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.setNoteTabsLayout)
  const isDefaultTypography =
    noteFontFamily === papelizDefaultNoteTypography.noteFontFamily &&
    noteFontSize === papelizDefaultNoteTypography.noteFontSize &&
    noteColumnWidth === papelizDefaultNoteTypography.noteColumnWidth

  return (
    <div>
      <PapelizSettingsGearFieldLabel isFirstField>Theme</PapelizSettingsGearFieldLabel>
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
          <PapelizSettingsGearFieldLabel>Font</PapelizSettingsGearFieldLabel>
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

          <PapelizSettingsGearFieldLabel>Text size</PapelizSettingsGearFieldLabel>
          <PapelizNoteTextSizeSlider />

          <PapelizSettingsGearFieldLabel>Text width</PapelizSettingsGearFieldLabel>
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

          <PapelizSettingsGearFieldLabel>Note tabs</PapelizSettingsGearFieldLabel>
          <PapelizSlidingChoiceGroup
            slidingChoiceGroupLabel="Note tabs"
            slidingChoiceGroupRole="radiogroup"
            chosenSlidingChoiceValue={noteTabsLayout}
            onSlidingChoiceSelect={setNoteTabsLayout}
            slidingChoices={papelizNoteTabsLayoutChoices.map((tabsLayoutChoice) => ({
              slidingChoiceValue: tabsLayoutChoice.noteTabsLayout,
              slidingChoiceContent: tabsLayoutChoice.tabsLayoutChoiceLabel,
              slidingChoiceTitle: tabsLayoutChoice.tabsLayoutChoiceTitle,
            }))}
          />
        </>
      )}
    </div>
  )
}

type PapelizSettingsGearSettingsTab = 'key-bindings' | 'reminder'

// Settings: Key Bindings. A vault kept in the browser adds a Reminder tab (backups), with a tab row
// over the two; a folder vault shows Key Bindings alone.
export function PapelizSettingsGearSettingsPage() {
  const isBrowserVaultOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultAdapter.papelizVaultKind === 'browser-vault-in-opfs')
  const [chosenSettingsGearSettingsTab, setChosenSettingsGearSettingsTab] = useState<PapelizSettingsGearSettingsTab>('key-bindings')
  if (!isBrowserVaultOpen) {
    return (
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Key Bindings</p>
        <PapelizKeyBindingsList />
      </div>
    )
  }
  return (
    <div>
      <PapelizSlidingChoiceGroup<PapelizSettingsGearSettingsTab>
        slidingChoiceGroupLabel="Settings"
        slidingChoiceGroupRole="tablist"
        slidingChoiceGroupTone="solid-blue"
        slidingChoices={[
          { slidingChoiceValue: 'key-bindings', slidingChoiceContent: 'Key Bindings' },
          { slidingChoiceValue: 'reminder', slidingChoiceContent: 'Reminder' },
        ]}
        chosenSlidingChoiceValue={chosenSettingsGearSettingsTab}
        onSlidingChoiceSelect={setChosenSettingsGearSettingsTab}
        slidingChoiceGroupClassName="mb-3"
      />
      <div role="tabpanel" aria-label={chosenSettingsGearSettingsTab === 'reminder' ? 'Reminder' : 'Key Bindings'}>
        {chosenSettingsGearSettingsTab === 'reminder' ? <PapelizSettingsGearReminderTab /> : <PapelizKeyBindingsList />}
      </div>
    </div>
  )
}

type PapelizSettingsGearTeaser = 'account' | 'sync'

// Papeliz Sync's pages, loaded when one is opened, so the app's first load carries none of Sync.
const PapelizSyncAccountPage = lazy(() => import('../sync/papeliz-sync-account-page').then((syncAccountPageModule) => ({ default: syncAccountPageModule.PapelizSyncAccountPage })))
const PapelizSyncPage = lazy(() => import('../sync/papeliz-sync-page').then((syncPageModule) => ({ default: syncPageModule.PapelizSyncPage })))

// Account and Sync: Papeliz Sync's own pages. An account is only for Sync.
export function PapelizSettingsGearTeaserPage({ settingsGearTeaser }: { settingsGearTeaser: PapelizSettingsGearTeaser }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="flex items-center gap-2 py-2 text-[12.5px] text-papeliz-ink-subtle">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      }
    >
      {settingsGearTeaser === 'account' ? <PapelizSyncAccountPage /> : <PapelizSyncPage />}
    </Suspense>
  )
}
