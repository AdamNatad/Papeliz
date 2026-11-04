import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Checks in real browser engines, for what unit tests can't reach: browser vaults in Firefox, WebKit
// (Safari's engine) and Edge (the Edge installed on this computer, in a fresh profile). The dev server
// runs on a port of its own for them. Playwright's WebKit is a WebKit build, not Safari: Safari's own
// storage rules (the 7-day clearing, keeping storage) can only be checked in Safari itself. A browser
// that refuses its private storage (Playwright's WebKit for Windows does) skips the checks that need it.
//
// `msedge-desktop` runs the app as Papeliz for Windows builds it (its window buttons and desktop words),
// from a second dev server whose native side is a stand-in that reaches nothing
// (browser-tests/papeliz-desktop-platform-browser-test-entry.ts). It runs only the tests named for it.
const papelizDesktopPlatformBrowserTestEntryFilePath = fileURLToPath(new URL('./browser-tests/papeliz-desktop-platform-browser-test-entry.ts', import.meta.url))

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.browser-test.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:14252/' },
  webServer: [
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 14252 --strictPort',
      url: 'http://127.0.0.1:14252/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 14253 --strictPort',
      url: 'http://127.0.0.1:14253/',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY: papelizDesktopPlatformBrowserTestEntryFilePath },
    },
  ],
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    {
      name: 'msedge-desktop',
      testMatch: ['**/papeliz-workspace-topbar-widths.browser-test.ts', '**/papeliz-assistant-imagine-and-transcribe.browser-test.ts'],
      grep: [/topbar-widths/, /@papeliz-desktop-app/],
      use: { ...devices['Desktop Edge'], channel: 'msedge', baseURL: 'http://127.0.0.1:14253/' },
    },
  ],
})
