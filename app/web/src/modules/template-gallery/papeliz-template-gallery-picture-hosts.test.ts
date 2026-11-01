import { describe, expect, it } from 'vitest'
import { gardenJournalRepositoryName, gardenJournalTemplateCommitSha } from './papeliz-template-gallery-fixtures.test-support'
import { buildPapelizTemplateAuthorPictureUrl, isPapelizTemplatePictureUrlAllowed, resolvePapelizTemplateNotePictureUrl } from './papeliz-template-gallery-picture-hosts'

const gardenJournalPictureSource = { ...gardenJournalRepositoryName, templateCommitSha: gardenJournalTemplateCommitSha }
const gardenJournalIncludedPaths = new Set(['beds.png', 'Crops/tomato.webp', 'Crops/Tomatoes.md', 'notes.txt'])
const isGardenJournalFileIncluded = (templateFileRelativePath: string) => gardenJournalIncludedPaths.has(templateFileRelativePath)

describe('template picture hosts', () => {
  it('builds the author’s GitHub picture address', () => {
    expect(buildPapelizTemplateAuthorPictureUrl('garden-notes', 32)).toBe('https://avatars.githubusercontent.com/garden-notes?s=32')
    expect(buildPapelizTemplateAuthorPictureUrl('a/b?c', 40)).toBe('https://avatars.githubusercontent.com/a%2Fb%3Fc?s=40')
  })

  it('allows jsDelivr at this commit, this repository’s raw files and GitHub’s picture hosts, and nothing else', () => {
    const allowedPictureUrls = [
      `https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}/beds.png`,
      `https://cdn.jsdelivr.net/gh/Garden-Notes/garden-journal@${gardenJournalTemplateCommitSha}/Crops/tomato.webp`,
      'https://raw.githubusercontent.com/garden-notes/Garden-Journal/main/beds.png',
      'https://github.com/garden-notes/Garden-Journal/raw/main/beds.png',
      'https://github.com/user-attachments/assets/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b',
      'https://user-images.githubusercontent.com/1234/56789-abc.png',
      'https://avatars.githubusercontent.com/garden-notes?s=40',
    ]
    for (const allowedPictureUrl of allowedPictureUrls) expect(isPapelizTemplatePictureUrlAllowed(gardenJournalPictureSource, allowedPictureUrl), allowedPictureUrl).toBe(true)
    const refusedPictureUrls = [
      'https://example.com/tracker.png',
      'http://raw.githubusercontent.com/garden-notes/Garden-Journal/main/beds.png',
      // Another repository, another commit, a branch, or a way out of the repository's path.
      'https://raw.githubusercontent.com/someone-else/Garden-Journal/main/beds.png',
      `https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${'f'.repeat(40)}/beds.png`,
      'https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@main/beds.png',
      'https://cdn.jsdelivr.net/npm/some-package/picture.png',
      'https://raw.githubusercontent.com/garden-notes/Garden-Journal/../../someone-else/x/main/a.png',
      'https://github.com/someone-else/repository/raw/main/a.png',
      'https://camo.githubusercontent.com/abc/def',
      // A look-alike host, a user name in the address, another port.
      'https://avatars.githubusercontent.com.example.com/x.png',
      'https://user@avatars.githubusercontent.com/garden-notes',
      'https://avatars.githubusercontent.com:8443/garden-notes',
      'data:image/png;base64,AAAA',
      'not an address',
    ]
    for (const refusedPictureUrl of refusedPictureUrls) expect(isPapelizTemplatePictureUrlAllowed(gardenJournalPictureSource, refusedPictureUrl), refusedPictureUrl).toBe(false)
  })

  it('shows a note’s picture from the repository at jsDelivr, a GitHub picture as it is, and nothing from anywhere else', () => {
    const resolveNotePicture = (notePictureAddress: string, templateNoteRelativePath = 'Crops/Tomatoes.md') =>
      resolvePapelizTemplateNotePictureUrl(gardenJournalPictureSource, templateNoteRelativePath, notePictureAddress, isGardenJournalFileIncluded)
    const jsdelivrAtCommit = `https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}`
    expect(resolveNotePicture('tomato.webp')).toBe(`${jsdelivrAtCommit}/Crops/tomato.webp`)
    expect(resolveNotePicture('../beds.png')).toBe(`${jsdelivrAtCommit}/beds.png`)
    expect(resolveNotePicture('/beds.png?raw=true#top')).toBe(`${jsdelivrAtCommit}/beds.png`)
    expect(resolveNotePicture('./tomato.webp', 'Crops/Tomatoes.md')).toBe(`${jsdelivrAtCommit}/Crops/tomato.webp`)
    expect(resolveNotePicture('https://github.com/user-attachments/assets/abc')).toBe('https://github.com/user-attachments/assets/abc')
    // Not included, not a picture, out of the repository, or on another host.
    expect(resolveNotePicture('missing.png')).toBeNull()
    expect(resolveNotePicture('../notes.txt')).toBeNull()
    expect(resolveNotePicture('../../beds.png')).toBeNull()
    expect(resolveNotePicture('https://example.com/beds.png')).toBeNull()
    expect(resolveNotePicture('//example.com/beds.png')).toBeNull()
    expect(resolveNotePicture('javascript:alert(1)')).toBeNull()
  })
})
