import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import { toHtml } from 'hast-util-to-html'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import type { PapelizNoteColumnWidth, PapelizNoteFontFamily, PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import {
  buildPapelizHtmlExportFontFaceCss,
  choosePapelizHtmlExportFontFaces,
  readPapelizHtmlExportFontFileDataUrl,
  type PapelizHtmlExportFontFileDataUrlReader,
} from './papeliz-html-export-fonts'
import { readPapelizHtmlExportMdViewStyles } from './papeliz-html-export-md-view-styles'
import { buildPapelizHtmlExportNoteArticle, type PapelizHtmlExportMermaidDiagramDrawer } from './papeliz-html-export-note-article'
import papelizHtmlExportOneNotePageStylesheetText from './papeliz-html-export-one-note-page.css?raw'

// Export › one note › HTML: a single `.html` file that holds everything it shows: MD View's styles
// in the light and dark themes, the fonts, and the diagrams as SVG. It has no script, so it opens
// the same from disk, from an email or from any web host.

export interface PapelizOneNoteHtmlExportOptions {
  vaultNoteRelativePath: string
  vaultNoteText: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  // The note's text settings at export time (font, size, width), as MD View shows them.
  htmlExportNoteTypography: PapelizNoteTypography
  drawHtmlExportMermaidDiagramSvg: PapelizHtmlExportMermaidDiagramDrawer | null
  readHtmlExportFontFileDataUrl?: PapelizHtmlExportFontFileDataUrlReader
}

export interface PapelizHtmlExportFile {
  htmlExportFileName: string
  htmlExportFileText: string
}

// The same values the note text settings give MD View (papeliz-note-typography-store.ts), at 100%.
const papelizHtmlExportNoteFontFamilyValues: Readonly<Record<PapelizNoteFontFamily, string>> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
}
const papelizHtmlExportNoteColumnWidthValues: Readonly<Record<PapelizNoteColumnWidth, string>> = {
  narrow: '600px',
  normal: '720px',
  wide: '900px',
  full: '100%',
}

const papelizHtmlExportLanguageTagPattern = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i
// Characters a file name can't hold on Windows, macOS or Linux.
const papelizFileNameUnsafeCharacterPattern = /[<>:"/\\|?*\p{Cc}]/gu

// "Projects/Launch plan.md" -> "Launch plan.html"
export function getPapelizHtmlExportFileNameForNote(vaultNoteRelativePath: string): string {
  const safeNoteTitle = getVaultNoteTitle(vaultNoteRelativePath).replace(papelizFileNameUnsafeCharacterPattern, '-').replace(/[. ]+$/, '').trim()
  return `${safeNoteTitle.length > 0 ? safeNoteTitle : 'Note'}.html`
}

function createHastElement(tagName: string, properties: HastElement['properties'], children: HastElementContent[]): HastElement {
  return { type: 'element', tagName, properties, children }
}

function formatCssRule(cssSelector: string, cssDeclarations: readonly string[]): string {
  return `${cssSelector} {\n${cssDeclarations.map((cssDeclaration) => `  ${cssDeclaration};`).join('\n')}\n}`
}

function describeNoteTypographyDeclarations({ noteFontFamily, noteFontSize, noteColumnWidth }: PapelizNoteTypography): string[] {
  return [
    `--papeliz-note-font-family: ${papelizHtmlExportNoteFontFamilyValues[noteFontFamily]}`,
    `--papeliz-note-font-size: ${noteFontSize}px`,
    `--papeliz-note-column-width: ${papelizHtmlExportNoteColumnWidthValues[noteColumnWidth]}`,
  ]
}

export async function buildPapelizOneNoteHtmlExportFile(oneNoteExportOptions: PapelizOneNoteHtmlExportOptions): Promise<PapelizHtmlExportFile> {
  const { noteArticleHastElement, noteFrontmatterProperties, hasCodeText } = await buildPapelizHtmlExportNoteArticle({
    vaultNoteRelativePath: oneNoteExportOptions.vaultNoteRelativePath,
    vaultNoteText: oneNoteExportOptions.vaultNoteText,
    resolveWikilinkTarget: oneNoteExportOptions.resolveWikilinkTarget,
    // A one-note file has no other pages: links to other notes read as text.
    getHtmlExportNotePageHref: () => null,
    drawHtmlExportMermaidDiagramSvg: oneNoteExportOptions.drawHtmlExportMermaidDiagramSvg,
  })

  const mdViewStyles = readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText)
  const fontFaceCss = await buildPapelizHtmlExportFontFaceCss(
    choosePapelizHtmlExportFontFaces(oneNoteExportOptions.htmlExportNoteTypography.noteFontFamily, hasCodeText),
    oneNoteExportOptions.readHtmlExportFontFileDataUrl ?? readPapelizHtmlExportFontFileDataUrl,
  )
  const pageStylesheetText = [
    fontFaceCss,
    formatCssRule(':root', ['color-scheme: light', ...mdViewStyles.lightThemeTokenDeclarations, ...describeNoteTypographyDeclarations(oneNoteExportOptions.htmlExportNoteTypography)]),
    // Paper is white: the dark theme is for screens only.
    `@media screen and (prefers-color-scheme: dark) {\n${formatCssRule(':root', ['color-scheme: dark', ...mdViewStyles.darkThemeTokenDeclarations]).replace(/^/gm, '  ')}\n}`,
    mdViewStyles.mdViewRulesCssText,
    papelizHtmlExportOneNotePageStylesheetText.trim(),
  ]
    .filter((stylesheetPart) => stylesheetPart.length > 0)
    .join('\n\n')

  const noteLanguageProperty = noteFrontmatterProperties.find((noteFrontmatterProperty) => noteFrontmatterProperty.frontmatterPropertyName.toLowerCase() === 'lang')
  const noteLanguageTag = noteLanguageProperty?.frontmatterPropertyValues[0] ?? ''
  const htmlExportDocument: HastRoot = {
    type: 'root',
    children: [
      { type: 'doctype' },
      createHastElement('html', { lang: papelizHtmlExportLanguageTagPattern.test(noteLanguageTag) ? noteLanguageTag : 'en' }, [
        createHastElement('head', {}, [
          createHastElement('meta', { charSet: 'utf-8' }, []),
          createHastElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }, []),
          createHastElement('meta', { name: 'color-scheme', content: 'light dark' }, []),
          createHastElement('meta', { name: 'generator', content: 'Papeliz' }, []),
          createHastElement('title', {}, [{ type: 'text', value: getVaultNoteTitle(oneNoteExportOptions.vaultNoteRelativePath) }]),
          createHastElement('style', {}, [{ type: 'text', value: `\n${pageStylesheetText}\n` }]),
        ]),
        createHastElement('body', {}, [createHastElement('main', { className: ['papeliz-html-export-page'] }, [noteArticleHastElement])]),
      ]),
    ],
  }
  return {
    htmlExportFileName: getPapelizHtmlExportFileNameForNote(oneNoteExportOptions.vaultNoteRelativePath),
    // Raw markup here is only Mermaid's drawings (papeliz-html-export-note-article.ts).
    htmlExportFileText: `${toHtml(htmlExportDocument, { allowDangerousHtml: true })}\n`,
  }
}
