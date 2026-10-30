import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import {
  buildPapelizHtmlExportNoteArticle,
  type PapelizHtmlExportMermaidDiagramDrawer,
  type PapelizHtmlExportNoteArticleOptions,
} from './papeliz-html-export-note-article'

const testVaultNoteRelativePaths = ['Start here.md', 'Projects/Launch plan.md', 'Projects/Budget.md', 'Inbox.md']
// In these tests only the Projects folder is exported, as pages beside each other.
const testExportedPageHrefsByVaultNoteRelativePath = new Map([
  ['Projects/Launch plan.md', 'launch-plan.html'],
  ['Projects/Budget.md', 'budget.html'],
])

const drawTestMermaidDiagram: PapelizHtmlExportMermaidDiagramDrawer = async (mermaidDiagramSource, htmlExportTheme) =>
  mermaidDiagramSource.includes('broken')
    ? { mermaidDiagramErrorMessage: 'Parse error on line 2' }
    : { mermaidDiagramSvgText: `<svg id="diagram-${htmlExportTheme}"><text>${htmlExportTheme}</text></svg>` }

async function exportTestNoteArticle(vaultNoteText: string, articleOptionChanges: Partial<PapelizHtmlExportNoteArticleOptions> = {}) {
  const noteArticle = await buildPapelizHtmlExportNoteArticle({
    vaultNoteRelativePath: 'Projects/Launch plan.md',
    vaultNoteText,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver(testVaultNoteRelativePaths),
    getHtmlExportNotePageHref: (targetVaultNoteRelativePath) => testExportedPageHrefsByVaultNoteRelativePath.get(targetVaultNoteRelativePath) ?? null,
    drawHtmlExportMermaidDiagramSvg: drawTestMermaidDiagram,
    ...articleOptionChanges,
  })
  return { ...noteArticle, noteArticleHtml: toHtml(noteArticle.noteArticleHastElement, { allowDangerousHtml: true }) }
}

