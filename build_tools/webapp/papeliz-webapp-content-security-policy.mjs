// The built app's Content-Security-Policy, in one place for both copies of it: the page's `<meta>`
// tag (app/web/vite.config.ts) and the response header the webapp's Worker sends with every file
// under /app/ (papeliz-webapp-worker-headers.mjs). A dedicated worker never inherits its page's
// `<meta>` policy; it takes the policy of its own script's response, so the header is what holds the
// sync thread and the search, PDF and file-writer workers to the same rules as the page.
//
// The user's API keys live in this origin, so: scripts only from the app itself, no plugins, and
// one frame only. Network calls go to the app, to any https host (the user's provider, which can be
// any OpenAI-compatible API on a Custom base URL) and to local model servers on this computer.
// Papeliz Sync needs nothing more: its API and live connection are on the app's own origin ('self'
// covers wss: to it too) and its storage links are https. Styles allow inline because the note editor
// writes its own style rules. Small font files are inlined as data: URLs by the build.
//
// Pictures and media:
// - Web pictures and videos (https) may show in notes.
// - The vault's own pictures and videos show from blob: URLs the page makes from files it read
//   (app/web/src/modules/md-view/papeliz-md-view-vault-media-files.ts); an SVG picture from a data:
//   URL instead.
// - The assistant's generated pictures and recorded speech also play from blob: URLs.
// - The one frame is YouTube's privacy-enhanced player, which a note's YouTube poster loads only when
//   play is pressed (app/web/src/modules/md-view/papeliz-md-view-media.tsx).
export const papelizWebappContentSecurityPolicyDirectives = Object.freeze([
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src https://www.youtube-nocookie.com",
  "base-uri 'none'",
  "form-action 'none'",
])

export function buildPapelizWebappContentSecurityPolicy() {
  return papelizWebappContentSecurityPolicyDirectives.join('; ')
}

// Papeliz for Windows' policy: the web app's, plus Tauri's IPC address in connect-src, through which
// the page reaches the app's native side (files, dialogs, the window). The desktop build's page
// carries it in its `<meta>` tag, and the desktop shell (app/desktop) sets the same one, so both read
// this one source.
const papelizDesktopTauriIpcConnectSources = Object.freeze(['ipc:', 'http://ipc.localhost'])

export function buildPapelizDesktopContentSecurityPolicy() {
  return papelizWebappContentSecurityPolicyDirectives
    .map((policyDirective) => (policyDirective.startsWith('connect-src ') ? `${policyDirective} ${papelizDesktopTauriIpcConnectSources.join(' ')}` : policyDirective))
    .join('; ')
}
