import { isPapelizPdfExportColorEmoji, type PapelizPdfExportCharacterPictureRequest } from './papeliz-pdf-export-character-pictures'

// Fonts on the computer, for the characters no bundled font has (CJK, Thai, Arabic, Hebrew and the
// like). In Chrome and Edge the Local Font Access API (`queryLocalFonts`) lists them; Papeliz asks
// only when a note has such characters, after the Export page says what the fonts are for, and reads
// only the families that script needs. The bytes go to the PDF worker, which opens each font with
// fontkit, checks it (its `fsType` must allow embedding, and its glyphs must read), and puts in the PDF
// only the glyphs the note uses. Nothing leaves the computer. A font that is missing or refused leaves
// those characters to their pictures.

// The parts of the API's FontData that Papeliz reads.
export interface PapelizPdfExportLocalFontData {
  family: string
  style: string
  postscriptName: string
  blob(): Promise<Blob>
}

export interface PapelizPdfExportComputerFontSource {
  // The computer's fonts, or null when Papeliz may not use them. Asked at most once per export.
  listComputerFonts(pdfExportNoteName: string): Promise<readonly PapelizPdfExportLocalFontData[] | null>
}

// Asks the person on the Export page; resolves to the fonts when they allow it (the page itself calls
// `queryLocalFonts`, since the browser asks only right after a click), or null.
export type PapelizPdfExportComputerFontsAsker = (pdfExportNoteName: string) => Promise<readonly PapelizPdfExportLocalFontData[] | null>

// The scripts Papeliz looks for a computer font for, as `computerFontScriptName`.
export type PapelizPdfExportComputerFontScriptName =
  | 'japanese'
  | 'korean'
  | 'chinese'
  | 'thai'
  | 'lao'
  | 'khmer'
  | 'myanmar'
  | 'arabic'
  | 'hebrew'
  | 'indic'
  | 'armenian-georgian'
  | 'ethiopic'
  | 'syriac'
  | 'thaana'
  | 'tibetan'
  | 'mongolian'
  | 'symbols'

// One face of a computer font in a note's PDF job.
export interface PapelizPdfExportComputerFontFile {
  computerFontFaceKey: string
  // The family's place in the order characters try them.
  computerFontFamilyIndex: number
  computerFontFamilyName: string
  // The script it was chosen for: kana, Hangul and Han try their own script's family first.
  computerFontScriptName: PapelizPdfExportComputerFontScriptName
  // Its name inside a font collection (`.ttc`), which holds several faces in one file.
  computerFontPostscriptName: string
  computerFontWeight: 400 | 700
  isComputerFontItalic: boolean
  fontFileBytes: Uint8Array
}

type PapelizLocalFontsQuery = () => Promise<readonly PapelizPdfExportLocalFontData[]>

export function getPapelizPdfExportLocalFontsQuery(): PapelizLocalFontsQuery | null {
  const pageWithLocalFonts = globalThis as typeof globalThis & { queryLocalFonts?: PapelizLocalFontsQuery }
  return typeof pageWithLocalFonts.queryLocalFonts === 'function' ? () => (pageWithLocalFonts.queryLocalFonts as PapelizLocalFontsQuery)() : null
}

// The browser's fonts: none without the API or when the person said no; without asking when they
// already allowed it; otherwise the Export page asks.
export function createPapelizPdfExportBrowserComputerFontSource(askComputerFonts: PapelizPdfExportComputerFontsAsker | null): PapelizPdfExportComputerFontSource {
  let listedComputerFonts: Promise<readonly PapelizPdfExportLocalFontData[] | null> | null = null
  const listComputerFontsOnce = async (pdfExportNoteName: string): Promise<readonly PapelizPdfExportLocalFontData[] | null> => {
    const queryLocalFonts = getPapelizPdfExportLocalFontsQuery()
    if (queryLocalFonts === null) return null
    let localFontsPermissionState: PermissionState = 'prompt'
    try {
      localFontsPermissionState = (await navigator.permissions.query({ name: 'local-fonts' as PermissionName })).state
    } catch {
      // A browser that can't say asks as for 'prompt'.
    }
    if (localFontsPermissionState === 'denied') return null
    if (localFontsPermissionState === 'granted') {
      try {
        return await queryLocalFonts()
      } catch {
        return null
      }
    }
    return askComputerFonts === null ? null : askComputerFonts(pdfExportNoteName)
  }
  return {
    listComputerFonts(pdfExportNoteName) {
      listedComputerFonts ??= listComputerFontsOnce(pdfExportNoteName)
      return listedComputerFonts
    },
  }
}

