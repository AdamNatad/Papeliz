import type { Element as HastElement, Root as HastRoot, RootContent as HastRootContent } from 'hast'
import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { readPapelizNoteFrontmatterProperties } from './papeliz-note-frontmatter-properties'
import { renderPapelizMdViewNote } from './papeliz-md-view-render-pipeline'

const testRenderOptions = {
  resolveWikilinkTarget: createPapelizWikilinkTargetResolver(['Start here.md', 'Guides/Callouts.md']),
  fromVaultNoteRelativePath: 'Start here.md',
}

function collectHastElements(hastNode: HastRoot | HastRootContent, collectedElements: HastElement[] = []): HastElement[] {
  if (hastNode.type === 'element') collectedElements.push(hastNode)
  if ('children' in hastNode) for (const hastChild of hastNode.children) collectHastElements(hastChild, collectedElements)
  return collectedElements
}

function collectHastText(hastNode: HastRoot | HastRootContent): string {
  if (hastNode.type === 'text') return hastNode.value
  if ('children' in hastNode) return hastNode.children.map(collectHastText).join('')
  return ''
}

function renderTestNote(vaultNoteText: string) {
  const renderedNote = renderPapelizMdViewNote(vaultNoteText, testRenderOptions)
  return { ...renderedNote, renderedElements: collectHastElements(renderedNote.noteHastRoot) }
}

