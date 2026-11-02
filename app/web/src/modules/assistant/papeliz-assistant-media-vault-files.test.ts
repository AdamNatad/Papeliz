import { describe, expect, it } from 'vitest'
import {
  buildPapelizMediaFileBaseName,
  buildPapelizPictureLinkMarkdown,
  buildPapelizVaultFileLinkPathFromNote,
  findPapelizNoteFrontMatterEndOffset,
  insertPapelizBlockAfterCursorLine,
  slugifyPapelizMediaFileWords,
} from './papeliz-assistant-media-vault-files'

describe('Imagine and Transcribe files in the vault', () => {
  it('names a file by its kind, time and words', () => {
    expect(slugifyPapelizMediaFileWords('A red fox, in the snow! Café')).toBe('a-red-fox-in-the-snow-cafe')
    expect(buildPapelizMediaFileBaseName('imagine', new Date(2026, 10, 3, 6, 12), 'A red fox in snow')).toBe('imagine-2026-11-03-0612-a-red-fox-in-snow')
    expect(buildPapelizMediaFileBaseName('recording', new Date(2026, 0, 9, 18, 5), '')).toBe('recording-2026-01-09-1805')
  })

  it('links a file from the note’s own folder', () => {
    expect(buildPapelizVaultFileLinkPathFromNote('Plan.md', 'Attachments/fox.png')).toBe('Attachments/fox.png')
    expect(buildPapelizVaultFileLinkPathFromNote('Projects/2026/Plan.md', 'Attachments/fox.png')).toBe('../../Attachments/fox.png')
    expect(buildPapelizVaultFileLinkPathFromNote('Attachments/About.md', 'Attachments/fox.png')).toBe('fox.png')
  })

  it('writes a picture link that any Markdown app reads', () => {
    expect(buildPapelizPictureLinkMarkdown('A red fox [in snow]', 'Attachments/fox.png')).toBe('![A red fox in snow](Attachments/fox.png)')
    expect(buildPapelizPictureLinkMarkdown('Fox', 'My Pictures/fox (1).png')).toBe('![Fox](<My Pictures/fox (1).png>)')
  })

  it('puts a block on lines of its own after the cursor’s line', () => {
    const pictureLink = '![Fox](Attachments/fox.png)'
    expect(insertPapelizBlockAfterCursorLine('Hello there\nWorld', 3, pictureLink).editedVaultNoteText).toBe(`Hello there\n\n${pictureLink}\n\nWorld`)
    expect(insertPapelizBlockAfterCursorLine('Hello\n\nWorld', 2, pictureLink).editedVaultNoteText).toBe(`Hello\n\n${pictureLink}\n\nWorld`)
    expect(insertPapelizBlockAfterCursorLine('A\n\nB', 2, pictureLink).editedVaultNoteText).toBe(`A\n\n${pictureLink}\n\nB`)
    expect(insertPapelizBlockAfterCursorLine('', 0, pictureLink).editedVaultNoteText).toBe(`${pictureLink}\n`)
    const endInsertion = insertPapelizBlockAfterCursorLine('Last line', null, pictureLink)
    expect(endInsertion.editedVaultNoteText).toBe(`Last line\n\n${pictureLink}\n`)
    expect(endInsertion.insertedAtTextOffset).toBe('Last line'.length)
    expect(endInsertion.insertedNoteText).toBe(`\n\n${pictureLink}\n`)
  })

  it('never puts a block inside the note’s front matter', () => {
    const pictureLink = '![Fox](Attachments/fox.png)'
    const noteWithFrontMatter = '---\ntags: [trip]\n---\n# Trip\n\nDay one.'
    expect(insertPapelizBlockAfterCursorLine(noteWithFrontMatter, 0, pictureLink).editedVaultNoteText).toBe(`---\ntags: [trip]\n---\n\n${pictureLink}\n\n# Trip\n\nDay one.`)
    expect(insertPapelizBlockAfterCursorLine(noteWithFrontMatter, noteWithFrontMatter.indexOf('Day'), pictureLink).editedVaultNoteText).toBe(
      `---\ntags: [trip]\n---\n# Trip\n\nDay one.\n\n${pictureLink}\n`,
    )
    expect(findPapelizNoteFrontMatterEndOffset('# No front matter\n---\n')).toBe(0)
    expect(findPapelizNoteFrontMatterEndOffset('---\nnot closed')).toBe(0)
  })
})
