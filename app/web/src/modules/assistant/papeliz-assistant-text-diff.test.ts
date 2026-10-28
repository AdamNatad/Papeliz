import { describe, expect, it } from 'vitest'
import { diffPapelizTextByWords, joinPapelizTextDiffSide } from './papeliz-assistant-text-diff'
import { applyPapelizVaultNoteTextEdits } from './papeliz-vault-note-text-edits'

describe('the word diff', () => {
  it('marks only the words that changed', () => {
    const textDiffParts = diffPapelizTextByWords('The hard part is not storage.', 'The hard part is merging.')
    expect(textDiffParts).toEqual([
      { textDiffPartKind: 'kept', textDiffPartText: 'The hard part is ' },
      { textDiffPartKind: 'removed', textDiffPartText: 'not storage' },
      { textDiffPartKind: 'added', textDiffPartText: 'merging' },
      { textDiffPartKind: 'kept', textDiffPartText: '.' },
    ])
  })

  it('always rebuilds both texts exactly', () => {
    const originalText = '# Garden plan\n\nThree raised beds along the south fence.\n- [ ] Order seeds'
    const changedText = '# Garden plan\n\nFour raised beds, along the east fence.\n- [x] Order seeds\n- [ ] Water'
    const textDiffParts = diffPapelizTextByWords(originalText, changedText)
    expect(joinPapelizTextDiffSide(textDiffParts, 'original')).toBe(originalText)
    expect(joinPapelizTextDiffSide(textDiffParts, 'changed')).toBe(changedText)
  })

  it('handles empty sides', () => {
    expect(diffPapelizTextByWords('', 'New note')).toEqual([{ textDiffPartKind: 'added', textDiffPartText: 'New note' }])
    expect(diffPapelizTextByWords('Old', '')).toEqual([{ textDiffPartKind: 'removed', textDiffPartText: 'Old' }])
  })
})

describe('find-and-replace edits', () => {
  it('applies edits whose passage occurs exactly once', () => {
    expect(applyPapelizVaultNoteTextEdits('A cat. A dog.', [{ findText: 'A dog.', replaceWithText: 'A bird.' }])).toEqual({
      vaultNoteTextEditsOutcome: 'applied',
      editedVaultNoteText: 'A cat. A bird.',
    })
  })

  it('refuses a passage that is missing or appears twice', () => {
    expect(applyPapelizVaultNoteTextEdits('A cat. A cat.', [{ findText: 'A cat.', replaceWithText: 'x' }]).vaultNoteTextEditsOutcome).toBe('refused')
    expect(applyPapelizVaultNoteTextEdits('A cat.', [{ findText: 'A dog.', replaceWithText: 'x' }]).vaultNoteTextEditsOutcome).toBe('refused')
  })

  it('adds to the end when there is nothing to find, and keeps $ signs literal', () => {
    expect(applyPapelizVaultNoteTextEdits('# Note\n', [{ findText: '', replaceWithText: 'See [[Other]].' }])).toEqual({
      vaultNoteTextEditsOutcome: 'applied',
      editedVaultNoteText: '# Note\n\nSee [[Other]].',
    })
    expect(applyPapelizVaultNoteTextEdits('Price: X', [{ findText: 'X', replaceWithText: '$& $1' }])).toEqual({
      vaultNoteTextEditsOutcome: 'applied',
      editedVaultNoteText: 'Price: $& $1',
    })
  })
})
