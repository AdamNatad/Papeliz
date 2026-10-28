import type { Nodes as MdastNodes, Root as MdastRoot } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'
import { remarkPapelizTags } from '../md-view/papeliz-remark-tags'
import { remarkPapelizWikilinks } from '../md-view/papeliz-remark-wikilinks'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { createPapelizWikilinkTargetResolver } from './papeliz-wikilink-targets'

// What Papeliz knows about one note without opening it: its links, tags and headings. Built from
// the same Markdown syntax tree as MD View, so links are read the same way everywhere. Every entry
// can be rebuilt from the note's text; nothing here is the source of truth.

export interface PapelizVaultNoteHeading {
  noteHeadingText: string
  noteHeadingDepth: number
  noteHeadingLineNumber: number
}

export interface PapelizVaultNoteIndexEntry {
  vaultNoteRelativePath: string
  vaultNoteTitle: string
  outgoingWikilinkTargetNames: string[]
  vaultNoteTags: string[]
  vaultNoteHeadings: PapelizVaultNoteHeading[]
}

const papelizVaultNoteIndexProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkPapelizWikilinks, { resolveWikilinkTarget: () => null, fromVaultNoteRelativePath: null })
  .use(remarkPapelizTags)

function readMdastNodeText(mdastNode: MdastNodes): string {
  if (mdastNode.type === 'text' || mdastNode.type === 'inlineCode') return mdastNode.value
  if (mdastNode.type === 'papelizWikilink') return mdastNode.wikilinkLabel ?? mdastNode.wikilinkTargetNoteName
  if (mdastNode.type === 'papelizTag') return `#${mdastNode.papelizTagName}`
  if ('children' in mdastNode) return mdastNode.children.map((childNode) => readMdastNodeText(childNode as MdastNodes)).join('')
  return ''
}

export function readPapelizVaultNoteIndexEntry(vaultNoteRelativePath: string, vaultNoteText: string): PapelizVaultNoteIndexEntry {
  const noteMdastRoot = papelizVaultNoteIndexProcessor.runSync(papelizVaultNoteIndexProcessor.parse(vaultNoteText)) as MdastRoot
  const outgoingWikilinkTargetNames: string[] = []
  const vaultNoteTags = new Set<string>()
  const vaultNoteHeadings: PapelizVaultNoteHeading[] = []

  visit(noteMdastRoot, (mdastNode) => {
    if (mdastNode.type === 'papelizWikilink' && mdastNode.wikilinkTargetNoteName.length > 0) outgoingWikilinkTargetNames.push(mdastNode.wikilinkTargetNoteName)
    if (mdastNode.type === 'papelizTag') vaultNoteTags.add(mdastNode.papelizTagName)
    if (mdastNode.type === 'heading') {
      vaultNoteHeadings.push({
        noteHeadingText: readMdastNodeText(mdastNode).trim(),
        noteHeadingDepth: mdastNode.depth,
        noteHeadingLineNumber: mdastNode.position?.start.line ?? 1,
      })
    }
    if (mdastNode.type === 'yaml') {
      for (const frontmatterProperty of readPapelizNoteFrontmatterProperties(mdastNode.value)) {
        if (frontmatterProperty.frontmatterPropertyName.toLowerCase() === 'tags' || frontmatterProperty.frontmatterPropertyName.toLowerCase() === 'tag') {
          for (const frontmatterTag of frontmatterProperty.frontmatterPropertyValues) vaultNoteTags.add(frontmatterTag.replace(/^#/, ''))
        }
      }
    }
  })

  return {
    vaultNoteRelativePath,
    vaultNoteTitle: getVaultNoteTitle(vaultNoteRelativePath),
    outgoingWikilinkTargetNames,
    vaultNoteTags: [...vaultNoteTags],
    vaultNoteHeadings,
  }
}

export interface PapelizVaultNoteBacklink {
  linkingVaultNoteRelativePath: string
  linkCount: number
}

// Notes that link to `vaultNoteRelativePath`, most links first.
export function findPapelizVaultNoteBacklinks(
  vaultNoteIndexEntries: readonly PapelizVaultNoteIndexEntry[],
  vaultNoteRelativePath: string,
): PapelizVaultNoteBacklink[] {
  const resolveWikilinkTarget = createPapelizWikilinkTargetResolver(vaultNoteIndexEntries.map((vaultNoteIndexEntry) => vaultNoteIndexEntry.vaultNoteRelativePath))
  const vaultNoteBacklinks: PapelizVaultNoteBacklink[] = []
  for (const vaultNoteIndexEntry of vaultNoteIndexEntries) {
    if (vaultNoteIndexEntry.vaultNoteRelativePath === vaultNoteRelativePath) continue
    const linkCount = vaultNoteIndexEntry.outgoingWikilinkTargetNames.filter(
      (outgoingWikilinkTargetName) => resolveWikilinkTarget(outgoingWikilinkTargetName, vaultNoteIndexEntry.vaultNoteRelativePath) === vaultNoteRelativePath,
    ).length
    if (linkCount > 0) vaultNoteBacklinks.push({ linkingVaultNoteRelativePath: vaultNoteIndexEntry.vaultNoteRelativePath, linkCount })
  }
  return vaultNoteBacklinks.sort(
    (firstBacklink, secondBacklink) =>
      secondBacklink.linkCount - firstBacklink.linkCount || firstBacklink.linkingVaultNoteRelativePath.localeCompare(secondBacklink.linkingVaultNoteRelativePath),
  )
}
