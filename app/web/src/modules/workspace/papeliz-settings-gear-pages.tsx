import { ChevronDown, ChevronRight, Download, FileText, Folder, LoaderCircle, Monitor, Moon, RefreshCw, RotateCcw, Search, Sun, User } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { usePapelizThemeStore, type PapelizThemePreference } from '../ui/papeliz-theme'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { choosePapelizExportFileDestination, writePapelizExportFile } from './papeliz-export-file-save'
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
import {
  buildPapelizExportNoteTree,
  findExportNotesMatchingSearch,
  listExportNoteRelativePaths,
  readExportTreeNodeTickState,
  toggleExportTreeNodeTick,
  type PapelizExportTreeNode,
} from './papeliz-settings-gear-export-note-tree'
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

// Account and Sync: what is coming, and nothing to click yet.
export function PapelizSettingsGearTeaserPage({ settingsGearTeaser }: { settingsGearTeaser: PapelizSettingsGearTeaser }) {
  const TeaserIcon = settingsGearTeaser === 'account' ? User : RefreshCw
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="grid size-[52px] place-items-center rounded-full bg-papeliz-surface-gray text-papeliz-ink-muted">
        <TeaserIcon className="size-6" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold">{settingsGearTeaser === 'account' ? 'Account' : 'Sync'}</p>
      {settingsGearTeaser === 'sync' && (
        <p className="max-w-[230px] text-[12.5px] leading-[1.45] text-papeliz-ink-muted">
          Keep your vaults in sync across web, desktop and mobile, end-to-end encrypted.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-1.5">
        {settingsGearTeaser === 'sync' && (
          <span className="inline-flex h-[22px] items-center rounded-full border border-papeliz-ok/45 bg-papeliz-ok/12 px-2.5 text-[11.5px] font-semibold text-papeliz-ok">
            Paid Add-on
          </span>
        )}
        <span className="inline-flex h-[22px] items-center rounded-full border border-papeliz-blue-line bg-papeliz-blue-soft px-2.5 text-[11.5px] font-semibold text-papeliz-blue">
          Coming soon
        </span>
      </div>
    </div>
  )
}

type PapelizExportFormat = 'pdf' | 'html'

const papelizExportFormatChoices: ReadonlyArray<{ exportFormat: PapelizExportFormat; exportFormatLabel: string }> = [
  { exportFormat: 'pdf', exportFormatLabel: 'PDF' },
  { exportFormat: 'html', exportFormatLabel: 'HTML' },
]

// Where an export stands, for the line under the Export button.
type PapelizExportRunState =
  | { exportRunKind: 'idle' }
  | { exportRunKind: 'running'; exportedNoteCount: number; exportNoteCount: number }
  | { exportRunKind: 'saved'; savedExportFileName: string; isDownloaded: boolean }
  | { exportRunKind: 'cancelled' }
  | { exportRunKind: 'failed'; exportFailureMessage: string }

// The folders above a note, so the page opens with the open note's folder already open.
function listVaultFolderRelativePathsAbove(vaultNoteRelativePath: string): string[] {
  const vaultFolderRelativePathsAbove: string[] = []
  let vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultNoteRelativePath)
  while (vaultFolderRelativePath !== '') {
    vaultFolderRelativePathsAbove.push(vaultFolderRelativePath)
    vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultFolderRelativePath)
  }
  return vaultFolderRelativePathsAbove
}

interface PapelizExportTreeRowProps {
  exportTreeNode: PapelizExportTreeNode
  exportTreeDepth: number
  exportFolderHint?: string
  tickedVaultNoteRelativePaths: ReadonlySet<string>
  isExportFolderOpen: boolean
  onExportTreeNodeTickToggle: (exportTreeNode: PapelizExportTreeNode) => void
  onExportFolderOpenToggle: (exportTreeNode: PapelizExportTreeNode) => void
}

