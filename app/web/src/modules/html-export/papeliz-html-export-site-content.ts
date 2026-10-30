import type { Element as HastElement, ElementContent as HastElementContent } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { SKIP, visit } from 'unist-util-visit'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { getVaultNoteTitle, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'
import { buildPapelizHtmlExportMarkdownTwin } from './papeliz-html-export-markdown-twin'
import { buildPapelizHtmlExportNoteArticle, getPapelizHtmlExportNoteLanguageTag, type PapelizHtmlExportMermaidDiagramDrawer } from './papeliz-html-export-note-article'
import { createPapelizHtmlExportSitePageBasePaths, getPapelizHtmlExportSiteRelativeHref, getPapelizHtmlExportSiteRootHref } from './papeliz-html-export-site-page-paths'
import type { PapelizHtmlExportSitePageValues } from './papeliz-html-export-site-page-shell'
import { createPapelizHtmlExportVaultFileResolver } from './papeliz-html-export-vault-files'

// What an exported website says: each page's values for the site's layout (its title, its place, the
// note as HTML) and the site's text files (the Markdown twins, `llms.txt`, the folder list and search
// data). The same code runs in two places, so they give the same site: in Papeliz, which fills the
// layout's shell in the browser, and in the exported Astro project, whose layout Astro renders with
// these values (bundled for it as papeliz-html-export-core.mjs). Nothing here reads a stylesheet,
// a font or the browser.

export interface PapelizHtmlExportSiteNote {
  vaultNoteRelativePath: string
  vaultNoteText: string
}

export interface PapelizHtmlExportSiteContentOptions {
  // The vault's name, shown as the site's name.
  htmlExportSiteName: string
  htmlExportSiteNotes: readonly PapelizHtmlExportSiteNote[]
  // Over the whole vault, as MD View resolves links: a link to a note that isn't exported reads as
  // text, not as a note still to write.
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  drawHtmlExportMermaidDiagramSvg: PapelizHtmlExportMermaidDiagramDrawer | null
  // Every file in the vault that isn't a note: pictures and files the notes use are copied.
  htmlExportVaultAttachmentFileRelativePaths: readonly string[]
  onHtmlExportProgress?: (exportedNoteCount: number, htmlExportNoteCount: number) => void
  htmlExportAbortSignal?: AbortSignal
}

export interface PapelizHtmlExportSitePageFile {
  // "projects/launch-plan.html"; the home page is "index.html" and comes last.
  sitePageFilePath: string
  sitePageValues: PapelizHtmlExportSitePageValues
}

export interface PapelizHtmlExportSiteTextFile {
  siteFilePath: string
  siteFileText: string
}

// A vault file the pages show or link to, and where its copy goes: "attachments/pictures/plan.png".
export interface PapelizHtmlExportSiteAttachmentFile {
  vaultFileRelativePath: string
  siteFilePath: string
}

export interface PapelizHtmlExportSiteContent {
  sitePageFiles: PapelizHtmlExportSitePageFile[]
  siteTextFiles: PapelizHtmlExportSiteTextFile[]
  siteAttachmentFiles: PapelizHtmlExportSiteAttachmentFile[]
  // Whether any note has code, so the site knows to carry the code font.
  hasCodeText: boolean
}

interface PapelizHtmlExportSiteNotePage {
  vaultNoteRelativePath: string
  notePageTitle: string
  noteFolderNames: string[]
  notePagePath: string
  noteTwinPath: string
}

interface PapelizHtmlExportSiteFolder {
  folderName: string
  childFolders: PapelizHtmlExportSiteFolder[]
  notePages: PapelizHtmlExportSiteNotePage[]
}

export const papelizHtmlExportSiteAssetFolderName = 'papeliz-site'
// The vault's pictures and other files, copied in their own folders.
export const papelizHtmlExportSiteAttachmentFolderName = 'attachments'
const papelizHtmlExportSiteHomePagePath = 'index.html'
const papelizHtmlExportSiteHomeTwinPath = 'index.md'
const papelizSiteNameCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

// Folders before notes at each level, each by name, as a file list shows them.
function compareVaultNoteRelativePathsForSite(firstVaultNoteRelativePath: string, secondVaultNoteRelativePath: string): number {
  const firstPathSegments = splitVaultRelativePath(firstVaultNoteRelativePath)
  const secondPathSegments = splitVaultRelativePath(secondVaultNoteRelativePath)
  for (let segmentIndex = 0; segmentIndex < Math.min(firstPathSegments.length, secondPathSegments.length); segmentIndex += 1) {
    const isFirstSegmentFolder = segmentIndex < firstPathSegments.length - 1
    const isSecondSegmentFolder = segmentIndex < secondPathSegments.length - 1
    if (isFirstSegmentFolder !== isSecondSegmentFolder) return isFirstSegmentFolder ? -1 : 1
    const segmentOrder = papelizSiteNameCollator.compare(
      isFirstSegmentFolder ? (firstPathSegments[segmentIndex] ?? '') : getVaultNoteTitle(firstVaultNoteRelativePath),
      isSecondSegmentFolder ? (secondPathSegments[segmentIndex] ?? '') : getVaultNoteTitle(secondVaultNoteRelativePath),
    )
    if (segmentOrder !== 0) return segmentOrder
  }
  return firstVaultNoteRelativePath < secondVaultNoteRelativePath ? -1 : firstVaultNoteRelativePath > secondVaultNoteRelativePath ? 1 : 0
}

function buildSiteFolderTree(siteNotePages: readonly PapelizHtmlExportSiteNotePage[]): PapelizHtmlExportSiteFolder {
  const rootFolder: PapelizHtmlExportSiteFolder = { folderName: '', childFolders: [], notePages: [] }
  for (const siteNotePage of siteNotePages) {
    let noteFolder = rootFolder
    for (const noteFolderName of siteNotePage.noteFolderNames) {
      let childFolder = noteFolder.childFolders.find((candidateFolder) => candidateFolder.folderName === noteFolderName)
      if (childFolder === undefined) {
        childFolder = { folderName: noteFolderName, childFolders: [], notePages: [] }
        noteFolder.childFolders.push(childFolder)
      }
      noteFolder = childFolder
    }
    noteFolder.notePages.push(siteNotePage)
  }
  return rootFolder
}

function createHastElement(tagName: string, properties: HastElement['properties'], children: HastElementContent[]): HastElement {
  return { type: 'element', tagName, properties, children }
}

function createHastText(textValue: string): HastElementContent {
  return { type: 'text', value: textValue }
}

// The words a reader sees, for search: no drawings, one space between words.
function collectSearchableText(hastElement: HastElement): string {
  const searchableTextParts: string[] = []
  visit(hastElement, (hastNode) => {
    if (hastNode.type === 'element' && hastNode.tagName === 'svg') return SKIP
    if (hastNode.type === 'text') searchableTextParts.push(hastNode.value)
    if (hastNode.type === 'element' && /^(p|li|h[1-6]|pre|td|th|blockquote|div|tr)$/.test(hastNode.tagName)) searchableTextParts.push(' ')
  })
  return searchableTextParts.join('').replace(/\s+/g, ' ').trim()
}

function collectHeadingTexts(hastElement: HastElement): string[] {
  const headingTexts: string[] = []
  visit(hastElement, 'element', (hastHeadingElement: HastElement) => {
    if (/^h[1-6]$/.test(hastHeadingElement.tagName)) headingTexts.push(collectSearchableText(hastHeadingElement))
  })
  return headingTexts
}

function createSiteIndexFolderList(siteFolder: PapelizHtmlExportSiteFolder): HastElement {
  return createHastElement('ul', {}, [
    ...siteFolder.childFolders.map((childFolder) =>
      createHastElement('li', {}, [createHastElement('strong', {}, [createHastText(childFolder.folderName)]), createSiteIndexFolderList(childFolder)]),
    ),
    ...siteFolder.notePages.map((siteNotePage) =>
      createHastElement('li', {}, [
        createHastElement('a', { href: getPapelizHtmlExportSiteRelativeHref(papelizHtmlExportSiteHomePagePath, siteNotePage.notePagePath) }, [createHastText(siteNotePage.notePageTitle)]),
      ]),
    ),
  ])
}

function describeNoteCount(noteCount: number): string {
  return noteCount === 1 ? '1 note' : `${noteCount} notes`
}

function escapeMarkdownText(markdownText: string): string {
  return markdownText.replace(/[\\`*_[\]<>#|]/g, '\\$&')
}

function buildSiteIndexTwinLines(siteFolder: PapelizHtmlExportSiteFolder, listIndent: string): string[] {
  return [
    ...siteFolder.childFolders.flatMap((childFolder) => [`${listIndent}- ${escapeMarkdownText(childFolder.folderName)}`, ...buildSiteIndexTwinLines(childFolder, `${listIndent}  `)]),
    ...siteFolder.notePages.map((siteNotePage) => `${listIndent}- [${escapeMarkdownText(siteNotePage.notePageTitle)}](${getPapelizHtmlExportSiteRelativeHref(papelizHtmlExportSiteHomeTwinPath, siteNotePage.noteTwinPath)})`),
  ]
}

// llms.txt: the site's name, one line about it, then every note's twin, folder by folder.
function buildSiteLlmsText(siteName: string, siteNotePages: readonly PapelizHtmlExportSiteNotePage[]): string {
  const llmsTextLines = [`# ${siteName}`, '', `> ${describeNoteCount(siteNotePages.length)}, exported from Papeliz as a website. Each page has a Markdown twin; the links below go to them.`]
  let currentFolderPath: string | null = null
  for (const siteNotePage of siteNotePages) {
    const noteFolderPath = siteNotePage.noteFolderNames.join(' / ')
    if (noteFolderPath !== currentFolderPath) {
      llmsTextLines.push('', `## ${noteFolderPath.length > 0 ? noteFolderPath : 'Notes'}`, '')
      currentFolderPath = noteFolderPath
    }
    llmsTextLines.push(`- [${escapeMarkdownText(siteNotePage.notePageTitle)}](${getPapelizHtmlExportSiteRelativeHref('llms.txt', siteNotePage.noteTwinPath)})`)
  }
  return `${llmsTextLines.join('\n')}\n`
}

function createSiteScriptDataText(windowPropertyName: string, scriptData: unknown): string {
  return `// Made by Papeliz for papeliz-site.js.\nwindow.${windowPropertyName} = ${JSON.stringify(scriptData)};\n`
}

export async function buildPapelizHtmlExportSiteContent(contentOptions: PapelizHtmlExportSiteContentOptions): Promise<PapelizHtmlExportSiteContent> {
  const sitePageFiles: PapelizHtmlExportSitePageFile[] = []
  const siteTextFiles: PapelizHtmlExportSiteTextFile[] = []

  const siteNotes = [...contentOptions.htmlExportSiteNotes].sort((firstSiteNote, secondSiteNote) =>
    compareVaultNoteRelativePathsForSite(firstSiteNote.vaultNoteRelativePath, secondSiteNote.vaultNoteRelativePath),
  )
  const pageBasePaths = createPapelizHtmlExportSitePageBasePaths(siteNotes.map((siteNote) => siteNote.vaultNoteRelativePath))
  const siteNotePages: PapelizHtmlExportSiteNotePage[] = siteNotes.map((siteNote) => {
    const pageBasePath = pageBasePaths.get(siteNote.vaultNoteRelativePath) ?? ''
    return {
      vaultNoteRelativePath: siteNote.vaultNoteRelativePath,
      notePageTitle: getVaultNoteTitle(siteNote.vaultNoteRelativePath),
      noteFolderNames: splitVaultRelativePath(siteNote.vaultNoteRelativePath).slice(0, -1),
      notePagePath: `${pageBasePath}.html`,
      noteTwinPath: `${pageBasePath}.md`,
    }
  })
  const siteNotePagesByVaultNoteRelativePath = new Map(siteNotePages.map((siteNotePage) => [siteNotePage.vaultNoteRelativePath, siteNotePage]))

  const resolveVaultFileReference = createPapelizHtmlExportVaultFileResolver(contentOptions.htmlExportVaultAttachmentFileRelativePaths)
  const usedVaultFileRelativePaths = new Set<string>()
  // A file's copy, from a page or a twin; the file is copied once something uses it.
  const getVaultFileCopyHref = (fromSiteFilePath: string, vaultFileRelativePath: string) => {
    usedVaultFileRelativePaths.add(vaultFileRelativePath)
    return getPapelizHtmlExportSiteRelativeHref(fromSiteFilePath, `${papelizHtmlExportSiteAttachmentFolderName}/${vaultFileRelativePath}`)
  }

  const siteSearchNotes: Array<{ notePagePath: string; notePageTitle: string; noteFolderPath: string; noteHeadings: string[]; noteText: string }> = []
  let hasCodeText = false
  for (const [siteNoteIndex, siteNote] of siteNotes.entries()) {
    contentOptions.htmlExportAbortSignal?.throwIfAborted()
    const siteNotePage = siteNotePages[siteNoteIndex] as PapelizHtmlExportSiteNotePage
    const noteArticle = await buildPapelizHtmlExportNoteArticle({
      vaultNoteRelativePath: siteNote.vaultNoteRelativePath,
      vaultNoteText: siteNote.vaultNoteText,
      resolveWikilinkTarget: contentOptions.resolveWikilinkTarget,
      getHtmlExportNotePageHref: (targetVaultNoteRelativePath) => {
        const targetNotePage = siteNotePagesByVaultNoteRelativePath.get(targetVaultNoteRelativePath)
        return targetNotePage === undefined ? null : getPapelizHtmlExportSiteRelativeHref(siteNotePage.notePagePath, targetNotePage.notePagePath)
      },
      drawHtmlExportMermaidDiagramSvg: contentOptions.drawHtmlExportMermaidDiagramSvg,
      htmlExportVaultFiles: {
        resolveVaultFileReference,
        getVaultFileSource: async (vaultFileRelativePath) => getVaultFileCopyHref(siteNotePage.notePagePath, vaultFileRelativePath),
      },
    })
    hasCodeText ||= noteArticle.hasCodeText
    const noteFolderPath = siteNotePage.noteFolderNames.join(' / ')
    const pageArticleParts: HastElementContent[] = [noteArticle.noteArticleHastElement]
    if (noteFolderPath.length > 0) pageArticleParts.unshift(createHastElement('p', { className: ['papeliz-site-page-folder'] }, [createHastText(noteFolderPath)]))
    sitePageFiles.push({
      sitePageFilePath: siteNotePage.notePagePath,
      sitePageValues: {
        pageLanguage: getPapelizHtmlExportNoteLanguageTag(noteArticle.noteFrontmatterProperties),
        pageTitle: `${siteNotePage.notePageTitle} · ${contentOptions.htmlExportSiteName}`,
        siteName: contentOptions.htmlExportSiteName,
        siteRootHref: getPapelizHtmlExportSiteRootHref(siteNotePage.notePagePath),
        sitePagePath: siteNotePage.notePagePath,
        markdownTwinHref: getPapelizHtmlExportSiteRelativeHref(siteNotePage.notePagePath, siteNotePage.noteTwinPath),
        // Raw markup here is only Mermaid's drawings (papeliz-html-export-note-article.ts).
        pageArticleHtml: toHtml({ type: 'root', children: pageArticleParts }, { allowDangerousHtml: true }),
      },
    })
    siteTextFiles.push({
      siteFilePath: siteNotePage.noteTwinPath,
      siteFileText: buildPapelizHtmlExportMarkdownTwin({
        vaultNoteRelativePath: siteNote.vaultNoteRelativePath,
        vaultNoteText: siteNote.vaultNoteText,
        resolveWikilinkTarget: contentOptions.resolveWikilinkTarget,
        getHtmlExportNoteTwinHref: (targetVaultNoteRelativePath) => {
          const targetNotePage = siteNotePagesByVaultNoteRelativePath.get(targetVaultNoteRelativePath)
          return targetNotePage === undefined ? null : getPapelizHtmlExportSiteRelativeHref(siteNotePage.noteTwinPath, targetNotePage.noteTwinPath)
        },
        resolveVaultFileReference,
        getHtmlExportVaultFileTwinHref: (vaultFileRelativePath) => getVaultFileCopyHref(siteNotePage.noteTwinPath, vaultFileRelativePath),
      }),
    })
    siteSearchNotes.push({
      notePagePath: siteNotePage.notePagePath,
      notePageTitle: siteNotePage.notePageTitle,
      noteFolderPath,
      noteHeadings: collectHeadingTexts(noteArticle.noteArticleHastElement),
      noteText: collectSearchableText(noteArticle.noteArticleHastElement),
    })
    contentOptions.onHtmlExportProgress?.(siteNoteIndex + 1, siteNotes.length)
  }

  // The home page lists every note, so the site reads and is found without its script.
  const siteFolderTree = buildSiteFolderTree(siteNotePages)
  const siteIndexArticle = createHastElement('article', { className: ['papeliz-md-view-article'] }, [
    createHastElement('h1', {}, [createHastText(contentOptions.htmlExportSiteName)]),
    createHastElement('p', { className: ['papeliz-site-index-count'] }, [createHastText(describeNoteCount(siteNotePages.length))]),
    createSiteIndexFolderList(siteFolderTree),
  ])
  sitePageFiles.push({
    sitePageFilePath: papelizHtmlExportSiteHomePagePath,
    sitePageValues: {
      pageLanguage: 'en',
      pageTitle: contentOptions.htmlExportSiteName,
      siteName: contentOptions.htmlExportSiteName,
      siteRootHref: '',
      sitePagePath: papelizHtmlExportSiteHomePagePath,
      markdownTwinHref: papelizHtmlExportSiteHomeTwinPath,
      pageArticleHtml: toHtml(siteIndexArticle),
    },
  })
  siteTextFiles.push(
    {
      siteFilePath: papelizHtmlExportSiteHomeTwinPath,
      siteFileText: `${[`# ${escapeMarkdownText(contentOptions.htmlExportSiteName)}`, '', `${describeNoteCount(siteNotePages.length)}.`, '', ...buildSiteIndexTwinLines(siteFolderTree, '')].join('\n')}\n`,
    },
    { siteFilePath: 'llms.txt', siteFileText: buildSiteLlmsText(contentOptions.htmlExportSiteName, siteNotePages) },
    {
      siteFilePath: `${papelizHtmlExportSiteAssetFolderName}/papeliz-site-navigation.js`,
      siteFileText: createSiteScriptDataText('papelizSiteNavigation', {
        siteNotePages: siteNotePages.map(({ notePageTitle, notePagePath, noteFolderNames }) => ({ notePageTitle, notePagePath, noteFolderNames })),
      }),
    },
    { siteFilePath: `${papelizHtmlExportSiteAssetFolderName}/papeliz-site-search-index.js`, siteFileText: createSiteScriptDataText('papelizSiteSearchIndex', { siteSearchNotes }) },
  )
  const siteAttachmentFiles = [...usedVaultFileRelativePaths].sort().map((vaultFileRelativePath) => ({
    vaultFileRelativePath,
    siteFilePath: `${papelizHtmlExportSiteAttachmentFolderName}/${vaultFileRelativePath}`,
  }))
  return { sitePageFiles, siteTextFiles, siteAttachmentFiles, hasCodeText }
}
