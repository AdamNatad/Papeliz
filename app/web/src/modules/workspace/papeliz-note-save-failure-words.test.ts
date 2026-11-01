import { describe, expect, it } from 'vitest'
import { describePapelizNoteSaveFailure, describePapelizNoteSaveFailureMessage } from './papeliz-note-save-failure-words'

describe('a failed save in plain words', () => {
  it('says what to do when another program has the file', () => {
    expect(describePapelizNoteSaveFailure('File In Use')).toEqual({
      noteSaveFailureShortReason: 'File open elsewhere',
      noteSaveFailureAdvice: 'Another program has this file open. Close it there, then try again.',
    })
    expect(describePapelizNoteSaveFailureMessage('Garden plan', 'File In Use')).toBe(
      'Couldn’t save “Garden plan”. Another program has this file open. Close it there, then try again.',
    )
  })

  it('says to keep the typing safe where closing the vault would lose it', () => {
    expect(describePapelizNoteSaveFailure('No Permission').noteSaveFailureAdvice).toContain('Copy your changes somewhere safe')
    expect(describePapelizNoteSaveFailure('Hidden Folder').noteSaveFailureAdvice).toBe(
      'It’s in a hidden folder, which Papeliz only reads. Move it out of the hidden folder to change it.',
    )
  })

  it('never shows a bare code, even for one it does not know', () => {
    for (const noteSaveErrorCode of ['No Permission', 'File Not Found', 'Disk Full', 'Browser Storage Full', 'Unknown Error', 'Something New', null]) {
      const { noteSaveFailureShortReason, noteSaveFailureAdvice } = describePapelizNoteSaveFailure(noteSaveErrorCode)
      expect(noteSaveFailureShortReason).not.toBe(noteSaveErrorCode)
      expect(noteSaveFailureAdvice).toMatch(/\.$/)
    }
    expect(describePapelizNoteSaveFailure('Something New').noteSaveFailureAdvice).toBe('Press Try Again. If it keeps failing, copy your changes somewhere safe.')
  })
})
