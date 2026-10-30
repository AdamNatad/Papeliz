import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import mammoth from 'mammoth'
import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'

// For the Word export's tests: a `.docx` file's parts as text, read with Papeliz's own zip reader;
// the file as `mammoth`, an independent reader, sees it; and the note's visible text, in order, as
// MD View shows it.

export async function readPapelizDocxExportFileParts(docxExportFileBlob: Blob): Promise<Map<string, string>> {
  const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await docxExportFileBlob.arrayBuffer()))
  const utf8Decoder = new TextDecoder()
  const docxExportFilePartTexts = new Map<string, string>()
  for (const importZipEntry of importZipEntries) {
    if (!importZipEntry.isImportZipEntryFolder) docxExportFilePartTexts.set(importZipEntry.importZipEntryPath, utf8Decoder.decode(await importZipEntry.readImportZipEntryBytes()))
  }
  return docxExportFilePartTexts
}

export interface PapelizDocxExportMammothReading {
  mammothRawText: string
  mammothHtml: string
  mammothErrorMessages: string[]
}

export async function readPapelizDocxExportFileWithMammoth(docxExportFileBlob: Blob): Promise<PapelizDocxExportMammothReading> {
  // mammoth's Node build reads `buffer`, typed as Node's Buffer; its zip reader takes plain bytes.
  const mammothInput = { buffer: new Uint8Array(await docxExportFileBlob.arrayBuffer()) } as unknown as Parameters<typeof mammoth.extractRawText>[0]
  const mammothRawTextResult = await mammoth.extractRawText(mammothInput)
  const mammothHtmlResult = await mammoth.convertToHtml(mammothInput)
  return {
    mammothRawText: mammothRawTextResult.value,
    mammothHtml: mammothHtmlResult.value,
    mammothErrorMessages: [...mammothRawTextResult.messages, ...mammothHtmlResult.messages].filter((mammothMessage) => mammothMessage.type === 'error').map((mammothMessage) => mammothMessage.message),
  }
}

export function normalizePapelizDocxExportWhitespace(docxExportText: string): string {
  return docxExportText.replace(/\s+/g, ' ').trim()
}

function hasHastClassName(hastElement: HastElement, hastClassName: string): boolean {
  const hastClassNames = hastElement.properties['className']
  return Array.isArray(hastClassNames) && hastClassNames.includes(hastClassName)
}

// What MD View's locked page shows of the note, in order, without its footnotes, as the export
// writes it where pictures can't be loaded (tests have no canvas): a web picture is its "Picture: …"
// line and address, any other picture MD View's "Image: …" line, and a diagram its source.
export function collectPapelizDocxExportExpectedText(vaultNoteRelativePath: string, vaultNoteText: string, resolveWikilinkTarget: PapelizWikilinkTargetResolver): string {
  const { noteFrontmatterText, noteHastRoot } = renderPapelizMdViewNote(vaultNoteText, { resolveWikilinkTarget, fromVaultNoteRelativePath: vaultNoteRelativePath })
  const expectedTextParts: string[] = []
  for (const noteFrontmatterProperty of noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(noteFrontmatterText)) {
    expectedTextParts.push(` ${noteFrontmatterProperty.frontmatterPropertyName} ${noteFrontmatterProperty.frontmatterPropertyValues.join(', ')} `)
  }
  const collectExpectedText = (hastNode: HastElementContent | HastRoot) => {
    if (hastNode.type === 'text') {
      expectedTextParts.push(hastNode.value)
      return
    }
    if (hastNode.type !== 'element' && hastNode.type !== 'root') return
    if (hastNode.type === 'element') {
      if (hastNode.tagName === 'input') {
        expectedTextParts.push(hastNode.properties['checked'] === true ? '☑ ' : '☐ ')
        return
      }
      if (hastNode.tagName === 'img') {
        const pictureAltText = hastNode.properties['alt']
        const pictureSource = hastNode.properties['src']
        if (typeof pictureSource === 'string' && /^https:/i.test(pictureSource)) {
          expectedTextParts.push(`Picture: ${typeof pictureAltText === 'string' ? pictureAltText : ''} ${pictureSource}`)
          return
        }
        expectedTextParts.push(`Image: ${(typeof pictureAltText === 'string' && pictureAltText) || (typeof pictureSource === 'string' && pictureSource) || 'untitled'}`)
        return
      }
      if (hasHastClassName(hastNode, 'sr-only') || hastNode.properties['dataFootnoteBackref'] !== undefined) return
      // A footnote's reference is a mark Word draws, and its text is a Word footnote, which
      // mammoth's text leaves out.
      if (hastNode.properties['dataFootnoteRef'] !== undefined || hastNode.properties['dataFootnotes'] !== undefined) return
      if (hastNode.tagName === 'td' || hastNode.tagName === 'th') expectedTextParts.push(' ')
    }
    for (const hastChild of hastNode.children) collectExpectedText(hastChild as HastElementContent)
  }
  collectExpectedText(noteHastRoot)
  if (vaultNoteText.trim().length === 0) expectedTextParts.push(' This note is empty.')
  return normalizePapelizDocxExportWhitespace(expectedTextParts.join(''))
}
