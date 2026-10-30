import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import type { PapelizNoteColumnWidth, PapelizNoteFontFamily, PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import papelizHtmlExportArticleExtrasStylesheetText from './papeliz-html-export-article-extras.css?raw'
import { readPapelizHtmlExportMdViewStyles } from './papeliz-html-export-md-view-styles'

// The stylesheet that makes an exported note look like MD View: the fonts, the color tokens in the
// light and dark themes, MD View's rules and the export's few extras. A one-note page follows the
// device's theme; a website follows its own Light, Dark and Device switch (`data-papeliz-site-theme`
// on the page, set by its script), and the device's theme when scripts are off.

export type PapelizHtmlExportThemeChoice = 'follow-device' | 'site-theme-switch'

export interface PapelizHtmlExportNoteStylesheetOptions {
  htmlExportThemeChoice: PapelizHtmlExportThemeChoice
  // The note's text settings at export time (font, size, width), as MD View shows them.
  htmlExportNoteTypography: PapelizNoteTypography
  fontFaceCss: string
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

function formatCssRule(cssSelector: string, cssDeclarations: readonly string[]): string {
  return `${cssSelector} {\n${cssDeclarations.map((cssDeclaration) => `  ${cssDeclaration};`).join('\n')}\n}`
}

function indentCss(cssText: string): string {
  return cssText.replace(/^/gm, '  ')
}

export function buildPapelizHtmlExportNoteStylesheet({ htmlExportThemeChoice, htmlExportNoteTypography, fontFaceCss }: PapelizHtmlExportNoteStylesheetOptions): string {
  const mdViewStyles = readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText)
  const darkThemeDeclarations = ['color-scheme: dark', ...mdViewStyles.darkThemeTokenDeclarations]
  const themeTokenCss = [
    formatCssRule(':root', [
      'color-scheme: light',
      ...mdViewStyles.lightThemeTokenDeclarations,
      `--papeliz-note-font-family: ${papelizHtmlExportNoteFontFamilyValues[htmlExportNoteTypography.noteFontFamily]}`,
      `--papeliz-note-font-size: ${htmlExportNoteTypography.noteFontSize}px`,
      `--papeliz-note-column-width: ${papelizHtmlExportNoteColumnWidthValues[htmlExportNoteTypography.noteColumnWidth]}`,
    ]),
    // Paper is white: a one-note page's dark theme is for screens only.
    ...(htmlExportThemeChoice === 'follow-device'
      ? [`@media screen and (prefers-color-scheme: dark) {\n${indentCss(formatCssRule(':root', darkThemeDeclarations))}\n}`]
      : [
          formatCssRule(":root[data-papeliz-site-theme='dark']", darkThemeDeclarations),
          `@media (prefers-color-scheme: dark) {\n${indentCss(formatCssRule(':root:not([data-papeliz-site-theme])', darkThemeDeclarations))}\n}`,
        ]),
  ]
  return [fontFaceCss, ...themeTokenCss, mdViewStyles.mdViewRulesCssText, papelizHtmlExportArticleExtrasStylesheetText.trim()]
    .filter((stylesheetPart) => stylesheetPart.length > 0)
    .join('\n\n')
}
