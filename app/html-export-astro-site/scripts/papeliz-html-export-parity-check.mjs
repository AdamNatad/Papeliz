// Checks that the Astro project inside an exported website builds the same website Papeliz made in
// the browser. It runs the webapp's own export code (through its Vite config), writes the `.zip`'s
// files into .papeliz-parity-check/, builds astro-project/ there with Astro, and compares every file
// Astro built with the file Papeliz wrote, byte for byte. Run it after changing the layout, the site
// files or the export code:
//   pnpm --filter @papeliz/html-export-astro-site parity-check
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as buildWithAstro } from 'astro'

const templateFolder = fileURLToPath(new URL('../', import.meta.url))
const webappFolder = join(templateFolder, '../web')
const parityCheckFolder = join(templateFolder, '.papeliz-parity-check')
const astroProjectFolder = join(parityCheckFolder, 'astro-project')

// Notes beyond the sample vault that test names and text a page must escape the same way Astro does.
const parityCheckExtraNotes = [
  { vaultNoteRelativePath: 'Ideas/Café crème.md', vaultNoteText: "# Café crème\n\nMilk & coffee, < 3 minutes. Back to [[Start here]]; see [[Old plan]] and [[What's next]].\n" },
  { vaultNoteRelativePath: "Ideas/What's next.md", vaultNoteText: "---\ntags: [plans]\nlang: fil\n---\n# What's next\n\n> [!tip] \"Quotes\" & 'apostrophes'\n> In a callout.\n" },
  { vaultNoteRelativePath: 'index.md', vaultNoteText: 'A note named index takes another page name.\n' },
  {
    vaultNoteRelativePath: 'Ideas/Pictures and files.md',
    vaultNoteText: "![[bed plan.png|240]] ![[café.png|Café's sign]]\n\n![The plan](pictures/bed%20plan.png) and [the brief](../files/brief.pdf), [[brief.pdf]], ![Gone](gone.png)\n",
  },
]
// In the vault, not exported: links to it read as text.
const parityCheckUnexportedNotePaths = ['Archive/Old plan.md']
// The vault's other files: a 1×1 PNG with no metadata, and a stand-in PDF. One is never used.
const parityCheckPictureBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const parityCheckVaultFileBytesByPath = new Map([
  ['Ideas/pictures/bed plan.png', parityCheckPictureBytes],
  ['pictures/café.png', parityCheckPictureBytes],
  ['files/brief.pdf', Buffer.from('%PDF-1.7 stand-in\n')],
  ['files/unused.pdf', Buffer.from('%PDF-1.7 unused\n')],
])

// Recycles the last check's folder with the `trash` command, never deleting it outright.
function recycleLastParityCheckFolder() {
  if (!existsSync(parityCheckFolder)) return
  const trashRun = spawnSync('trash', [parityCheckFolder.replace(/\\/g, '/')], { encoding: 'utf8', shell: process.platform === 'win32' })
  if (trashRun.status !== 0 || existsSync(parityCheckFolder)) {
    const trashAnswer = [trashRun.error?.message, trashRun.stdout, trashRun.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Recycle ${parityCheckFolder} with \`trash\` first; the trash command didn't (${trashAnswer || `exit ${trashRun.status}`}).`)
  }
}

function listFilesBelow(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((folderEntry) => folderEntry.isFile())
    .map((folderEntry) => relative(folder, join(folderEntry.parentPath, folderEntry.name)).replace(/\\/g, '/'))
    .sort()
}

recycleLastParityCheckFolder()

