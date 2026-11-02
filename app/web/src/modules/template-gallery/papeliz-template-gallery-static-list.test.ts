import { afterEach, describe, expect, it } from 'vitest'
import { readPapelizTemplateGalleryIdFromAddressSearch } from './papeliz-template-gallery-address-request'
import { papelizTemplateTagPattern } from './papeliz-template-gallery-contract'
import { isPapelizTemplateCommitSha } from './papeliz-template-gallery-network-reading'
import { isPapelizTemplatePictureUrlAllowed } from './papeliz-template-gallery-picture-hosts'
import papelizTemplateGalleryStaticListSnapshot from './papeliz-template-gallery-static-list.json'
import { papelizTemplateGalleryStaticListRows } from './papeliz-template-gallery-static-list'
import { resetPapelizTemplateGalleryStoreForTests, setPapelizTemplateGalleryStoreDependenciesForTests, usePapelizTemplateGalleryStore } from './papeliz-template-gallery-store'
import { isPapelizTemplateGalleryWorkerSwitchedOn } from './papeliz-template-gallery-worker-switch'

afterEach(() => resetPapelizTemplateGalleryStoreForTests())

describe('template gallery static list', () => {
  it('is in the Templates Worker’s snapshot shape, every Featured id one of its rows', () => {
    expect(papelizTemplateGalleryStaticListSnapshot.papelizTemplateGallerySnapshotVersion).toBe(1)
    const staticListRowIds = papelizTemplateGalleryStaticListSnapshot.templateGallerySnapshotRows.map((staticListRow) => staticListRow.papelizTemplateGalleryId)
    expect(new Set(staticListRowIds).size).toBe(staticListRowIds.length)
    expect(papelizTemplateGalleryStaticListSnapshot.featuredPapelizTemplateGalleryIds.every((featuredTemplateGalleryId) => staticListRowIds.includes(featuredTemplateGalleryId))).toBe(true)
    expect(papelizTemplateGalleryStaticListRows.map((staticListRow) => staticListRow.papelizTemplateGalleryId)).toEqual(papelizTemplateGalleryStaticListSnapshot.featuredPapelizTemplateGalleryIds)
  })

  it('pins each template to a full commit, with its files’ fingerprint, and makes up no votes, rank or listing day', () => {
    for (const staticListRow of papelizTemplateGalleryStaticListRows) {
      expect(staticListRow.papelizTemplateGalleryId).toBe(`${staticListRow.templateRepositoryOwner}/${staticListRow.templateRepositoryName}`)
      expect(isPapelizTemplateCommitSha(staticListRow.templateCommitSha), staticListRow.papelizTemplateGalleryId).toBe(true)
      expect(staticListRow.templateIncludedFileListDigest).toMatch(/^[A-Za-z0-9+/]{43}=$/)
      expect(staticListRow.templateTags.length).toBeGreaterThan(0)
      expect(staticListRow.templateTags.every((templateTag) => papelizTemplateTagPattern.test(templateTag))).toBe(true)
      expect(staticListRow.templateIncludedFileCount).toBeGreaterThan(0)
      expect(staticListRow.templateIncludedByteCount).toBeGreaterThan(0)
      expect(staticListRow.isTemplateFeatured).toBe(true)
      expect(staticListRow).toMatchObject({ templateUpVoteCount: 0, templateDownVoteCount: 0, templateTopRank: null, templateListedAt: null })
      if (staticListRow.templateThumbnailPictureUrl !== null) {
        expect(isPapelizTemplatePictureUrlAllowed(staticListRow, staticListRow.templateThumbnailPictureUrl), staticListRow.templateThumbnailPictureUrl).toBe(true)
        expect(staticListRow.templateThumbnailPictureUrl).toContain(`@${staticListRow.templateCommitSha}/`)
      }
    }
  })

  it('starts with P1-Workflow', () => {
    expect(papelizTemplateGalleryStaticListRows[0]).toMatchObject({
      papelizTemplateGalleryId: 'AdamNatad/P1-Workflow',
      templateName: 'P1-Workflow',
      templateLicenseId: 'MIT',
      templateFirstNotePath: 'README.md',
      isTemplateRunningCommands: true,
    })
  })

  it('stays off the Templates Worker in this build: opening and refreshing the gallery reaches no network', async () => {
    expect(isPapelizTemplateGalleryWorkerSwitchedOn).toBe(false)
    const requestedUrls: string[] = []
    setPapelizTemplateGalleryStoreDependenciesForTests({
      templateGalleryFetch: async (requestUrl) => {
        requestedUrls.push(requestUrl)
        return new Response('', { status: 404 })
      },
    })
    await usePapelizTemplateGalleryStore.getState().openTemplateGallery()
    await usePapelizTemplateGalleryStore.getState().refreshTemplateGallery()
    expect(usePapelizTemplateGalleryStore.getState()).toMatchObject({
      featuredTemplateGalleryRows: [...papelizTemplateGalleryStaticListRows],
      newTemplateGalleryRows: [],
      topTemplateGalleryRows: [],
      templateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
    })
    expect(requestedUrls).toEqual([])
  })
})

describe('template gallery address request', () => {
  it('reads a listed template from the website’s Open in Papeliz address, whatever its case', () => {
    expect(readPapelizTemplateGalleryIdFromAddressSearch('?papelizTemplateGalleryId=AdamNatad%2FP1-Workflow')).toBe('AdamNatad/P1-Workflow')
    expect(readPapelizTemplateGalleryIdFromAddressSearch('?papelizTemplateGalleryId=adamnatad/p1-workflow&other=1')).toBe('AdamNatad/P1-Workflow')
  })

  it('reads nothing for a template that isn’t listed, or an address without one', () => {
    expect(readPapelizTemplateGalleryIdFromAddressSearch('?papelizTemplateGalleryId=someone%2Felse')).toBeNull()
    expect(readPapelizTemplateGalleryIdFromAddressSearch('?papelizTemplateGalleryId=')).toBeNull()
    expect(readPapelizTemplateGalleryIdFromAddressSearch('')).toBeNull()
  })
})
