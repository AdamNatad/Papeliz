import { describe, expect, it } from 'vitest'
import { createPapelizSiteTemplateShortNameRedirects, papelizSiteTemplateGalleryIdByShortName } from './papeliz-site-template-short-names'

function createPapelizSiteTestTemplateRow(templateRepositoryOwner: string, templateRepositoryName: string) {
  return { papelizTemplateGalleryId: `${templateRepositoryOwner}/${templateRepositoryName}`, templateRepositoryOwner, templateRepositoryName }
}

const papelizSiteTestP1WorkflowRow = createPapelizSiteTestTemplateRow('AdamNatad', 'P1-Workflow')

describe('the Featured templates short addresses', () => {
  it('sends p1-workflow and P1-Workflow, with and without the trailing slash, to P1-Workflow with a permanent redirect', () => {
    expect(createPapelizSiteTemplateShortNameRedirects(papelizSiteTemplateGalleryIdByShortName, [papelizSiteTestP1WorkflowRow])).toEqual({
      templateShortNameRedirectLines: [
        '/templates/p1-workflow /templates/AdamNatad/P1-Workflow/ 301',
        '/templates/p1-workflow/ /templates/AdamNatad/P1-Workflow/ 301',
        '/templates/P1-Workflow /templates/AdamNatad/P1-Workflow/ 301',
        '/templates/P1-Workflow/ /templates/AdamNatad/P1-Workflow/ 301',
      ],
      templateShortNamesWithoutPage: [],
    })
  })

  it('writes the repository spelling only once: not when it is the short name, nor again for a second short name', () => {
    expect(
      createPapelizSiteTemplateShortNameRedirects({ 'test-notes': 'test-owner/test-notes' }, [createPapelizSiteTestTemplateRow('test-owner', 'test-notes')])
        .templateShortNameRedirectLines,
    ).toEqual(['/templates/test-notes /templates/test-owner/test-notes/ 301', '/templates/test-notes/ /templates/test-owner/test-notes/ 301'])
    expect(
      createPapelizSiteTemplateShortNameRedirects({ 'p1-workflow': 'AdamNatad/P1-Workflow', p1: 'AdamNatad/P1-Workflow' }, [papelizSiteTestP1WorkflowRow])
        .templateShortNameRedirectLines.map((redirectLine) => redirectLine.split(' ')[0]),
    ).toEqual(['/templates/p1-workflow', '/templates/p1-workflow/', '/templates/P1-Workflow', '/templates/P1-Workflow/', '/templates/p1', '/templates/p1/'])
  })

  it('leaves out a short name whose template is not on the list, since it has no page', () => {
    expect(createPapelizSiteTemplateShortNameRedirects(papelizSiteTemplateGalleryIdByShortName, [])).toEqual({
      templateShortNameRedirectLines: [],
      templateShortNamesWithoutPage: ['p1-workflow'],
    })
  })

  it('refuses a short name or a repository spelling that is also an owner on the list, whatever its case', () => {
    expect(() =>
      createPapelizSiteTemplateShortNameRedirects({ 'test-owner': 'Test-Owner/Test-Notes' }, [createPapelizSiteTestTemplateRow('Test-Owner', 'Test-Notes')]),
    ).toThrow(/also an owner/)
    expect(() =>
      createPapelizSiteTemplateShortNameRedirects({ 'test-notes': 'Test-Owner/Clash' }, [
        createPapelizSiteTestTemplateRow('Test-Owner', 'Clash'),
        createPapelizSiteTestTemplateRow('CLASH', 'Other-Notes'),
      ]),
    ).toThrow(/\/templates\/Clash\/ .* is also an owner/)
  })

  it('refuses one address that would lead to two templates', () => {
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'first-notes': 'first-owner/Notes', 'second-notes': 'second-owner/Notes' }, [])).toThrow(
      /would lead to both first-owner\/Notes and second-owner\/Notes/,
    )
  })

  it('refuses a short name that is not lowercase words joined by hyphens, or a target that is not owner/repository', () => {
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'Test Notes': 'test-owner/Test-Notes' }, [])).toThrow(/lowercase words/)
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'test-notes': 'Test-Notes' }, [])).toThrow(/not <owner>\/<repository>/)
    expect(() => createPapelizSiteTemplateShortNameRedirects({ 'test-notes': 'test-owner/..' }, [])).toThrow(/not <owner>\/<repository>/)
  })
})
