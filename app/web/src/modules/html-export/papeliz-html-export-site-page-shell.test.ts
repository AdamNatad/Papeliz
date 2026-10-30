import { describe, expect, it } from 'vitest'
import papelizSitePageLayoutText from '../../../../html-export-astro-site/src/layouts/PapelizSitePage.astro?raw'
import papelizSitePageShellPageText from '../../../../html-export-astro-site/papeliz-page-shell/pages/index.astro?raw'
import { papelizHtmlExportSitePageShellHtml, papelizHtmlExportSitePageShellSourceHash } from './papeliz-html-export-site-page-shell.generated'
import { fillPapelizHtmlExportSitePageShell, papelizHtmlExportSitePageShellMarkers, type PapelizHtmlExportSitePageValues } from './papeliz-html-export-site-page-shell'

const testSitePageValues: PapelizHtmlExportSitePageValues = {
  pageLanguage: 'en',
  pageTitle: 'Launch plan · <Team> "Notes" & more',
  siteName: '<Team> "Notes" & more',
  siteRootHref: '../',
  sitePagePath: 'projects/launch-plan.html',
  markdownTwinHref: 'launch-plan.md',
  pageArticleHtml: '<article class="papeliz-md-view-article"><p>papeliz-site-name-marker stays as text.</p></article>',
}

describe('the website’s page shell', () => {
  it('was made from the Astro layout as it is now', async () => {
    // The same text the page-shell script hashes (app/html-export-astro-site/scripts/).
    const pageShellSourceText = [
      ['src/layouts/PapelizSitePage.astro', papelizSitePageLayoutText],
      ['papeliz-page-shell/pages/index.astro', papelizSitePageShellPageText],
    ]
      .map(([sourceRelativePath, sourceText]) => `${sourceRelativePath}\n${(sourceText ?? '').replace(/\r\n/g, '\n')}`)
      .join('\n')
    const pageShellSourceHashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pageShellSourceText)))
    const pageShellSourceHash = [...pageShellSourceHashBytes].map((hashByte) => hashByte.toString(16).padStart(2, '0')).join('')
    expect(pageShellSourceHash, 'The Astro layout changed: run `pnpm --filter @papeliz/html-export-astro-site page-shell`.').toBe(papelizHtmlExportSitePageShellSourceHash)
  })

  it('holds every marker Papeliz fills', () => {
    for (const pageShellMarker of Object.values(papelizHtmlExportSitePageShellMarkers)) expect(papelizHtmlExportSitePageShellHtml).toContain(pageShellMarker)
  })

  it('is filled with escaped text, relative paths and the note as it is', () => {
    const sitePageHtml = fillPapelizHtmlExportSitePageShell(testSitePageValues)
    expect(sitePageHtml).toMatch(/^<!DOCTYPE html><html lang="en" data-papeliz-site-root-href="\.\.\/" data-papeliz-site-page-path="projects\/launch-plan\.html">/)
    expect(sitePageHtml).toContain('<title>Launch plan · &lt;Team&gt; &quot;Notes&quot; &amp; more</title>')
    expect(sitePageHtml).toContain('<a class="papeliz-site-name" href="../index.html">&lt;Team&gt; &quot;Notes&quot; &amp; more</a>')
    expect(sitePageHtml).toContain('<link rel="stylesheet" href="../papeliz-site/papeliz-md-view.css">')
    expect(sitePageHtml).toContain('<link rel="alternate" type="text/markdown" href="launch-plan.md">')
    expect(sitePageHtml).toContain('<script src="../papeliz-site/papeliz-site.js"></script>')
    expect(sitePageHtml).toContain('<main id="papeliz-site-main" class="papeliz-site-main"><article class="papeliz-md-view-article"><p>papeliz-site-name-marker stays as text.</p></article></main>')
    expect(sitePageHtml.replace(testSitePageValues.pageArticleHtml, '')).not.toMatch(/papeliz-site-[a-z-]*-marker/)
  })

  it('reaches the site’s files from the root with no "../", writing the empty attribute as Astro does', () => {
    const homePageHtml = fillPapelizHtmlExportSitePageShell({ ...testSitePageValues, siteRootHref: '', pageArticleHtml: '<p><img src="https://example.com/a.png" alt=""></p>' })
    expect(homePageHtml).toContain('href="papeliz-site/papeliz-site.css"')
    expect(homePageHtml).toContain('href="index.html">All notes</a>')
    expect(homePageHtml).toContain('<html lang="en" data-papeliz-site-root-href data-papeliz-site-page-path="projects/launch-plan.html">')
    expect(homePageHtml).toContain('<img src="https://example.com/a.png" alt="">')
  })

  it('escapes text and attribute values as Astro does', () => {
    const sitePageHtml = fillPapelizHtmlExportSitePageShell({ ...testSitePageValues, pageTitle: "Adam's <notes>", sitePagePath: "notes/adam's-<notes>.html" })
    expect(sitePageHtml).toContain('<title>Adam&#39;s &lt;notes&gt;</title>')
    expect(sitePageHtml).toContain('data-papeliz-site-page-path="notes/adam\'s-<notes>.html"')
  })
})