interface PapelizPdfExportComputerFontScript {
  computerFontScriptName: PapelizPdfExportComputerFontScriptName
  scriptPattern: RegExp
  // Families that draw it well on Windows, macOS and Linux, the first one present used.
  computerFontFamilyNames: readonly string[]
}

const papelizPdfExportComputerFontScripts: readonly PapelizPdfExportComputerFontScript[] = [
  {
    computerFontScriptName: 'japanese',
    scriptPattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
    computerFontFamilyNames: ['Yu Gothic', 'Meiryo', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Noto Sans JP', 'Source Han Sans JP', 'MS Gothic'],
  },
  { computerFontScriptName: 'korean', scriptPattern: /\p{Script=Hangul}/u, computerFontFamilyNames: ['Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Source Han Sans KR', 'Gulim'] },
  {
    computerFontScriptName: 'chinese',
    // Han, Bopomofo, CJK punctuation (U+3000 to U+303F) and full-width forms (U+FF00 to U+FFEF).
    scriptPattern: /[\p{Script=Han}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]/u,
    computerFontFamilyNames: ['Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', 'Hiragino Sans GB', 'SimSun', 'Microsoft JhengHei', 'PingFang TC'],
  },
  { computerFontScriptName: 'thai', scriptPattern: /\p{Script=Thai}/u, computerFontFamilyNames: ['Leelawadee UI', 'Leelawadee', 'Thonburi', 'Noto Sans Thai', 'Tahoma'] },
  { computerFontScriptName: 'lao', scriptPattern: /\p{Script=Lao}/u, computerFontFamilyNames: ['Lao UI', 'Leelawadee UI', 'Lao Sangam MN', 'Noto Sans Lao'] },
  { computerFontScriptName: 'khmer', scriptPattern: /\p{Script=Khmer}/u, computerFontFamilyNames: ['Khmer UI', 'Leelawadee UI', 'Khmer Sangam MN', 'Noto Sans Khmer'] },
  { computerFontScriptName: 'myanmar', scriptPattern: /\p{Script=Myanmar}/u, computerFontFamilyNames: ['Myanmar Text', 'Myanmar Sangam MN', 'Noto Sans Myanmar'] },
  { computerFontScriptName: 'arabic', scriptPattern: /\p{Script=Arabic}/u, computerFontFamilyNames: ['Segoe UI', 'Arial', 'Geeza Pro', 'Noto Sans Arabic', 'Tahoma'] },
  { computerFontScriptName: 'hebrew', scriptPattern: /\p{Script=Hebrew}/u, computerFontFamilyNames: ['Segoe UI', 'Arial', 'Arial Hebrew', 'Noto Sans Hebrew', 'Tahoma'] },
  {
    computerFontScriptName: 'indic',
    scriptPattern:
      /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}]/u,
    computerFontFamilyNames: ['Nirmala UI', 'Kohinoor Devanagari', 'Noto Sans Devanagari', 'Mangal'],
  },
  { computerFontScriptName: 'armenian-georgian', scriptPattern: /[\p{Script=Armenian}\p{Script=Georgian}]/u, computerFontFamilyNames: ['Segoe UI', 'Sylfaen', 'Noto Sans Armenian', 'Noto Sans Georgian'] },
  { computerFontScriptName: 'ethiopic', scriptPattern: /\p{Script=Ethiopic}/u, computerFontFamilyNames: ['Ebrima', 'Kefa', 'Noto Sans Ethiopic'] },
  { computerFontScriptName: 'syriac', scriptPattern: /\p{Script=Syriac}/u, computerFontFamilyNames: ['Segoe UI Historic', 'Estrangelo Edessa', 'Noto Sans Syriac'] },
  { computerFontScriptName: 'thaana', scriptPattern: /\p{Script=Thaana}/u, computerFontFamilyNames: ['MV Boli', 'Noto Sans Thaana'] },
  { computerFontScriptName: 'tibetan', scriptPattern: /\p{Script=Tibetan}/u, computerFontFamilyNames: ['Microsoft Himalaya', 'Kailasa', 'Noto Serif Tibetan'] },
  { computerFontScriptName: 'mongolian', scriptPattern: /\p{Script=Mongolian}/u, computerFontFamilyNames: ['Mongolian Baiti', 'Noto Sans Mongolian'] },
  // Everything else: symbols, arrows, math and the rarer scripts.
  {
    computerFontScriptName: 'symbols',
    scriptPattern: /[^]/u,
    computerFontFamilyNames: ['Segoe UI Symbol', 'Segoe UI Historic', 'Cambria Math', 'Arial Unicode MS', 'Apple Symbols', 'Noto Sans Symbols 2', 'Noto Sans Math', 'DejaVu Sans'],
  },
]

