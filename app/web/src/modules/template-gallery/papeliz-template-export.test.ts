import { describe, expect, it } from 'vitest'
import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import {
  buildPapelizTemplateExportManifest,
  buildPapelizTemplateExportOptionalPathPatterns,
  exportPapelizVaultNotesAsTemplate,
  findPapelizTemplateExportFileReferences,
  writePapelizTemplateExportMitLicenseText,
} from './papeliz-template-export'
import { findPapelizTemplateExportDetailsProblem, listPapelizTemplateExportTags, type PapelizTemplateExportDetails } from './papeliz-template-export-details'
import { detectPapelizTemplateLicenseId, findPapelizTemplateOptionalFileRelativePaths, parsePapelizTemplateManifest } from './papeliz-template-gallery-checks'

const exampleTemplateExportDetails: PapelizTemplateExportDetails = {
  templateExportName: 'Study notes',
  templateExportDescription: 'A vault to study with.',
  templateExportTags: ['education'],
  templateExportFirstNotePath: 'Start here.md',
  templateExportLicenseText: 'MIT',
}

describe('findPapelizTemplateExportFileReferences', () => {
  it('finds the pictures and files a note links to, and leaves out notes, web addresses and anchors', () => {
    expect(
      findPapelizTemplateExportFileReferences(
        [
          '![[plan.png]] and [[report.pdf|the report]] and [[Other note]] and [[Other note.md]]',
          '![Map](pictures/My%20map.jpg "Map") and [Site](https://example.com/a.png) and [Up](#top)',
          '<img src="pictures/photo.webp" alt="">',
        ].join('\n'),
      ),
    ).toEqual(['plan.png', 'report.pdf', 'pictures/My map.jpg', 'pictures/photo.webp'])
  })
})

describe('buildPapelizTemplateExportOptionalPathPatterns', () => {
  it('names a whole folder when every file in it is optional, and single files otherwise', () => {
    const templateFiles = ['Start here.md', 'Extras/One.md', 'Extras/Two.md', 'Extras/Deep/Three.md', 'Guides/Keep.md', 'Guides/Skip.md']
    const optionalFiles = new Set(['Extras/One.md', 'Extras/Two.md', 'Extras/Deep/Three.md', 'Guides/Skip.md'])
    expect(buildPapelizTemplateExportOptionalPathPatterns(templateFiles, optionalFiles)).toEqual(['Extras/**', 'Guides/Skip.md'])
  })
})

describe('the template it writes', () => {
  it('passes the gallery’s own manifest check, and its optional paths match exactly the optional files', () => {
    const templateFiles = ['Start here.md', 'Extras/One.md', 'Guides/Keep.md']
    const templateManifest = buildPapelizTemplateExportManifest(exampleTemplateExportDetails, buildPapelizTemplateExportOptionalPathPatterns(templateFiles, new Set(['Extras/One.md'])))
    const { templateManifest: parsedManifest, templateManifestProblemSentence } = parsePapelizTemplateManifest(JSON.stringify(templateManifest))
    expect(templateManifestProblemSentence).toBeNull()
    expect(parsedManifest).not.toBeNull()
    if (parsedManifest === null) return
    expect(findPapelizTemplateOptionalFileRelativePaths([...templateFiles, 'LICENSE'], parsedManifest)).toEqual(['Extras/One.md'])
  })

  it('writes the MIT License as the gallery’s license check reads it', () => {
    expect(detectPapelizTemplateLicenseId(writePapelizTemplateExportMitLicenseText(2026, 'Study notes'))).toBe('MIT')
  })

  it('asks for a name, a description and a category first', () => {
    const typedTemplateDetails = { ...exampleTemplateExportDetails, templateExportTagTexts: ['Education', '', ''] }
    expect(findPapelizTemplateExportDetailsProblem({ ...typedTemplateDetails, templateExportName: ' ' })).toBe('Give the template a name in Template Settings.')
    expect(findPapelizTemplateExportDetailsProblem({ ...typedTemplateDetails, templateExportDescription: '' })).toBe('Describe the template in Template Settings.')
    expect(findPapelizTemplateExportDetailsProblem({ ...typedTemplateDetails, templateExportTagTexts: ['', 'notes', ''] })).toBe('Give the template a category in Template Settings.')
    expect(findPapelizTemplateExportDetailsProblem(typedTemplateDetails)).toBeNull()
  })

  it('makes the typed category, subcategory and label into tags, any words the author likes', () => {
    expect(listPapelizTemplateExportTags(['Gardening', 'Seed Saving', 'AI Agents!'])).toEqual(['gardening', 'seed-saving', 'ai-agents'])
    expect(listPapelizTemplateExportTags(['Journal', '', ''])).toEqual(['journal'])
    const { templateManifestProblemSentence } = parsePapelizTemplateManifest(
      JSON.stringify(buildPapelizTemplateExportManifest({ ...exampleTemplateExportDetails, templateExportTags: listPapelizTemplateExportTags(['Gardening', 'Seed Saving', 'Notes']) }, [])),
    )
    expect(templateManifestProblemSentence).toBeNull()
  })
})

