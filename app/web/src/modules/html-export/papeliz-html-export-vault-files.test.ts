import { describe, expect, it } from 'vitest'
import { createPapelizHtmlExportVaultFileResolver, getPapelizHtmlExportPictureMediaType } from './papeliz-html-export-vault-files'

const resolveTestVaultFile = createPapelizHtmlExportVaultFileResolver([
  'Projects/pictures/plan.png',
  'pictures/plan.png',
  'Garden/Beds/beds.JPG',
  'files/brief.pdf',
  'Projects/notes.txt',
])

describe('vault files for an export', () => {
  it('finds a path beside the note first, following ./ and ../', () => {
    expect(resolveTestVaultFile('pictures/plan.png', 'Projects/Launch plan.md')).toBe('Projects/pictures/plan.png')
    expect(resolveTestVaultFile('./notes.txt', 'Projects/Launch plan.md')).toBe('Projects/notes.txt')
    expect(resolveTestVaultFile('../files/brief.pdf', 'Projects/Launch plan.md')).toBe('files/brief.pdf')
  })

  it('then a path from the vault’s root', () => {
    expect(resolveTestVaultFile('pictures/plan.png', 'Inbox.md')).toBe('pictures/plan.png')
    expect(resolveTestVaultFile('/pictures/plan.png', 'Projects/Launch plan.md')).toBe('pictures/plan.png')
  })

  it('then any file with that name, the nearest first, without case', () => {
    expect(resolveTestVaultFile('plan.png', 'Projects/Launch plan.md')).toBe('Projects/pictures/plan.png')
    expect(resolveTestVaultFile('plan.png', 'Inbox.md')).toBe('pictures/plan.png')
    expect(resolveTestVaultFile('BEDS.jpg', 'Inbox.md')).toBe('Garden/Beds/beds.JPG')
    expect(resolveTestVaultFile('Beds/beds.jpg', 'Inbox.md')).toBe('Garden/Beds/beds.JPG')
  })

  it('finds nothing for a missing file, an empty name or a path out of the vault', () => {
    expect(resolveTestVaultFile('missing.png', 'Inbox.md')).toBeNull()
    expect(resolveTestVaultFile('  ', 'Inbox.md')).toBeNull()
    expect(resolveTestVaultFile('../../pictures/missing.png', 'Projects/Launch plan.md')).toBeNull()
  })

  it('knows which files a page can show as pictures', () => {
    expect(getPapelizHtmlExportPictureMediaType('pictures/plan.PNG')).toBe('image/png')
    expect(getPapelizHtmlExportPictureMediaType('a/b.jpeg')).toBe('image/jpeg')
    expect(getPapelizHtmlExportPictureMediaType('diagram.svg')).toBe('image/svg+xml')
    expect(getPapelizHtmlExportPictureMediaType('files/brief.pdf')).toBeNull()
    expect(getPapelizHtmlExportPictureMediaType('README')).toBeNull()
  })
})
