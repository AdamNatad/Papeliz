#!/usr/bin/env node
// Gives every exported page of the website a strict script policy of its own. The site shares its
// origin with the app's AI keys, browser vaults and Sync session, so no page may run a script the
// build didn't write. After `next build`, this writes into each page in out/ a
// <meta http-equiv="Content-Security-Policy"> whose script-src allows only this site's own script
// files and the SHA-256 hash of each inline script on that page: Next's inline scripts, and the
// theme script in app/layout.tsx. Any other inline script, or any change to these, is then refused.
//
// A <meta> policy, not a _headers block per page: it holds the page's own hashes in the page itself,
// so it has no _headers rule limit as Templates adds a page per template, and the static preview
// enforces it too. frame-ancestors, which a <meta> policy can't carry, stays in public/_headers.
//
// The build stops with an error, and leaves the export unusable, when a page has something a hash
// can't allow: an inline event handler, a javascript: link, or a script file from another site that
// the page isn't listed for below. It also re-reads every page and stops if any inline script there
// has no hash in its policy. scripts/verify-papeliz-site-export.mjs checks the same again.
//
// Usage: node scripts/papeliz-site-page-script-policy.mjs [site export folder]  (default: out)

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Script types that are data, which a browser never runs, so they need no hash. Every other inline
// script is hashed, whatever its type says.
const papelizSitePageDataScriptTypes = new Set(['application/ld+json', 'application/json'])

// Pages that need more than the site's own scripts, by their file in the export, each the same as in
// that page's _headers policy. The account page's sign-in shows Cloudflare's bot check when Clerk
// asks for one, and it rewraps vault keys in a worker the bundler starts from a blob: address. Its
// full policy is the /account/* block in public/_headers, which the root site build hashes too.
export const papelizSitePageExtraScriptPolicyByExportFile = {
  'account/index.html': {
    papelizSitePageExtraScriptSources: ['https://challenges.cloudflare.com'],
    papelizSitePageExtraDirectives: ["worker-src 'self' blob:"],
  },
}

// The directives every page's <meta> policy carries besides script-src.
const papelizSitePageScriptPolicyOtherDirectives = ["object-src 'none'", "base-uri 'none'"]
const papelizSitePageNoExtraScriptPolicy = { papelizSitePageExtraScriptSources: [], papelizSitePageExtraDirectives: [] }

const papelizSitePageScriptPolicyMetaPattern = /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/gi

// The HTML parser turns CR LF and a lone CR into LF before a script's text exists, so the browser
// hashes the text with LF line endings.
function normalizePapelizSitePageScriptLineEndings(papelizSitePageScriptText) {
  return papelizSitePageScriptText.replace(/\r\n?/g, '\n')
}

