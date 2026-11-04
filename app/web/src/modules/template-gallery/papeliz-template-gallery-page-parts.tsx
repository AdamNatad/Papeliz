import { ArrowBigDown, ArrowBigUp, Braces, ChevronDown, ChevronRight, CircleDashed, FileText, Folder, Image, RefreshCw, SquareTerminal, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizLoadingRing } from '../ui/papeliz-loading-ring'
import { PapelizSolidCircleCheckIcon, PapelizSolidCircleXIcon } from '../ui/papeliz-solid-circle-icons'
import { describePapelizSyncFileCount, formatPapelizSyncByteSize } from '../sync/papeliz-sync-screen-words'
import { isVaultJsonFileName } from '../vault/papeliz-vault-text-files'
import { getVaultEntryName, isVaultNoteFileName } from '../vault/papeliz-vault-relative-paths'
import {
  papelizTemplateGalleryTagDisplayNames,
  type PapelizTemplateCheckResult,
  type PapelizTemplateFileListEntry,
  type PapelizTemplateFileReadProgress,
  type PapelizTemplateGalleryActions,
  type PapelizTemplateGalleryRow,
  type PapelizTemplateGalleryState,
  type PapelizTemplateLicenseId,
  type PapelizTemplateRecheckState,
} from './papeliz-template-gallery-contract'
import { describePapelizTemplateLicenseName } from './papeliz-template-export-licenses'
import { isPapelizTemplatePictureUrlAllowed } from './papeliz-template-gallery-picture-hosts'
import { isPapelizTemplateGalleryWorkerSwitchedOn } from './papeliz-template-gallery-worker-switch'

// The pieces the Templates pages share: a template's thumbnail, author, tags and votes, Recheck, the
// checks' results and the file tree.

// Everything the Templates pages read and do: the gallery store's state and actions. Live, they are
// the gallery store's own; while the start screen's previewer (development builds only) holds a page,
// its made-up templates stand in, and nothing reaches GitHub, jsDelivr or a vault.
export type PapelizTemplateGalleryScreenModel = PapelizTemplateGalleryState & PapelizTemplateGalleryActions

export function describeTemplateGalleryLicense(templateLicenseId: PapelizTemplateLicenseId): string {
  return describePapelizTemplateLicenseName(templateLicenseId)
}

// A tag as the chips and a template's page show it: its name from the tag list ("ai-agents" -> "AI
// Agents"), or, for one not on it, its words with capitals ("garden-notes" -> "Garden Notes").
export function describeTemplateGalleryTag(templateTag: string): string {
  return (
    papelizTemplateGalleryTagDisplayNames[templateTag] ??
    templateTag
      .split('-')
      .map((templateTagWord) => templateTagWord.charAt(0).toUpperCase() + templateTagWord.slice(1))
      .join(' ')
  )
}

// The New tag stays for a template's first 14 days.
const papelizTemplateGalleryNewTagMilliseconds = 14 * 24 * 60 * 60_000

export function isTemplateGalleryRowNew(templateGalleryRow: PapelizTemplateGalleryRow, currentTime: number): boolean {
  return templateGalleryRow.templateListedAt !== null && currentTime - templateGalleryRow.templateListedAt < papelizTemplateGalleryNewTagMilliseconds
}

// "today", "2 days ago", "3 weeks ago": when a template was listed or checked.
const papelizTemplateGalleryRelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
export function describeTemplateGalleryDay(templateEventTime: number, currentTime: number): string {
  const elapsedDays = Math.round((templateEventTime - currentTime) / (24 * 60 * 60_000))
  if (elapsedDays === 0) return 'today'
  if (Math.abs(elapsedDays) < 30) return papelizTemplateGalleryRelativeTimeFormat.format(elapsedDays, 'day')
  if (Math.abs(elapsedDays) < 365) return papelizTemplateGalleryRelativeTimeFormat.format(Math.round(elapsedDays / 7), 'week')
  return papelizTemplateGalleryRelativeTimeFormat.format(Math.round(elapsedDays / 365), 'year')
}

export function describeTemplateGalleryFileCount(templateFileCount: number): string {
  return describePapelizSyncFileCount(templateFileCount)
}

export function formatTemplateGalleryByteSize(templateByteCount: number): string {
  return formatPapelizSyncByteSize(templateByteCount)
}

// "AdamNatad · MIT · 40 files", under a template's name.
export function describeTemplateGalleryRowDetail(templateGalleryRow: PapelizTemplateGalleryRow): string {
  return [templateGalleryRow.templateRepositoryOwner, describeTemplateGalleryLicense(templateGalleryRow.templateLicenseId), describeTemplateGalleryFileCount(templateGalleryRow.templateIncludedFileCount)].join(
    ' · ',
  )
}