describe('exportPapelizVaultNotesAsTemplate', () => {
  it('zips the ticked notes, the pictures they show, the manifest and a LICENSE', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Start here.md', vaultNoteText: '# Start\n\n![[plan.png]]' },
      { vaultNoteRelativePath: 'Extras/Reading list.md', vaultNoteText: '![Cover](cover.png)' },
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Not ticked.' },
    ])
    await vaultAdapter.createVaultAttachmentFile('pictures/plan.png', new Blob([new Uint8Array([1, 2, 3])]))
    await vaultAdapter.createVaultAttachmentFile('Extras/cover.png', new Blob([new Uint8Array([4, 5])]))
    const { templateExportFileBlob, templateExportNotices } = await exportPapelizVaultNotesAsTemplate({
      templateExportVault: { vaultAdapter, vaultDisplayName: 'Sample vault' },
      templateExportVaultNoteRelativePaths: ['Start here.md', 'Extras/Reading list.md'],
      templateExportOptionalNoteRelativePaths: new Set(['Extras/Reading list.md']),
      templateExportDetails: exampleTemplateExportDetails,
    })
    expect(templateExportNotices).toEqual([])
    const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await templateExportFileBlob.arrayBuffer()))
    expect(importZipEntries.map((importZipEntry) => importZipEntry.importZipEntryPath).sort()).toEqual(
      ['Extras/Reading list.md', 'Extras/cover.png', 'LICENSE', 'Start here.md', 'papeliz-template.json', 'pictures/plan.png'].sort(),
    )
    const manifestEntry = importZipEntries.find((importZipEntry) => importZipEntry.importZipEntryPath === 'papeliz-template.json')
    const manifestText = new TextDecoder().decode(await manifestEntry?.readImportZipEntryBytes())
    const { templateManifest } = parsePapelizTemplateManifest(manifestText)
    // The reading list and the cover only it shows are optional, as one folder.
    expect(templateManifest?.templateOptionalPaths).toEqual(['Extras/**'])
    expect(templateManifest?.templateFirstNotePath).toBe('Start here.md')
    expect(templateManifest?.templateTags).toEqual(['education'])
  })

  it('leaves the LICENSE out for a Creative Commons license and says how to add it', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Start here.md', vaultNoteText: 'Hello.' }])
    const { templateExportFileBlob, templateExportNotices } = await exportPapelizVaultNotesAsTemplate({
      templateExportVault: { vaultAdapter, vaultDisplayName: 'Sample vault' },
      templateExportVaultNoteRelativePaths: ['Start here.md'],
      templateExportOptionalNoteRelativePaths: new Set(),
      templateExportDetails: { ...exampleTemplateExportDetails, templateExportLicenseText: 'cc-by-4.0' },
    })
    const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await templateExportFileBlob.arrayBuffer()))
    expect(importZipEntries.map((importZipEntry) => importZipEntry.importZipEntryPath).sort()).toEqual(['Start here.md', 'papeliz-template.json'])
    expect(templateExportNotices[0]).toBe('Add the CC BY 4.0 text as a file named LICENSE before you submit.')
  })

  it('takes a license of the author’s own, and says to add its file', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Start here.md', vaultNoteText: 'Hello.' }])
    const { templateExportNotices } = await exportPapelizVaultNotesAsTemplate({
      templateExportVault: { vaultAdapter, vaultDisplayName: 'Sample vault' },
      templateExportVaultNoteRelativePaths: ['Start here.md'],
      templateExportOptionalNoteRelativePaths: new Set(),
      templateExportDetails: { ...exampleTemplateExportDetails, templateExportLicenseText: 'Garden Club License' },
    })
    expect(templateExportNotices).toEqual(['Add your license, “Garden Club License”, as a file named LICENSE before you submit.'])
  })
})
