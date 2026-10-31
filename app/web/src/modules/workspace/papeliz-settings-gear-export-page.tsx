import { ChevronDown, ChevronRight, Download, FilePen, FileText, Folder, Globe, LoaderCircle, Printer, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { choosePapelizExportDefaultPageSize, type PapelizExportPageSize } from '../export-print-style/papeliz-export-print-style'
import type { PapelizPdfExportLocalFontData } from '../pdf-export/papeliz-pdf-export-computer-fonts'
import { papelizExportPaperSizeSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { describePapelizVaultError, PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { buildThenSavePapelizExportFile, type PapelizExportFileKind } from './papeliz-export-file-save'
import { usePapelizNoteTypographyStore } from './papeliz-note-typography-store'
import {
  buildPapelizExportNoteTree,
  findExportNotesMatchingSearch,
  listExportNoteRelativePaths,
  readExportTreeNodeTickState,
  toggleExportTreeNodeTick,
  type PapelizExportTreeNode,
} from './papeliz-settings-gear-export-note-tree'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// The Settings gear's Export page (papeliz-settings-gear-button.tsx): tick notes in the vault's
// folder tree, pick a format row, press Export. One note downloads as one file; several as one .zip,
// folders kept. Each format's engine loads with `import()` only when someone exports with it.

type PapelizSettingsGearExportFormat = 'word' | 'pdf' | 'html'

interface PapelizSettingsGearExportFormatRow {
  exportFormat: PapelizSettingsGearExportFormat
  exportFormatLabel: string
  exportFormatLine: string
  ExportFormatIcon: typeof FilePen
  // A format whose engine hasn't shipped yet says "Coming soon", and the Export button waits for it.
  isExportFormatReady: boolean
}

const papelizSettingsGearExportFormatRows: readonly PapelizSettingsGearExportFormatRow[] = [
  { exportFormat: 'word', exportFormatLabel: 'Word', exportFormatLine: 'Editable .docx, for Word, Google Docs or Notion', ExportFormatIcon: FilePen, isExportFormatReady: true },
  { exportFormat: 'pdf', exportFormatLabel: 'PDF', exportFormatLine: 'Pages for printing and sharing', ExportFormatIcon: Printer, isExportFormatReady: true },
  { exportFormat: 'html', exportFormatLabel: 'HTML', exportFormatLine: 'A web page; several notes make a website', ExportFormatIcon: Globe, isExportFormatReady: true },
]

// Where an export stands, for the lines under the Export button.
type PapelizSettingsGearExportRunState =
  | { exportRunKind: 'idle' }
  | { exportRunKind: 'running'; exportedNoteCount: number; exportNoteCount: number }
  | { exportRunKind: 'saved'; savedExportFileName: string; isDownloaded: boolean; exportNotices: readonly string[] }
  | { exportRunKind: 'cancelled' }
  | { exportRunKind: 'failed'; exportFailureMessage: string }

// What an export will save, and how its file is built.
interface PapelizSettingsGearPreparedExport {
  exportFileName: string
  exportFileKind: PapelizExportFileKind
  buildExportFile: (
    onExportProgress: (exportedNoteCount: number, exportNoteCount: number) => void,
    exportAbortSignal: AbortSignal,
  ) => Promise<{ exportFileBlob: Blob; exportNotices: readonly string[] }>
}

// The notices shown under a saved export; the rest are counted.
const papelizSettingsGearShownExportNoticeCount = 3

// The paper Word and PDF print on; HTML has no pages.
const papelizSettingsGearExportPaperChoices: ReadonlyArray<{ exportPaperSize: PapelizExportPageSize; exportPaperLabel: string }> = [
  { exportPaperSize: 'letter', exportPaperLabel: 'Letter' },
  { exportPaperSize: 'a4', exportPaperLabel: 'A4' },
]

function isPapelizExportPageSize(storedExportPaperSize: unknown): storedExportPaperSize is PapelizExportPageSize {
  return storedExportPaperSize === 'letter' || storedExportPaperSize === 'a4'
}

// A PDF export waits on this while the page asks whether it may use the computer's fonts.
interface PapelizSettingsGearComputerFontsQuestion {
  pdfExportNoteName: string
  answerComputerFontsQuestion: (localFonts: readonly PapelizPdfExportLocalFontData[] | null) => void
}

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

interface PapelizSettingsGearExportFormatListProps {
  chosenExportFormat: PapelizSettingsGearExportFormat
  onExportFormatSelect: (exportFormat: PapelizSettingsGearExportFormat) => void
}

// The formats as a radio group of rows: an icon, the name and one line about it. As with radio
// buttons, one row takes Tab and the arrow keys choose the next or previous one.
function PapelizSettingsGearExportFormatList({ chosenExportFormat, onExportFormatSelect }: PapelizSettingsGearExportFormatListProps) {
  const exportFormatListId = useId()
  const exportFormatRowButtonsRef = useRef<Array<HTMLButtonElement | null>>([])
  const chosenExportFormatIndex = papelizSettingsGearExportFormatRows.findIndex((exportFormatRow) => exportFormatRow.exportFormat === chosenExportFormat)

  const moveExportFormatChoice = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const lastExportFormatIndex = papelizSettingsGearExportFormatRows.length - 1
    const nextExportFormatIndexByKey: Readonly<Record<string, number>> = {
      ArrowDown: chosenExportFormatIndex === lastExportFormatIndex ? 0 : chosenExportFormatIndex + 1,
      ArrowRight: chosenExportFormatIndex === lastExportFormatIndex ? 0 : chosenExportFormatIndex + 1,
      ArrowUp: chosenExportFormatIndex === 0 ? lastExportFormatIndex : chosenExportFormatIndex - 1,
      ArrowLeft: chosenExportFormatIndex === 0 ? lastExportFormatIndex : chosenExportFormatIndex - 1,
      Home: 0,
      End: lastExportFormatIndex,
    }
    const nextExportFormatIndex = nextExportFormatIndexByKey[keyboardEvent.key]
    const nextExportFormatRow = nextExportFormatIndex === undefined ? undefined : papelizSettingsGearExportFormatRows[nextExportFormatIndex]
    if (nextExportFormatIndex === undefined || nextExportFormatRow === undefined) return
    keyboardEvent.preventDefault()
    onExportFormatSelect(nextExportFormatRow.exportFormat)
    exportFormatRowButtonsRef.current[nextExportFormatIndex]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Format" onKeyDown={moveExportFormatChoice} className="flex flex-col gap-px rounded-xl border border-papeliz-line bg-papeliz-surface p-1">
      {papelizSettingsGearExportFormatRows.map((exportFormatRow, exportFormatIndex) => {
        const isExportFormatChosen = exportFormatRow.exportFormat === chosenExportFormat
        const { ExportFormatIcon } = exportFormatRow
        const exportFormatLineId = `${exportFormatListId}-${exportFormatRow.exportFormat}-line`
        return (
          <button
            key={exportFormatRow.exportFormat}
            ref={(exportFormatRowButton) => {
              exportFormatRowButtonsRef.current[exportFormatIndex] = exportFormatRowButton
            }}
            type="button"
            role="radio"
            aria-checked={isExportFormatChosen}
            // Screen readers say the name, then the line about it.
            aria-label={exportFormatRow.isExportFormatReady ? exportFormatRow.exportFormatLabel : `${exportFormatRow.exportFormatLabel}, coming soon`}
            aria-describedby={exportFormatLineId}
            tabIndex={isExportFormatChosen ? 0 : -1}
            onClick={() => onExportFormatSelect(exportFormatRow.exportFormat)}
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left pointer-coarse:min-h-10 pointer-coarse:py-2 ${
              isExportFormatChosen ? 'bg-papeliz-chosen-row-ground' : 'hover:bg-papeliz-surface-soft'
            } ${exportFormatRow.isExportFormatReady ? '' : 'opacity-55'}`}
          >
            <span
              className={`grid size-[30px] flex-none place-items-center rounded-lg ${isExportFormatChosen ? 'bg-papeliz-surface text-papeliz-blue' : 'bg-papeliz-surface-gray text-papeliz-ink-muted'}`}
            >
              <ExportFormatIcon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 leading-[1.3]">
              <span className={`block text-[13px] font-semibold ${isExportFormatChosen ? 'text-papeliz-chosen-row-ink' : ''}`}>
                {exportFormatRow.exportFormatLabel}
                {!exportFormatRow.isExportFormatReady && (
                  <span aria-hidden="true" className="ml-1.5 inline-flex h-[18px] items-center rounded-full border border-papeliz-blue-line bg-papeliz-blue-soft px-[7px] align-[1px] text-[10.5px] font-semibold text-papeliz-blue">
                    Coming soon
                  </span>
                )}
              </span>
              <span id={exportFormatLineId} className="block text-[11.5px] text-papeliz-ink-subtle">
                {exportFormatRow.exportFormatLine}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`size-4 flex-none rounded-full bg-papeliz-surface ${isExportFormatChosen ? 'border-[5px] border-papeliz-blue' : 'border-[1.5px] border-papeliz-line-strong'}`}
            />
          </button>
        )
      })}
    </div>
  )
}

export function PapelizSettingsGearExportPage() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const vaultEntryOrder = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultEntryOrder)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const saveAllVaultNotesNow = usePapelizWorkspaceStore((workspaceState) => workspaceState.saveAllVaultNotesNow)
  const noteFontFamily = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontFamily)
  const noteFontSize = usePapelizNoteTypographyStore((typographyState) => typographyState.noteFontSize)
  const noteColumnWidth = usePapelizNoteTypographyStore((typographyState) => typographyState.noteColumnWidth)
  const [exportRunState, setExportRunState] = useState<PapelizSettingsGearExportRunState>({ exportRunKind: 'idle' })
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
  const [chosenExportFormat, setChosenExportFormat] = useState<PapelizSettingsGearExportFormat>('word')
  const [computerFontsQuestion, setComputerFontsQuestion] = useState<PapelizSettingsGearComputerFontsQuestion | null>(null)
  // The region's paper until the person picks one, which is then remembered.
  const [exportPaperSize, setExportPaperSize] = useState<PapelizExportPageSize>(() => choosePapelizExportDefaultPageSize(navigator.languages))
  const hasChosenExportPaperSizeRef = useRef(false)
  useEffect(() => {
    let isPaperSettingWanted = true
    void readPapelizUserSetting<unknown>(papelizExportPaperSizeSettingName, null).then((storedExportPaperSize) => {
      if (isPaperSettingWanted && !hasChosenExportPaperSizeRef.current && isPapelizExportPageSize(storedExportPaperSize)) setExportPaperSize(storedExportPaperSize)
    })
    return () => {
      isPaperSettingWanted = false
    }
  }, [])
  const chooseExportPaperSize = (chosenExportPaperSize: PapelizExportPageSize) => {
    hasChosenExportPaperSizeRef.current = true
    setExportPaperSize(chosenExportPaperSize)
    void writePapelizUserSetting(papelizExportPaperSizeSettingName, chosenExportPaperSize)
  }

  // Ticks that still name a note in the vault (one may have been renamed or trashed meanwhile).
  const tickedExportNoteCount = everyExportNoteRelativePath.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath)).length
  const isEveryExportNoteTicked = everyExportNoteRelativePath.length > 0 && tickedExportNoteCount === everyExportNoteRelativePath.length
  const exportNoteSearchMatches = findExportNotesMatchingSearch(exportNoteTree, exportNoteSearchText)
  const isExportNoteSearchOn = exportNoteSearchText.trim() !== ''
  const chosenExportFormatRow =
    papelizSettingsGearExportFormatRows.find((exportFormatRow) => exportFormatRow.exportFormat === chosenExportFormat) ?? papelizSettingsGearExportFormatRows[0]
  const chosenExportFormatLabel = chosenExportFormatRow?.exportFormatLabel ?? ''
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
  const isChosenExportFormatReady = chosenExportFormatRow?.isExportFormatReady === true
  const canExport = isChosenExportFormatReady && tickedExportNoteCount > 0 && openVault !== null && !isExportRunning

  // Loads the chosen format's engine and says what it will save.
  const prepareChosenExport = async (exportVaultNoteRelativePaths: readonly string[]): Promise<PapelizSettingsGearPreparedExport | null> => {
    if (openVault === null) return null
    const { papelizVaultAdapter, papelizVaultDisplayName } = openVault
    if (chosenExportFormat === 'word') {
      const docxExportModule = await import('../docx-export/papeliz-docx-export')
      const docxExportFileKind = docxExportModule.describePapelizDocxExportFile(papelizVaultDisplayName, exportVaultNoteRelativePaths)
      return {
        exportFileName: docxExportFileKind.docxExportFileName,
        exportFileKind: {
          exportFileDescription: docxExportFileKind.docxExportFileDescription,
          exportFileMediaType: docxExportFileKind.docxExportFileMediaType,
          exportFileExtension: docxExportFileKind.docxExportFileExtension,
        },
        buildExportFile: async (onExportProgress, exportAbortSignal) => {
          const { docxExportFileBlob, docxExportNotices } = await docxExportModule.exportPapelizNotesAsDocx({
            docxExportVault: { vaultAdapter: papelizVaultAdapter, vaultDisplayName: papelizVaultDisplayName },
            docxExportVaultNoteRelativePaths: exportVaultNoteRelativePaths,
            docxExportEveryVaultNoteRelativePath: everyExportNoteRelativePath,
            docxExportPageSize: exportPaperSize,
            docxExportNoteFontFamily: noteFontFamily,
            onDocxExportProgress: onExportProgress,
            docxExportAbortSignal: exportAbortSignal,
          })
          return { exportFileBlob: docxExportFileBlob, exportNotices: docxExportNotices }
        },
      }
    }
    if (chosenExportFormat === 'pdf') {
      const pdfExportModule = await import('../pdf-export/papeliz-pdf-export')
      const pdfExportFileKind = pdfExportModule.describePapelizPdfExportFile(papelizVaultDisplayName, exportVaultNoteRelativePaths)
      return {
        exportFileName: pdfExportFileKind.pdfExportFileName,
        exportFileKind: {
          exportFileDescription: pdfExportFileKind.pdfExportFileDescription,
          exportFileMediaType: pdfExportFileKind.pdfExportFileMediaType,
          exportFileExtension: pdfExportFileKind.pdfExportFileExtension,
        },
        buildExportFile: async (onExportProgress, exportAbortSignal) => {
          try {
            const { pdfExportFileBlob, pdfExportNotices } = await pdfExportModule.exportPapelizNotesAsPdf({
              pdfExportVault: { vaultAdapter: papelizVaultAdapter, vaultDisplayName: papelizVaultDisplayName },
              pdfExportVaultNoteRelativePaths: exportVaultNoteRelativePaths,
              pdfExportEveryVaultNoteRelativePath: everyExportNoteRelativePath,
              pdfExportPageSize: exportPaperSize,
              pdfExportNoteFontFamily: noteFontFamily,
              onPdfExportProgress: onExportProgress,
              pdfExportAbortSignal: exportAbortSignal,
              // Asked once per export, and only for a note with characters Papeliz's fonts lack.
              askPdfExportComputerFonts: (pdfExportNoteName) =>
                new Promise((resolveComputerFonts) => {
                  const answerComputerFontsQuestion = (localFonts: readonly PapelizPdfExportLocalFontData[] | null) => {
                    setComputerFontsQuestion(null)
                    resolveComputerFonts(localFonts)
                  }
                  exportAbortSignal.addEventListener('abort', () => answerComputerFontsQuestion(null), { once: true })
                  setComputerFontsQuestion({ pdfExportNoteName, answerComputerFontsQuestion })
                }),
            })
            return { exportFileBlob: pdfExportFileBlob, exportNotices: pdfExportNotices }
          } catch (pdfExportError) {
            // The PDF export's own plain line shows as it is.
            if (pdfExportError instanceof pdfExportModule.PapelizPdfExportError) throw new PapelizVaultOperationError(pdfExportError.message)
            throw pdfExportError
          }
        },
      }
    }
    if (chosenExportFormat === 'html') {
      const htmlExportModule = await import('../html-export/papeliz-html-export-from-vault')
      const htmlExportFileKind = htmlExportModule.describePapelizVaultHtmlExportFile(papelizVaultDisplayName, exportVaultNoteRelativePaths)
      return {
        exportFileName: htmlExportFileKind.htmlExportFileName,
        exportFileKind: {
          exportFileDescription: htmlExportFileKind.htmlExportFileDescription,
          exportFileMediaType: htmlExportFileKind.htmlExportFileMediaType,
          exportFileExtension: htmlExportFileKind.htmlExportFileExtension,
        },
        buildExportFile: async (onExportProgress, exportAbortSignal) => {
          const { htmlExportFileBlob } = await htmlExportModule.exportPapelizVaultNotesAsHtml({
            vaultAdapter: papelizVaultAdapter,
            vaultDisplayName: papelizVaultDisplayName,
            exportVaultNoteRelativePaths: [...exportVaultNoteRelativePaths],
            everyVaultNoteRelativePath: everyExportNoteRelativePath,
            htmlExportNoteTypography: { noteFontFamily, noteFontSize, noteColumnWidth },
            onHtmlExportProgress: onExportProgress,
            htmlExportAbortSignal: exportAbortSignal,
          })
          return { exportFileBlob: htmlExportFileBlob, exportNotices: [] }
        },
      }
    }
    return null
  }

  const exportTickedNotes = async () => {
    const exportVaultNoteRelativePaths = everyExportNoteRelativePath.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath))
    const preparedExport = await prepareChosenExport(exportVaultNoteRelativePaths)
    if (preparedExport === null) return
    const exportAbortController = new AbortController()
    exportAbortControllerRef.current = exportAbortController
    setExportRunState({ exportRunKind: 'running', exportedNoteCount: 0, exportNoteCount: exportVaultNoteRelativePaths.length })
    try {
      // The file is built before the save dialog opens, so Cancel or a failure saves nothing.
      const { builtExport, exportFileSaveOutcome } = await buildThenSavePapelizExportFile(preparedExport.exportFileName, preparedExport.exportFileKind, async () => {
        // Edits still waiting for autosave go into the export too.
        await saveAllVaultNotesNow()
        const builtExportFile = await preparedExport.buildExportFile(
          (exportedNoteCount, exportNoteCount) => setExportRunState({ exportRunKind: 'running', exportedNoteCount, exportNoteCount }),
          exportAbortController.signal,
        )
        exportAbortController.signal.throwIfAborted()
        return builtExportFile
      })
      setExportRunState(
        exportFileSaveOutcome === 'save-dialog-closed'
          ? { exportRunKind: 'cancelled' }
          : {
              exportRunKind: 'saved',
              savedExportFileName: preparedExport.exportFileName,
              isDownloaded: exportFileSaveOutcome === 'downloaded',
              exportNotices: builtExport.exportNotices,
            },
      )
    } catch (exportError) {
      setExportRunState(
        exportAbortController.signal.aborted ? { exportRunKind: 'cancelled' } : { exportRunKind: 'failed', exportFailureMessage: describePapelizVaultError(exportError) },
      )
    } finally {
      if (exportAbortControllerRef.current === exportAbortController) exportAbortControllerRef.current = null
    }
  }

  // The browser asks for its own permission only right after a click, so the fonts are listed here.
  const answerWithComputerFonts = async () => {
    if (computerFontsQuestion === null) return
    const pageWithLocalFonts = window as Window & { queryLocalFonts?: () => Promise<readonly PapelizPdfExportLocalFontData[]> }
    try {
      computerFontsQuestion.answerComputerFontsQuestion((await pageWithLocalFonts.queryLocalFonts?.()) ?? null)
    } catch {
      computerFontsQuestion.answerComputerFontsQuestion(null)
    }
  }

  const exportRunLine = !isChosenExportFormatReady
    ? `${chosenExportFormatLabel} export is coming soon.`
    : exportRunState.exportRunKind === 'saved'
      ? `${exportRunState.isDownloaded ? 'Downloaded' : 'Saved'} “${exportRunState.savedExportFileName}”.`
      : exportRunState.exportRunKind === 'cancelled'
        ? 'Export cancelled.'
        : exportRunState.exportRunKind === 'failed'
          ? `The export stopped: ${exportRunState.exportFailureMessage}.`
          : null
  const exportNotices = isChosenExportFormatReady && exportRunState.exportRunKind === 'saved' ? exportRunState.exportNotices : []
  const hiddenExportNoticeCount = exportNotices.length - papelizSettingsGearShownExportNoticeCount

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

      <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Format</p>
      <PapelizSettingsGearExportFormatList chosenExportFormat={chosenExportFormat} onExportFormatSelect={setChosenExportFormat} />

      {chosenExportFormat !== 'html' && (
        <>
          <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Paper</p>
          <PapelizSlidingChoiceGroup
            slidingChoiceGroupLabel="Paper"
            slidingChoiceGroupRole="radiogroup"
            chosenSlidingChoiceValue={exportPaperSize}
            onSlidingChoiceSelect={chooseExportPaperSize}
            slidingChoices={papelizSettingsGearExportPaperChoices.map(({ exportPaperSize: paperChoiceSize, exportPaperLabel }) => ({
              slidingChoiceValue: paperChoiceSize,
              slidingChoiceContent: exportPaperLabel,
            }))}
          />
        </>
      )}

      <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={!canExport} onClick={() => void exportTickedNotes()} className="mt-3 w-full pointer-coarse:h-10">
        {isExportRunning ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
        {exportRunState.exportRunKind === 'running'
          ? exportRunState.exportNoteCount > 1
            ? `Exporting ${exportRunState.exportedNoteCount} of ${exportRunState.exportNoteCount}…`
            : 'Exporting…'
          : exportButtonLabel}
      </PapelizPillButton>
      {isExportRunning && computerFontsQuestion !== null && (
        <div className="mt-2 rounded-xl border border-papeliz-line bg-papeliz-surface p-2.5 text-[12px] leading-[1.45] text-papeliz-ink-muted">
          <p>
            “{computerFontsQuestion.pdfExportNoteName}” has characters Papeliz’s own fonts don’t have. To put these characters in the PDF as text, Papeliz can use fonts on
            this computer. Nothing leaves your computer.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => void answerWithComputerFonts()} className="pointer-coarse:h-10">
              Use this computer’s fonts
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => computerFontsQuestion.answerComputerFontsQuestion(null)} className="pointer-coarse:h-10">
              Print them as pictures
            </PapelizPillButton>
          </div>
        </div>
      )}
      <div role="status" className="mt-1.5 text-center text-[11.5px] text-papeliz-ink-subtle">
        {isExportRunning ? (
          <button type="button" onClick={() => exportAbortControllerRef.current?.abort()} className="font-semibold text-papeliz-blue hover:underline">
            Cancel
          </button>
        ) : (
          exportRunLine !== null && <p className={exportRunState.exportRunKind === 'failed' && isChosenExportFormatReady ? 'text-papeliz-error-notice-ink' : ''}>{exportRunLine}</p>
        )}
        {!isExportRunning && exportNotices.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5 text-left leading-[1.4] text-papeliz-ink-muted">
            {exportNotices.slice(0, papelizSettingsGearShownExportNoticeCount).map((exportNotice) => (
              <li key={exportNotice}>{exportNotice}</li>
            ))}
            {hiddenExportNoticeCount > 0 && <li>{hiddenExportNoticeCount === 1 ? 'And 1 more notice like these.' : `And ${hiddenExportNoticeCount} more notices like these.`}</li>}
          </ul>
        )}
      </div>
    </div>
  )
}
