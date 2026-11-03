import { describe, expect, it, vi } from 'vitest'
import { describePapelizExportErrorSentence } from './papeliz-export-file-save'
import { describePapelizNoteSaveFailure } from './papeliz-note-save-failure-words'

// This file runs as Papeliz for Windows does; the web build's sentences stay checked in
// papeliz-note-save-failure-words.test.ts and papeliz-export-file-save.test.ts.
vi.mock('virtual:papeliz-desktop-platform-availability', () => ({ isPapelizDesktopApp: true }))

describe('a failed save or export in the desktop app', () => {
  it('points a refused save at the folder’s read-only setting, keeping the typing safe first', () => {
    expect(describePapelizNoteSaveFailure('No Permission').noteSaveFailureAdvice).toBe(
      'Papeliz may no longer write to this folder. Copy your changes somewhere safe, check the folder isn’t read-only, then press Try Again.',
    )
  })

  it('says Windows refused the export, and to pick another folder', () => {
    expect(describePapelizExportErrorSentence(new DOMException('The request is not allowed.', 'NotAllowedError'))).toBe(
      'Windows didn’t let Papeliz save there. Pick another folder, then try again.',
    )
  })

  it('tells a save that keeps failing to copy the changes, as on the web', () => {
    expect(describePapelizNoteSaveFailure(null).noteSaveFailureAdvice).toBe('Press Try Again. If it keeps failing, copy your changes somewhere safe.')
  })
})
