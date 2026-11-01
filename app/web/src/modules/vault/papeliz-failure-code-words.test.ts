import { describe, expect, it } from 'vitest'
import { PapelizImportZipError } from '../export-zip/papeliz-import-zip-file-reader'
import {
  describePapelizErrorSentence,
  describePapelizFailureCode,
  describePapelizFailureCodeMessage,
  describePapelizFailureMessage,
  isPapelizFailureCodeShaped,
  papelizUnknownFailureSentence,
} from './papeliz-failure-code-words'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'

// The web app's own code, to find every failure code it hands around.
const papelizWebAppSourceTextsByModulePath = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test-support.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function findEveryFailureCodeInTheWebApp(): Set<string> {
  const foundFailureCodes = new Set<string>()
  const addCodeShapedText = (quotedText: string) => {
    if (isPapelizFailureCodeShaped(quotedText)) foundFailureCodes.add(quotedText)
  }
  for (const [modulePath, moduleSourceText] of Object.entries(papelizWebAppSourceTextsByModulePath)) {
    for (const codeMatch of moduleSourceText.matchAll(/(?:PapelizVaultOperationError|PapelizImportZipError)\('([^']+)'\)|attachmentRefusedBecause: '([^']+)'/g)) {
      addCodeShapedText(codeMatch[1] ?? codeMatch[2] ?? '')
    }
    for (const failureCodeCallLine of moduleSourceText.split('\n').filter((sourceLine) => sourceLine.includes('describePapelizFailureCode'))) {
      for (const quotedTextMatch of failureCodeCallLine.matchAll(/'([^']+)'/g)) addCodeShapedText(quotedTextMatch[1] ?? '')
    }
    // The codes the vault and the name checks give back.
    if (/papeliz-vault-adapter\.ts$|papeliz-vault-relative-paths\.ts$|papeliz-browser-vaults\.ts$/.test(modulePath)) {
      for (const returnedCodeMatch of moduleSourceText.matchAll(/return '([^']+)'/g)) addCodeShapedText(returnedCodeMatch[1] ?? '')
    }
  }
  return foundFailureCodes
}

describe('failure codes in plain words', () => {
  it('has a sentence for every code the web app hands around', () => {
    const foundFailureCodes = findEveryFailureCodeInTheWebApp()
    expect(foundFailureCodes.size).toBeGreaterThanOrEqual(38)
    expect(foundFailureCodes).toContain('Name Taken')
    expect(foundFailureCodes).toContain('Zip Damaged')
    expect(foundFailureCodes).toContain('Over 10 MB')
    // Built in ways the search above doesn't catch.
    for (const failureCode of [...foundFailureCodes, 'Note Locked', 'Folder Locked', 'Note Not Found']) {
      if (failureCode === 'Unknown Error') continue
      const failureSentence = describePapelizFailureCode(failureCode)
      expect(failureSentence, failureCode).not.toBe(papelizUnknownFailureSentence)
      expect(failureSentence, failureCode).toMatch(/^[A-Z“].*\.$/)
      expect(failureSentence, failureCode).not.toMatch(/[()]/)
    }
  })

  it('names the vault, note or folder whose name is taken', () => {
    expect(describePapelizFailureCode('Name Taken', { failedEntryName: 'Work', failedEntryKind: 'vault' })).toBe('A vault named “Work” already exists. Pick another name.')
    expect(describePapelizFailureCode('Name Taken', { failedEntryName: 'Plan', failedEntryKind: 'note' })).toBe('A note named “Plan” is already there. Pick another name.')
    expect(describePapelizFailureCode('Name Taken', { failedEntryName: 'Plan', failedEntryKind: 'note', failedEntryAction: 'move' })).toBe(
      'A note named “Plan” is already there. Rename one of them first.',
    )
    expect(describePapelizFailureCode('Name Taken')).toBe('That name is already taken there. Pick another name.')
  })

  it('never shows a code it has no sentence for, and keeps a sentence as it is', () => {
    expect(describePapelizFailureCode('Something New')).toBe(papelizUnknownFailureSentence)
    expect(describePapelizFailureCode('“Plan.pdf” couldn’t be written where you chose.')).toBe('“Plan.pdf” couldn’t be written where you chose.')
  })

  it('reads what the vault, the browser and a zip throw', () => {
    expect(describePapelizErrorSentence(new PapelizVaultOperationError('Into Itself'))).toBe('A folder can’t go inside itself. Pick a folder outside it.')
    expect(describePapelizErrorSentence(new DOMException('In use.', 'NoModificationAllowedError'))).toBe('Another program has this file open. Close it there, then try again.')
    expect(describePapelizErrorSentence(new PapelizImportZipError('Not A Zip'))).toBe('That file isn’t a .zip. Pick a .zip file.')
  })

  it('puts the headline before the sentence, with no code in brackets', () => {
    expect(describePapelizFailureMessage('Couldn’t move “Plan” to the trash', new DOMException('Full.', 'QuotaExceededError'))).toBe(
      'Couldn’t move “Plan” to the trash. The disk is full. Free some space, then try again.',
    )
    expect(describePapelizFailureCodeMessage('Couldn’t add “photo.heic”', 'Picture Type Not Supported')).toBe(
      'Couldn’t add “photo.heic”. Only PNG, JPEG, WebP and GIF pictures can be added.',
    )
  })
})
