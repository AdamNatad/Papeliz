#!/usr/bin/env node
// Gives every exported page of the help site the same strict script policy as the website's pages.
// The help site is served from the website's origin at /help/, beside the app's AI keys, browser
// vaults and Sync session, so no help page may run a script the build didn't write. After
// `next build`, this runs the website's own step over out/: each page gets a
// <meta http-equiv="Content-Security-Policy"> whose script-src allows only this site's script files
// and the SHA-256 hash of each inline script on that page. No help page needs anything more.
//
// The build stops when a page has an inline script without its hash, an inline event handler, a
// javascript: link or a script file from another site. scripts/verify-papeliz-help-export.mjs
// checks the same again.
//
// Usage, from site/help: node scripts/papeliz-help-page-script-policy.mjs [help export folder]  (default: out)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPapelizSiteExportFolderPageScriptPolicyStep } from '../../main/scripts/papeliz-site-page-script-policy.mjs'

const papelizHelpSiteDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
runPapelizSiteExportFolderPageScriptPolicyStep(path.resolve(papelizHelpSiteDirectory, process.argv[2] ?? 'out'))