function PapelizExportTreeRow({
  exportTreeNode,
  exportTreeDepth,
  exportFolderHint,
  tickedVaultNoteRelativePaths,
  isExportFolderOpen,
  onExportTreeNodeTickToggle,
  onExportFolderOpenToggle,
}: PapelizExportTreeRowProps) {
  const isExportFolder = exportTreeNode.vaultEntryKind === 'folder'
  const exportTreeNodeTickState = readExportTreeNodeTickState(exportTreeNode, tickedVaultNoteRelativePaths)
  const ExportTreeNodeIcon = isExportFolder ? Folder : FileText
  return (
    <div
      className={`flex min-h-[30px] items-center gap-1.5 rounded-full pr-2 text-[12.5px] pointer-coarse:min-h-10 ${exportTreeNodeTickState === 'ticked' ? 'bg-papeliz-blue/9' : ''}`}
      style={{ paddingLeft: 4 + exportTreeDepth * 16 }}
    >
      {isExportFolder ? (
        <button
          type="button"
          aria-expanded={isExportFolderOpen}
          aria-label={`${isExportFolderOpen ? 'Close' : 'Open'} ${exportTreeNode.exportTreeNodeName}`}
          onClick={() => onExportFolderOpenToggle(exportTreeNode)}
          className="grid size-5 flex-none place-items-center rounded-full text-papeliz-ink-subtle hover:bg-papeliz-hover hover:text-papeliz-ink"
        >
          {isExportFolderOpen ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        </button>
      ) : (
        <span className="size-5 flex-none" aria-hidden="true" />
      )}
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={exportTreeNodeTickState === 'ticked'}
          ref={(exportTreeNodeCheckbox) => {
            if (exportTreeNodeCheckbox !== null) exportTreeNodeCheckbox.indeterminate = exportTreeNodeTickState === 'partly-ticked'
          }}
          onChange={() => onExportTreeNodeTickToggle(exportTreeNode)}
          className="size-[15px] flex-none accent-papeliz-blue"
        />
        <ExportTreeNodeIcon className="size-3.5 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{exportTreeNode.exportTreeNodeName}</span>
        {exportFolderHint !== undefined && <span className="max-w-[45%] flex-none truncate text-[11px] text-papeliz-ink-subtle">{exportFolderHint}</span>}
      </label>
    </div>
  )
}

// Export: tick notes in the vault's folder tree (open a folder to pick single notes inside it), then
// PDF or HTML. One note downloads as one file; several as one .zip, folders kept. HTML is Papeliz's
// HTML export (html-export/), loaded when someone exports; PDF waits for the PDF engine.
export function PapelizSettingsGearExportPage() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const vaultEntryOrder = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultEntryOrder)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const saveAllVaultNotesNow = usePapelizWorkspaceStore((workspaceState) => workspaceState.saveAllVaultNotesNow)
  const noteFontFamily = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontFamily)
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const noteColumnWidth = usePapelizNoteTypographyStore((typographyState) => typographyState.noteColumnWidth)
  const [exportRunState, setExportRunState] = useState<PapelizExportRunState>({ exportRunKind: 'idle' })
  const exportAbortControllerRef = useRef<AbortController | null>(null)
  const exportNoteTree = useMemo(() => buildPapelizExportNoteTree(vaultTreeEntries, vaultEntryOrder), [vaultTreeEntries, vaultEntryOrder])
  const everyExportNoteRelativePath = useMemo(() => listExportNoteRelativePaths(exportNoteTree), [exportNoteTree])
  // The open note comes ticked, with its folders open so it shows.
  const [tickedVaultNoteRelativePaths, setTickedVaultNoteRelativePaths] = useState<ReadonlySet<string>>(() =>
    activeVaultNoteRelativePath !== null && everyExportNoteRelativePath.includes(activeVaultNoteRelativePath) ? new Set([activeVaultNoteRelativePath]) : new Set(),
  )
  const [openExportFolderRelativePaths, setOpenExportFolderRelativePaths] = useState<ReadonlySet<string>>(
    () => new Set(activeVaultNoteRelativePath === null ? [] : listVaultFolderRelativePathsAbove(activeVaultNoteRelativePath)),
  )
  const [exportNoteSearchText, setExportNoteSearchText] = useState('')
  // HTML first while the PDF engine is still to come, so the button works when the page opens.
  const [chosenExportFormat, setChosenExportFormat] = useState<PapelizExportFormat>('html')

  // Ticks that still name a note in the vault (one may have been renamed or trashed meanwhile).
  const tickedExportNoteCount = everyExportNoteRelativePath.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath)).length
  const isEveryExportNoteTicked = everyExportNoteRelativePath.length > 0 && tickedExportNoteCount === everyExportNoteRelativePath.length
  const exportNoteSearchMatches = findExportNotesMatchingSearch(exportNoteTree, exportNoteSearchText)
  const isExportNoteSearchOn = exportNoteSearchText.trim() !== ''
  const chosenExportFormatLabel = chosenExportFormat === 'pdf' ? 'PDF' : 'HTML'
  const exportButtonLabel = isEveryExportNoteTicked
    ? `Export all notes as ${chosenExportFormatLabel}`
    : tickedExportNoteCount > 1
      ? `Export ${tickedExportNoteCount} notes as ${chosenExportFormatLabel}`
      : `Export as ${chosenExportFormatLabel}`
  const exportSelectionSummary =
    tickedExportNoteCount === 0
      ? 'No notes ticked.'
      : isEveryExportNoteTicked
        ? `Every note in “${openVault?.papelizVaultDisplayName ?? 'this vault'}”. They download as one .zip, folders kept.`
        : tickedExportNoteCount === 1
          ? '1 note ticked.'
          : `${tickedExportNoteCount} notes ticked. They download as one .zip, folders kept.`

  const isExportRunning = exportRunState.exportRunKind === 'running'
  const canExport = chosenExportFormat === 'html' && tickedExportNoteCount > 0 && openVault !== null && !isExportRunning

  const exportTickedNotesAsHtml = async () => {
    if (openVault === null) return
    const exportVaultNoteRelativePaths = everyExportNoteRelativePath.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath))
    const htmlExportModule = await import('../html-export/papeliz-html-export-from-vault')
    const htmlExportFileKind = htmlExportModule.describePapelizVaultHtmlExportFile(openVault.papelizVaultDisplayName, exportVaultNoteRelativePaths)
    // Where to save is asked first: the browser's save dialog opens only right after the click.
    const exportFileDestination = await choosePapelizExportFileDestination(htmlExportFileKind.htmlExportFileName, {
      exportFileDescription: htmlExportFileKind.htmlExportFileDescription,
      exportFileMediaType: htmlExportFileKind.htmlExportFileMediaType,
      exportFileExtension: htmlExportFileKind.htmlExportFileExtension,
    })
    if (exportFileDestination === null) return
    const exportAbortController = new AbortController()
    exportAbortControllerRef.current = exportAbortController
    setExportRunState({ exportRunKind: 'running', exportedNoteCount: 0, exportNoteCount: exportVaultNoteRelativePaths.length })
    try {
      // Edits still waiting for autosave go into the export too.
      await saveAllVaultNotesNow()
      const { htmlExportFileBlob } = await htmlExportModule.exportPapelizVaultNotesAsHtml({
        vaultAdapter: openVault.papelizVaultAdapter,
        vaultDisplayName: openVault.papelizVaultDisplayName,
        exportVaultNoteRelativePaths,
        everyVaultNoteRelativePath: everyExportNoteRelativePath,
        htmlExportNoteTypography: { noteFontFamily, noteFontSize, noteColumnWidth },
        onHtmlExportProgress: (exportedNoteCount, exportNoteCount) => setExportRunState({ exportRunKind: 'running', exportedNoteCount, exportNoteCount }),
        htmlExportAbortSignal: exportAbortController.signal,
      })
      exportAbortController.signal.throwIfAborted()
      await writePapelizExportFile(exportFileDestination, htmlExportFileKind.htmlExportFileName, htmlExportFileBlob)
      setExportRunState({
        exportRunKind: 'saved',
        savedExportFileName: htmlExportFileKind.htmlExportFileName,
        isDownloaded: exportFileDestination.exportFileDestinationKind === 'download',
      })
    } catch (exportError) {
      setExportRunState(
        exportAbortController.signal.aborted ? { exportRunKind: 'cancelled' } : { exportRunKind: 'failed', exportFailureMessage: describePapelizVaultError(exportError) },
      )
    } finally {
      if (exportAbortControllerRef.current === exportAbortController) exportAbortControllerRef.current = null
    }
  }

  const exportRunLine =
    chosenExportFormat === 'pdf'
      ? 'PDF export is coming soon.'
      : exportRunState.exportRunKind === 'saved'
        ? `${exportRunState.isDownloaded ? 'Downloaded' : 'Saved'} “${exportRunState.savedExportFileName}”.`
        : exportRunState.exportRunKind === 'cancelled'
          ? 'Export cancelled.'
          : exportRunState.exportRunKind === 'failed'
            ? `The export stopped: ${exportRunState.exportFailureMessage}.`
            : null

  const toggleExportTreeNode = (exportTreeNode: PapelizExportTreeNode) =>
    setTickedVaultNoteRelativePaths((currentTickedPaths) => toggleExportTreeNodeTick(exportTreeNode, currentTickedPaths))
  const toggleExportFolderOpen = (exportTreeNode: PapelizExportTreeNode) =>
    setOpenExportFolderRelativePaths((currentOpenFolderPaths) => {
      const nextOpenFolderPaths = new Set(currentOpenFolderPaths)
      if (nextOpenFolderPaths.has(exportTreeNode.vaultEntryRelativePath)) nextOpenFolderPaths.delete(exportTreeNode.vaultEntryRelativePath)
      else nextOpenFolderPaths.add(exportTreeNode.vaultEntryRelativePath)
      return nextOpenFolderPaths
    })

  const renderExportTreeRows = (exportTreeNodes: readonly PapelizExportTreeNode[], exportTreeDepth: number): ReactNode =>
    exportTreeNodes.map((exportTreeNode) => {
      const isExportFolderOpen = openExportFolderRelativePaths.has(exportTreeNode.vaultEntryRelativePath)
      return (
        <div key={exportTreeNode.vaultEntryRelativePath}>
          <PapelizExportTreeRow
            exportTreeNode={exportTreeNode}
            exportTreeDepth={exportTreeDepth}
            tickedVaultNoteRelativePaths={tickedVaultNoteRelativePaths}
            isExportFolderOpen={isExportFolderOpen}
            onExportTreeNodeTickToggle={toggleExportTreeNode}
            onExportFolderOpenToggle={toggleExportFolderOpen}
          />
          {exportTreeNode.vaultEntryKind === 'folder' && isExportFolderOpen && renderExportTreeRows(exportTreeNode.childExportTreeNodes, exportTreeDepth + 1)}
        </div>
      )
    })

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="text-[12px] font-medium text-papeliz-ink-subtle">Notes</p>
        <button
          type="button"
          disabled={everyExportNoteRelativePath.length === 0}
          onClick={() => setTickedVaultNoteRelativePaths(isEveryExportNoteTicked ? new Set() : new Set(everyExportNoteRelativePath))}
          className="text-[12px] font-semibold text-papeliz-blue hover:underline disabled:opacity-40"
        >
          {isEveryExportNoteTicked ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="rounded-xl border border-papeliz-line bg-papeliz-surface p-1">
        <label className="mb-1 flex h-8 items-center gap-2 border-b border-papeliz-line px-2 text-papeliz-ink-subtle">
          <Search className="size-3.5 flex-none" aria-hidden="true" />
          <input
            type="search"
            value={exportNoteSearchText}
            onChange={(changeEvent) => setExportNoteSearchText(changeEvent.target.value)}
            placeholder="Search notes"
            aria-label="Search notes to export"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle"
          />
        </label>
        <div className="max-h-[240px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          {isExportNoteSearchOn ? (
            exportNoteSearchMatches.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-papeliz-ink-subtle">No notes match.</p>
            ) : (
              exportNoteSearchMatches.map((exportTreeNode) => (
                <PapelizExportTreeRow
                  key={exportTreeNode.vaultEntryRelativePath}
                  exportTreeNode={exportTreeNode}
                  exportTreeDepth={0}
                  exportFolderHint={getVaultEntryParentFolderRelativePath(exportTreeNode.vaultEntryRelativePath) || undefined}
                  tickedVaultNoteRelativePaths={tickedVaultNoteRelativePaths}
                  isExportFolderOpen={false}
                  onExportTreeNodeTickToggle={toggleExportTreeNode}
                  onExportFolderOpenToggle={toggleExportFolderOpen}
                />
              ))
            )
          ) : exportNoteTree.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-papeliz-ink-subtle">This vault has no notes yet.</p>
          ) : (
            renderExportTreeRows(exportNoteTree, 0)
          )}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-[1.4] text-papeliz-ink-muted">{exportSelectionSummary}</p>

      <PapelizSettingsGearFieldLabel>Format</PapelizSettingsGearFieldLabel>
      <PapelizSlidingChoiceGroup
        slidingChoiceGroupLabel="Format"
        slidingChoiceGroupRole="radiogroup"
        chosenSlidingChoiceValue={chosenExportFormat}
        onSlidingChoiceSelect={setChosenExportFormat}
        slidingChoices={papelizExportFormatChoices.map((exportFormatChoice) => ({
          slidingChoiceValue: exportFormatChoice.exportFormat,
          slidingChoiceContent: exportFormatChoice.exportFormatLabel,
        }))}
      />

      <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={!canExport} onClick={() => void exportTickedNotesAsHtml()} className="mt-3 w-full">
        {isExportRunning ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
        {exportRunState.exportRunKind === 'running'
          ? exportRunState.exportNoteCount > 1
            ? `Exporting ${exportRunState.exportedNoteCount} of ${exportRunState.exportNoteCount}…`
            : 'Exporting…'
          : exportButtonLabel}
      </PapelizPillButton>
      <div role="status" className="mt-1.5 text-center text-[11.5px] text-papeliz-ink-subtle">
        {isExportRunning ? (
          <button type="button" onClick={() => exportAbortControllerRef.current?.abort()} className="font-semibold text-papeliz-blue hover:underline">
            Cancel
          </button>
        ) : (
          exportRunLine !== null && <p className={exportRunState.exportRunKind === 'failed' && chosenExportFormat === 'html' ? 'text-papeliz-error-notice-ink' : ''}>{exportRunLine}</p>
        )}
      </div>
    </div>
  )
}
