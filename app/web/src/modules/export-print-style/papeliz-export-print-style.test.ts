import { describe, expect, it } from 'vitest'
import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import { readPapelizHtmlExportMdViewStyles } from '../html-export/papeliz-html-export-md-view-styles'
import {
  choosePapelizExportDefaultPageSize,
  getPapelizExportCalloutPrintColors,
  getPapelizExportPrintColor,
  mixPapelizExportPrintColorsInOklab,
  papelizExportPrintColorsByToken,
  papelizExportPrintTextSizesInPoints,
  scalePapelizMdViewPixelsToPrintPoints,
} from './papeliz-export-print-style'

describe('print colors', () => {
  it('are MD View’s light theme colors', () => {
    const lightThemeColorsByToken = new Map(
      readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText).lightThemeTokenDeclarations.map((tokenDeclaration) => {
        const declarationColonIndex = tokenDeclaration.indexOf(':')
        return [tokenDeclaration.slice(0, declarationColonIndex).trim(), tokenDeclaration.slice(declarationColonIndex + 1).trim().toLowerCase()]
      }),
    )
    for (const [papelizColorToken, printColor] of Object.entries(papelizExportPrintColorsByToken)) {
      expect(lightThemeColorsByToken.get(papelizColorToken), papelizColorToken).toBe(printColor)
    }
  })

  it('give null for a token that isn’t a print color', () => {
    expect(getPapelizExportPrintColor('--color-papeliz-blue')).toBe('#0064d4')
    expect(getPapelizExportPrintColor('--color-papeliz-shadow')).toBeNull()
    expect(getPapelizExportPrintColor('toString')).toBeNull()
  })
})

function expectHexColorsClose(receivedHexColor: string, expectedHexColor: string): void {
  for (const hexChannelIndex of [1, 3, 5]) {
    const readHexChannel = (hexColor: string) => Number.parseInt(hexColor.slice(hexChannelIndex, hexChannelIndex + 2), 16)
    expect(Math.abs(readHexChannel(receivedHexColor) - readHexChannel(expectedHexColor)), `${receivedHexColor} ≈ ${expectedHexColor}`).toBeLessThanOrEqual(1)
  }
}

describe('callout print colors', () => {
  it('mix a custom color as CSS’s color-mix(in oklab, …) does', () => {
    // Chrome's own color-mix() results for the same colors.
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#7c3aed', 0.16, '#ffffff'), '#e7e2ff')
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#7c3aed', 0.7, '#111112'), '#5832a4')
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#e11d48', 0.16, '#ffffff'), '#ffe0e0')
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#e11d48', 0.7, '#111112'), '#9d2538')
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#00ff00', 0.16, '#ffffff'), '#e7ffe4')
    expectHexColorsClose(mixPapelizExportPrintColorsInOklab('#00ff00', 0.7, '#111112'), '#28af25')
  })

  it('take the card color, then the kind, then blue', () => {
    expect(getPapelizExportCalloutPrintColors('tip', 'green')).toEqual({ calloutGroundColor: '#e2f5e7', calloutInkColor: '#17663a' })
    expect(getPapelizExportCalloutPrintColors('warning', null)).toEqual({ calloutGroundColor: '#fff4e0', calloutInkColor: '#8a4b00' })
    expect(getPapelizExportCalloutPrintColors('danger', 'violet')).toEqual({ calloutGroundColor: '#fde8e7', calloutInkColor: '#a3302a' })
    expect(getPapelizExportCalloutPrintColors('note', null)).toEqual({ calloutGroundColor: '#eaf2fe', calloutInkColor: '#0064d4' })
    expect(getPapelizExportCalloutPrintColors('constructor', null)).toEqual({ calloutGroundColor: '#eaf2fe', calloutInkColor: '#0064d4' })
    expectHexColorsClose(getPapelizExportCalloutPrintColors('note', '#7c3aed').calloutGroundColor, '#e7e2ff')
  })
})

describe('print sizes', () => {
  it('scale MD View’s 17 px body to 11 pt', () => {
    expect(scalePapelizMdViewPixelsToPrintPoints(17)).toBe(11)
    expect(papelizExportPrintTextSizesInPoints.heading1TextSizePoints).toBeCloseTo(24.64)
    expect(papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints).toBeCloseTo(8.74, 2)
  })
})

describe('choosePapelizExportDefaultPageSize', () => {
  it('picks Letter for regions that use it and A4 elsewhere', () => {
    expect(choosePapelizExportDefaultPageSize(['en-US'])).toBe('letter')
    expect(choosePapelizExportDefaultPageSize(['fil-PH', 'en'])).toBe('letter')
    expect(choosePapelizExportDefaultPageSize(['de-DE'])).toBe('a4')
    expect(choosePapelizExportDefaultPageSize(['en-GB'])).toBe('a4')
  })

  it('reads the first language that names a region', () => {
    expect(choosePapelizExportDefaultPageSize(['en', 'es-MX'])).toBe('letter')
    expect(choosePapelizExportDefaultPageSize(['en'])).toBe('a4')
    expect(choosePapelizExportDefaultPageSize(['not a language tag', 'fr-CA'])).toBe('letter')
    expect(choosePapelizExportDefaultPageSize([])).toBe('a4')
  })
})
