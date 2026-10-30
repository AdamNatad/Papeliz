import { papelizHtmlExportCoreLicensesText, papelizHtmlExportCoreText } from 'virtual:papeliz-html-export-core'
import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import type { PapelizNoteTypography } from '../workspace/papeliz-note-typography-store'
import papelizHtmlExportAstroSiteGitignoreText from '../../../../html-export-astro-site/.gitignore?raw'
import papelizHtmlExportAstroSiteConfigText from '../../../../html-export-astro-site/astro.config.mjs?raw'
import papelizHtmlExportAstroSitePackageManifest from '../../../../html-export-astro-site/package.json'
import papelizHtmlExportAstroSiteReadmeText from '../../../../html-export-astro-site/README.md?raw'
import { buildPapelizHtmlExportFontFaceCss, choosePapelizHtmlExportFontFaces, readPapelizHtmlExportFontFileBytes, type PapelizHtmlExportFontFileReader } from './papeliz-html-export-fonts'
import type { PapelizHtmlExportMermaidDiagramDrawer, PapelizHtmlExportMermaidDrawResult, PapelizHtmlExportTheme } from './papeliz-html-export-note-article'
import { buildPapelizHtmlExportNoteStylesheet } from './papeliz-html-export-note-stylesheet'
import { getPapelizSafeFileNameStem, type PapelizHtmlExportVaultFileReader } from './papeliz-html-export-one-note-file'
import { buildPapelizHtmlExportSiteContent, papelizHtmlExportSiteAssetFolderName, type PapelizHtmlExportSiteContentOptions } from './papeliz-html-export-site-content'
import { fillPapelizHtmlExportSitePageShell } from './papeliz-html-export-site-page-shell'

// Export › several notes or the whole vault › HTML: a small website in one `.zip`. An index page and
// one page per note in the vault's folders, the folder list, search, Light and Dark, and beside every
// page its Markdown twin, with `llms.txt` listing them. Every link is relative and every script a
// plain script, so the site works opened from disk and on any static host. The pages fill the site's
// Astro layout (papeliz-html-export-site-page-shell.ts) with the site's content
// (papeliz-html-export-site-content.ts).
//
// The `.zip` also holds the same site as an Astro project, `astro-project/`: the layout, the notes
// in `vault/`, and the content code bundled as papeliz-html-export-core.mjs, so `npm run build` there
// gives these same files, and people can change the site and build it again.

export interface PapelizHtmlExportSiteOptions extends Omit<PapelizHtmlExportSiteContentOptions, 'resolveWikilinkTarget'> {
  // Every note in the vault, exported or not: links resolve over them as MD View resolves them.
  htmlExportVaultNoteRelativePaths: readonly string[]
  htmlExportNoteTypography: PapelizNoteTypography
  readHtmlExportFontFileBytes?: PapelizHtmlExportFontFileReader
  // Reads a picture or other file the notes use, for its copy.
  readHtmlExportVaultFileBytes: PapelizHtmlExportVaultFileReader
}