// A font file larger than this is left out, and so is any after the export has read this much.
const papelizPdfExportLargestComputerFontFileByteCount = 64 * 1024 * 1024
const papelizPdfExportLargestComputerFontByteCountPerExport = 256 * 1024 * 1024

interface PapelizPdfExportComputerFontStyle {
  computerFontWeight: 400 | 700
  isComputerFontItalic: boolean
}

// "Bold Italic" -> 700, italic; "Regular" -> 400, upright. Other weights (Light, Semibold) aren't used.
function readComputerFontStyle(localFontStyle: string): PapelizPdfExportComputerFontStyle | null {
  const localFontStyleWords = localFontStyle.trim().toLowerCase()
  const styleMatch = /^(regular|normal|book|roman|bold)?\s*(italic|oblique)?$/.exec(localFontStyleWords)
  if (styleMatch === null || localFontStyleWords === '') return null
  return { computerFontWeight: styleMatch[1] === 'bold' ? 700 : 400, isComputerFontItalic: styleMatch[2] !== undefined }
}

export interface PapelizPdfExportComputerFontReading {
  // Each face's bytes, read once per export.
  fontFileBytesByPostscriptName: Map<string, Uint8Array | null>
  readByteCount: number
}

export function createPapelizPdfExportComputerFontReading(): PapelizPdfExportComputerFontReading {
  return { fontFileBytesByPostscriptName: new Map(), readByteCount: 0 }
}

async function readComputerFontBytes(localFontData: PapelizPdfExportLocalFontData, computerFontReading: PapelizPdfExportComputerFontReading): Promise<Uint8Array | null> {
  const knownFontFileBytes = computerFontReading.fontFileBytesByPostscriptName.get(localFontData.postscriptName)
  if (knownFontFileBytes !== undefined) return knownFontFileBytes
  let fontFileBytes: Uint8Array | null = null
  try {
    const fontFileBlob = await localFontData.blob()
    const isWithinLimits =
      fontFileBlob.size <= papelizPdfExportLargestComputerFontFileByteCount && computerFontReading.readByteCount + fontFileBlob.size <= papelizPdfExportLargestComputerFontByteCountPerExport
    if (isWithinLimits) {
      fontFileBytes = new Uint8Array(await fontFileBlob.arrayBuffer())
      computerFontReading.readByteCount += fontFileBytes.byteLength
    }
  } catch {
    fontFileBytes = null
  }
  computerFontReading.fontFileBytesByPostscriptName.set(localFontData.postscriptName, fontFileBytes)
  return fontFileBytes
}

// The text the computer's fonts could draw: every picture request but color emoji.
export function listPapelizPdfExportComputerFontRequests(characterPictureRequests: readonly PapelizPdfExportCharacterPictureRequest[]): PapelizPdfExportCharacterPictureRequest[] {
  return characterPictureRequests.filter((characterPictureRequest) => !isPapelizPdfExportColorEmoji(characterPictureRequest.pictureCharactersText))
}

