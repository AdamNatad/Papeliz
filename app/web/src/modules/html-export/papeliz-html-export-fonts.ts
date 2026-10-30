import figtreeLatin400NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-400-normal.woff2?url'
import figtreeLatin500NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-500-normal.woff2?url'
import figtreeLatin600NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-600-normal.woff2?url'
import figtreeLatinExtended400NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-ext-400-normal.woff2?url'
import figtreeLatinExtended500NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-ext-500-normal.woff2?url'
import figtreeLatinExtended600NormalFontFileUrl from '@fontsource/figtree/files/figtree-latin-ext-600-normal.woff2?url'
import jetBrainsMonoLatin400NormalFontFileUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url'
import jetBrainsMonoLatin700NormalFontFileUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url'
import jetBrainsMonoLatinExtended400NormalFontFileUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff2?url'
import jetBrainsMonoLatinExtended700NormalFontFileUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-normal.woff2?url'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'

// The app's own typefaces, carried inside an exported page so it reads as MD View does on any
// computer: Figtree for Sans notes, JetBrains Mono for Mono notes and for code. Both are SIL OFL
// 1.1, which allows this. Serif notes use the computer's serif, as MD View does. The browser takes
// each file only for the characters in its range, as with the app's own font files.

export interface PapelizHtmlExportFontFace {
  fontFamilyName: 'Figtree' | 'JetBrains Mono'
  fontWeight: 400 | 500 | 600 | 700
  fontUnicodeRange: string
  fontFileUrl: string
}

// The ranges the font files cover, as their own stylesheets give them.
const papelizLatinFontUnicodeRange =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
const papelizLatinExtendedFontUnicodeRange =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'

function createFontFacePair(
  fontFamilyName: PapelizHtmlExportFontFace['fontFamilyName'],
  fontWeight: PapelizHtmlExportFontFace['fontWeight'],
  latinFontFileUrl: string,
  latinExtendedFontFileUrl: string,
): PapelizHtmlExportFontFace[] {
  return [
    { fontFamilyName, fontWeight, fontUnicodeRange: papelizLatinFontUnicodeRange, fontFileUrl: latinFontFileUrl },
    { fontFamilyName, fontWeight, fontUnicodeRange: papelizLatinExtendedFontUnicodeRange, fontFileUrl: latinExtendedFontFileUrl },
  ]
}

// MD View sets text at 400, links and the first heading at 500, bold and headings at 600.
const papelizFigtreeFontFaces = [
  ...createFontFacePair('Figtree', 400, figtreeLatin400NormalFontFileUrl, figtreeLatinExtended400NormalFontFileUrl),
  ...createFontFacePair('Figtree', 500, figtreeLatin500NormalFontFileUrl, figtreeLatinExtended500NormalFontFileUrl),
  ...createFontFacePair('Figtree', 600, figtreeLatin600NormalFontFileUrl, figtreeLatinExtended600NormalFontFileUrl),
]
const papelizJetBrainsMonoRegularFontFaces = createFontFacePair('JetBrains Mono', 400, jetBrainsMonoLatin400NormalFontFileUrl, jetBrainsMonoLatinExtended400NormalFontFileUrl)
const papelizJetBrainsMonoBoldFontFaces = createFontFacePair('JetBrains Mono', 700, jetBrainsMonoLatin700NormalFontFileUrl, jetBrainsMonoLatinExtended700NormalFontFileUrl)

export function choosePapelizHtmlExportFontFaces(noteFontFamily: PapelizNoteFontFamily, hasCodeText: boolean): PapelizHtmlExportFontFace[] {
  if (noteFontFamily === 'mono') return [...papelizJetBrainsMonoRegularFontFaces, ...papelizJetBrainsMonoBoldFontFaces]
  const noteFontFaces = noteFontFamily === 'sans' ? papelizFigtreeFontFaces : []
  return hasCodeText ? [...noteFontFaces, ...papelizJetBrainsMonoRegularFontFaces] : noteFontFaces
}

export type PapelizHtmlExportFontFileDataUrlReader = (fontFileUrl: string) => Promise<string>

export function encodePapelizBytesAsBase64(fileBytes: Uint8Array): string {
  const base64ChunkByteCount = 0x8000
  let binaryText = ''
  for (let chunkStartIndex = 0; chunkStartIndex < fileBytes.length; chunkStartIndex += base64ChunkByteCount) {
    binaryText += String.fromCharCode(...fileBytes.subarray(chunkStartIndex, chunkStartIndex + base64ChunkByteCount))
  }
  return btoa(binaryText)
}

// In the app: the same font files its own stylesheet loads, so they usually come from the cache.
// The build may already have made a small file a `data:` URL.
export async function readPapelizHtmlExportFontFileDataUrl(fontFileUrl: string): Promise<string> {
  if (fontFileUrl.startsWith('data:')) return fontFileUrl
  const fontFileResponse = await fetch(fontFileUrl)
  if (!fontFileResponse.ok) throw new Error(`The font file ${fontFileUrl} could not be read (${fontFileResponse.status}).`)
  return `data:font/woff2;base64,${encodePapelizBytesAsBase64(new Uint8Array(await fontFileResponse.arrayBuffer()))}`
}

export async function buildPapelizHtmlExportFontFaceCss(
  htmlExportFontFaces: readonly PapelizHtmlExportFontFace[],
  readHtmlExportFontFileDataUrl: PapelizHtmlExportFontFileDataUrlReader,
): Promise<string> {
  const fontFaceRules: string[] = []
  for (const htmlExportFontFace of htmlExportFontFaces) {
    const fontFileDataUrl = await readHtmlExportFontFileDataUrl(htmlExportFontFace.fontFileUrl)
    fontFaceRules.push(
      [
        '@font-face {',
        `  font-family: '${htmlExportFontFace.fontFamilyName}';`,
        '  font-style: normal;',
        '  font-display: swap;',
        `  font-weight: ${htmlExportFontFace.fontWeight};`,
        `  src: url(${fontFileDataUrl}) format('woff2');`,
        `  unicode-range: ${htmlExportFontFace.fontUnicodeRange};`,
        '}',
      ].join('\n'),
    )
  }
  return fontFaceRules.join('\n\n')
}
