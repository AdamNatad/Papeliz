// Colors as the color picker and the notes use them: a hex color (#7c3aed) in the Markdown, and
// hue / saturation / lightness while picking.

export interface PapelizHslColor {
  // 0 to 360
  colorHue: number
  // 0 to 100
  colorSaturation: number
  // 0 to 100
  colorLightness: number
}

const papelizHexColorPattern = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

// "#7C3AED", "7c3aed" or "#73e" → "#7c3aed"; anything else → null.
export function parsePapelizHexColor(typedColorText: string): string | null {
  const hexColorMatch = papelizHexColorPattern.exec(typedColorText.trim())
  if (hexColorMatch === null) return null
  const hexDigits = hexColorMatch[1] ?? ''
  const fullHexDigits = hexDigits.length === 3 ? [...hexDigits].map((hexDigit) => hexDigit + hexDigit).join('') : hexDigits
  return `#${fullHexDigits.toLowerCase()}`
}

export function convertHexColorToHsl(hexColor: string): PapelizHslColor {
  const parsedHexColor = parsePapelizHexColor(hexColor) ?? '#000000'
  const redShare = parseInt(parsedHexColor.slice(1, 3), 16) / 255
  const greenShare = parseInt(parsedHexColor.slice(3, 5), 16) / 255
  const blueShare = parseInt(parsedHexColor.slice(5, 7), 16) / 255
  const largestShare = Math.max(redShare, greenShare, blueShare)
  const smallestShare = Math.min(redShare, greenShare, blueShare)
  const shareRange = largestShare - smallestShare
  const lightnessShare = (largestShare + smallestShare) / 2
  let colorHue = 0
  if (shareRange > 0) {
    if (largestShare === redShare) colorHue = 60 * (((greenShare - blueShare) / shareRange) % 6)
    else if (largestShare === greenShare) colorHue = 60 * ((blueShare - redShare) / shareRange + 2)
    else colorHue = 60 * ((redShare - greenShare) / shareRange + 4)
  }
  const saturationShare = shareRange === 0 ? 0 : shareRange / (1 - Math.abs(2 * lightnessShare - 1))
  return { colorHue: (colorHue + 360) % 360, colorSaturation: saturationShare * 100, colorLightness: lightnessShare * 100 }
}

export function convertHslToHexColor({ colorHue, colorSaturation, colorLightness }: PapelizHslColor): string {
  const saturationShare = Math.min(100, Math.max(0, colorSaturation)) / 100
  const lightnessShare = Math.min(100, Math.max(0, colorLightness)) / 100
  const chroma = (1 - Math.abs(2 * lightnessShare - 1)) * saturationShare
  const hueSection = (((colorHue % 360) + 360) % 360) / 60
  const secondShare = chroma * (1 - Math.abs((hueSection % 2) - 1))
  const [redPart, greenPart, bluePart] =
    hueSection < 1
      ? [chroma, secondShare, 0]
      : hueSection < 2
        ? [secondShare, chroma, 0]
        : hueSection < 3
          ? [0, chroma, secondShare]
          : hueSection < 4
            ? [0, secondShare, chroma]
            : hueSection < 5
              ? [secondShare, 0, chroma]
              : [chroma, 0, secondShare]
  const lightnessOffset = lightnessShare - chroma / 2
  const toHexPair = (colorPart: number) =>
    Math.round((colorPart + lightnessOffset) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHexPair(redPart)}${toHexPair(greenPart)}${toHexPair(bluePart)}`
}
