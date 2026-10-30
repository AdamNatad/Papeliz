import { describe, expect, it } from 'vitest'
import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import { readPapelizHtmlExportMdViewStyles } from './papeliz-html-export-md-view-styles'

const testStylesheetText = `
@import 'tailwindcss';
@theme static {
  --font-sans: 'Figtree', sans-serif;
  /* a comment { with braces } */
  --color-papeliz-blue: #0064d4;
}
:root[data-papeliz-theme='dark'] {
  color-scheme: dark;
  --color-papeliz-blue: #5ea2ff;
}
.papeliz-md-view .cm-line,
.papeliz-md-view-article p {
  margin: 0 0 14px;
}
.papeliz-md-view-article.papeliz-assistant-message-markdown { font-size: 14px; }
.papeliz-md-view-articles p { color: red; }
.papeliz-mermaid-diagram-error-banner { color: red; }
.papeliz-md-view-article li::before { content: '{'; }
@layer base { .papeliz-md-view-article { user-select: text; } }
@media (max-width: 767px) {
  .papeliz-topbar { gap: 4px; }
  .papeliz-md-view-article h1 { font-size: 1.9em; }
}
@media (pointer: coarse) { .papeliz-topbar { gap: 8px; } }
`

describe('MD View styles for an exported page', () => {
  it('reads the light and dark theme tokens', () => {
    const mdViewStyles = readPapelizHtmlExportMdViewStyles(testStylesheetText)
    expect(mdViewStyles.lightThemeTokenDeclarations).toEqual(["--font-sans: 'Figtree', sans-serif", '--color-papeliz-blue: #0064d4'])
    expect(mdViewStyles.darkThemeTokenDeclarations).toEqual(['--color-papeliz-blue: #5ea2ff'])
  })

  it('keeps only MD View’s selectors, inside media queries too', () => {
    const { mdViewRulesCssText } = readPapelizHtmlExportMdViewStyles(testStylesheetText)
    expect(mdViewRulesCssText).toBe(
      [
        '.papeliz-md-view-article p {\n  margin: 0 0 14px;\n}',
        ".papeliz-md-view-article li::before {\n  content: '{';\n}",
        '@media (max-width: 767px) {\n  .papeliz-md-view-article h1 {\n    font-size: 1.9em;\n  }\n}',
      ].join('\n\n'),
    )
  })

  it('stops when the stylesheet has no theme tokens', () => {
    expect(() => readPapelizHtmlExportMdViewStyles('.papeliz-md-view-article p { margin: 0; }')).toThrow(/theme tokens/)
  })

  it('finds MD View’s look in the app’s own stylesheet', () => {
    const mdViewStyles = readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText)
    expect(mdViewStyles.lightThemeTokenDeclarations).toContain('--color-papeliz-blue: #0064d4')
    expect(mdViewStyles.lightThemeTokenDeclarations.some((tokenDeclaration) => tokenDeclaration.startsWith('--font-mono:'))).toBe(true)
    expect(mdViewStyles.darkThemeTokenDeclarations).toContain('--color-papeliz-blue: #5ea2ff')
    for (const expectedSelector of [
      '.papeliz-md-view-article h1 {',
      '.papeliz-md-view-article .papeliz-md-view-callout {',
      '.papeliz-md-view-article table {',
      '.papeliz-md-view-article .papeliz-md-view-properties',
      '.papeliz-mermaid-diagram svg {',
    ]) {
      expect(mdViewStyles.mdViewRulesCssText, expectedSelector).toContain(expectedSelector)
    }
    expect(mdViewStyles.mdViewRulesCssText).not.toMatch(/\.cm-|papeliz-assistant|\.papeliz-md-view \./)
  })
})
