import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import { createPapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import { PapelizVaultOperationError, type PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { getPapelizSafeFileNameStem } from '../workspace/papeliz-export-file-save'
import { parsePapelizTemplateManifest } from './papeliz-template-gallery-checks'
import { findPapelizTemplateExportDetailsProblem, type PapelizTemplateExportDetails } from './papeliz-template-export-details'
import { papelizTemplateLicenseDisplayNames, papelizTemplateManifestFileName, type PapelizTemplateManifest } from './papeliz-template-gallery-contract'

// Export › Template from the open vault: the Settings gear's Export page loads this with `import()`
// when someone exports. The ticked notes, with their folders, the pictures and files they link to,
// a `papeliz-template.json` written from the Template Settings, and for MIT a LICENSE, in one `.zip`.
// Its files go into a public GitHub repository as they are, ready for Submit Template.

export interface PapelizTemplateExportRequest {
  templateExportVault: { vaultAdapter: PapelizVaultAdapter; vaultDisplayName: string }
  templateExportVaultNoteRelativePaths: readonly string[]
  // Ticked notes that come only with All; the rest are Recommended.
  templateExportOptionalNoteRelativePaths: ReadonlySet<string>
  templateExportDetails: PapelizTemplateExportDetails
  onTemplateExportProgress?: (exportedNoteCount: number, exportNoteCount: number) => void
  templateExportAbortSignal?: AbortSignal
}

export interface PapelizTemplateExportFileKind {
  templateExportFileName: string
  templateExportFileDescription: string
  templateExportFileMediaType: string
  templateExportFileExtension: string
}

export function describePapelizTemplateExportFile(templateExportName: string, vaultDisplayName: string): PapelizTemplateExportFileKind {
  return {
    templateExportFileName: `${getPapelizSafeFileNameStem(templateExportName.trim() || vaultDisplayName, 'Template')}.zip`,
    templateExportFileDescription: 'Papeliz template (.zip)',
    templateExportFileMediaType: 'application/zip',
    templateExportFileExtension: '.zip',
  }
}

// The pictures and files a note points at: `![[picture.png]]` and `[[report.pdf]]`, `![alt](pictures/plan.png)`
// and `[file](files/report.pdf)`, and `<img src="…">`. Links to notes, to web addresses and within the
// note are left out.
export function findPapelizTemplateExportFileReferences(vaultNoteText: string): string[] {
  const templateExportFileReferences: string[] = []
  const addFileReference = (fileReferenceText: string) => {
    let fileReference = fileReferenceText.trim().replace(/[#?].*$/, '')
    try {
      fileReference = decodeURIComponent(fileReference)
    } catch {
      // A "%" that isn't an escape: the reference as written.
    }
    if (fileReference.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(fileReference) || fileReference.startsWith('//')) return
    if (!/\.[a-z0-9]+$/i.test(fileReference) || /\.md$/i.test(fileReference)) return
    templateExportFileReferences.push(fileReference)
  }
  for (const wikiLinkMatch of vaultNoteText.matchAll(/!?\[\[([^\]|#^]+)(?:[#^|][^\]]*)?\]\]/g)) addFileReference(wikiLinkMatch[1] ?? '')
  for (const markdownLinkMatch of vaultNoteText.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) addFileReference(markdownLinkMatch[1] ?? '')
  for (const pictureTagMatch of vaultNoteText.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) addFileReference(pictureTagMatch[1] ?? '')
  return templateExportFileReferences
}

// The manifest's optional paths: a whole folder as "Folder/**" when every file the template has in it
// is optional, otherwise the file's own path.
export function buildPapelizTemplateExportOptionalPathPatterns(templateExportFileRelativePaths: readonly string[], optionalFileRelativePaths: ReadonlySet<string>): string[] {
  const isEveryFileUnderFolderOptional = (vaultFolderRelativePath: string) =>
    templateExportFileRelativePaths.every((templateFileRelativePath) => !templateFileRelativePath.startsWith(`${vaultFolderRelativePath}/`) || optionalFileRelativePaths.has(templateFileRelativePath))
  const optionalPathPatterns = new Set<string>()
  for (const optionalFileRelativePath of templateExportFileRelativePaths.filter((templateFileRelativePath) => optionalFileRelativePaths.has(templateFileRelativePath))) {
    let widestOptionalFolderRelativePath: string | null = null
    for (let vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(optionalFileRelativePath); vaultFolderRelativePath !== ''; vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultFolderRelativePath)) {
      if (isEveryFileUnderFolderOptional(vaultFolderRelativePath)) widestOptionalFolderRelativePath = vaultFolderRelativePath
    }
    optionalPathPatterns.add(widestOptionalFolderRelativePath === null ? optionalFileRelativePath : `${widestOptionalFolderRelativePath}/**`)
  }
  return [...optionalPathPatterns]
}

export function buildPapelizTemplateExportManifest(templateExportDetails: PapelizTemplateExportDetails, templateOptionalPaths: readonly string[]): PapelizTemplateManifest {
  return {
    papelizTemplateManifestVersion: 1,
    templateName: templateExportDetails.templateExportName.trim(),
    templateDescription: templateExportDetails.templateExportDescription.trim(),
    templateTags: [templateExportDetails.templateExportCategoryTag],
    templateFirstNotePath: templateExportDetails.templateExportFirstNotePath,
    templateIncludedPaths: ['**'],
    templateExcludedPaths: [],
    templateOptionalPaths: [...templateOptionalPaths],
    templateThumbnailPicturePath: null,
  }
}

// The MIT License, word for word, for the template's own authors.
export function writePapelizTemplateExportMitLicenseText(licenseYear: number, templateExportName: string): string {
  return `MIT License

Copyright (c) ${licenseYear} The authors of ${templateExportName.trim()}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
}

const papelizTemplateExportTextEncoder = new TextEncoder()

export async function exportPapelizVaultNotesAsTemplate(templateExportRequest: PapelizTemplateExportRequest): Promise<{ templateExportFileBlob: Blob; templateExportNotices: string[] }> {
  const { templateExportVault, templateExportVaultNoteRelativePaths, templateExportOptionalNoteRelativePaths, templateExportDetails, onTemplateExportProgress, templateExportAbortSignal } =
    templateExportRequest
  const { vaultAdapter } = templateExportVault
  const detailsProblem = findPapelizTemplateExportDetailsProblem(templateExportDetails)
  if (detailsProblem !== null) throw new PapelizVaultOperationError(detailsProblem)
  if (!templateExportVaultNoteRelativePaths.includes(templateExportDetails.templateExportFirstNotePath)) {
    throw new PapelizVaultOperationError('The first note isn’t among the ticked notes. Tick it, or choose another in Template Settings.')
  }

  const vaultFileResolver = createPapelizHtmlExportVaultFileResolver(await vaultAdapter.listVaultAttachmentFileRelativePaths())
  const zipEntries: PapelizExportZipEntry[] = []
  // Each linked file, with the notes that link to it: it is optional when only optional notes do.
  const linkingNoteRelativePathsByFileRelativePath = new Map<string, string[]>()
  for (const [exportedNoteIndex, vaultNoteRelativePath] of templateExportVaultNoteRelativePaths.entries()) {
    templateExportAbortSignal?.throwIfAborted()
    const vaultNoteText = await vaultAdapter.readVaultNoteText(vaultNoteRelativePath)
    zipEntries.push({ zipEntryPath: vaultNoteRelativePath, zipEntryBytes: papelizTemplateExportTextEncoder.encode(vaultNoteText) })
    for (const fileReference of findPapelizTemplateExportFileReferences(vaultNoteText)) {
      const linkedFileRelativePath = vaultFileResolver(fileReference, vaultNoteRelativePath)
      if (linkedFileRelativePath === null) continue
      linkingNoteRelativePathsByFileRelativePath.set(linkedFileRelativePath, [...(linkingNoteRelativePathsByFileRelativePath.get(linkedFileRelativePath) ?? []), vaultNoteRelativePath])
    }
    onTemplateExportProgress?.(exportedNoteIndex + 1, templateExportVaultNoteRelativePaths.length)
  }
  const optionalFileRelativePaths = new Set(templateExportOptionalNoteRelativePaths)
  optionalFileRelativePaths.delete(templateExportDetails.templateExportFirstNotePath)
  for (const [linkedFileRelativePath, linkingNoteRelativePaths] of linkingNoteRelativePathsByFileRelativePath) {
    templateExportAbortSignal?.throwIfAborted()
    zipEntries.push({ zipEntryPath: linkedFileRelativePath, zipEntryBytes: new Uint8Array(await (await vaultAdapter.readVaultAttachmentFileBlob(linkedFileRelativePath)).arrayBuffer()) })
    if (linkingNoteRelativePaths.every((linkingNoteRelativePath) => optionalFileRelativePaths.has(linkingNoteRelativePath))) optionalFileRelativePaths.add(linkedFileRelativePath)
  }

  const templateExportFileRelativePaths = zipEntries.map((zipEntry) => zipEntry.zipEntryPath)
  const templateManifest = buildPapelizTemplateExportManifest(templateExportDetails, buildPapelizTemplateExportOptionalPathPatterns(templateExportFileRelativePaths, optionalFileRelativePaths))
  const templateManifestText = `${JSON.stringify(templateManifest, null, 2)}\n`
  // The gallery's own check, so what downloads is a template Submit Template accepts.
  const { templateManifestProblemSentence } = parsePapelizTemplateManifest(templateManifestText)
  if (templateManifestProblemSentence !== null) {
    throw new PapelizVaultOperationError(
      templateManifest.templateOptionalPaths.length > 30
        ? 'Too many optional files for one template. Make whole folders Optional, or fewer files.'
        : templateManifestProblemSentence,
    )
  }
  zipEntries.push({ zipEntryPath: papelizTemplateManifestFileName, zipEntryBytes: papelizTemplateExportTextEncoder.encode(templateManifestText) })

  const templateExportNotices: string[] = []
  if (templateExportDetails.templateExportLicenseId === 'MIT') {
    zipEntries.push({ zipEntryPath: 'LICENSE', zipEntryBytes: papelizTemplateExportTextEncoder.encode(writePapelizTemplateExportMitLicenseText(new Date().getFullYear(), templateExportDetails.templateExportName)) })
  } else {
    const licenseDisplayName = papelizTemplateLicenseDisplayNames[templateExportDetails.templateExportLicenseId]
    templateExportNotices.push(`Add ${licenseDisplayName} as a file named LICENSE before you submit: on GitHub, a new file named LICENSE offers it among its license templates.`)
  }
  return {
    templateExportFileBlob: await writePapelizExportZipFile(zipEntries, { zipEntryModifiedDate: new Date() }),
    templateExportNotices,
  }
}
