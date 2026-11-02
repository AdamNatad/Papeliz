import { LoaderCircle, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { usePapelizThemeStore, type PapelizThemePreference } from '../ui/papeliz-theme'
import { PapelizKeyBindingsList } from './papeliz-key-bindings-list'
import { PapelizNoteTextSizeSlider } from './papeliz-note-text-size-slider'
import { PapelizSettingsGearReminderTab } from './papeliz-settings-gear-reminder-tab'
import { PapelizSettingsGearVaultTab } from './papeliz-settings-gear-vault-tab'
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

interface PapelizSettingsGearAppearancePageProps {
  // The workspace adds the note tabs; the start page has only the theme.
  isNoteTabsLayoutShown: boolean
}

// Appearance: how Papeliz looks, the theme and the note tabs. Changes show at once and are remembered.
export function PapelizSettingsGearAppearancePage({ isNoteTabsLayoutShown }: PapelizSettingsGearAppearancePageProps) {
  const papelizThemePreference = usePapelizThemeStore((themeState) => themeState.papelizThemePreference)
  const setPapelizThemePreference = usePapelizThemeStore((themeState) => themeState.setPapelizThemePreference)
  const noteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.noteTabsLayout)
  const setNoteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.setNoteTabsLayout)

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

      {isNoteTabsLayoutShown && (
        <>
          <PapelizSettingsGearFieldLabel>Note Tabs</PapelizSettingsGearFieldLabel>
          <PapelizSlidingChoiceGroup
            slidingChoiceGroupLabel="Note Tabs"
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

// Accessibility: how a note's text reads, its font, size and width, with a reset. Workspace only.
// Changes show at once and are remembered.
export function PapelizSettingsGearAccessibilityPage() {
  const noteFontFamily = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontFamily)
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const noteColumnWidth = usePapelizNoteTypographyStore((typographyState) => typographyState.noteColumnWidth)
  const changeNoteTypography = usePapelizNoteTypographyStore((typographyState) => typographyState.changeNoteTypography)
  const isDefaultTypography =
    noteFontFamily === papelizDefaultNoteTypography.noteFontFamily &&
    noteFontSize === papelizDefaultNoteTypography.noteFontSize &&
    noteColumnWidth === papelizDefaultNoteTypography.noteColumnWidth

  return (
    <div>
      <PapelizSettingsGearFieldLabel isFirstField>Font</PapelizSettingsGearFieldLabel>
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

      <PapelizSettingsGearFieldLabel>Text Size</PapelizSettingsGearFieldLabel>
      <PapelizNoteTextSizeSlider />

      <PapelizSettingsGearFieldLabel>Text Width</PapelizSettingsGearFieldLabel>
      <PapelizSlidingChoiceGroup
        slidingChoiceGroupLabel="Text Width"
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
    </div>
  )
}

type PapelizSettingsGearSettingsTab = 'vault' | 'key-bindings' | 'reminder'

// Settings: the tabs Vault (its name, and Rename for a browser vault), Key Bindings and, for a vault
// kept in the browser, Reminder (backups). It opens on Vault.
export function PapelizSettingsGearSettingsPage() {
  const isBrowserVaultOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultAdapter.papelizVaultKind === 'browser-vault-in-opfs')
  const [chosenSettingsGearSettingsTab, setChosenSettingsGearSettingsTab] = useState<PapelizSettingsGearSettingsTab>('vault')
  const shownSettingsGearSettingsTab = chosenSettingsGearSettingsTab === 'reminder' && !isBrowserVaultOpen ? 'vault' : chosenSettingsGearSettingsTab
  const settingsGearSettingsTabLabels: Record<PapelizSettingsGearSettingsTab, string> = { vault: 'Vault', 'key-bindings': 'Key Bindings', reminder: 'Reminder' }
  const shownSettingsGearSettingsTabs: PapelizSettingsGearSettingsTab[] = isBrowserVaultOpen ? ['vault', 'key-bindings', 'reminder'] : ['vault', 'key-bindings']
  return (
    <div>
      <PapelizSlidingChoiceGroup<PapelizSettingsGearSettingsTab>
        slidingChoiceGroupLabel="Settings"
        slidingChoiceGroupRole="tablist"
        slidingChoiceGroupTone="solid-blue"
        slidingChoices={shownSettingsGearSettingsTabs.map((settingsGearSettingsTab) => ({
          slidingChoiceValue: settingsGearSettingsTab,
          slidingChoiceContent: settingsGearSettingsTabLabels[settingsGearSettingsTab],
        }))}
        chosenSlidingChoiceValue={shownSettingsGearSettingsTab}
        onSlidingChoiceSelect={setChosenSettingsGearSettingsTab}
        slidingChoiceGroupClassName="mb-3"
      />
      <div role="tabpanel" aria-label={settingsGearSettingsTabLabels[shownSettingsGearSettingsTab]}>
        {shownSettingsGearSettingsTab === 'vault' ? (
          <PapelizSettingsGearVaultTab />
        ) : shownSettingsGearSettingsTab === 'reminder' ? (
          <PapelizSettingsGearReminderTab />
        ) : (
          <PapelizKeyBindingsList />
        )}
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