// How the pages get the author's picture: the gallery store's `buildTemplateAuthorPictureUrl`.
export type PapelizTemplateAuthorPictureUrlBuilder = PapelizTemplateGalleryActions['buildTemplateAuthorPictureUrl']

// The author's GitHub picture, a small circle before their name, read straight from GitHub's picture
// host with no referrer, and only when it scrolls into view, at twice its size for sharp screens. If it
// can't be read, the name shows alone.
export function PapelizTemplateGalleryAuthorPicture({
  templateRepositoryOwner,
  authorPictureSize,
  buildTemplateAuthorPictureUrl,
}: {
  templateRepositoryOwner: string
  authorPictureSize: number
  buildTemplateAuthorPictureUrl: PapelizTemplateAuthorPictureUrlBuilder
}) {
  const [failedAuthorPictureOwner, setFailedAuthorPictureOwner] = useState<string | null>(null)
  if (failedAuthorPictureOwner === templateRepositoryOwner) return null
  return (
    <img
      src={buildTemplateAuthorPictureUrl(templateRepositoryOwner, authorPictureSize * 2)}
      alt=""
      width={authorPictureSize}
      height={authorPictureSize}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      data-papeliz-template-author-picture={templateRepositoryOwner}
      onError={() => setFailedAuthorPictureOwner(templateRepositoryOwner)}
      style={{ width: authorPictureSize, height: authorPictureSize }}
      className="inline-block flex-none rounded-full bg-papeliz-surface-gray align-middle"
    />
  )
}

// Under a template's name in a row: the author's picture and name, then the license and file count
// ("AdamNatad · MIT · 40 files"), or, on New, when it was listed ("Listed 2 days ago · AdamNatad").
export function PapelizTemplateGalleryRowDetail({
  templateGalleryRow,
  templateListedDay,
  buildTemplateAuthorPictureUrl,
}: {
  templateGalleryRow: PapelizTemplateGalleryRow
  templateListedDay: string | null
  buildTemplateAuthorPictureUrl: PapelizTemplateAuthorPictureUrlBuilder
}) {
  const templateAuthor = (
    <span className="inline-flex min-w-0 items-center gap-1 align-bottom">
      <PapelizTemplateGalleryAuthorPicture templateRepositoryOwner={templateGalleryRow.templateRepositoryOwner} authorPictureSize={14} buildTemplateAuthorPictureUrl={buildTemplateAuthorPictureUrl} />
      <span className="truncate">{templateGalleryRow.templateRepositoryOwner}</span>
    </span>
  )
  return (
    <span className="truncate text-[11.5px] text-papeliz-ink-subtle">
      {templateListedDay === null ? (
        <>
          {templateAuthor} · {describeTemplateGalleryLicense(templateGalleryRow.templateLicenseId)} · {describeTemplateGalleryFileCount(templateGalleryRow.templateIncludedFileCount)}
        </>
      ) : (
        <>
          Listed {templateListedDay} · {templateAuthor}
        </>
      )}
    </span>
  )
}

// A thumbnail's address is shown only from a host a template's pictures may come from, or drawn in the
// page itself (a `data:` picture, which reaches no host).
function isTemplateThumbnailPictureUrlShown(templateGalleryRow: PapelizTemplateGalleryRow, templateThumbnailPictureUrl: string): boolean {
  return /^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/i.test(templateThumbnailPictureUrl) || isPapelizTemplatePictureUrlAllowed(templateGalleryRow, templateThumbnailPictureUrl)
}

// The repository on GitHub, at the commit Papeliz knows.
export function buildTemplateGalleryGitHubCommitUrl(templateGalleryRow: PapelizTemplateGalleryRow): string {
  return `https://github.com/${templateGalleryRow.papelizTemplateGalleryId}/tree/${templateGalleryRow.templateCommitSha}`
}

// "12 of 40 files".
export function describeTemplateFileReadProgress(templateFileReadProgress: PapelizTemplateFileReadProgress | null): string {
  if (templateFileReadProgress === null || templateFileReadProgress.templateFileCount === 0) return ''
  return `${templateFileReadProgress.templateReadFileCount.toLocaleString('en-US')} of ${describeTemplateGalleryFileCount(templateFileReadProgress.templateFileCount)}`
}

// What a template's file is, by its name: a note (MD View), JSON or other text (MD Code), or a picture.
export type PapelizTemplateGalleryFileKind = 'note' | 'json' | 'text' | 'picture'

