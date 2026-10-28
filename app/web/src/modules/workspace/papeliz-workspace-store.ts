import { useMemo } from 'react'
import { create } from 'zustand'
import { papelizHiddenVaultEntriesShownSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import { getVaultNoteRelativePathForNewWikilinkTarget } from '../links/papeliz-wikilink-targets'
import type { PapelizNoteViewMode } from '../note-editor/papeliz-note-editor'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { describePapelizVaultError, PapelizVaultOperationError, type PapelizVaultEntryKind, type PapelizVaultTreeEntry } from '../vault/papeliz-vault-adapter'
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
  pickFreeVaultEntryName,
  replaceVaultRelativePathPrefix,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
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

export type PapelizNoteSaveState = 'saved' | 'unsaved' | 'saving' | 'save-failed'

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
// autosave of the same note, and an autosave queued during a rename writes to the new name.
let vaultOperationQueueTail: Promise<unknown> = Promise.resolve()
function runVaultOperationInOrder<VaultOperationResult>(vaultOperation: () => Promise<VaultOperationResult>): Promise<VaultOperationResult> {
  const vaultOperationResult = vaultOperationQueueTail.then(vaultOperation, vaultOperation)
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
      const vaultNoteTextBeingSaved = loadedVaultNote.draftVaultNoteText
      updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => ({ ...note, noteSaveState: 'saving' }))
      try {
        await openVault.papelizVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, vaultNoteTextBeingSaved)
        let needsAnotherSave = false
        updateLoadedVaultNoteForSession(loadedNoteSessionId, (note) => {
          needsAnotherSave = note.draftVaultNoteText !== vaultNoteTextBeingSaved
          return {
            ...note,
            savedVaultNoteText: vaultNoteTextBeingSaved,
            noteSaveState: needsAnotherSave ? 'unsaved' : 'saved',
            noteSaveErrorMessage: null,
          }
        })
        if (needsAnotherSave) scheduleAutosave(loadedNoteSessionId)
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
      throw new PapelizVaultOperationError('Papeliz doesn’t change notes in hidden folders.')
    }
    if (assistantVaultNoteWritePurpose === 'saved-chat-session') return
    if (vaultNoteEditingLock?.vaultNoteEditingLockKind === 'whole-vault') {
      throw new PapelizVaultOperationError('All notes are locked. Unlock them in Accessibility to accept this change.')
    }
    if (vaultNoteEditingLock?.vaultNoteEditingLockKind === 'vault-entry') {
      throw new PapelizVaultOperationError(`“${getVaultEntryName(vaultNoteEditingLock.lockingVaultEntryRelativePath)}” is locked. Unlock it to accept this change.`)
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
      showWorkspaceNotice('error', `The notes could not be listed. ${describePapelizVaultError(vaultTreeError)}`)
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
          }
        })
      })
      saveVaultEntryOrder()
      if (getWorkspaceState().lockedVaultEntryRelativePaths.length > 0) saveLockedVaultEntries()
    } catch (vaultMoveError) {
      await loadVaultTreeEntries()
      return describePapelizVaultError(vaultMoveError)
    }
    await loadVaultTreeEntries()
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
      .catch((vaultSettingsWriteError: unknown) => {
        if (getWorkspaceState().openVault === openVault) {
          showWorkspaceNotice('error', `${savedThingDescription} could not be saved in the vault. ${describePapelizVaultError(vaultSettingsWriteError)}`)
        }
      })
  }

  const saveVaultEntryOrder = () =>
    writePapelizVaultSettingsFileInOrder(papelizFileListOrderFileName, formatPapelizFileListOrderFile(getWorkspaceState().vaultEntryOrder), 'The file list order')

  const saveLockedVaultEntries = () =>
    writePapelizVaultSettingsFileInOrder(
      papelizLockedEntriesFileName,
      formatPapelizLockedEntriesFile(getWorkspaceState().lockedVaultEntryRelativePaths, getWorkspaceState().isWholeVaultEditingLocked),
      'The editing locks',
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
      showWorkspaceNotice('error', `“${getVaultEntryName(sourceVaultEntryRelativePath)}” can’t be copied into itself.`)
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
    } catch (vaultCopyError) {
      showWorkspaceNotice('error', `“${describeVaultEntryForNotice(sourceVaultEntryRelativePath)}” could not be copied. ${describePapelizVaultError(vaultCopyError)}`)
      await loadVaultTreeEntries()
      return
    }
    await loadVaultTreeEntries()
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
    showWorkspaceNotice('info', `Made “${describeVaultEntryForNotice(copyVaultEntryRelativePath)}”.`)
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
    if (vaultPathProblem !== undefined) throw new PapelizVaultOperationError(`A note can’t be named “${newVaultNoteRelativePath}”. ${vaultPathProblem}`)
    await runVaultOperationInOrder(async () => {
      const newVaultNoteFolderSegments = splitVaultRelativePath(getVaultEntryParentFolderRelativePath(newVaultNoteRelativePath))
      for (let segmentIndex = 0; segmentIndex < newVaultNoteFolderSegments.length; segmentIndex += 1) {
        const vaultFolderRelativePath = newVaultNoteFolderSegments.slice(0, segmentIndex + 1).join('/')
        const isExistingFolder = getWorkspaceState().vaultTreeEntries.some(
          (vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'folder' && vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === vaultFolderRelativePath.toLowerCase(),
        )
        if (!isExistingFolder) await papelizOpenVault.papelizVaultAdapter.createVaultFolder(vaultFolderRelativePath)
      }
      await papelizOpenVault.papelizVaultAdapter.createVaultNote(newVaultNoteRelativePath, newVaultNoteText)
    })
    await loadVaultTreeEntries()
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
    isWholeVaultEditingLocked: false,
    areHiddenVaultEntriesShown: false,
    copiedVaultEntry: null,
    expandedVaultFolderRelativePaths: {},
    vaultEntryBeingRenamedRelativePath: null,
    ...createInitialWorkspaceLayout(),
    workspaceNotice: null,

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
        vaultEntryOrder: {},
        lockedVaultEntryRelativePaths: [],
        isWholeVaultEditingLocked: false,
        copiedVaultEntry: null,
      })
      // The file list's order and the editing locks, from the vault's own `.papeliz/` folder, and
      // whether this browser shows hidden entries.
      const [savedFileListOrderText, savedLockedEntriesText, areHiddenVaultEntriesShown] = await Promise.all([
        papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizFileListOrderFileName).catch(() => null),
        papelizOpenVault.papelizVaultAdapter.readPapelizVaultSettingsFile(papelizLockedEntriesFileName).catch(() => null),
        readPapelizUserSetting<unknown>(papelizHiddenVaultEntriesShownSettingName, false).then((savedSettingValue) => savedSettingValue === true),
      ])
      if (getWorkspaceState().openVault === papelizOpenVault) {
        setWorkspaceState({
          vaultEntryOrder: parsePapelizFileListOrderFile(savedFileListOrderText),
          lockedVaultEntryRelativePaths: parsePapelizLockedEntriesFile(savedLockedEntriesText),
          isWholeVaultEditingLocked: parsePapelizWholeVaultEditingLock(savedLockedEntriesText),
          areHiddenVaultEntriesShown,
        })
      }
      await loadVaultTreeEntries()
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
      if (getWorkspaceState().openVault === null) return
      await getWorkspaceState().saveAllVaultNotesNow()
      for (const autosaveTimer of autosaveTimersByLoadedNoteSessionId.values()) clearTimeout(autosaveTimer)
      autosaveTimersByLoadedNoteSessionId.clear()
      setWorkspaceState({
        openVault: null,
        vaultTreeEntries: [],
        openNoteTabRelativePaths: [],
        activeVaultNoteRelativePath: null,
        loadedVaultNotesByRelativePath: {},
        vaultEntryBeingRenamedRelativePath: null,
        workspaceNotice: null,
        isVaultCloseConfirmationShown: false,
        vaultEntryOrder: {},
        lockedVaultEntryRelativePaths: [],
        isWholeVaultEditingLocked: false,
        copiedVaultEntry: null,
      })
    },

    refreshVaultTree: loadVaultTreeEntries,

    openVaultNote: async (vaultNoteRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
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
        showWorkspaceNotice('error', `The note could not be created. ${describePapelizVaultError(vaultCreateError)}`)
        return
      }
      showWorkspaceNotice('info', `Created “${getVaultEntryName(newVaultNoteRelativePath)}”.`)
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
        showWorkspaceNotice('error', 'This note couldn’t be saved, so its tab stays open and your changes are kept.')
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
      } catch (vaultCreateError) {
        showWorkspaceNotice('error', `The note could not be created. ${describePapelizVaultError(vaultCreateError)}`)
        return
      }
      await loadVaultTreeEntries()
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
        showWorkspaceNotice('error', `The folder could not be created. ${describePapelizVaultError(vaultCreateError)}`)
        return
      }
      await loadVaultTreeEntries()
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
        return { vaultEntryRenameOutcome: 'refused', vaultEntryRenameProblem: `“${newVaultEntryName}” already exists here.` }
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
        showWorkspaceNotice('error', `“${vaultEntryName}” can’t go inside itself.`)
        return
      }
      const targetVaultFolderLabel = targetVaultFolderRelativePath === papelizVaultRootFolderRelativePath ? 'the top of the vault' : `“${getVaultEntryName(targetVaultFolderRelativePath)}”`
      if (isVaultEntryNameTakenInFolder(getWorkspaceState().vaultTreeEntries, targetVaultFolderRelativePath, vaultEntryName, vaultEntryRelativePath)) {
        showWorkspaceNotice('error', `Not moved: “${vaultEntryName}” already exists in ${targetVaultFolderLabel}.`)
        return
      }
      const movedVaultEntryRelativePath = joinVaultRelativePath(targetVaultFolderRelativePath, vaultEntryName)
      const vaultEntryMoveProblem = await moveVaultEntryWithItsNotes(openVault, vaultEntryRelativePath, movedVaultEntryRelativePath)
      if (vaultEntryMoveProblem !== null) {
        showWorkspaceNotice('error', `“${vaultEntryName}” could not be moved. ${vaultEntryMoveProblem}`)
        return
      }
      // The moved entry stays in sight: its new folder (and that folder's folders) open.
      expandParentFoldersOf(movedVaultEntryRelativePath)
      if (vaultEntryPlacement.vaultEntryPlacementKind !== 'last' || getWorkspaceState().vaultEntryOrder[targetVaultFolderRelativePath] !== undefined) {
        placeNameInTargetFolder()
      }
      showWorkspaceNotice('info', `Moved “${isVaultNoteFileName(vaultEntryName) ? getVaultNoteTitle(movedVaultEntryRelativePath) : vaultEntryName}” into ${targetVaultFolderLabel}.`)
    },

    moveVaultEntryToTrash: async (vaultEntryRelativePath) => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) return
      await saveVaultNotesInside(vaultEntryRelativePath)
      let trashVaultEntryRelativePath: string
      try {
        trashVaultEntryRelativePath = await runVaultOperationInOrder(async () => {
          const movedToVaultEntryRelativePath = await openVault.papelizVaultAdapter.moveVaultEntryToTrash(vaultEntryRelativePath)
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
          return movedToVaultEntryRelativePath
        })
      } catch (vaultTrashError) {
        showWorkspaceNotice('error', `“${getVaultEntryName(vaultEntryRelativePath)}” could not be moved to the trash. ${describePapelizVaultError(vaultTrashError)}`)
        await loadVaultTreeEntries()
        return
      }
      await loadVaultTreeEntries()
      showWorkspaceNotice('info', `Moved “${getVaultEntryName(vaultEntryRelativePath)}” to ${trashVaultEntryRelativePath}.`)
    },

    writeVaultNoteTextFromAssistant: async (vaultNoteRelativePath, newVaultNoteText, assistantVaultNoteWritePurpose = 'accepted-change') => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No vault is open.')
      assertAssistantMayWriteVaultNote(vaultNoteRelativePath, assistantVaultNoteWritePurpose)
      const loadedVaultNote = getWorkspaceState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote?.noteLoadState !== 'loaded') {
        await runVaultOperationInOrder(() => openVault.papelizVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, newVaultNoteText))
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
        throw new PapelizVaultOperationError(savedLoadedVaultNote.noteSaveErrorMessage ?? 'The note could not be saved.')
      }
    },

    createVaultNoteFromAssistant: async (vaultNoteRelativePath, vaultNoteText, assistantVaultNoteWritePurpose = 'accepted-change') => {
      const openVault = getWorkspaceState().openVault
      if (openVault === null) throw new PapelizVaultOperationError('No vault is open.')
      assertAssistantMayWriteVaultNote(vaultNoteRelativePath, assistantVaultNoteWritePurpose)
      await createVaultNoteWithItsFolders(openVault, vaultNoteRelativePath, vaultNoteText)
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
      showWorkspaceNotice('info', `Copied “${describeVaultEntryForNotice(copiedVaultEntry.vaultEntryRelativePath)}”. Paste it from a folder’s ··· menu, or with Ctrl+V.`)
    },

    pasteCopiedVaultEntry: async (targetVaultFolderRelativePath) => {
      const { copiedVaultEntry, vaultTreeEntries } = getWorkspaceState()
      if (copiedVaultEntry === null) return
      if (!vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath === copiedVaultEntry.vaultEntryRelativePath)) {
        setWorkspaceState({ copiedVaultEntry: null })
        showWorkspaceNotice('error', 'The copied note or folder is no longer in the vault.')
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
  }
})

export function hasUnsavedPapelizVaultNotes(): boolean {
  return Object.values(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath).some(
    (loadedVaultNote) => loadedVaultNote.noteSaveState !== 'saved',
  )
}
