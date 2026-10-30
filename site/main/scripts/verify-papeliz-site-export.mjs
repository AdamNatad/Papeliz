#!/usr/bin/env node
// Checks the website's static export in out/ after `pnpm site:build`:
// - every page, the 404 page, robots.txt, sitemap.xml, _headers, the favicon, the home-screen icon
//   and the social banner exist;
// - every internal link in the exported HTML points at a file in out/;
// - the license page carries the repository's root LICENSE text;
// - page text names no other project or event, and names the default provider only on the home and
//   providers pages; the Adam Natad page alone may name Adam's other apps (Adam, 2026-10-28);
// - page text uses the app's view names (MD Code, MD View), not the retired MD Editor and MD Viewer;
// - no exported page or route payload points at a loopback address.
// Exits 1 with a list of problems, 0 when the export is clean.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizSitePackageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const papelizSiteExportDirectory = path.join(papelizSitePackageDirectory, 'out')
const papelizRepositoryLicensePath = path.join(papelizSitePackageDirectory, '..', '..', 'LICENSE')

// The same list as papelizSitePagePaths in lib/papeliz-site-navigation.ts.
const papelizSiteExpectedPagePaths = [
  '/',
  '/pricing/',
  '/sync/',
  '/download/',
  '/features/',
  '/providers/',
  '/roadmap/',
  '/changelog/',
  '/about/',
  '/adam-natad/',
  '/community/',
  '/privacy/',
  '/terms/',
  '/license/',
]
const papelizSiteExpectedFiles = ['404.html', 'robots.txt', 'sitemap.xml', '_headers', 'favicon.svg', 'apple-touch-icon.png', 'papeliz-social-banner-1200x630.png']

// Served by the other packages once everything is assembled into one folder.
const papelizSiteLinkPrefixesServedElsewhere = ['/app/', '/help/']

const papelizSiteBannedTextPatterns = [/panulat/i, /hackathon/i, /cerebral valley/i, /\bllama\b/i]
// The Adam Natad page is kept as it is on Adam's other site, so it names his other apps (Adam, 2026-10-28).
const papelizSiteBannedTextAllowedByPage = { 'adam-natad/index.html': [/panulat/i] }
const papelizSiteProviderNamePatterns = [/\bMeta\b/, /\bMuse\b/]
const papelizSiteProviderNameAllowedPages = ['index.html', 'providers/index.html']
const papelizSiteRetiredViewNamePatterns = [/\bMD Editor\b/i, /\bMD Viewer\b/i]

const papelizSiteExportProblems = []

function listExportFilesBelow(directory) {
  const exportFilePaths = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) exportFilePaths.push(...listExportFilesBelow(entryPath))
    else if (entry.isFile()) exportFilePaths.push(entryPath)
  }
  return exportFilePaths
}

