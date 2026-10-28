import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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
// under the website, so a build points its files there; the dev server stays
// at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  plugins: [react(), tailwindcss(), papelizContentSecurityPolicyPlugin()],
  server: {
    host: '127.0.0.1',
    port: 14201,
    strictPort: true,
  },
}))
