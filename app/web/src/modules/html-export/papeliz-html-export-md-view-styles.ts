// An exported page looks like MD View because it uses MD View's own styles: the rules for the
// rendered note (`.papeliz-md-view-article …`, `.papeliz-mermaid-diagram …`) and the color tokens
// they read, both taken from the app's stylesheet. When MD View's look changes, the export follows.

export interface PapelizHtmlExportMdViewStyles {
  // `--color-papeliz-blue: #0064d4` and the rest of the light theme (with the fonts, shadows and
  // easing tokens), as declarations for a `:root` rule.
  lightThemeTokenDeclarations: string[]
  // The dark theme's values for the same tokens.
  darkThemeTokenDeclarations: string[]
  // MD View's rules, including those inside media queries, ready to place in a stylesheet.
  mdViewRulesCssText: string
}

interface PapelizCssBlock {
  cssPrelude: string
  cssBody: string
}

const papelizMdViewSelectorPrefixes = ['.papeliz-md-view-article', '.papeliz-mermaid-diagram'] as const
// The assistant's answers reuse the article's class for their own small variant.
const papelizNonExportedSelectorPart = 'papeliz-assistant'
const papelizLightThemeTokenBlockPrelude = '@theme static'
const papelizDarkThemeTokenBlockPrelude = ":root[data-papeliz-theme='dark']"

function removeCssComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '')
}

// The top-level blocks of a stylesheet (`prelude { body }`), skipping statements such as
// `@import …;`. Comments are removed first; quoted strings may hold braces.
function splitCssTopLevelBlocks(cssText: string): PapelizCssBlock[] {
  const cssTextWithoutComments = removeCssComments(cssText)
  const cssBlocks: PapelizCssBlock[] = []
  let preludeStartIndex = 0
  let bodyStartIndex = -1
  let braceDepth = 0
  let openQuoteCharacter: string | null = null
  for (let characterIndex = 0; characterIndex < cssTextWithoutComments.length; characterIndex += 1) {
    const cssCharacter = cssTextWithoutComments[characterIndex]
    if (openQuoteCharacter !== null) {
      if (cssCharacter === '\\') characterIndex += 1
      else if (cssCharacter === openQuoteCharacter) openQuoteCharacter = null
      continue
    }
    if (cssCharacter === '"' || cssCharacter === "'") openQuoteCharacter = cssCharacter
    else if (cssCharacter === ';' && braceDepth === 0) preludeStartIndex = characterIndex + 1
    else if (cssCharacter === '{') {
      if (braceDepth === 0) bodyStartIndex = characterIndex + 1
      braceDepth += 1
    } else if (cssCharacter === '}') {
      braceDepth -= 1
      if (braceDepth === 0) {
        cssBlocks.push({
          cssPrelude: cssTextWithoutComments.slice(preludeStartIndex, bodyStartIndex - 1).trim(),
          cssBody: cssTextWithoutComments.slice(bodyStartIndex, characterIndex),
        })
        preludeStartIndex = characterIndex + 1
      }
    }
  }
  return cssBlocks
}

// `a, b:is(c, d)` -> ['a', 'b:is(c, d)']
function splitCssSelectorList(cssSelectorListText: string): string[] {
  const cssSelectors: string[] = []
  let selectorStartIndex = 0
  let parenthesisDepth = 0
  for (let characterIndex = 0; characterIndex < cssSelectorListText.length; characterIndex += 1) {
    const cssCharacter = cssSelectorListText[characterIndex]
    if (cssCharacter === '(') parenthesisDepth += 1
    else if (cssCharacter === ')') parenthesisDepth -= 1
    else if (cssCharacter === ',' && parenthesisDepth === 0) {
      cssSelectors.push(cssSelectorListText.slice(selectorStartIndex, characterIndex).trim())
      selectorStartIndex = characterIndex + 1
    }
  }
  cssSelectors.push(cssSelectorListText.slice(selectorStartIndex).trim())
  return cssSelectors.filter((cssSelector) => cssSelector.length > 0)
}

function isMdViewCssSelector(cssSelector: string): boolean {
  if (cssSelector.includes(papelizNonExportedSelectorPart)) return false
  return papelizMdViewSelectorPrefixes.some((selectorPrefix) => {
    if (!cssSelector.startsWith(selectorPrefix)) return false
    // `.papeliz-md-view-article h1` or `.papeliz-mermaid-diagram.x`, never `.papeliz-mermaid-diagram-error`.
    const characterAfterPrefix = cssSelector.charAt(selectorPrefix.length)
    return characterAfterPrefix === '' || /[\s.:[>+~]/.test(characterAfterPrefix)
  })
}

// `--name: value;` declarations of custom properties, in their order.
function readCssCustomPropertyDeclarations(cssBody: string): string[] {
  return [...cssBody.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((declarationMatch) => `${declarationMatch[1]}: ${(declarationMatch[2] ?? '').trim().replace(/\s+/g, ' ')}`)
}

function tidyCssBody(cssBody: string): string {
  return cssBody
    .split('\n')
    .map((cssBodyLine) => cssBodyLine.trim())
    .filter((cssBodyLine) => cssBodyLine.length > 0)
    .map((cssBodyLine) => `  ${cssBodyLine}`)
    .join('\n')
}

// MD View's rules among `cssBlocks`: each kept rule lists only its MD View selectors, and a media
// query is kept with the MD View rules inside it.
function collectMdViewCssRules(cssBlocks: readonly PapelizCssBlock[]): string[] {
  const mdViewCssRules: string[] = []
  for (const { cssPrelude, cssBody } of cssBlocks) {
    if (cssPrelude.startsWith('@media')) {
      const innerMdViewCssRules = collectMdViewCssRules(splitCssTopLevelBlocks(cssBody))
      if (innerMdViewCssRules.length > 0) {
        mdViewCssRules.push(`${cssPrelude} {\n${innerMdViewCssRules.map((innerCssRule) => innerCssRule.replace(/^/gm, '  ')).join('\n\n')}\n}`)
      }
      continue
    }
    if (cssPrelude.startsWith('@')) continue
    const mdViewCssSelectors = splitCssSelectorList(cssPrelude).filter(isMdViewCssSelector)
    if (mdViewCssSelectors.length === 0) continue
    mdViewCssRules.push(`${mdViewCssSelectors.join(',\n')} {\n${tidyCssBody(cssBody)}\n}`)
  }
  return mdViewCssRules
}

export function readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText: string): PapelizHtmlExportMdViewStyles {
  const cssBlocks = splitCssTopLevelBlocks(papelizWebappStylesheetText)
  const lightThemeTokenBlock = cssBlocks.find((cssBlock) => cssBlock.cssPrelude === papelizLightThemeTokenBlockPrelude)
  const darkThemeTokenBlock = cssBlocks.find((cssBlock) => cssBlock.cssPrelude === papelizDarkThemeTokenBlockPrelude)
  if (lightThemeTokenBlock === undefined || darkThemeTokenBlock === undefined) {
    throw new Error('The app stylesheet has no light or dark theme tokens for the export.')
  }
  return {
    lightThemeTokenDeclarations: readCssCustomPropertyDeclarations(lightThemeTokenBlock.cssBody),
    darkThemeTokenDeclarations: readCssCustomPropertyDeclarations(darkThemeTokenBlock.cssBody),
    mdViewRulesCssText: collectMdViewCssRules(cssBlocks).join('\n\n'),
  }
}