// The faces a note's PDF gets: for each script its text needs, the first family on the computer that
// is made for it, in the upright face and in the bold, italic and bold italic ones the text uses
// (when the family has them; the worker slants or thickens the upright face otherwise).
export async function choosePapelizPdfExportComputerFontFiles(
  computerFontRequests: readonly PapelizPdfExportCharacterPictureRequest[],
  localFonts: readonly PapelizPdfExportLocalFontData[],
  computerFontReading: PapelizPdfExportComputerFontReading,
): Promise<PapelizPdfExportComputerFontFile[]> {
  const localFontsByFamily = new Map<string, PapelizPdfExportLocalFontData[]>()
  for (const localFontData of localFonts) {
    const familyKey = localFontData.family.trim().toLowerCase()
    localFontsByFamily.set(familyKey, [...(localFontsByFamily.get(familyKey) ?? []), localFontData])
  }
  const chosenFamilies: Array<{ computerFontFamilyName: string; computerFontScriptName: PapelizPdfExportComputerFontScriptName }> = []
  for (const { computerFontScriptName, scriptPattern, computerFontFamilyNames } of papelizPdfExportComputerFontScripts) {
    if (!computerFontRequests.some((computerFontRequest) => scriptPattern.test(computerFontRequest.pictureCharactersText))) continue
    const presentFamilyName = computerFontFamilyNames.find((computerFontFamilyName) => localFontsByFamily.has(computerFontFamilyName.toLowerCase()))
    if (presentFamilyName !== undefined && !chosenFamilies.some((chosenFamily) => chosenFamily.computerFontFamilyName === presentFamilyName)) {
      chosenFamilies.push({ computerFontFamilyName: presentFamilyName, computerFontScriptName })
    }
  }
  const wantedStyles: PapelizPdfExportComputerFontStyle[] = [{ computerFontWeight: 400, isComputerFontItalic: false }]
  for (const { fontStyle } of computerFontRequests) {
    const wantedStyle: PapelizPdfExportComputerFontStyle = { computerFontWeight: fontStyle.fontWeight >= 600 ? 700 : 400, isComputerFontItalic: fontStyle.isFontItalic }
    if (!wantedStyles.some((knownStyle) => knownStyle.computerFontWeight === wantedStyle.computerFontWeight && knownStyle.isComputerFontItalic === wantedStyle.isComputerFontItalic)) {
      wantedStyles.push(wantedStyle)
    }
  }
  const computerFontFiles: PapelizPdfExportComputerFontFile[] = []
  for (const { computerFontFamilyName, computerFontScriptName } of chosenFamilies) {
    const familyFaces = (localFontsByFamily.get(computerFontFamilyName.toLowerCase()) ?? []).flatMap((localFontData) => {
      const computerFontStyle = readComputerFontStyle(localFontData.style)
      return computerFontStyle === null ? [] : [{ localFontData, ...computerFontStyle }]
    })
    const computerFontFamilyIndex = new Set(computerFontFiles.map((computerFontFile) => computerFontFile.computerFontFamilyIndex)).size
    for (const { computerFontWeight, isComputerFontItalic } of wantedStyles) {
      const familyFace = familyFaces.find((candidateFace) => candidateFace.computerFontWeight === computerFontWeight && candidateFace.isComputerFontItalic === isComputerFontItalic)
      if (familyFace === undefined) continue
      const fontFileBytes = await readComputerFontBytes(familyFace.localFontData, computerFontReading)
      if (fontFileBytes === null) continue
      computerFontFiles.push({
        computerFontFaceKey: `computer-font-${computerFontFamilyIndex}-${computerFontWeight}-${isComputerFontItalic ? 'italic' : 'normal'}`,
        computerFontFamilyIndex,
        computerFontFamilyName,
        computerFontScriptName,
        computerFontPostscriptName: familyFace.localFontData.postscriptName,
        computerFontWeight,
        isComputerFontItalic,
        fontFileBytes,
      })
    }
  }
  return computerFontFiles
}
