/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build as buildWithVite, defineConfig, type Plugin } from 'vite'
import { papelizPdfExportWoff2DecoderAlias } from '../../build_tools/webapp/papeliz-pdf-export-vite-alias.mjs'
import { papelizHtmlExportCorePlugin } from '../../build_tools/webapp/papeliz-html-export-core-vite-plugin.mjs'
import { papelizSyncEnginePlugin } from '../../build_tools/webapp/papeliz-sync-engine-vite-plugin.mjs'

// The built app's Content-Security-Policy. The user's API keys live in this origin, so: scripts only
// from the app itself, no plugins or frames. Network calls go to the app, to any https host (the
// user's provider, which can be any OpenAI-compatible API on a Custom base URL; Adam, 2026-10-28)
// and to local model servers on this computer. Styles allow inline because the note editor writes
// its own style rules. Remote images (https) may show in notes; small font files are inlined as
// data: URLs by the build. Added to the built page only: the dev server needs inline scripts for
// hot reload.
function buildPapelizContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

function papelizContentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'papeliz-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: buildPapelizContentSecurityPolicy() }, injectTo: 'head-prepend' },
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
