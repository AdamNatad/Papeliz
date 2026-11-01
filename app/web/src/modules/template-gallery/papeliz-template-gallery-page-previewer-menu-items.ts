import {
  CircleAlert,
  ClipboardCheck,
  Eye,
  FileSearch,
  FolderOpen,
  Hourglass,
  LayoutTemplate,
  ListChecks,
  LoaderCircle,
  RefreshCw,
  SquareTerminal,
  Trophy,
  Upload,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { createStore } from 'zustand/vanilla'
import type { PapelizPopoverMenuItem } from '../ui/papeliz-popover-menu'
import { hasPapelizTemplateHiddenCharacter } from './papeliz-template-gallery-checks'
import type {
  PapelizTemplateCheckReport,
  PapelizTemplateCheckResult,
  PapelizTemplateCheckRunState,
  PapelizTemplateFileListEntry,
  PapelizTemplateGalleryRow,
  PapelizTemplateGallerySnapshotState,
  PapelizTemplateGalleryState,
  PapelizTemplateGalleryTab,
  PapelizTemplateRecheckState,
  PapelizTemplateRunCommand,
  PapelizTemplateUseState,
} from './papeliz-template-gallery-contract'
import type { PapelizTemplateGalleryScreen } from './papeliz-template-gallery-page'
import type { PapelizTemplateGalleryScreenModel } from './papeliz-template-gallery-page-parts'
import { usePapelizTemplateGalleryPagePreviewStore } from './papeliz-template-gallery-page-preview-store'

// The Templates pages' rows in the start screen's previewer (development builds only,
// papeliz-start-screen-previewer-button.tsx): each state of the gallery, a template's page, Preview,
// Use Template, Recheck and Submit, with made-up templates by made-up authors. A pick stands a made-up
// gallery in for the gallery store; its buttons answer from it and reach no network or vault.

const papelizTemplatePreviewDayMilliseconds = 24 * 60 * 60_000

// A plain picture for a made-up thumbnail: a colored ground with a few lines, as a README picture
// might be. Drawn here, so nothing is fetched.
function drawPreviewTemplateThumbnail(thumbnailGroundColor: string, thumbnailLineColor: string): string {
  const thumbnailLines = [18, 30, 42, 54]
    .map((thumbnailLineTop, thumbnailLineIndex) => `<rect x="14" y="${thumbnailLineTop}" width="${[72, 52, 64, 40][thumbnailLineIndex]}" height="6" rx="3" fill="${thumbnailLineColor}"/>`)
    .join('')
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 80"><rect width="128" height="80" fill="${thumbnailGroundColor}"/>${thumbnailLines}</svg>`)}`
}

// A made-up author's picture: their first letter on a colored circle, drawn here. Daily Journal's
// author has one that doesn't read, to show the name alone, as when GitHub's picture fails.
const papelizPreviewAuthorPictureColors: Readonly<Record<string, string>> = {
  'example-team': '#1f6feb',
  'example-reader': '#b3631b',
  'example-dev': '#1e8e4a',
  'example-student': '#8a3ffc',
  'example-planner': '#0f7b8a',
}
function drawPreviewAuthorPicture(templateRepositoryOwner: string): string {
  const authorPictureColor = papelizPreviewAuthorPictureColors[templateRepositoryOwner]
  if (authorPictureColor === undefined) return 'data:image/png;base64,AAAA'
  const authorInitial = (templateRepositoryOwner.replace(/^example-/, '').charAt(0) || '?').toUpperCase()
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${authorPictureColor}"/><text x="16" y="21.5" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#fff">${authorInitial}</text></svg>`,
  )}`
}

function buildPreviewTemplateGalleryRow(
  previewTemplateRow: Pick<PapelizTemplateGalleryRow, 'templateRepositoryOwner' | 'templateRepositoryName' | 'templateName' | 'templateDescription' | 'templateTags' | 'templateLicenseId'> &
    Partial<PapelizTemplateGalleryRow> & { listedDaysAgo: number },
  currentTime: number,
): PapelizTemplateGalleryRow {
  const { listedDaysAgo, ...previewTemplateRowFields } = previewTemplateRow
  return {
    papelizTemplateGalleryId: `${previewTemplateRow.templateRepositoryOwner}/${previewTemplateRow.templateRepositoryName}`,
    templateCommitSha: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
    templateIncludedFileListDigest: 'cHJldmlldy1vbmx5LWRpZ2VzdC1mb3ItdGhlLXByZXZpZXdlcg==',
    templateFirstNotePath: 'START.md',
    templateThumbnailPictureUrl: null,
    templateIncludedFileCount: 10,
    templateIncludedByteCount: 42_500,
    isTemplateRunningCommands: false,
    isTemplateFeatured: false,
    templateListedAt: currentTime - listedDaysAgo * papelizTemplatePreviewDayMilliseconds,
    templateCheckedAt: currentTime - 2 * papelizTemplatePreviewDayMilliseconds,
    templateUpVoteCount: 0,
    templateDownVoteCount: 0,
    templateTopRank: null,
    ...previewTemplateRowFields,
  }
}

function listPreviewTemplateGalleryRows(currentTime: number): PapelizTemplateGalleryRow[] {
  return [
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-team',
        templateRepositoryName: 'Project-Starter',
        templateName: 'Project Starter',
        templateDescription: 'A starting point for a software project: its plan, tasks and decisions in one place, ready for you and your coding agents.',
        templateTags: ['coding', 'planning', 'ai-agents'],
        templateLicenseId: 'MIT',
        templateThumbnailPictureUrl: drawPreviewTemplateThumbnail('#1f6feb', '#ffffffcc'),
        isTemplateFeatured: true,
        templateUpVoteCount: 134,
        templateDownVoteCount: 6,
        templateTopRank: 1,
        listedDaysAgo: 40,
      },
      currentTime,
    ),
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-reader',
        templateRepositoryName: 'Reading-Notes',
        templateName: 'Reading Notes',
        templateDescription: 'One note per book, with quotes, ideas and a reading log.',
        templateTags: ['study', 'writing'],
        templateLicenseId: 'CC-BY-4.0',
        templateThumbnailPictureUrl: drawPreviewTemplateThumbnail('#f3e8d2', '#8a5a1f99'),
        templateIncludedFileCount: 18,
        isTemplateFeatured: true,
        templateUpVoteCount: 66,
        templateDownVoteCount: 2,
        templateTopRank: 2,
        listedDaysAgo: 60,
      },
      currentTime,
    ),
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-dev',
        templateRepositoryName: 'Agent-Hooks-Starter',
        templateName: 'Agent Hooks Starter',
        templateDescription: 'Agent settings with a hook that checks each command and a status line.',
        templateTags: ['coding', 'ai-agents'],
        templateLicenseId: 'MIT',
        templateThumbnailPictureUrl: drawPreviewTemplateThumbnail('#16191f', '#3fb950'),
        templateIncludedFileCount: 9,
        isTemplateRunningCommands: true,
        templateUpVoteCount: 34,
        templateDownVoteCount: 3,
        templateTopRank: 3,
        listedDaysAgo: 10,
      },
      currentTime,
    ),
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-student',
        templateRepositoryName: 'Course-Notes',
        templateName: 'Course Notes',
        templateDescription: 'A folder per course, with lecture notes, readings and exam prep.',
        templateTags: ['study'],
        templateLicenseId: 'CC-BY-4.0',
        templateIncludedFileCount: 22,
        templateUpVoteCount: 13,
        templateDownVoteCount: 1,
        templateTopRank: 4,
        listedDaysAgo: 21,
      },
      currentTime,
    ),
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-planner',
        templateRepositoryName: 'Weekly-Review',
        templateName: 'Weekly Review',
        templateDescription: 'A weekly page to look back, plan ahead and keep your lists short.',
        templateTags: ['planning'],
        templateLicenseId: 'CC0-1.0',
        templateThumbnailPictureUrl: drawPreviewTemplateThumbnail('#e6f4ea', '#1e8e4a99'),
        templateIncludedFileCount: 6,
        isTemplateFeatured: true,
        templateUpVoteCount: 4,
        templateDownVoteCount: 0,
        templateTopRank: 5,
        listedDaysAgo: 0,
      },
      currentTime,
    ),
    buildPreviewTemplateGalleryRow(
      {
        templateRepositoryOwner: 'example-writer',
        templateRepositoryName: 'Daily-Journal',
        templateName: 'Daily Journal',
        templateDescription: 'A note a day, with prompts and a monthly look back.',
        templateTags: ['writing'],
        templateLicenseId: 'MIT',
        templateThumbnailPictureUrl: drawPreviewTemplateThumbnail('#f1ecff', '#5b3fc499'),
        templateIncludedFileCount: 5,
        templateUpVoteCount: 2,
        templateDownVoteCount: 0,
        templateTopRank: 6,
        listedDaysAgo: 2,
      },
      currentTime,
    ),
  ]
}

