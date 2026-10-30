import { describe, expect, it } from 'vitest'
import { papelizSampleVaultDisplayName, papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import { papelizDefaultNoteTypography } from '../workspace/papeliz-note-typography-store'
import { buildPapelizHtmlExportSiteFiles, buildPapelizHtmlExportSiteZipFile, type PapelizHtmlExportSiteOptions } from './papeliz-html-export-site'

const sampleVaultNoteRelativePaths = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath)

function createTestSiteOptions(siteOptionChanges: Partial<PapelizHtmlExportSiteOptions> = {}): PapelizHtmlExportSiteOptions {
  return {
    htmlExportSiteName: papelizSampleVaultDisplayName,
    htmlExportSiteNotes: papelizSampleVaultNotes,
    htmlExportVaultNoteRelativePaths: sampleVaultNoteRelativePaths,
    htmlExportNoteTypography: papelizDefaultNoteTypography,
    drawHtmlExportMermaidDiagramSvg: async (_mermaidDiagramSource, htmlExportTheme) => ({ mermaidDiagramSvgText: `<svg id="test-${htmlExportTheme}"><text>Diagram</text></svg>` }),
    readHtmlExportFontFileBytes: async (fontFileUrl) => new TextEncoder().encode(fontFileUrl.split('/').pop() ?? ''),
    htmlExportVaultAttachmentFileRelativePaths: [],
    readHtmlExportVaultFileBytes: async (vaultFileRelativePath) => new TextEncoder().encode(`bytes of ${vaultFileRelativePath}`),
    ...siteOptionChanges,
  }
}

async function buildTestSiteTextFiles(siteOptionChanges: Partial<PapelizHtmlExportSiteOptions> = {}): Promise<Map<string, string>> {
  const siteZipEntries = await buildPapelizHtmlExportSiteFiles(createTestSiteOptions(siteOptionChanges))
  return new Map(siteZipEntries.map((siteZipEntry) => [siteZipEntry.zipEntryPath, new TextDecoder().decode(siteZipEntry.zipEntryBytes)]))
}

function readSiteScriptData(siteScriptText: string | undefined): unknown {
  return JSON.parse((siteScriptText ?? '').replace(/^\/\/[^\n]*\nwindow\.\w+ = /, '').replace(/;\n$/, ''))
}

