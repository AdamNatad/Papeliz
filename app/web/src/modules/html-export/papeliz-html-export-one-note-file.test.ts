import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import { papelizDefaultNoteTypography } from '../workspace/papeliz-note-typography-store'
import { buildPapelizOneNoteHtmlExportFile, getPapelizHtmlExportFileNameForNote, type PapelizOneNoteHtmlExportOptions } from './papeliz-html-export-one-note-file'

const sampleVaultResolveWikilinkTarget = createPapelizWikilinkTargetResolver(papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath))

// Stands in for the browser's font files: each file's bytes are the name of the file they came from.
const readTestFontFileBytes = async (fontFileUrl: string) => new TextEncoder().encode(fontFileUrl.split('/').pop() ?? '')

function exportTestNote(vaultNoteRelativePath: string, vaultNoteText: string, exportOptionChanges: Partial<PapelizOneNoteHtmlExportOptions> = {}) {
  return buildPapelizOneNoteHtmlExportFile({
    vaultNoteRelativePath,
    vaultNoteText,
    resolveWikilinkTarget: sampleVaultResolveWikilinkTarget,
    htmlExportNoteTypography: papelizDefaultNoteTypography,
    drawHtmlExportMermaidDiagramSvg: async (_mermaidDiagramSource, htmlExportTheme) => ({ mermaidDiagramSvgText: `<svg id="test-${htmlExportTheme}"></svg>` }),
    readHtmlExportFontFileBytes: readTestFontFileBytes,
    htmlExportVaultAttachmentFileRelativePaths: ['Projects/plan.png', 'files/brief.pdf'],
    readHtmlExportVaultFileBytes: async (vaultFileRelativePath) => new TextEncoder().encode(`bytes of ${vaultFileRelativePath}`),
    ...exportOptionChanges,
  })
}

function readEmbeddedFontFileNames(htmlExportFileText: string): string[] {
  return [...htmlExportFileText.matchAll(/url\(data:font\/woff2;base64,([^)]+)\)/g)].map((fontDataUrlMatch) => atob(fontDataUrlMatch[1] ?? ''))
}