// The made-up files every made-up template shows in Preview and on its page.
const papelizPreviewTemplateFileTexts: Readonly<Record<string, string>> = {
  'START.md': [
    '# Start Here',
    '',
    'Read this note first in every session, then the guides in the order below.',
    '',
    '> [!tip] Keep it short',
    '> One idea per note. Link notes with [[planning]] and [[tasks]].',
    '',
    '## Read in this order',
    '',
    '1. **Planning**: the phases and what each one delivers.',
    '2. **Tasks**: what is open, the most important first.',
    '3. **Decisions**: why things are the way they are.',
    '',
    '![A planning board on another site](https://example.com/planning-board.png)',
    '',
    '## Rules',
    '',
    '- Specific names only.',
    '- Mark a task done the moment it is done.',
    '- #planning happens before code.',
  ].join('\n'),
  'README.md': ['# Project Starter', '', 'A starting point for a software project.', '', 'Open `START.md` first.'].join('\n'),
  'LICENSE': 'MIT License\n\nCopyright (c) example-team\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software…',
  '.gitignore': 'scratch/\n.env\n.env.*\ndist/\n',
  'guides/planning.md': ['# Planning', '', '## Phase 1', '', '- Write down what the project is and is not.', '- Pick the tools.'].join('\n'),
  'guides/tasks.md': ['# Tasks', '', '- [ ] Write the first plan', '- [ ] Make the first screen', '- [x] Start the project'].join('\n'),
  'guides/decisions.md': ['# Decisions', '', '## Use plain Markdown', '', 'Every note is a Markdown file, so it opens anywhere.'].join('\n'),
  'notes/overview.md': ['# Overview', '', 'How the project fits together, one module at a time.'].join('\n'),
  'settings/agent-rules.json': JSON.stringify({ rules: { deny: ['git push --force', 'git add -A'], ask: ['git commit'] }, notes: 'Runs nothing; only says what an agent may do.' }, null, 2),
}

