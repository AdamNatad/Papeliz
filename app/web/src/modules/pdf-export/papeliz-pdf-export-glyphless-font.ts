// A TrueType font with no outlines, written by Papeliz for the characters that print as pictures
// (emoji, and characters no bundled font has). Each character has an empty glyph and a `cmap` entry
// with its real code point; a cluster of several (👩‍💻, 👍🏽, a flag) or a word drawn as one picture is
// one ligature glyph through the font's `ccmp` feature, so shaping never drops a joiner from it. Each
// glyph is as wide as its picture. pdfkit embeds it like any font, with its map back to the
// characters: the text sits over the pictures, unseen, yet copies, searches and reads aloud as the
// characters themselves.

export interface PapelizPdfExportGlyphlessPictureText {
  pictureCharactersText: string
  // In ems of the text size.
  advanceEm: number
}

export const papelizPdfExportGlyphlessFontPostScriptName = 'PapelizCharacterPictures'
const papelizPdfExportGlyphlessFontUnitsPerEm = 1000
const papelizPdfExportGlyphlessFontAscent = 950
const papelizPdfExportGlyphlessFontDescent = -250

class PapelizFontTableWriter {
  private readonly tableBytes: number[] = []

  uint8(byteValue: number): this {
    this.tableBytes.push(byteValue & 0xff)
    return this
  }

  uint16(shortValue: number): this {
    return this.uint8(shortValue >>> 8).uint8(shortValue)
  }

  int16(shortValue: number): this {
    return this.uint16(shortValue < 0 ? shortValue + 0x10000 : shortValue)
  }

  uint32(longValue: number): this {
    return this.uint16(Math.floor(longValue / 0x10000) & 0xffff).uint16(longValue & 0xffff)
  }

  bytes(byteValues: Iterable<number>): this {
    for (const byteValue of byteValues) this.uint8(byteValue)
    return this
  }

  zeros(zeroCount: number): this {
    for (let zeroIndex = 0; zeroIndex < zeroCount; zeroIndex += 1) this.uint8(0)
    return this
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.tableBytes)
  }
}

function computeTableChecksum(tableBytes: Uint8Array): number {
  let tableChecksum = 0
  for (let byteOffset = 0; byteOffset < tableBytes.length; byteOffset += 4) {
    const longValue = (((tableBytes[byteOffset] ?? 0) << 24) | ((tableBytes[byteOffset + 1] ?? 0) << 16) | ((tableBytes[byteOffset + 2] ?? 0) << 8) | (tableBytes[byteOffset + 3] ?? 0)) >>> 0
    tableChecksum = (tableChecksum + longValue) >>> 0
  }
  return tableChecksum
}

function encodeUtf16BigEndian(nameText: string): number[] {
  const nameBytes: number[] = []
  for (let characterIndex = 0; characterIndex < nameText.length; characterIndex += 1) {
    const codeUnit = nameText.charCodeAt(characterIndex)
    nameBytes.push(codeUnit >>> 8, codeUnit & 0xff)
  }
  return nameBytes
}

function buildNameTable(): Uint8Array {
  const nameRecords: Array<[nameId: number, nameText: string]> = [
    [1, 'Papeliz Character Pictures'],
    [2, 'Regular'],
    [4, 'Papeliz Character Pictures'],
    [6, papelizPdfExportGlyphlessFontPostScriptName],
  ]
  const encodedNames = nameRecords.map(([, nameText]) => encodeUtf16BigEndian(nameText))
  const nameTable = new PapelizFontTableWriter().uint16(0).uint16(nameRecords.length).uint16(6 + 12 * nameRecords.length)
  let stringOffset = 0
  nameRecords.forEach(([nameId], nameRecordIndex) => {
    const encodedName = encodedNames[nameRecordIndex] ?? []
    nameTable.uint16(3).uint16(1).uint16(0x409).uint16(nameId).uint16(encodedName.length).uint16(stringOffset)
    stringOffset += encodedName.length
  })
  for (const encodedName of encodedNames) nameTable.bytes(encodedName)
  return nameTable.toBytes()
}

function toFontUnits(advanceEm: number): number {
  return Math.min(0xffff, Math.max(0, Math.round(advanceEm * papelizPdfExportGlyphlessFontUnitsPerEm)))
}

