import { describe, expect, it } from 'vitest'
import {
  createPapelizSiteTemplateGitHubHref,
  createPapelizSiteTemplateOpenInPapelizHref,
  createPapelizSiteTemplatePagePath,
  formatPapelizSiteTemplateTagDisplayName,
  isPapelizSiteTemplateNew,
  orderPapelizSiteTemplatesForList,
  readPapelizSiteTemplateCategoryNames,
  describePapelizSiteTemplateLicenseName,
  listPapelizSiteTemplateCategoryTags,
  readPapelizSiteTemplatesSnapshot,
} from './papeliz-site-templates'

const papelizSiteTestTemplateRow = {
  papelizTemplateGalleryId: 'test-owner/Test-Notes',
  templateRepositoryOwner: 'test-owner',
  templateRepositoryName: 'Test-Notes',
  templateCommitSha: 'a'.repeat(40),
  templateIncludedFileListDigest: 'digest',
  templateName: 'Test Notes',
  templateDescription: 'A vault for tests.',
  templateTags: ['education', 'lesson-plans', 'ai-tools'],
  templateFirstNotePath: 'README.md',
  templateLicenseId: 'MIT',
  templateThumbnailPictureUrl: null,
  templateIncludedFileCount: 3,
  templateIncludedByteCount: 2048,
  isTemplateRunningCommands: false,
  isTemplateFeatured: false,
  templateListedAt: 1_000_000,
  templateCheckedAt: 1_000_000,
  templateUpVoteCount: 1,
  templateDownVoteCount: 0,
  templateTopRank: null,
}

function createPapelizSiteTestSnapshot(templateGallerySnapshotRows: unknown[], featuredPapelizTemplateGalleryIds: string[] = []) {
  return {
    papelizTemplateGallerySnapshotVersion: 1,
    templateGallerySnapshotBuiltAt: 2_000_000,
    featuredPapelizTemplateGalleryIds,
    newPapelizTemplateGalleryIds: [],
    topPapelizTemplateGalleryIds: [],
    templateGallerySnapshotRows,
  }
}