describe('the MD View pipeline', () => {
  it('turns wikilinks into links, and marks the ones whose note is missing', () => {
    const { renderedElements } = renderTestNote('See [[Callouts|the callouts]] and [[Not written yet]].')
    const wikilinkElements = renderedElements.filter((renderedElement) => renderedElement.properties['dataPapelizWikilinkTarget'] !== undefined)
    expect(wikilinkElements.map((wikilinkElement) => wikilinkElement.properties['dataPapelizWikilinkTarget'])).toEqual(['Callouts', 'Not written yet'])
    expect(collectHastText(wikilinkElements[0] as HastElement)).toBe('the callouts')
    expect(wikilinkElements[1]?.properties['className']).toContain('papeliz-md-view-wikilink-unresolved')
  })

  it('underlines <u> words with a bare u element, and still drops other raw HTML', () => {
    const { renderedElements } = renderTestNote('Water <u>early</u>, <b onclick="x()">not this</b> <U>late</U>.')
    const underlineElements = renderedElements.filter((renderedElement) => renderedElement.tagName === 'u')
    expect(underlineElements.map(collectHastText)).toEqual(['early', 'late'])
    expect(underlineElements.every((underlineElement) => Object.keys(underlineElement.properties).length === 0)).toBe(true)
    expect(renderedElements.some((renderedElement) => renderedElement.tagName === 'b')).toBe(false)
  })

  it('leaves wikilink syntax inside code alone', () => {
    const { renderedElements } = renderTestNote('Type `[[Callouts]]` to link.')
    expect(renderedElements.some((renderedElement) => renderedElement.properties['dataPapelizWikilinkTarget'] !== undefined)).toBe(false)
  })

  it('renders callouts with a kind and a title', () => {
    const { renderedElements } = renderTestNote('> [!tip] Keep it short\n> The body.')
    const calloutElement = renderedElements.find((renderedElement) => renderedElement.properties['dataPapelizCalloutKind'] === 'tip')
    expect(calloutElement?.tagName).toBe('div')
    const calloutTitleElement = renderedElements.find((renderedElement) =>
      String(renderedElement.properties['className']).includes('papeliz-md-view-callout-title'),
    )
    expect(collectHastText(calloutTitleElement as HastElement)).toBe('Keep it short')
    expect(collectHastText(calloutElement as HastElement)).toContain('The body.')
  })

  it('keeps a color chosen as [!kind|color] and still names the card after its kind', () => {
    const { renderedElements } = renderTestNote('> [!note|purple]\n> Mine.')
    const calloutElement = renderedElements.find((renderedElement) => renderedElement.properties['dataPapelizCalloutKind'] === 'note')
    expect(calloutElement?.properties['dataPapelizCalloutColor']).toBe('purple')
    const calloutTitleElement = renderedElements.find((renderedElement) =>
      String(renderedElement.properties['className']).includes('papeliz-md-view-callout-title'),
    )
    expect(collectHastText(calloutTitleElement as HastElement)).toBe('Note')
  })

  it('colors text written as a color span, and drops any other span or style', () => {
    const { renderedElements } = renderTestNote(
      'Plant <span style="color: purple">tomatoes</span> and <span style="color: #e11d48">beans</span>, not <span style="color: red; background: url(x)">this</span>.',
    )
    const coloredElements = renderedElements.filter((renderedElement) => renderedElement.properties['dataPapelizTextColor'] !== undefined)
    expect(coloredElements.map((coloredElement) => [collectHastText(coloredElement as HastElement), coloredElement.properties['style']])).toEqual([
      ['tomatoes', 'color: var(--color-papeliz-callout-purple-ink)'],
      ['beans', 'color: #e11d48'],
    ])
    expect(renderedElements.some((renderedElement) => String(renderedElement.properties['style'] ?? '').includes('url('))).toBe(false)
  })

  it('sizes text written as a size span, together with its color', () => {
    const { renderedElements } = renderTestNote('A <span style="color: teal; font-size: 1.5em">big</span> word and <span style="font-size: 9em">this</span>.')
    const styledElements = renderedElements.filter((renderedElement) => renderedElement.properties['dataPapelizTextSize'] !== undefined)
    expect(styledElements.map((styledElement) => styledElement.properties['style'])).toEqual(['color: var(--color-papeliz-callout-teal-ink); font-size: 1.5em'])
  })

  it('gives a card in any color its color as a style', () => {
    const { renderedElements } = renderTestNote('> [!note|#7C3AED] Mine\n> Body.')
    const calloutElement = renderedElements.find((renderedElement) => renderedElement.properties['dataPapelizCalloutKind'] === 'note')
    expect(calloutElement?.properties['dataPapelizCalloutColor']).toBe('#7c3aed')
    expect(calloutElement?.properties['style']).toBe('--papeliz-callout-custom-color: #7c3aed')
  })

  it('names a callout after its kind when it has no title', () => {
    const { renderedElements } = renderTestNote('> [!warning]\n> Careful.')
    const calloutTitleElement = renderedElements.find((renderedElement) =>
      String(renderedElement.properties['className']).includes('papeliz-md-view-callout-title'),
    )
    expect(collectHastText(calloutTitleElement as HastElement)).toBe('Warning')
  })

  it('renders task lists, tables and tags', () => {
    const { renderedElements } = renderTestNote('- [x] Done\n- [ ] Not yet\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nA #garden note, not C# code.')
    expect(renderedElements.filter((renderedElement) => renderedElement.tagName === 'input')).toHaveLength(2)
    expect(renderedElements.some((renderedElement) => renderedElement.tagName === 'table')).toBe(true)
    const tagElements = renderedElements.filter((renderedElement) => renderedElement.properties['dataPapelizTagName'] !== undefined)
    expect(tagElements.map((tagElement) => tagElement.properties['dataPapelizTagName'])).toEqual(['garden'])
  })

  it('keeps a labelled wikilink in one table cell, and the column alignment', () => {
    const { renderedElements } = renderTestNote('| Item | Cost |\n| --- | ---: |\n| [[Callouts|Two baristas]] | $4,400 |')
    const bodyCellElements = renderedElements.filter((renderedElement) => renderedElement.tagName === 'td')
    expect(bodyCellElements.map((bodyCellElement) => collectHastText(bodyCellElement))).toEqual(['Two baristas', '$4,400'])
    expect(bodyCellElements[1]?.properties['align']).toBe('right')
    const wikilinkElement = renderedElements.find((renderedElement) => renderedElement.properties['dataPapelizWikilinkTarget'] !== undefined)
    expect(wikilinkElement?.properties['dataPapelizWikilinkTarget']).toBe('Callouts')
  })

  it('keeps a mermaid block as code marked language-mermaid, for the page to draw', () => {
    const { renderedElements } = renderTestNote('```mermaid\nflowchart LR\n  A --> B\n```')
    const codeElement = renderedElements.find((renderedElement) => renderedElement.tagName === 'code')
    expect(codeElement?.properties['className']).toEqual(['language-mermaid'])
    expect(collectHastText(codeElement as HastElement)).toBe('flowchart LR\n  A --> B\n')
  })

  it('never renders script, raw HTML or javascript: links', () => {
    const { renderedElements } = renderTestNote(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[click](javascript:alert(1))\n\n<a href="#" onclick="alert(1)">x</a>',
    )
    expect(renderedElements.some((renderedElement) => renderedElement.tagName === 'script')).toBe(false)
    expect(renderedElements.some((renderedElement) => Object.keys(renderedElement.properties).some((propertyName) => /^on/i.test(propertyName)))).toBe(false)
    const linkHrefs = renderedElements.filter((renderedElement) => renderedElement.tagName === 'a').map((linkElement) => String(linkElement.properties['href'] ?? ''))
    expect(linkHrefs.some((linkHref) => linkHref.toLowerCase().startsWith('javascript:'))).toBe(false)
  })

  it('separates the frontmatter from the note body', () => {
    const { noteFrontmatterText, noteHastRoot } = renderTestNote('---\ntags: [a, b]\n---\n# Title')
    expect(noteFrontmatterText).toBe('tags: [a, b]')
    expect(collectHastText(noteHastRoot)).not.toContain('tags:')
  })
})

describe('frontmatter properties', () => {
  it('reads the common YAML shapes', () => {
    expect(readPapelizNoteFrontmatterProperties('tags: [garden, "project"]\nstatus: planning\naliases:\n  - Plot\n  - Beds\nempty:')).toEqual([
      { frontmatterPropertyName: 'tags', frontmatterPropertyValues: ['garden', 'project'] },
      { frontmatterPropertyName: 'status', frontmatterPropertyValues: ['planning'] },
      { frontmatterPropertyName: 'aliases', frontmatterPropertyValues: ['Plot', 'Beds'] },
      { frontmatterPropertyName: 'empty', frontmatterPropertyValues: [] },
    ])
  })
})
