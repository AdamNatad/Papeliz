import { describe, expect, it } from 'vitest'
import {
  carryVaultEntryLocksThroughMove,
  findLockingVaultEntry,
  findVaultNoteEditingLock,
  formatPapelizLockedEntriesFile,
  parsePapelizLockedEntriesFile,
  parsePapelizWholeVaultEditingLock,
  removeVaultEntryLocksInside,
} from './papeliz-vault-entry-locks'

describe('editing locks', () => {
  it('locks a note by itself or by any folder it is in, nearest first', () => {
    const lockedPaths = ['Projects', 'Projects/Garden', 'Start here.md']
    expect(findLockingVaultEntry(lockedPaths, 'Start here.md')).toBe('Start here.md')
    expect(findLockingVaultEntry(lockedPaths, 'Projects/Garden/Beds.md')).toBe('Projects/Garden')
    expect(findLockingVaultEntry(lockedPaths, 'Projects/Plan.md')).toBe('Projects')
    expect(findLockingVaultEntry(lockedPaths, 'Inbox.md')).toBeNull()
    expect(findLockingVaultEntry(lockedPaths, 'Projects-old/Plan.md')).toBeNull()
  })

  it('keeps locks through renames and moves, and drops them with the trash', () => {
    expect(carryVaultEntryLocksThroughMove(['Projects', 'Projects/Plan.md', 'Inbox.md'], 'Projects', 'Work')).toEqual(['Work', 'Work/Plan.md', 'Inbox.md'])
    expect(removeVaultEntryLocksInside(['Projects', 'Projects/Plan.md', 'Inbox.md'], 'Projects')).toEqual(['Inbox.md'])
  })

  it('writes the lock file as readable JSON and reads it back', () => {
    expect(parsePapelizLockedEntriesFile(formatPapelizLockedEntriesFile(['Projects', 'Start here.md']))).toEqual(['Projects', 'Start here.md'])
    expect(parsePapelizLockedEntriesFile(null)).toEqual([])
    expect(parsePapelizLockedEntriesFile('{"lockedEntries":["A.md",4,""]}')).toEqual(['A.md'])
    expect(parsePapelizLockedEntriesFile('nope')).toEqual([])
  })

  it('locks the whole vault beside the notes’ own locks, and gives them back unchanged', () => {
    const lockFileText = formatPapelizLockedEntriesFile(['Start here.md'], true)
    expect(parsePapelizWholeVaultEditingLock(lockFileText)).toBe(true)
    expect(parsePapelizLockedEntriesFile(lockFileText)).toEqual(['Start here.md'])
    expect(parsePapelizWholeVaultEditingLock(formatPapelizLockedEntriesFile(['Start here.md']))).toBe(false)
    expect(findVaultNoteEditingLock(true, ['Start here.md'], 'Inbox.md')).toEqual({ vaultNoteEditingLockKind: 'whole-vault' })
    expect(findVaultNoteEditingLock(false, ['Start here.md'], 'Start here.md')).toEqual({
      vaultNoteEditingLockKind: 'vault-entry',
      lockingVaultEntryRelativePath: 'Start here.md',
    })
    expect(findVaultNoteEditingLock(false, ['Start here.md'], 'Inbox.md')).toBeNull()
  })

  it('opens notes in hidden folders read-only, except Papeliz’s own saved chats', () => {
    expect(findVaultNoteEditingLock(false, [], '.trash/Inbox.md')).toEqual({ vaultNoteEditingLockKind: 'hidden-folder' })
    expect(findVaultNoteEditingLock(false, [], '.csessions/2026-10-28 Garden.md')).toBeNull()
  })
})
