#!/usr/bin/env node
// Locks the account page's scripts to the ones the build wrote. The static export puts Next's inline
// scripts into /account/index.html, and _headers allows them with 'unsafe-inline' only as a stand-in:
// this step swaps it, in the exported _headers, for the SHA-256 hash of each inline script on the page.
// Any other inline script, or any change to these, is then refused. The page signs people in on the
// same origin as the app's AI keys, so it gets no 'unsafe-inline' for scripts at all.
//
// Run after the site build; the root `site:build` script does. It stops with an error, and changes
// nothing, when the page, its inline scripts, or the /account/* policy in _headers are missing.
// Usage: node build_tools/site/papeliz-site-account-csp-hashes.mjs [site export folder]

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const papelizSiteExportFolder = path.resolve(papelizRepositoryRoot, process.argv[2] ?? 'site/main/out')
const papelizSiteAccountPageFile = path.join(papelizSiteExportFolder, 'account', 'index.html')
const papelizSiteHeadersFile = path.join(papelizSiteExportFolder, '_headers')
const papelizSiteAccountHeadersPath = '/account/*'

// Script types a browser runs; anything else (JSON-LD, Next's JSON data) is data, which a policy
// never blocks, so it needs no hash.
const papelizSiteRunnableScriptTypes = new Set(['', 'text/javascript', 'application/javascript', 'module'])

function stopPapelizSiteAccountCspHashes(papelizSiteAccountCspHashesProblem) {
  console.error(` [error] ${papelizSiteAccountCspHashesProblem}`)
  process.exit(1)
}

// The text of every runnable inline script, exactly as written: a script element's content is raw
// text, so the browser hashes these same characters.
function readPapelizSiteAccountInlineScriptTexts(papelizSiteAccountPageHtml) {
  const papelizSiteAccountInlineScriptTexts = []
  for (const scriptElementMatch of papelizSiteAccountPageHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const scriptElementAttributes = scriptElementMatch[1]
    if (/\bsrc\s*=/i.test(scriptElementAttributes)) continue
    const scriptElementType = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(scriptElementAttributes)?.[1] ?? '').toLowerCase()
    if (!papelizSiteRunnableScriptTypes.has(scriptElementType)) continue
    papelizSiteAccountInlineScriptTexts.push(scriptElementMatch[2])
  }
  return papelizSiteAccountInlineScriptTexts
}

function hashPapelizSiteAccountInlineScript(papelizSiteAccountInlineScriptText) {
  return `'sha256-${createHash('sha256').update(papelizSiteAccountInlineScriptText, 'utf8').digest('base64')}'`
}

// Rewrites the script-src directive alone: without 'unsafe-inline' or any earlier hashes, with this
// build's hashes after 'self'. Every other character of the policy stays as it was.
function replacePapelizSiteAccountScriptSources(papelizSiteAccountPolicyText, papelizSiteAccountInlineScriptHashes) {
  const scriptSourceDirectiveMatch = /(^|;)(\s*)script-src(\s[^;]*)?(?=;|$)/.exec(papelizSiteAccountPolicyText)
  if (!scriptSourceDirectiveMatch) stopPapelizSiteAccountCspHashes(`The ${papelizSiteAccountHeadersPath} policy in _headers has no script-src.`)
  const keptScriptSources = (scriptSourceDirectiveMatch[3] ?? '')
    .trim()
    .split(/\s+/)
    .filter((scriptSource) => scriptSource !== '' && scriptSource !== "'unsafe-inline'" && !scriptSource.startsWith("'sha256-"))
  keptScriptSources.splice(keptScriptSources.indexOf("'self'") + 1, 0, ...papelizSiteAccountInlineScriptHashes)
  const scriptSourceDirectiveStart = scriptSourceDirectiveMatch.index + scriptSourceDirectiveMatch[1].length + scriptSourceDirectiveMatch[2].length
  const scriptSourceDirectiveEnd = scriptSourceDirectiveMatch.index + scriptSourceDirectiveMatch[0].length
  // A directive's last space before the next ';' stays, as written.
  const scriptSourceDirectiveTrailingSpace = /\s*$/.exec(scriptSourceDirectiveMatch[3] ?? '')[0]
  return `${papelizSiteAccountPolicyText.slice(0, scriptSourceDirectiveStart)}${['script-src', ...keptScriptSources].join(' ')}${scriptSourceDirectiveTrailingSpace}${papelizSiteAccountPolicyText.slice(scriptSourceDirectiveEnd)}`
}

