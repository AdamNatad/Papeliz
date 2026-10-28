import type { Element as HastElement, Root as HastRoot } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import rehypeSanitize, { defaultSchema, type Options as PapelizSanitizeSchema } from 'rehype-sanitize'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified, type Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { describePapelizTextStyleCss, isPapelizTextColorValue, isPapelizTextSizeValue } from '../note-editor/papeliz-note-text-style'
import { parsePapelizHexColor } from '../ui/papeliz-color-values'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import {
  papelizMdViewCalloutBodyClassName,
  papelizMdViewCalloutClassName,
  papelizMdViewCalloutTitleClassName,
  remarkPapelizCallouts,
} from './papeliz-remark-callouts'
import { papelizMdViewTagClassName, remarkPapelizTags } from './papeliz-remark-tags'
import { papelizMdViewStyledTextClassName, remarkPapelizTextStyles } from './papeliz-remark-text-styles'
import { remarkPapelizUnderlines } from './papeliz-remark-underlines'
import {
  papelizMdViewUnresolvedWikilinkClassName,
  papelizMdViewWikilinkClassName,
  remarkPapelizWikilinks,
} from './papeliz-remark-wikilinks'

type PapelizSanitizeAttributeDefinitions = NonNullable<PapelizSanitizeSchema['attributes']>[string]

// Adds Papeliz's own classes and data attributes to an element's allowed attributes. The sanitizer
// reads only the first `className` rule per element, so allowed classes are merged into one rule.
function allowPapelizAttributes(
  defaultAttributeDefinitions: PapelizSanitizeAttributeDefinitions | undefined,
  papelizClassNames: readonly string[],
  papelizDataAttributeNames: readonly string[],
): PapelizSanitizeAttributeDefinitions {
  const allowedClassNames: Array<string | number | boolean | RegExp | null | undefined> = [...papelizClassNames]
  const otherAttributeDefinitions: PapelizSanitizeAttributeDefinitions = []
  for (const attributeDefinition of defaultAttributeDefinitions ?? []) {
    if (Array.isArray(attributeDefinition) && attributeDefinition[0] === 'className') allowedClassNames.push(...attributeDefinition.slice(1))
    else otherAttributeDefinitions.push(attributeDefinition)
  }
  return [...otherAttributeDefinitions, ['className', ...allowedClassNames], ...papelizDataAttributeNames]
}

// The sanitizer is GitHub's safe list plus exactly the classes and data attributes Papeliz's own
// plugins add. Raw HTML in a note is never rendered (remark-rehype drops it), and anything that
// could run script is removed, because the app's origin will hold the user's API keys.
const papelizMdViewSanitizeSchema: PapelizSanitizeSchema = {
  ...defaultSchema,
  // Underline, made only from `<u>words</u>` (papeliz-remark-underlines.ts), with no attributes.
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
  attributes: {
    ...defaultSchema.attributes,
    a: allowPapelizAttributes(
      defaultSchema.attributes?.['a'],
      [papelizMdViewWikilinkClassName, papelizMdViewUnresolvedWikilinkClassName],
      ['dataPapelizWikilinkTarget'],
    ),
    span: allowPapelizAttributes(
      defaultSchema.attributes?.['span'],
      [papelizMdViewTagClassName, papelizMdViewStyledTextClassName],
      ['dataPapelizTagName', 'dataPapelizTextColor', 'dataPapelizTextSize'],
    ),
    div: allowPapelizAttributes(
      defaultSchema.attributes?.['div'],
      [papelizMdViewCalloutClassName, papelizMdViewCalloutTitleClassName, papelizMdViewCalloutBodyClassName],
      ['dataPapelizCalloutKind', 'dataPapelizCalloutColor'],
    ),
  },
}

// After the sanitizer: the checked colors and sizes of styled text, and the colors of cards, become
// inline styles. Only a card color name, a hex color or one of Papeliz's sizes is ever written, so
// nothing else can reach a style.
const rehypePapelizColorStyles: Plugin<[], HastRoot> = () => (hastRoot) => {
  visit(hastRoot, 'element', (hastElement: HastElement) => {
    const textColor = hastElement.properties['dataPapelizTextColor']
    const textSize = hastElement.properties['dataPapelizTextSize']
    const checkedTextColor = typeof textColor === 'string' && isPapelizTextColorValue(textColor) ? textColor : null
    const checkedTextSize = typeof textSize === 'string' && isPapelizTextSizeValue(textSize) ? textSize : null
    if (checkedTextColor !== null || checkedTextSize !== null) {
      hastElement.properties['style'] = describePapelizTextStyleCss({ textColor: checkedTextColor, textSize: checkedTextSize })
    }
    const calloutColor = hastElement.properties['dataPapelizCalloutColor']
    if (typeof calloutColor === 'string' && calloutColor.startsWith('#') && parsePapelizHexColor(calloutColor) === calloutColor) {
      hastElement.properties['style'] = `--papeliz-callout-custom-color: ${calloutColor}`
    }
  })
}

export interface PapelizMdViewRenderOptions {
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  fromVaultNoteRelativePath: string | null
}

export interface PapelizMdViewRenderedNote {
  noteFrontmatterText: string | null
  noteHastRoot: HastRoot
}

export function renderPapelizMdViewNote(vaultNoteText: string, renderOptions: PapelizMdViewRenderOptions): PapelizMdViewRenderedNote {
  const papelizMdViewProcessor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkPapelizWikilinks, renderOptions)
    .use(remarkPapelizTags)
    .use(remarkPapelizCallouts)
    .use(remarkPapelizTextStyles)
    .use(remarkPapelizUnderlines)
    .use(remarkRehype)
    .use(rehypeSanitize, papelizMdViewSanitizeSchema)
    .use(rehypePapelizColorStyles)

  const noteMdastRoot: MdastRoot = papelizMdViewProcessor.parse(vaultNoteText)
  const firstMdastNode = noteMdastRoot.children[0]
  const noteFrontmatterText = firstMdastNode?.type === 'yaml' ? firstMdastNode.value : null
  const noteHastRoot = papelizMdViewProcessor.runSync(noteMdastRoot) as HastRoot
  return { noteFrontmatterText, noteHastRoot }
}
