import { create } from 'zustand'
import { readPapelizVaultNoteIndexEntry, type PapelizVaultNoteIndexEntry } from '../links/papeliz-vault-note-index'
import { createPapelizVaultSearchClient, type PapelizVaultSearchClient } from '../search/papeliz-vault-search-client'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// What Papeliz knows across the whole open vault: every note's links, tags and headings (for
// Backlinks, Outline and the assistant), and the full-text search index. It follows the workspace:
// notes appearing, disappearing or being typed in are indexed again shortly after.

interface PapelizVaultKnowledgeState {
  vaultNoteIndexEntriesByRelativePath: Record<string, PapelizVaultNoteIndexEntry>
  vaultKnowledgeBuildState: 'idle' | 'building' | 'ready'
}

export const usePapelizVaultKnowledgeStore = create<PapelizVaultKnowledgeState>()(() => ({
  vaultNoteIndexEntriesByRelativePath: {},
  vaultKnowledgeBuildState: 'idle',
}))

const papelizDraftReindexDelayMilliseconds = 400

let papelizVaultSearchClient: PapelizVaultSearchClient | null = null

export function getPapelizVaultSearchClient(): PapelizVaultSearchClient {
  papelizVaultSearchClient ??= createPapelizVaultSearchClient()
  return papelizVaultSearchClient
}

// A note's latest text: what is typed in an open tab, otherwise what is on disk.
export async function readLatestPapelizVaultNoteText(papelizOpenVault: PapelizOpenVault, vaultNoteRelativePath: string): Promise<string> {
  const loadedVaultNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
  if (loadedVaultNote?.noteLoadState === 'loaded') return loadedVaultNote.draftVaultNoteText
  return papelizOpenVault.papelizVaultAdapter.readVaultNoteText(vaultNoteRelativePath)
}

export function startPapelizVaultKnowledgeSync(): () => void {
  let syncedOpenVault: PapelizOpenVault | null = null
  let knownVaultNoteRelativePaths = new Set<string>()
  let vaultKnowledgeSyncQueue: Promise<void> = Promise.resolve()
  const draftReindexTimersByRelativePath = new Map<string, ReturnType<typeof setTimeout>>()
  const papelizSearchClient = getPapelizVaultSearchClient()

  const indexVaultNote = (vaultNoteRelativePath: string, vaultNoteText: string) => {
    const vaultNoteIndexEntry = readPapelizVaultNoteIndexEntry(vaultNoteRelativePath, vaultNoteText)
    usePapelizVaultKnowledgeStore.setState((knowledgeState) => ({
      vaultNoteIndexEntriesByRelativePath: { ...knowledgeState.vaultNoteIndexEntriesByRelativePath, [vaultNoteRelativePath]: vaultNoteIndexEntry },
    }))
    papelizSearchClient.upsertVaultSearchNote({ vaultNoteRelativePath, vaultNoteTitle: getVaultNoteTitle(vaultNoteRelativePath), vaultNoteText })
  }

  const syncVaultNotePaths = async () => {
    const workspaceState = usePapelizWorkspaceStore.getState()
    const openVault = workspaceState.openVault
    if (openVault !== syncedOpenVault) {
      syncedOpenVault = openVault
      knownVaultNoteRelativePaths = new Set()
      papelizSearchClient.replaceAllVaultSearchNotes([])
      usePapelizVaultKnowledgeStore.setState({ vaultNoteIndexEntriesByRelativePath: {}, vaultKnowledgeBuildState: openVault === null ? 'idle' : 'building' })
    }
    if (openVault === null || workspaceState.vaultTreeLoadState !== 'loaded') return

    const currentVaultNoteRelativePaths = new Set(
      workspaceState.vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
    )
    const removedVaultNoteRelativePaths = [...knownVaultNoteRelativePaths].filter((vaultNoteRelativePath) => !currentVaultNoteRelativePaths.has(vaultNoteRelativePath))
    const addedVaultNoteRelativePaths = [...currentVaultNoteRelativePaths].filter((vaultNoteRelativePath) => !knownVaultNoteRelativePaths.has(vaultNoteRelativePath))
    knownVaultNoteRelativePaths = currentVaultNoteRelativePaths

    if (removedVaultNoteRelativePaths.length > 0) {
      papelizSearchClient.removeVaultSearchNotes(removedVaultNoteRelativePaths)
      usePapelizVaultKnowledgeStore.setState((knowledgeState) => {
        const vaultNoteIndexEntriesByRelativePath = { ...knowledgeState.vaultNoteIndexEntriesByRelativePath }
        for (const removedVaultNoteRelativePath of removedVaultNoteRelativePaths) delete vaultNoteIndexEntriesByRelativePath[removedVaultNoteRelativePath]
        return { vaultNoteIndexEntriesByRelativePath }
      })
    }
    for (const addedVaultNoteRelativePath of addedVaultNoteRelativePaths) {
      try {
        const vaultNoteText = await readLatestPapelizVaultNoteText(openVault, addedVaultNoteRelativePath)
        if (usePapelizWorkspaceStore.getState().openVault !== openVault) return
        indexVaultNote(addedVaultNoteRelativePath, vaultNoteText)
      } catch {
        // A note that can't be read now is indexed when it is next opened or saved.
      }
    }
    usePapelizVaultKnowledgeStore.setState({ vaultKnowledgeBuildState: 'ready' })
  }

  const queueVaultNotePathSync = () => {
    vaultKnowledgeSyncQueue = vaultKnowledgeSyncQueue.then(syncVaultNotePaths, syncVaultNotePaths)
  }

  const unsubscribeFromWorkspace = usePapelizWorkspaceStore.subscribe((workspaceState, previousWorkspaceState) => {
    if (
      workspaceState.openVault !== previousWorkspaceState.openVault ||
      workspaceState.vaultTreeEntries !== previousWorkspaceState.vaultTreeEntries ||
      workspaceState.vaultTreeLoadState !== previousWorkspaceState.vaultTreeLoadState
    ) {
      queueVaultNotePathSync()
    }
    if (workspaceState.loadedVaultNotesByRelativePath === previousWorkspaceState.loadedVaultNotesByRelativePath) return
    for (const [vaultNoteRelativePath, loadedVaultNote] of Object.entries(workspaceState.loadedVaultNotesByRelativePath)) {
      const previousLoadedVaultNote = previousWorkspaceState.loadedVaultNotesByRelativePath[vaultNoteRelativePath]
      if (loadedVaultNote.noteLoadState !== 'loaded' || previousLoadedVaultNote?.draftVaultNoteText === loadedVaultNote.draftVaultNoteText) continue
      const pendingReindexTimer = draftReindexTimersByRelativePath.get(vaultNoteRelativePath)
      if (pendingReindexTimer !== undefined) clearTimeout(pendingReindexTimer)
      draftReindexTimersByRelativePath.set(
        vaultNoteRelativePath,
        setTimeout(() => {
          draftReindexTimersByRelativePath.delete(vaultNoteRelativePath)
          const latestLoadedVaultNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
          if (latestLoadedVaultNote?.noteLoadState === 'loaded' && knownVaultNoteRelativePaths.has(vaultNoteRelativePath)) {
            indexVaultNote(vaultNoteRelativePath, latestLoadedVaultNote.draftVaultNoteText)
          }
        }, papelizDraftReindexDelayMilliseconds),
      )
    }
  })

  queueVaultNotePathSync()
  return () => {
    unsubscribeFromWorkspace()
    for (const draftReindexTimer of draftReindexTimersByRelativePath.values()) clearTimeout(draftReindexTimer)
    draftReindexTimersByRelativePath.clear()
  }
}