describe('a one-note HTML export', () => {
  it('is one page named after the note, with its styles inside and no script', async () => {
    const { htmlExportFileName, htmlExportFileText } = await exportTestNote('Projects/Launch plan.md', '# Launch plan\n\nSee [[Inbox]].')
    expect(htmlExportFileName).toBe('Launch plan.html')
    expect(htmlExportFileText).toMatch(/^<!doctype html><html lang="en"><head><meta charset="utf-8">/)
    expect(htmlExportFileText).toContain('<title>Launch plan</title>')
    expect(htmlExportFileText).toContain('<main class="papeliz-html-export-page"><article class="papeliz-md-view-article"><h1 id="launch-plan">Launch plan</h1>')
    expect(htmlExportFileText).not.toMatch(/<script|<link /)
    expect(htmlExportFileText).toContain('title="“Inbox” isn’t in this export"')
  })

  it('carries MD View’s look in the light theme, and the dark theme for dark screens', async () => {
    const { htmlExportFileText } = await exportTestNote('Inbox.md', 'Text.')
    expect(htmlExportFileText).toMatch(/:root \{\n {2}color-scheme: light;\n {2}--font-sans: [^\n]+;\n[\s\S]*--color-papeliz-blue: #0064d4;/)
    expect(htmlExportFileText).toMatch(/@media screen and \(prefers-color-scheme: dark\) \{\n {2}:root \{\n {4}color-scheme: dark;[\s\S]*--color-papeliz-blue: #5ea2ff;/)
    expect(htmlExportFileText).toContain('.papeliz-md-view-article h1 {')
    expect(htmlExportFileText).toContain('.papeliz-html-export-page {')
  })

  it('uses the note’s text settings and embeds their fonts', async () => {
    const sansExport = await exportTestNote('Inbox.md', 'Text and `code`.')
    expect(sansExport.htmlExportFileText).toContain('--papeliz-note-font-family: var(--font-sans);\n  --papeliz-note-font-size: 17px;\n  --papeliz-note-column-width: 720px;')
    expect(readEmbeddedFontFileNames(sansExport.htmlExportFileText)).toEqual([
      'figtree-latin-400-normal.woff2',
      'figtree-latin-ext-400-normal.woff2',
      'figtree-latin-500-normal.woff2',
      'figtree-latin-ext-500-normal.woff2',
      'figtree-latin-600-normal.woff2',
      'figtree-latin-ext-600-normal.woff2',
      'jetbrains-mono-latin-400-normal.woff2',
      'jetbrains-mono-latin-ext-400-normal.woff2',
    ])

    const serifExport = await exportTestNote('Inbox.md', 'Text only.', {
      htmlExportNoteTypography: { noteFontFamily: 'serif', noteFontSize: 20, noteColumnWidth: 'full' },
    })
    expect(serifExport.htmlExportFileText).toContain('--papeliz-note-font-family: var(--font-serif);\n  --papeliz-note-font-size: 20px;\n  --papeliz-note-column-width: 100%;')
    expect(readEmbeddedFontFileNames(serifExport.htmlExportFileText)).toEqual([])
  })

  it('carries the vault’s pictures inside the page, and leaves links to other files as text', async () => {
    const { htmlExportFileText } = await exportTestNote('Projects/Launch plan.md', '![[plan.png|200]] ![Plan](plan.png) [[brief.pdf]]')
    const pictureDataUrl = `data:image/png;base64,${btoa('bytes of Projects/plan.png')}`
    expect(htmlExportFileText).toContain(`<img src="${pictureDataUrl}" alt="plan.png" loading="lazy" width="200">`)
    expect(htmlExportFileText).toContain(`<img src="${pictureDataUrl}" alt="Plan" loading="lazy">`)
    expect(htmlExportFileText).toContain('title="“brief.pdf” isn’t in this export">brief.pdf</a>')
    const unreadableExport = await exportTestNote('Projects/Launch plan.md', '![Plan](plan.png)', {
      readHtmlExportVaultFileBytes: async () => {
        throw new Error('gone')
      },
    })
    expect(unreadableExport.htmlExportFileText).toContain('<span class="papeliz-md-view-image-placeholder">Image: Plan</span>')
  })

  it('takes the page language from the note’s lang property', async () => {
    expect((await exportTestNote('Inbox.md', '---\nlang: fil\n---\nKumusta.')).htmlExportFileText).toContain('<html lang="fil">')
    expect((await exportTestNote('Inbox.md', '---\nlang: "x onload=1"\n---\nHi.')).htmlExportFileText).toContain('<html lang="en">')
  })

  it('gives the same file for the same note', async () => {
    const firstExport = await exportTestNote('Guides/Callouts.md', '> [!tip] Tip\n> Water early.\n\n```mermaid\nflowchart LR\n  A --> B\n```')
    const secondExport = await exportTestNote('Guides/Callouts.md', '> [!tip] Tip\n> Water early.\n\n```mermaid\nflowchart LR\n  A --> B\n```')
    expect(secondExport.htmlExportFileText).toBe(firstExport.htmlExportFileText)
  })

  it('exports every sample vault note with nothing that runs', async () => {
    for (const sampleVaultNote of papelizSampleVaultNotes) {
      const { htmlExportFileText } = await exportTestNote(sampleVaultNote.vaultNoteRelativePath, sampleVaultNote.vaultNoteText)
      expect(htmlExportFileText, sampleVaultNote.vaultNoteRelativePath).not.toMatch(/<script|\son[a-z]+=|javascript:/i)
      expect(htmlExportFileText, sampleVaultNote.vaultNoteRelativePath).toContain('<article class="papeliz-md-view-article">')
    }
  })

  it('names the file with characters any computer accepts', () => {
    expect(getPapelizHtmlExportFileNameForNote('Ideas/What? A: plan*.md')).toBe('What- A- plan-.html')
    expect(getPapelizHtmlExportFileNameForNote('Ideas/Ends with dots...md')).toBe('Ends with dots.html')
    expect(getPapelizHtmlExportFileNameForNote('Ideas/..md')).toBe('Note.html')
  })
})
