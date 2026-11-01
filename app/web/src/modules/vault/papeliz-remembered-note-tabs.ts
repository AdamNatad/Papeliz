import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizWorkspaceLayoutStoreName,
  putPapelizBrowserDatabaseRecord,
  readPapelizBrowserDatabaseRecord,
} from '../browser-database/papeliz-browser-database'

// Each vault's open tabs, in order, and the note that was in front, kept in this browser so opening
// the vault again (from Recent Vaults, after a reload, from Synced Vaults) brings them back. Per
// device and never synced: they live in the browser database, not in the vault's `.papeliz/` folder.
// A folder and a browser vault have them; the sample vault starts afresh anyway.

export interface PapelizRememberedNoteTabs {
  papelizVaultId: string
  rememberedNoteTabRelativePaths: string[]
  rememberedActiveVaultNoteRelativePath: string | null
  rememberedNoteTabsWrittenAt: string
}

export interface PapelizNoteTabsToRestore {
  noteTabRelativePaths: string[]
  activeVaultNoteRelativePath: string | null
}

export async function writePapelizRememberedNoteTabs(
  papelizVaultId: string,
  rememberedNoteTabRelativePaths: readonly string[],
  rememberedActiveVaultNoteRelativePath: string | null,
): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await putPapelizBrowserDatabaseRecord<PapelizRememberedNoteTabs>(papelizWorkspaceLayoutStoreName, {
    papelizVaultId,
    rememberedNoteTabRelativePaths: [...rememberedNoteTabRelativePaths],
    rememberedActiveVaultNoteRelativePath,
    rememberedNoteTabsWrittenAt: new Date().toISOString(),
  })
}

export async function readPapelizRememberedNoteTabs(papelizVaultId: string): Promise<PapelizRememberedNoteTabs | null> {
  if (!isPapelizBrowserDatabaseAvailable()) return null
  const storedNoteTabs = await readPapelizBrowserDatabaseRecord<Partial<PapelizRememberedNoteTabs>>(papelizWorkspaceLayoutStoreName, papelizVaultId).catch(
    () => undefined,
  )
  if (storedNoteTabs === undefined || !Array.isArray(storedNoteTabs.rememberedNoteTabRelativePaths)) return null
  return {
    papelizVaultId,
    rememberedNoteTabRelativePaths: storedNoteTabs.rememberedNoteTabRelativePaths.filter((noteTabRelativePath) => typeof noteTabRelativePath === 'string'),
    rememberedActiveVaultNoteRelativePath:
      typeof storedNoteTabs.rememberedActiveVaultNoteRelativePath === 'string' ? storedNoteTabs.rememberedActiveVaultNoteRelativePath : null,
    rememberedNoteTabsWrittenAt: typeof storedNoteTabs.rememberedNoteTabsWrittenAt === 'string' ? storedNoteTabs.rememberedNoteTabsWrittenAt : '',
  }
}

// When the vault itself is deleted from this browser.
export async function deletePapelizRememberedNoteTabs(papelizVaultId: string): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await deletePapelizBrowserDatabaseRecord(papelizWorkspaceLayoutStoreName, papelizVaultId)
}

// The remembered tabs whose notes are still in the vault, in their order; the rest are left out
// without a word. When the note in front is gone, its neighbor comes forward, as closing its tab does.
export function pickPapelizRememberedNoteTabsStillInVault(
  rememberedNoteTabs: Pick<PapelizRememberedNoteTabs, 'rememberedNoteTabRelativePaths' | 'rememberedActiveVaultNoteRelativePath'>,
  isVaultNoteStillInVault: (vaultNoteRelativePath: string) => boolean,
): PapelizNoteTabsToRestore {
  const { rememberedNoteTabRelativePaths, rememberedActiveVaultNoteRelativePath } = rememberedNoteTabs
  const noteTabRelativePaths = [...new Set(rememberedNoteTabRelativePaths)].filter(isVaultNoteStillInVault)
  if (rememberedActiveVaultNoteRelativePath !== null && noteTabRelativePaths.includes(rememberedActiveVaultNoteRelativePath)) {
    return { noteTabRelativePaths, activeVaultNoteRelativePath: rememberedActiveVaultNoteRelativePath }
  }
  const goneActiveNoteTabIndex = rememberedActiveVaultNoteRelativePath === null ? -1 : rememberedNoteTabRelativePaths.indexOf(rememberedActiveVaultNoteRelativePath)
  const tabsStillBeforeGoneActiveNote = rememberedNoteTabRelativePaths
    .slice(0, Math.max(goneActiveNoteTabIndex, 0))
    .filter((vaultNoteRelativePath) => noteTabRelativePaths.includes(vaultNoteRelativePath)).length
  return {
    noteTabRelativePaths,
    activeVaultNoteRelativePath: noteTabRelativePaths[Math.min(tabsStillBeforeGoneActiveNote, noteTabRelativePaths.length - 1)] ?? null,
  }
}
