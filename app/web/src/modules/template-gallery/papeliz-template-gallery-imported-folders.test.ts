import { describe, expect, it } from 'vitest'
import { addPapelizImportedTemplateFolder, type PapelizImportedTemplateFolder } from './papeliz-template-gallery-imported-folders'

const p1WorkflowImportedFolder: PapelizImportedTemplateFolder = {
  importedTemplateFolderRelativePath: 'P1-Workflow',
  papelizTemplateGalleryId: 'AdamNatad/P1-Workflow',
  templateSourceCommitSha: 'a'.repeat(40),
  templateSourceName: 'P1-Workflow',
  templateSourceAuthor: 'AdamNatad',
  templateSourceLicenseId: 'MIT',
  templateFolderImportedAt: '2026-11-02T09:30:00.000Z',
}

describe('imported template folders', () => {
  it('adds one entry per import, keeping the earlier ones, and starts again from a file that doesn’t read', () => {
    const firstFileText = addPapelizImportedTemplateFolder(null, p1WorkflowImportedFolder)
    expect(JSON.parse(firstFileText)).toEqual({ papelizImportedTemplateFoldersFileVersion: 1, importedTemplateFolders: [p1WorkflowImportedFolder] })
    const secondImportedFolder = { ...p1WorkflowImportedFolder, importedTemplateFolderRelativePath: 'P1-Workflow 2' }
    expect(JSON.parse(addPapelizImportedTemplateFolder(firstFileText, secondImportedFolder)).importedTemplateFolders).toEqual([p1WorkflowImportedFolder, secondImportedFolder])
    expect(JSON.parse(addPapelizImportedTemplateFolder('{ damaged', secondImportedFolder)).importedTemplateFolders).toEqual([secondImportedFolder])
  })

  it('records which files each import got, beside entries from before the choice existed', () => {
    const entryWithoutChoiceText = addPapelizImportedTemplateFolder(null, p1WorkflowImportedFolder)
    const recommendedImportedFolder: PapelizImportedTemplateFolder = { ...p1WorkflowImportedFolder, importedTemplateFolderRelativePath: 'P1-Workflow 2', templateSourceFilesChoice: 'recommended' }
    const allImportedFolder: PapelizImportedTemplateFolder = { ...p1WorkflowImportedFolder, importedTemplateFolderRelativePath: 'P1-Workflow 3', templateSourceFilesChoice: 'all' }
    const foldersFileText = addPapelizImportedTemplateFolder(addPapelizImportedTemplateFolder(entryWithoutChoiceText, recommendedImportedFolder), allImportedFolder)
    expect(JSON.parse(foldersFileText).importedTemplateFolders.map((importedTemplateFolder: PapelizImportedTemplateFolder) => importedTemplateFolder.templateSourceFilesChoice)).toEqual([
      undefined,
      'recommended',
      'all',
    ])
  })
})
