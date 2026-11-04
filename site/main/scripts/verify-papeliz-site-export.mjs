#!/usr/bin/env node
// Checks the website's static export in out/ after `pnpm site:build`:
// - every page, the 404 page, robots.txt, sitemap.xml, _headers, the favicon, the home-screen icon
//   and the social banner exist;
// - every internal link in the exported HTML points at a file in out/;
// - the license page carries the repository's root LICENSE text;
// - page text names no other project or event, and names the default provider only on the home and
//   providers pages; the Adam Natad page alone may name the author's other apps;
// - page text uses the app's view names (MD Code, MD View), not the retired MD Editor and MD Viewer;
// - no exported page or route payload points at a loopback address;
// - the Templates pages show their authors' own words (a template's name, description and tags, from
//   its repository), so the wording and loopback checks skip them; their links and script policies
//   are checked like every page's;
// - every page carries its strict script policy, with a hash for each of its inline scripts and no
//   inline handler (scripts/papeliz-site-page-script-policy.mjs), and the /account/* policy in
//   _headers hashes the account page's inline scripts in place of 'unsafe-inline' (the root
//   `pnpm site:build` writes it);
// - the Pricing and Sync pages open on yearly billing: the Yearly choice is the pressed one and every
//   paid plan's Subscribe starts checkout on yearly;
// - every short address in _redirects (app/%5Fredirects/route.ts), a short name or the repository's
//   own spelling, with and without the trailing slash, is a permanent redirect from a /templates/
//   address that has no page of its own and is no owner's to a page in the export whose canonical
//   link is that page.
// Exits 1 with a list of problems, 0 when the export is clean.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  findPapelizSitePageScriptPolicyProblems,
  hashPapelizSitePageInlineScript,
  readPapelizSitePageExtraScriptPolicy,
  readPapelizSitePageInlineScriptTexts,
} from './papeliz-site-page-script-policy.mjs'

const papelizSitePackageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const papelizSiteExportDirectory = path.join(papelizSitePackageDirectory, 'out')
const papelizRepositoryLicensePath = path.join(papelizSitePackageDirectory, '..', '..', 'LICENSE')

