import type { PapelizFontkitFont } from 'fontkit'
import type PDFDocument from 'pdfkit'
import { papelizPdfExportOpenTypeFeaturesBySet, type PapelizPdfExportOpenTypeFeatureSet } from './papeliz-pdf-export-page-layout-plan'

// Measures text with the very font objects the writer draws with: pdfkit's own, registered under
// each face's key. A measured line therefore always fits as drawn. fontkit opens the same files for
// what pdfkit doesn't say: the font's vertical metrics, which characters it has, and the glyphs a
// piece of text shapes into.

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
}

export function createPapelizPdfExportTextMeasurer(pdfKitDocument: PDFDocument, fontkitFontsByFaceKey: ReadonlyMap<string, PapelizFontkitFont>): PapelizPdfExportTextMeasurer {
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
  }
}
