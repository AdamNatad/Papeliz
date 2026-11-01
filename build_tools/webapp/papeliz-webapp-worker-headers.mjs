#!/usr/bin/env node
// Writes the response headers for the webapp's own Cloudflare Worker (app/web/wrangler.jsonc).
// That Worker serves app/web/dist/, with the built app in dist/app/, and the host reads _headers
// only at the top of what it serves, so this goes beside the app's folder.
//
// The app's Content-Security-Policy goes out as a header on every file under /app/. The page also
// carries it as a `<meta>` tag, but a dedicated worker (the sync thread, search, PDF export, the
// browser vault's file writer) takes its policy only from its own script's response, never from the
// page, so without the header those workers would run with no policy at all. A script loaded by a
// page or a worker ignores a policy header on its own response, so the header changes nothing else.
// It adds frame-ancestors, which a `<meta>` policy can't set.
//
// Run after the webapp build; the root `webapp:build` script does.
// Usage: node build_tools/webapp/papeliz-webapp-worker-headers.mjs

import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPapelizWebappContentSecurityPolicy } from './papeliz-webapp-content-security-policy.mjs'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const webappWorkerAssetsDirectory = path.join(papelizRepositoryRoot, 'app', 'web', 'dist')

const papelizWebappWorkerHeadersText = `# Response headers for the webapp's Worker (app/web/wrangler.jsonc). Written by
# build_tools/webapp/papeliz-webapp-worker-headers.mjs after each build.

/app/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: ${buildPapelizWebappContentSecurityPolicy()}; frame-ancestors 'self'
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/app/assets/*
  Cache-Control: public, max-age=31536000, immutable
`

if (!existsSync(path.join(webappWorkerAssetsDirectory, 'app', 'index.html'))) {
  console.error(' [error] app/web/dist/app has no index.html; build the webapp first (pnpm run webapp:build).')
  process.exit(1)
}
writeFileSync(path.join(webappWorkerAssetsDirectory, '_headers'), papelizWebappWorkerHeadersText)
// Only the app and its headers are uploaded, whatever else an older build left in dist/.
writeFileSync(path.join(webappWorkerAssetsDirectory, '.assetsignore'), '/*\n!/app/\n!/_headers\n')
console.log(' [ready] app/web/dist/_headers and .assetsignore written for the webapp Worker.')
