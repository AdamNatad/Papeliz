// Renders the website's layout once with Astro, with a marker in each place Papeliz fills, and
// writes it into the webapp as its page shell. Papeliz exports websites in the browser, where Astro
// can't run, so it fills this shell for every page instead. Run it after changing the layout:
//   pnpm --filter @papeliz/html-export-astro-site page-shell
import { build } from 'astro'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const templateFolderUrl = new URL('../', import.meta.url)
// The files the shell is made from; the webapp's test hashes the same files the same way, so it
// notices a layout changed without the shell being made again.
const pageShellSourceRelativePaths = ['src/layouts/PapelizSitePage.astro', 'papeliz-page-shell/pages/index.astro']
const generatedPageShellFileUrl = new URL('../../web/src/modules/html-export/papeliz-html-export-site-page-shell.generated.ts', import.meta.url)

await build({
  root: fileURLToPath(templateFolderUrl),
  // Astro reads the config file's path from the project root.
  configFile: './astro.papeliz-page-shell.config.mjs',
  logLevel: 'warn',
})
const pageShellHtml = readFileSync(new URL('node_modules/.papeliz-page-shell/index.html', templateFolderUrl), 'utf8').trim()

const pageShellSourceText = pageShellSourceRelativePaths
  .map((sourceRelativePath) => `${sourceRelativePath}\n${readFileSync(new URL(sourceRelativePath, templateFolderUrl), 'utf8').replace(/\r\n/g, '\n')}`)
  .join('\n')
const pageShellSourceHash = createHash('sha256').update(pageShellSourceText, 'utf8').digest('hex')

writeFileSync(
  generatedPageShellFileUrl,
  [
    '// Made by `pnpm --filter @papeliz/html-export-astro-site page-shell` from the website\'s Astro layout',
    '// (app/html-export-astro-site/src/layouts/PapelizSitePage.astro). Change the layout and run that',
    '// command again rather than editing this file.',
    '',
    `export const papelizHtmlExportSitePageShellSourceHash = '${pageShellSourceHash}'`,
    '',
    `export const papelizHtmlExportSitePageShellHtml = ${JSON.stringify(pageShellHtml)}`,
    '',
  ].join('\n'),
)
console.log(`Page shell written (${pageShellHtml.length} characters, source ${pageShellSourceHash.slice(0, 12)}).`)
