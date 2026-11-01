/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build as buildWithVite, defineConfig, type Plugin } from 'vite'
import { papelizPdfExportWoff2DecoderAlias } from '../../build_tools/webapp/papeliz-pdf-export-vite-alias.mjs'
import { papelizHtmlExportCorePlugin } from '../../build_tools/webapp/papeliz-html-export-core-vite-plugin.mjs'
import { papelizSyncEnginePlugin } from '../../build_tools/webapp/papeliz-sync-engine-vite-plugin.mjs'
import { buildPapelizWebappContentSecurityPolicy } from '../../build_tools/webapp/papeliz-webapp-content-security-policy.mjs'

// The built app's Content-Security-Policy as a `<meta>` tag, so the page keeps it on any static host.
// The policy and why each rule is there: papeliz-webapp-content-security-policy.mjs, which also gives
// the webapp's Worker the same policy as a header, for the app's workers. Added to the built page
// only: the dev server needs inline scripts for hot reload, and `webapp start sync-local` proxies
// Sync onto the dev origin (papeliz-sync-engine-vite-plugin.mjs).
function papelizContentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'papeliz-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: buildPapelizWebappContentSecurityPolicy() }, injectTo: 'head-prepend' },
    ],
  }
}

// The launcher passes --host 127.0.0.1 --port 14201 --strictPort; the same values are the defaults
// here, so a plain `pnpm dev` inside app/web/ behaves the same way. The built app is served at /app/
// under the website, so a build points its files there and lands in dist/app/: dist/ is what the
// webapp's own Worker serves (wrangler.jsonc), at the same paths. The dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  // The PDF export reads WOFF font files only, so fontkit's WOFF2 decoder never runs; a one-line
  // stand-in keeps it (60 kB gzip) out of the PDF worker.
  resolve: { alias: [papelizPdfExportWoff2DecoderAlias] },
  build: { outDir: 'dist/app' },
  plugins: [react(), tailwindcss(), papelizContentSecurityPolicyPlugin(), papelizHtmlExportCorePlugin(buildWithVite), papelizSyncEnginePlugin()],
  server: {
    host: '127.0.0.1',
    port: 14201,
    strictPort: true,
  },
  // The HTML export reads stylesheets as text (`?raw`): MD View's look, the export's own and the
  // exported website's. Vitest blanks stylesheets unless they are listed here.
  test: {
    css: { include: [/papeliz-webapp\.css/, /papeliz-html-export-[\w-]+\.css/, /papeliz-site\.css/] },
  },
}))
