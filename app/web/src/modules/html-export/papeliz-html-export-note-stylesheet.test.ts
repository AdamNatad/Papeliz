import { describe, expect, it } from 'vitest'
import { papelizDefaultNoteTypography } from '../workspace/papeliz-note-typography-store'
import { buildPapelizHtmlExportNoteStylesheet, type PapelizHtmlExportLook } from './papeliz-html-export-note-stylesheet'
import { setPapelizHtmlExportSiteStartingTheme } from './papeliz-html-export-site'

function buildTestStylesheet(htmlExportThemeChoice: 'follow-device' | 'site-theme-switch', htmlExportLook?: PapelizHtmlExportLook): string {
  return buildPapelizHtmlExportNoteStylesheet({ htmlExportThemeChoice, htmlExportNoteTypography: papelizDefaultNoteTypography, htmlExportLook, fontFaceCss: '' })
}

describe('the look HTML’s settings give the pages', () => {
  it('follows the device by default, and starts a one-note page in Light or Dark when chosen', () => {
    expect(buildTestStylesheet('follow-device')).toContain('@media screen and (prefers-color-scheme: dark)')
    const lightPageStylesheet = buildTestStylesheet('follow-device', { htmlExportStartingTheme: 'light', htmlExportAccentHexColor: null })
    expect(lightPageStylesheet).not.toContain('color-scheme: dark')
    const darkPageStylesheet = buildTestStylesheet('follow-device', { htmlExportStartingTheme: 'dark', htmlExportAccentHexColor: null })
    expect(darkPageStylesheet).toContain('@media screen {')
    expect(darkPageStylesheet).not.toContain('prefers-color-scheme')
  })

  it('keeps a website’s own switch, and starts it in the chosen theme when scripts are off', () => {
    const lightSiteStylesheet = buildTestStylesheet('site-theme-switch', { htmlExportStartingTheme: 'light', htmlExportAccentHexColor: null })
    expect(lightSiteStylesheet).toContain(":root[data-papeliz-site-theme='dark']")
    expect(lightSiteStylesheet).not.toContain('prefers-color-scheme')
    const darkSiteStylesheet = buildTestStylesheet('site-theme-switch', { htmlExportStartingTheme: 'dark', htmlExportAccentHexColor: null })
    expect(darkSiteStylesheet).toContain(':root:not([data-papeliz-site-theme]) {')
  })

  it('gives links the accent in both themes, and takes only a six-digit hex color', () => {
    const accentStylesheet = buildTestStylesheet('follow-device', { htmlExportStartingTheme: 'device', htmlExportAccentHexColor: '#0b7a5c' })
    expect(accentStylesheet.match(/--color-papeliz-blue: #0b7a5c/g)).toHaveLength(2)
    const notAColorStylesheet = buildTestStylesheet('follow-device', { htmlExportStartingTheme: 'device', htmlExportAccentHexColor: 'red; color: x' })
    expect(notAColorStylesheet).not.toContain('red; color: x')
  })

  it('starts a website’s readers on the chosen theme until they pick one', () => {
    const themeBootScript = "var papelizSiteThemePreference = 'device'\n  papelizSiteThemePreference = window.localStorage.getItem('papelizSiteThemePreference') || 'device'"
    expect(setPapelizHtmlExportSiteStartingTheme(themeBootScript, 'device')).toBe(themeBootScript)
    expect(setPapelizHtmlExportSiteStartingTheme(themeBootScript, 'dark')).toBe(
      "var papelizSiteThemePreference = 'dark'\n  papelizSiteThemePreference = window.localStorage.getItem('papelizSiteThemePreference') || 'dark'",
    )
    expect(setPapelizHtmlExportSiteStartingTheme("      return 'device'", 'light')).toBe("      return 'light'")
  })
})
