import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import type { PapelizNoteColumnWidth, PapelizNoteFontFamily, PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import papelizHtmlExportArticleExtrasStylesheetText from './papeliz-html-export-article-extras.css?raw'
import { readPapelizHtmlExportMdViewStyles } from './papeliz-html-export-md-view-styles'

// The stylesheet that makes an exported note look like MD View: the fonts, the color tokens in the
// light and dark themes, MD View's rules and the export's few extras. A one-note page follows the
// device's theme; a website follows its own Light, Dark and Device switch (`data-papeliz-site-theme`
// on the page, set by its script), and the device's theme when scripts are off. HTML's settings can
// start either in Light or Dark instead, and give links another accent.

export type PapelizHtmlExportThemeChoice = 'follow-device' | 'site-theme-switch'

// The look Export › HTML's settings give the pages: the theme they open in (a website's readers can
// still switch it) and the accent links and MD View's blue marks take. Device and no accent are
// MD View's own.
export type PapelizHtmlExportStartingTheme = 'light' | 'dark' | 'device'

export interface PapelizHtmlExportLook {
  htmlExportStartingTheme: PapelizHtmlExportStartingTheme
  // "#0b7a5c"; null keeps MD View's blue.
  htmlExportAccentHexColor: string | null
}

export const papelizDefaultHtmlExportLook: PapelizHtmlExportLook = { htmlExportStartingTheme: 'device', htmlExportAccentHexColor: null }

export interface PapelizHtmlExportNoteStylesheetOptions {
  htmlExportThemeChoice: PapelizHtmlExportThemeChoice
  // The note's text settings at export time (font, size, width), as MD View shows them.
  htmlExportNoteTypography: PapelizNoteTypography
  htmlExportLook?: PapelizHtmlExportLook
  fontFaceCss: string
}

// Only a full six-digit hex color reaches the stylesheet.
function readPapelizHtmlExportAccentDeclarations(htmlExportAccentHexColor: string | null): string[] {
  return htmlExportAccentHexColor !== null && /^#[0-9a-f]{6}$/i.test(htmlExportAccentHexColor) ? [`--color-papeliz-blue: ${htmlExportAccentHexColor}`] : []
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

export function buildPapelizHtmlExportNoteStylesheet({
  htmlExportThemeChoice,
  htmlExportNoteTypography,
  htmlExportLook = papelizDefaultHtmlExportLook,
  fontFaceCss,
}: PapelizHtmlExportNoteStylesheetOptions): string {
  const mdViewStyles = readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText)
  const accentDeclarations = readPapelizHtmlExportAccentDeclarations(htmlExportLook.htmlExportAccentHexColor)
  const darkThemeDeclarations = ['color-scheme: dark', ...mdViewStyles.darkThemeTokenDeclarations, ...accentDeclarations]
  const { htmlExportStartingTheme } = htmlExportLook
  // Paper is white: a one-note page's dark theme is for screens only. A website's own switch decides
  // there; with scripts off, its starting theme does.
  const darkThemeCss =
    htmlExportThemeChoice === 'follow-device'
      ? htmlExportStartingTheme === 'light'
        ? []
        : htmlExportStartingTheme === 'dark'
          ? [`@media screen {\n${indentCss(formatCssRule(':root', darkThemeDeclarations))}\n}`]
          : [`@media screen and (prefers-color-scheme: dark) {\n${indentCss(formatCssRule(':root', darkThemeDeclarations))}\n}`]
      : [
          formatCssRule(":root[data-papeliz-site-theme='dark']", darkThemeDeclarations),
          ...(htmlExportStartingTheme === 'light'
            ? []
            : htmlExportStartingTheme === 'dark'
              ? [formatCssRule(':root:not([data-papeliz-site-theme])', darkThemeDeclarations)]
              : [`@media (prefers-color-scheme: dark) {\n${indentCss(formatCssRule(':root:not([data-papeliz-site-theme])', darkThemeDeclarations))}\n}`]),
        ]
  const themeTokenCss = [
    formatCssRule(':root', [
      'color-scheme: light',
      ...mdViewStyles.lightThemeTokenDeclarations,
      ...accentDeclarations,
      `--papeliz-note-font-family: ${papelizHtmlExportNoteFontFamilyValues[htmlExportNoteTypography.noteFontFamily]}`,
      `--papeliz-note-font-size: ${htmlExportNoteTypography.noteFontSize}px`,
      `--papeliz-note-column-width: ${papelizHtmlExportNoteColumnWidthValues[htmlExportNoteTypography.noteColumnWidth]}`,
    ]),
    ...darkThemeCss,
  ]
  return [fontFaceCss, ...themeTokenCss, mdViewStyles.mdViewRulesCssText, papelizHtmlExportArticleExtrasStylesheetText.trim()]
    .filter((stylesheetPart) => stylesheetPart.length > 0)
    .join('\n\n')
}