const papelizPreviewTemplateFileListEntries: PapelizTemplateFileListEntry[] = [
  ...Object.entries(papelizPreviewTemplateFileTexts).map(([templateFileRelativePath, templateFileText]) => ({
    templateFileRelativePath,
    templateFileByteCount: new TextEncoder().encode(templateFileText).length,
    templateFileSha256Base64: null,
    templateFileGitBlobSha1Hex: null,
    templateFileGitMode: null,
  })),
  { templateFileRelativePath: 'pictures/readme-picture.webp', templateFileByteCount: 41_300, templateFileSha256Base64: null, templateFileGitBlobSha1Hex: null, templateFileGitMode: null },
]

const createPreviewTemplateRunCommand = (
  templateRunCommandKind: PapelizTemplateRunCommand['templateRunCommandKind'],
  templateRunCommandSourceRelativePath: string,
  templateRunCommandText: string,
): PapelizTemplateRunCommand => ({
  templateRunCommandKind,
  templateRunCommandSourceRelativePath,
  templateRunCommandText,
  hasTemplateRunCommandHiddenCharacters: hasPapelizTemplateHiddenCharacter(templateRunCommandText) || hasPapelizTemplateHiddenCharacter(templateRunCommandSourceRelativePath),
})

// Every kind of line the commands list shows, one holding hidden characters (a zero-width space and a
// right-to-left override), which it marks.
const papelizPreviewTemplateRunCommands: PapelizTemplateRunCommand[] = [
  createPreviewTemplateRunCommand('agent-setting-command', '.claude/settings.json', 'node scripts/check-command.mjs'),
  createPreviewTemplateRunCommand('agent-setting-command', '.claude/settings.json', 'node scripts/status-line.mjs'),
  createPreviewTemplateRunCommand('agent-setting-command', '.claude/settings.json', 'npm run lint​ && echo done ‮# checked'),
  createPreviewTemplateRunCommand('agent-setting-environment', '.claude/settings.json', 'NODE_ENV=development'),
  createPreviewTemplateRunCommand('agent-setting-permission', '.claude/settings.json', 'Bash(npm test)'),
  createPreviewTemplateRunCommand('agent-command-file', '.claude/commands/review.md', '.claude/commands/review.md'),
  createPreviewTemplateRunCommand('script-file', 'scripts/check-command.mjs', 'check-command.mjs'),
  createPreviewTemplateRunCommand('script-file', 'scripts/status-line.mjs', 'status-line.mjs'),
]

