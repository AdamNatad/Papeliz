import { describe, expect, it } from 'vitest'
import { createPapelizSiteTemplateShortNameRedirects, papelizSiteTemplateGalleryIdByShortName } from './papeliz-site-template-short-names'

const papelizSiteTestP1WorkflowRow = {
  papelizTemplateGalleryId: 'AdamNatad/P1-Workflow',
  templateRepositoryOwner: 'AdamNatad',
  templateRepositoryName: 'P1-Workflow',
}

describe('the Featured templates short addresses', () => {
  it('sends p1-workflow, with and without the trailing slash, to P1-Workflow with a permanent redirect', () => {
    expect(createPapelizSiteTemplateShortNameRedirects(papelizSiteTemplateGalleryIdByShortName, [papelizSiteTestP1WorkflowRow])).toEqual({
      templateShortNameRedirectLines: ['/templates/p1-workflow /templates/AdamNatad/P1-Workflow/ 301', '/templates/p1-workflow/ /templates/AdamNatad/P1-Workflow/ 301'],
      templateShortNamesWithoutPage: [],
    })
  })

  it('leaves out a short name whose template is not on the list, since it has no page', () => {
    expect(createPapelizSiteTemplateShortNameRedirects(papelizSiteTemplateGalleryIdByShortName, [])).toEqual({
      templateShortNameRedirectLines: [],
      templateShortNamesWithoutPage: ['p1-workflow'],
    })
  })

  it('refuses a short name that is also an owner on the list, whatever its case', () => {
    const papelizSiteTestOwnerRow = { papelizTemplateGalleryId: 'Test-Owner/Test-Notes', templateRepositoryOwner: 'Test-Owner', templateRepositoryName: 'Test-Notes' }
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'test-owner': 'Test-Owner/Test-Notes' }, [papelizSiteTestOwnerRow])).toThrow(/also an owner/)
  })

  it('refuses a short name that is not lowercase words joined by hyphens, or a target that is not owner/repository', () => {
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'Test Notes': 'test-owner/Test-Notes' }, [])).toThrow(/lowercase words/)
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'test-notes': 'Test-Notes' }, [])).toThrow(/not <owner>\/<repository>/)
  })
})
