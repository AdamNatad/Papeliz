import { ChevronDown, ChevronRight, Download, FilePen, FileText, Folder, Globe, LayoutTemplate, LoaderCircle, Printer, Search, Settings } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  choosePapelizExportDefaultPageSize,
  isPapelizExportCustomPageSideInRange,
  isPapelizExportPresetPageSize,
  papelizExportCustomPageSideRangePoints,
  papelizExportPresetPageSizesInPoints,
  type PapelizExportCustomPageSize,
  type PapelizExportPageSize,
  type PapelizExportPresetPageSize,
} from '../export-print-style/papeliz-export-print-style'
import type { PapelizPdfExportLocalFontData } from '../pdf-export/papeliz-pdf-export-computer-fonts'
import {
  papelizExportPaperSizeSettingName,
  papelizTemplateExportSettingsSettingName,
  readPapelizUserSetting,
  writePapelizUserSetting,
} from '../settings/papeliz-user-settings'
import { findPapelizTemplateExportDetailsProblem } from '../template-gallery/papeliz-template-export-details'
import { papelizTemplateCategoryTags, papelizTemplateLicenseIds } from '../template-gallery/papeliz-template-gallery-contract'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { describePapelizErrorSentence } from '../vault/papeliz-failure-code-words'
import { PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { buildThenSavePapelizExportFile, type PapelizExportFileKind } from './papeliz-export-file-save'
import { PapelizSettingsGearExportFormatSettingsDialog } from './papeliz-settings-gear-export-format-settings-dialog'
import { PapelizSettingsGearExportTemplateSettings, type PapelizSettingsGearTemplateExportSettings } from './papeliz-settings-gear-export-template-settings'
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
// folder tree, pick a format row (its gear opens its settings in a dialog), press Export. One note
// downloads as one file; several as one .zip, folders kept (a template is always a .zip). Each format's engine loads with `import()` only when
// someone exports with it.

type PapelizSettingsGearExportFormat = 'word' | 'pdf' | 'html' | 'template'

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
  {
    exportFormat: 'template',
    exportFormatLabel: 'Template',
    exportFormatLine: 'A folder others can start a vault from',
    ExportFormatIcon: LayoutTemplate,
    isExportFormatReady: true,
  },
]

// The one file a single note downloads as, named in the summary under the tree.
const papelizSettingsGearExportFormatOneNoteFileExtensions: Record<PapelizSettingsGearExportFormat, string> = {
  word: '.docx',
  pdf: '.pdf',
  html: '.html',
  template: '.zip',
}

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

// The paper Word and PDF print on (HTML has no pages): the sizes Google Docs offers, in its order,
// then Custom, a width and height of the person's own.
type PapelizSettingsGearExportPaperChoice = PapelizExportPresetPageSize | 'custom'
type PapelizSettingsGearExportCustomPaperUnit = 'in' | 'mm'

const papelizSettingsGearExportPresetPaperRows: ReadonlyArray<{
  exportPresetPaperSize: PapelizExportPresetPageSize
  exportPaperLabel: string
  exportPaperUnit: PapelizSettingsGearExportCustomPaperUnit
}> = [
  { exportPresetPaperSize: 'letter', exportPaperLabel: 'Letter', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'tabloid', exportPaperLabel: 'Tabloid', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'legal', exportPaperLabel: 'Legal', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'statement', exportPaperLabel: 'Statement', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'executive', exportPaperLabel: 'Executive', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'folio', exportPaperLabel: 'Folio', exportPaperUnit: 'in' },
  { exportPresetPaperSize: 'a3', exportPaperLabel: 'A3', exportPaperUnit: 'mm' },
  { exportPresetPaperSize: 'a4', exportPaperLabel: 'A4', exportPaperUnit: 'mm' },
  { exportPresetPaperSize: 'a5', exportPaperLabel: 'A5', exportPaperUnit: 'mm' },
  { exportPresetPaperSize: 'b4', exportPaperLabel: 'B4', exportPaperUnit: 'mm' },
  { exportPresetPaperSize: 'b5', exportPaperLabel: 'B5', exportPaperUnit: 'mm' },
]

const papelizSettingsGearExportPointsPerCustomPaperUnit: Record<PapelizSettingsGearExportCustomPaperUnit, number> = { in: 72, mm: 72 / 25.4 }

