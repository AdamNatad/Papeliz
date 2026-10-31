import { useMemo } from 'react'
import { create } from 'zustand'
import { papelizHiddenVaultEntriesShownSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import { getVaultNoteRelativePathForNewWikilinkTarget } from '../links/papeliz-wikilink-targets'
import type { PapelizNoteViewMode } from '../note-editor/papeliz-note-editor'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import {
  describePapelizVaultError,
  isPapelizVaultEntryMissingError,
  isPapelizVaultKeptBeyondThisTab,
  PapelizVaultOperationError,
  type PapelizVaultEntryKind,
  type PapelizVaultTreeEntry,
} from '../vault/papeliz-vault-adapter'
import {
  describeVaultEntryNameProblem,
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultNoteFileName,
  isVaultRelativePathInsideFolder,
  joinVaultRelativePath,
  papelizVaultChatSessionFolderName,
  papelizVaultNoteFileExtension,
  papelizVaultRootFolderRelativePath,
  papelizVaultSettingsFolderName,
  pickFreeVaultEntryName,
  replaceVaultRelativePathPrefix,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import {
  reportPapelizSyncVaultEntryMovedToTrash,
  reportPapelizSyncVaultEntryRenamed,
  reportPapelizSyncVaultFileSaved,
  reportPapelizSyncVaultFolderCopied,
} from '../sync/papeliz-sync-workspace-reports'
import {
  carryVaultEntryOrderThroughMove,
  formatPapelizFileListOrderFile,
  listVaultFolderEntryNamesInOrder,
  papelizFileListOrderFileName,
  parsePapelizFileListOrderFile,
  placeVaultEntryName,
  type PapelizVaultEntryOrder,
  type PapelizVaultEntryPlacement,
} from './papeliz-vault-entry-order'
import { usePapelizWorkspacePanelWidthsStore } from './papeliz-workspace-panel-widths-store'
import {
  carryVaultEntryLocksThroughMove,
  findLockingVaultEntry,
  findVaultNoteEditingLock,
  formatPapelizLockedEntriesFile,
  papelizLockedEntriesFileName,
  parsePapelizLockedEntriesFile,
  parsePapelizWholeVaultEditingLock,
  type PapelizVaultNoteEditingLock,
  removeVaultEntryLocksInside,
} from './papeliz-vault-entry-locks'
import {
  carryVaultEntryLooksThroughMove,
  formatPapelizFileListLooksFile,
  papelizFileListLooksFileName,
  parsePapelizFileListLooksFile,
  removeVaultEntryLooksInside,
  setPapelizVaultEntryLook,
  type PapelizVaultEntryLook,
  type PapelizVaultEntryLooks,
} from './papeliz-vault-entry-looks'
import { mergePapelizVaultNoteText, resolvePapelizVaultNoteMerge, type PapelizVaultNoteMergeChoice, type PapelizVaultNoteMergeResult } from '../vault/papeliz-vault-note-merge'
import {
  deletePapelizNoteRecoveryDraft,
  papelizNoteRecoveryDraftAfterTypingStopsMilliseconds,
  papelizNoteRecoveryDraftWhileTypingMilliseconds,
  readPapelizNoteRecoveryDraft,
  writePapelizNoteRecoveryDraft,
} from './papeliz-note-recovery-drafts'
import {
  announcePapelizVaultChange,
  createPapelizVaultChangeReloadScheduler,
  papelizVaultChangePollMilliseconds,
  subscribeToPapelizVaultChanges,
} from './papeliz-vault-change-channel'

export type { PapelizNoteViewMode }
export type { PapelizVaultEntryPlacement }

// The locked note or folder that keeps the open note from being edited, or null.
export function selectActiveVaultNoteLockingEntry(workspaceState: Pick<PapelizWorkspaceState, 'lockedVaultEntryRelativePaths' | 'activeVaultNoteRelativePath'>): string | null {
  return findLockingVaultEntry(workspaceState.lockedVaultEntryRelativePaths, workspaceState.activeVaultNoteRelativePath)
}
// What keeps the open note from being edited, or null: a hidden folder, the whole vault's lock, or
// its own or a folder's lock.
export function usePapelizActiveVaultNoteEditingLock(): PapelizVaultNoteEditingLock | null {
  const isWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.isWholeVaultEditingLocked)
  const lockedVaultEntryRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.lockedVaultEntryRelativePaths)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  return useMemo(
    () => findVaultNoteEditingLock(isWholeVaultEditingLocked, lockedVaultEntryRelativePaths, activeVaultNoteRelativePath),
    [isWholeVaultEditingLocked, lockedVaultEntryRelativePaths, activeVaultNoteRelativePath],
  )
}

// 'save-conflict': the note was saved elsewhere (another tab, another app) while this tab had changes
// to it, and the two touch the same lines; the save waits for the user to settle them.
export type PapelizNoteSaveState = 'saved' | 'unsaved' | 'saving' | 'save-failed' | 'save-conflict'

// A note saved elsewhere while this tab had changes to it, where the two edits touch the same lines.
// A save that can't go ahead by itself: both changed the same lines, or the note was moved or
// trashed elsewhere while this tab had changes to it.
export type PapelizVaultNoteSaveConflict =
  | {
      vaultNoteSaveConflictKind: 'same-lines-changed'
      vaultNoteRelativePath: string
      // The version this tab's changes were made on, the version saved since, and this tab's.
      baseVaultNoteText: string
      savedElsewhereVaultNoteText: string
      myVaultNoteText: string
      vaultNoteMergeResult: PapelizVaultNoteMergeResult
    }
  | {
      vaultNoteSaveConflictKind: 'deleted-elsewhere'
      vaultNoteRelativePath: string
    }

// What to do with a note moved or trashed elsewhere: write this tab's copy back, or close it.
export type PapelizVaultNoteDeletedElsewhereChoice = 'keep-my-copy' | 'close-note'

// One note that has been opened in a tab. `loadedNoteSessionId` stays the same across renames, so
// the MD Code keeps its undo history and autosave keeps writing to the right file.
export interface PapelizLoadedVaultNote {
  loadedNoteSessionId: number
  noteLoadState: 'loading' | 'loaded' | 'load-failed'
  noteLoadErrorMessage: string | null
  savedVaultNoteText: string
  draftVaultNoteText: string
  noteSaveState: PapelizNoteSaveState
  noteSaveErrorMessage: string | null
}

export interface PapelizWorkspaceNoticeAction {
  workspaceNoticeActionLabel: string
  onWorkspaceNoticeAction: () => void
}

export interface PapelizWorkspaceNotice {
  workspaceNoticeId: number
  workspaceNoticeKind: 'info' | 'error'
  workspaceNoticeMessage: string
  // A button in the toast, such as Try again.
  workspaceNoticeAction: PapelizWorkspaceNoticeAction | null
}

// An AI Assistant proposal shown whole, read-only, in a tab of its own in place of the open note,
// until it is accepted, rejected or closed. It is held in memory: nothing is written for it.
export interface PapelizAssistantProposalPreview {
  previewedAssistantProposalId: string
  previewedVaultNoteRelativePath: string
  previewedVaultNoteText: string
}

export type PapelizVaultEntryRenameResult =
  | { vaultEntryRenameOutcome: 'renamed' | 'unchanged'; renamedVaultEntryRelativePath: string }
  | { vaultEntryRenameOutcome: 'refused'; vaultEntryRenameProblem: string }

interface PapelizWorkspaceState {
  openVault: PapelizOpenVault | null
  vaultTreeEntries: PapelizVaultTreeEntry[]
  vaultTreeLoadState: 'loading' | 'loaded' | 'load-failed'
  openNoteTabRelativePaths: string[]
  activeVaultNoteRelativePath: string | null
  loadedVaultNotesByRelativePath: Record<string, PapelizLoadedVaultNote>
  noteViewMode: PapelizNoteViewMode
  // Lock: the note can be read, selected and searched, but not changed, in both views.
  // The note or folder Copy picked up, waiting for Paste.
  copiedVaultEntry: PapelizVaultTreeEntry | null
  // Notes and folders locked against editing in the open vault (papeliz-vault-entry-locks.ts).
  lockedVaultEntryRelativePaths: readonly string[]
  // Each note's or folder's color and icon in the file list (papeliz-vault-entry-looks.ts).
  vaultEntryLooks: PapelizVaultEntryLooks
  // Lock All Notes: every note is read-only, the per-note and per-folder locks above kept as they are.
  isWholeVaultEditingLocked: boolean
  // Show Hidden: the file list also lists hidden folders and notes (`.csessions`, `.trash`, …).
  areHiddenVaultEntriesShown: boolean
  expandedVaultFolderRelativePaths: Record<string, true>
  vaultEntryBeingRenamedRelativePath: string | null
  isExplorerPanelOpen: boolean
  isAssistantPanelOpen: boolean
  // Which of the two side panels opened last: it stays when the window gets too narrow for both.
  lastOpenedWorkspaceSidePanel: PapelizWorkspaceSidePanel
  isFocusModeOn: boolean
  // The "Close vault?" question is open. Every button that leaves the vault asks it first.
  isVaultCloseConfirmationShown: boolean
  // The file list's chosen order in the open vault (see papeliz-vault-entry-order.ts).
  vaultEntryOrder: PapelizVaultEntryOrder
  workspaceNotice: PapelizWorkspaceNotice | null
  assistantProposalPreview: PapelizAssistantProposalPreview | null
  // Saves waiting on the user to settle a clash with a version saved elsewhere, by loaded note.
  vaultNoteSaveConflictsByLoadedNoteSessionId: Record<number, PapelizVaultNoteSaveConflict>

