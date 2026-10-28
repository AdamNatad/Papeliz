import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizNoteRecoveryDraftsStoreName,
  putPapelizBrowserDatabaseRecord,
  readPapelizBrowserDatabaseRecord,
} from '../browser-database/papeliz-browser-database'

// Recovery copies of what was typed in a note and not saved yet, kept in this browser, so a crash, a
// closed tab or a save that keeps failing (the folder's permission gone, a full disk) loses nothing.
// A copy is written 1 s after typing stops, at least every 2 s while it goes on, and at once when the
// tab is hidden or put away; it is cleared once the note is saved. Opening the note again offers it
// back. Only a folder on disk has them: the sample vault starts afresh anyway.

export const papelizNoteRecoveryDraftAfterTypingStopsMilliseconds = 1000
export const papelizNoteRecoveryDraftWhileTypingMilliseconds = 2000

export interface PapelizNoteRecoveryDraft {
  // `papelizVaultId` and the note's path, one copy per note.
  noteRecoveryDraftKey: string
  papelizVaultId: string
  vaultNoteRelativePath: string
  // What was typed, and the saved version it was typed on.
  recoveryDraftVaultNoteText: string
  recoveryDraftBaseVaultNoteText: string
  recoveryDraftWrittenAt: string
}

export function buildPapelizNoteRecoveryDraftKey(papelizVaultId: string, vaultNoteRelativePath: string): string {
  return `${papelizVaultId}\n${vaultNoteRelativePath}`
}

export async function writePapelizNoteRecoveryDraft(
  papelizVaultId: string,
  vaultNoteRelativePath: string,
  recoveryDraftVaultNoteText: string,
  recoveryDraftBaseVaultNoteText: string,
): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await putPapelizBrowserDatabaseRecord<PapelizNoteRecoveryDraft>(papelizNoteRecoveryDraftsStoreName, {
    noteRecoveryDraftKey: buildPapelizNoteRecoveryDraftKey(papelizVaultId, vaultNoteRelativePath),
    papelizVaultId,
    vaultNoteRelativePath,
    recoveryDraftVaultNoteText,
    recoveryDraftBaseVaultNoteText,
    recoveryDraftWrittenAt: new Date().toISOString(),
  })
}

export async function readPapelizNoteRecoveryDraft(papelizVaultId: string, vaultNoteRelativePath: string): Promise<PapelizNoteRecoveryDraft | null> {
  if (!isPapelizBrowserDatabaseAvailable()) return null
  return (
    (await readPapelizBrowserDatabaseRecord<PapelizNoteRecoveryDraft>(
      papelizNoteRecoveryDraftsStoreName,
      buildPapelizNoteRecoveryDraftKey(papelizVaultId, vaultNoteRelativePath),
    ).catch(() => undefined)) ?? null
  )
}

export async function deletePapelizNoteRecoveryDraft(papelizVaultId: string, vaultNoteRelativePath: string): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await deletePapelizBrowserDatabaseRecord(papelizNoteRecoveryDraftsStoreName, buildPapelizNoteRecoveryDraftKey(papelizVaultId, vaultNoteRelativePath))
}
