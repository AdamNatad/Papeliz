import { describe, expect, it, vi } from 'vitest'
import { describePapelizFailureCode, papelizUnknownFailureSentence } from './papeliz-failure-code-words'
import { papelizSampleVaultNotes } from './papeliz-sample-vault-notes'
import {
  papelizVaultFolderImportMostFileByteCount,
  papelizVaultFolderImportMostFileCount,
  papelizVaultFolderImportMostTotalByteCount,
  planPapelizVaultFolderImport,
  type PapelizVaultImportFile,
} from './papeliz-vault-folder-import'

// This file runs as Papeliz for Windows does; the web build's words and limits are checked in
// papeliz-vault-web-words-and-import-limits.test.ts.
vi.mock('virtual:papeliz-desktop-platform-availability', () => ({ isPapelizDesktopApp: true }))

const papelizTestOneGibibyteByteCount = 1024 * 1024 * 1024

function createSizedImportFile(importFileRelativePath: string, importFileByteCount: number): PapelizVaultImportFile {
  return { importFileRelativePath, isImportFileFolder: false, importFileByteCount, readImportFileBytes: async () => new Uint8Array() }
}

describe('the failure sentences in the desktop app', () => {
  it('says to restart Papeliz, not to reload it', () => {
    expect(papelizUnknownFailureSentence).toBe('Something went wrong. Try again, and restart Papeliz if it keeps failing.')
    expect(describePapelizFailureCode('Something New')).toBe(papelizUnknownFailureSentence)
    expect(describePapelizFailureCode('Unknown Settings File')).toBe('Papeliz doesn’t know that settings file. Restart Papeliz, then try again.')
  })

  it('points a refused folder at its read-only setting, not at Recent Vaults', () => {
    expect(describePapelizFailureCode('No Permission')).toBe('Papeliz can’t change this folder. Check it isn’t read-only, then try again.')
  })

  it('names other apps only, since the desktop app has no tabs', () => {
    expect(describePapelizFailureCode('Not In Vault')).toBe('It was moved or deleted in another app.')
    expect(describePapelizFailureCode('Not In Trash')).toBe('It’s no longer in the trash. It was restored or deleted in another app.')
  })

  it('names the per-file limit when an import is too large', () => {
    expect(describePapelizFailureCode('Import Too Large')).toBe('Papeliz imports files up to 1 GB each, and one here is bigger. Import the others without it.')
  })
})

describe('an import’s limits in the desktop app', () => {
  it('has no total limit, only 1 GB for each file, and keeps the 20,000-file limit', () => {
    expect(papelizVaultFolderImportMostTotalByteCount).toBe(Number.POSITIVE_INFINITY)
    expect(papelizVaultFolderImportMostFileByteCount).toBe(papelizTestOneGibibyteByteCount)
    expect(papelizVaultFolderImportMostFileCount).toBe(20_000)
  })

  it('brings in more than 2 GB in all when no file is over 1 GB', () => {
    const largeImportFiles = ['One.bin', 'Two.bin', 'Three.bin'].map((importFileName) => createSizedImportFile(importFileName, papelizTestOneGibibyteByteCount))
    const largeImportPlan = planPapelizVaultFolderImport('Large', largeImportFiles)
    expect(largeImportPlan.importFileCount).toBe(3)
    expect(largeImportPlan.importTotalByteCount).toBe(3 * papelizTestOneGibibyteByteCount)
  })

  it('refuses one file over 1 GB, and more than 20,000 files', () => {
    expect(() => planPapelizVaultFolderImport('Large', [createSizedImportFile('big.bin', papelizTestOneGibibyteByteCount + 1)])).toThrow('Import Too Large')
    const manyImportFiles = Array.from({ length: papelizVaultFolderImportMostFileCount + 1 }, (_unused, importFileIndex) => createSizedImportFile(`${importFileIndex}.md`, 0))
    expect(() => planPapelizVaultFolderImport('Many', manyImportFiles)).toThrow('Too Many Files')
  })
})

describe('the sample vault’s notes in the desktop app', () => {
  it('say the vault lives in memory and Close Vault leads to the start screen', () => {
    const sampleVaultTexts = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteText).join('\n')
    expect(sampleVaultTexts).toContain('kept in memory while Papeliz is open')
    expect(sampleVaultTexts).toContain('- This sample vault lives only in memory. Close it and it starts fresh.')
    expect(sampleVaultTexts).toContain('to go back to the start screen, then open')
    expect(sampleVaultTexts).not.toMatch(/while this tab is open|Reload the page|start page/)
  })
})