describe('an exported website', () => {
  it('has a page and a Markdown twin per note, a home page, llms.txt and its own files', async () => {
    const siteTextFiles = await buildTestSiteTextFiles()
    expect([...siteTextFiles.keys()].filter((siteFilePath) => !siteFilePath.startsWith('astro-project/')).sort()).toEqual([
      'guides/callouts.html',
      'guides/callouts.md',
      'guides/links-between-notes.html',
      'guides/links-between-notes.md',
      'guides/writing-in-md-code.html',
      'guides/writing-in-md-code.md',
      'guides/writing-in-md-view.html',
      'guides/writing-in-md-view.md',
      'guides/your-files-stay-yours.html',
      'guides/your-files-stay-yours.md',
      'projects/garden-plan.html',
      'projects/garden-plan.md',
      'projects/reading-list.html',
      'projects/reading-list.md',
      'inbox.html',
      'inbox.md',
      'start-here.html',
      'start-here.md',
      'index.html',
      'index.md',
      'llms.txt',
      'papeliz-site/papeliz-site-navigation.js',
      'papeliz-site/papeliz-site-search-index.js',
      'papeliz-site/papeliz-md-view.css',
      'papeliz-site/papeliz-site.css',
      'papeliz-site/papeliz-site.js',
      'papeliz-site/papeliz-site-theme-boot.js',
      'papeliz-site/fonts/figtree-latin-400.woff2',
      'papeliz-site/fonts/figtree-latin-ext-400.woff2',
      'papeliz-site/fonts/figtree-latin-500.woff2',
      'papeliz-site/fonts/figtree-latin-ext-500.woff2',
      'papeliz-site/fonts/figtree-latin-600.woff2',
      'papeliz-site/fonts/figtree-latin-ext-600.woff2',
      'papeliz-site/fonts/jetbrains-mono-latin-400.woff2',
      'papeliz-site/fonts/jetbrains-mono-latin-ext-400.woff2',
    ].sort())
  })

  it('links each page to the others, its twin and the site’s files with relative paths', async () => {
    const linksPageHtml = (await buildTestSiteTextFiles()).get('guides/links-between-notes.html') ?? ''
    expect(linksPageHtml).toContain('<title>Links between notes · Sample vault</title>')
    expect(linksPageHtml).toContain('data-papeliz-site-root-href="../" data-papeliz-site-page-path="guides/links-between-notes.html"')
    expect(linksPageHtml).toContain('<link rel="alternate" type="text/markdown" href="links-between-notes.md">')
    expect(linksPageHtml).toContain('<link rel="stylesheet" href="../papeliz-site/papeliz-md-view.css">')
    expect(linksPageHtml).toContain('<p class="papeliz-site-page-folder">Guides</p><article class="papeliz-md-view-article">')
    expect(linksPageHtml).toContain('href="callouts.html">a label</a>')
    expect(linksPageHtml).toContain('href="../projects/garden-plan.html">Garden plan</a>')
    expect(linksPageHtml).toContain('href="../start-here.html">Start here</a>')
    expect(linksPageHtml).toContain('title="“An idea for later” isn’t a note yet">An idea for later</a>')
    expect(linksPageHtml).not.toMatch(/papeliz-site-[a-z-]*-marker|<script>/)
  })

  it('gives each page a Markdown twin with links to the other twins', async () => {
    const linksTwinText = (await buildTestSiteTextFiles()).get('guides/links-between-notes.md') ?? ''
    expect(linksTwinText).toMatch(/^---\ntags: \[guide, links\]\n---\n# Links between notes/)
    expect(linksTwinText).toContain('| `[[Callouts\\|a label]]` | [a label](callouts.md) |')
    expect(linksTwinText).toContain('Back to [Start here](../start-here.md).')
    expect(linksTwinText).toContain('looks different: An idea for later.')
  })

  it('lists every note on the home page, its twin and llms.txt, folders first', async () => {
    const siteTextFiles = await buildTestSiteTextFiles()
    const homePageHtml = siteTextFiles.get('index.html') ?? ''
    expect(homePageHtml).toContain('<h1>Sample vault</h1><p class="papeliz-site-index-count">9 notes</p><ul><li><strong>Guides</strong><ul><li><a href="guides/callouts.html">Callouts</a></li>')
    expect(homePageHtml).toContain('<li><a href="start-here.html">Start here</a></li></ul></article>')
    expect(siteTextFiles.get('index.md')).toMatch(/^# Sample vault\n\n9 notes\.\n\n- Guides\n {2}- \[Callouts\]\(guides\/callouts\.md\)\n/)
    expect(siteTextFiles.get('llms.txt')).toMatch(/^# Sample vault\n\n> 9 notes, exported from Papeliz as a website\.[^\n]*\n\n## Guides\n\n- \[Callouts\]\(guides\/callouts\.md\)\n/)
    expect(siteTextFiles.get('llms.txt')).toContain('\n## Notes\n\n- [Inbox](inbox.md)\n- [Start here](start-here.md)\n')
  })

  it('writes the folder list and the search index as script data', async () => {
    const siteTextFiles = await buildTestSiteTextFiles()
    const siteNavigation = readSiteScriptData(siteTextFiles.get('papeliz-site/papeliz-site-navigation.js')) as { siteNotePages: Array<Record<string, unknown>> }
    expect(siteNavigation.siteNotePages[0]).toEqual({ notePageTitle: 'Callouts', notePagePath: 'guides/callouts.html', noteFolderNames: ['Guides'] })
    expect(siteNavigation.siteNotePages).toHaveLength(9)
    const siteSearchIndex = readSiteScriptData(siteTextFiles.get('papeliz-site/papeliz-site-search-index.js')) as {
      siteSearchNotes: Array<{ notePageTitle: string; noteFolderPath: string; noteHeadings: string[]; noteText: string }>
    }
    const callottsSearchNote = siteSearchIndex.siteSearchNotes.find((siteSearchNote) => siteSearchNote.notePageTitle === 'Callouts')
    expect(callottsSearchNote?.noteFolderPath).toBe('Guides')
    expect(callottsSearchNote?.noteHeadings[0]).toBe('Callouts')
    expect(callottsSearchNote?.noteText).toMatch(/^tags guide, viewer Callouts A callout is a quote/)
  })

  it('carries MD View’s look with a theme switch and the fonts as files', async () => {
    const mdViewStylesheetText = (await buildTestSiteTextFiles()).get('papeliz-site/papeliz-md-view.css') ?? ''
    expect(mdViewStylesheetText).toContain("src: url(fonts/figtree-latin-400.woff2) format('woff2');")
    expect(mdViewStylesheetText).toContain(":root[data-papeliz-site-theme='dark'] {\n  color-scheme: dark;")
    expect(mdViewStylesheetText).toContain("@media (prefers-color-scheme: dark) {\n  :root:not([data-papeliz-site-theme]) {")
    expect(mdViewStylesheetText).toContain('.papeliz-md-view-article h1 {')
  })

  it('leaves links to notes outside a partial export with no address', async () => {
    const siteTextFiles = await buildTestSiteTextFiles({
      htmlExportSiteNotes: papelizSampleVaultNotes.filter((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath.startsWith('Guides/')),
    })
    expect(siteTextFiles.get('index.html')).toContain('<p class="papeliz-site-index-count">5 notes</p>')
    expect(siteTextFiles.get('guides/links-between-notes.html')).toContain('title="“Start here” isn’t in this export">Start here</a>')
    expect(siteTextFiles.get('guides/links-between-notes.md')).toContain('Back to Start here.')
  })

  it('carries the same site as an Astro project, with the notes, the core and the drawings', async () => {
    const siteTextFiles = await buildTestSiteTextFiles()
    const astroProjectFilePaths = [...siteTextFiles.keys()].filter((siteFilePath) => siteFilePath.startsWith('astro-project/')).sort()
    for (const expectedProjectFilePath of [
      'astro-project/.gitignore',
      'astro-project/README.md',
      'astro-project/astro.config.mjs',
      'astro-project/package.json',
      'astro-project/public/papeliz-site/fonts/figtree-latin-400.woff2',
      'astro-project/public/papeliz-site/papeliz-md-view.css',
      'astro-project/public/papeliz-site/papeliz-site.js',
      'astro-project/src/layouts/PapelizSitePage.astro',
      'astro-project/src/pages/[...papelizSitePagePath].astro',
      'astro-project/src/pages/[...papelizSiteTextFilePath].ts',
      'astro-project/src/pages/index.astro',
      'astro-project/src/papeliz/papeliz-html-export-core-licenses.md',
      'astro-project/src/papeliz/papeliz-html-export-core.mjs',
      'astro-project/src/papeliz/papeliz-site-content.mjs',
      'astro-project/src/papeliz/papeliz-site-settings.json',
      'astro-project/src/papeliz/papeliz-vault-diagrams.json',
      'astro-project/vault/Guides/Writing in MD View.md',
      'astro-project/vault/Start here.md',
    ]) {
      expect(astroProjectFilePaths, expectedProjectFilePath).toContain(expectedProjectFilePath)
    }
    expect(astroProjectFilePaths.filter((projectFilePath) => projectFilePath.startsWith('astro-project/vault/'))).toHaveLength(9)
    expect(astroProjectFilePaths.some((projectFilePath) => /page-shell|scripts\/|node_modules|papeliz-site-navigation|papeliz-site-search-index/.test(projectFilePath))).toBe(false)
    expect(JSON.parse(siteTextFiles.get('astro-project/package.json') ?? '')).toEqual({
      name: 'sample-vault-website',
      private: true,
      type: 'module',
      scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
      dependencies: { astro: '7.4.2' },
    })
    expect(JSON.parse(siteTextFiles.get('astro-project/src/papeliz/papeliz-site-settings.json') ?? '')).toEqual({
      htmlExportSiteName: 'Sample vault',
      papelizVaultNoteRelativePaths: sampleVaultNoteRelativePaths,
      papelizVaultAttachmentFileRelativePaths: [],
      papelizDrawsMermaidDiagrams: true,
    })
    const vaultDiagrams = JSON.parse(siteTextFiles.get('astro-project/src/papeliz/papeliz-vault-diagrams.json') ?? '') as Array<{ mermaidDiagramSource: string; mermaidDrawResultsByTheme: unknown }>
    expect(vaultDiagrams).toHaveLength(1)
    expect(vaultDiagrams[0]?.mermaidDiagramSource).toMatch(/^flowchart /)
    expect(vaultDiagrams[0]?.mermaidDrawResultsByTheme).toEqual({ light: { mermaidDiagramSvgText: '<svg id="test-light"><text>Diagram</text></svg>' }, dark: { mermaidDiagramSvgText: '<svg id="test-dark"><text>Diagram</text></svg>' } })
    expect(siteTextFiles.get('astro-project/vault/Start here.md')).toBe(papelizSampleVaultNotes.find((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath === 'Start here.md')?.vaultNoteText)
    expect(siteTextFiles.get('astro-project/public/papeliz-site/papeliz-md-view.css')).toBe(siteTextFiles.get('papeliz-site/papeliz-md-view.css'))
  })

  it('copies the pictures and files the notes use, for the site and the Astro project', async () => {
    const siteTextFiles = await buildTestSiteTextFiles({
      htmlExportSiteNotes: [
        ...papelizSampleVaultNotes,
        { vaultNoteRelativePath: 'Projects/Pictures.md', vaultNoteText: '![[bed plan.png|240]] and [the brief](../files/brief.pdf)\n' },
      ],
      htmlExportVaultAttachmentFileRelativePaths: ['Projects/pictures/bed plan.png', 'files/brief.pdf', 'files/unused.pdf'],
    })
    expect(siteTextFiles.get('attachments/Projects/pictures/bed plan.png')).toBe('bytes of Projects/pictures/bed plan.png')
    expect(siteTextFiles.get('attachments/files/brief.pdf')).toBe('bytes of files/brief.pdf')
    expect(siteTextFiles.has('attachments/files/unused.pdf')).toBe(false)
    expect(siteTextFiles.get('astro-project/public/attachments/files/brief.pdf')).toBe('bytes of files/brief.pdf')
    const picturesPageHtml = siteTextFiles.get('projects/pictures.html') ?? ''
    expect(picturesPageHtml).toContain('<img src="../attachments/Projects/pictures/bed%20plan.png" alt="bed plan.png" loading="lazy" width="240">')
    expect(picturesPageHtml).toContain('<a href="../attachments/files/brief.pdf">the brief</a>')
    expect(siteTextFiles.get('projects/pictures.md')).toBe('![bed plan.png](../attachments/Projects/pictures/bed%20plan.png) and [the brief](../attachments/files/brief.pdf)\n')
    const projectSettings = JSON.parse(siteTextFiles.get('astro-project/src/papeliz/papeliz-site-settings.json') ?? '') as Record<string, unknown>
    expect(projectSettings['papelizVaultAttachmentFileRelativePaths']).toEqual(['Projects/pictures/bed plan.png', 'files/brief.pdf', 'files/unused.pdf'])
  })

  it('comes as one .zip named after the vault', async () => {
    const { htmlExportFileName, htmlExportFileBlob } = await buildPapelizHtmlExportSiteZipFile({ ...createTestSiteOptions(), htmlExportDate: new Date(2026, 9, 30) })
    expect(htmlExportFileName).toBe('Sample vault website.zip')
    expect(htmlExportFileBlob.type).toBe('application/zip')
    expect(htmlExportFileBlob.size).toBeGreaterThan(10_000)
  })

  it('reports progress and stops when cancelled', async () => {
    const progressCounts: string[] = []
    await buildTestSiteTextFiles({ onHtmlExportProgress: (exportedNoteCount, htmlExportNoteCount) => progressCounts.push(`${exportedNoteCount}/${htmlExportNoteCount}`) })
    expect(progressCounts.at(0)).toBe('1/9')
    expect(progressCounts.at(-1)).toBe('9/9')
    const htmlExportAbortController = new AbortController()
    htmlExportAbortController.abort()
    await expect(buildTestSiteTextFiles({ htmlExportAbortSignal: htmlExportAbortController.signal })).rejects.toThrow()
  })
})