// The webapp's export code, loaded the way the webapp builds it: the core plugin, `?raw` files, JSON.
const requireFromWebapp = createRequire(join(webappFolder, 'package.json'))
const { createServer } = await import(pathToFileURL(requireFromWebapp.resolve('vite')).href)
const viteServer = await createServer({
  configFile: join(webappFolder, 'vite.config.ts'),
  root: webappFolder,
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  // Its own cache, and no browser packages prepared: sharing the webapp's cache would pull it from
  // under a webapp dev server that is running.
  cacheDir: join(templateFolder, 'node_modules/.papeliz-parity-check-vite'),
  optimizeDeps: { noDiscovery: true, include: [] },
})
let siteZipEntries
let sampleVaultNotes
try {
  const { buildPapelizHtmlExportSiteFiles } = await viteServer.ssrLoadModule('/src/modules/html-export/papeliz-html-export-site.ts')
  const { papelizSampleVaultNotes } = await viteServer.ssrLoadModule('/src/modules/vault/papeliz-sample-vault-notes.ts')
  const { papelizDefaultNoteTypography } = await viteServer.ssrLoadModule('/src/modules/workspace/papeliz-note-typography-store.ts')
  sampleVaultNotes = [...papelizSampleVaultNotes, ...parityCheckExtraNotes]
  siteZipEntries = await buildPapelizHtmlExportSiteFiles({
    htmlExportSiteName: "Sample vault & Adam's notes",
    htmlExportSiteNotes: sampleVaultNotes,
    htmlExportVaultNoteRelativePaths: [...sampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath), ...parityCheckUnexportedNotePaths],
    htmlExportNoteTypography: papelizDefaultNoteTypography,
    htmlExportVaultAttachmentFileRelativePaths: [...parityCheckVaultFileBytesByPath.keys()],
    readHtmlExportVaultFileBytes: async (vaultFileRelativePath) => new Uint8Array(parityCheckVaultFileBytesByPath.get(vaultFileRelativePath)),
    // Mermaid needs a page; any drawing will do, since the project uses the drawings Papeliz keeps.
    drawHtmlExportMermaidDiagramSvg: async (mermaidDiagramSource, htmlExportTheme) => ({
      mermaidDiagramSvgText: `<svg id="parity-check-${htmlExportTheme}" xmlns="http://www.w3.org/2000/svg"><text>${mermaidDiagramSource.length}</text></svg>`,
    }),
    // On the dev server a font's address is a path in the webapp or under /@fs/.
    readHtmlExportFontFileBytes: async (fontFileUrl) =>
      new Uint8Array(readFileSync(fontFileUrl.startsWith('/@fs/') ? fontFileUrl.slice('/@fs/'.length) : join(webappFolder, fontFileUrl.split('?')[0]))),
  })
} finally {
  await viteServer.close()
}

for (const { zipEntryPath, zipEntryBytes } of siteZipEntries) {
  const filePath = join(parityCheckFolder, zipEntryPath)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, zipEntryBytes)
}
console.log(`Papeliz wrote ${siteZipEntries.length} files for ${sampleVaultNotes.length} notes into ${parityCheckFolder}.`)

// The project finds Astro in this package's node_modules, as `npm install` would give it its own.
await buildWithAstro({ root: astroProjectFolder, logLevel: 'warn' })

const papelizSiteFilePaths = siteZipEntries.map((siteZipEntry) => siteZipEntry.zipEntryPath).filter((siteFilePath) => !siteFilePath.startsWith('astro-project/')).sort()
const astroSiteFilePaths = listFilesBelow(join(astroProjectFolder, 'dist'))
const parityProblems = []
for (const papelizSiteFilePath of papelizSiteFilePaths) if (!astroSiteFilePaths.includes(papelizSiteFilePath)) parityProblems.push(`Astro didn't build ${papelizSiteFilePath}`)
for (const astroSiteFilePath of astroSiteFilePaths) if (!papelizSiteFilePaths.includes(astroSiteFilePath)) parityProblems.push(`Astro built ${astroSiteFilePath}, which Papeliz doesn't write`)
for (const sharedFilePath of papelizSiteFilePaths.filter((siteFilePath) => astroSiteFilePaths.includes(siteFilePath))) {
  const papelizFileBytes = readFileSync(join(parityCheckFolder, sharedFilePath))
  const astroFileBytes = readFileSync(join(astroProjectFolder, 'dist', sharedFilePath))
  if (papelizFileBytes.equals(astroFileBytes)) continue
  let firstDifferenceIndex = 0
  while (papelizFileBytes[firstDifferenceIndex] === astroFileBytes[firstDifferenceIndex]) firstDifferenceIndex += 1
  const describeAround = (fileBytes) => JSON.stringify(fileBytes.subarray(Math.max(0, firstDifferenceIndex - 60), firstDifferenceIndex + 60).toString('utf8'))
  parityProblems.push(`${sharedFilePath} differs at byte ${firstDifferenceIndex}:\n  Papeliz: ${describeAround(papelizFileBytes)}\n  Astro:   ${describeAround(astroFileBytes)}`)
}

if (parityProblems.length > 0) {
  console.error(`The Astro project's build differs from Papeliz's site:\n${parityProblems.join('\n')}`)
  process.exit(1)
}
console.log(`The Astro project's build equals Papeliz's site: ${astroSiteFilePaths.length} files, byte for byte.`)
