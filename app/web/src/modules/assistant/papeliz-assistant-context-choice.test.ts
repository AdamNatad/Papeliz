import { describe, expect, it } from 'vitest'
import {
  describePapelizAssistantContextChoiceAboutLabel,
  describePapelizAssistantContextChoiceButtonWords,
  describePapelizAssistantContextChoiceTooltip,
  isPapelizAssistantContextMode,
  listPapelizAssistantContextNoteRelativePaths,
  papelizDefaultAssistantContextChoice,
  type PapelizAssistantContextChoice,
  type PapelizAssistantContextWorkspaceReading,
} from './papeliz-assistant-context-choice'

const testWorkspaceReading: PapelizAssistantContextWorkspaceReading = {
  activeVaultMarkdownNoteRelativePath: 'Projects/Project Hub.md',
  openNoteTabMarkdownNoteRelativePaths: ['Projects/Project Hub.md', 'Inbox.md', 'Gone.md'],
  vaultNoteRelativePaths: ['Inbox.md', 'Projects/Project Hub.md', 'Projects/Garden/Beds.md', 'Projects Archive/Old.md', 'Meeting Notes 2026-11-02.md'],
}

function chooseContext(contextChoiceChanges: Partial<PapelizAssistantContextChoice>): PapelizAssistantContextChoice {
  return { ...papelizDefaultAssistantContextChoice, ...contextChoiceChanges }
}

describe('what the assistant sees', () => {
  it('lists the notes each of the five choices puts in the request', () => {
    expect(listPapelizAssistantContextNoteRelativePaths(chooseContext({ assistantContextMode: 'active-note' }), testWorkspaceReading)).toEqual(['Projects/Project Hub.md'])
    // A tab whose note is gone from the vault is left out.
    expect(listPapelizAssistantContextNoteRelativePaths(chooseContext({ assistantContextMode: 'open-notes' }), testWorkspaceReading)).toEqual(['Projects/Project Hub.md', 'Inbox.md'])
    expect(
      listPapelizAssistantContextNoteRelativePaths(
        chooseContext({ assistantContextMode: 'selected-notes', contextSelectedNoteRelativePaths: ['Inbox.md', 'Deleted.md', 'Meeting Notes 2026-11-02.md'] }),
        testWorkspaceReading,
      ),
    ).toEqual(['Inbox.md', 'Meeting Notes 2026-11-02.md'])
    // A folder holds its subfolders' notes, and not a sibling whose name starts the same.
    expect(
      listPapelizAssistantContextNoteRelativePaths(chooseContext({ assistantContextMode: 'folder', contextFolderRelativePath: 'Projects' }), testWorkspaceReading),
    ).toEqual(['Projects/Project Hub.md', 'Projects/Garden/Beds.md'])
    expect(listPapelizAssistantContextNoteRelativePaths(chooseContext({ assistantContextMode: 'folder' }), testWorkspaceReading)).toEqual([])
    // Whole Vault sends no note's text: the assistant searches and reads with its tools.
    expect(listPapelizAssistantContextNoteRelativePaths(chooseContext({ assistantContextMode: 'whole-vault' }), testWorkspaceReading)).toEqual([])
    expect(listPapelizAssistantContextNoteRelativePaths(papelizDefaultAssistantContextChoice, { ...testWorkspaceReading, activeVaultMarkdownNoteRelativePath: null })).toEqual([])
  })

  it('names the choice on its button, over a message and in its tooltip', () => {
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'active-note' }), 1)).toBe('This Note')
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'open-notes' }), 2)).toBe('Open Notes')
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'selected-notes' }), 1)).toBe('1 Note')
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'selected-notes' }), 3)).toBe('3 Notes')
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'folder', contextFolderRelativePath: 'Projects/Garden' }), 1)).toBe('Garden')
    expect(describePapelizAssistantContextChoiceButtonWords(chooseContext({ assistantContextMode: 'whole-vault' }), 0)).toBe('Whole Vault')

    expect(describePapelizAssistantContextChoiceAboutLabel(chooseContext({ assistantContextMode: 'active-note' }), ['Projects/Project Hub.md'])).toBe('Project Hub')
    expect(describePapelizAssistantContextChoiceAboutLabel(chooseContext({ assistantContextMode: 'open-notes' }), ['Inbox.md', 'Projects/Project Hub.md'])).toBe('2 open notes')
    expect(describePapelizAssistantContextChoiceAboutLabel(chooseContext({ assistantContextMode: 'selected-notes' }), ['Inbox.md', 'Projects/Project Hub.md'])).toBe('2 notes')
    expect(describePapelizAssistantContextChoiceAboutLabel(chooseContext({ assistantContextMode: 'folder', contextFolderRelativePath: 'Projects' }), ['Projects/Project Hub.md'])).toBe(
      'Projects',
    )
    expect(describePapelizAssistantContextChoiceAboutLabel(chooseContext({ assistantContextMode: 'whole-vault' }), [])).toBeNull()

    expect(describePapelizAssistantContextChoiceTooltip(chooseContext({ assistantContextMode: 'selected-notes' }), ['Inbox.md', 'Projects/Project Hub.md'])).toBe(
      'Sees 2 notes: Inbox, Project Hub.',
    )
    expect(
      describePapelizAssistantContextChoiceTooltip(
        chooseContext({ assistantContextMode: 'folder', contextFolderRelativePath: 'Notes' }),
        Array.from({ length: 8 }, (_, noteIndex) => `Notes/Note ${noteIndex + 1}.md`),
      ),
    ).toBe('Sees 8 notes: Note 1, Note 2, Note 3, Note 4, Note 5, Note 6, and 2 more.')
    expect(describePapelizAssistantContextChoiceTooltip(chooseContext({ assistantContextMode: 'whole-vault' }), [])).toBe(
      'Sees the whole vault: it searches and reads notes as it needs them.',
    )
    expect(describePapelizAssistantContextChoiceTooltip(chooseContext({ assistantContextMode: 'selected-notes' }), [])).toBe('Sees no note yet: choose some.')
  })

  it('knows its five choices by name', () => {
    expect(['active-note', 'open-notes', 'selected-notes', 'folder', 'whole-vault'].every(isPapelizAssistantContextMode)).toBe(true)
    expect(isPapelizAssistantContextMode('note')).toBe(false)
  })
})