// The same list as papelizSitePagePaths in lib/papeliz-site-navigation.ts.
const papelizSiteExpectedPagePaths = [
  '/',
  '/pricing/',
  '/sync/',
  '/templates/',
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
const papelizSiteExpectedFiles = ['404.html', 'robots.txt', 'sitemap.xml', '_headers', '_redirects', 'favicon.svg', 'apple-touch-icon.png', 'papeliz-social-banner-1200x630.png']

// Served by the other packages once everything is assembled into one folder.
const papelizSiteLinkPrefixesServedElsewhere = ['/app/', '/help/']

const papelizSiteBannedTextPatterns = [/panulat/i, /cerebral valley/i, /\bllama\b/i]
// Papeliz is built for this hackathon, so any page may name it; its "Meta" is not the default
// provider.
const papelizSiteHackathonName = 'Meta Global AI Developer Hackathon 2026'
// The Adam Natad page is the author's profile, so it names the author's other apps.
const papelizSiteBannedTextAllowedByPage = { 'adam-natad/index.html': [/panulat/i] }
const papelizSiteProviderNamePatterns = [/\bMeta\b/, /\bMuse\b/]
const papelizSiteProviderNameAllowedPages = ['index.html', 'providers/index.html', 'features/index.html', 'changelog/index.html']
const papelizSiteRetiredViewNamePatterns = [/\bMD Editor\b/i, /\bMD Viewer\b/i]

const papelizSiteExportProblems = []

function isPapelizSiteTemplatesExportFile(exportFileName) {
  return exportFileName.startsWith('templates/')
}

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

  for (const papelizSitePageScriptPolicyProblem of findPapelizSitePageScriptPolicyProblems(exportHtmlText, readPapelizSitePageExtraScriptPolicy(exportHtmlName))) {
    papelizSiteExportProblems.push(`${exportHtmlName}: ${papelizSitePageScriptPolicyProblem}`)
  }
  if (isPapelizSiteTemplatesExportFile(exportHtmlName)) continue

  const exportPageText = visibleTextOfHtml(exportHtmlText).replaceAll(papelizSiteHackathonName, '')
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
  if (isPapelizSiteTemplatesExportFile(path.relative(papelizSiteExportDirectory, exportFilePath).split(path.sep).join('/'))) continue
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

// Yearly billing chosen by default (papelizSiteSyncPreselectedBillingPeriod in lib/papeliz-site-sync-plans.ts):
// the pressed choice is checked, not its place, since Yearly sits on the right of Monthly.
// The address parameters are the same as papelizSiteSyncPlanAddressParameterName and
// papelizSiteSyncBillingPeriodAddressParameterName there; Free's Sign up names no plan, so it is not counted; a paid plan's button reads Subscribe.
for (const papelizSiteSyncPlansPagePath of ['/pricing/', '/sync/']) {
  const papelizSiteSyncPlansPageFile = exportFileForSitePath(papelizSiteSyncPlansPagePath)
  if (!existsSync(papelizSiteSyncPlansPageFile)) continue
  const papelizSiteSyncPlansPageName = path.relative(papelizSiteExportDirectory, papelizSiteSyncPlansPageFile).split(path.sep).join('/')
  const papelizSiteSyncPlansPageHtml = readFileSync(papelizSiteSyncPlansPageFile, 'utf8')
  const papelizSiteSyncPressedChoiceTexts = [...papelizSiteSyncPlansPageHtml.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)].map(
    (papelizSiteSyncPressedChoiceMatch) => visibleTextOfHtml(papelizSiteSyncPressedChoiceMatch[1]),
  )
  if (!papelizSiteSyncPressedChoiceTexts.some((papelizSiteSyncPressedChoiceText) => papelizSiteSyncPressedChoiceText.startsWith('Yearly'))) {
    papelizSiteExportProblems.push(`${papelizSiteSyncPlansPageName}: the Monthly / Yearly switch does not open on Yearly`)
  }
  const papelizSiteSyncPaidSignUpHrefs = [...papelizSiteSyncPlansPageHtml.matchAll(/href="([^"]*[?&](?:amp;)?papeliz-sync-plan=[^"]*)"/g)].map((papelizSiteSyncPaidSignUpMatch) =>
    decodeHtmlEntities(papelizSiteSyncPaidSignUpMatch[1]),
  )
  if (papelizSiteSyncPaidSignUpHrefs.length === 0) papelizSiteExportProblems.push(`${papelizSiteSyncPlansPageName}: has no paid plan Subscribe`)
  for (const papelizSiteSyncPaidSignUpHref of papelizSiteSyncPaidSignUpHrefs) {
    if (new URL(papelizSiteSyncPaidSignUpHref, 'https://papeliz.test').searchParams.get('papeliz-sync-billing-period') !== 'yearly') {
      papelizSiteExportProblems.push(`${papelizSiteSyncPlansPageName}: Subscribe ${papelizSiteSyncPaidSignUpHref} does not start checkout on yearly`)
    }
  }
}