// Every <script> element in the page, with its attributes and its text exactly as written: a script
// element's content is raw text, so no entity is decoded.
function readPapelizSitePageScriptElements(papelizSitePageHtml) {
  return [...papelizSitePageHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((scriptElementMatch) => ({
    scriptElementAttributes: scriptElementMatch[1],
    scriptElementText: scriptElementMatch[2],
    scriptElementStartIndex: scriptElementMatch.index,
  }))
}

function readPapelizSitePageScriptAttribute(scriptElementAttributes, scriptAttributeName) {
  const scriptAttributeMatch = new RegExp(`(?:^|\\s)${scriptAttributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(scriptElementAttributes)
  return scriptAttributeMatch ? (scriptAttributeMatch[1] ?? scriptAttributeMatch[2] ?? scriptAttributeMatch[3]) : null
}

// The text of every inline script a browser would hold to the policy.
export function readPapelizSitePageInlineScriptTexts(papelizSitePageHtml) {
  return readPapelizSitePageScriptElements(papelizSitePageHtml)
    .filter(({ scriptElementAttributes }) => readPapelizSitePageScriptAttribute(scriptElementAttributes, 'src') === null)
    .filter(({ scriptElementAttributes }) => {
      const scriptElementType = (readPapelizSitePageScriptAttribute(scriptElementAttributes, 'type') ?? '').trim().toLowerCase()
      return !papelizSitePageDataScriptTypes.has(scriptElementType)
    })
    .map(({ scriptElementText }) => scriptElementText)
}

export function hashPapelizSitePageInlineScript(papelizSitePageInlineScriptText) {
  const papelizSitePageInlineScriptDigest = createHash('sha256').update(normalizePapelizSitePageScriptLineEndings(papelizSitePageInlineScriptText), 'utf8').digest('base64')
  return `'sha256-${papelizSitePageInlineScriptDigest}'`
}

export function buildPapelizSitePageScriptPolicy(papelizSitePageHtml, papelizSitePageExtraScriptPolicy = papelizSitePageNoExtraScriptPolicy) {
  const { papelizSitePageExtraScriptSources, papelizSitePageExtraDirectives } = papelizSitePageExtraScriptPolicy
  const papelizSitePageInlineScriptHashes = [...new Set(readPapelizSitePageInlineScriptTexts(papelizSitePageHtml).map(hashPapelizSitePageInlineScript))]
  const papelizSitePageScriptSources = ["'self'", ...papelizSitePageInlineScriptHashes, ...papelizSitePageExtraScriptSources]
  return [`script-src ${papelizSitePageScriptSources.join(' ')}`, ...papelizSitePageExtraDirectives, ...papelizSitePageScriptPolicyOtherDirectives].join('; ')
}

// The page without any policy this step wrote before, so running it twice gives the same page.
function removePapelizSitePageScriptPolicyMeta(papelizSitePageHtml) {
  return papelizSitePageHtml.replace(papelizSitePageScriptPolicyMetaPattern, '')
}

// Writes the policy as the first thing in <head> after the character set, which must stay in the
// first 1024 bytes. A <meta> policy covers only what comes after it, so it sits before every script.
export function writePapelizSitePageScriptPolicy(papelizSitePageHtml, papelizSitePageExtraScriptPolicy = papelizSitePageNoExtraScriptPolicy) {
  const papelizSitePageHtmlWithoutPolicy = removePapelizSitePageScriptPolicyMeta(papelizSitePageHtml)
  const papelizSitePageScriptPolicyMeta = `<meta http-equiv="Content-Security-Policy" content="${buildPapelizSitePageScriptPolicy(papelizSitePageHtmlWithoutPolicy, papelizSitePageExtraScriptPolicy)}"/>`
  const papelizSitePageCharsetMetaMatch = /<head\b[^>]*>\s*<meta\s+charSet="[^"]*"\s*\/?>/i.exec(papelizSitePageHtmlWithoutPolicy)
  const papelizSitePageHeadStartMatch = papelizSitePageCharsetMetaMatch ?? /<head\b[^>]*>/i.exec(papelizSitePageHtmlWithoutPolicy)
  if (!papelizSitePageHeadStartMatch) return null
  const papelizSitePagePolicyInsertIndex = papelizSitePageHeadStartMatch.index + papelizSitePageHeadStartMatch[0].length
  return `${papelizSitePageHtmlWithoutPolicy.slice(0, papelizSitePagePolicyInsertIndex)}${papelizSitePageScriptPolicyMeta}${papelizSitePageHtmlWithoutPolicy.slice(papelizSitePagePolicyInsertIndex)}`
}

// The page's markup outside scripts and styles, where an inline handler or a javascript: link would be.
function readPapelizSitePageMarkupOutsideScripts(papelizSitePageHtml) {
  return papelizSitePageHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '<script></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style></style>')
}

// Everything that would let a script run on this page without the policy allowing it, or that the
// policy would block. An empty list means the page is covered.
export function findPapelizSitePageScriptPolicyProblems(papelizSitePageHtml, papelizSitePageExtraScriptPolicy = papelizSitePageNoExtraScriptPolicy) {
  const { papelizSitePageExtraScriptSources } = papelizSitePageExtraScriptPolicy
  const papelizSitePageScriptPolicyProblems = []
  const papelizSitePagePolicyMetas = [...papelizSitePageHtml.matchAll(papelizSitePageScriptPolicyMetaPattern)]
  if (papelizSitePagePolicyMetas.length !== 1) {
    papelizSitePageScriptPolicyProblems.push(`has ${papelizSitePagePolicyMetas.length} script policies in <meta>, not 1`)
    return papelizSitePageScriptPolicyProblems
  }
  const [papelizSitePagePolicyMeta] = papelizSitePagePolicyMetas
  const papelizSitePagePolicyText = /content="([^"]*)"/i.exec(papelizSitePagePolicyMeta[0])[1]
  const papelizSitePageScriptSources = (/(?:^|;)\s*script-src\s+([^;]*)/.exec(papelizSitePagePolicyText)?.[1] ?? '').trim().split(/\s+/)
  if (papelizSitePageScriptSources.some((scriptSource) => ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", '*', 'https:', 'http:', 'data:'].includes(scriptSource))) {
    papelizSitePageScriptPolicyProblems.push(`its script-src is not strict: ${papelizSitePageScriptSources.join(' ')}`)
  }

  const papelizSitePageScriptElements = readPapelizSitePageScriptElements(papelizSitePageHtml)
  if (papelizSitePageScriptElements.some(({ scriptElementStartIndex }) => scriptElementStartIndex < papelizSitePagePolicyMeta.index)) {
    papelizSitePageScriptPolicyProblems.push('has a script before its <meta> policy, which the policy would not cover')
  }
  for (const papelizSitePageInlineScriptText of readPapelizSitePageInlineScriptTexts(papelizSitePageHtml)) {
    const papelizSitePageInlineScriptHash = hashPapelizSitePageInlineScript(papelizSitePageInlineScriptText)
    if (!papelizSitePageScriptSources.includes(papelizSitePageInlineScriptHash)) {
      papelizSitePageScriptPolicyProblems.push(
        `has an inline script with no hash in its policy (${papelizSitePageInlineScriptHash}): ${JSON.stringify(papelizSitePageInlineScriptText.slice(0, 80))}`,
      )
    }
  }
  for (const { scriptElementAttributes } of papelizSitePageScriptElements) {
    const papelizSitePageScriptFile = readPapelizSitePageScriptAttribute(scriptElementAttributes, 'src')
    if (papelizSitePageScriptFile === null) continue
    const papelizSitePageScriptFileIsOwn = papelizSitePageScriptFile.startsWith('/') && !papelizSitePageScriptFile.startsWith('//')
    const papelizSitePageScriptFileIsListed = papelizSitePageExtraScriptSources.some((extraScriptSource) => papelizSitePageScriptFile.startsWith(`${extraScriptSource}/`))
    if (!papelizSitePageScriptFileIsOwn && !papelizSitePageScriptFileIsListed) {
      papelizSitePageScriptPolicyProblems.push(`loads a script file from another site, which its policy refuses: ${papelizSitePageScriptFile}`)
    }
  }

  const papelizSitePageMarkupOutsideScripts = readPapelizSitePageMarkupOutsideScripts(papelizSitePageHtml)
  for (const inlineEventHandlerMatch of papelizSitePageMarkupOutsideScripts.matchAll(/<[a-z][^>]*?\s(on[a-z]+)\s*=/gi)) {
    papelizSitePageScriptPolicyProblems.push(`has an inline ${inlineEventHandlerMatch[1]} handler, which no hash can allow`)
  }
  if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(papelizSitePageMarkupOutsideScripts)) {
    papelizSitePageScriptPolicyProblems.push('has a javascript: link, which no hash can allow')
  }
  return papelizSitePageScriptPolicyProblems
}

export function listPapelizSiteExportHtmlFiles(papelizSiteExportFolder) {
  const papelizSiteExportHtmlFiles = []
  for (const exportFolderEntry of readdirSync(papelizSiteExportFolder, { withFileTypes: true })) {
    const exportFolderEntryPath = path.join(papelizSiteExportFolder, exportFolderEntry.name)
    if (exportFolderEntry.isDirectory()) papelizSiteExportHtmlFiles.push(...listPapelizSiteExportHtmlFiles(exportFolderEntryPath))
    else if (exportFolderEntry.isFile() && exportFolderEntry.name.endsWith('.html')) papelizSiteExportHtmlFiles.push(exportFolderEntryPath)
  }
  return papelizSiteExportHtmlFiles
}

export function readPapelizSitePageExtraScriptPolicy(papelizSiteExportFileName) {
  return papelizSitePageExtraScriptPolicyByExportFile[papelizSiteExportFileName] ?? papelizSitePageNoExtraScriptPolicy
}

function runPapelizSitePageScriptPolicyStep() {
  const papelizSitePackageFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const papelizSiteExportFolder = path.resolve(papelizSitePackageFolder, process.argv[2] ?? 'out')
  if (!existsSync(papelizSiteExportFolder)) {
    console.error(` [error] ${papelizSiteExportFolder} is missing; build the site first.`)
    process.exit(1)
  }

  const papelizSitePageScriptPolicyStepProblems = []
  let papelizSitePageInlineScriptCount = 0
  const papelizSiteExportHtmlFiles = listPapelizSiteExportHtmlFiles(papelizSiteExportFolder)
  for (const papelizSiteExportHtmlFile of papelizSiteExportHtmlFiles) {
    const papelizSiteExportFileName = path.relative(papelizSiteExportFolder, papelizSiteExportHtmlFile).split(path.sep).join('/')
    const papelizSitePageExtraScriptPolicy = readPapelizSitePageExtraScriptPolicy(papelizSiteExportFileName)
    const papelizSitePageHtmlWithPolicy = writePapelizSitePageScriptPolicy(readFileSync(papelizSiteExportHtmlFile, 'utf8'), papelizSitePageExtraScriptPolicy)
    if (papelizSitePageHtmlWithPolicy === null) {
      papelizSitePageScriptPolicyStepProblems.push(`${papelizSiteExportFileName}: has no <head> to hold its script policy`)
      continue
    }
    writeFileSync(papelizSiteExportHtmlFile, papelizSitePageHtmlWithPolicy)
    // Read back from disk, so the check sees exactly the page that ships.
    const papelizSitePageHtmlAsWritten = readFileSync(papelizSiteExportHtmlFile, 'utf8')
    papelizSitePageInlineScriptCount += readPapelizSitePageInlineScriptTexts(papelizSitePageHtmlAsWritten).length
    for (const papelizSitePageScriptPolicyProblem of findPapelizSitePageScriptPolicyProblems(papelizSitePageHtmlAsWritten, papelizSitePageExtraScriptPolicy)) {
      papelizSitePageScriptPolicyStepProblems.push(`${papelizSiteExportFileName}: ${papelizSitePageScriptPolicyProblem}`)
    }
  }

  if (papelizSitePageScriptPolicyStepProblems.length > 0) {
    console.error(` [error] ${papelizSitePageScriptPolicyStepProblems.length} page script policy problem(s):`)
    for (const papelizSitePageScriptPolicyStepProblem of papelizSitePageScriptPolicyStepProblems) console.error(`  - ${papelizSitePageScriptPolicyStepProblem}`)
    process.exit(1)
  }
  console.log(
    ` [ready] ${papelizSiteExportHtmlFiles.length} pages carry a strict script-src: 'self' and the hashes of their ${papelizSitePageInlineScriptCount} inline scripts.`,
  )
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runPapelizSitePageScriptPolicyStep()
