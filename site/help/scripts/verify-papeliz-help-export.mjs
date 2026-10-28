#!/usr/bin/env node
// Checks the help site's static export in out/ after a build:
//   - the help home, the 404 page, and a page for every guide the home page lists;
//   - every /help/... link and asset in the exported HTML points at a file in out/, and no link
//     leaves out the /help base path;
//   - on a Windows build, every route prefetch file also exists under its dot-joined name (see
//     build_tools/site/papeliz-site-repair-windows-segment-files.mjs);
//   - no page's visible text names words that don't belong on it.
// Usage, from site/help: node scripts/verify-papeliz-help-export.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizHelpSiteDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const papelizHelpExportDirectory = path.join(papelizHelpSiteDirectory, 'out')
const papelizHelpBasePath = '/help'
// Only this guide may name the recommended provider preset.
const papelizHelpProviderArticleSlug = 'choose-a-provider'

const papelizHelpBannedWordPatterns = [/\bpanulat\b/i, /hackathon/i, /cerebral\s+valley/i, /\bllama\b/i]
const papelizHelpProviderOnlyWordPatterns = [/\bmeta\b/i, /\bmuse\b/i]

const exportProblems = []

function listFilesBelow(directory) {
  const filePaths = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) filePaths.push(...listFilesBelow(entryPath))
    else if (entry.isFile()) filePaths.push(entryPath)
  }
  return filePaths
}

function describeExportPath(exportFilePath) {
  return path.relative(papelizHelpExportDirectory, exportFilePath).split(path.sep).join('/')
}

// "/help/what-is-papeliz/#a" -> out/what-is-papeliz/index.html
function resolveHelpUrlToExportFile(helpUrl) {
  const helpUrlPath = decodeURI(helpUrl.split('#')[0].split('?')[0]).slice(papelizHelpBasePath.length)
  const exportRelativePath = helpUrlPath === '' || helpUrlPath.endsWith('/') ? `${helpUrlPath}index.html` : helpUrlPath
  return path.join(papelizHelpExportDirectory, ...exportRelativePath.split('/').filter((urlPathPart) => urlPathPart.length > 0))
}

function describeVisibleText(exportedHtml) {
  return exportedHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
}

if (!existsSync(papelizHelpExportDirectory)) {
  console.error('site/help/out does not exist. Build the help site first (pnpm help:build from the repository root).')
  process.exit(1)
}

for (const requiredPage of ['index.html', '404.html']) {
  if (!existsSync(path.join(papelizHelpExportDirectory, requiredPage))) exportProblems.push(`Missing ${requiredPage}`)
}

// The home page lists every guide, grouped; each must have its own page.
const helpHomeHtml = existsSync(path.join(papelizHelpExportDirectory, 'index.html'))
  ? readFileSync(path.join(papelizHelpExportDirectory, 'index.html'), 'utf8')
  : ''
const listedGuideSlugs = new Set(
  [...helpHomeHtml.matchAll(/href="\/help\/([a-z0-9-]+)\/"/g)].map((guideLinkMatch) => guideLinkMatch[1]),
)
if (listedGuideSlugs.size === 0) exportProblems.push('The help home lists no guides.')
for (const listedGuideSlug of listedGuideSlugs) {
  if (!existsSync(path.join(papelizHelpExportDirectory, listedGuideSlug, 'index.html'))) {
    exportProblems.push(`The help home lists “${listedGuideSlug}”, but out/${listedGuideSlug}/index.html is missing`)
  }
}
if (!listedGuideSlugs.has(papelizHelpProviderArticleSlug)) {
  exportProblems.push(`The provider guide “${papelizHelpProviderArticleSlug}” is not listed; update this script if it moved.`)
}

const exportedFilePaths = listFilesBelow(papelizHelpExportDirectory)
const exportedHtmlPaths = exportedFilePaths.filter((exportFilePath) => exportFilePath.endsWith('.html'))
let checkedLinkCount = 0

for (const exportedHtmlPath of exportedHtmlPaths) {
  const exportedHtml = readFileSync(exportedHtmlPath, 'utf8')
  const exportedPageName = describeExportPath(exportedHtmlPath)

  for (const linkMatch of exportedHtml.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const linkUrl = linkMatch[1]
    if (!linkUrl.startsWith('/') || linkUrl.startsWith('//')) continue
    // The website's home, outside the help site.
    if (linkUrl === '/') continue
    if (linkUrl !== papelizHelpBasePath && !linkUrl.startsWith(`${papelizHelpBasePath}/`)) {
      exportProblems.push(`${exportedPageName}: “${linkUrl}” leaves out the ${papelizHelpBasePath} base path`)
      continue
    }
    checkedLinkCount += 1
    const linkedExportFile = resolveHelpUrlToExportFile(linkUrl)
    if (!existsSync(linkedExportFile) || !statSync(linkedExportFile).isFile()) {
      exportProblems.push(`${exportedPageName}: “${linkUrl}” points at a missing file`)
    }
  }

  const visibleText = describeVisibleText(exportedHtml)
  const isProviderGuide = exportedPageName === `${papelizHelpProviderArticleSlug}/index.html`
  const checkedWordPatterns = isProviderGuide ? papelizHelpBannedWordPatterns : [...papelizHelpBannedWordPatterns, ...papelizHelpProviderOnlyWordPatterns]
  for (const checkedWordPattern of checkedWordPatterns) {
    const bannedWordMatch = visibleText.match(checkedWordPattern)
    if (bannedWordMatch) exportProblems.push(`${exportedPageName}: names “${bannedWordMatch[0]}”`)
  }
}

// Windows builds write route prefetch files into `__next.*` folders; each file must also exist
// under its dot-joined name beside the folder, where the browser asks for it.
for (const exportedFilePath of exportedFilePaths) {
  const exportedFileParts = describeExportPath(exportedFilePath).split('/')
  const misplacedFolderIndex = exportedFileParts.findIndex(
    (exportedFilePart, partIndex) => partIndex < exportedFileParts.length - 1 && exportedFilePart.startsWith('__next.'),
  )
  if (misplacedFolderIndex === -1) continue
  const dotJoinedName = exportedFileParts.slice(misplacedFolderIndex).join('.')
  const dotJoinedPath = path.join(papelizHelpExportDirectory, ...exportedFileParts.slice(0, misplacedFolderIndex), dotJoinedName)
  if (!existsSync(dotJoinedPath)) {
    exportProblems.push(
      `${describeExportPath(exportedFilePath)} has no dot-joined copy; run node build_tools/site/papeliz-site-repair-windows-segment-files.mjs site/help/out`,
    )
  }
}

if (exportProblems.length > 0) {
  console.error(`Help export check failed (${exportProblems.length}):`)
  for (const exportProblem of exportProblems) console.error(`  - ${exportProblem}`)
  process.exit(1)
}

console.log(
  `Help export OK: ${listedGuideSlugs.size} guides, ${exportedHtmlPaths.length} pages, ${checkedLinkCount} internal links and assets checked.`,
)