describe('the website Templates list', () => {
  it('reads a snapshot the Worker sends', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(createPapelizSiteTestSnapshot([papelizSiteTestTemplateRow]))
    expect(papelizSiteTemplatesSnapshot?.templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)).toEqual(['test-owner/Test-Notes'])
    expect(papelizSiteTemplatesSnapshot?.templateGallerySnapshotBuiltAt).toBe(2_000_000)
  })

  it('refuses anything that is not a snapshot', () => {
    expect(readPapelizSiteTemplatesSnapshot(null)).toBeNull()
    expect(readPapelizSiteTemplatesSnapshot('<!DOCTYPE html>')).toBeNull()
    expect(readPapelizSiteTemplatesSnapshot({ ...createPapelizSiteTestSnapshot([]), papelizTemplateGallerySnapshotVersion: 2 })).toBeNull()
  })

  it('leaves out rows of the wrong shape and a repository listed twice', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(
      createPapelizSiteTestSnapshot([
        papelizSiteTestTemplateRow,
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'TEST-OWNER/test-notes', templateRepositoryOwner: 'TEST-OWNER', templateRepositoryName: 'test-notes' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'test-owner/..', templateRepositoryName: '..' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'bad--owner/Notes', templateRepositoryOwner: 'bad--owner', templateRepositoryName: 'Notes' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Notes', templateRepositoryOwner: 'other', templateRepositoryName: 'Notes', templateTags: ['cooking', 'a', 'b', 'c'] },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Sha', templateRepositoryOwner: 'other', templateRepositoryName: 'Sha', templateCommitSha: 'main' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Name', templateRepositoryOwner: 'other', templateRepositoryName: 'Name', templateLicenseId: 'not a license id' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'someone/else', templateRepositoryOwner: 'other', templateRepositoryName: 'else' },
      ]),
    )
    expect(papelizSiteTemplatesSnapshot?.templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)).toEqual(['test-owner/Test-Notes'])
  })

  it('keeps a template whose Category is its author’s own, and gives that Category a chip after the first three', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(
      createPapelizSiteTestSnapshot([
        papelizSiteTestTemplateRow,
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Garden', templateRepositoryOwner: 'other', templateRepositoryName: 'Garden', templateTags: ['gardening', 'seed-saving'] },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Bakes', templateRepositoryOwner: 'other', templateRepositoryName: 'Bakes', templateTags: ['baking'] },
      ]),
    )
    expect(papelizSiteTemplatesSnapshot?.templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)).toContain('other/Garden')
    expect(listPapelizSiteTemplateCategoryTags(papelizSiteTemplatesSnapshot?.templateGallerySnapshotRows ?? [])).toEqual(['coding', 'education', 'research', 'baking', 'gardening'])
  })

  it('keeps a template under any license and names it, an author’s own as Custom License', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(
      createPapelizSiteTestSnapshot([
        { ...papelizSiteTestTemplateRow, templateLicenseId: 'GPL-3.0' },
        { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Own', templateRepositoryOwner: 'other', templateRepositoryName: 'Own', templateLicenseId: 'LicenseRef-Custom' },
      ]),
    )
    expect(papelizSiteTemplatesSnapshot?.templateGallerySnapshotRows.map((snapshotRow) => describePapelizSiteTemplateLicenseName(snapshotRow.templateLicenseId))).toEqual([
      'GNU GPL 3.0',
      'Custom License',
    ])
  })

  it('lists Featured first, in their order, then the rest newest first', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(
      createPapelizSiteTestSnapshot(
        [
          papelizSiteTestTemplateRow,
          { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/First', templateRepositoryOwner: 'other', templateRepositoryName: 'First' },
          { ...papelizSiteTestTemplateRow, papelizTemplateGalleryId: 'other/Picked', templateRepositoryOwner: 'other', templateRepositoryName: 'Picked' },
        ],
        ['other/Picked', 'not/listed'],
      ),
    )
    expect(papelizSiteTemplatesSnapshot?.featuredPapelizTemplateGalleryIds).toEqual(['other/Picked'])
    expect(orderPapelizSiteTemplatesForList(papelizSiteTemplatesSnapshot!).map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)).toEqual([
      'other/Picked',
      'test-owner/Test-Notes',
      'other/First',
    ])
  })

  it('names the Category and subcategory from the first two tags, every word capitalized', () => {
    const papelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(createPapelizSiteTestSnapshot([papelizSiteTestTemplateRow]))
    expect(readPapelizSiteTemplateCategoryNames(papelizSiteTemplatesSnapshot!.templateGallerySnapshotRows[0]!)).toEqual({
      templateCategoryTag: 'education',
      templateCategoryDisplayName: 'Education',
      templateSubcategoryDisplayName: 'Lesson Plans',
      templateExtraTagDisplayNames: ['AI Tools'],
    })
    expect(formatPapelizSiteTemplateTagDisplayName('project-workflow')).toBe('Project Workflow')
    expect(formatPapelizSiteTemplateTagDisplayName('ai-agents')).toBe('AI Agents')
    expect(formatPapelizSiteTemplateTagDisplayName('rest-api-notes')).toBe('Rest API Notes')
  })

  it('marks a template New for 14 days from its listing, counted from the snapshot', () => {
    const papelizSiteTemplateRow = readPapelizSiteTemplatesSnapshot(createPapelizSiteTestSnapshot([papelizSiteTestTemplateRow]))!.templateGallerySnapshotRows[0]!
    const papelizSiteTestDayMilliseconds = 24 * 60 * 60 * 1000
    expect(isPapelizSiteTemplateNew(papelizSiteTemplateRow, 1_000_000 + 13 * papelizSiteTestDayMilliseconds)).toBe(true)
    expect(isPapelizSiteTemplateNew(papelizSiteTemplateRow, 1_000_000 + 14 * papelizSiteTestDayMilliseconds)).toBe(false)
    expect(isPapelizSiteTemplateNew(papelizSiteTemplateRow, null)).toBe(false)
  })

  it('links to its page, to Papeliz with only its public ID, and to GitHub at its commit', () => {
    const papelizSiteTemplateRow = readPapelizSiteTemplatesSnapshot(createPapelizSiteTestSnapshot([papelizSiteTestTemplateRow]))!.templateGallerySnapshotRows[0]!
    expect(createPapelizSiteTemplatePagePath(papelizSiteTemplateRow)).toBe('/templates/test-owner/Test-Notes/')
    expect(createPapelizSiteTemplateOpenInPapelizHref(papelizSiteTemplateRow)).toBe('/app/?papelizTemplateGalleryId=test-owner%2FTest-Notes')
    expect(createPapelizSiteTemplateGitHubHref(papelizSiteTemplateRow)).toBe(`https://github.com/test-owner/Test-Notes/tree/${'a'.repeat(40)}`)
    expect(createPapelizSiteTemplateGitHubHref({ ...papelizSiteTemplateRow, templateCommitSha: null })).toBe('https://github.com/test-owner/Test-Notes')
  })
})