// The account page's header policy: every inline script hashed, and no 'unsafe-inline' left.
const papelizSiteAccountPagePath = exportFileForSitePath('/account/')
const papelizSiteExportHeadersPath = path.join(papelizSiteExportDirectory, '_headers')
if (existsSync(papelizSiteAccountPagePath) && existsSync(papelizSiteExportHeadersPath)) {
  const papelizSiteAccountHeadersBlock = /^\/account\/\*\r?\n((?:[ \t]+\S.*\r?\n?)*)/m.exec(readFileSync(papelizSiteExportHeadersPath, 'utf8'))?.[1] ?? ''
  const papelizSiteAccountHeaderScriptSources = (/Content-Security-Policy:.*?\bscript-src\s+([^;\r\n]*)/i.exec(papelizSiteAccountHeadersBlock)?.[1] ?? '').trim().split(/\s+/)
  if (papelizSiteAccountHeaderScriptSources.includes("'unsafe-inline'")) {
    papelizSiteExportProblems.push("_headers: /account/* still allows 'unsafe-inline' scripts; build with the root `pnpm site:build`, whose last step hashes them")
  }
  for (const papelizSiteAccountInlineScriptText of readPapelizSitePageInlineScriptTexts(readFileSync(papelizSiteAccountPagePath, 'utf8'))) {
    const papelizSiteAccountInlineScriptHash = hashPapelizSitePageInlineScript(papelizSiteAccountInlineScriptText)
    if (!papelizSiteAccountHeaderScriptSources.includes(papelizSiteAccountInlineScriptHash)) {
      papelizSiteExportProblems.push(`_headers: /account/* has no hash for an account page inline script (${papelizSiteAccountInlineScriptHash})`)
    }
  }
  const { papelizSitePageExtraScriptSources, papelizSitePageExtraDirectives } = readPapelizSitePageExtraScriptPolicy('account/index.html')
  for (const papelizSiteAccountExtraScriptSource of papelizSitePageExtraScriptSources) {
    if (!papelizSiteAccountHeaderScriptSources.includes(papelizSiteAccountExtraScriptSource)) {
      papelizSiteExportProblems.push(`_headers: /account/* doesn't allow ${papelizSiteAccountExtraScriptSource}, which the account page's <meta> policy names`)
    }
  }
  for (const papelizSiteAccountExtraDirective of papelizSitePageExtraDirectives) {
    if (!papelizSiteAccountHeadersBlock.includes(papelizSiteAccountExtraDirective)) {
      papelizSiteExportProblems.push(`_headers: /account/* has no "${papelizSiteAccountExtraDirective}", which the account page's <meta> policy names`)
    }
  }
}