  openVaultInWorkspace: (papelizOpenVault: PapelizOpenVault, openVaultOptions: PapelizOpenVaultInWorkspaceOptions) => Promise<void>
  closeVaultInWorkspace: () => Promise<void>
  refreshVaultTree: () => Promise<void>
  openVaultNote: (vaultNoteRelativePath: string) => Promise<void>
  openOrCreateVaultNoteForWikilinkTarget: (wikilinkTargetVaultNoteRelativePath: string | null, wikilinkTargetNoteName: string) => Promise<void>
  closeVaultNoteTab: (vaultNoteRelativePath: string) => Promise<void>
  // Puts an open note's tab at `targetNoteTabIndex` among the open tabs (a drag in the tab strip).
  moveVaultNoteTab: (vaultNoteRelativePath: string, targetNoteTabIndex: number) => void
  updateVaultNoteDraftText: (loadedNoteSessionId: number, draftVaultNoteText: string) => void
  saveVaultNoteNow: (vaultNoteRelativePath: string) => Promise<void>
  saveAllVaultNotesNow: () => Promise<void>
  createVaultNoteInFolder: (vaultFolderRelativePath: string) => Promise<void>
  createVaultFolderInFolder: (vaultFolderRelativePath: string) => Promise<void>
  renameVaultEntry: (vaultEntryRelativePath: string, typedVaultEntryName: string) => Promise<PapelizVaultEntryRenameResult>
  moveVaultEntryToTrash: (vaultEntryRelativePath: string) => Promise<void>
  // Moves a note or folder into another folder ('' is the top of the vault), as a drag in the file
  // list does. Refused, with a notice, when the name is taken there or a folder would go into itself.
  moveVaultEntryIntoFolder: (vaultEntryRelativePath: string, targetVaultFolderRelativePath: string) => Promise<void>
  // For accepted assistant proposals. An open note changes in its tab (so Undo can take it back)
  // and is saved right away; a closed note is written straight to the vault. Both throw on failure.
  // `assistantVaultNoteWritePurpose` 'saved-chat-session' marks the Assistant's own saved chat, which
  // is kept up to date whatever is locked.
  writeVaultNoteTextFromAssistant: (
    vaultNoteRelativePath: string,
    newVaultNoteText: string,
    assistantVaultNoteWritePurpose?: PapelizAssistantVaultNoteWritePurpose,
  ) => Promise<void>
  createVaultNoteFromAssistant: (
    vaultNoteRelativePath: string,
    vaultNoteText: string,
    assistantVaultNoteWritePurpose?: PapelizAssistantVaultNoteWritePurpose,
  ) => Promise<void>
  // For an accepted AI Assistant proposal to move notes and folders into `.trash`: one after another,
  // with one notice for all. The caller checks first that each may go
  // (papeliz-assistant-vault-entry-trash.ts). Throws on the first that fails.
  moveVaultEntriesToTrashFromAssistant: (vaultEntryRelativePaths: readonly string[]) => Promise<void>
  // Saves a picture added to an AI Assistant chat beside the chats, in `.csessions/attachments/`,
  // under a free name made from `preferredAttachmentFileName`. Gives back where it went.
  createChatAttachmentFileFromAssistant: (preferredAttachmentFileName: string, attachmentFileBlob: Blob) => Promise<string>
  // A note's or folder's color and icon in the file list; an empty look puts back the default.
  setVaultEntryLook: (vaultEntryRelativePath: string, vaultEntryLook: PapelizVaultEntryLook) => void
  setNoteViewMode: (noteViewMode: PapelizNoteViewMode) => void
  toggleNoteViewMode: () => void
  // Makes a copy beside the original ("Plan copy.md"), right after it in the file list.
  duplicateVaultEntry: (vaultEntryRelativePath: string) => Promise<void>
  // Copy picks a note or folder up; Paste puts a copy of it into a folder (its own name when free).
  copyVaultEntryForPaste: (copiedVaultEntry: PapelizVaultTreeEntry) => void
  pasteCopiedVaultEntry: (targetVaultFolderRelativePath: string) => Promise<void>
  // Locks or unlocks a note or a folder (and so every note in it).
  setVaultEntryEditingLocked: (vaultEntryRelativePath: string, isVaultEntryEditingLocked: boolean) => void
  // Locks every note, or lifts that, leaving each note's and folder's own lock as it was.
  setWholeVaultEditingLocked: (isWholeVaultEditingLocked: boolean) => void
  // Shows or hides hidden folders and notes in the file list; remembered in this browser.
  setHiddenVaultEntriesShown: (areHiddenVaultEntriesShown: boolean) => void
  toggleVaultFolderExpanded: (vaultFolderRelativePath: string) => void
  // Opens the file list with `vaultEntryRelativePath` in sight: its folders (and itself, when it is
  // a folder) expanded. The breadcrumbs above a note use it.
  revealVaultEntryInFileList: (vaultEntryRelativePath: string, vaultEntryKind: PapelizVaultEntryKind) => void
  startRenamingVaultEntry: (vaultEntryRelativePath: string) => void
  stopRenamingVaultEntry: () => void
  // Opening the file list or the Assistant closes the other when both won't fit beside the note.
  setExplorerPanelOpen: (isExplorerPanelOpen: boolean) => void
  setAssistantPanelOpen: (isAssistantPanelOpen: boolean) => void
  // After the window is resized or the saved widths load: when both side panels are open and no
  // longer fit, the one opened first closes. After a panel is dragged wider, the dragged one stays.
  fitWorkspaceSidePanelsToWindow: (keptWorkspaceSidePanel?: PapelizWorkspaceSidePanel) => void
  setFocusModeOn: (isFocusModeOn: boolean) => void
  setVaultCloseConfirmationShown: (isVaultCloseConfirmationShown: boolean) => void
  // Puts a note or folder at a place in a folder's order: a drag in the file list. Moves it into
  // that folder first when it is somewhere else.
  placeVaultEntryInFolder: (
    vaultEntryRelativePath: string,
    targetVaultFolderRelativePath: string,
    vaultEntryPlacement: PapelizVaultEntryPlacement,
  ) => Promise<void>
  // Swaps an entry with the one above or below it in its folder (Move up / Move down).
  moveVaultEntryUpOrDown: (vaultEntryRelativePath: string, vaultEntryMoveDirection: 'up' | 'down') => void
  showWorkspaceNotice: (
    workspaceNoticeKind: PapelizWorkspaceNotice['workspaceNoticeKind'],
    workspaceNoticeMessage: string,
    workspaceNoticeAction?: PapelizWorkspaceNoticeAction,
  ) => void
  dismissWorkspaceNotice: () => void
  showAssistantProposalPreview: (assistantProposalPreview: PapelizAssistantProposalPreview) => void
  // Writes the note with each clash settled (Keep both, Keep saved or Keep mine).
  resolveVaultNoteSaveConflict: (
    loadedNoteSessionId: number,
    mergeChoicesByConflictId: Readonly<Record<string, PapelizVaultNoteMergeChoice>>,
  ) => Promise<void>
  // Writes the note back as this tab has it, or closes it and lets its changes go.
  resolveVaultNoteDeletedElsewhere: (loadedNoteSessionId: number, deletedElsewhereChoice: PapelizVaultNoteDeletedElsewhereChoice) => Promise<void>
  closeAssistantProposalPreview: () => void
}

export interface PapelizOpenVaultInWorkspaceOptions {
  firstVaultNoteRelativePathToOpen: string | null
  firstNoteViewMode: PapelizNoteViewMode
  expandAllTopLevelFolders: boolean
}

export type PapelizWorkspaceSidePanel = 'explorer' | 'assistant'

// Why the Assistant writes a note: a change the user accepted, or its own saved chat.
export type PapelizAssistantVaultNoteWritePurpose = 'accepted-change' | 'saved-chat-session'

const papelizAutosaveDelayMilliseconds = 700
const papelizWideScreenMediaQuery = '(min-width: 768px)'
// The Assistant starts open only in a window wide enough for it, the file list and the note.
const papelizAssistantOpenAtStartMediaQuery = '(min-width: 1280px)'
// The note keeps at least this much width beside the docked file list and Assistant.
export const papelizNoteAreaMinimumWidth = 480

let nextLoadedNoteSessionId = 1
let nextWorkspaceNoticeId = 1
const autosaveTimersByLoadedNoteSessionId = new Map<number, ReturnType<typeof setTimeout>>()

// Saves, creates, renames and moves run one at a time, in order. A rename therefore never races an
// autosave of the same note, and an autosave queued during a rename writes to the new name. A browser
// vault also runs each under its writes lock, so this browser's other tabs wait their turn.
let vaultOperationQueueTail: Promise<unknown> = Promise.resolve()
function runVaultOperationInOrder<VaultOperationResult>(vaultOperation: () => Promise<VaultOperationResult>): Promise<VaultOperationResult> {
  const runVaultOperationExclusively = () => {
    const openVaultAdapter = usePapelizWorkspaceStore.getState().openVault?.papelizVaultAdapter
    return openVaultAdapter?.runVaultChangeExclusively === undefined ? vaultOperation() : openVaultAdapter.runVaultChangeExclusively(vaultOperation)
  }
  const vaultOperationResult = vaultOperationQueueTail.then(runVaultOperationExclusively, runVaultOperationExclusively)
  vaultOperationQueueTail = vaultOperationResult.catch(() => undefined)
  return vaultOperationResult
}

function matchesMediaQuery(mediaQueryText: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(mediaQueryText).matches
}

export function isWideScreenForPapelizWorkspace(): boolean {
  return matchesMediaQuery(papelizWideScreenMediaQuery)
}

// Whether the file list and the Assistant both fit docked beside the note in this window, at their
// widths (each capped as the workspace caps it). On a phone they are drawers, one at a time.
function doWorkspaceSidePanelsFitBesideNote(): boolean {
  if (typeof window === 'undefined') return true
  if (!isWideScreenForPapelizWorkspace()) return false
  const { explorerPanelWidth, assistantPanelWidth } = usePapelizWorkspacePanelWidthsStore.getState()
  const dockedExplorerPanelWidth = Math.min(explorerPanelWidth, window.innerWidth * 0.4)
  const dockedAssistantPanelWidth = Math.min(assistantPanelWidth, window.innerWidth * 0.45)
  return dockedExplorerPanelWidth + dockedAssistantPanelWidth + papelizNoteAreaMinimumWidth <= window.innerWidth
}

function cancelAutosaveTimer(loadedNoteSessionId: number): void {
  const autosaveTimer = autosaveTimersByLoadedNoteSessionId.get(loadedNoteSessionId)
  if (autosaveTimer !== undefined) clearTimeout(autosaveTimer)
  autosaveTimersByLoadedNoteSessionId.delete(loadedNoteSessionId)
}

function findVaultNoteRelativePathForSession(
  loadedVaultNotesByRelativePath: Record<string, PapelizLoadedVaultNote>,
  loadedNoteSessionId: number,
): string | null {
  for (const [vaultNoteRelativePath, loadedVaultNote] of Object.entries(loadedVaultNotesByRelativePath)) {
    if (loadedVaultNote.loadedNoteSessionId === loadedNoteSessionId) return vaultNoteRelativePath
  }
  return null
}

