import { papelizHtmlExportCoreLicensesText, papelizHtmlExportCoreText } from 'virtual:papeliz-html-export-core'
import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { papelizSampleVaultDisplayName, papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import type * as PapelizHtmlExportCoreModule from './papeliz-html-export-core-entry'
import { buildPapelizHtmlExportSiteContent, type PapelizHtmlExportSiteContentOptions } from './papeliz-html-export-site-content'

// The bundle as an exported Astro project loads it: an ES module with nothing else to install.
async function importBundledCore(): Promise<typeof PapelizHtmlExportCoreModule> {
  const coreBytes = new TextEncoder().encode(papelizHtmlExportCoreText)
  let binaryText = ''
  for (const coreByte of coreBytes) binaryText += String.fromCharCode(coreByte)
  return (await import(/* @vite-ignore */ `data:text/javascript;base64,${btoa(binaryText)}`)) as typeof PapelizHtmlExportCoreModule
}

function createTestContentOptions(resolveWikilinkTarget: PapelizHtmlExportSiteContentOptions['resolveWikilinkTarget']): PapelizHtmlExportSiteContentOptions {
  return {
    htmlExportSiteName: papelizSampleVaultDisplayName,
    htmlExportSiteNotes: papelizSampleVaultNotes,
    resolveWikilinkTarget,
    drawHtmlExportMermaidDiagramSvg: async (_mermaidDiagramSource, htmlExportTheme) => ({ mermaidDiagramSvgText: `<svg id="test-${htmlExportTheme}"></svg>` }),
    htmlExportVaultAttachmentFileRelativePaths: ['Guides/pictures/flow.png'],
  }
}

describe('the HTML export core bundled for an Astro project', () => {
  it('needs no package but Node’s own modules', () => {
    // The bundle's imports lead it; loading it from a `data:` URL (below) proves there are no others.
    const leadingImportText = /^(\s*import\b[^;]*;)*/.exec(papelizHtmlExportCoreText)?.[0] ?? ''
    const importedModuleNames = [...leadingImportText.matchAll(/["']([^"']+)["']/g)].map((importMatch) => importMatch[1])
    expect(importedModuleNames.length).toBeGreaterThan(0)
    expect(importedModuleNames.every((importedModuleName) => importedModuleName?.startsWith('node:'))).toBe(true)
  })

  it('makes the same site content as Papeliz does', async () => {
    const bundledCore = await importBundledCore()
    const sampleVaultNoteRelativePaths = papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath)
    const bundledSiteContent = await bundledCore.buildPapelizHtmlExportSiteContent(createTestContentOptions(bundledCore.createPapelizWikilinkTargetResolver(sampleVaultNoteRelativePaths)))
    const appSiteContent = await buildPapelizHtmlExportSiteContent(createTestContentOptions(createPapelizWikilinkTargetResolver(sampleVaultNoteRelativePaths)))
    expect(bundledSiteContent).toEqual(appSiteContent)
  })

  it('comes with the licenses of Papeliz and of each package in it', () => {
    expect(papelizHtmlExportCoreLicensesText).toMatch(/^# Licenses of papeliz-html-export-core\.mjs\n/)
    expect(papelizHtmlExportCoreLicensesText).toContain('## Papeliz (MIT)\n\nMIT License')
    expect(papelizHtmlExportCoreLicensesText).toMatch(/## unified [\d.]+ \(MIT\)\n\n\(The MIT License\)|## unified [\d.]+ \(MIT\)\n\n/)
    expect(papelizHtmlExportCoreLicensesText).toMatch(/## lucide-react [\d.]+ \(ISC\), its icon shapes/)
  })
})
