import type { PapelizTemplateFilesChoice, PapelizTemplateLicenseId } from './papeliz-template-gallery-contract'

// Where each folder Import from Template made in a vault came from, in the vault's
// `.papeliz/imported-template-folders.json`, one entry per import, added to and never rewritten. A
// whole vault made from a template keeps its own `.papeliz/template-source.json`; this sits beside it
// and never replaces it. The folder is an ordinary one: renaming, moving or trashing it later changes
// nothing here, and nothing here holds it in place.

export const papelizImportedTemplateFoldersFileName = 'imported-template-folders.json'

// What the template was, as Import from Template knows it when the folder is made.
export interface PapelizImportedTemplateFolderSource {
  papelizTemplateGalleryId: string
  templateSourceCommitSha: string
  templateSourceName: string
  // The repository's owner on GitHub.
  templateSourceAuthor: string
  templateSourceLicenseId: PapelizTemplateLicenseId
  // Which files the folder got, Recommended or All. Missing in entries from before the choice
  // existed, which got all.
  templateSourceFilesChoice?: PapelizTemplateFilesChoice
}

export interface PapelizImportedTemplateFolder extends PapelizImportedTemplateFolderSource {
  // The folder the template came into, as it was named then: "P1-Workflow".
  importedTemplateFolderRelativePath: string
  // ISO time: "2026-11-02T09:30:00.000Z".
  templateFolderImportedAt: string
}

export interface PapelizImportedTemplateFoldersFile {
  papelizImportedTemplateFoldersFileVersion: 1
  importedTemplateFolders: PapelizImportedTemplateFolder[]
}

// The file's text with one more entry. A file that doesn't read (missing, or damaged) starts again
// with this entry alone.
export function addPapelizImportedTemplateFolder(importedTemplateFoldersFileText: string | null, importedTemplateFolder: PapelizImportedTemplateFolder): string {
  let importedTemplateFolders: PapelizImportedTemplateFolder[] = []
  try {
    const parsedFoldersFile = importedTemplateFoldersFileText === null ? null : (JSON.parse(importedTemplateFoldersFileText) as Partial<PapelizImportedTemplateFoldersFile> | null)
    if (Array.isArray(parsedFoldersFile?.importedTemplateFolders)) importedTemplateFolders = parsedFoldersFile.importedTemplateFolders
  } catch {
    importedTemplateFolders = []
  }
  const importedTemplateFoldersFile: PapelizImportedTemplateFoldersFile = {
    papelizImportedTemplateFoldersFileVersion: 1,
    importedTemplateFolders: [...importedTemplateFolders, importedTemplateFolder],
  }
  return `${JSON.stringify(importedTemplateFoldersFile, null, 2)}\n`
}
