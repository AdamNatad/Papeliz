import { describe, expect, it } from 'vitest'
import { convertHexColorToHsl, convertHslToHexColor, parsePapelizHexColor } from './papeliz-color-values'

describe('color values', () => {
  it('reads hex colors in their usual spellings and refuses the rest', () => {
    expect(parsePapelizHexColor('#7C3AED')).toBe('#7c3aed')
    expect(parsePapelizHexColor('7c3aed')).toBe('#7c3aed')
    expect(parsePapelizHexColor('#73e')).toBe('#7733ee')
    expect(parsePapelizHexColor('purple')).toBeNull()
    expect(parsePapelizHexColor('#12345')).toBeNull()
  })

  it('goes from hex to hue, saturation and lightness and back', () => {
    for (const hexColor of ['#7c3aed', '#e11d48', '#0064d4', '#16a34a', '#000000', '#ffffff', '#808080']) {
      expect(convertHslToHexColor(convertHexColorToHsl(hexColor))).toBe(hexColor)
    }
    expect(convertHexColorToHsl('#ff0000')).toEqual({ colorHue: 0, colorSaturation: 100, colorLightness: 50 })
    expect(convertHslToHexColor({ colorHue: 120, colorSaturation: 100, colorLightness: 50 })).toBe('#00ff00')
  })
})