describe('an exported note’s article', () => {
  it('is MD View’s article', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('Hello **there**.')
    expect(noteArticleHtml).toBe('<article class="papeliz-md-view-article"><p>Hello <strong>there</strong>.</p></article>')
  })

  it('links wikilinks to the pages of exported notes', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('See [[Budget]] and [[Budget|the money]].')
    expect(noteArticleHtml).toContain('<a class="papeliz-md-view-wikilink" data-papeliz-wikilink-target="Budget" href="budget.html">Budget</a>')
    expect(noteArticleHtml).toContain('href="budget.html">the money</a>')
  })

  it('leaves a wikilink to a note outside the export, or to no note, with no address', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('See [[Inbox]] and [[Someday]].')
    expect(noteArticleHtml).toContain('<a class="papeliz-md-view-wikilink" data-papeliz-wikilink-target="Inbox" title="“Inbox” isn’t in this export">Inbox</a>')
    expect(noteArticleHtml).toContain(
      '<a class="papeliz-md-view-wikilink papeliz-md-view-wikilink-unresolved" data-papeliz-wikilink-target="Someday" title="“Someday” isn’t a note yet">Someday</a>',
    )
  })

  it('points a link to the note itself at the top of its page', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('Back to [[Launch plan]].')
    expect(noteArticleHtml).toContain('href="#">Launch plan</a>')
  })

  it('links `.md` links to pages, keeping the part after #', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('[money](Budget.md#this-year) and [box](../Inbox.md)')
    expect(noteArticleHtml).toContain('<a href="budget.html#this-year">money</a>')
    expect(noteArticleHtml).toContain('<a title="“../Inbox.md” isn’t a note yet">box</a>')
  })

  it('opens web links in a new tab and keeps links within the page', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('[site](https://papeliz.com) [mail](mailto:hi@example.com) [up](#goals)')
    expect(noteArticleHtml).toContain('<a href="https://papeliz.com" target="_blank" rel="noopener noreferrer">site</a>')
    expect(noteArticleHtml).toContain('<a href="mailto:hi@example.com" target="_blank" rel="noopener noreferrer">mail</a>')
    expect(noteArticleHtml).toContain('<a href="#goals">up</a>')
  })

  it('gives headings ids, so links to a part of a page land', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('# Launch plan\n\n## Goals\n\n## Goals\n\n### What’s next?')
    expect(noteArticleHtml).toContain('<h1 id="launch-plan">')
    expect(noteArticleHtml).toContain('<h2 id="goals">')
    expect(noteArticleHtml).toContain('<h2 id="goals-1">')
    expect(noteArticleHtml).toContain('<h3 id="whats-next">')
  })

  it('gives callout titles MD View’s icon for their kind', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('> [!warning] Watch out\n> The frost comes early.')
    expect(noteArticleHtml).toMatch(/<div class="papeliz-md-view-callout-title" data-papeliz-callout-kind="warning"><svg [^>]*width="16"[^>]*><path d="m21\.73 18-8-14/)
    expect(noteArticleHtml).toContain('</svg><span>Watch out</span></div>')
  })

  it('shows the properties as MD View’s chips, with their icons', async () => {
    const { noteArticleHtml, noteFrontmatterProperties } = await exportTestNoteArticle('---\ntags: [garden, plan]\nstatus: draft\n---\nBody.')
    expect(noteFrontmatterProperties.map((noteFrontmatterProperty) => noteFrontmatterProperty.frontmatterPropertyName)).toEqual(['tags', 'status'])
    expect(noteArticleHtml).toMatch(/^<article class="papeliz-md-view-article"><ul class="papeliz-md-view-properties" aria-label="Note properties">/)
    expect(noteArticleHtml).toMatch(/<li class="papeliz-md-view-property"><svg [^>]*width="14"[^>]*><line x1="4" x2="20" y1="9" y2="9"><\/line>.*<\/svg><b>tags<\/b><span>garden, plan<\/span><\/li>/)
  })

  it('keeps web pictures as MD View shows them, and marks vault pictures', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('![Field](https://example.com/field.jpg) ![Plan](pictures/plan.png)')
    expect(noteArticleHtml).toContain('<img src="https://example.com/field.jpg" alt="Field" loading="lazy" referrerpolicy="no-referrer">')
    expect(noteArticleHtml).toContain('<span class="papeliz-md-view-image-placeholder">Image: Plan</span>')
  })

  it('draws mermaid blocks in both themes', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(noteArticleHtml).toBe(
      '<article class="papeliz-md-view-article"><div class="papeliz-mermaid-diagram" role="img" aria-label="Diagram">' +
        '<div class="papeliz-html-export-mermaid-light"><svg id="diagram-light"><text>light</text></svg></div>' +
        '<div class="papeliz-html-export-mermaid-dark"><svg id="diagram-dark"><text>dark</text></svg></div></div></article>',
    )
  })

  it('shows a diagram that can’t be drawn as its source and one error line', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('```mermaid\nflowchart LR\n  broken -->\n```')
    expect(noteArticleHtml).toContain('<div class="papeliz-mermaid-diagram papeliz-mermaid-diagram-has-error"><pre class="papeliz-mermaid-diagram-source">flowchart LR\n  broken --></pre>')
    expect(noteArticleHtml).toContain('<p class="papeliz-mermaid-diagram-error">This diagram can’t be drawn: Parse error on line 2</p>')
  })

  it('keeps mermaid blocks as code with no drawer, and says when the note has code', async () => {
    const { noteArticleHtml, hasCodeText } = await exportTestNoteArticle('```mermaid\nflowchart LR\n```', { drawHtmlExportMermaidDiagramSvg: null })
    expect(noteArticleHtml).toContain('<pre><code class="language-mermaid">flowchart LR\n</code></pre>')
    expect(hasCodeText).toBe(true)
    expect((await exportTestNoteArticle('No code here.')).hasCodeText).toBe(false)
  })

  it('never carries script from a note', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle(
      [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(2)">',
        '[click](javascript:alert(3))',
        '<a href="https://example.com" onclick="alert(4)">a</a>',
        '<iframe src="https://example.com"></iframe>',
        '```mermaid\nflowchart LR\n```',
      ].join('\n\n'),
      { drawHtmlExportMermaidDiagramSvg: null },
    )
    expect(noteArticleHtml).not.toMatch(/<script|<iframe|onerror|onclick|javascript:/i)
  })

  it('says when a note is empty', async () => {
    const { noteArticleHtml } = await exportTestNoteArticle('  \n')
    expect(noteArticleHtml).toBe('<article class="papeliz-md-view-article"><p class="papeliz-md-view-empty-note">This note is empty.</p></article>')
  })
})