function decodeHtmlEntities(htmlText) {
  return htmlText
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function visibleTextOfHtml(htmlText) {
  return decodeHtmlEntities(
    htmlText
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function exportFileForSitePath(sitePath) {
  const relativeSitePath = decodeURIComponent(sitePath).replace(/^\/+/, '')
  return relativeSitePath === '' || relativeSitePath.endsWith('/')
    ? path.join(papelizSiteExportDirectory, relativeSitePath, 'index.html')
    : path.join(papelizSiteExportDirectory, relativeSitePath)
}

if (!existsSync(papelizSiteExportDirectory)) {
  console.error(' [error] site/main/out does not exist. Build the site first: pnpm site:build')
  process.exit(1)
}

for (const expectedPagePath of papelizSiteExpectedPagePaths) {
  if (!existsSync(exportFileForSitePath(expectedPagePath))) papelizSiteExportProblems.push(`Missing page: ${expectedPagePath}`)
}
for (const expectedFile of papelizSiteExpectedFiles) {
  if (!existsSync(path.join(papelizSiteExportDirectory, expectedFile))) papelizSiteExportProblems.push(`Missing file: ${expectedFile}`)
}

const papelizSiteExportFilePaths = listExportFilesBelow(papelizSiteExportDirectory)
const papelizSiteExportHtmlPaths = papelizSiteExportFilePaths.filter((exportFilePath) => exportFilePath.endsWith('.html'))

for (const exportHtmlPath of papelizSiteExportHtmlPaths) {
  const exportHtmlName = path.relative(papelizSiteExportDirectory, exportHtmlPath).split(path.sep).join('/')
  const exportHtmlText = readFileSync(exportHtmlPath, 'utf8')

  for (const linkMatch of exportHtmlText.matchAll(/href="(\/[^"]*)"/g)) {
    const linkTarget = decodeHtmlEntities(linkMatch[1])
    if (linkTarget.startsWith('//') || linkTarget.startsWith('/_next/')) continue
    if (papelizSiteLinkPrefixesServedElsewhere.some((linkPrefix) => linkTarget.startsWith(linkPrefix))) continue
    const linkPath = linkTarget.split('#')[0].split('?')[0]
    const linkFile = exportFileForSitePath(linkPath)
    if (!existsSync(linkFile) || !statSync(linkFile).isFile()) {
      papelizSiteExportProblems.push(`${exportHtmlName}: broken link ${linkTarget}`)
    }
  }

  const exportPageText = visibleTextOfHtml(exportHtmlText)
  const papelizSiteBannedTextAllowedHere = papelizSiteBannedTextAllowedByPage[exportHtmlName] ?? []
  for (const bannedTextPattern of papelizSiteBannedTextPatterns) {
    if (papelizSiteBannedTextAllowedHere.some((allowedTextPattern) => allowedTextPattern.source === bannedTextPattern.source)) continue
    if (bannedTextPattern.test(exportPageText)) papelizSiteExportProblems.push(`${exportHtmlName}: page text matches ${bannedTextPattern}`)
  }
  for (const retiredViewNamePattern of papelizSiteRetiredViewNamePatterns) {
    if (retiredViewNamePattern.test(exportPageText)) {
      papelizSiteExportProblems.push(`${exportHtmlName}: uses a retired view name (${retiredViewNamePattern}); the views are MD Code and MD View`)
    }
  }
  if (!papelizSiteProviderNameAllowedPages.includes(exportHtmlName)) {
    for (const providerNamePattern of papelizSiteProviderNamePatterns) {
      if (providerNamePattern.test(exportPageText)) {
        papelizSiteExportProblems.push(`${exportHtmlName}: names the default provider (${providerNamePattern}) outside the home and providers pages`)
      }
    }
  }
}

// Pages, route payloads and XML only: the framework's own scripts legitimately mention "localhost".
for (const exportFilePath of papelizSiteExportFilePaths) {
  if (!/\.(html|txt|xml)$/.test(exportFilePath)) continue
  if (/localhost|127\.0\.0\.1/.test(readFileSync(exportFilePath, 'utf8'))) {
    papelizSiteExportProblems.push(`${path.relative(papelizSiteExportDirectory, exportFilePath)}: contains a loopback address`)
  }
}

const papelizSiteLicensePagePath = exportFileForSitePath('/license/')
if (existsSync(papelizSiteLicensePagePath)) {
  const normalizeLicenseWhitespace = (licenseText) => licenseText.replace(/\s+/g, ' ').trim()
  const papelizRepositoryLicenseText = normalizeLicenseWhitespace(readFileSync(papelizRepositoryLicensePath, 'utf8'))
  const papelizSiteLicensePageText = normalizeLicenseWhitespace(visibleTextOfHtml(readFileSync(papelizSiteLicensePagePath, 'utf8')))
  if (!papelizSiteLicensePageText.includes(papelizRepositoryLicenseText)) {
    papelizSiteExportProblems.push('license/index.html: does not contain the root LICENSE text')
  }
}

if (papelizSiteExportProblems.length > 0) {
  console.error(` [error] The site export has ${papelizSiteExportProblems.length} problem(s):`)
  for (const papelizSiteExportProblem of papelizSiteExportProblems) console.error(`  - ${papelizSiteExportProblem}`)
  process.exit(1)
}

console.log(
  ` [ok] Site export checked: ${papelizSiteExpectedPagePaths.length} pages, ${papelizSiteExportHtmlPaths.length} HTML files, links, license text and wording.`,
)
