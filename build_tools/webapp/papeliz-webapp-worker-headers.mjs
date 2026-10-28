#!/usr/bin/env node
// Writes the response headers for the webapp's own Cloudflare Worker (app/web/wrangler.jsonc).
// That Worker serves app/web/dist/, with the built app in dist/app/, and the host reads _headers
// only at the top of what it serves, so this goes beside the app's folder. The app's page carries
// its own Content-Security-Policy; these add what a page can't set for itself.
//
// Run after the webapp build; the root `webapp:build` script does.
// Usage: node build_tools/webapp/papeliz-webapp-worker-headers.mjs

import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const webappWorkerAssetsDirectory = path.join(papelizRepositoryRoot, 'app', 'web', 'dist')

const papelizWebappWorkerHeadersText = `# Response headers for the webapp's Worker (app/web/wrangler.jsonc). Written by
# build_tools/webapp/papeliz-webapp-worker-headers.mjs after each build.

/app/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: frame-ancestors 'self'
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
