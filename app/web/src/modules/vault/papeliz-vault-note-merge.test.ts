import { describe, expect, it } from 'vitest'
import { mergePapelizVaultNoteText, resolvePapelizVaultNoteMerge } from './papeliz-vault-note-merge'

const baseNoteText = '# Garden\n\nKale\nBeans\nTomatoes\n'

describe('merging a note saved in two places', () => {
  it('keeps both sides when they changed different lines', () => {
    const mergeResult = mergePapelizVaultNoteText(baseNoteText, '# Garden\n\nKale, curly\nBeans\nTomatoes\n', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    expect(mergeResult).toEqual({ mergeOutcome: 'clean', mergedVaultNoteText: '# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n' })
  })

  it('keeps lines added on each side at different spots', () => {
    const mergeResult = mergePapelizVaultNoteText(baseNoteText, '# Garden\n\nKale\nBeans\nTomatoes\nPeppers\n', 'Spring\n# Garden\n\nKale\nBeans\nTomatoes\n')
    expect(resolvePapelizVaultNoteMerge(mergeResult)).toBe('Spring\n# Garden\n\nKale\nBeans\nTomatoes\nPeppers\n')
  })

  it('asks about a line both sides changed differently, and keeps both unless told otherwise', () => {
    const mergeResult = mergePapelizVaultNoteText(baseNoteText, '# Garden\n\nKale, curly\nBeans\nTomatoes\n', '# Garden\n\nKale, red\nBeans\nTomatoes\n')
    expect(mergeResult.mergeOutcome).toBe('conflict')
    if (mergeResult.mergeOutcome !== 'conflict') return
    expect(mergeResult.mergeConflicts).toEqual([{ mergeConflictId: 'conflict-1', baseText: 'Kale', savedText: 'Kale, curly', myText: 'Kale, red' }])
    expect(resolvePapelizVaultNoteMerge(mergeResult)).toBe('# Garden\n\nKale, curly\nKale, red\nBeans\nTomatoes\n')
    expect(resolvePapelizVaultNoteMerge(mergeResult, { 'conflict-1': 'mine' })).toBe('# Garden\n\nKale, red\nBeans\nTomatoes\n')
    expect(resolvePapelizVaultNoteMerge(mergeResult, { 'conflict-1': 'saved' })).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes\n')
  })

  it('keeps Windows line endings and a missing final newline', () => {
    const mergeResult = mergePapelizVaultNoteText('a\r\nb\r\nc', 'a\r\nB\r\nc', 'a\r\nb\r\nC')
    expect(resolvePapelizVaultNoteMerge(mergeResult)).toBe('a\r\nB\r\nC')
  })

  // Measured at about 40 to 80 ms for 50,000 lines; the limits leave room for a slow machine.
  it('stays quick on a 50,000-line note, and asks rather than guesses when both sides rewrote it', () => {
    const buildBigNoteText = (describeChangedLine: (lineIndex: number) => string | null) =>
      Array.from({ length: 50_000 }, (_, lineIndex) => describeChangedLine(lineIndex) ?? `Line ${lineIndex} of a long note, with a few words on it.`).join('\n') + '\n'
    const bigBaseNoteText = buildBigNoteText(() => null)

    let mergeStartedAt = performance.now()
    const fewEditsMergeResult = mergePapelizVaultNoteText(
      bigBaseNoteText,
      buildBigNoteText((lineIndex) => (lineIndex === 5 ? 'Changed at the top' : null)),
      buildBigNoteText((lineIndex) => (lineIndex === 49_990 ? 'Changed at the end' : null)),
    )
    expect(performance.now() - mergeStartedAt).toBeLessThan(1000)
    expect(fewEditsMergeResult.mergeOutcome).toBe('clean')
    if (fewEditsMergeResult.mergeOutcome === 'clean') {
      expect(fewEditsMergeResult.mergedVaultNoteText).toContain('Changed at the top')
      expect(fewEditsMergeResult.mergedVaultNoteText).toContain('Changed at the end')
    }

    mergeStartedAt = performance.now()
    const rewrittenMergeResult = mergePapelizVaultNoteText(
      bigBaseNoteText,
      buildBigNoteText((lineIndex) => `Saved rewrite of line ${lineIndex}`),
      buildBigNoteText((lineIndex) => `My rewrite of line ${lineIndex}`),
    )
    expect(performance.now() - mergeStartedAt).toBeLessThan(2000)
    expect(rewrittenMergeResult.mergeOutcome).toBe('conflict')
    expect(resolvePapelizVaultNoteMerge(rewrittenMergeResult)).toContain('My rewrite of line 49999')
  })
})
