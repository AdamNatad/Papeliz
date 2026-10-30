import { describe, expect, it } from 'vitest'
import { createPapelizHtmlExportSitePageBasePaths, getPapelizHtmlExportSiteRelativeHref, getPapelizHtmlExportSiteRootHref } from './papeliz-html-export-site-page-paths'

describe('exported site page paths', () => {
  it('are web-friendly names in the vault’s folders', () => {
    const pageBasePaths = createPapelizHtmlExportSitePageBasePaths(['Start here.md', 'Projects/Launch plan.md', 'Projects/Q3 & Q4: Budget!.md', 'Notes/Café crème.md', "Notes/What's next.md"])
    expect([...pageBasePaths.values()]).toEqual(['start-here', 'projects/launch-plan', 'projects/q3-q4-budget', 'notes/café-crème', 'notes/whats-next'])
  })

  it('number names that clash, folder by folder', () => {
    const pageBasePaths = createPapelizHtmlExportSitePageBasePaths(['Ideas/Plan.md', 'Ideas/plan .md', 'Ideas/PLAN!.md', 'ideas/Plan.md', 'Other/Plan.md'])
    expect([...pageBasePaths.values()]).toEqual(['ideas/plan', 'ideas/plan-2', 'ideas/plan-3', 'ideas-2/plan', 'other/plan'])
  })

  it('let a folder and a note share a name, and keep the site’s own names free', () => {
    const pageBasePaths = createPapelizHtmlExportSitePageBasePaths(['Projects.md', 'Projects/Launch.md', 'index.md', 'Papeliz Site/Notes.md', 'llms.md', '!!!.md'])
    expect([...pageBasePaths.values()]).toEqual(['projects', 'projects/launch', 'index-2', 'papeliz-site-2/notes', 'llms', 'note'])
  })

  it('reach the root and other pages with relative links', () => {
    expect(getPapelizHtmlExportSiteRootHref('index.html')).toBe('')
    expect(getPapelizHtmlExportSiteRootHref('projects/ideas/plan.html')).toBe('../../')
    expect(getPapelizHtmlExportSiteRelativeHref('projects/launch-plan.html', 'projects/budget.html')).toBe('budget.html')
    expect(getPapelizHtmlExportSiteRelativeHref('projects/launch-plan.html', 'guides/callouts.html')).toBe('../guides/callouts.html')
    expect(getPapelizHtmlExportSiteRelativeHref('index.html', 'notes/café-crème.md')).toBe('notes/caf%C3%A9-cr%C3%A8me.md')
    expect(getPapelizHtmlExportSiteRelativeHref('a/b/c.html', 'a/d.html')).toBe('../d.html')
  })
})