// A GSUB table with one `ccmp` lookup that joins each cluster's characters into its ligature glyph.
function buildLigatureTable(ligaturesByFirstGlyphId: ReadonlyMap<number, ReadonlyArray<{ componentGlyphIds: number[]; ligatureGlyphId: number }>>): Uint8Array {
  const firstGlyphIds = [...ligaturesByFirstGlyphId.keys()].sort((firstGlyphId, secondGlyphId) => firstGlyphId - secondGlyphId)
  // LigatureSubstFormat1: its header, then its coverage, then each ligature set and its ligatures.
  const ligatureSets = firstGlyphIds.map((firstGlyphId) =>
    [...(ligaturesByFirstGlyphId.get(firstGlyphId) ?? [])].sort((firstLigature, secondLigature) => secondLigature.componentGlyphIds.length - firstLigature.componentGlyphIds.length),
  )
  const subtableHeaderLength = 6 + 2 * firstGlyphIds.length
  const coverageLength = 4 + 2 * firstGlyphIds.length
  const ligatureSetBlocks = ligatureSets.map((ligatureSet) => {
    const ligatureBlocks = ligatureSet.map(({ componentGlyphIds, ligatureGlyphId }) => {
      const ligatureWriter = new PapelizFontTableWriter().uint16(ligatureGlyphId).uint16(componentGlyphIds.length)
      for (const componentGlyphId of componentGlyphIds.slice(1)) ligatureWriter.uint16(componentGlyphId)
      return ligatureWriter.toBytes()
    })
    const ligatureSetWriter = new PapelizFontTableWriter().uint16(ligatureBlocks.length)
    let ligatureOffset = 2 + 2 * ligatureBlocks.length
    for (const ligatureBlock of ligatureBlocks) {
      ligatureSetWriter.uint16(ligatureOffset)
      ligatureOffset += ligatureBlock.length
    }
    for (const ligatureBlock of ligatureBlocks) ligatureSetWriter.bytes(ligatureBlock)
    return ligatureSetWriter.toBytes()
  })
  const subtableWriter = new PapelizFontTableWriter().uint16(1).uint16(subtableHeaderLength).uint16(firstGlyphIds.length)
  let ligatureSetOffset = subtableHeaderLength + coverageLength
  for (const ligatureSetBlock of ligatureSetBlocks) {
    subtableWriter.uint16(ligatureSetOffset)
    ligatureSetOffset += ligatureSetBlock.length
  }
  subtableWriter.uint16(1).uint16(firstGlyphIds.length)
  for (const firstGlyphId of firstGlyphIds) subtableWriter.uint16(firstGlyphId)
  for (const ligatureSetBlock of ligatureSetBlocks) subtableWriter.bytes(ligatureSetBlock)
  const subtableBytes = subtableWriter.toBytes()
  // Header (10), script list (DFLT, 20), feature list (ccmp, 14), lookup list (4), lookup (8), subtable.
  const scriptListOffset = 10
  const featureListOffset = scriptListOffset + 20
  const lookupListOffset = featureListOffset + 14
  return new PapelizFontTableWriter()
    .uint16(1)
    .uint16(0)
    .uint16(scriptListOffset)
    .uint16(featureListOffset)
    .uint16(lookupListOffset)
    // ScriptList: DFLT, its Script at 8, whose default LangSys is at 4 and uses feature 0.
    .uint16(1)
    .bytes([0x44, 0x46, 0x4c, 0x54])
    .uint16(8)
    .uint16(4)
    .uint16(0)
    .uint16(0)
    .uint16(0xffff)
    .uint16(1)
    .uint16(0)
    // FeatureList: ccmp, its Feature at 8, which uses lookup 0.
    .uint16(1)
    .bytes([0x63, 0x63, 0x6d, 0x70])
    .uint16(8)
    .uint16(0)
    .uint16(1)
    .uint16(0)
    // LookupList: one Lookup at 4, of type 4 (ligatures), its subtable at 8.
    .uint16(1)
    .uint16(4)
    .uint16(4)
    .uint16(0)
    .uint16(1)
    .uint16(8)
    .bytes(subtableBytes)
    .toBytes()
}