// Every check passed, or the notes check failed (and the ones after it weren't run).
function buildPreviewTemplateCheckReport(isNotesCheckFailed: boolean, previewTemplateRunCommands: PapelizTemplateRunCommand[]): PapelizTemplateCheckReport {
  const passedCheckResult = (templateCheckId: PapelizTemplateCheckResult['templateCheckId'], templateCheckLabel: string, templateCheckSentence: string): PapelizTemplateCheckResult => ({
    templateCheckId,
    templateCheckLabel,
    templateCheckOutcome: 'passed',
    templateCheckSentence,
  })
  const templateCheckResults: PapelizTemplateCheckResult[] = [
    passedCheckResult('repository-public', 'Repository', 'The repository is public.'),
    passedCheckResult('license-allowed', 'License', 'Its license is MIT.'),
    passedCheckResult('manifest-valid', 'Manifest', 'The manifest names “Project Starter”.'),
    passedCheckResult('file-list-complete', 'File list', 'The file list is complete.'),
    passedCheckResult('file-count-and-size', 'Size', '10 files, 42.5 KB in all.'),
    passedCheckResult('file-paths', 'Names and folders', 'Every name works on Windows, macOS and Linux.'),
    passedCheckResult('file-types', 'File types', 'Every file is text, or a PNG, JPEG or WebP picture.'),
    passedCheckResult('no-git-lfs-pointers', 'Git LFS', 'No Git LFS pointers.'),
    passedCheckResult('file-hashes', 'File contents', 'Every file matches the file list.'),
    isNotesCheckFailed
      ? { templateCheckId: 'notes-safe', templateCheckLabel: 'Notes', templateCheckOutcome: 'failed', templateCheckSentence: 'notes/embed.md has a <script> tag. Remove it, push the change, and press Check again.' }
      : passedCheckResult('notes-safe', 'Notes', 'No note has a script, a frame, a form or a script link.'),
    isNotesCheckFailed
      ? { templateCheckId: 'json-files-parse', templateCheckLabel: 'JSON files', templateCheckOutcome: 'not-checked', templateCheckSentence: 'Not checked, since an earlier check failed.' }
      : passedCheckResult('json-files-parse', 'JSON files', 'Every JSON file reads correctly.'),
    passedCheckResult('first-note-present', 'First note', 'START.md is there.'),
  ]
  return {
    templateCheckResults,
    isEveryTemplateCheckPassed: !isNotesCheckFailed,
    templateManifest: null,
    templateLicenseId: 'MIT',
    templateIncludedFileRelativePaths: papelizPreviewTemplateFileListEntries.map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath),
    templateIncludedByteCount: 42_500,
    templateIncludedFileListDigest: null,
    templateRunCommands: previewTemplateRunCommands,
  }
}

// What a pick holds: the pages to open on, and the made-up gallery's state where it differs from the
// list read with Featured, New and Top 100.
interface PapelizTemplateGalleryPagePreviewerChoice {
  templateGalleryPagePreviewChoiceKey: string
  templateGalleryPagePreviewChoiceLabel: string
  TemplateGalleryPagePreviewChoiceIcon: LucideIcon
  templateGalleryPagePreviewGroupHeading?: string
  // The template the pages show, by repository name; the first made-up one when left out.
  previewTemplateRepositoryName?: string
  buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId: string) => PapelizTemplateGalleryScreen[]
  previewTemplateGalleryTab?: PapelizTemplateGalleryTab
  previewTemplateGallerySnapshotState?: PapelizTemplateGallerySnapshotState
  buildPreviewTemplateCheckRunState?: () => PapelizTemplateCheckRunState
  buildPreviewTemplateRecheckState?: (previewTemplateGalleryRow: PapelizTemplateGalleryRow, currentTime: number) => PapelizTemplateRecheckState
  buildPreviewTemplateUseState?: (previewTemplateGalleryRow: PapelizTemplateGalleryRow) => PapelizTemplateUseState
}

const galleryScreens = (): PapelizTemplateGalleryScreen[] => [{ templateGalleryScreenKind: 'gallery' }]
const templatePageScreens = (previewPapelizTemplateGalleryId: string): PapelizTemplateGalleryScreen[] => [
  { templateGalleryScreenKind: 'gallery' },
  { templateGalleryScreenKind: 'template-page', papelizTemplateGalleryId: previewPapelizTemplateGalleryId },
]
const submitScreens = (): PapelizTemplateGalleryScreen[] => [{ templateGalleryScreenKind: 'gallery' }, { templateGalleryScreenKind: 'submit' }]
const papelizPreviewSubmittedTemplateGalleryId = 'example-team/Project-Starter'
const papelizPreviewTemplateCommitSha = '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d'

