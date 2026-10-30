import charisSilLatin400NormalWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-400-normal.woff?url'
import charisSilLatin400ItalicWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-400-italic.woff?url'
import charisSilLatin700NormalWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-700-normal.woff?url'
import charisSilLatin700ItalicWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-700-italic.woff?url'
import charisSilLatinExtended400NormalWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-400-normal.woff?url'
import charisSilLatinExtended400ItalicWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-400-italic.woff?url'
import charisSilLatinExtended700NormalWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-700-normal.woff?url'
import charisSilLatinExtended700ItalicWoffUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-700-italic.woff?url'
import figtreeLatin400NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-400-normal.woff?url'
import figtreeLatin400ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-400-italic.woff?url'
import figtreeLatin500NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-500-normal.woff?url'
import figtreeLatin500ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-500-italic.woff?url'
import figtreeLatin600NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import figtreeLatin600ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-600-italic.woff?url'
import figtreeLatinExtended400NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-400-normal.woff?url'
import figtreeLatinExtended400ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-400-italic.woff?url'
import figtreeLatinExtended500NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-500-normal.woff?url'
import figtreeLatinExtended500ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-500-italic.woff?url'
import figtreeLatinExtended600NormalWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-600-normal.woff?url'
import figtreeLatinExtended600ItalicWoffUrl from '@fontsource/figtree/files/figtree-latin-ext-600-italic.woff?url'
import jetBrainsMonoLatin400NormalWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?url'
import jetBrainsMonoLatin400ItalicWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff?url'
import jetBrainsMonoLatin700NormalWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?url'
import jetBrainsMonoLatin700ItalicWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-italic.woff?url'
import jetBrainsMonoLatinExtended400NormalWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff?url'
import jetBrainsMonoLatinExtended400ItalicWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-italic.woff?url'
import jetBrainsMonoLatinExtended700NormalWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-normal.woff?url'
import jetBrainsMonoLatinExtended700ItalicWoffUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-italic.woff?url'
import { readPapelizHtmlExportFontFileBytes } from '../html-export/papeliz-html-export-fonts'

// The font files the PDF embeds: the `.woff` files @fontsource ships beside the `.woff2` ones the app's
// CSS loads (Charis SIL, for Serif notes, only here). fontkit 2.0.4 can't subset these families' WOFF2
// files, and reads every WOFF file. Each is read only when a note needs it, once per export.

const papelizPdfExportFontFileUrlsByFaceKey: Readonly<Record<string, string>> = {
  'charis-sil-latin-400-normal': charisSilLatin400NormalWoffUrl,
  'charis-sil-latin-400-italic': charisSilLatin400ItalicWoffUrl,
  'charis-sil-latin-700-normal': charisSilLatin700NormalWoffUrl,
  'charis-sil-latin-700-italic': charisSilLatin700ItalicWoffUrl,
  'charis-sil-latin-ext-400-normal': charisSilLatinExtended400NormalWoffUrl,
  'charis-sil-latin-ext-400-italic': charisSilLatinExtended400ItalicWoffUrl,
  'charis-sil-latin-ext-700-normal': charisSilLatinExtended700NormalWoffUrl,
  'charis-sil-latin-ext-700-italic': charisSilLatinExtended700ItalicWoffUrl,
  'figtree-latin-400-normal': figtreeLatin400NormalWoffUrl,
  'figtree-latin-400-italic': figtreeLatin400ItalicWoffUrl,
  'figtree-latin-500-normal': figtreeLatin500NormalWoffUrl,
  'figtree-latin-500-italic': figtreeLatin500ItalicWoffUrl,
  'figtree-latin-600-normal': figtreeLatin600NormalWoffUrl,
  'figtree-latin-600-italic': figtreeLatin600ItalicWoffUrl,
  'figtree-latin-ext-400-normal': figtreeLatinExtended400NormalWoffUrl,
  'figtree-latin-ext-400-italic': figtreeLatinExtended400ItalicWoffUrl,
  'figtree-latin-ext-500-normal': figtreeLatinExtended500NormalWoffUrl,
  'figtree-latin-ext-500-italic': figtreeLatinExtended500ItalicWoffUrl,
  'figtree-latin-ext-600-normal': figtreeLatinExtended600NormalWoffUrl,
  'figtree-latin-ext-600-italic': figtreeLatinExtended600ItalicWoffUrl,
  'jetbrains-mono-latin-400-normal': jetBrainsMonoLatin400NormalWoffUrl,
  'jetbrains-mono-latin-400-italic': jetBrainsMonoLatin400ItalicWoffUrl,
  'jetbrains-mono-latin-700-normal': jetBrainsMonoLatin700NormalWoffUrl,
  'jetbrains-mono-latin-700-italic': jetBrainsMonoLatin700ItalicWoffUrl,
  'jetbrains-mono-latin-ext-400-normal': jetBrainsMonoLatinExtended400NormalWoffUrl,
  'jetbrains-mono-latin-ext-400-italic': jetBrainsMonoLatinExtended400ItalicWoffUrl,
  'jetbrains-mono-latin-ext-700-normal': jetBrainsMonoLatinExtended700NormalWoffUrl,
  'jetbrains-mono-latin-ext-700-italic': jetBrainsMonoLatinExtended700ItalicWoffUrl,
}

export type PapelizPdfExportFontFileReader = (fontFaceKey: string) => Promise<Uint8Array>

export const readPapelizPdfExportFontFile: PapelizPdfExportFontFileReader = async (fontFaceKey) => {
  const fontFileUrl = papelizPdfExportFontFileUrlsByFaceKey[fontFaceKey]
  if (fontFileUrl === undefined) throw new Error(`Papeliz has no font file ${fontFaceKey}.`)
  return readPapelizHtmlExportFontFileBytes(fontFileUrl)
}
