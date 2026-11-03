import { describe, expect, it } from 'vitest'
import { describePapelizFailureCode, papelizUnknownFailureSentence } from './papeliz-failure-code-words'
import { papelizSampleVaultNotes } from './papeliz-sample-vault-notes'
import {
  papelizVaultFolderImportMostFileByteCount,
  papelizVaultFolderImportMostTotalByteCount,
  planPapelizVaultFolderImport,
  type PapelizVaultImportFile,
} from './papeliz-vault-folder-import'

// The web build's side of the words and limits that differ in Papeliz for Windows
// (papeliz-vault-desktop-words-and-import-limits.test.ts).

const papelizTestOneGibibyteByteCount = 1024 * 1024 * 1024

function createSizedImportFile(importFileRelativePath: string, importFileByteCount: number): PapelizVaultImportFile {
  return { importFileRelativePath, isImportFileFolder: false, importFileByteCount, readImportFileBytes: async () => new Uint8Array() }
}

describe('the failure sentences in the web app', () => {
  it('keep their browser words', () => {
    expect(papelizUnknownFailureSentence).toBe('Something went wrong. Try again, and reload Papeliz if it keeps failing.')
    expect(describePapelizFailureCode('Unknown Settings File')).toBe('Papeliz doesn’t know that settings file. Reload Papeliz, then try again.')
    expect(describePapelizFailureCode('No Permission')).toBe('Papeliz may no longer change this folder. Close the vault and open it again from Recent Vaults to allow it.')
    expect(describePapelizFailureCode('Not In Vault')).toBe('It was moved or deleted in another tab or app.')
    expect(describePapelizFailureCode('Not In Trash')).toBe('It’s no longer in the trash. It was restored or deleted in another tab or app.')
    expect(describePapelizFailureCode('Import Too Large')).toBe('Papeliz imports up to 2 GB at a time, and this is more. Import it in parts.')
  })
})

describe('an import’s limits in the web app', () => {
  it('limits the total to 2 GB, with no limit of its own for one file', () => {
    expect(papelizVaultFolderImportMostTotalByteCount).toBe(2 * papelizTestOneGibibyteByteCount)
    expect(papelizVaultFolderImportMostFileByteCount).toBe(Number.POSITIVE_INFINITY)
    expect(planPapelizVaultFolderImport('Large', [createSizedImportFile('big.bin', 1.5 * papelizTestOneGibibyteByteCount)]).importFileCount).toBe(1)
    const overTotalImportFiles = ['One.bin', 'Two.bin', 'Three.bin'].map((importFileName) => createSizedImportFile(importFileName, papelizTestOneGibibyteByteCount))
    expect(() => planPapelizVaultFolderImport('Large', overTotalImportFiles)).toThrow('Import Too Large')
  })
})

describe('the sample vault’s notes in the web app', () => {
  it('say the vault lives in this tab and Close Vault leads to the start page', () => {
    const sampleVaultTexts = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteText).join('\n')
    expect(sampleVaultTexts).toContain('kept in memory while this tab is open, so change')
    expect(sampleVaultTexts).toContain('- This sample vault lives only in this tab. Reload the page and it starts fresh.')
    expect(sampleVaultTexts).toContain('to go back to the start page, then open')
  })
})