// "8.5", "215.9": a page side in a unit, to two decimals in inches and one in millimeters.
function formatExportPaperSide(pageSidePoints: number, exportPaperUnit: PapelizSettingsGearExportCustomPaperUnit): string {
  const sideDecimalScale = exportPaperUnit === 'in' ? 100 : 10
  return String(Math.round((pageSidePoints / papelizSettingsGearExportPointsPerCustomPaperUnit[exportPaperUnit]) * sideDecimalScale) / sideDecimalScale)
}

function describePresetPaperDimensions(exportPresetPaperSize: PapelizExportPresetPageSize, exportPaperUnit: PapelizSettingsGearExportCustomPaperUnit): string {
  const { pageWidthPoints, pageHeightPoints } = papelizExportPresetPageSizesInPoints[exportPresetPaperSize]
  return `${formatExportPaperSide(pageWidthPoints, exportPaperUnit)} × ${formatExportPaperSide(pageHeightPoints, exportPaperUnit)} ${exportPaperUnit}`
}

// Word's and PDF's settings list every paper, each with its size, then Custom.
const papelizSettingsGearExportPaperOptions: ReadonlyArray<{ exportPaperChoice: PapelizSettingsGearExportPaperChoice; exportPaperLabel: string; exportPaperDimensionsNote: string }> = [
  ...papelizSettingsGearExportPresetPaperRows.map((presetPaperRow) => ({
    exportPaperChoice: presetPaperRow.exportPresetPaperSize,
    exportPaperLabel: presetPaperRow.exportPaperLabel,
    exportPaperDimensionsNote: describePresetPaperDimensions(presetPaperRow.exportPresetPaperSize, presetPaperRow.exportPaperUnit),
  })),
  { exportPaperChoice: 'custom', exportPaperLabel: 'Custom', exportPaperDimensionsNote: 'Your own size' },
]

// A custom paper as typed: each side as written, and their unit.
interface PapelizSettingsGearExportCustomPaper {
  customPaperWidthText: string
  customPaperHeightText: string
  customPaperUnit: PapelizSettingsGearExportCustomPaperUnit
}

// The remembered paper: a named size, or a custom one in its unit.
type PapelizSettingsGearStoredExportPaper =
  | PapelizExportPresetPageSize
  | { exportCustomPaperWidth: number; exportCustomPaperHeight: number; exportCustomPaperUnit: PapelizSettingsGearExportCustomPaperUnit }

function isPapelizSettingsGearStoredExportPaper(storedExportPaper: unknown): storedExportPaper is PapelizSettingsGearStoredExportPaper {
  if (isPapelizExportPresetPageSize(storedExportPaper)) return true
  if (typeof storedExportPaper !== 'object' || storedExportPaper === null) return false
  const { exportCustomPaperWidth, exportCustomPaperHeight, exportCustomPaperUnit } = storedExportPaper as Record<string, unknown>
  return typeof exportCustomPaperWidth === 'number' && typeof exportCustomPaperHeight === 'number' && (exportCustomPaperUnit === 'in' || exportCustomPaperUnit === 'mm')
}

// A typed side in points, or null when it isn't a plain number ("8.5", "8,5" and "210" are).
function readExportCustomPaperSidePoints(customPaperSideText: string, customPaperUnit: PapelizSettingsGearExportCustomPaperUnit): number | null {
  const customPaperSideNumberText = customPaperSideText.trim().replace(',', '.')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(customPaperSideNumberText)) return null
  return Number(customPaperSideNumberText) * papelizSettingsGearExportPointsPerCustomPaperUnit[customPaperUnit]
}

// The custom paper's page, or null while a side is missing or out of range.
function readExportCustomPaperPageSize(exportCustomPaper: PapelizSettingsGearExportCustomPaper): PapelizExportCustomPageSize | null {
  const customPageWidthPoints = readExportCustomPaperSidePoints(exportCustomPaper.customPaperWidthText, exportCustomPaper.customPaperUnit)
  const customPageHeightPoints = readExportCustomPaperSidePoints(exportCustomPaper.customPaperHeightText, exportCustomPaper.customPaperUnit)
  if (customPageWidthPoints === null || customPageHeightPoints === null) return null
  if (!isPapelizExportCustomPageSideInRange(customPageWidthPoints) || !isPapelizExportCustomPageSideInRange(customPageHeightPoints)) return null
  return { customPageWidthPoints, customPageHeightPoints }
}