const papelizTemplateGalleryPagePreviewerChoices: readonly PapelizTemplateGalleryPagePreviewerChoice[] = [
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-featured',
    templateGalleryPagePreviewChoiceLabel: 'Featured',
    TemplateGalleryPagePreviewChoiceIcon: LayoutTemplate,
    templateGalleryPagePreviewGroupHeading: 'Templates · Gallery',
    buildPreviewTemplateGalleryScreens: galleryScreens,
  },
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-new',
    templateGalleryPagePreviewChoiceLabel: 'New',
    TemplateGalleryPagePreviewChoiceIcon: LayoutTemplate,
    buildPreviewTemplateGalleryScreens: galleryScreens,
    previewTemplateGalleryTab: 'new',
  },
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-top-100',
    templateGalleryPagePreviewChoiceLabel: 'Top 100',
    TemplateGalleryPagePreviewChoiceIcon: Trophy,
    buildPreviewTemplateGalleryScreens: galleryScreens,
    previewTemplateGalleryTab: 'top-100',
  },
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-loading',
    templateGalleryPagePreviewChoiceLabel: 'Reading the List',
    TemplateGalleryPagePreviewChoiceIcon: Hourglass,
    buildPreviewTemplateGalleryScreens: galleryScreens,
    previewTemplateGalleryTab: 'top-100',
    previewTemplateGallerySnapshotState: { templateGallerySnapshotStage: 'loading' },
  },
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-offline',
    templateGalleryPagePreviewChoiceLabel: 'Offline',
    TemplateGalleryPagePreviewChoiceIcon: WifiOff,
    buildPreviewTemplateGalleryScreens: galleryScreens,
    previewTemplateGalleryTab: 'top-100',
    previewTemplateGallerySnapshotState: { templateGallerySnapshotStage: 'offline', templateGallerySnapshotProblemSentence: 'Check your connection, then try again.' },
  },
  {
    templateGalleryPagePreviewChoiceKey: 'gallery-not-available-yet',
    templateGalleryPagePreviewChoiceLabel: 'New Isn’t Available Yet',
    TemplateGalleryPagePreviewChoiceIcon: Hourglass,
    buildPreviewTemplateGalleryScreens: galleryScreens,
    previewTemplateGalleryTab: 'new',
    previewTemplateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
  },
  {
    templateGalleryPagePreviewChoiceKey: 'template-page',
    templateGalleryPagePreviewChoiceLabel: 'A Template’s Page',
    TemplateGalleryPagePreviewChoiceIcon: FileSearch,
    templateGalleryPagePreviewGroupHeading: 'Templates · A Template',
    buildPreviewTemplateGalleryScreens: templatePageScreens,
  },
  {
    templateGalleryPagePreviewChoiceKey: 'template-preview',
    templateGalleryPagePreviewChoiceLabel: 'Preview',
    TemplateGalleryPagePreviewChoiceIcon: Eye,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      { templateGalleryScreenKind: 'gallery' },
      { templateGalleryScreenKind: 'preview', papelizTemplateGalleryId: previewPapelizTemplateGalleryId },
    ],
  },
  {
    templateGalleryPagePreviewChoiceKey: 'recheck-up-to-date',
    templateGalleryPagePreviewChoiceLabel: 'Recheck: Up to Date',
    TemplateGalleryPagePreviewChoiceIcon: RefreshCw,
    buildPreviewTemplateGalleryScreens: templatePageScreens,
    buildPreviewTemplateRecheckState: (previewTemplateGalleryRow, currentTime) => ({
      templateRecheckStage: 'up-to-date',
      papelizTemplateGalleryId: previewTemplateGalleryRow.papelizTemplateGalleryId,
      templateRecheckedAt: currentTime,
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'recheck-updated',
    templateGalleryPagePreviewChoiceLabel: 'Recheck: Updated',
    TemplateGalleryPagePreviewChoiceIcon: RefreshCw,
    buildPreviewTemplateGalleryScreens: templatePageScreens,
    buildPreviewTemplateRecheckState: (previewTemplateGalleryRow, currentTime) => ({
      templateRecheckStage: 'updated',
      papelizTemplateGalleryId: previewTemplateGalleryRow.papelizTemplateGalleryId,
      templateRecheckedAt: currentTime,
      previousTemplateCommitSha: '0f9e8d7c6b5a49382716051f2e3d4c5b6a798081',
      templateCommitSha: previewTemplateGalleryRow.templateCommitSha,
      templateChangedFileCount: 3,
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'recheck-newest-fails',
    templateGalleryPagePreviewChoiceLabel: 'Recheck: Newest Fails a Check',
    TemplateGalleryPagePreviewChoiceIcon: CircleAlert,
    buildPreviewTemplateGalleryScreens: templatePageScreens,
    buildPreviewTemplateRecheckState: (previewTemplateGalleryRow, currentTime) => ({
      templateRecheckStage: 'newest-fails',
      papelizTemplateGalleryId: previewTemplateGalleryRow.papelizTemplateGalleryId,
      templateRecheckedAt: currentTime,
      newestTemplateCommitSha: '5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80',
      templateCheckReport: buildPreviewTemplateCheckReport(true, []),
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'recheck-repository-gone',
    templateGalleryPagePreviewChoiceLabel: 'Recheck: Repository Gone',
    TemplateGalleryPagePreviewChoiceIcon: CircleAlert,
    buildPreviewTemplateGalleryScreens: templatePageScreens,
    buildPreviewTemplateRecheckState: (previewTemplateGalleryRow) => ({
      templateRecheckStage: 'repository-gone',
      papelizTemplateGalleryId: previewTemplateGalleryRow.papelizTemplateGalleryId,
      templateRecheckProblemSentence: 'GitHub has no public repository named example-team/Project-Starter now. It may be private or deleted.',
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-commands',
    templateGalleryPagePreviewChoiceLabel: 'The Commands List',
    TemplateGalleryPagePreviewChoiceIcon: SquareTerminal,
    templateGalleryPagePreviewGroupHeading: 'Templates · Use Template',
    previewTemplateRepositoryName: 'Agent-Hooks-Starter',
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'commands', papelizTemplateGalleryId: previewPapelizTemplateGalleryId },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({
      templateUseStage: 'ready',
      templateGalleryRow: previewTemplateGalleryRow,
      templateCheckReport: buildPreviewTemplateCheckReport(false, papelizPreviewTemplateRunCommands),
      templateRunCommands: papelizPreviewTemplateRunCommands,
      isTemplateRunCommandsAcknowledged: false,
      templateHiddenFileRelativePaths: ['.claude/settings.json', '.gitignore'],
      templateLeftOutPictureRelativePaths: [],
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-preparing',
    templateGalleryPagePreviewChoiceLabel: 'Reading the Files',
    TemplateGalleryPagePreviewChoiceIcon: LoaderCircle,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'new-vault', papelizTemplateGalleryId: previewPapelizTemplateGalleryId, suggestedNewVaultName: 'Project Starter' },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({
      templateUseStage: 'preparing',
      templateGalleryRow: previewTemplateGalleryRow,
      templateFileReadProgress: { templateReadFileCount: 6, templateFileCount: 10 },
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-ready',
    templateGalleryPagePreviewChoiceLabel: 'New Vault’s Form',
    TemplateGalleryPagePreviewChoiceIcon: ClipboardCheck,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'new-vault', papelizTemplateGalleryId: previewPapelizTemplateGalleryId, suggestedNewVaultName: 'Project Starter' },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({
      templateUseStage: 'ready',
      templateGalleryRow: previewTemplateGalleryRow,
      templateCheckReport: buildPreviewTemplateCheckReport(false, []),
      templateRunCommands: [],
      isTemplateRunCommandsAcknowledged: false,
      templateHiddenFileRelativePaths: ['.gitignore'],
      templateLeftOutPictureRelativePaths: [],
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-failed',
    templateGalleryPagePreviewChoiceLabel: 'A Failed Check',
    TemplateGalleryPagePreviewChoiceIcon: CircleAlert,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'new-vault', papelizTemplateGalleryId: previewPapelizTemplateGalleryId, suggestedNewVaultName: 'Project Starter' },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({
      templateUseStage: 'failed',
      templateGalleryRow: previewTemplateGalleryRow,
      templateUseProblemSentence: `“${previewTemplateGalleryRow.templateName}” fails a check at this commit, so Papeliz can’t make a vault from it.`,
      templateCheckReport: buildPreviewTemplateCheckReport(true, []),
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-picking-folder',
    templateGalleryPagePreviewChoiceLabel: 'Choosing the Folder',
    TemplateGalleryPagePreviewChoiceIcon: FolderOpen,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'making-vault', papelizTemplateGalleryId: previewPapelizTemplateGalleryId, newVaultName: 'Project Starter', newVaultPlace: 'folder-on-disk' },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({ templateUseStage: 'picking-folder', templateGalleryRow: previewTemplateGalleryRow }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'use-making-vault',
    templateGalleryPagePreviewChoiceLabel: 'Making the Vault',
    TemplateGalleryPagePreviewChoiceIcon: LoaderCircle,
    buildPreviewTemplateGalleryScreens: (previewPapelizTemplateGalleryId) => [
      ...templatePageScreens(previewPapelizTemplateGalleryId),
      { templateGalleryScreenKind: 'making-vault', papelizTemplateGalleryId: previewPapelizTemplateGalleryId, newVaultName: 'Project Starter', newVaultPlace: 'browser-vault-in-opfs' },
    ],
    buildPreviewTemplateUseState: (previewTemplateGalleryRow) => ({
      templateUseStage: 'making-vault',
      templateGalleryRow: previewTemplateGalleryRow,
      templateWrittenFileCount: 7,
      templateFileCount: 11,
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'submit-empty',
    templateGalleryPagePreviewChoiceLabel: 'Submit Template',
    TemplateGalleryPagePreviewChoiceIcon: Upload,
    templateGalleryPagePreviewGroupHeading: 'Templates · Submit',
    buildPreviewTemplateGalleryScreens: submitScreens,
  },
  {
    templateGalleryPagePreviewChoiceKey: 'submit-checking',
    templateGalleryPagePreviewChoiceLabel: 'Checking',
    TemplateGalleryPagePreviewChoiceIcon: LoaderCircle,
    buildPreviewTemplateGalleryScreens: submitScreens,
    buildPreviewTemplateCheckRunState: () => ({
      templateCheckRunStage: 'reading-files',
      papelizTemplateGalleryId: papelizPreviewSubmittedTemplateGalleryId,
      templateCommitSha: papelizPreviewTemplateCommitSha,
      templateFileReadProgress: { templateReadFileCount: 4, templateFileCount: 10 },
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'submit-passed',
    templateGalleryPagePreviewChoiceLabel: 'Every Check Passed',
    TemplateGalleryPagePreviewChoiceIcon: ListChecks,
    buildPreviewTemplateGalleryScreens: submitScreens,
    buildPreviewTemplateCheckRunState: () => ({
      templateCheckRunStage: 'checked',
      papelizTemplateGalleryId: papelizPreviewSubmittedTemplateGalleryId,
      templateCommitSha: papelizPreviewTemplateCommitSha,
      templateCheckReport: buildPreviewTemplateCheckReport(false, []),
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'submit-failed-check',
    templateGalleryPagePreviewChoiceLabel: 'A Failed Check',
    TemplateGalleryPagePreviewChoiceIcon: CircleAlert,
    buildPreviewTemplateGalleryScreens: submitScreens,
    buildPreviewTemplateCheckRunState: () => ({
      templateCheckRunStage: 'checked',
      papelizTemplateGalleryId: papelizPreviewSubmittedTemplateGalleryId,
      templateCommitSha: papelizPreviewTemplateCommitSha,
      templateCheckReport: buildPreviewTemplateCheckReport(true, []),
    }),
  },
  {
    templateGalleryPagePreviewChoiceKey: 'submit-failed-to-read',
    templateGalleryPagePreviewChoiceLabel: 'Couldn’t Read GitHub',
    TemplateGalleryPagePreviewChoiceIcon: WifiOff,
    buildPreviewTemplateGalleryScreens: submitScreens,
    buildPreviewTemplateCheckRunState: () => ({
      templateCheckRunStage: 'failed-to-read',
      templateCheckRunProblemSentence: 'GitHub’s limit for this network is used up for now. Try again in about 20 minutes.',
    }),
  },
]

// A made-up gallery for one pick: the gallery store's state and actions, answering from the made-up
// templates. Tabs, the commands' tick and Cancel work; Check, Recheck and Use Template show the pick's
// own answer, and making a vault says it's only a preview.
function createPreviewTemplateGalleryModelStore(previewerChoice: PapelizTemplateGalleryPagePreviewerChoice, previewTemplateGalleryRows: PapelizTemplateGalleryRow[], currentTime: number) {
  const featuredPreviewRows = previewTemplateGalleryRows.filter((templateGalleryRow) => templateGalleryRow.isTemplateFeatured)
  const newPreviewRows = [...previewTemplateGalleryRows].sort((firstRow, secondRow) => (secondRow.templateListedAt ?? 0) - (firstRow.templateListedAt ?? 0))
  const previewTemplateGalleryRow =
    previewTemplateGalleryRows.find((templateGalleryRow) => templateGalleryRow.templateRepositoryName === previewerChoice.previewTemplateRepositoryName) ?? previewTemplateGalleryRows[0]
  const previewTemplateGalleryState: PapelizTemplateGalleryState = {
    templateGalleryTab: previewerChoice.previewTemplateGalleryTab ?? 'featured',
    featuredTemplateGalleryRows: featuredPreviewRows,
    newTemplateGalleryRows: newPreviewRows,
    topTemplateGalleryRows: previewTemplateGalleryRows,
    templateGallerySnapshotState: previewerChoice.previewTemplateGallerySnapshotState ?? { templateGallerySnapshotStage: 'loaded', templateGallerySnapshotBuiltAt: currentTime - 20 * 60_000 },
    templateCheckRunState: previewerChoice.buildPreviewTemplateCheckRunState?.() ?? { templateCheckRunStage: 'idle' },
    templateRecheckState:
      previewTemplateGalleryRow === undefined
        ? { templateRecheckStage: 'idle' }
        : (previewerChoice.buildPreviewTemplateRecheckState?.(previewTemplateGalleryRow, currentTime) ?? { templateRecheckStage: 'idle' }),
    templateUseState:
      previewTemplateGalleryRow === undefined ? { templateUseStage: 'idle' } : (previewerChoice.buildPreviewTemplateUseState?.(previewTemplateGalleryRow) ?? { templateUseStage: 'idle' }),
  }
  return createStore<PapelizTemplateGalleryScreenModel>()((set, get) => ({
    ...previewTemplateGalleryState,
    openTemplateGallery: async () => undefined,
    refreshTemplateGallery: async () => undefined,
    selectTemplateGalleryTab: (templateGalleryTab) => set({ templateGalleryTab }),
    findTemplateGalleryRow: (papelizTemplateGalleryId) => previewTemplateGalleryRows.find((templateGalleryRow) => templateGalleryRow.papelizTemplateGalleryId === papelizTemplateGalleryId) ?? null,
    checkTemplateRepositoryLink: async () =>
      set({
        templateCheckRunState: {
          templateCheckRunStage: 'checked',
          papelizTemplateGalleryId: papelizPreviewSubmittedTemplateGalleryId,
          templateCommitSha: papelizPreviewTemplateCommitSha,
          templateCheckReport: buildPreviewTemplateCheckReport(previewerChoice.templateGalleryPagePreviewChoiceKey === 'submit-failed-check', []),
        },
      }),
    resetTemplateCheckRun: () => set({ templateCheckRunState: { templateCheckRunStage: 'idle' } }),
    recheckTemplate: async (papelizTemplateGalleryId) => {
      const recheckedTemplateGalleryRow = get().findTemplateGalleryRow(papelizTemplateGalleryId)
      if (recheckedTemplateGalleryRow === null) return
      set({
        templateRecheckState: previewerChoice.buildPreviewTemplateRecheckState?.(recheckedTemplateGalleryRow, currentTime) ?? {
          templateRecheckStage: 'up-to-date',
          papelizTemplateGalleryId,
          templateRecheckedAt: currentTime,
        },
      })
    },
    resetTemplateRecheck: () => set({ templateRecheckState: { templateRecheckStage: 'idle' } }),
    prepareTemplateUse: async (templateGalleryRow) =>
      set({
        templateUseState: {
          templateUseStage: 'ready',
          templateGalleryRow,
          templateCheckReport: buildPreviewTemplateCheckReport(false, templateGalleryRow.isTemplateRunningCommands ? papelizPreviewTemplateRunCommands : []),
          templateRunCommands: templateGalleryRow.isTemplateRunningCommands ? papelizPreviewTemplateRunCommands : [],
          isTemplateRunCommandsAcknowledged: false,
          templateHiddenFileRelativePaths: ['.gitignore'],
          templateLeftOutPictureRelativePaths: [],
        },
      }),
    acknowledgeTemplateRunCommands: (isTemplateRunCommandsAcknowledged) => {
      const { templateUseState } = get()
      if (templateUseState.templateUseStage === 'ready') set({ templateUseState: { ...templateUseState, isTemplateRunCommandsAcknowledged } })
    },
    makePapelizTemplateVault: async () => ({ openVaultOutcome: 'failed', openVaultFailureMessage: 'Nothing changed: this is only a preview.', templateFirstNotePath: null }),
    importPapelizTemplateIntoVault: async () => ({ vaultFolderImportOutcome: 'failed', vaultFolderImportFailureMessage: 'Nothing changed: this is only a preview.', templateFirstNotePath: null }),
    cancelTemplateUse: () => set({ templateUseState: { templateUseStage: 'idle' } }),
    listTemplateIncludedFiles: async () => papelizPreviewTemplateFileListEntries,
    readTemplateFileText: async (_templateGalleryRow, templateFileRelativePath) => papelizPreviewTemplateFileTexts[templateFileRelativePath] ?? '',
    buildTemplatePictureUrl: () => drawPreviewTemplateThumbnail('#1f6feb', '#ffffffcc'),
    buildTemplateAuthorPictureUrl: drawPreviewAuthorPicture,
  }))
}

let templateGalleryPagePreviewCount = 0

// The Templates pages' rows in the start screen's previewer, under their group headings. A pick opens
// the pages in that state, after `onTemplateGalleryPagePreviewHold` lets the previewer put any other
// page it holds back to live.
export function usePapelizTemplateGalleryPagePreviewerMenuItems(onTemplateGalleryPagePreviewHold: () => void): PapelizPopoverMenuItem[] {
  const heldTemplateGalleryPagePreview = usePapelizTemplateGalleryPagePreviewStore((templateGalleryPagePreviewState) => templateGalleryPagePreviewState.heldTemplateGalleryPagePreview)
  return papelizTemplateGalleryPagePreviewerChoices.map(
    (previewerChoice): PapelizPopoverMenuItem => ({
      menuItemKey: `template-gallery-${previewerChoice.templateGalleryPagePreviewChoiceKey}`,
      menuItemLabel: previewerChoice.templateGalleryPagePreviewChoiceLabel,
      MenuItemIcon: previewerChoice.TemplateGalleryPagePreviewChoiceIcon,
      menuItemGroupHeading: previewerChoice.templateGalleryPagePreviewGroupHeading,
      isMenuItemChecked: heldTemplateGalleryPagePreview?.templateGalleryPagePreviewChoiceKey === previewerChoice.templateGalleryPagePreviewChoiceKey,
      onMenuItemSelect: () => {
        onTemplateGalleryPagePreviewHold()
        const currentTime = Date.now()
        const previewTemplateGalleryRows = listPreviewTemplateGalleryRows(currentTime)
        const previewTemplateGalleryRow =
          previewTemplateGalleryRows.find((templateGalleryRow) => templateGalleryRow.templateRepositoryName === previewerChoice.previewTemplateRepositoryName) ?? previewTemplateGalleryRows[0]
        templateGalleryPagePreviewCount += 1
        usePapelizTemplateGalleryPagePreviewStore.setState({
          heldTemplateGalleryPagePreview: {
            templateGalleryPagePreviewNumber: templateGalleryPagePreviewCount,
            templateGalleryPagePreviewChoiceKey: previewerChoice.templateGalleryPagePreviewChoiceKey,
            previewTemplateGalleryScreens: previewerChoice.buildPreviewTemplateGalleryScreens(previewTemplateGalleryRow?.papelizTemplateGalleryId ?? ''),
            previewTemplateGalleryModelStore: createPreviewTemplateGalleryModelStore(previewerChoice, previewTemplateGalleryRows, currentTime),
          },
        })
      },
    }),
  )
}
