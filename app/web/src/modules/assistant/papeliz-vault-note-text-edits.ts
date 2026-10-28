// The assistant never rewrites a whole note blindly. It proposes edits as "find this exact passage,
// put this in its place". Each passage must occur exactly once in the note, so an edit lands where
// the assistant meant it to, and an edit made against an older version of the note is refused
// instead of being applied in the wrong place.

export interface PapelizVaultNoteTextEdit {
  findText: string
  replaceWithText: string
}

export type PapelizVaultNoteTextEditsResult =
  | { vaultNoteTextEditsOutcome: 'applied'; editedVaultNoteText: string }
  | { vaultNoteTextEditsOutcome: 'refused'; vaultNoteTextEditsProblem: string }

function countTextOccurrences(searchedText: string, findText: string): number {
  let occurrenceCount = 0
  for (let searchFrom = searchedText.indexOf(findText); searchFrom !== -1; searchFrom = searchedText.indexOf(findText, searchFrom + 1)) {
    occurrenceCount += 1
    if (occurrenceCount > 1) return occurrenceCount
  }
  return occurrenceCount
}

// An empty `findText` adds `replaceWithText` at the end of the note.
export function applyPapelizVaultNoteTextEdits(
  vaultNoteText: string,
  vaultNoteTextEdits: readonly PapelizVaultNoteTextEdit[],
): PapelizVaultNoteTextEditsResult {
  let editedVaultNoteText = vaultNoteText
  for (const [vaultNoteTextEditIndex, vaultNoteTextEdit] of vaultNoteTextEdits.entries()) {
    const editLabel = vaultNoteTextEdits.length > 1 ? `Edit ${vaultNoteTextEditIndex + 1}: ` : ''
    if (vaultNoteTextEdit.findText.length === 0) {
      const separator = editedVaultNoteText.length === 0 || editedVaultNoteText.endsWith('\n\n') ? '' : editedVaultNoteText.endsWith('\n') ? '\n' : '\n\n'
      editedVaultNoteText = `${editedVaultNoteText}${separator}${vaultNoteTextEdit.replaceWithText}`
      continue
    }
    const occurrenceCount = countTextOccurrences(editedVaultNoteText, vaultNoteTextEdit.findText)
    if (occurrenceCount === 0) {
      return { vaultNoteTextEditsOutcome: 'refused', vaultNoteTextEditsProblem: `${editLabel}the passage to change is not in the note (it may have changed).` }
    }
    if (occurrenceCount > 1) {
      return { vaultNoteTextEditsOutcome: 'refused', vaultNoteTextEditsProblem: `${editLabel}the passage to change appears more than once; quote more of it.` }
    }
    editedVaultNoteText = editedVaultNoteText.replace(vaultNoteTextEdit.findText, () => vaultNoteTextEdit.replaceWithText)
  }
  return { vaultNoteTextEditsOutcome: 'applied', editedVaultNoteText }
}
