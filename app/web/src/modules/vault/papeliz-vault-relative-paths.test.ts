import { describe, expect, it } from 'vitest'
import {
  describeVaultEntryNameProblem,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultRelativePathInsideFolder,
  isVaultRelativePathWritableByPapeliz,
  pickFreeVaultEntryName,
  replaceVaultRelativePathPrefix,
} from './papeliz-vault-relative-paths'

describe('vault-relative paths', () => {
  it('reads titles and parent folders', () => {
    expect(getVaultNoteTitle('Ideas/Offline-first apps.md')).toBe('Offline-first apps')
    expect(getVaultEntryParentFolderRelativePath('Ideas/Offline-first apps.md')).toBe('Ideas')
    expect(getVaultEntryParentFolderRelativePath('Inbox.md')).toBe('')
  })

  it('moves paths from one folder to another without touching look-alike names', () => {
    expect(replaceVaultRelativePathPrefix('Guides/Callouts.md', 'Guides', 'Help')).toBe('Help/Callouts.md')
    expect(replaceVaultRelativePathPrefix('Guides', 'Guides', 'Help')).toBe('Help')
    expect(replaceVaultRelativePathPrefix('Guides 2/Callouts.md', 'Guides', 'Help')).toBe('Guides 2/Callouts.md')
    expect(isVaultRelativePathInsideFolder('Guides 2/Callouts.md', 'Guides')).toBe(false)
  })

  it('never lets Papeliz write inside hidden folders such as .other-app', () => {
    expect(isVaultRelativePathWritableByPapeliz('.other-app/workspace.json')).toBe(false)
    expect(isVaultRelativePathWritableByPapeliz('Notes/.git/config')).toBe(false)
    expect(isVaultRelativePathWritableByPapeliz('Notes/Inbox.md')).toBe(true)
  })

  it('explains names that a folder on disk would refuse', () => {
    expect(describeVaultEntryNameProblem('Plan: week 1')).not.toBeNull()
    expect(describeVaultEntryNameProblem('.hidden')).not.toBeNull()
    expect(describeVaultEntryNameProblem('   ')).not.toBeNull()
    expect(describeVaultEntryNameProblem('Week 1 plan')).toBeNull()
  })

  it('picks the next free "Untitled" name', () => {
    const takenNames = new Set(['untitled.md', 'untitled 2.md'])
    expect(pickFreeVaultEntryName('Untitled', '.md', (candidateName) => takenNames.has(candidateName.toLowerCase()))).toBe('Untitled 3.md')
  })
})
