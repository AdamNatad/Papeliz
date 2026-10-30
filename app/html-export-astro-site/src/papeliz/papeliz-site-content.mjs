// The website's content, made from the notes in vault/ by the same code Papeliz used when it
// exported this site (papeliz-html-export-core.mjs). Edit a note, add one or move one, then build:
// links between notes, the folder list, search, the Markdown twins and llms.txt follow.
import { existsSync, readdirSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicDir } from 'astro:config/server'
import { buildPapelizHtmlExportSiteContent, createPapelizWikilinkTargetResolver } from './papeliz-html-export-core.mjs'
import papelizSiteSettings from './papeliz-site-settings.json'
import papelizVaultDiagrams from './papeliz-vault-diagrams.json'

// Pictures and other files sit in public/attachments/, in their vault folders
// ("public/attachments/pictures/plan.png" is the vault's "pictures/plan.png"), and Astro copies them
// as they are. A file added there can be shown or linked from a note.
function listPapelizAttachmentFiles() {
  const attachmentsFolderPath = fileURLToPath(new URL('attachments/', publicDir))
  if (!existsSync(attachmentsFolderPath)) return []
  return readdirSync(attachmentsFolderPath, { recursive: true, withFileTypes: true })
    .filter((folderEntry) => folderEntry.isFile())
    .map((folderEntry) => relative(attachmentsFolderPath, `${folderEntry.parentPath}/${folderEntry.name}`).split('\\').join('/'))
}

// Every note in vault/, as text, by its path in the vault ("Projects/Launch plan.md").
const papelizVaultNoteTextsByVaultPath = import.meta.glob('/vault/**/*.md', { query: '?raw', import: 'default', eager: true })

// Papeliz drew each diagram when it exported the site, in the light and the dark theme.
const papelizVaultDiagramDrawingsBySource = new Map(
  papelizVaultDiagrams.map((papelizVaultDiagram) => [papelizVaultDiagram.mermaidDiagramSource, papelizVaultDiagram.mermaidDrawResultsByTheme]),
)

async function drawPapelizVaultDiagram(mermaidDiagramSource, htmlExportTheme) {
  return (
    papelizVaultDiagramDrawingsBySource.get(mermaidDiagramSource)?.[htmlExportTheme] ?? {
      mermaidDiagramErrorMessage: 'it is new or changed since the export. Export the website from Papeliz again to draw it.',
    }
  )
}

let papelizSiteContentPromise = null

export function loadPapelizSiteContent() {
  // Made once per build; the dev server makes it again for every page, so edits show at once.
  if (papelizSiteContentPromise !== null && !import.meta.env.DEV) return papelizSiteContentPromise
  const htmlExportSiteNotes = Object.entries(papelizVaultNoteTextsByVaultPath).map(([vaultFilePath, vaultNoteText]) => ({
    vaultNoteRelativePath: vaultFilePath.replace(/^\/vault\//, ''),
    vaultNoteText,
  }))
  // Links resolve over the whole vault Papeliz exported from, so a link to a note that wasn't
  // exported reads as text, and over any note added here since.
  const vaultNoteRelativePaths = [...new Set([...papelizSiteSettings.papelizVaultNoteRelativePaths, ...htmlExportSiteNotes.map((siteNote) => siteNote.vaultNoteRelativePath)])]
  papelizSiteContentPromise = buildPapelizHtmlExportSiteContent({
    htmlExportSiteName: papelizSiteSettings.htmlExportSiteName,
    htmlExportSiteNotes,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver(vaultNoteRelativePaths),
    drawHtmlExportMermaidDiagramSvg: papelizSiteSettings.papelizDrawsMermaidDiagrams ? drawPapelizVaultDiagram : null,
    htmlExportVaultAttachmentFileRelativePaths: [...new Set([...papelizSiteSettings.papelizVaultAttachmentFileRelativePaths, ...listPapelizAttachmentFiles()])],
  })
  return papelizSiteContentPromise
}