// Custom starts as the named paper shown before it, in that paper's own unit.
function startExportCustomPaperFrom(exportPresetPaperSize: PapelizExportPresetPageSize): PapelizSettingsGearExportCustomPaper {
  const customPaperUnit =
    papelizSettingsGearExportPresetPaperRows.find((presetPaperRow) => presetPaperRow.exportPresetPaperSize === exportPresetPaperSize)?.exportPaperUnit ?? 'mm'
  const { pageWidthPoints, pageHeightPoints } = papelizExportPresetPageSizesInPoints[exportPresetPaperSize]
  return {
    customPaperWidthText: formatExportPaperSide(pageWidthPoints, customPaperUnit),
    customPaperHeightText: formatExportPaperSide(pageHeightPoints, customPaperUnit),
    customPaperUnit,
  }
}

// "Each side from 3 to 22 in." in the unit typed.
function describeExportCustomPaperSideRange(customPaperUnit: PapelizSettingsGearExportCustomPaperUnit): string {
  const { smallestPageSidePoints, largestPageSidePoints } = papelizExportCustomPageSideRangePoints
  return `Each side from ${formatExportPaperSide(smallestPageSidePoints, customPaperUnit)} to ${formatExportPaperSide(largestPageSidePoints, customPaperUnit)} ${customPaperUnit}.`
}

// Export › Template's settings, kept per vault so the next export starts from them.
type PapelizSettingsGearStoredTemplateExportSettings = Record<string, PapelizSettingsGearTemplateExportSettings>

function createPapelizSettingsGearTemplateExportSettings(vaultDisplayName: string): PapelizSettingsGearTemplateExportSettings {
  return {
    templateExportName: vaultDisplayName,
    templateExportDescription: '',
    templateExportCategoryTag: null,
    templateExportFirstNotePath: null,
    templateExportLicenseId: 'MIT',
    templateExportOptionalNoteRelativePaths: [],
  }
}

function readStoredTemplateExportSettings(storedTemplateExportSettings: unknown, vaultDisplayName: string): PapelizSettingsGearTemplateExportSettings | null {
  if (typeof storedTemplateExportSettings !== 'object' || storedTemplateExportSettings === null) return null
  const storedSettingFields = storedTemplateExportSettings as Record<string, unknown>
  const startingSettings = createPapelizSettingsGearTemplateExportSettings(vaultDisplayName)
  const readStoredText = (storedFieldValue: unknown, fallbackText: string) => (typeof storedFieldValue === 'string' ? storedFieldValue : fallbackText)
  return {
    templateExportName: readStoredText(storedSettingFields['templateExportName'], startingSettings.templateExportName),
    templateExportDescription: readStoredText(storedSettingFields['templateExportDescription'], ''),
    templateExportCategoryTag: papelizTemplateCategoryTags.find((categoryTag) => categoryTag === storedSettingFields['templateExportCategoryTag']) ?? null,
    templateExportFirstNotePath: typeof storedSettingFields['templateExportFirstNotePath'] === 'string' ? storedSettingFields['templateExportFirstNotePath'] : null,
    templateExportLicenseId: papelizTemplateLicenseIds.find((licenseId) => licenseId === storedSettingFields['templateExportLicenseId']) ?? 'MIT',
    templateExportOptionalNoteRelativePaths: Array.isArray(storedSettingFields['templateExportOptionalNoteRelativePaths'])
      ? storedSettingFields['templateExportOptionalNoteRelativePaths'].filter((optionalNotePath): optionalNotePath is string => typeof optionalNotePath === 'string')
      : [],
  }
}