// The Featured templates' short addresses: each a short name (lowercase words joined by hyphens) or
// the template's repository name as GitHub spells it, as /templates/<address> and
// /templates/<address>/, each line a permanent redirect to a page the export has. No address has a
// page of its own or equals an owner's folder, whatever its case, so it shadows nothing, and no
// address is written twice.
const papelizSiteExportRedirectsPath = path.join(papelizSiteExportDirectory, '_redirects')
const papelizSiteTemplateShortNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
let papelizSiteTemplateShortAddressCount = 0
if (existsSync(papelizSiteExportRedirectsPath)) {
  const papelizSiteTemplatesExportDirectory = path.join(papelizSiteExportDirectory, 'templates')
  const papelizSiteTemplateOwnerFoldersLowercase = new Set(
    existsSync(papelizSiteTemplatesExportDirectory)
      ? readdirSync(papelizSiteTemplatesExportDirectory, { withFileTypes: true })
          .filter((templatesExportEntry) => templatesExportEntry.isDirectory() && !templatesExportEntry.name.startsWith('__next.'))
          .map((templatesExportEntry) => templatesExportEntry.name.toLowerCase())
      : [],
  )
  const papelizSiteRedirectDestinationBySource = new Map()
  for (const papelizSiteRedirectLine of readFileSync(papelizSiteExportRedirectsPath, 'utf8').split(/\r?\n/)) {
    if (papelizSiteRedirectLine.trim() === '' || papelizSiteRedirectLine.trimStart().startsWith('#')) continue
    const [papelizSiteRedirectSource, papelizSiteRedirectDestination, papelizSiteRedirectStatus, ...papelizSiteRedirectExtraParts] = papelizSiteRedirectLine.trim().split(/\s+/)
    const papelizSiteRedirectSourceAddressMatch = /^\/templates\/([^/]+)\/?$/.exec(papelizSiteRedirectSource)
    const papelizSiteRedirectDestinationPageMatch = /^\/templates\/[^/]+\/([^/]+)\/$/.exec(papelizSiteRedirectDestination ?? '')
    if (!papelizSiteRedirectSourceAddressMatch || !papelizSiteRedirectDestinationPageMatch || !['301', '308'].includes(papelizSiteRedirectStatus) || papelizSiteRedirectExtraParts.length > 0) {
      papelizSiteExportProblems.push(`_redirects: "${papelizSiteRedirectLine}" is not a permanent redirect from /templates/<address> to /templates/<owner>/<repository>/`)
      continue
    }
    papelizSiteTemplateShortAddressCount += 1
    const papelizSiteRedirectSourceAddress = papelizSiteRedirectSourceAddressMatch[1]
    if (!papelizSiteTemplateShortNamePattern.test(papelizSiteRedirectSourceAddress) && papelizSiteRedirectSourceAddress !== papelizSiteRedirectDestinationPageMatch[1]) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} is neither a short name nor the repository's own spelling of ${papelizSiteRedirectDestination}`)
    }
    if (papelizSiteTemplateOwnerFoldersLowercase.has(papelizSiteRedirectSourceAddress.toLowerCase())) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} is also an owner's address, which the redirect would shadow`)
    }
    if (papelizSiteRedirectDestinationBySource.has(papelizSiteRedirectSource)) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} is written more than once`)
    }
    papelizSiteRedirectDestinationBySource.set(papelizSiteRedirectSource, papelizSiteRedirectDestination)
    // A page, not the not-found screen written under its address: its canonical link is itself.
    const papelizSiteRedirectDestinationFile = exportFileForSitePath(papelizSiteRedirectDestination)
    const papelizSiteRedirectDestinationCanonicalHref =
      existsSync(papelizSiteRedirectDestinationFile) && statSync(papelizSiteRedirectDestinationFile).isFile()
        ? /<link rel="canonical" href="([^"]*)"/.exec(readFileSync(papelizSiteRedirectDestinationFile, 'utf8'))?.[1]
        : undefined
    if (papelizSiteRedirectDestinationCanonicalHref === undefined || new URL(decodeHtmlEntities(papelizSiteRedirectDestinationCanonicalHref)).pathname !== papelizSiteRedirectDestination) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} points at ${papelizSiteRedirectDestination}, which has no page of its own in the export`)
    }
    if (existsSync(exportFileForSitePath(`/templates/${papelizSiteRedirectSourceAddress}/`))) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} has a page of its own, which the redirect would shadow`)
    }
  }
  // Each address both without and with the trailing slash, to the same page.
  for (const [papelizSiteRedirectSource, papelizSiteRedirectDestination] of papelizSiteRedirectDestinationBySource) {
    const papelizSiteRedirectPairedSource = papelizSiteRedirectSource.endsWith('/') ? papelizSiteRedirectSource.slice(0, -1) : `${papelizSiteRedirectSource}/`
    if (papelizSiteRedirectDestinationBySource.get(papelizSiteRedirectPairedSource) !== papelizSiteRedirectDestination) {
      papelizSiteExportProblems.push(`_redirects: ${papelizSiteRedirectSource} has no matching ${papelizSiteRedirectPairedSource} to ${papelizSiteRedirectDestination}`)
    }
  }
}

if (papelizSiteExportProblems.length > 0) {
  console.error(` [error] The site export has ${papelizSiteExportProblems.length} problem(s):`)
  for (const papelizSiteExportProblem of papelizSiteExportProblems) console.error(`  - ${papelizSiteExportProblem}`)
  process.exit(1)
}

console.log(
  ` [ok] Site export checked: ${papelizSiteExpectedPagePaths.length} pages, ${papelizSiteExportHtmlPaths.length} HTML files, links, license text, wording, yearly billing by default, script policies and ${papelizSiteTemplateShortAddressCount} template short address line(s).`,
)