if (!existsSync(papelizSiteAccountPageFile)) stopPapelizSiteAccountCspHashes(`${path.relative(papelizRepositoryRoot, papelizSiteAccountPageFile)} is missing; build the site first.`)
if (!existsSync(papelizSiteHeadersFile)) stopPapelizSiteAccountCspHashes(`${path.relative(papelizRepositoryRoot, papelizSiteHeadersFile)} is missing; build the site first.`)

const papelizSiteAccountInlineScriptHashes = [
  ...new Set(readPapelizSiteAccountInlineScriptTexts(readFileSync(papelizSiteAccountPageFile, 'utf8')).map(hashPapelizSiteAccountInlineScript)),
]
if (papelizSiteAccountInlineScriptHashes.length === 0) stopPapelizSiteAccountCspHashes('The account page has no inline scripts; the export changed, so check this step still fits it.')

// Lines with their own line endings (LF or CRLF) kept beside them, so only the policy line changes.
const papelizSiteHeadersLinesAndEndings = readFileSync(papelizSiteHeadersFile, 'utf8').split(/(\r?\n)/)
const papelizSiteHeadersLines = papelizSiteHeadersLinesAndEndings.filter((_headersPart, headersPartIndex) => headersPartIndex % 2 === 0)
const papelizSiteAccountHeadersPathLineIndex = papelizSiteHeadersLines.findIndex((headersLine) => headersLine.trim() === papelizSiteAccountHeadersPath)
if (papelizSiteAccountHeadersPathLineIndex === -1) stopPapelizSiteAccountCspHashes(`_headers has no ${papelizSiteAccountHeadersPath} block.`)
// A block's headers are its indented lines, up to the next path or blank line.
let papelizSiteAccountPolicyLineIndex = -1
for (let headersLineIndex = papelizSiteAccountHeadersPathLineIndex + 1; headersLineIndex < papelizSiteHeadersLines.length; headersLineIndex += 1) {
  const headersLine = papelizSiteHeadersLines[headersLineIndex]
  if (!/^\s+\S/.test(headersLine)) break
  if (/^\s+Content-Security-Policy:/i.test(headersLine)) papelizSiteAccountPolicyLineIndex = headersLineIndex
}
if (papelizSiteAccountPolicyLineIndex === -1) stopPapelizSiteAccountCspHashes(`The ${papelizSiteAccountHeadersPath} block in _headers has no Content-Security-Policy.`)

const [, papelizSiteAccountPolicyIndent, papelizSiteAccountPolicyText] = /^(\s+Content-Security-Policy:\s*)(.*)$/i.exec(papelizSiteHeadersLines[papelizSiteAccountPolicyLineIndex])
papelizSiteHeadersLinesAndEndings[papelizSiteAccountPolicyLineIndex * 2] =
  `${papelizSiteAccountPolicyIndent}${replacePapelizSiteAccountScriptSources(papelizSiteAccountPolicyText, papelizSiteAccountInlineScriptHashes)}`
writeFileSync(papelizSiteHeadersFile, papelizSiteHeadersLinesAndEndings.join(''))
console.log(
  ` [ready] ${path.relative(papelizRepositoryRoot, papelizSiteHeadersFile)}: ${papelizSiteAccountHeadersPath} allows its ${papelizSiteAccountInlineScriptHashes.length} inline scripts by hash, without 'unsafe-inline'.`,
)