// A failed export's line: "The export stopped.", then why as a sentence of its own, capitalized and
// ending in one full stop (the PDF export's own reasons start lowercase and have none).
function describeExportFailureLine(exportFailureMessage: string): string {
  const exportFailureSentence = exportFailureMessage.charAt(0).toUpperCase() + exportFailureMessage.slice(1)
  return `The export stopped. ${exportFailureSentence}${/[.!?…]$/.test(exportFailureSentence) ? '' : '.'}`
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

// The formats with settings of their own, opened by the gear on their row. HTML has none: it follows
// the Accessibility page's font, text size and width.
const papelizSettingsGearExportFormatsWithSettings: ReadonlySet<PapelizSettingsGearExportFormat> = new Set(['word', 'pdf', 'template'])

interface PapelizSettingsGearExportFormatListProps {
  chosenExportFormat: PapelizSettingsGearExportFormat
  onExportFormatSelect: (exportFormat: PapelizSettingsGearExportFormat) => void
  // Beside a format's name: what its settings are set to ("A4").
  exportFormatSettingsSummaries: Partial<Record<PapelizSettingsGearExportFormat, string>>
  onExportFormatSettingsOpen: (exportFormat: PapelizSettingsGearExportFormat) => void
}

// The formats as a radio group of rows: an icon, the name and one line about it, and for a format
// with settings, a gear that picks it and opens them. As with radio buttons, one row takes Tab and
// the arrow keys choose the next or previous one; each gear takes Tab of its own.
function PapelizSettingsGearExportFormatList({ chosenExportFormat, onExportFormatSelect, exportFormatSettingsSummaries, onExportFormatSettingsOpen }: PapelizSettingsGearExportFormatListProps) {
  const exportFormatListId = useId()
  const exportFormatRowButtonsRef = useRef<Array<HTMLButtonElement | null>>([])
  const chosenExportFormatIndex = papelizSettingsGearExportFormatRows.findIndex((exportFormatRow) => exportFormatRow.exportFormat === chosenExportFormat)

  const moveExportFormatChoice = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (!(keyboardEvent.target instanceof HTMLElement) || keyboardEvent.target.getAttribute('role') !== 'radio') return
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
        const hasExportFormatSettings = papelizSettingsGearExportFormatsWithSettings.has(exportFormatRow.exportFormat)
        const exportFormatSettingsSummary = exportFormatSettingsSummaries[exportFormatRow.exportFormat]
        return (
          <div key={exportFormatRow.exportFormat} className="relative">
            <button
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
              <span className={`min-w-0 flex-1 leading-[1.3] ${hasExportFormatSettings ? 'mr-7' : ''}`}>
                <span className={`block text-[13px] font-semibold ${isExportFormatChosen ? 'text-papeliz-chosen-row-ink' : ''}`}>
                  {exportFormatRow.exportFormatLabel}
                  {exportFormatSettingsSummary !== undefined && <span className="ml-1.5 text-[11.5px] font-normal text-papeliz-ink-subtle">{exportFormatSettingsSummary}</span>}
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
            {hasExportFormatSettings && (
              <button
                type="button"
                aria-label={`${exportFormatRow.exportFormatLabel} Settings`}
                title={`${exportFormatRow.exportFormatLabel} Settings`}
                onClick={() => {
                  onExportFormatSelect(exportFormatRow.exportFormat)
                  onExportFormatSettingsOpen(exportFormatRow.exportFormat)
                }}
                className="absolute top-1/2 right-[30px] grid size-7 -translate-y-1/2 place-items-center rounded-lg text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink focus-visible:outline-2 focus-visible:outline-papeliz-blue"
              >
                <Settings className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
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
  const [exportPaperChoice, setExportPaperChoice] = useState<PapelizSettingsGearExportPaperChoice>(() => choosePapelizExportDefaultPageSize(navigator.languages))
  const [exportCustomPaper, setExportCustomPaper] = useState<PapelizSettingsGearExportCustomPaper>(() =>
    startExportCustomPaperFrom(choosePapelizExportDefaultPageSize(navigator.languages)),
  )
  const hasChosenExportPaperRef = useRef(false)
  const exportPaperLabelId = useId()
  const exportPaperRadioGroupName = useId()
  useEffect(() => {
    let isPaperSettingWanted = true
    void readPapelizUserSetting<unknown>(papelizExportPaperSizeSettingName, null).then((storedExportPaper) => {
      if (!isPaperSettingWanted || hasChosenExportPaperRef.current || !isPapelizSettingsGearStoredExportPaper(storedExportPaper)) return
      if (typeof storedExportPaper === 'string') {
        setExportPaperChoice(storedExportPaper)
        return
      }
      setExportCustomPaper({
        customPaperWidthText: String(storedExportPaper.exportCustomPaperWidth),
        customPaperHeightText: String(storedExportPaper.exportCustomPaperHeight),
        customPaperUnit: storedExportPaper.exportCustomPaperUnit,
      })
      setExportPaperChoice('custom')
    })
    return () => {
      isPaperSettingWanted = false
    }
  }, [])
  // A custom paper is remembered once both sides fit.
  const rememberExportCustomPaper = (changedExportCustomPaper: PapelizSettingsGearExportCustomPaper) => {
    hasChosenExportPaperRef.current = true
    if (readExportCustomPaperPageSize(changedExportCustomPaper) === null) return
    void writePapelizUserSetting(papelizExportPaperSizeSettingName, {
      exportCustomPaperWidth: Number(changedExportCustomPaper.customPaperWidthText.trim().replace(',', '.')),
      exportCustomPaperHeight: Number(changedExportCustomPaper.customPaperHeightText.trim().replace(',', '.')),
      exportCustomPaperUnit: changedExportCustomPaper.customPaperUnit,
    } satisfies PapelizSettingsGearStoredExportPaper)
  }
  const chooseExportPaper = (chosenExportPaperChoice: PapelizSettingsGearExportPaperChoice) => {
    hasChosenExportPaperRef.current = true
    if (chosenExportPaperChoice !== 'custom') {
      setExportPaperChoice(chosenExportPaperChoice)
      void writePapelizUserSetting(papelizExportPaperSizeSettingName, chosenExportPaperChoice satisfies PapelizSettingsGearStoredExportPaper)
      return
    }
    const startingExportCustomPaper = exportPaperChoice === 'custom' ? exportCustomPaper : startExportCustomPaperFrom(exportPaperChoice)
    setExportCustomPaper(startingExportCustomPaper)
    setExportPaperChoice('custom')
    rememberExportCustomPaper(startingExportCustomPaper)
  }
  const changeExportCustomPaper = (changedExportCustomPaper: PapelizSettingsGearExportCustomPaper) => {
    setExportCustomPaper(changedExportCustomPaper)
    rememberExportCustomPaper(changedExportCustomPaper)
  }
  // Switching the unit converts both sides when they read as numbers.
  const changeExportCustomPaperUnit = (chosenCustomPaperUnit: PapelizSettingsGearExportCustomPaperUnit) => {
    const customPageWidthPoints = readExportCustomPaperSidePoints(exportCustomPaper.customPaperWidthText, exportCustomPaper.customPaperUnit)
    const customPageHeightPoints = readExportCustomPaperSidePoints(exportCustomPaper.customPaperHeightText, exportCustomPaper.customPaperUnit)
    changeExportCustomPaper({
      customPaperWidthText: customPageWidthPoints === null ? exportCustomPaper.customPaperWidthText : formatExportPaperSide(customPageWidthPoints, chosenCustomPaperUnit),
      customPaperHeightText: customPageHeightPoints === null ? exportCustomPaper.customPaperHeightText : formatExportPaperSide(customPageHeightPoints, chosenCustomPaperUnit),
      customPaperUnit: chosenCustomPaperUnit,
    })
  }
  // What Word and the PDF print on; null while a custom side is missing or out of range.
  const exportPaperSize: PapelizExportPageSize | null = exportPaperChoice === 'custom' ? readExportCustomPaperPageSize(exportCustomPaper) : exportPaperChoice
  const isExportPaperChosen = (chosenExportFormat !== 'word' && chosenExportFormat !== 'pdf') || exportPaperSize !== null

  // Template: its settings for this vault, and whether their page is open over this one.
  const openVaultId = openVault?.papelizVaultId ?? null
  const openVaultDisplayName = openVault?.papelizVaultDisplayName ?? ''
  const [templateExportSettings, setTemplateExportSettings] = useState<PapelizSettingsGearTemplateExportSettings>(() =>
    createPapelizSettingsGearTemplateExportSettings(openVaultDisplayName),
  )
  // The format whose settings dialog is open, if any.
  const [openedExportFormatSettings, setOpenedExportFormatSettings] = useState<PapelizSettingsGearExportFormat | null>(null)
  const hasChangedTemplateExportSettingsRef = useRef(false)
  useEffect(() => {
    if (openVaultId === null) return
    let isTemplateSettingWanted = true
    void readPapelizUserSetting<unknown>(papelizTemplateExportSettingsSettingName, null).then((storedTemplateExportSettingsByVaultId) => {
      if (!isTemplateSettingWanted || hasChangedTemplateExportSettingsRef.current || typeof storedTemplateExportSettingsByVaultId !== 'object' || storedTemplateExportSettingsByVaultId === null) return
      const storedTemplateExportSettings = readStoredTemplateExportSettings((storedTemplateExportSettingsByVaultId as Record<string, unknown>)[openVaultId], openVaultDisplayName)
      if (storedTemplateExportSettings !== null) setTemplateExportSettings(storedTemplateExportSettings)
    })
    return () => {
      isTemplateSettingWanted = false
    }
  }, [openVaultId, openVaultDisplayName])
  const changeTemplateExportSettings = (changedTemplateExportSettings: PapelizSettingsGearTemplateExportSettings) => {
    hasChangedTemplateExportSettingsRef.current = true
    setTemplateExportSettings(changedTemplateExportSettings)
    if (openVaultId === null) return
    void readPapelizUserSetting<unknown>(papelizTemplateExportSettingsSettingName, null).then((storedTemplateExportSettingsByVaultId) => {
      const storedSettingsByVaultId: PapelizSettingsGearStoredTemplateExportSettings =
        typeof storedTemplateExportSettingsByVaultId === 'object' && storedTemplateExportSettingsByVaultId !== null
          ? (storedTemplateExportSettingsByVaultId as PapelizSettingsGearStoredTemplateExportSettings)
          : {}
      void writePapelizUserSetting(papelizTemplateExportSettingsSettingName, { ...storedSettingsByVaultId, [openVaultId]: changedTemplateExportSettings })
    })
  }

  // Ticks that still name a note in the vault (one may have been renamed or trashed meanwhile).
  const tickedExportNoteRelativePaths = everyExportNoteRelativePath.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath))
  const tickedExportNoteCount = tickedExportNoteRelativePaths.length
  // The note the template opens first: the one set, while it is ticked; else the open note; else the first ticked.
  const shownTemplateFirstNotePath =
    [templateExportSettings.templateExportFirstNotePath, activeVaultNoteRelativePath].find(
      (firstNoteCandidatePath): firstNoteCandidatePath is string => firstNoteCandidatePath !== null && tickedVaultNoteRelativePaths.has(firstNoteCandidatePath),
    ) ??
    tickedExportNoteRelativePaths[0] ??
    null
  const templateExportDetailsProblem = findPapelizTemplateExportDetailsProblem({ ...templateExportSettings, templateExportFirstNotePath: shownTemplateFirstNotePath })
  const isEveryExportNoteTicked = everyExportNoteRelativePath.length > 0 && tickedExportNoteCount === everyExportNoteRelativePath.length
  const exportNoteSearchMatches = findExportNotesMatchingSearch(exportNoteTree, exportNoteSearchText)
  const isExportNoteSearchOn = exportNoteSearchText.trim() !== ''
  const chosenExportFormatRow =
    papelizSettingsGearExportFormatRows.find((exportFormatRow) => exportFormatRow.exportFormat === chosenExportFormat) ?? papelizSettingsGearExportFormatRows[0]
  const chosenExportFormatLabel = chosenExportFormatRow?.exportFormatLabel ?? ''
  // The button just says Export (the summary above says what downloads); its name for screen readers
  // keeps the count and the format.
  const exportButtonAccessibleName = isEveryExportNoteTicked
    ? `Export All Notes as ${chosenExportFormatLabel}`
    : tickedExportNoteCount > 1
      ? `Export ${tickedExportNoteCount} Notes as ${chosenExportFormatLabel}`
      : `Export as ${chosenExportFormatLabel}`
  // One note downloads as its own file (a vault of one note too); only two or more come as a .zip.
  const exportSelectionSummary =
    tickedExportNoteCount === 0
      ? 'No notes ticked.'
      : tickedExportNoteCount === 1
        ? `1 note ticked. It downloads as one ${papelizSettingsGearExportFormatOneNoteFileExtensions[chosenExportFormat]} file.`
        : isEveryExportNoteTicked
          ? `Every note in “${openVault?.papelizVaultDisplayName ?? 'this vault'}”. They download as one .zip, folders kept.`
          : `${tickedExportNoteCount} notes ticked. They download as one .zip, folders kept.`

  const isExportRunning = exportRunState.exportRunKind === 'running'
  const isChosenExportFormatReady = chosenExportFormatRow?.isExportFormatReady === true
  const isTemplateExportReady = chosenExportFormat !== 'template' || templateExportDetailsProblem === null
  const canExport = isChosenExportFormatReady && isExportPaperChosen && isTemplateExportReady && tickedExportNoteCount > 0 && openVault !== null && !isExportRunning

  // Loads the chosen format's engine and says what it will save.
  const prepareChosenExport = async (exportVaultNoteRelativePaths: readonly string[]): Promise<PapelizSettingsGearPreparedExport | null> => {
    if (openVault === null) return null
    const { papelizVaultAdapter, papelizVaultDisplayName } = openVault
    if (chosenExportFormat === 'word') {
      if (exportPaperSize === null) return null
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
      if (exportPaperSize === null) return null
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
    if (chosenExportFormat === 'template') {
      const templateExportCategoryTag = templateExportSettings.templateExportCategoryTag
      if (templateExportCategoryTag === null || shownTemplateFirstNotePath === null) return null
      const templateExportModule = await import('../template-gallery/papeliz-template-export')
      const templateExportFileKind = templateExportModule.describePapelizTemplateExportFile(templateExportSettings.templateExportName, papelizVaultDisplayName)
      return {
        exportFileName: templateExportFileKind.templateExportFileName,
        exportFileKind: {
          exportFileDescription: templateExportFileKind.templateExportFileDescription,
          exportFileMediaType: templateExportFileKind.templateExportFileMediaType,
          exportFileExtension: templateExportFileKind.templateExportFileExtension,
        },
        buildExportFile: async (onExportProgress, exportAbortSignal) => {
          const { templateExportFileBlob, templateExportNotices } = await templateExportModule.exportPapelizVaultNotesAsTemplate({
            templateExportVault: { vaultAdapter: papelizVaultAdapter, vaultDisplayName: papelizVaultDisplayName },
            templateExportVaultNoteRelativePaths: exportVaultNoteRelativePaths,
            templateExportOptionalNoteRelativePaths: new Set(templateExportSettings.templateExportOptionalNoteRelativePaths),
            templateExportDetails: {
              templateExportName: templateExportSettings.templateExportName,
              templateExportDescription: templateExportSettings.templateExportDescription,
              templateExportCategoryTag,
              templateExportFirstNotePath: shownTemplateFirstNotePath,
              templateExportLicenseId: templateExportSettings.templateExportLicenseId,
            },
            onTemplateExportProgress: onExportProgress,
            templateExportAbortSignal: exportAbortSignal,
          })
          return { exportFileBlob: templateExportFileBlob, exportNotices: templateExportNotices }
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
        exportAbortController.signal.aborted ? { exportRunKind: 'cancelled' } : { exportRunKind: 'failed', exportFailureMessage: describePapelizErrorSentence(exportError) },
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
          ? describeExportFailureLine(exportRunState.exportFailureMessage)
          : chosenExportFormat === 'template' && tickedExportNoteCount > 0
            ? templateExportDetailsProblem
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

  // The paper beside Word and PDF: its name, or a custom size as typed.
  const exportPaperSummary =
    exportPaperChoice === 'custom'
      ? `${exportCustomPaper.customPaperWidthText} × ${exportCustomPaper.customPaperHeightText} ${exportCustomPaper.customPaperUnit}`
      : (papelizSettingsGearExportPresetPaperRows.find((presetPaperRow) => presetPaperRow.exportPresetPaperSize === exportPaperChoice)?.exportPaperLabel ?? '')
  const openedExportFormatRow = papelizSettingsGearExportFormatRows.find((exportFormatRow) => exportFormatRow.exportFormat === openedExportFormatSettings)

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
          {isEveryExportNoteTicked ? 'Clear' : 'Select All'}
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
      <PapelizSettingsGearExportFormatList
        chosenExportFormat={chosenExportFormat}
        onExportFormatSelect={setChosenExportFormat}
        exportFormatSettingsSummaries={{ word: exportPaperSummary, pdf: exportPaperSummary }}
        onExportFormatSettingsOpen={setOpenedExportFormatSettings}
      />
      {openedExportFormatSettings !== null && openedExportFormatRow !== undefined && (
        <PapelizSettingsGearExportFormatSettingsDialog
          exportFormatSettingsTitle={`${openedExportFormatRow.exportFormatLabel} Settings`}
          ExportFormatSettingsIcon={openedExportFormatRow.ExportFormatIcon}
          onExportFormatSettingsClose={() => setOpenedExportFormatSettings(null)}
        >
          {openedExportFormatSettings === 'template' ? (
            <PapelizSettingsGearExportTemplateSettings
              templateExportSettings={templateExportSettings}
              onTemplateExportSettingsChange={changeTemplateExportSettings}
              tickedExportNoteRelativePaths={tickedExportNoteRelativePaths}
              shownTemplateFirstNotePath={shownTemplateFirstNotePath}
            />
          ) : (
            <>
              <p id={exportPaperLabelId} className="text-[12.5px] font-medium">
                Paper
              </p>
              <div role="radiogroup" aria-labelledby={exportPaperLabelId} className="mt-1.5 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
                {papelizSettingsGearExportPaperOptions.map((exportPaperOption) => {
                  const isExportPaperChosen = exportPaperOption.exportPaperChoice === exportPaperChoice
                  return (
                    <div key={exportPaperOption.exportPaperChoice} className={isExportPaperChosen ? 'bg-papeliz-blue-soft' : undefined}>
                      <label className={joinPapelizClassNames('flex cursor-pointer items-center gap-2.5 px-3 py-2', !isExportPaperChosen && 'hover:bg-papeliz-surface-soft')}>
                        <input
                          type="radio"
                          name={exportPaperRadioGroupName}
                          checked={isExportPaperChosen}
                          onChange={() => chooseExportPaper(exportPaperOption.exportPaperChoice)}
                          className="size-[15px] flex-none accent-papeliz-blue"
                        />
                        <span className="min-w-0 flex-1 text-[13px] font-medium">{exportPaperOption.exportPaperLabel}</span>
                        <span className="flex-none text-[12px] text-papeliz-ink-subtle tabular-nums">{exportPaperOption.exportPaperDimensionsNote}</span>
                      </label>
                      {exportPaperOption.exportPaperChoice === 'custom' && isExportPaperChosen && (
                        <div className="px-3 pb-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label="Paper width"
                              value={exportCustomPaper.customPaperWidthText}
                              onChange={(changeEvent) => changeExportCustomPaper({ ...exportCustomPaper, customPaperWidthText: changeEvent.target.value })}
                              className="h-9 w-20 min-w-0 rounded-lg border border-papeliz-line-strong bg-papeliz-surface px-2 text-center text-[13px] text-papeliz-ink tabular-nums outline-none focus-visible:border-papeliz-blue"
                            />
                            <span aria-hidden="true" className="text-[12.5px] text-papeliz-ink-subtle">
                              ×
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label="Paper height"
                              value={exportCustomPaper.customPaperHeightText}
                              onChange={(changeEvent) => changeExportCustomPaper({ ...exportCustomPaper, customPaperHeightText: changeEvent.target.value })}
                              className="h-9 w-20 min-w-0 rounded-lg border border-papeliz-line-strong bg-papeliz-surface px-2 text-center text-[13px] text-papeliz-ink tabular-nums outline-none focus-visible:border-papeliz-blue"
                            />
                            <PapelizSlidingChoiceGroup<PapelizSettingsGearExportCustomPaperUnit>
                              slidingChoiceGroupLabel="Paper unit"
                              slidingChoiceGroupRole="radiogroup"
                              chosenSlidingChoiceValue={exportCustomPaper.customPaperUnit}
                              onSlidingChoiceSelect={changeExportCustomPaperUnit}
                              slidingChoiceGroupClassName="min-w-0 flex-1"
                              slidingChoices={[
                                { slidingChoiceValue: 'in', slidingChoiceContent: 'in' },
                                { slidingChoiceValue: 'mm', slidingChoiceContent: 'mm' },
                              ]}
                            />
                          </div>
                          <p className={`mt-1.5 text-[11.5px] leading-[1.4] ${exportPaperSize === null ? 'text-papeliz-error-notice-ink' : 'text-papeliz-ink-subtle'}`}>
                            Width × height. {describeExportCustomPaperSideRange(exportCustomPaper.customPaperUnit)}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-papeliz-ink-subtle">Word and PDF print on the same paper, and Papeliz remembers it.</p>
            </>
          )}
        </PapelizSettingsGearExportFormatSettingsDialog>
      )}

      <PapelizPillButton
        pillButtonVariant="primary"
        pillButtonSize="small"
        disabled={!canExport}
        aria-label={isExportRunning ? undefined : exportButtonAccessibleName}
        onClick={() => void exportTickedNotes()}
        className="mt-3 w-full pointer-coarse:h-10"
      >
        {isExportRunning ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
        {exportRunState.exportRunKind === 'running'
          ? exportRunState.exportNoteCount > 1
            ? `Exporting ${exportRunState.exportedNoteCount} of ${exportRunState.exportNoteCount}…`
            : 'Exporting…'
          : 'Export'}
      </PapelizPillButton>
      {isExportRunning && computerFontsQuestion !== null && (
        <div className="mt-2 rounded-xl border border-papeliz-line bg-papeliz-surface p-2.5 text-[12px] leading-[1.45] text-papeliz-ink-muted">
          <p>
            “{computerFontsQuestion.pdfExportNoteName}” has characters Papeliz’s own fonts don’t have. To put these characters in the PDF as text, Papeliz can use fonts on
            this computer. Nothing leaves your computer.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => void answerWithComputerFonts()} className="pointer-coarse:h-10">
              Use This Computer’s Fonts
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => computerFontsQuestion.answerComputerFontsQuestion(null)} className="pointer-coarse:h-10">
              Print Them as Pictures
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