const papelizTemplateGalleryPictureExtensions: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'webp'])

export function classifyTemplateGalleryFile(templateFileRelativePath: string): PapelizTemplateGalleryFileKind {
  const templateFileName = getVaultEntryName(templateFileRelativePath)
  if (isVaultNoteFileName(templateFileName)) return 'note'
  if (isVaultJsonFileName(templateFileName)) return 'json'
  const templateFileExtension = templateFileName.includes('.') ? templateFileName.slice(templateFileName.lastIndexOf('.') + 1).toLowerCase() : ''
  return papelizTemplateGalleryPictureExtensions.has(templateFileExtension) ? 'picture' : 'text'
}

const papelizTemplateGalleryFileKindIcons: Record<PapelizTemplateGalleryFileKind, LucideIcon> = { note: FileText, json: Braces, text: FileText, picture: Image }

// A template's thumbnail: the README's first picture, cropped to 16:10, or its first letter on a plain
// tile when it has none (or it doesn't load, or its host isn't one a template's pictures may come
// from). Shown with <img> only, and sends no referrer.
export function PapelizTemplateGalleryThumbnail({ templateGalleryRow, templateThumbnailSize }: { templateGalleryRow: PapelizTemplateGalleryRow; templateThumbnailSize: 'row' | 'page' }) {
  const [failedTemplateThumbnailPictureUrl, setFailedTemplateThumbnailPictureUrl] = useState<string | null>(null)
  const templateThumbnailPictureUrl = templateGalleryRow.templateThumbnailPictureUrl
  const isTemplateThumbnailPictureShown =
    templateThumbnailPictureUrl !== null && templateThumbnailPictureUrl !== failedTemplateThumbnailPictureUrl && isTemplateThumbnailPictureUrlShown(templateGalleryRow, templateThumbnailPictureUrl)
  return (
    <span
      aria-hidden="true"
      className={joinPapelizClassNames(
        'relative grid flex-none place-items-center overflow-hidden border border-papeliz-line bg-papeliz-blue-soft font-semibold text-papeliz-blue',
        templateThumbnailSize === 'row' ? 'h-[45px] w-[72px] rounded-[7px] text-[17px]' : 'aspect-[16/10] w-full rounded-xl text-[40px]',
      )}
    >
      {isTemplateThumbnailPictureShown ? (
        <img
          src={templateThumbnailPictureUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedTemplateThumbnailPictureUrl(templateThumbnailPictureUrl)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        templateGalleryRow.templateName.trim().charAt(0).toUpperCase() || '·'
      )}
    </span>
  )
}

const papelizTemplateGalleryTagClassName = 'inline-flex h-[18px] flex-none items-center gap-1 rounded-full px-[7px] text-[10.5px] font-semibold whitespace-nowrap'

// The tags beside a template's name: Featured (blue), New (green) and Contains Scripts (amber): hooks
// and scripts a coding agent may run, which Papeliz never runs.
export function PapelizTemplateGalleryRowTags({ templateGalleryRow, currentTime }: { templateGalleryRow: PapelizTemplateGalleryRow; currentTime: number }) {
  return (
    <>
      {templateGalleryRow.isTemplateFeatured && <span className={joinPapelizClassNames(papelizTemplateGalleryTagClassName, 'bg-papeliz-blue-soft text-papeliz-blue')}>Featured</span>}
      {isTemplateGalleryRowNew(templateGalleryRow, currentTime) && (
        <span className={joinPapelizClassNames(papelizTemplateGalleryTagClassName, 'bg-papeliz-callout-green-ground text-papeliz-callout-green-ink')}>New</span>
      )}
      {templateGalleryRow.isTemplateRunningCommands && (
        <span className={joinPapelizClassNames(papelizTemplateGalleryTagClassName, 'bg-papeliz-warning text-papeliz-warning-ink')}>
          <SquareTerminal className="size-3" aria-hidden="true" />
          Contains Scripts
        </span>
      )}
    </>
  )
}

// A template's license, as a small gray tag.
export function PapelizTemplateGalleryLicenseTag({ templateLicenseId }: { templateLicenseId: PapelizTemplateLicenseId }) {
  return <span className={joinPapelizClassNames(papelizTemplateGalleryTagClassName, 'bg-papeliz-surface-gray text-papeliz-ink-muted')}>{describeTemplateGalleryLicense(templateLicenseId)}</span>
}

// What needs the Templates Worker (Submit, votes, Report and Recheck) stays in its place while the Worker
// is switched off (papeliz-template-gallery-worker-switch.ts), greyed, beside this small blue pill.
export const isPapelizTemplateGalleryWorkerFeatureComingSoon = !isPapelizTemplateGalleryWorkerSwitchedOn

export function PapelizTemplateGalleryComingSoonPill() {
  return (
    <span className="inline-flex h-[18px] flex-none items-center rounded-full border border-papeliz-blue-line bg-papeliz-blue-soft px-[7px] text-[10.5px] font-semibold whitespace-nowrap text-papeliz-blue">
      Coming Soon
    </span>
  )
}

// Voting comes with the Templates server and a free Papeliz account; until then the pill's arrows are
// greyed and say why they're off. While the Worker is switched off it shows no score, since nobody can
// vote yet.
const papelizTemplateGalleryVotingOffText = isPapelizTemplateGalleryWorkerFeatureComingSoon
  ? 'Votes are Coming Soon, with a free Papeliz account.'
  : 'Voting opens with the Templates server, with a free Papeliz account.'

// The vote pill: up, the score (up less down), down.
export function PapelizTemplateGalleryVotePill({ templateGalleryRow, votePillSize = 'row' }: { templateGalleryRow: PapelizTemplateGalleryRow; votePillSize?: 'row' | 'page' }) {
  const templateVoteScore = templateGalleryRow.templateUpVoteCount - templateGalleryRow.templateDownVoteCount
  const templateVoteArrowClassName = 'grid size-[22px] place-items-center rounded-full text-papeliz-ink-subtle aria-disabled:cursor-not-allowed pointer-coarse:size-8'
  return (
    <span
      role="group"
      aria-label={
        isPapelizTemplateGalleryWorkerFeatureComingSoon
          ? `Votes for ${templateGalleryRow.templateName}: Coming Soon`
          : `Votes for ${templateGalleryRow.templateName}: ${templateGalleryRow.templateUpVoteCount} up, ${templateGalleryRow.templateDownVoteCount} down`
      }
      className={joinPapelizClassNames(
        'inline-flex flex-none items-center gap-0.5 rounded-full border border-papeliz-line bg-papeliz-surface px-1 text-[12px] font-semibold text-papeliz-ink-muted tabular-nums',
        votePillSize === 'row' ? 'h-7 pointer-coarse:h-10' : 'h-8 pointer-coarse:h-10',
        isPapelizTemplateGalleryWorkerFeatureComingSoon && 'opacity-55',
      )}
    >
      <button type="button" aria-label="Vote Up" aria-disabled="true" title={papelizTemplateGalleryVotingOffText} className={templateVoteArrowClassName}>
        <ArrowBigUp className="size-[15px]" aria-hidden="true" />
      </button>
      {!isPapelizTemplateGalleryWorkerFeatureComingSoon && <span className="min-w-5 px-0.5 text-center">{templateVoteScore.toLocaleString('en-US')}</span>}
      <button type="button" aria-label="Vote Down" aria-disabled="true" title={papelizTemplateGalleryVotingOffText} className={templateVoteArrowClassName}>
        <ArrowBigDown className="size-[15px]" aria-hidden="true" />
      </button>
    </span>
  )
}

// What Recheck found, in a sentence; null while it runs or before it's pressed.
function describeTemplateRecheckState(templateRecheckState: PapelizTemplateRecheckState, templateGalleryRow: PapelizTemplateGalleryRow, currentTime: number): string | null {
  switch (templateRecheckState.templateRecheckStage) {
    case 'idle':
    case 'rechecking':
      return null
    case 'up-to-date':
      return 'Up to date. Checked just now.'
    case 'updated':
      return templateRecheckState.templateChangedFileCount === null
        ? `Updated to commit ${templateRecheckState.templateCommitSha.slice(0, 7)}.`
        : `Updated to commit ${templateRecheckState.templateCommitSha.slice(0, 7)}, ${describeTemplateGalleryFileCount(templateRecheckState.templateChangedFileCount)} changed.`
    case 'newest-fails': {
      const firstFailedCheckSentence =
        templateRecheckState.templateCheckReport.templateCheckResults.find((templateCheckResult) => templateCheckResult.templateCheckOutcome === 'failed')?.templateCheckSentence ?? ''
      const keptVersionDay = templateGalleryRow.templateCheckedAt === null ? 'before' : `from ${describeTemplateGalleryDay(templateGalleryRow.templateCheckedAt, currentTime)}`
      return `The newest version fails a check: ${firstFailedCheckSentence} Papeliz keeps the version ${keptVersionDay}.`.replace(/\s+/g, ' ')
    }
    case 'repository-gone':
    case 'failed-to-read':
      return templateRecheckState.templateRecheckProblemSentence
  }
}

interface PapelizTemplateGalleryRecheckLineProps {
  templateGalleryRow: PapelizTemplateGalleryRow
  templateRecheckState: PapelizTemplateRecheckState
  templateGalleryOpenedAt: number
  onTemplateRecheck: () => void
  // The template's page and Preview put Recheck at their top right (beside the votes, on the page).
  isTemplateRecheckButtonInLine?: boolean
}

// Only this template's Recheck counts on its page.
function findThisTemplateRecheckState(templateRecheckState: PapelizTemplateRecheckState, templateGalleryRow: PapelizTemplateGalleryRow): PapelizTemplateRecheckState {
  return templateRecheckState.templateRecheckStage !== 'idle' && templateRecheckState.papelizTemplateGalleryId === templateGalleryRow.papelizTemplateGalleryId
    ? templateRecheckState
    : { templateRecheckStage: 'idle' }
}

// Recheck: asks GitHub for a newer version, and checks it. At a template page's top right it is the
// votes' height. While the Templates Worker is switched off it is one greyed control that says so,
// "Recheck · Coming Soon": a template stays on the commit the static list pins.
export function PapelizTemplateGalleryRecheckButton({
  templateGalleryRow,
  templateRecheckState,
  onTemplateRecheck,
  recheckButtonSize = 'line',
}: {
  templateGalleryRow: PapelizTemplateGalleryRow
  templateRecheckState: PapelizTemplateRecheckState
  onTemplateRecheck: () => void
  recheckButtonSize?: 'line' | 'page'
}) {
  const isTemplateRechecking = findThisTemplateRecheckState(templateRecheckState, templateGalleryRow).templateRecheckStage === 'rechecking'
  if (isPapelizTemplateGalleryWorkerFeatureComingSoon) {
    return (
      <button
        type="button"
        aria-disabled="true"
        title="Recheck needs the Templates server, which opens later."
        className={joinPapelizClassNames(
          'inline-flex flex-none cursor-not-allowed items-center gap-1 rounded-full border border-papeliz-line font-semibold whitespace-nowrap text-papeliz-ink-muted opacity-55 pointer-coarse:px-3',
          recheckButtonSize === 'line' ? 'h-6 px-2 text-[11.5px] pointer-coarse:h-9' : 'h-8 gap-1.5 px-3 text-[12.5px] pointer-coarse:h-10',
        )}
      >
        <RefreshCw className={recheckButtonSize === 'line' ? 'size-3' : 'size-3.5'} aria-hidden="true" />
        Recheck · Coming Soon
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled={isTemplateRechecking}
      aria-busy={isTemplateRechecking || undefined}
      title="Ask GitHub for a newer version, and check it"
      onClick={onTemplateRecheck}
      className={joinPapelizClassNames(
        'inline-flex flex-none items-center gap-1 rounded-full border border-papeliz-line font-semibold text-papeliz-ink-muted transition-colors enabled:hover:border-papeliz-blue-line enabled:hover:bg-papeliz-blue-soft enabled:hover:text-papeliz-blue disabled:opacity-70 pointer-coarse:px-3',
        recheckButtonSize === 'line' ? 'h-6 px-2 text-[11.5px] pointer-coarse:h-9' : 'h-8 gap-1.5 px-3 text-[12.5px] pointer-coarse:h-10',
      )}
    >
      <RefreshCw className={joinPapelizClassNames(recheckButtonSize === 'line' ? 'size-3' : 'size-3.5', isTemplateRechecking && 'animate-spin')} aria-hidden="true" />
      {isTemplateRechecking ? 'Rechecking…' : 'Recheck'}
    </button>
  )
}

// "Checked 2 days ago · commit 1a2b3c4" and Recheck, which asks GitHub for a newer version and checks
// it; what it found shows under them.
export function PapelizTemplateGalleryRecheckLine({
  templateGalleryRow,
  templateRecheckState,
  templateGalleryOpenedAt,
  onTemplateRecheck,
  isTemplateRecheckButtonInLine = true,
}: PapelizTemplateGalleryRecheckLineProps) {
  const thisTemplateRecheckState = findThisTemplateRecheckState(templateRecheckState, templateGalleryRow)
  const templateRecheckSentence = describeTemplateRecheckState(thisTemplateRecheckState, templateGalleryRow, templateGalleryOpenedAt)
  const isTemplateRecheckBad =
    thisTemplateRecheckState.templateRecheckStage === 'newest-fails' ||
    thisTemplateRecheckState.templateRecheckStage === 'repository-gone' ||
    thisTemplateRecheckState.templateRecheckStage === 'failed-to-read'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-papeliz-ink-subtle tabular-nums">
        <span>
          {templateGalleryRow.templateCheckedAt === null ? 'Commit' : `Checked ${describeTemplateGalleryDay(templateGalleryRow.templateCheckedAt, templateGalleryOpenedAt)} · commit`}{' '}
          {templateGalleryRow.templateCommitSha.slice(0, 7)}
        </span>
        {isTemplateRecheckButtonInLine && (
          <PapelizTemplateGalleryRecheckButton templateGalleryRow={templateGalleryRow} templateRecheckState={templateRecheckState} onTemplateRecheck={onTemplateRecheck} />
        )}
        {thisTemplateRecheckState.templateRecheckStage === 'rechecking' && thisTemplateRecheckState.templateFileReadProgress !== null && (
          <span>{describeTemplateFileReadProgress(thisTemplateRecheckState.templateFileReadProgress)}</span>
        )}
      </div>
      {templateRecheckSentence !== null && (
        <p role="status" className={joinPapelizClassNames('text-[12px] leading-[1.45]', isTemplateRecheckBad ? 'text-papeliz-diff-removed-ink' : 'text-papeliz-ink-muted')}>
          {templateRecheckSentence}
        </p>
      )}
    </div>
  )
}

const papelizTemplateCheckOutcomeWords: Record<PapelizTemplateCheckResult['templateCheckOutcome'], string> = { passed: 'Passed', failed: 'Failed', 'not-checked': 'Not checked' }

// The checks' results, one line each, its label then its sentence: passed (green), failed (red) or not
// checked (gray). `isOnlyFailedCheckShown` lists just the failed ones.
export function PapelizTemplateGalleryCheckResultList({ templateCheckResults, isOnlyFailedCheckShown = false }: { templateCheckResults: readonly PapelizTemplateCheckResult[]; isOnlyFailedCheckShown?: boolean }) {
  return (
    <ul aria-label="Checks" className="flex flex-col gap-2">
      {templateCheckResults
        .filter((templateCheckResult) => !isOnlyFailedCheckShown || templateCheckResult.templateCheckOutcome === 'failed')
        .map((templateCheckResult) => (
          <li key={templateCheckResult.templateCheckId} className="flex items-start gap-2 text-[12.5px] leading-[1.45]">
            {templateCheckResult.templateCheckOutcome === 'passed' ? (
              <PapelizSolidCircleCheckIcon className="mt-px size-4 flex-none text-papeliz-ok" />
            ) : templateCheckResult.templateCheckOutcome === 'failed' ? (
              <PapelizSolidCircleXIcon className="mt-px size-4 flex-none text-papeliz-diff-removed-ink" />
            ) : (
              <CircleDashed className="mt-px size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
            )}
            <span className={joinPapelizClassNames('min-w-0', templateCheckResult.templateCheckOutcome === 'not-checked' && 'text-papeliz-ink-subtle')}>
              <span className="sr-only">{papelizTemplateCheckOutcomeWords[templateCheckResult.templateCheckOutcome]}: </span>
              <b className="font-semibold">{templateCheckResult.templateCheckLabel}</b> {templateCheckResult.templateCheckSentence}
            </span>
          </li>
        ))}
    </ul>
  )
}

// A folder of a template's file tree, with the folders and files under it.
interface PapelizTemplateGalleryFileTreeFolder {
  templateFolderRelativePath: string
  templateFolderName: string
  childTemplateFolders: PapelizTemplateGalleryFileTreeFolder[]
  childTemplateFiles: PapelizTemplateFileListEntry[]
  // Every file under it, at any depth, and their size.
  nestedTemplateFileCount: number
  nestedTemplateByteCount: number
}

// The file list as a tree: folders first, then files, each by name.
export function buildTemplateGalleryFileTree(templateFileListEntries: readonly PapelizTemplateFileListEntry[]): PapelizTemplateGalleryFileTreeFolder {
  const createTemplateFolder = (templateFolderRelativePath: string, templateFolderName: string): PapelizTemplateGalleryFileTreeFolder => ({
    templateFolderRelativePath,
    templateFolderName,
    childTemplateFolders: [],
    childTemplateFiles: [],
    nestedTemplateFileCount: 0,
    nestedTemplateByteCount: 0,
  })
  const rootTemplateFolder = createTemplateFolder('', '')
  for (const templateFileListEntry of templateFileListEntries) {
    let currentTemplateFolder = rootTemplateFolder
    const countTemplateFileIn = (templateFolder: PapelizTemplateGalleryFileTreeFolder) => {
      templateFolder.nestedTemplateFileCount += 1
      templateFolder.nestedTemplateByteCount += templateFileListEntry.templateFileByteCount
    }
    countTemplateFileIn(currentTemplateFolder)
    for (const templateFolderName of templateFileListEntry.templateFileRelativePath.split('/').slice(0, -1)) {
      let childTemplateFolder = currentTemplateFolder.childTemplateFolders.find((templateFolder) => templateFolder.templateFolderName === templateFolderName)
      if (childTemplateFolder === undefined) {
        childTemplateFolder = createTemplateFolder(
          currentTemplateFolder.templateFolderRelativePath === '' ? templateFolderName : `${currentTemplateFolder.templateFolderRelativePath}/${templateFolderName}`,
          templateFolderName,
        )
        currentTemplateFolder.childTemplateFolders.push(childTemplateFolder)
      }
      currentTemplateFolder = childTemplateFolder
      countTemplateFileIn(currentTemplateFolder)
    }
    currentTemplateFolder.childTemplateFiles.push(templateFileListEntry)
  }
  const sortTemplateFolder = (templateFolder: PapelizTemplateGalleryFileTreeFolder) => {
    templateFolder.childTemplateFolders.sort((firstTemplateFolder, secondTemplateFolder) => firstTemplateFolder.templateFolderName.localeCompare(secondTemplateFolder.templateFolderName))
    templateFolder.childTemplateFiles.sort((firstTemplateFile, secondTemplateFile) => firstTemplateFile.templateFileRelativePath.localeCompare(secondTemplateFile.templateFileRelativePath))
    templateFolder.childTemplateFolders.forEach(sortTemplateFolder)
  }
  sortTemplateFolder(rootTemplateFolder)
  return rootTemplateFolder
}

// The folders on the way to a file, to open at first.
export function listTemplateGalleryFolderPathsTo(templateFileRelativePath: string): Set<string> {
  const templateFolderRelativePaths = new Set<string>()
  const templateFilePathSegments = templateFileRelativePath.split('/')
  for (let templateFolderDepth = 1; templateFolderDepth < templateFilePathSegments.length; templateFolderDepth += 1) {
    templateFolderRelativePaths.add(templateFilePathSegments.slice(0, templateFolderDepth).join('/'))
  }
  return templateFolderRelativePaths
}

interface PapelizTemplateGalleryFileTreeProps {
  templateFileTree: PapelizTemplateGalleryFileTreeFolder
  // What's inside shows each folder's count and size; Preview picks a file to show.
  chosenTemplateFileRelativePath?: string | null
  onTemplateFileChoose?: (templateFileRelativePath: string) => void
  initiallyOpenTemplateFolderRelativePaths: ReadonlySet<string>
}

// A template's files as a tree of folders that open and close. With `onTemplateFileChoose` each file is
// a button and the chosen one is lit; without it the files are plain lines with their size, and each
// folder says how many files it holds and their size.
export function PapelizTemplateGalleryFileTree({ templateFileTree, chosenTemplateFileRelativePath = null, onTemplateFileChoose, initiallyOpenTemplateFolderRelativePaths }: PapelizTemplateGalleryFileTreeProps) {
  const [openTemplateFolderRelativePaths, setOpenTemplateFolderRelativePaths] = useState<ReadonlySet<string>>(initiallyOpenTemplateFolderRelativePaths)
  const toggleTemplateFolder = (templateFolderRelativePath: string) =>
    setOpenTemplateFolderRelativePaths((previousOpenFolderRelativePaths) => {
      const nextOpenFolderRelativePaths = new Set(previousOpenFolderRelativePaths)
      if (nextOpenFolderRelativePaths.has(templateFolderRelativePath)) nextOpenFolderRelativePaths.delete(templateFolderRelativePath)
      else nextOpenFolderRelativePaths.add(templateFolderRelativePath)
      return nextOpenFolderRelativePaths
    })

  const renderTemplateFolderChildren = (templateFolder: PapelizTemplateGalleryFileTreeFolder, templateFolderDepth: number): ReactNode => (
    <>
      {templateFolder.childTemplateFolders.map((childTemplateFolder) => {
        const isTemplateFolderOpen = openTemplateFolderRelativePaths.has(childTemplateFolder.templateFolderRelativePath)
        return (
          <li key={childTemplateFolder.templateFolderRelativePath}>
            <button
              type="button"
              aria-expanded={isTemplateFolderOpen}
              onClick={() => toggleTemplateFolder(childTemplateFolder.templateFolderRelativePath)}
              style={{ paddingLeft: 6 + templateFolderDepth * 14 }}
              className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-1.5 text-left text-[12px] text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink pointer-coarse:h-9"
            >
              {isTemplateFolderOpen ? <ChevronDown className="size-3 flex-none" aria-hidden="true" /> : <ChevronRight className="size-3 flex-none" aria-hidden="true" />}
              <Folder className="size-3.5 flex-none" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{childTemplateFolder.templateFolderName}</span>
              {onTemplateFileChoose === undefined && (
                <span className="flex-none text-[11px] font-normal text-papeliz-ink-subtle tabular-nums">
                  {describeTemplateGalleryFileCount(childTemplateFolder.nestedTemplateFileCount)} · {formatTemplateGalleryByteSize(childTemplateFolder.nestedTemplateByteCount)}
                </span>
              )}
            </button>
            {isTemplateFolderOpen && <ul>{renderTemplateFolderChildren(childTemplateFolder, templateFolderDepth + 1)}</ul>}
          </li>
        )
      })}
      {templateFolder.childTemplateFiles.map((templateFileListEntry) => {
        const { templateFileRelativePath } = templateFileListEntry
        const TemplateFileKindIcon = papelizTemplateGalleryFileKindIcons[classifyTemplateGalleryFile(templateFileRelativePath)]
        const templateFileName = getVaultEntryName(templateFileRelativePath)
        const templateFileRowPadding = { paddingLeft: 6 + templateFolderDepth * 14 + 18 }
        if (onTemplateFileChoose === undefined) {
          return (
            <li key={templateFileRelativePath} style={templateFileRowPadding} className="flex h-7 min-w-0 items-center gap-1.5 pr-1.5 text-[12px] text-papeliz-ink-muted">
              <TemplateFileKindIcon className="size-3.5 flex-none" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{templateFileName}</span>
              <span className="flex-none text-[11px] text-papeliz-ink-subtle tabular-nums">{formatTemplateGalleryByteSize(templateFileListEntry.templateFileByteCount)}</span>
            </li>
          )
        }
        const isTemplateFileChosen = templateFileRelativePath === chosenTemplateFileRelativePath
        return (
          <li key={templateFileRelativePath}>
            <button
              type="button"
              aria-current={isTemplateFileChosen || undefined}
              onClick={() => onTemplateFileChoose(templateFileRelativePath)}
              style={templateFileRowPadding}
              className={joinPapelizClassNames(
                'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-1.5 text-left text-[12px] pointer-coarse:h-9',
                isTemplateFileChosen ? 'bg-papeliz-blue-soft font-semibold text-papeliz-blue' : 'text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink',
              )}
            >
              <TemplateFileKindIcon className="size-3.5 flex-none" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{templateFileName}</span>
            </button>
          </li>
        )
      })}
    </>
  )

  return <ul className="flex flex-col">{renderTemplateFolderChildren(templateFileTree, 0)}</ul>
}

// A rendered note, or a file's text, inside a Templates page: MD View's and MD Code's own look, a size
// down to fit the start card.
export const papelizTemplateGalleryNoteSizeClassName = '[--papeliz-note-column-width:100%] [--papeliz-note-font-size:14.5px]'

// A step of a Templates page that waits or stopped: a ring or an icon, a title and a line.
export function PapelizTemplateGalleryCenteredStep({
  TemplateGalleryStepIcon,
  templateGalleryStepTitle,
  templateGalleryStepText,
  isTemplateGalleryStepWaiting = false,
  children,
}: {
  TemplateGalleryStepIcon?: LucideIcon
  templateGalleryStepTitle: string
  templateGalleryStepText?: ReactNode
  isTemplateGalleryStepWaiting?: boolean
  children?: ReactNode
}) {
  return (
    <div role={isTemplateGalleryStepWaiting ? 'status' : undefined} className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
        {isTemplateGalleryStepWaiting || TemplateGalleryStepIcon === undefined ? (
          <PapelizLoadingRing />
        ) : (
          <TemplateGalleryStepIcon className="size-5" aria-hidden="true" />
        )}
      </span>
      <p className="mt-1.5 text-[14px] font-semibold">{templateGalleryStepTitle}</p>
      {templateGalleryStepText !== undefined && <p className="max-w-[320px] text-[12.5px] leading-[1.5] text-papeliz-ink-muted">{templateGalleryStepText}</p>}
      {children}
    </div>
  )
}