const papelizHtmlExportAstroProjectFolderName = 'astro-project'
const papelizHtmlExportAstroTemplateFolderPrefix = '../../../../html-export-astro-site/'
// The template's source, as text, by its path in the template folder.
const papelizHtmlExportAstroTemplateSourceLoaders = import.meta.glob(['../../../../html-export-astro-site/src/**/*', '../../../../html-export-astro-site/public/**/*'], {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

// A template file's text by its path in the template folder ("public/papeliz-site/papeliz-site.css").
async function readPapelizHtmlExportAstroTemplateText(templateFilePath: string): Promise<string> {
  const loadTemplateSourceText = papelizHtmlExportAstroTemplateSourceLoaders[`${papelizHtmlExportAstroTemplateFolderPrefix}${templateFilePath}`]
  if (loadTemplateSourceText === undefined) throw new Error(`The website template has no ${templateFilePath}.`)
  return loadTemplateSourceText()
}

// The exported project's own package.json: Astro, at the version Papeliz's template is built with.
function buildPapelizHtmlExportAstroProjectManifestText(siteName: string): string {
  const siteNameSlug = siteName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${JSON.stringify(
    {
      name: `${siteNameSlug.length > 0 ? siteNameSlug : 'notes'}-website`,
      private: true,
      type: 'module',
      scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
      dependencies: { astro: papelizHtmlExportAstroSitePackageManifest.devDependencies.astro },
    },
    null,
    2,
  )}\n`
}

// Every file of the website, ready for the `.zip`.
export async function buildPapelizHtmlExportSiteFiles(siteOptions: PapelizHtmlExportSiteOptions): Promise<PapelizExportZipEntry[]> {
  const utf8Encoder = new TextEncoder()
  const siteZipEntries: PapelizExportZipEntry[] = []
  const addSiteTextFile = (siteFilePath: string, siteFileText: string) => siteZipEntries.push({ zipEntryPath: siteFilePath, zipEntryBytes: utf8Encoder.encode(siteFileText) })
  const addAstroProjectTextFile = (projectFilePath: string, projectFileText: string) => addSiteTextFile(`${papelizHtmlExportAstroProjectFolderName}/${projectFilePath}`, projectFileText)

  // Each drawing is kept for the Astro project, which can't run Mermaid while it builds.
  const mermaidDrawResultsBySource = new Map<string, Partial<Record<PapelizHtmlExportTheme, PapelizHtmlExportMermaidDrawResult>>>()
  const drawHtmlExportMermaidDiagramSvg = siteOptions.drawHtmlExportMermaidDiagramSvg
  const drawAndKeepMermaidDiagram: PapelizHtmlExportMermaidDiagramDrawer | null =
    drawHtmlExportMermaidDiagramSvg === null
      ? null
      : async (mermaidDiagramSource, htmlExportTheme) => {
          const mermaidDrawResult = await drawHtmlExportMermaidDiagramSvg(mermaidDiagramSource, htmlExportTheme)
          mermaidDrawResultsBySource.set(mermaidDiagramSource, { ...mermaidDrawResultsBySource.get(mermaidDiagramSource), [htmlExportTheme]: mermaidDrawResult })
          return mermaidDrawResult
        }

  const siteContent = await buildPapelizHtmlExportSiteContent({
    ...siteOptions,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver(siteOptions.htmlExportVaultNoteRelativePaths),
    drawHtmlExportMermaidDiagramSvg: drawAndKeepMermaidDiagram,
  })
  for (const { sitePageFilePath, sitePageValues } of siteContent.sitePageFiles) addSiteTextFile(sitePageFilePath, fillPapelizHtmlExportSitePageShell(sitePageValues))
  for (const { siteFilePath, siteFileText } of siteContent.siteTextFiles) addSiteTextFile(siteFilePath, siteFileText)

  const htmlExportFontFaces = choosePapelizHtmlExportFontFaces(siteOptions.htmlExportNoteTypography.noteFontFamily, { hasCodeText: siteContent.hasCodeText, hasSiteChrome: true })
  const mdViewStylesheetText = `${buildPapelizHtmlExportNoteStylesheet({
    htmlExportThemeChoice: 'site-theme-switch',
    htmlExportNoteTypography: siteOptions.htmlExportNoteTypography,
    fontFaceCss: buildPapelizHtmlExportFontFaceCss(htmlExportFontFaces, (htmlExportFontFace) => `fonts/${htmlExportFontFace.fontFileName}`),
  })}\n`
  const siteAssetTextFiles: Array<[string, string]> = [
    ['papeliz-md-view.css', mdViewStylesheetText],
    ['papeliz-site.css', await readPapelizHtmlExportAstroTemplateText('public/papeliz-site/papeliz-site.css')],
    ['papeliz-site.js', await readPapelizHtmlExportAstroTemplateText('public/papeliz-site/papeliz-site.js')],
    ['papeliz-site-theme-boot.js', await readPapelizHtmlExportAstroTemplateText('public/papeliz-site/papeliz-site-theme-boot.js')],
  ]
  for (const [siteAssetFileName, siteAssetFileText] of siteAssetTextFiles) addSiteTextFile(`${papelizHtmlExportSiteAssetFolderName}/${siteAssetFileName}`, siteAssetFileText)
  const readHtmlExportFontFileBytes = siteOptions.readHtmlExportFontFileBytes ?? readPapelizHtmlExportFontFileBytes
  const fontFileEntries: Array<[string, Uint8Array]> = []
  for (const htmlExportFontFace of htmlExportFontFaces) {
    const fontFileEntry: [string, Uint8Array] = [`${papelizHtmlExportSiteAssetFolderName}/fonts/${htmlExportFontFace.fontFileName}`, await readHtmlExportFontFileBytes(htmlExportFontFace.fontFileUrl)]
    fontFileEntries.push(fontFileEntry)
    siteZipEntries.push({ zipEntryPath: fontFileEntry[0], zipEntryBytes: fontFileEntry[1] })
  }

  // The pictures and files the notes use, copied in their vault folders; the Astro project keeps
  // the same copies in public/, which its build copies as they are.
  for (const { vaultFileRelativePath, siteFilePath } of siteContent.siteAttachmentFiles) {
    const vaultFileBytes = await siteOptions.readHtmlExportVaultFileBytes(vaultFileRelativePath)
    siteZipEntries.push({ zipEntryPath: siteFilePath, zipEntryBytes: vaultFileBytes })
    siteZipEntries.push({ zipEntryPath: `${papelizHtmlExportAstroProjectFolderName}/public/${siteFilePath}`, zipEntryBytes: vaultFileBytes })
  }

  // The Astro project: the template as it is, then what this export adds to it.
  for (const [templateSourceModulePath, loadTemplateSourceText] of Object.entries(papelizHtmlExportAstroTemplateSourceLoaders).sort(([firstPath], [secondPath]) => (firstPath < secondPath ? -1 : 1))) {
    addAstroProjectTextFile(templateSourceModulePath.slice(papelizHtmlExportAstroTemplateFolderPrefix.length), await loadTemplateSourceText())
  }
  addAstroProjectTextFile('README.md', papelizHtmlExportAstroSiteReadmeText)
  addAstroProjectTextFile('astro.config.mjs', papelizHtmlExportAstroSiteConfigText)
  addAstroProjectTextFile('.gitignore', papelizHtmlExportAstroSiteGitignoreText)
  addAstroProjectTextFile('package.json', buildPapelizHtmlExportAstroProjectManifestText(siteOptions.htmlExportSiteName))
  addAstroProjectTextFile(`public/${papelizHtmlExportSiteAssetFolderName}/papeliz-md-view.css`, mdViewStylesheetText)
  for (const [fontFilePath, fontFileBytes] of fontFileEntries) siteZipEntries.push({ zipEntryPath: `${papelizHtmlExportAstroProjectFolderName}/public/${fontFilePath}`, zipEntryBytes: fontFileBytes })
  addAstroProjectTextFile('src/papeliz/papeliz-html-export-core.mjs', papelizHtmlExportCoreText)
  addAstroProjectTextFile('src/papeliz/papeliz-html-export-core-licenses.md', papelizHtmlExportCoreLicensesText)
  addAstroProjectTextFile(
    'src/papeliz/papeliz-site-settings.json',
    `${JSON.stringify(
      {
        htmlExportSiteName: siteOptions.htmlExportSiteName,
        papelizVaultNoteRelativePaths: siteOptions.htmlExportVaultNoteRelativePaths,
        papelizVaultAttachmentFileRelativePaths: siteOptions.htmlExportVaultAttachmentFileRelativePaths,
        papelizDrawsMermaidDiagrams: drawAndKeepMermaidDiagram !== null,
      },
      null,
      2,
    )}\n`,
  )
  addAstroProjectTextFile(
    'src/papeliz/papeliz-vault-diagrams.json',
    `${JSON.stringify(
      [...mermaidDrawResultsBySource].map(([mermaidDiagramSource, mermaidDrawResultsByTheme]) => ({ mermaidDiagramSource, mermaidDrawResultsByTheme })),
      null,
      2,
    )}\n`,
  )
  for (const siteNote of siteOptions.htmlExportSiteNotes) addAstroProjectTextFile(`vault/${siteNote.vaultNoteRelativePath}`, siteNote.vaultNoteText)
  return siteZipEntries
}

// "Field Notes" -> "Field Notes website.zip"
export function getPapelizHtmlExportSiteZipFileName(htmlExportSiteName: string): string {
  return `${getPapelizSafeFileNameStem(htmlExportSiteName, 'Notes')} website.zip`
}

export async function buildPapelizHtmlExportSiteZipFile(
  siteOptions: PapelizHtmlExportSiteOptions & { htmlExportDate: Date },
): Promise<{ htmlExportFileName: string; htmlExportFileBlob: Blob }> {
  const siteZipEntries = await buildPapelizHtmlExportSiteFiles(siteOptions)
  return {
    htmlExportFileName: getPapelizHtmlExportSiteZipFileName(siteOptions.htmlExportSiteName),
    htmlExportFileBlob: await writePapelizExportZipFile(siteZipEntries, { zipEntryModifiedDate: siteOptions.htmlExportDate }),
  }
}
