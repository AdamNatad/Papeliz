import type { PapelizFontkitFont } from 'fontkit'
import type PDFDocument from 'pdfkit'
import { getPapelizPdfExportCharacterPictureKey, isPapelizPdfExportColorEmoji, type PapelizPdfExportCharacterPicture } from './papeliz-pdf-export-character-pictures'
import type { PapelizPdfExportComputerFontScriptName } from './papeliz-pdf-export-computer-fonts'
import { splitPapelizPdfExportTextByBundledFontFile, type PapelizPdfExportFontStyle } from './papeliz-pdf-export-fonts'
import { papelizPdfExportOpenTypeFeaturesBySet, type PapelizPdfExportOpenTypeFeatureSet } from './papeliz-pdf-export-page-layout-plan'

// Measures text with the very font objects the writer draws with: pdfkit's own, registered under
// each face's key. A measured line therefore always fits as drawn. fontkit opens the same files for
// what pdfkit doesn't say: the font's vertical metrics, which characters it has, and the glyphs a
// piece of text shapes into. It also says which face draws each character: a bundled file, else the
// first computer font that has it, else none (a picture, or a box).

// A face of a computer font the worker opened and may embed.
export interface PapelizPdfExportComputerFontFace {
  fontFaceKey: string
  computerFontFamilyIndex: number
  computerFontScriptName: PapelizPdfExportComputerFontScriptName
  computerFontWeight: 400 | 700
  isComputerFontItalic: boolean
}

// A piece of text in one face. A computer font without the italic or bold the text asks for draws it
// in its upright face, slanted or thickened as browsers do.
export interface PapelizPdfExportFontPiece {
  fontPieceText: string
  // null: no font has it.
  fontFaceKey: string | null
  isFontPieceSlanted: boolean
  isFontPieceThickened: boolean
}

export interface PapelizPdfExportFontFaceMetrics {
  // Above and below the baseline, in ems, as browsers set a line.
  ascentEm: number
  descentEm: number
  // Below the baseline for an underline, above it for a strike, in ems.
  underlineOffsetEm: number
  underlineThicknessEm: number
  strikeOffsetEm: number
  strikeThicknessEm: number
}

export interface PapelizPdfExportTextMeasurer {
  getFontFaceMetrics(fontFaceKey: string): PapelizPdfExportFontFaceMetrics
  // With the wanted feature set, or ligatures off where chooseOpenTypeFeatureSet turns them off.
  measureTextWidthPoints(textToMeasure: string, fontFaceKey: string, textSizePoints: number, characterSpacingPoints: number, wantedOpenTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet): number
  // The feature set the text is drawn with: the wanted one, unless the font's own tables shape it into
  // glyphs the file doesn't hold (JetBrains Mono's `latin` file does this with its code ligatures),
  // then ligatures off.
  chooseOpenTypeFeatureSet(textToShape: string, fontFaceKey: string, wantedOpenTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet): PapelizPdfExportOpenTypeFeatureSet
  // Characters the face has no glyph for, which print as its empty box.
  countMissingCharacters(textToCheck: string, fontFaceKey: string): number
  // The picture of a character no font has, drawn in this color and face; null without one.
  getCharacterPicture(pictureCharactersText: string, textColor: string, fontStyle: PapelizPdfExportFontStyle): PapelizPdfExportCharacterPicture | null
  // The text in pieces, each in the face that draws it; neighbours in the same face joined.
  splitTextIntoFontPieces(textToSplit: string, fontStyle: PapelizPdfExportFontStyle): PapelizPdfExportFontPiece[]
  // Whether the face has layout tables, so fontkit shapes its text and turns right-to-left glyphs
  // into display order itself.
  hasFontLayoutTables(fontFaceKey: string): boolean
}

const papelizPdfExportMeasuringGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Joiners and variation selectors a font may lack without harm.
const papelizPdfExportIgnorableCharacterPattern = /[\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/u

export function createPapelizPdfExportTextMeasurer(
  pdfKitDocument: PDFDocument,
  fontkitFontsByFaceKey: ReadonlyMap<string, PapelizFontkitFont>,
  characterPicturesByKey: ReadonlyMap<string, PapelizPdfExportCharacterPicture> = new Map(),
  computerFontFaces: readonly PapelizPdfExportComputerFontFace[] = [],
  // The note's language, which says whether its Han characters are Japanese, Korean or Chinese.
  noteLanguageTag = '',
): PapelizPdfExportTextMeasurer {
  const computerFontFamilyIndexes = [...new Set(computerFontFaces.map((computerFontFace) => computerFontFace.computerFontFamilyIndex))].sort(
    (firstFamilyIndex, secondFamilyIndex) => firstFamilyIndex - secondFamilyIndex,
  )
  const noteLanguage = noteLanguageTag.toLowerCase().split('-')[0] ?? ''
  const hanScriptName: PapelizPdfExportComputerFontScriptName = noteLanguage === 'ja' ? 'japanese' : noteLanguage === 'ko' ? 'korean' : 'chinese'
  // As browsers choose a fallback font by a character's script: kana in a Japanese face, Hangul in a
  // Korean one, Han in the note language's one (Chinese unless the note says Japanese or Korean).
  const getPreferredScriptName = (graphemeText: string): PapelizPdfExportComputerFontScriptName | null => {
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(graphemeText)) return 'japanese'
    if (/\p{Script=Hangul}/u.test(graphemeText)) return 'korean'
    if (/[\p{Script=Han}\p{Script=Bopomofo}]/u.test(graphemeText)) return hanScriptName
    return null
  }
  const computerFontPiecesByGraphemeKey = new Map<string, Omit<PapelizPdfExportFontPiece, 'fontPieceText'> | null>()
  const textWidthsByMeasureKey = new Map<string, number>()
  const featureSetsByShapeKey = new Map<string, PapelizPdfExportOpenTypeFeatureSet>()
  const fontFaceMetricsByKey = new Map<string, PapelizPdfExportFontFaceMetrics>()
  const getFontkitFont = (fontFaceKey: string): PapelizFontkitFont => {
    const fontkitFont = fontkitFontsByFaceKey.get(fontFaceKey)
    if (fontkitFont === undefined) throw new Error(`The font ${fontFaceKey} isn't registered.`)
    return fontkitFont
  }
  // fontkit throws while placing a glyph the file doesn't hold, so a throw counts as missing too.
  const shapesIntoMissingGlyphs = (textToShape: string, fontFaceKey: string, openTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet): boolean => {
    const fontkitFont = getFontkitFont(fontFaceKey)
    try {
      return fontkitFont.layout(textToShape, papelizPdfExportOpenTypeFeaturesBySet[openTypeFeatureSet]).glyphs.some((fontkitGlyph) => fontkitGlyph.id >= fontkitFont.numGlyphs)
    } catch {
      return true
    }
  }
  const chooseOpenTypeFeatureSet = (textToShape: string, fontFaceKey: string, wantedOpenTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet): PapelizPdfExportOpenTypeFeatureSet => {
    if (wantedOpenTypeFeatureSet === 'no-ligatures') return 'no-ligatures'
    const shapeKey = `${fontFaceKey}\u0000${textToShape}`
    const knownFeatureSet = featureSetsByShapeKey.get(shapeKey)
    if (knownFeatureSet !== undefined) return knownFeatureSet
    const openTypeFeatureSet = shapesIntoMissingGlyphs(textToShape, fontFaceKey, 'standard') ? 'no-ligatures' : 'standard'
    featureSetsByShapeKey.set(shapeKey, openTypeFeatureSet)
    return openTypeFeatureSet
  }
  return {
    getFontFaceMetrics(fontFaceKey) {
      const knownFontFaceMetrics = fontFaceMetricsByKey.get(fontFaceKey)
      if (knownFontFaceMetrics !== undefined) return knownFontFaceMetrics
      const fontkitFont = getFontkitFont(fontFaceKey)
      const unitsPerEm = fontkitFont.unitsPerEm
      const fontFaceMetrics: PapelizPdfExportFontFaceMetrics = {
        ascentEm: fontkitFont.ascent / unitsPerEm,
        descentEm: Math.abs(fontkitFont.descent) / unitsPerEm,
        underlineOffsetEm: Math.abs(fontkitFont.underlinePosition) / unitsPerEm || 0.1,
        underlineThicknessEm: fontkitFont.underlineThickness / unitsPerEm || 0.06,
        strikeOffsetEm: (fontkitFont['OS/2']?.yStrikeoutPosition ?? 0) / unitsPerEm || 0.3,
        strikeThicknessEm: (fontkitFont['OS/2']?.yStrikeoutSize ?? 0) / unitsPerEm || 0.06,
      }
      fontFaceMetricsByKey.set(fontFaceKey, fontFaceMetrics)
      return fontFaceMetrics
    },
    measureTextWidthPoints(textToMeasure, fontFaceKey, textSizePoints, characterSpacingPoints, wantedOpenTypeFeatureSet) {
      const openTypeFeatureSet = chooseOpenTypeFeatureSet(textToMeasure, fontFaceKey, wantedOpenTypeFeatureSet)
      const measureKey = `${fontFaceKey}\u0000${textSizePoints}\u0000${characterSpacingPoints}\u0000${openTypeFeatureSet}\u0000${textToMeasure}`
      const knownTextWidthPoints = textWidthsByMeasureKey.get(measureKey)
      if (knownTextWidthPoints !== undefined) return knownTextWidthPoints
      const openTypeFeatures = papelizPdfExportOpenTypeFeaturesBySet[openTypeFeatureSet]
      const textWidthPoints = pdfKitDocument
        .font(fontFaceKey)
        .fontSize(textSizePoints)
        .widthOfString(textToMeasure, { characterSpacing: characterSpacingPoints, ...(openTypeFeatures === undefined ? {} : { features: openTypeFeatures }) })
      textWidthsByMeasureKey.set(measureKey, textWidthPoints)
      return textWidthPoints
    },
    chooseOpenTypeFeatureSet,
    countMissingCharacters(textToCheck, fontFaceKey) {
      const fontkitFont = getFontkitFont(fontFaceKey)
      let missingCharacterCount = 0
      for (const textCharacter of textToCheck) {
        const codePoint = textCharacter.codePointAt(0) ?? 0
        // Joiners, variation selectors and marks print as nothing when a font lacks them.
        if (/[\p{Cf}\p{M}]/u.test(textCharacter)) continue
        if (!fontkitFont.hasGlyphForCodePoint(codePoint)) missingCharacterCount += 1
      }
      return missingCharacterCount
    },
    getCharacterPicture(pictureCharactersText, textColor, fontStyle) {
      return characterPicturesByKey.get(getPapelizPdfExportCharacterPictureKey(pictureCharactersText, textColor, fontStyle)) ?? null
    },
    hasFontLayoutTables(fontFaceKey) {
      const fontkitFont = getFontkitFont(fontFaceKey)
      return Boolean(fontkitFont.GSUB ?? fontkitFont.GPOS ?? fontkitFont.morx)
    },
    splitTextIntoFontPieces(textToSplit, fontStyle) {
      const fontPieces: PapelizPdfExportFontPiece[] = []
      const pushFontPiece = (fontPiece: PapelizPdfExportFontPiece) => {
        const lastFontPiece = fontPieces.at(-1)
        const isSameFace =
          lastFontPiece !== undefined &&
          lastFontPiece.fontFaceKey === fontPiece.fontFaceKey &&
          lastFontPiece.isFontPieceSlanted === fontPiece.isFontPieceSlanted &&
          lastFontPiece.isFontPieceThickened === fontPiece.isFontPieceThickened
        if (isSameFace) lastFontPiece.fontPieceText += fontPiece.fontPieceText
        else fontPieces.push(fontPiece)
      }
      for (const { segmentText, fontFaceKey } of splitPapelizPdfExportTextByBundledFontFile(textToSplit, fontStyle)) {
        if (fontFaceKey !== null || computerFontFaces.length === 0) {
          pushFontPiece({ fontPieceText: segmentText, fontFaceKey, isFontPieceSlanted: false, isFontPieceThickened: false })
          continue
        }
        for (const { segment: graphemeText } of papelizPdfExportMeasuringGraphemeSegmenter.segment(segmentText)) {
          const graphemeKey = `${graphemeText}\u0000${fontStyle.fontWeight}\u0000${fontStyle.isFontItalic ? 'italic' : 'normal'}`
          let computerFontPiece = computerFontPiecesByGraphemeKey.get(graphemeKey)
          if (computerFontPiece === undefined) {
            computerFontPiece = chooseComputerFontPiece(graphemeText, fontStyle)
            computerFontPiecesByGraphemeKey.set(graphemeKey, computerFontPiece)
          }
          pushFontPiece({ fontPieceText: graphemeText, ...(computerFontPiece ?? { fontFaceKey: null, isFontPieceSlanted: false, isFontPieceThickened: false }) })
        }
      }
      return fontPieces
    },
  }

  // The first computer font family with every character of the cluster, in the face nearest the
  // text's: bold for 600 and up, italic for italic text. Color emoji stay pictures.
  function chooseComputerFontPiece(graphemeText: string, fontStyle: PapelizPdfExportFontStyle): Omit<PapelizPdfExportFontPiece, 'fontPieceText'> | null {
    if (isPapelizPdfExportColorEmoji(graphemeText)) return null
    const graphemeCodePoints = Array.from(graphemeText)
      .filter((graphemeCharacter) => !papelizPdfExportIgnorableCharacterPattern.test(graphemeCharacter))
      .map((graphemeCharacter) => graphemeCharacter.codePointAt(0) ?? 0)
    if (graphemeCodePoints.length === 0) return null
    const wantsBold = fontStyle.fontWeight >= 600
    const preferredScriptName = getPreferredScriptName(graphemeText)
    const isPreferredFamily = (computerFontFamilyIndex: number) =>
      computerFontFaces.some((computerFontFace) => computerFontFace.computerFontFamilyIndex === computerFontFamilyIndex && computerFontFace.computerFontScriptName === preferredScriptName)
    const familyIndexesInOrder = [...computerFontFamilyIndexes.filter(isPreferredFamily), ...computerFontFamilyIndexes.filter((computerFontFamilyIndex) => !isPreferredFamily(computerFontFamilyIndex))]
    for (const computerFontFamilyIndex of familyIndexesInOrder) {
      const familyFaces = computerFontFaces.filter((computerFontFace) => computerFontFace.computerFontFamilyIndex === computerFontFamilyIndex)
      const familyFace =
        familyFaces.find((candidateFace) => (candidateFace.computerFontWeight === 700) === wantsBold && candidateFace.isComputerFontItalic === fontStyle.isFontItalic) ??
        familyFaces.find((candidateFace) => (candidateFace.computerFontWeight === 700) === wantsBold && !candidateFace.isComputerFontItalic) ??
        familyFaces.find((candidateFace) => candidateFace.computerFontWeight === 400 && candidateFace.isComputerFontItalic === fontStyle.isFontItalic) ??
        familyFaces.find((candidateFace) => candidateFace.computerFontWeight === 400 && !candidateFace.isComputerFontItalic) ??
        familyFaces[0]
      if (familyFace === undefined) continue
      const fontkitFont = fontkitFontsByFaceKey.get(familyFace.fontFaceKey)
      if (fontkitFont === undefined || !graphemeCodePoints.every((codePoint) => fontkitFont.hasGlyphForCodePoint(codePoint))) continue
      // Its glyph ids must be the font's own once shaped, or it isn't used.
      if (shapesIntoMissingGlyphs(graphemeText, familyFace.fontFaceKey, 'standard')) continue
      return {
        fontFaceKey: familyFace.fontFaceKey,
        isFontPieceSlanted: fontStyle.isFontItalic && !familyFace.isComputerFontItalic,
        isFontPieceThickened: wantsBold && familyFace.computerFontWeight !== 700,
      }
    }
    return null
  }
}
