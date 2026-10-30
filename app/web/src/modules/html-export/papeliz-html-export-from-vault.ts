import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { drawPapelizMermaidDiagramSvgForExport } from '../md-view/papeliz-md-view-mermaid-diagrams'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import type { PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import papelizWebappStylesheetText from '../../papeliz-webapp.css?raw'
import { readPapelizHtmlExportMdViewStyles } from './papeliz-html-export-md-view-styles'
import type { PapelizHtmlExportMermaidDiagramDrawer } from './papeliz-html-export-note-article'
import { buildPapelizOneNoteHtmlExportFile, getPapelizHtmlExportFileNameForNote } from './papeliz-html-export-one-note-file'
import { buildPapelizHtmlExportSiteZipFile, getPapelizHtmlExportSiteZipFileName } from './papeliz-html-export-site'

// Export › HTML from the open vault: the Settings gear's Export page loads this with `import()`
// when someone exports. One note becomes one `.html` file; several notes, a website in a `.zip`.

export interface PapelizVaultHtmlExportOptions {
  vaultAdapter: PapelizVaultAdapter
  vaultDisplayName: string
  // The ticked notes, in the file list's order.
  exportVaultNoteRelativePaths: readonly string[]
  // Every note in the vault: links resolve over them as MD View resolves them.
  everyVaultNoteRelativePath: readonly string[]
  htmlExportNoteTypography: PapelizNoteTypography
  onHtmlExportProgress?: (exportedNoteCount: number, htmlExportNoteCount: number) => void
  htmlExportAbortSignal?: AbortSignal
}

export interface PapelizVaultHtmlExportFileKind {
  htmlExportFileName: string
  htmlExportFileDescription: string
  htmlExportFileMediaType: string
  htmlExportFileExtension: string
}

// What the export will save, known before it runs, so the save dialog can open first.
export function describePapelizVaultHtmlExportFile(vaultDisplayName: string, exportVaultNoteRelativePaths: readonly string[]): PapelizVaultHtmlExportFileKind {
  const onlyExportVaultNoteRelativePath = exportVaultNoteRelativePaths.length === 1 ? exportVaultNoteRelativePaths[0] : undefined
  if (onlyExportVaultNoteRelativePath !== undefined) {
    return {
      htmlExportFileName: getPapelizHtmlExportFileNameForNote(onlyExportVaultNoteRelativePath),
      htmlExportFileDescription: 'Web page',
      htmlExportFileMediaType: 'text/html',
      htmlExportFileExtension: '.html',
    }
  }
  return {
    htmlExportFileName: getPapelizHtmlExportSiteZipFileName(vaultDisplayName),
    htmlExportFileDescription: 'Website (.zip)',
    htmlExportFileMediaType: 'application/zip',
    htmlExportFileExtension: '.zip',
  }
}

// Each color token's value in each theme, from the app's stylesheet, so diagrams are drawn in both
// themes whichever one the app shows.
function readPapelizHtmlExportThemeColors(): Record<'light' | 'dark', Map<string, string>> {
  const mdViewStyles = readPapelizHtmlExportMdViewStyles(papelizWebappStylesheetText)
  const readTokenDeclarations = (tokenDeclarations: readonly string[]) =>
    new Map(
      tokenDeclarations.map((tokenDeclaration) => {
        const declarationColonIndex = tokenDeclaration.indexOf(':')
        return [tokenDeclaration.slice(0, declarationColonIndex).trim(), tokenDeclaration.slice(declarationColonIndex + 1).trim()]
      }),
    )
  const lightThemeColors = readTokenDeclarations(mdViewStyles.lightThemeTokenDeclarations)
  // The dark theme lists only the tokens that change.
  return { light: lightThemeColors, dark: new Map([...lightThemeColors, ...readTokenDeclarations(mdViewStyles.darkThemeTokenDeclarations)]) }
}

export async function exportPapelizVaultNotesAsHtml(vaultExportOptions: PapelizVaultHtmlExportOptions): Promise<{ htmlExportFileName: string; htmlExportFileBlob: Blob }> {
  const { vaultAdapter, exportVaultNoteRelativePaths, htmlExportAbortSignal } = vaultExportOptions
  const htmlExportThemeColors = readPapelizHtmlExportThemeColors()
  const drawHtmlExportMermaidDiagramSvg: PapelizHtmlExportMermaidDiagramDrawer = (mermaidDiagramSource, htmlExportTheme) =>
    drawPapelizMermaidDiagramSvgForExport(mermaidDiagramSource, htmlExportTheme, (papelizColorVariableName) => htmlExportThemeColors[htmlExportTheme].get(papelizColorVariableName) ?? null)
  const htmlExportVaultAttachmentFileRelativePaths = await vaultAdapter.listVaultAttachmentFileRelativePaths()
  const readHtmlExportVaultFileBytes = async (vaultFileRelativePath: string) => new Uint8Array(await (await vaultAdapter.readVaultAttachmentFileBlob(vaultFileRelativePath)).arrayBuffer())

  const htmlExportSiteNotes: Array<{ vaultNoteRelativePath: string; vaultNoteText: string }> = []
  for (const vaultNoteRelativePath of exportVaultNoteRelativePaths) {
    htmlExportAbortSignal?.throwIfAborted()
    htmlExportSiteNotes.push({ vaultNoteRelativePath, vaultNoteText: await vaultAdapter.readVaultNoteText(vaultNoteRelativePath) })
  }

  const onlySiteNote = htmlExportSiteNotes.length === 1 ? htmlExportSiteNotes[0] : undefined
  if (onlySiteNote !== undefined) {
    const { htmlExportFileName, htmlExportFileText } = await buildPapelizOneNoteHtmlExportFile({
      ...onlySiteNote,
      resolveWikilinkTarget: createPapelizWikilinkTargetResolver(vaultExportOptions.everyVaultNoteRelativePath),
      htmlExportNoteTypography: vaultExportOptions.htmlExportNoteTypography,
      drawHtmlExportMermaidDiagramSvg,
      htmlExportVaultAttachmentFileRelativePaths,
      readHtmlExportVaultFileBytes,
    })
    vaultExportOptions.onHtmlExportProgress?.(1, 1)
    return { htmlExportFileName, htmlExportFileBlob: new Blob([htmlExportFileText], { type: 'text/html;charset=utf-8' }) }
  }
  return buildPapelizHtmlExportSiteZipFile({
    htmlExportSiteName: vaultExportOptions.vaultDisplayName,
    htmlExportSiteNotes,
    htmlExportVaultNoteRelativePaths: vaultExportOptions.everyVaultNoteRelativePath,
    htmlExportNoteTypography: vaultExportOptions.htmlExportNoteTypography,
    drawHtmlExportMermaidDiagramSvg,
    htmlExportVaultAttachmentFileRelativePaths,
    readHtmlExportVaultFileBytes,
    onHtmlExportProgress: vaultExportOptions.onHtmlExportProgress,
    htmlExportAbortSignal,
    htmlExportDate: new Date(),
  })
}
