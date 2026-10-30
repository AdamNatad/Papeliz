import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import { toHtml } from 'hast-util-to-html'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { getPapelizSafeFileNameStem } from '../workspace/papeliz-export-file-save'
import type { PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import {
  buildPapelizHtmlExportFontFaceCss,
  choosePapelizHtmlExportFontFaces,
  encodePapelizBytesAsBase64,
  readPapelizHtmlExportFontFileBytes,
  type PapelizHtmlExportFontFileReader,
} from './papeliz-html-export-fonts'
import { buildPapelizHtmlExportNoteArticle, getPapelizHtmlExportNoteLanguageTag, type PapelizHtmlExportMermaidDiagramDrawer } from './papeliz-html-export-note-article'
import { buildPapelizHtmlExportNoteStylesheet } from './papeliz-html-export-note-stylesheet'
import papelizHtmlExportOneNotePageStylesheetText from './papeliz-html-export-one-note-page.css?raw'
import { createPapelizHtmlExportVaultFileResolver, getPapelizHtmlExportPictureMediaType } from './papeliz-html-export-vault-files'

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
  readHtmlExportFontFileBytes?: PapelizHtmlExportFontFileReader
  // The vault's files that aren't notes: a picture the note shows goes inside the page.
  htmlExportVaultAttachmentFileRelativePaths: readonly string[]
  readHtmlExportVaultFileBytes: PapelizHtmlExportVaultFileReader
}

export type PapelizHtmlExportVaultFileReader = (vaultFileRelativePath: string) => Promise<Uint8Array>

export interface PapelizHtmlExportFile {
  htmlExportFileName: string
  htmlExportFileText: string
}

// Kept here too for the website export, which takes it from this file.
export { getPapelizSafeFileNameStem }

// "Projects/Launch plan.md" -> "Launch plan.html"
export function getPapelizHtmlExportFileNameForNote(vaultNoteRelativePath: string): string {
  return `${getPapelizSafeFileNameStem(getVaultNoteTitle(vaultNoteRelativePath), 'Note')}.html`
}

function createHastElement(tagName: string, properties: HastElement['properties'], children: HastElementContent[]): HastElement {
  return { type: 'element', tagName, properties, children }
}

export async function buildPapelizOneNoteHtmlExportFile(oneNoteExportOptions: PapelizOneNoteHtmlExportOptions): Promise<PapelizHtmlExportFile> {
  const { noteArticleHastElement, noteFrontmatterProperties, hasCodeText } = await buildPapelizHtmlExportNoteArticle({
    vaultNoteRelativePath: oneNoteExportOptions.vaultNoteRelativePath,
    vaultNoteText: oneNoteExportOptions.vaultNoteText,
    resolveWikilinkTarget: oneNoteExportOptions.resolveWikilinkTarget,
    // A one-note file has no other pages: links to other notes read as text.
    getHtmlExportNotePageHref: () => null,
    drawHtmlExportMermaidDiagramSvg: oneNoteExportOptions.drawHtmlExportMermaidDiagramSvg,
    // Pictures go inside the page as `data:` URLs. A link to a file can't come along: browsers don't
    // open a `data:` link as a page, so it reads as text.
    htmlExportVaultFiles: {
      resolveVaultFileReference: createPapelizHtmlExportVaultFileResolver(oneNoteExportOptions.htmlExportVaultAttachmentFileRelativePaths),
      getVaultFileSource: async (vaultFileRelativePath, vaultFileUse) => {
        const pictureMediaType = getPapelizHtmlExportPictureMediaType(vaultFileRelativePath)
        if (vaultFileUse !== 'shown' || pictureMediaType === null) return null
        try {
          return `data:${pictureMediaType};base64,${encodePapelizBytesAsBase64(await oneNoteExportOptions.readHtmlExportVaultFileBytes(vaultFileRelativePath))}`
        } catch {
          return null
        }
      },
    },
  })

  const readHtmlExportFontFileBytes = oneNoteExportOptions.readHtmlExportFontFileBytes ?? readPapelizHtmlExportFontFileBytes
  const htmlExportFontFaces = choosePapelizHtmlExportFontFaces(oneNoteExportOptions.htmlExportNoteTypography.noteFontFamily, { hasCodeText, hasSiteChrome: false })
  const fontFileDataUrlsByFileName = new Map<string, string>()
  for (const htmlExportFontFace of htmlExportFontFaces) {
    const fontFileBytes = await readHtmlExportFontFileBytes(htmlExportFontFace.fontFileUrl)
    fontFileDataUrlsByFileName.set(htmlExportFontFace.fontFileName, `data:font/woff2;base64,${encodePapelizBytesAsBase64(fontFileBytes)}`)
  }
  const pageStylesheetText = [
    buildPapelizHtmlExportNoteStylesheet({
      htmlExportThemeChoice: 'follow-device',
      htmlExportNoteTypography: oneNoteExportOptions.htmlExportNoteTypography,
      fontFaceCss: buildPapelizHtmlExportFontFaceCss(htmlExportFontFaces, (htmlExportFontFace) => fontFileDataUrlsByFileName.get(htmlExportFontFace.fontFileName) ?? ''),
    }),
    papelizHtmlExportOneNotePageStylesheetText.trim(),
  ].join('\n\n')

  const htmlExportDocument: HastRoot = {
    type: 'root',
    children: [
      { type: 'doctype' },
      createHastElement('html', { lang: getPapelizHtmlExportNoteLanguageTag(noteFrontmatterProperties) }, [
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
