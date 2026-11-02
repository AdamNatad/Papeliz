import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPapelizSiteTemplatesWorkerSwitchedOn } from './papeliz-site-config'
import { createPapelizSiteTemplateShortNameRedirects, papelizSiteTemplateGalleryIdByShortName } from './papeliz-site-template-short-names'
import { createPapelizSiteTemplateOpenInPapelizHref, createPapelizSiteTemplatePagePath } from './papeliz-site-templates'
import { parsePapelizSiteTemplatesStaticList, readPapelizSiteTemplatesBuildSnapshotOnce, readPapelizSiteTemplatesStaticList } from './papeliz-site-templates-build-snapshot'

afterEach(() => vi.restoreAllMocks())

describe('Templates build list', () => {
  it('reads the app’s static list: P1-Workflow, pinned to the commit Papeliz checked', () => {
    const papelizSiteTemplatesStaticList = readPapelizSiteTemplatesStaticList()
    expect(papelizSiteTemplatesStaticList.featuredPapelizTemplateGalleryIds[0]).toBe('AdamNatad/P1-Workflow')
    expect(papelizSiteTemplatesStaticList.templateGallerySnapshotRows[0]).toMatchObject({
      papelizTemplateGalleryId: 'AdamNatad/P1-Workflow',
      templateCommitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      templateLicenseId: 'MIT',
      templateIncludedFileCount: expect.any(Number),
      isTemplateFeatured: true,
    })
  })

  it('asks no Templates Worker while it is switched off, and builds from the static list', async () => {
    expect(isPapelizSiteTemplatesWorkerSwitchedOn).toBe(false)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshotOnce()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(papelizSiteTemplatesBuildSnapshot).toEqual(readPapelizSiteTemplatesStaticList())
  })

  it('gives P1-Workflow its page, its short address and Open in Papeliz', () => {
    const [p1WorkflowRow] = readPapelizSiteTemplatesStaticList().templateGallerySnapshotRows
    expect(createPapelizSiteTemplatePagePath(p1WorkflowRow!)).toBe('/templates/AdamNatad/P1-Workflow/')
    expect(createPapelizSiteTemplateOpenInPapelizHref(p1WorkflowRow!)).toBe('/app/?papelizTemplateGalleryId=AdamNatad%2FP1-Workflow')
    const { templateShortNameRedirectLines, templateShortNamesWithoutPage } = createPapelizSiteTemplateShortNameRedirects(
      papelizSiteTemplateGalleryIdByShortName,
      readPapelizSiteTemplatesStaticList().templateGallerySnapshotRows,
    )
    expect(templateShortNamesWithoutPage).toEqual([])
    expect(templateShortNameRedirectLines).toContain('/templates/p1-workflow/ /templates/AdamNatad/P1-Workflow/ 301')
  })

  it('stops the build when the static list isn’t a list of templates', () => {
    expect(() =>
      parsePapelizSiteTemplatesStaticList(JSON.stringify({ papelizTemplateGallerySnapshotVersion: 1, featuredPapelizTemplateGalleryIds: [], templateGallerySnapshotRows: [] })),
    ).toThrow("isn't a list of templates")
    expect(() => parsePapelizSiteTemplatesStaticList(JSON.stringify({ templateGallerySnapshotRows: [] }))).toThrow("isn't a list of templates")
  })
})