function sortVaultTreeEntries(vaultTreeEntries: PapelizVaultTreeEntry[]): PapelizVaultTreeEntry[] {
  return [...vaultTreeEntries].sort((firstEntry, secondEntry) =>
    firstEntry.vaultEntryRelativePath.localeCompare(secondEntry.vaultEntryRelativePath, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function isVaultEntryNameTakenInFolder(
  vaultTreeEntries: readonly PapelizVaultTreeEntry[],
  vaultFolderRelativePath: string,
  candidateVaultEntryName: string,
  ignoredVaultEntryRelativePath: string | null = null,
): boolean {
  const lowerCaseCandidatePath = joinVaultRelativePath(vaultFolderRelativePath, candidateVaultEntryName).toLowerCase()
  return vaultTreeEntries.some(
    (vaultTreeEntry) =>
      vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === lowerCaseCandidatePath &&
      vaultTreeEntry.vaultEntryRelativePath !== ignoredVaultEntryRelativePath,
  )
}

function createInitialWorkspaceLayout() {
  return {
    isExplorerPanelOpen: matchesMediaQuery(papelizWideScreenMediaQuery),
    isAssistantPanelOpen: matchesMediaQuery(papelizAssistantOpenAtStartMediaQuery) && doWorkspaceSidePanelsFitBesideNote(),
    lastOpenedWorkspaceSidePanel: 'explorer' as PapelizWorkspaceSidePanel,
    isFocusModeOn: false,
    isVaultCloseConfirmationShown: false,
    vaultEntryOrder: {},
  }
}

export const usePapelizWorkspaceStore = create<PapelizWorkspaceState>()((setWorkspaceState, getWorkspaceState) => {
  const updateLoadedVaultNoteForSession = (
    loadedNoteSessionId: number,
    updateLoadedVaultNote: (loadedVaultNote: PapelizLoadedVaultNote) => PapelizLoadedVaultNote,
  ) => {
    setWorkspaceState((workspaceState) => {
      const vaultNoteRelativePath = findVaultNoteRelativePathForSession(workspaceState.loadedVaultNotesByRelativePath, loadedNoteSessionId)
      if (vaultNoteRelativePath === null) return workspaceState
      const loadedVaultNote = workspaceState.loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote === undefined) return workspaceState
      return {
        loadedVaultNotesByRelativePath: {
          ...workspaceState.loadedVaultNotesByRelativePath,
          [vaultNoteRelativePath]: updateLoadedVaultNote(loadedVaultNote),
        },
      }
    })
  }

  // Recovery copies of unsaved typing (papeliz-note-recovery-drafts.ts): 1 s after typing stops, at
  // least every 2 s while it goes on, at once when the tab is hidden; a folder's or a browser vault's
  // notes, not the sample's.
  const noteRecoveryDraftTimersByLoadedNoteSessionId = new Map<number, { recoveryDraftTimer: ReturnType<typeof setTimeout>; firstUnwrittenChangeAt: number }>()
  const writeNoteRecoveryDraftNow = (loadedNoteSessionId: number) => {
    const pendingRecoveryDraft = noteRecoveryDraftTimersByLoadedNoteSessionId.get(loadedNoteSessionId)
    if (pendingRecoveryDraft !== undefined) clearTimeout(pendingRecoveryDraft.recoveryDraftTimer)
    noteRecoveryDraftTimersByLoadedNoteSessionId.delete(loadedNoteSessionId)
    const { openVault, loadedVaultNotesByRelativePath } = getWorkspaceState()
    if (openVault === null || !isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) return
    const vaultNoteRelativePath = findVaultNoteRelativePathForSession(loadedVaultNotesByRelativePath, loadedNoteSessionId)
    const loadedVaultNote = vaultNoteRelativePath === null ? undefined : loadedVaultNotesByRelativePath[vaultNoteRelativePath]
    if (vaultNoteRelativePath === null || loadedVaultNote?.noteLoadState !== 'loaded') return
    if (loadedVaultNote.draftVaultNoteText === loadedVaultNote.savedVaultNoteText) return
    void writePapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath, loadedVaultNote.draftVaultNoteText, loadedVaultNote.savedVaultNoteText).catch(
      () => undefined,
    )
  }
  const scheduleNoteRecoveryDraft = (loadedNoteSessionId: number) => {
    const typedAt = Date.now()
    const pendingRecoveryDraft = noteRecoveryDraftTimersByLoadedNoteSessionId.get(loadedNoteSessionId)
    const firstUnwrittenChangeAt = pendingRecoveryDraft?.firstUnwrittenChangeAt ?? typedAt
    if (pendingRecoveryDraft !== undefined) clearTimeout(pendingRecoveryDraft.recoveryDraftTimer)
    const waitedWhileTypingMilliseconds = typedAt - firstUnwrittenChangeAt
    if (waitedWhileTypingMilliseconds >= papelizNoteRecoveryDraftWhileTypingMilliseconds) {
      writeNoteRecoveryDraftNow(loadedNoteSessionId)
      return
    }
    noteRecoveryDraftTimersByLoadedNoteSessionId.set(loadedNoteSessionId, {
      recoveryDraftTimer: setTimeout(
        () => writeNoteRecoveryDraftNow(loadedNoteSessionId),
        Math.min(papelizNoteRecoveryDraftAfterTypingStopsMilliseconds, papelizNoteRecoveryDraftWhileTypingMilliseconds - waitedWhileTypingMilliseconds),
      ),
      firstUnwrittenChangeAt,
    })
  }
  const writeEveryNoteRecoveryDraftNow = () => {
    for (const loadedVaultNote of Object.values(getWorkspaceState().loadedVaultNotesByRelativePath)) writeNoteRecoveryDraftNow(loadedVaultNote.loadedNoteSessionId)
  }

  // A note just opened that has a recovery copy different from what is on disk offers it back. The
  // copy goes in as unsaved changes made on its own base, so saving merges it with anything saved
  // since rather than writing over it.
  const offerNoteRecoveryDraft = async (openVault: PapelizOpenVault, vaultNoteRelativePath: string, loadedNoteSessionId: number, vaultNoteTextOnDisk: string) => {
    if (!isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) return
    const noteRecoveryDraft = await readPapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath)
    if (noteRecoveryDraft === null || getWorkspaceState().openVault !== openVault) return
    if (noteRecoveryDraft.recoveryDraftVaultNoteText === vaultNoteTextOnDisk) {
      void deletePapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath).catch(() => undefined)
      return
    }
    showWorkspaceNotice('info', `Unsaved changes to “${getVaultNoteTitle(vaultNoteRelativePath)}” were kept from before.`, {
      workspaceNoticeActionLabel: 'Restore',
      onWorkspaceNoticeAction: () => {
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          savedVaultNoteText: noteRecoveryDraft.recoveryDraftBaseVaultNoteText,
          draftVaultNoteText: noteRecoveryDraft.recoveryDraftVaultNoteText,
          noteSaveState: 'unsaved',
        }))
        scheduleAutosave(loadedNoteSessionId)
      },
    })
  }

  const scheduleAutosave = (loadedNoteSessionId: number) => {
    cancelAutosaveTimer(loadedNoteSessionId)
    autosaveTimersByLoadedNoteSessionId.set(
      loadedNoteSessionId,
      setTimeout(() => {
        autosaveTimersByLoadedNoteSessionId.delete(loadedNoteSessionId)
        void saveLoadedVaultNote(loadedNoteSessionId)
      }, papelizAutosaveDelayMilliseconds),
    )
  }

  const saveLoadedVaultNote = (loadedNoteSessionId: number): Promise<void> => {
    cancelAutosaveTimer(loadedNoteSessionId)
    return runVaultOperationInOrder(async () => {
      const workspaceState = getWorkspaceState()
      const openVault = workspaceState.openVault
      const vaultNoteRelativePath = findVaultNoteRelativePathForSession(workspaceState.loadedVaultNotesByRelativePath, loadedNoteSessionId)
      if (openVault === null || vaultNoteRelativePath === null) return
      const loadedVaultNote = workspaceState.loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote === undefined || loadedVaultNote.noteLoadState !== 'loaded') return
      if (loadedVaultNote.draftVaultNoteText === loadedVaultNote.savedVaultNoteText) {
        if (loadedVaultNote.noteSaveState !== 'saved') {
          updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({ ...note, noteSaveState: 'saved', noteSaveErrorMessage: null }))
        }
        return
      }
      if (getWorkspaceState().vaultNoteSaveConflictsByLoadedNoteSessionId[loadedNoteSessionId] !== undefined) return
      const draftVaultNoteTextAtSave = loadedVaultNote.draftVaultNoteText
      updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({ ...note, noteSaveState: 'saving' }))
      try {
        // Saved elsewhere (another tab, another app) since this tab read it: merge the two, so neither
        // side's changes are lost. A clash of the same lines waits for the user.
        let vaultNoteTextBeingSaved = draftVaultNoteTextAtSave
        const vaultNoteDiskRead = await openVault.papelizVaultAdapter.readVaultNoteText(vaultNoteRelativePath).then(
          (vaultNoteText) => ({ vaultNoteTextOnDisk: vaultNoteText, isVaultNoteGoneFromDisk: false }),
          (vaultNoteReadError: unknown) => ({ vaultNoteTextOnDisk: null, isVaultNoteGoneFromDisk: isPapelizVaultEntryMissingError(vaultNoteReadError) }),
        )
        // Moved or trashed elsewhere: writing it would bring it back unasked, so the user chooses.
        if (vaultNoteDiskRead.isVaultNoteGoneFromDisk && isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) {
          setWorkspaceState((workspaceState) => ({
            vaultNoteSaveConflictsByLoadedNoteSessionId: {
              ...workspaceState.vaultNoteSaveConflictsByLoadedNoteSessionId,
              [loadedNoteSessionId]: { vaultNoteSaveConflictKind: 'deleted-elsewhere', vaultNoteRelativePath },
            },
          }))
          updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({ ...note, noteSaveState: 'save-conflict', noteSaveErrorMessage: null }))
          return
        }
        const vaultNoteTextOnDisk = vaultNoteDiskRead.vaultNoteTextOnDisk
        if (vaultNoteTextOnDisk !== null && vaultNoteTextOnDisk !== loadedVaultNote.savedVaultNoteText && vaultNoteTextOnDisk !== draftVaultNoteTextAtSave) {
          const vaultNoteMergeResult = mergePapelizVaultNoteText(loadedVaultNote.savedVaultNoteText, vaultNoteTextOnDisk, draftVaultNoteTextAtSave)
          if (vaultNoteMergeResult.mergeOutcome === 'conflict') {
            setWorkspaceState((workspaceState) => ({
              vaultNoteSaveConflictsByLoadedNoteSessionId: {
                ...workspaceState.vaultNoteSaveConflictsByLoadedNoteSessionId,
                [loadedNoteSessionId]: {
                  vaultNoteSaveConflictKind: 'same-lines-changed',
                  vaultNoteRelativePath,
                  baseVaultNoteText: loadedVaultNote.savedVaultNoteText,
                  savedElsewhereVaultNoteText: vaultNoteTextOnDisk,
                  myVaultNoteText: draftVaultNoteTextAtSave,
                  vaultNoteMergeResult,
                },
              },
            }))
            updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({ ...note, noteSaveState: 'save-conflict', noteSaveErrorMessage: null }))
            return
          }
          vaultNoteTextBeingSaved = vaultNoteMergeResult.mergedVaultNoteText
        }
        await openVault.papelizVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, vaultNoteTextBeingSaved)
        announceVaultChangeHere([vaultNoteRelativePath])
        let needsAnotherSave = false
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => {
          // Typed on while it saved: the newer typing is folded onto what was written.
          let nextDraftVaultNoteText = vaultNoteTextBeingSaved
          if (note.draftVaultNoteText !== draftVaultNoteTextAtSave) {
            const typedOnMergeResult = mergePapelizVaultNoteText(draftVaultNoteTextAtSave, vaultNoteTextBeingSaved, note.draftVaultNoteText)
            nextDraftVaultNoteText = typedOnMergeResult.mergeOutcome === 'clean' ? typedOnMergeResult.mergedVaultNoteText : note.draftVaultNoteText
          }
          needsAnotherSave = nextDraftVaultNoteText !== vaultNoteTextBeingSaved
          return {
            ...note,
            savedVaultNoteText: vaultNoteTextBeingSaved,
            draftVaultNoteText: nextDraftVaultNoteText,
            noteSaveState: needsAnotherSave ? 'unsaved' : 'saved',
            noteSaveErrorMessage: null,
          }
        })
        if (needsAnotherSave) scheduleAutosave(loadedNoteSessionId)
        // Saved as typed: its recovery copy is no longer needed.
        else if (isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) {
          void deletePapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath).catch(() => undefined)
        }
      } catch (vaultSaveError) {
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          noteSaveState: 'save-failed',
          noteSaveErrorMessage: describePapelizVaultError(vaultSaveError),
        }))
      }
    })
  }

  // Saves every changed note inside a folder (or the one note) before it is renamed or moved.
  const saveVaultNotesInside = async (vaultEntryRelativePath: string) => {
    const loadedVaultNotes = Object.entries(getWorkspaceState().loadedVaultNotesByRelativePath)
    await Promise.all(
      loadedVaultNotes
        .filter(([vaultNoteRelativePath]) => isVaultRelativePathInsideFolder(vaultNoteRelativePath, vaultEntryRelativePath))
        .map(([, loadedVaultNote]) => saveLoadedVaultNote(loadedVaultNote.loadedNoteSessionId)),
    )
  }

  const showWorkspaceNotice = (
    workspaceNoticeKind: PapelizWorkspaceNotice['workspaceNoticeKind'],
    workspaceNoticeMessage: string,
    workspaceNoticeAction?: PapelizWorkspaceNoticeAction,
  ) => {
    setWorkspaceState({
      workspaceNotice: {
        workspaceNoticeId: nextWorkspaceNoticeId++,
        workspaceNoticeKind,
        workspaceNoticeMessage,
        workspaceNoticeAction: workspaceNoticeAction ?? null,
      },
    })
  }

  // A lock keeps the Assistant's accepted changes out too, and nothing it writes goes into a hidden
  // folder other than `.csessions/`. Its own saved chats are kept up to date whatever is locked.
  const assertAssistantMayWriteVaultNote = (vaultNoteRelativePath: string, assistantVaultNoteWritePurpose: PapelizAssistantVaultNoteWritePurpose) => {
    const workspaceState = getWorkspaceState()
    const vaultNoteEditingLock = findVaultNoteEditingLock(workspaceState.isWholeVaultEditingLocked, workspaceState.lockedVaultEntryRelativePaths, vaultNoteRelativePath)
    if (vaultNoteEditingLock?.vaultNoteEditingLockKind === 'hidden-folder') {
      throw new PapelizVaultOperationError('Hidden Folder')
    }
    if (assistantVaultNoteWritePurpose === 'saved-chat-session') return
    if (vaultNoteEditingLock?.vaultNoteEditingLockKind === 'whole-vault') {
      throw new PapelizVaultOperationError('All Notes Locked')
    }
    if (vaultNoteEditingLock?.vaultNoteEditingLockKind === 'vault-entry') {
      throw new PapelizVaultOperationError(vaultNoteEditingLock.lockingVaultEntryRelativePath === vaultNoteRelativePath ? 'Note Locked' : 'Folder Locked')
    }
  }

  // Tells the vault's other tabs that this tab changed it: the notes saved, or null for the list of
  // notes and folders. A vault in memory (the sample) is this tab's alone.
  const announceVaultChangeHere = (changedVaultNoteRelativePaths: string[] | null) => {
    const openVault = getWorkspaceState().openVault
    if (openVault === null || !isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) return
    announcePapelizVaultChange(openVault.papelizVaultId, changedVaultNoteRelativePaths)
  }

  // After a change made here: the list is read again, and the vault's other tabs hear of it.
  const loadVaultTreeEntriesAfterChange = async () => {
    await loadVaultTreeEntries()
    announceVaultChangeHere(null)
  }

  // A note saved elsewhere: an open note with no changes of its own takes the new text; one with
  // changes keeps them, and its next save merges the two.
  // A note moved or trashed elsewhere closes here too when it has nothing unsaved; one with changes
  // stays open, and its next save asks what to do.
  const adoptVaultNoteSavedElsewhere = async (openVault: PapelizOpenVault, vaultNoteRelativePath: string) => {
    const { vaultNoteTextOnDisk, isVaultNoteGoneFromDisk } = await runVaultOperationInOrder(() =>
      openVault.papelizVaultAdapter.readVaultNoteText(vaultNoteRelativePath),
    ).then(
      (vaultNoteText) => ({ vaultNoteTextOnDisk: vaultNoteText, isVaultNoteGoneFromDisk: false }),
      (vaultNoteReadError: unknown) => ({ vaultNoteTextOnDisk: null, isVaultNoteGoneFromDisk: isPapelizVaultEntryMissingError(vaultNoteReadError) }),
    )
    if (getWorkspaceState().openVault !== openVault) return
    const loadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
    if (loadedVaultNote?.noteLoadState !== 'loaded') return
    const hasNothingUnsaved = loadedVaultNote.noteSaveState === 'saved' && loadedVaultNote.draftVaultNoteText === loadedVaultNote.savedVaultNoteText
    if (vaultNoteTextOnDisk === null) {
      if (!isVaultNoteGoneFromDisk) return
      // Another app's change that no tab announced: the list stops showing the note too.
      if (getWorkspaceState().vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath === vaultNoteRelativePath)) {
        void loadVaultTreeEntries()
      }
      if (hasNothingUnsaved) {
        closeTabsInside(vaultNoteRelativePath)
        showWorkspaceNotice('info', `“${getVaultNoteTitle(vaultNoteRelativePath)}” was moved or deleted elsewhere, so its tab closed.`)
      }
      return
    }
    if (vaultNoteTextOnDisk === loadedVaultNote.savedVaultNoteText || !hasNothingUnsaved) return
    updateLoadedVaultNoteForSession(loadedVaultNote.loadedNoteSessionId, (note) => ({
      ...note,
      savedVaultNoteText: vaultNoteTextOnDisk,
      draftVaultNoteText: vaultNoteTextOnDisk,
    }))
  }

  // Reads again what changed elsewhere: the notes named, or, for null, the list of notes and folders,
  // Papeliz's own files (order, locks, colors) and every open note.
  const reloadVaultChangedElsewhere = async (changedVaultNoteRelativePaths: string[] | null) => {
    const openVault = getWorkspaceState().openVault
    if (openVault === null) return
    if (changedVaultNoteRelativePaths === null) {
      await loadVaultTreeEntries()
      const [savedFileListOrderText, savedLockedEntriesText, savedFileListLooksText] = await Promise.all([
        openVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizFileListOrderFileName).catch(() => null),
        openVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizLockedEntriesFileName).catch(() => null),
        openVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizFileListLooksFileName).catch(() => null),
      ])
      if (getWorkspaceState().openVault !== openVault) return
      setWorkspaceState({
        vaultEntryOrder: parsePapelizFileListOrderFile(savedFileListOrderText),
        lockedVaultEntryRelativePaths: parsePapelizLockedEntriesFile(savedLockedEntriesText),
        isWholeVaultEditingLocked: parsePapelizWholeVaultEditingLock(savedLockedEntriesText),
        vaultEntryLooks: parsePapelizFileListLooksFile(savedFileListLooksText),
      })
    }
    for (const vaultNoteRelativePath of Object.keys(getWorkspaceState().loadedVaultNotesByRelativePath)) {
      if (changedVaultNoteRelativePaths !== null && !changedVaultNoteRelativePaths.includes(vaultNoteRelativePath)) continue
      await adoptVaultNoteSavedElsewhere(openVault, vaultNoteRelativePath)
    }
  }

  // While a folder or browser vault is open: the other tabs' changes are heard and read again; another
  // browser's or app's are looked for when the tab comes back into view (everything) and, for a
  // folder, every few seconds while it is in view (the open notes). Only this browser's Papeliz tabs
  // change a browser vault, and they always announce it, so it needs no polling.
  let stopWatchingVaultChangesElsewhere: (() => void) | null = null
  const startWatchingVaultChangesElsewhere = (openVault: PapelizOpenVault) => {
    stopWatchingVaultChangesElsewhere?.()
    stopWatchingVaultChangesElsewhere = null
    if (!isPapelizVaultKeptBeyondThisTab(openVault.papelizVaultAdapter.papelizVaultKind)) return
    const vaultReloadScheduler = createPapelizVaultChangeReloadScheduler((changedVaultNoteRelativePaths) => void reloadVaultChangedElsewhere(changedVaultNoteRelativePaths))
    const stopListeningToVaultChanges = subscribeToPapelizVaultChanges((vaultChangeMessage) => {
      if (vaultChangeMessage.papelizVaultId === getWorkspaceState().openVault?.papelizVaultId) {
        vaultReloadScheduler.scheduleVaultReload(vaultChangeMessage.changedVaultNoteRelativePaths)
      }
    })
    const isPageInView = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    // Coming back into view: look for changes made meanwhile. Going out of view, or the page being put
    // away: every unsaved note's recovery copy is written now.
    const lookAgainOnReturn = () => {
      if (isPageInView()) vaultReloadScheduler.scheduleVaultReload(null)
      else writeEveryNoteRecoveryDraftNow()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', lookAgainOnReturn)
    if (typeof window !== 'undefined') window.addEventListener('pagehide', writeEveryNoteRecoveryDraftNow)
    const vaultChangePollTimer =
      openVault.papelizVaultAdapter.papelizVaultKind === 'folder-on-disk'
        ? setInterval(() => {
            const openVaultNoteRelativePaths = Object.keys(getWorkspaceState().loadedVaultNotesByRelativePath)
            if (isPageInView() && openVaultNoteRelativePaths.length > 0) vaultReloadScheduler.scheduleVaultReload(openVaultNoteRelativePaths)
          }, papelizVaultChangePollMilliseconds)
        : null
    stopWatchingVaultChangesElsewhere = () => {
      stopListeningToVaultChanges()
      vaultReloadScheduler.cancelVaultReload()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', lookAgainOnReturn)
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', writeEveryNoteRecoveryDraftNow)
      if (vaultChangePollTimer !== null) clearInterval(vaultChangePollTimer)
    }
  }

  const loadVaultTreeEntries = async () => {
    const openVault = getWorkspaceState().openVault
    if (openVault === null) return
    try {
      const vaultTreeEntries = await openVault.papelizVaultAdapter.listVaultTreeEntries({
        isEveryHiddenVaultEntryListed: getWorkspaceState().areHiddenVaultEntriesShown,
      })
      if (getWorkspaceState().openVault !== openVault) return
      setWorkspaceState({ vaultTreeEntries: sortVaultTreeEntries(vaultTreeEntries), vaultTreeLoadState: 'loaded' })
    } catch (vaultTreeError) {
      if (getWorkspaceState().openVault !== openVault) return
      setWorkspaceState({ vaultTreeLoadState: 'load-failed' })
      showWorkspaceNotice('error', `Couldn’t list your notes (${describePapelizVaultError(vaultTreeError)})`)
    }
  }

  // Moves or renames an entry in the vault and carries along every open tab, loaded note and
  // expanded folder inside it; changes waiting inside it are saved first. Gives back what went wrong,
  // or null.
  const moveVaultEntryWithItsNotes = async (
    openVault: PapelizOpenVault,
    fromVaultEntryRelativePath: string,
    toVaultEntryRelativePath: string,
  ): Promise<string | null> => {
    await saveVaultNotesInside(fromVaultEntryRelativePath)
    try {
      await runVaultOperationInOrder(async () => {
        await openVault.papelizVaultAdapter.renameVaultEntry(fromVaultEntryRelativePath, toVaultEntryRelativePath)
        reportPapelizSyncVaultEntryRenamed(openVault.papelizVaultId, fromVaultEntryRelativePath, toVaultEntryRelativePath)
        // Every path inside the moved entry changes in the same step, before the next queued save
        // looks up its note's path.
        setWorkspaceState((workspaceState) => {
          const moveVaultPath = (vaultPath: string) => replaceVaultRelativePathPrefix(vaultPath, fromVaultEntryRelativePath, toVaultEntryRelativePath)
          return {
            vaultTreeEntries: sortVaultTreeEntries(
              workspaceState.vaultTreeEntries.map((vaultTreeEntry) => ({
                ...vaultTreeEntry,
                vaultEntryRelativePath: moveVaultPath(vaultTreeEntry.vaultEntryRelativePath),
              })),
            ),
            openNoteTabRelativePaths: workspaceState.openNoteTabRelativePaths.map(moveVaultPath),
            activeVaultNoteRelativePath: workspaceState.activeVaultNoteRelativePath === null ? null : moveVaultPath(workspaceState.activeVaultNoteRelativePath),
            loadedVaultNotesByRelativePath: Object.fromEntries(
              Object.entries(workspaceState.loadedVaultNotesByRelativePath).map(([vaultNoteRelativePath, loadedVaultNote]) => [
                moveVaultPath(vaultNoteRelativePath),
                loadedVaultNote,
              ]),
            ),
            expandedVaultFolderRelativePaths: Object.fromEntries(
              Object.keys(workspaceState.expandedVaultFolderRelativePaths).map((vaultFolderRelativePath) => [moveVaultPath(vaultFolderRelativePath), true as const]),
            ),
            vaultEntryOrder: carryVaultEntryOrderThroughMove(workspaceState.vaultEntryOrder, fromVaultEntryRelativePath, toVaultEntryRelativePath),
            copiedVaultEntry:
              workspaceState.copiedVaultEntry === null
                ? null
                : { ...workspaceState.copiedVaultEntry, vaultEntryRelativePath: moveVaultPath(workspaceState.copiedVaultEntry.vaultEntryRelativePath) },
            lockedVaultEntryRelativePaths: carryVaultEntryLocksThroughMove(
              workspaceState.lockedVaultEntryRelativePaths,
              fromVaultEntryRelativePath,
              toVaultEntryRelativePath,
            ),
            vaultEntryLooks: carryVaultEntryLooksThroughMove(workspaceState.vaultEntryLooks, fromVaultEntryRelativePath, toVaultEntryRelativePath),
          }
        })
      })
      saveVaultEntryOrder()
      if (getWorkspaceState().lockedVaultEntryRelativePaths.length > 0) saveLockedVaultEntries()
      if (Object.keys(getWorkspaceState().vaultEntryLooks).length > 0) saveVaultEntryLooks()
    } catch (vaultMoveError) {
      await loadVaultTreeEntriesAfterChange()
      return describePapelizVaultError(vaultMoveError)
    }
    await loadVaultTreeEntriesAfterChange()
    return null
  }

  // Writes one of Papeliz's files to the vault's `.papeliz/` folder, one write after another so an
  // older version never lands after a newer one.
  let papelizVaultSettingsFileWrites: Promise<void> = Promise.resolve()
  const writePapelizVaultSettingsFileInOrder = (papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string, savedThingDescription: string) => {
    const openVault = getWorkspaceState().openVault
    if (openVault === null) return
    papelizVaultSettingsFileWrites = papelizVaultSettingsFileWrites
      .then(() => openVault.papelizVaultAdapter.writePapelizVaultSettingsFile(papelizVaultSettingsFileName, papelizVaultSettingsFileText))
      .then(() => {
        reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, `${papelizVaultSettingsFolderName}/${papelizVaultSettingsFileName}`)
        announceVaultChangeHere(null)
      })
      .catch((vaultSettingsWriteError: unknown) => {
        if (getWorkspaceState().openVault === openVault) {
          showWorkspaceNotice('error', `Couldn’t save ${savedThingDescription} (${describePapelizVaultError(vaultSettingsWriteError)})`)
        }
      })
  }

  const saveVaultEntryOrder = () =>
    writePapelizVaultSettingsFileInOrder(papelizFileListOrderFileName, formatPapelizFileListOrderFile(getWorkspaceState().vaultEntryOrder), 'the file order')

  const saveVaultEntryLooks = () =>
    writePapelizVaultSettingsFileInOrder(papelizFileListLooksFileName, formatPapelizFileListLooksFile(getWorkspaceState().vaultEntryLooks), 'the colors and icons')

  const saveLockedVaultEntries = () =>
    writePapelizVaultSettingsFileInOrder(
      papelizLockedEntriesFileName,
      formatPapelizLockedEntriesFile(getWorkspaceState().lockedVaultEntryRelativePaths, getWorkspaceState().isWholeVaultEditingLocked),
      'the locks',
    )

  const setVaultFolderEntryOrder = (vaultFolderRelativePath: string, orderedVaultEntryNames: readonly string[]) => {
    setWorkspaceState((workspaceState) => ({ vaultEntryOrder: { ...workspaceState.vaultEntryOrder, [vaultFolderRelativePath]: orderedVaultEntryNames } }))
    saveVaultEntryOrder()
  }

  const describeVaultEntryForNotice = (vaultEntryRelativePath: string) => {
    const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
    return isVaultNoteFileName(vaultEntryName) ? getVaultNoteTitle(vaultEntryRelativePath) : vaultEntryName
  }

  // Copies a note or folder into a folder under a free name: "Plan copy.md" for a duplicate, or its
  // own name when free for a paste. The copy comes right after the original when both share a folder
  // with a chosen order, and its folder opens so it can be seen.
  const copyVaultEntryIntoFolder = async (
    sourceVaultEntry: PapelizVaultTreeEntry,
    targetVaultFolderRelativePath: string,
    copyNaming: 'always-add-copy' | 'add-copy-when-taken',
  ) => {
    const openVault = getWorkspaceState().openVault
    if (openVault === null) return
    const sourceVaultEntryRelativePath = sourceVaultEntry.vaultEntryRelativePath
    if (sourceVaultEntry.vaultEntryKind === 'folder' && isVaultRelativePathInsideFolder(targetVaultFolderRelativePath, sourceVaultEntryRelativePath)) {
      showWorkspaceNotice('error', `Couldn’t paste “${getVaultEntryName(sourceVaultEntryRelativePath)}” (Into Itself)`)
      return
    }
    const sourceVaultEntryName = getVaultEntryName(sourceVaultEntryRelativePath)
    const isSourceNote = sourceVaultEntry.vaultEntryKind === 'note'
    const sourceBaseName = isSourceNote ? sourceVaultEntryName.replace(/\.md$/i, '') : sourceVaultEntryName
    const sourceExtension = isSourceNote ? sourceVaultEntryName.slice(sourceBaseName.length) : ''
    const isNameTaken = (candidateVaultEntryName: string) =>
      isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, targetVaultFolderRelativePath, candidateVaultEntryName, '')
    const copyVaultEntryName =
      copyNaming === 'add-copy-when-taken' && !isNameTaken(sourceVaultEntryName)
        ? sourceVaultEntryName
        : pickFreeVaultEntryName(`${sourceBaseName} copy`, sourceExtension, isNameTaken)
    const copyVaultEntryRelativePath = joinVaultRelativePath(targetVaultFolderRelativePath, copyVaultEntryName)
    await saveVaultNotesInside(sourceVaultEntryRelativePath)
    try {
      await runVaultOperationInOrder(() => openVault.papelizVaultAdapter.copyVaultEntry(sourceVaultEntryRelativePath, copyVaultEntryRelativePath))
      if (isSourceNote) reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, copyVaultEntryRelativePath)
      else reportPapelizSyncVaultFolderCopied(openVault.papelizVaultId, openVault.papelizVaultAdapter, copyVaultEntryRelativePath)
    } catch (vaultCopyError) {
      showWorkspaceNotice('error', `Couldn’t copy “${describeVaultEntryForNotice(sourceVaultEntryRelativePath)}” (${describePapelizVaultError(vaultCopyError)})`)
      await loadVaultTreeEntriesAfterChange()
      return
    }
    await loadVaultTreeEntriesAfterChange()
    expandParentFoldersOf(copyVaultEntryRelativePath)
    const { vaultTreeEntries, vaultEntryOrder } = getWorkspaceState()
    if (vaultEntryOrder[targetVaultFolderRelativePath] !== undefined) {
      const isBesideSource = getVaultEntryParentFolderRelativePath(sourceVaultEntryRelativePath) === targetVaultFolderRelativePath
      setVaultFolderEntryOrder(
        targetVaultFolderRelativePath,
        placeVaultEntryName(
          listVaultFolderEntryNamesInOrder(vaultTreeEntries, targetVaultFolderRelativePath, vaultEntryOrder),
          copyVaultEntryName,
          isBesideSource ? { vaultEntryPlacementKind: 'after', anchorVaultEntryName: sourceVaultEntryName } : { vaultEntryPlacementKind: 'last' },
        ),
      )
    }
    showWorkspaceNotice(
      'info',
      copyNaming === 'always-add-copy'
        ? `Duplicated “${describeVaultEntryForNotice(sourceVaultEntryRelativePath)}”.`
        : `Pasted “${describeVaultEntryForNotice(copyVaultEntryRelativePath)}”.`,
    )
  }

  const expandParentFoldersOf = (vaultEntryRelativePath: string) => {
    const vaultPathSegments = splitVaultRelativePath(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath))
    if (vaultPathSegments.length === 0) return
    setWorkspaceState((workspaceState) => {
      const expandedVaultFolderRelativePaths = { ...workspaceState.expandedVaultFolderRelativePaths }
      vaultPathSegments.forEach((_vaultPathSegment, segmentIndex) => {
        expandedVaultFolderRelativePaths[vaultPathSegments.slice(0, segmentIndex + 1).join('/')] = true
      })
      return { expandedVaultFolderRelativePaths }
    })
  }

  // Moves a note or folder into `.trash` after saving what is open inside it, and tidies up after it:
  // its tabs close, a copy waiting to be pasted is forgotten, and its locks go. Throws on failure.
  const trashVaultEntryAndTidyUp = async (openVault: PapelizOpenVault, vaultEntryRelativePath: string) => {
    await saveVaultNotesInside(vaultEntryRelativePath)
    await runVaultOperationInOrder(async () => {
      const vaultTrashRelativePath = await openVault.papelizVaultAdapter.moveVaultEntryToTrash(vaultEntryRelativePath)
      reportPapelizSyncVaultEntryMovedToTrash(openVault.papelizVaultId, vaultEntryRelativePath, vaultTrashRelativePath)
      closeTabsInside(vaultEntryRelativePath)
      const copiedVaultEntryBeforeTrash = getWorkspaceState().copiedVaultEntry
      if (copiedVaultEntryBeforeTrash !== null && isVaultRelativePathInsideFolder(copiedVaultEntryBeforeTrash.vaultEntryRelativePath, vaultEntryRelativePath)) {
        setWorkspaceState({ copiedVaultEntry: null })
      }
      const lockedPathsBeforeTrash = getWorkspaceState().lockedVaultEntryRelativePaths
      const lockedPathsAfterTrash = removeVaultEntryLocksInside(lockedPathsBeforeTrash, vaultEntryRelativePath)
      if (lockedPathsAfterTrash.length !== lockedPathsBeforeTrash.length) {
        setWorkspaceState({ lockedVaultEntryRelativePaths: lockedPathsAfterTrash })
        saveLockedVaultEntries()
      }
      const looksBeforeTrash = getWorkspaceState().vaultEntryLooks
      const looksAfterTrash = removeVaultEntryLooksInside(looksBeforeTrash, vaultEntryRelativePath)
      if (Object.keys(looksAfterTrash).length !== Object.keys(looksBeforeTrash).length) {
        setWorkspaceState({ vaultEntryLooks: looksAfterTrash })
        saveVaultEntryLooks()
      }
    })
  }

  const closeTabsInside = (vaultEntryRelativePath: string) => {
    setWorkspaceState((workspaceState) => {
      const openNoteTabRelativePaths = workspaceState.openNoteTabRelativePaths.filter(
        (vaultNoteRelativePath) => !isVaultRelativePathInsideFolder(vaultNoteRelativePath, vaultEntryRelativePath),
      )
      const loadedVaultNotesByRelativePath = Object.fromEntries(
        Object.entries(workspaceState.loadedVaultNotesByRelativePath).filter(([vaultNoteRelativePath, loadedVaultNote]) => {
          const isInside = isVaultRelativePathInsideFolder(vaultNoteRelativePath, vaultEntryRelativePath)
          if (isInside) cancelAutosaveTimer(loadedVaultNote.loadedNoteSessionId)
          return !isInside
        }),
      )
      let activeVaultNoteRelativePath = workspaceState.activeVaultNoteRelativePath
      if (activeVaultNoteRelativePath !== null && isVaultRelativePathInsideFolder(activeVaultNoteRelativePath, vaultEntryRelativePath)) {
        const closedTabIndex = workspaceState.openNoteTabRelativePaths.indexOf(activeVaultNoteRelativePath)
        activeVaultNoteRelativePath =
          openNoteTabRelativePaths[Math.min(Math.max(closedTabIndex, 0), openNoteTabRelativePaths.length - 1)] ?? null
      }
      return { openNoteTabRelativePaths, loadedVaultNotesByRelativePath, activeVaultNoteRelativePath }
    })
  }

  // Creates any folders a new note's path names, then the note itself.
  const createVaultNoteWithItsFolders = async (papelizOpenVault: PapelizOpenVault, newVaultNoteRelativePath: string, newVaultNoteText: string) => {
    // Papeliz's own `.csessions` folder is the one name here that may start with a dot.
    const vaultPathProblem = splitVaultRelativePath(newVaultNoteRelativePath)
      .filter((vaultPathSegment, vaultPathSegmentIndex) => !(vaultPathSegmentIndex === 0 && vaultPathSegment === papelizVaultChatSessionFolderName))
      .map((vaultPathSegment) => describeVaultEntryNameProblem(vaultPathSegment))
      .find((vaultPathSegmentProblem) => vaultPathSegmentProblem !== null)
    if (vaultPathProblem !== undefined) throw new PapelizVaultOperationError(vaultPathProblem)
    await runVaultOperationInOrder(async () => {
      await createMissingVaultFolders(papelizOpenVault, getVaultEntryParentFolderRelativePath(newVaultNoteRelativePath))
      await papelizOpenVault.papelizVaultAdapter.createVaultNote(newVaultNoteRelativePath, newVaultNoteText)
      reportPapelizSyncVaultFileSaved(papelizOpenVault.papelizVaultId, newVaultNoteRelativePath)
    })
    await loadVaultTreeEntriesAfterChange()
  }

  // Creates each folder on the way to `vaultFolderRelativePath` that isn't there yet.
  const createMissingVaultFolders = async (papelizOpenVault: PapelizOpenVault, vaultFolderRelativePath: string) => {
    const vaultFolderSegments = splitVaultRelativePath(vaultFolderRelativePath)
    for (let segmentIndex = 0; segmentIndex < vaultFolderSegments.length; segmentIndex += 1) {
      const vaultSubfolderRelativePath = vaultFolderSegments.slice(0, segmentIndex + 1).join('/')
      const isExistingFolder = getWorkspaceState().vaultTreeEntries.some(
        (vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'folder' && vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === vaultSubfolderRelativePath.toLowerCase(),
      )
      if (isExistingFolder) continue
      try {
        await papelizOpenVault.papelizVaultAdapter.createVaultFolder(vaultSubfolderRelativePath)
      } catch (vaultFolderCreateError) {
        // Made since the list was last read (by another step, or another tab): it is there, as wanted.
        if (!(vaultFolderCreateError instanceof PapelizVaultOperationError && vaultFolderCreateError.message === 'Name Taken')) throw vaultFolderCreateError
      }
    }
  }

  return {
    openVault: null,
    vaultTreeEntries: [],
    vaultTreeLoadState: 'loading',
    openNoteTabRelativePaths: [],
    activeVaultNoteRelativePath: null,
    loadedVaultNotesByRelativePath: {},
    noteViewMode: 'md-code',
    lockedVaultEntryRelativePaths: [],
    vaultEntryLooks: {},
    isWholeVaultEditingLocked: false,
    areHiddenVaultEntriesShown: false,
    copiedVaultEntry: null,
    expandedVaultFolderRelativePaths: {},
    vaultEntryBeingRenamedRelativePath: null,
    ...createInitialWorkspaceLayout(),
    workspaceNotice: null,
    assistantProposalPreview: null,
    vaultNoteSaveConflictsByLoadedNoteSessionId: {},

    openVaultInWorkspace: async (papelizOpenVault, openVaultOptions) => {
      await getWorkspaceState().closeVaultInWorkspace()
      setWorkspaceState({
        openVault: papelizOpenVault,
        vaultTreeEntries: [],
        vaultTreeLoadState: 'loading',
        openNoteTabRelativePaths: [],
        activeVaultNoteRelativePath: null,
        loadedVaultNotesByRelativePath: {},
        noteViewMode: openVaultOptions.firstNoteViewMode,
        expandedVaultFolderRelativePaths: {},
        vaultEntryBeingRenamedRelativePath: null,
        ...createInitialWorkspaceLayout(),
        workspaceNotice: null,
        assistantProposalPreview: null,
        vaultNoteSaveConflictsByLoadedNoteSessionId: {},
        vaultEntryOrder: {},
        lockedVaultEntryRelativePaths: [],
        vaultEntryLooks: {},
        isWholeVaultEditingLocked: false,
        copiedVaultEntry: null,
      })
      // The file list's order and the editing locks, from the vault's own `.papeliz/` folder, and
      // whether this browser shows hidden entries.
      const [savedFileListOrderText, savedLockedEntriesText, savedFileListLooksText, areHiddenVaultEntriesShown] = await Promise.all([
        papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizFileListOrderFileName).catch(() => null),
        papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizLockedEntriesFileName).catch(() => null),
        papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizFileListLooksFileName).catch(() => null),
        readPapelizUserSetting<unknown>(papelizHiddenVaultEntriesShownSettingName, false).then((savedSettingValue) => savedSettingValue === true),
      ])
      if (getWorkspaceState().openVault === papelizOpenVault) {
        setWorkspaceState({
          vaultEntryOrder: parsePapelizFileListOrderFile(savedFileListOrderText),
          lockedVaultEntryRelativePaths: parsePapelizLockedEntriesFile(savedLockedEntriesText),
          vaultEntryLooks: parsePapelizFileListLooksFile(savedFileListLooksText),
          isWholeVaultEditingLocked: parsePapelizWholeVaultEditingLock(savedLockedEntriesText),
          areHiddenVaultEntriesShown,
        })
      }
      await loadVaultTreeEntries()
      startWatchingVaultChangesElsewhere(papelizOpenVault)
      if (openVaultOptions.expandAllTopLevelFolders) {
        const expandedVaultFolderRelativePaths: Record<string, true> = {}
        for (const vaultTreeEntry of getWorkspaceState().vaultTreeEntries) {
          if (vaultTreeEntry.vaultEntryKind === 'folder' && !vaultTreeEntry.vaultEntryRelativePath.includes('/')) {
            expandedVaultFolderRelativePaths[vaultTreeEntry.vaultEntryRelativePath] = true
          }
        }
        setWorkspaceState({ expandedVaultFolderRelativePaths })
      }
      if (openVaultOptions.firstVaultNoteRelativePathToOpen !== null) {
        await getWorkspaceState().openVaultNote(openVaultOptions.firstVaultNoteRelativePathToOpen)
      }
    },

    closeVaultInWorkspace: async () => {
      const closingOpenVault = getWorkspaceState().openVault
      if (closingOpenVault === null) return
      stopWatchingVaultChangesElsewhere?.()
      stopWatchingVaultChangesElsewhere = null
      await getWorkspaceState().saveAllVaultNotesNow()
      for (const autosaveTimer of autosaveTimersByLoadedNoteSessionId.values()) clearTimeout(autosaveTimer)
      autosaveTimersByLoadedNoteSessionId.clear()
      // A browser vault lets go of its open lock once its last save is done.
      await runVaultOperationInOrder(async () => undefined).catch(() => undefined)
      closingOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
      setWorkspaceState({
        openVault: null,
        vaultTreeEntries: [],
        openNoteTabRelativePaths: [],
        activeVaultNoteRelativePath: null,
        loadedVaultNotesByRelativePath: {},
        vaultEntryBeingRenamedRelativePath: null,
        workspaceNotice: null,
        assistantProposalPreview: null,
        vaultNoteSaveConflictsByLoadedNoteSessionId: {},
        isVaultCloseConfirmationShown: false,
        vaultEntryOrder: {},
        lockedVaultEntryRelativePaths: [],
        vaultEntryLooks: {},
        isWholeVaultEditingLocked: false,
        copiedVaultEntry: null,
      })
    },

    refreshVaultTree: loadVaultTreeEntries,

    openVaultNote: async (vaultNoteRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      // Going to a note leaves a proposal's preview.
      if (getWorkspaceState().assistantProposalPreview !== null) setWorkspaceState({ assistantProposalPreview: null })
      expandParentFoldersOf(vaultNoteRelativePath)
      setWorkspaceState((workspaceState) => ({
        openNoteTabRelativePaths: workspaceState.openNoteTabRelativePaths.includes(vaultNoteRelativePath)
          ? workspaceState.openNoteTabRelativePaths
          : [...workspaceState.openNoteTabRelativePaths, vaultNoteRelativePath],
        activeVaultNoteRelativePath: vaultNoteRelativePath,
        isExplorerPanelOpen: isWideScreenForPapelizWorkspace() ? workspaceState.isExplorerPanelOpen : false,
      }))
      const alreadyLoadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (alreadyLoadedVaultNote !== undefined && alreadyLoadedVaultNote.noteLoadState !== 'load-failed') return

      const loadedNoteSessionId = alreadyLoadedVaultNote?.loadedNoteSessionId ?? nextLoadedNoteSessionId++
      setWorkspaceState((workspaceState) => ({
        loadedVaultNotesByRelativePath: {
          ...workspaceState.loadedVaultNotesByRelativePath,
          [vaultNoteRelativePath]: {
            loadedNoteSessionId,
            noteLoadState: 'loading',
            noteLoadErrorMessage: null,
            savedVaultNoteText: '',
            draftVaultNoteText: '',
            noteSaveState: 'saved',
            noteSaveErrorMessage: null,
          },
        },
      }))
      try {
        const vaultNoteText = await openVault.papelizVaultAdapter.readVaultNoteText(vaultNoteRelativePath)
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          noteLoadState: 'loaded',
          savedVaultNoteText: vaultNoteText,
          draftVaultNoteText: vaultNoteText,
        }))
        void offerNoteRecoveryDraft(openVault, vaultNoteRelativePath, loadedNoteSessionId, vaultNoteText)
      } catch (vaultReadError) {
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          noteLoadState: 'load-failed',
          noteLoadErrorMessage: describePapelizVaultError(vaultReadError),
        }))
      }
    },

    openOrCreateVaultNoteForWikilinkTarget: async (wikilinkTargetVaultNoteRelativePath, wikilinkTargetNoteName) => {
      if (wikilinkTargetVaultNoteRelativePath !== null) {
        await getWorkspaceState().openVaultNote(wikilinkTargetVaultNoteRelativePath)
        return
      }
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      const newVaultNoteRelativePath = getVaultNoteRelativePathForNewWikilinkTarget(wikilinkTargetNoteName)
      try {
        await createVaultNoteWithItsFolders(openVault, newVaultNoteRelativePath, '')
      } catch (vaultCreateError) {
        showWorkspaceNotice('error', `Couldn’t create the note (${describePapelizVaultError(vaultCreateError)})`)
        return
      }
      showWorkspaceNotice('info', `Created “${getVaultNoteTitle(newVaultNoteRelativePath)}”.`)
      await getWorkspaceState().openVaultNote(newVaultNoteRelativePath)
    },

    moveVaultNoteTab: (vaultNoteRelativePath, targetNoteTabIndex) => {
      setWorkspaceState((workspaceState) => {
        const currentNoteTabIndex = workspaceState.openNoteTabRelativePaths.indexOf(vaultNoteRelativePath)
        if (currentNoteTabIndex === -1) return {}
        const clampedTargetNoteTabIndex = Math.max(0, Math.min(workspaceState.openNoteTabRelativePaths.length - 1, Math.round(targetNoteTabIndex)))
        if (clampedTargetNoteTabIndex === currentNoteTabIndex) return {}
        const reorderedNoteTabRelativePaths = workspaceState.openNoteTabRelativePaths.filter((openNoteTabRelativePath) => openNoteTabRelativePath !== vaultNoteRelativePath)
        reorderedNoteTabRelativePaths.splice(clampedTargetNoteTabIndex, 0, vaultNoteRelativePath)
        return { openNoteTabRelativePaths: reorderedNoteTabRelativePaths }
      })
    },

    closeVaultNoteTab: async (vaultNoteRelativePath) => {
      const loadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote !== undefined) await saveLoadedVaultNote(loadedVaultNote.loadedNoteSessionId)
      const currentVaultNoteRelativePath =
        loadedVaultNote === undefined
          ? vaultNoteRelativePath
          : (findVaultNoteRelativePathForSession(getWorkspaceState().loadedVaultNotesByRelativePath, loadedVaultNote.loadedNoteSessionId) ??
            vaultNoteRelativePath)
      if (getWorkspaceState().loadedVaultNotesByRelativePath[currentVaultNoteRelativePath]?.noteSaveState === 'save-failed') {
        showWorkspaceNotice('error', `Couldn’t close “${getVaultNoteTitle(currentVaultNoteRelativePath)}” (Not Saved)`)
        return
      }
      closeTabsInside(currentVaultNoteRelativePath)
    },

    updateVaultNoteDraftText: (loadedNoteSessionId, draftVaultNoteText) => {
      updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
        ...note,
        draftVaultNoteText,
        noteSaveState: note.noteSaveState === 'saving' ? 'saving' : draftVaultNoteText === note.savedVaultNoteText ? 'saved' : 'unsaved',
      }))
      scheduleAutosave(loadedNoteSessionId)
      scheduleNoteRecoveryDraft(loadedNoteSessionId)
    },

    saveVaultNoteNow: async (vaultNoteRelativePath) => {
      const loadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote !== undefined) await saveLoadedVaultNote(loadedVaultNote.loadedNoteSessionId)
    },

    saveAllVaultNotesNow: async () => {
      await Promise.all(
        Object.values(getWorkspaceState().loadedVaultNotesByRelativePath).map((loadedVaultNote) =>
          saveLoadedVaultNote(loadedVaultNote.loadedNoteSessionId),
        ),
      )
    },

    createVaultNoteInFolder: async (vaultFolderRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      const newVaultNoteName = pickFreeVaultEntryName('Untitled', papelizVaultNoteFileExtension, (candidateName) =>
        isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, vaultFolderRelativePath, candidateName),
      )
      const newVaultNoteRelativePath = joinVaultRelativePath(vaultFolderRelativePath, newVaultNoteName)
      try {
        await runVaultOperationInOrder(() => openVault.papelizVaultAdapter.createVaultNote(newVaultNoteRelativePath, ''))
        reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, newVaultNoteRelativePath)
      } catch (vaultCreateError) {
        showWorkspaceNotice('error', `Couldn’t create the note (${describePapelizVaultError(vaultCreateError)})`)
        return
      }
      await loadVaultTreeEntriesAfterChange()
      // A new note opens in the view already showing (MD Code or MD View); both are for writing.
      await getWorkspaceState().openVaultNote(newVaultNoteRelativePath)
      getWorkspaceState().setExplorerPanelOpen(true)
      setWorkspaceState({ vaultEntryBeingRenamedRelativePath: newVaultNoteRelativePath })
    },

    createVaultFolderInFolder: async (vaultFolderRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      const newVaultFolderName = pickFreeVaultEntryName('New folder', '', (candidateName) =>
        isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, vaultFolderRelativePath, candidateName),
      )
      const newVaultFolderRelativePath = joinVaultRelativePath(vaultFolderRelativePath, newVaultFolderName)
      try {
        await runVaultOperationInOrder(() => openVault.papelizVaultAdapter.createVaultFolder(newVaultFolderRelativePath))
      } catch (vaultCreateError) {
        showWorkspaceNotice('error', `Couldn’t create the folder (${describePapelizVaultError(vaultCreateError)})`)
        return
      }
      await loadVaultTreeEntriesAfterChange()
      expandParentFoldersOf(newVaultFolderRelativePath)
      getWorkspaceState().setExplorerPanelOpen(true)
      setWorkspaceState({ vaultEntryBeingRenamedRelativePath: newVaultFolderRelativePath })
    },

    renameVaultEntry: async (vaultEntryRelativePath, typedVaultEntryName) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return { vaultEntryRenameOutcome: 'unchanged', renamedVaultEntryRelativePath: vaultEntryRelativePath }
      const vaultEntryNameProblem = describeVaultEntryNameProblem(typedVaultEntryName)
      if (vaultEntryNameProblem !== null) return { vaultEntryRenameOutcome: 'refused', vaultEntryRenameProblem: vaultEntryNameProblem }

      const isRenamingNote = isVaultNoteFileName(getVaultEntryName(vaultEntryRelativePath))
      const trimmedVaultEntryName = typedVaultEntryName.trim()
      // The note list shows names without ".md"; the extension is added back here.
      const newVaultEntryName =
        isRenamingNote && !isVaultNoteFileName(trimmedVaultEntryName) ? `${trimmedVaultEntryName}${papelizVaultNoteFileExtension}` : trimmedVaultEntryName
      const vaultParentFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)
      const newVaultEntryRelativePath = joinVaultRelativePath(vaultParentFolderRelativePath, newVaultEntryName)
      if (newVaultEntryRelativePath === vaultEntryRelativePath) {
        return { vaultEntryRenameOutcome: 'unchanged', renamedVaultEntryRelativePath: vaultEntryRelativePath }
      }
      if (isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, vaultParentFolderRelativePath, newVaultEntryName, vaultEntryRelativePath)) {
        return { vaultEntryRenameOutcome: 'refused', vaultEntryRenameProblem: 'Name Taken' }
      }

      const vaultEntryMoveProblem = await moveVaultEntryWithItsNotes(openVault, vaultEntryRelativePath, newVaultEntryRelativePath)
      if (vaultEntryMoveProblem !== null) return { vaultEntryRenameOutcome: 'refused', vaultEntryRenameProblem: vaultEntryMoveProblem }
      return { vaultEntryRenameOutcome: 'renamed', renamedVaultEntryRelativePath: newVaultEntryRelativePath }
    },

    moveVaultEntryIntoFolder: (vaultEntryRelativePath, targetVaultFolderRelativePath) =>
      getWorkspaceState().placeVaultEntryInFolder(vaultEntryRelativePath, targetVaultFolderRelativePath, { vaultEntryPlacementKind: 'last' }),

    placeVaultEntryInFolder: async (vaultEntryRelativePath, targetVaultFolderRelativePath, vaultEntryPlacement) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
      const placeNameInTargetFolder = () =>
        setVaultFolderEntryOrder(
          targetVaultFolderRelativePath,
          placeVaultEntryName(
            listVaultFolderEntryNamesInOrder(getWorkspaceState().vaultTreeEntries, targetVaultFolderRelativePath, getWorkspaceState().vaultEntryOrder),
            vaultEntryName,
            vaultEntryPlacement,
          ),
        )
      if (getVaultEntryParentFolderRelativePath(vaultEntryRelativePath) === targetVaultFolderRelativePath) {
        // Only the order changes; a plain move into the same folder changes nothing.
        if (vaultEntryPlacement.vaultEntryPlacementKind !== 'last' || getWorkspaceState().vaultEntryOrder[targetVaultFolderRelativePath] !== undefined) {
          placeNameInTargetFolder()
        }
        return
      }
      if (targetVaultFolderRelativePath === vaultEntryRelativePath || targetVaultFolderRelativePath.startsWith(`${vaultEntryRelativePath}/`)) {
        showWorkspaceNotice('error', `Couldn’t move “${vaultEntryName}” (Into Itself)`)
        return
      }
      if (isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, targetVaultFolderRelativePath, vaultEntryName, vaultEntryRelativePath)) {
        showWorkspaceNotice('error', `Couldn’t move “${getVaultNoteTitle(vaultEntryRelativePath)}” (Name Taken)`)
        return
      }
      const movedVaultEntryRelativePath = joinVaultRelativePath(targetVaultFolderRelativePath, vaultEntryName)
      const vaultEntryMoveProblem = await moveVaultEntryWithItsNotes(openVault, vaultEntryRelativePath, movedVaultEntryRelativePath)
      if (vaultEntryMoveProblem !== null) {
        showWorkspaceNotice('error', `Couldn’t move “${getVaultNoteTitle(vaultEntryRelativePath)}” (${vaultEntryMoveProblem})`)
        return
      }
      // The moved entry stays in sight: its new folder (and that folder's folders) open.
      expandParentFoldersOf(movedVaultEntryRelativePath)
      if (vaultEntryPlacement.vaultEntryPlacementKind !== 'last' || getWorkspaceState().vaultEntryOrder[targetVaultFolderRelativePath] !== undefined) {
        placeNameInTargetFolder()
      }
      showWorkspaceNotice(
        'info',
        targetVaultFolderRelativePath === papelizVaultRootFolderRelativePath
          ? `Moved “${getVaultNoteTitle(movedVaultEntryRelativePath)}” to the top.`
          : `Moved “${getVaultNoteTitle(movedVaultEntryRelativePath)}” into “${getVaultEntryName(targetVaultFolderRelativePath)}”.`,
      )
    },

    moveVaultEntryToTrash: async (vaultEntryRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      try {
        await trashVaultEntryAndTidyUp(openVault, vaultEntryRelativePath)
      } catch (vaultTrashError) {
        showWorkspaceNotice('error', `Couldn’t move “${getVaultNoteTitle(vaultEntryRelativePath)}” to the trash (${describePapelizVaultError(vaultTrashError)})`)
        await loadVaultTreeEntriesAfterChange()
        return
      }
      await loadVaultTreeEntriesAfterChange()
      showWorkspaceNotice('info', `Moved “${getVaultNoteTitle(vaultEntryRelativePath)}” to the trash.`)
    },

    writeVaultNoteTextFromAssistant: async (vaultNoteRelativePath, newVaultNoteText, assistantVaultNoteWritePurpose = 'accepted-change') => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No Vault Open')
      assertAssistantMayWriteVaultNote(vaultNoteRelativePath, assistantVaultNoteWritePurpose)
      const loadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      // A note that isn't open is written as it is; an open one saves through its tab, which tells Sync.
      if (loadedVaultNote?.noteLoadState !== 'loaded') {
        await runVaultOperationInOrder(() => openVault.papelizVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, newVaultNoteText))
        reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, vaultNoteRelativePath)
        return
      }
      updateLoadedVaultNoteForSession(loadedVaultNote.loadedNoteSessionId, (note) => ({
        ...note,
        draftVaultNoteText: newVaultNoteText,
        noteSaveState: newVaultNoteText === note.savedVaultNoteText ? 'saved' : 'unsaved',
      }))
      await saveLoadedVaultNote(loadedVaultNote.loadedNoteSessionId)
      const savedVaultNoteRelativePath = findVaultNoteRelativePathForSession(getWorkspaceState().loadedVaultNotesByRelativePath, loadedVaultNote.loadedNoteSessionId)
      const savedLoadedVaultNote = savedVaultNoteRelativePath === null ? undefined : getWorkspaceState().loadedVaultNotesByRelativePath[savedVaultNoteRelativePath]
      if (savedLoadedVaultNote?.noteSaveState === 'save-failed') {
        throw new PapelizVaultOperationError(savedLoadedVaultNote.noteSaveErrorMessage ?? 'Not Saved')
      }
    },

    createVaultNoteFromAssistant: async (vaultNoteRelativePath, vaultNoteText, assistantVaultNoteWritePurpose = 'accepted-change') => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No Vault Open')
      assertAssistantMayWriteVaultNote(vaultNoteRelativePath, assistantVaultNoteWritePurpose)
      await createVaultNoteWithItsFolders(openVault, vaultNoteRelativePath, vaultNoteText)
    },

    createChatAttachmentFileFromAssistant: async (preferredAttachmentFileName, attachmentFileBlob) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No Vault Open')
      const attachmentsFolderRelativePath = `${papelizVaultChatSessionFolderName}/attachments`
      // Characters a file name can't hold become dashes.
      const safeAttachmentFileName = preferredAttachmentFileName.replace(/[\\/:*?"<>|]+/g, '-').replace(/^\.+/, '').trim() || 'attachment'
      const attachmentExtensionMatch = /(\.[a-z0-9]{1,8})$/i.exec(safeAttachmentFileName)
      const attachmentExtension = attachmentExtensionMatch?.[1] ?? ''
      const attachmentBaseName = safeAttachmentFileName.slice(0, safeAttachmentFileName.length - attachmentExtension.length).slice(0, 120)
      let attachmentFileRelativePath = ''
      await runVaultOperationInOrder(async () => {
        await createMissingVaultFolders(openVault, attachmentsFolderRelativePath)
        const takenAttachmentNames = new Set(
          (await openVault.papelizVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }))
            .map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath.toLowerCase()),
        )
        const attachmentFileName = pickFreeVaultEntryName(attachmentBaseName, attachmentExtension, (candidateAttachmentFileName) =>
          takenAttachmentNames.has(`${attachmentsFolderRelativePath}/${candidateAttachmentFileName}`.toLowerCase()),
        )
        attachmentFileRelativePath = `${attachmentsFolderRelativePath}/${attachmentFileName}`
        await openVault.papelizVaultAdapter.createVaultAttachmentFile(attachmentFileRelativePath, attachmentFileBlob)
        reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, attachmentFileRelativePath)
      })
      // The folders it made show in the list, so the next save finds them there.
      await loadVaultTreeEntriesAfterChange()
      return attachmentFileRelativePath
    },

    setVaultEntryLook: (vaultEntryRelativePath, vaultEntryLook) => {
      setWorkspaceState((workspaceState) => ({ vaultEntryLooks: setPapelizVaultEntryLook(workspaceState.vaultEntryLooks, vaultEntryRelativePath, vaultEntryLook) }))
      saveVaultEntryLooks()
    },

    moveVaultEntriesToTrashFromAssistant: async (vaultEntryRelativePaths) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No Vault Open')
      try {
        for (const vaultEntryRelativePath of vaultEntryRelativePaths) await trashVaultEntryAndTidyUp(openVault, vaultEntryRelativePath)
      } finally {
        await loadVaultTreeEntriesAfterChange()
      }
      const trashedNoteCount = vaultEntryRelativePaths.filter(isVaultNoteFileName).length
      const trashedFolderCount = vaultEntryRelativePaths.length - trashedNoteCount
      const describeTrashedCount = (trashedCount: number, singularWord: string) => `${trashedCount} ${singularWord}${trashedCount === 1 ? '' : 's'}`
      showWorkspaceNotice(
        'info',
        vaultEntryRelativePaths.length === 1
          ? `Moved “${getVaultNoteTitle(vaultEntryRelativePaths[0] ?? '')}” to the trash.`
          : `Moved ${[trashedNoteCount > 0 ? describeTrashedCount(trashedNoteCount, 'note') : '', trashedFolderCount > 0 ? describeTrashedCount(trashedFolderCount, 'folder') : ''].filter((countWords) => countWords.length > 0).join(' and ')} to the trash.`,
      )
    },

    setNoteViewMode: (noteViewMode) => setWorkspaceState({ noteViewMode }),
    toggleNoteViewMode: () =>
      setWorkspaceState((workspaceState) => ({ noteViewMode: workspaceState.noteViewMode === 'md-code' ? 'md-view' : 'md-code' })),
    duplicateVaultEntry: async (vaultEntryRelativePath) => {
      const duplicatedVaultEntry = getWorkspaceState().vaultTreeEntries.find((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath === vaultEntryRelativePath)
      if (duplicatedVaultEntry === undefined) return
      await copyVaultEntryIntoFolder(duplicatedVaultEntry, getVaultEntryParentFolderRelativePath(vaultEntryRelativePath), 'always-add-copy')
    },

    copyVaultEntryForPaste: (copiedVaultEntry) => {
      setWorkspaceState({ copiedVaultEntry })
      showWorkspaceNotice('info', `Copied “${describeVaultEntryForNotice(copiedVaultEntry.vaultEntryRelativePath)}”.`)
    },

    pasteCopiedVaultEntry: async (targetVaultFolderRelativePath) => {
      const { copiedVaultEntry, vaultTreeEntries } = getWorkspaceState()
      if (copiedVaultEntry === null) return
      if (!vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath === copiedVaultEntry.vaultEntryRelativePath)) {
        setWorkspaceState({ copiedVaultEntry: null })
        showWorkspaceNotice('error', `Couldn’t paste “${describeVaultEntryForNotice(copiedVaultEntry.vaultEntryRelativePath)}” (File Not Found)`)
        return
      }
      await copyVaultEntryIntoFolder(copiedVaultEntry, targetVaultFolderRelativePath, 'add-copy-when-taken')
    },

    setWholeVaultEditingLocked: (isWholeVaultEditingLocked) => {
      setWorkspaceState({ isWholeVaultEditingLocked })
      saveLockedVaultEntries()
    },
    setHiddenVaultEntriesShown: (areHiddenVaultEntriesShown) => {
      setWorkspaceState({ areHiddenVaultEntriesShown })
      void writePapelizUserSetting(papelizHiddenVaultEntriesShownSettingName, areHiddenVaultEntriesShown).catch(() => undefined)
      void loadVaultTreeEntries()
    },
    setVaultEntryEditingLocked: (vaultEntryRelativePath, isVaultEntryEditingLocked) => {
      setWorkspaceState((workspaceState) => ({
        lockedVaultEntryRelativePaths: isVaultEntryEditingLocked
          ? [...workspaceState.lockedVaultEntryRelativePaths.filter((lockedPath) => lockedPath !== vaultEntryRelativePath), vaultEntryRelativePath]
          : workspaceState.lockedVaultEntryRelativePaths.filter((lockedPath) => lockedPath !== vaultEntryRelativePath),
      }))
      saveLockedVaultEntries()
    },
    revealVaultEntryInFileList: (vaultEntryRelativePath, vaultEntryKind) => {
      expandParentFoldersOf(vaultEntryRelativePath)
      getWorkspaceState().setExplorerPanelOpen(true)
      setWorkspaceState((workspaceState) => ({
        expandedVaultFolderRelativePaths:
          vaultEntryKind === 'folder'
            ? { ...workspaceState.expandedVaultFolderRelativePaths, [vaultEntryRelativePath]: true }
            : workspaceState.expandedVaultFolderRelativePaths,
      }))
    },

    toggleVaultFolderExpanded: (vaultFolderRelativePath) =>
      setWorkspaceState((workspaceState) => {
        const expandedVaultFolderRelativePaths = { ...workspaceState.expandedVaultFolderRelativePaths }
        if (expandedVaultFolderRelativePaths[vaultFolderRelativePath]) delete expandedVaultFolderRelativePaths[vaultFolderRelativePath]
        else expandedVaultFolderRelativePaths[vaultFolderRelativePath] = true
        return { expandedVaultFolderRelativePaths }
      }),
    startRenamingVaultEntry: (vaultEntryRelativePath) => setWorkspaceState({ vaultEntryBeingRenamedRelativePath: vaultEntryRelativePath }),
    stopRenamingVaultEntry: () => setWorkspaceState({ vaultEntryBeingRenamedRelativePath: null }),
    setExplorerPanelOpen: (isExplorerPanelOpen) =>
      setWorkspaceState((workspaceState) =>
        isExplorerPanelOpen
          ? {
              isExplorerPanelOpen,
              isAssistantPanelOpen: workspaceState.isAssistantPanelOpen && doWorkspaceSidePanelsFitBesideNote(),
              lastOpenedWorkspaceSidePanel: 'explorer',
            }
          : { isExplorerPanelOpen },
      ),
    setAssistantPanelOpen: (isAssistantPanelOpen) =>
      setWorkspaceState((workspaceState) =>
        isAssistantPanelOpen
          ? {
              isAssistantPanelOpen,
              isExplorerPanelOpen: workspaceState.isExplorerPanelOpen && doWorkspaceSidePanelsFitBesideNote(),
              lastOpenedWorkspaceSidePanel: 'assistant',
            }
          : { isAssistantPanelOpen },
      ),
    fitWorkspaceSidePanelsToWindow: (keptWorkspaceSidePanel) => {
      const workspaceState = getWorkspaceState()
      if (!workspaceState.isExplorerPanelOpen || !workspaceState.isAssistantPanelOpen || doWorkspaceSidePanelsFitBesideNote()) return
      const stayingWorkspaceSidePanel = keptWorkspaceSidePanel ?? workspaceState.lastOpenedWorkspaceSidePanel
      setWorkspaceState(stayingWorkspaceSidePanel === 'assistant' ? { isExplorerPanelOpen: false } : { isAssistantPanelOpen: false })
    },
    setFocusModeOn: (isFocusModeOn) => setWorkspaceState({ isFocusModeOn }),
    setVaultCloseConfirmationShown: (isVaultCloseConfirmationShown) => setWorkspaceState({ isVaultCloseConfirmationShown }),

    moveVaultEntryUpOrDown: (vaultEntryRelativePath, vaultEntryMoveDirection) => {
      const { vaultTreeEntries, vaultEntryOrder } = getWorkspaceState()
      const vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)
      const shownVaultEntryNames = listVaultFolderEntryNamesInOrder(vaultTreeEntries, vaultFolderRelativePath, vaultEntryOrder)
      const vaultEntryIndex = shownVaultEntryNames.indexOf(getVaultEntryName(vaultEntryRelativePath))
      const neighbourIndex = vaultEntryMoveDirection === 'up' ? vaultEntryIndex - 1 : vaultEntryIndex + 1
      if (vaultEntryIndex === -1 || neighbourIndex < 0 || neighbourIndex >= shownVaultEntryNames.length) return
      const reorderedVaultEntryNames = [...shownVaultEntryNames]
      reorderedVaultEntryNames[vaultEntryIndex] = shownVaultEntryNames[neighbourIndex] ?? ''
      reorderedVaultEntryNames[neighbourIndex] = shownVaultEntryNames[vaultEntryIndex] ?? ''
      setVaultFolderEntryOrder(vaultFolderRelativePath, reorderedVaultEntryNames)
    },
    showWorkspaceNotice,
    dismissWorkspaceNotice: () => setWorkspaceState({ workspaceNotice: null }),
    showAssistantProposalPreview: (assistantProposalPreview) => setWorkspaceState({ assistantProposalPreview }),
    closeAssistantProposalPreview: () => setWorkspaceState({ assistantProposalPreview: null }),

    resolveVaultNoteSaveConflict: async (loadedNoteSessionId, mergeChoicesByConflictId) => {
      const vaultNoteSaveConflict = getWorkspaceState().vaultNoteSaveConflictsByLoadedNoteSessionId[loadedNoteSessionId]
      if (vaultNoteSaveConflict?.vaultNoteSaveConflictKind !== 'same-lines-changed') return
      const remainingSaveConflicts = { ...getWorkspaceState().vaultNoteSaveConflictsByLoadedNoteSessionId }
      delete remainingSaveConflicts[loadedNoteSessionId]
      setWorkspaceState({ vaultNoteSaveConflictsByLoadedNoteSessionId: remainingSaveConflicts })
      // The settled text is now this tab's, made on the version saved elsewhere; saving it merges again
      // if yet another save landed meanwhile. Typing since the clash was shown is kept as typed.
      updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
        ...note,
        savedVaultNoteText: vaultNoteSaveConflict.savedElsewhereVaultNoteText,
        draftVaultNoteText:
          note.draftVaultNoteText === vaultNoteSaveConflict.myVaultNoteText
            ? resolvePapelizVaultNoteMerge(vaultNoteSaveConflict.vaultNoteMergeResult, mergeChoicesByConflictId)
            : note.draftVaultNoteText,
        noteSaveState: 'unsaved',
      }))
      await saveLoadedVaultNote(loadedNoteSessionId)
    },

    resolveVaultNoteDeletedElsewhere: async (loadedNoteSessionId, deletedElsewhereChoice) => {
      const openVault = getWorkspaceState().openVault
      const vaultNoteSaveConflict = getWorkspaceState().vaultNoteSaveConflictsByLoadedNoteSessionId[loadedNoteSessionId]
      if (openVault === null || vaultNoteSaveConflict?.vaultNoteSaveConflictKind !== 'deleted-elsewhere') return
      const remainingSaveConflicts = { ...getWorkspaceState().vaultNoteSaveConflictsByLoadedNoteSessionId }
      delete remainingSaveConflicts[loadedNoteSessionId]
      setWorkspaceState({ vaultNoteSaveConflictsByLoadedNoteSessionId: remainingSaveConflicts })
      const vaultNoteRelativePath = findVaultNoteRelativePathForSession(getWorkspaceState().loadedVaultNotesByRelativePath, loadedNoteSessionId)
      if (vaultNoteRelativePath === null) return
      if (deletedElsewhereChoice === 'close-note') {
        closeTabsInside(vaultNoteRelativePath)
        void deletePapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath).catch(() => undefined)
        return
      }
      // Written back where it was, with any folders on the way made again; typing since the question
      // was shown is kept.
      await loadVaultTreeEntries()
      try {
        let writtenVaultNoteText = ''
        await runVaultOperationInOrder(async () => {
          await createMissingVaultFolders(openVault, getVaultEntryParentFolderRelativePath(vaultNoteRelativePath))
          writtenVaultNoteText = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]?.draftVaultNoteText ?? ''
          await openVault.papelizVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, writtenVaultNoteText)
          reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, vaultNoteRelativePath)
        })
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          savedVaultNoteText: writtenVaultNoteText,
          noteSaveState: note.draftVaultNoteText === writtenVaultNoteText ? 'saved' : 'unsaved',
          noteSaveErrorMessage: null,
        }))
        void deletePapelizNoteRecoveryDraft(openVault.papelizVaultId, vaultNoteRelativePath).catch(() => undefined)
      } catch (vaultSaveError) {
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({
          ...note,
          noteSaveState: 'save-failed',
          noteSaveErrorMessage: describePapelizVaultError(vaultSaveError),
        }))
      }
      await loadVaultTreeEntriesAfterChange()
    },
  }
})

export function hasUnsavedPapelizVaultNotes(): boolean {
  return Object.values(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath).some(
    (loadedVaultNote) => loadedVaultNote.noteSaveState !== 'saved',
  )
}