// The font's bytes. Glyph 0 is `.notdef`; then one glyph per character in code point order; then one
// ligature glyph per cluster or word of several characters.
export function buildPapelizPdfExportGlyphlessFont(glyphlessPictureTexts: readonly PapelizPdfExportGlyphlessPictureText[]): Uint8Array {
  const advanceEmsByCodePoint = new Map<number, number>()
  const clusterAdvanceEmsByText = new Map<string, number>()
  for (const { pictureCharactersText, advanceEm } of glyphlessPictureTexts) {
    const pictureCodePoints = Array.from(pictureCharactersText, (pictureCharacter) => pictureCharacter.codePointAt(0) ?? 0)
    // A character alone is as wide as its picture; inside a cluster or word only the whole is, and
    // its characters are as wide as nothing unless they print alone too.
    if (pictureCodePoints.length === 1) {
      const onlyCodePoint = pictureCodePoints[0] ?? 0
      advanceEmsByCodePoint.set(onlyCodePoint, Math.max(advanceEmsByCodePoint.get(onlyCodePoint) ?? 0, advanceEm))
      continue
    }
    for (const codePoint of pictureCodePoints) advanceEmsByCodePoint.set(codePoint, advanceEmsByCodePoint.get(codePoint) ?? 0)
    clusterAdvanceEmsByText.set(pictureCharactersText, Math.max(clusterAdvanceEmsByText.get(pictureCharactersText) ?? 0, advanceEm))
  }
  const sortedCodePoints = [...advanceEmsByCodePoint.keys()].sort((firstCodePoint, secondCodePoint) => firstCodePoint - secondCodePoint)
  const glyphIdsByCodePoint = new Map(sortedCodePoints.map((codePoint, codePointIndex) => [codePoint, codePointIndex + 1]))
  const glyphAdvances = [papelizPdfExportGlyphlessFontUnitsPerEm / 2, ...sortedCodePoints.map((codePoint) => toFontUnits(advanceEmsByCodePoint.get(codePoint) ?? 0))]
  const ligaturesByFirstGlyphId = new Map<number, Array<{ componentGlyphIds: number[]; ligatureGlyphId: number }>>()
  for (const [clusterText, clusterAdvanceEm] of clusterAdvanceEmsByText) {
    const componentGlyphIds = Array.from(clusterText, (clusterCharacter) => glyphIdsByCodePoint.get(clusterCharacter.codePointAt(0) ?? 0) ?? 0)
    const ligatureGlyphId = glyphAdvances.length
    glyphAdvances.push(toFontUnits(clusterAdvanceEm))
    const firstGlyphId = componentGlyphIds[0] ?? 0
    ligaturesByFirstGlyphId.set(firstGlyphId, [...(ligaturesByFirstGlyphId.get(firstGlyphId) ?? []), { componentGlyphIds, ligatureGlyphId }])
  }
  const glyphCount = glyphAdvances.length
  const largestAdvance = Math.max(...glyphAdvances)
  const firstCodePoint = sortedCodePoints[0] ?? 0x20
  const lastCodePoint = sortedCodePoints.at(-1) ?? 0x20

  const headTable = new PapelizFontTableWriter()
    .uint32(0x00010000)
    .uint32(0x00010000)
    .uint32(0)
    .uint32(0x5f0f3cf5)
    .uint16(0b1011)
    .uint16(papelizPdfExportGlyphlessFontUnitsPerEm)
    .zeros(16)
    .int16(0)
    .int16(papelizPdfExportGlyphlessFontDescent)
    .int16(largestAdvance)
    .int16(papelizPdfExportGlyphlessFontAscent)
    .uint16(0)
    .uint16(8)
    .int16(2)
    .int16(0)
    .int16(0)
  const hheaTable = new PapelizFontTableWriter()
    .uint32(0x00010000)
    .int16(papelizPdfExportGlyphlessFontAscent)
    .int16(papelizPdfExportGlyphlessFontDescent)
    .int16(0)
    .uint16(largestAdvance)
    .int16(0)
    .int16(0)
    .int16(0)
    .int16(1)
    .int16(0)
    .int16(0)
    .zeros(8)
    .int16(0)
    .uint16(glyphCount)
  const maxpTable = new PapelizFontTableWriter().uint32(0x00010000).uint16(glyphCount).zeros(26)
  const os2Table = new PapelizFontTableWriter()
    .uint16(4)
    .int16(largestAdvance)
    .uint16(400)
    .uint16(5)
    // fsType 0: the font may be embedded.
    .uint16(0)
    .int16(650)
    .int16(600)
    .int16(0)
    .int16(75)
    .int16(650)
    .int16(600)
    .int16(0)
    .int16(350)
    .int16(50)
    .int16(250)
    .int16(0)
    .zeros(10)
    .zeros(16)
    .bytes([0x50, 0x50, 0x4c, 0x5a])
    .uint16(0x40)
    .uint16(Math.min(firstCodePoint, 0xffff))
    .uint16(Math.min(lastCodePoint, 0xffff))
    .int16(papelizPdfExportGlyphlessFontAscent)
    .int16(papelizPdfExportGlyphlessFontDescent)
    .int16(0)
    .uint16(papelizPdfExportGlyphlessFontAscent)
    .uint16(-papelizPdfExportGlyphlessFontDescent)
    .zeros(8)
    .int16(500)
    .int16(700)
    .uint16(0)
    .uint16(0x20)
    .uint16(1)
  const hmtxTable = new PapelizFontTableWriter()
  for (const glyphAdvance of glyphAdvances) hmtxTable.uint16(glyphAdvance).int16(0)
  // Every glyph is empty: each starts where the next does.
  const locaTable = new PapelizFontTableWriter()
  for (let locaIndex = 0; locaIndex <= glyphCount; locaIndex += 1) locaTable.uint16(0)
  const glyfTable = new PapelizFontTableWriter().zeros(4)
  const cmapTable = new PapelizFontTableWriter()
    .uint16(0)
    .uint16(1)
    .uint16(3)
    .uint16(10)
    .uint32(12)
    .uint16(12)
    .uint16(0)
    .uint32(16 + 12 * sortedCodePoints.length)
    .uint32(0)
    .uint32(sortedCodePoints.length)
  sortedCodePoints.forEach((codePoint, codePointIndex) => cmapTable.uint32(codePoint).uint32(codePoint).uint32(codePointIndex + 1))
  const postTable = new PapelizFontTableWriter().uint32(0x00030000).uint32(0).int16(-100).int16(50).uint32(0).zeros(16)

  const fontTables: Array<[tableTag: string, tableBytes: Uint8Array]> = [
    ...(ligaturesByFirstGlyphId.size > 0 ? [['GSUB', buildLigatureTable(ligaturesByFirstGlyphId)] as [string, Uint8Array]] : []),
    ['OS/2', os2Table.toBytes()],
    ['cmap', cmapTable.toBytes()],
    ['glyf', glyfTable.toBytes()],
    ['head', headTable.toBytes()],
    ['hhea', hheaTable.toBytes()],
    ['hmtx', hmtxTable.toBytes()],
    ['loca', locaTable.toBytes()],
    ['maxp', maxpTable.toBytes()],
    ['name', buildNameTable()],
    ['post', postTable.toBytes()],
  ]
  const tableCount = fontTables.length
  const searchPowerOfTwo = 2 ** Math.floor(Math.log2(tableCount))
  const fontWriter = new PapelizFontTableWriter()
    .uint32(0x00010000)
    .uint16(tableCount)
    .uint16(searchPowerOfTwo * 16)
    .uint16(Math.log2(searchPowerOfTwo))
    .uint16(tableCount * 16 - searchPowerOfTwo * 16)
  let tableOffset = 12 + 16 * tableCount
  const headTableOffsetHolder = { headTableOffset: 0 }
  for (const [tableTag, tableBytes] of fontTables) {
    if (tableTag === 'head') headTableOffsetHolder.headTableOffset = tableOffset
    fontWriter.bytes(Array.from(tableTag, (tagCharacter) => tagCharacter.charCodeAt(0))).uint32(computeTableChecksum(tableBytes)).uint32(tableOffset).uint32(tableBytes.length)
    tableOffset += Math.ceil(tableBytes.length / 4) * 4
  }
  for (const [, tableBytes] of fontTables) fontWriter.bytes(tableBytes).zeros((4 - (tableBytes.length % 4)) % 4)
  const fontBytes = fontWriter.toBytes()
  // head's checkSumAdjustment: what makes the whole file sum to 0xB1B0AFBA.
  const checkSumAdjustment = (0xb1b0afba - computeTableChecksum(fontBytes)) >>> 0
  const adjustmentOffset = headTableOffsetHolder.headTableOffset + 8
  fontBytes[adjustmentOffset] = checkSumAdjustment >>> 24
  fontBytes[adjustmentOffset + 1] = (checkSumAdjustment >>> 16) & 0xff
  fontBytes[adjustmentOffset + 2] = (checkSumAdjustment >>> 8) & 0xff
  fontBytes[adjustmentOffset + 3] = checkSumAdjustment & 0xff
  return fontBytes
}
