import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './papeliz-webapp.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { showPapelizConsoleWarning } from './modules/ui/papeliz-console-warning'
import { applyPapelizThemePreference, followPapelizThemePreferenceFromOtherTabs, loadPapelizThemePreference, usePapelizThemeStore } from './modules/ui/papeliz-theme'
import { PapelizWebappStart } from './papeliz-webapp'

const papelizWebappRootElement = document.getElementById('papeliz-webapp-root')
if (papelizWebappRootElement === null) throw new Error('The page is missing #papeliz-webapp-root.')
const papelizWebappReactRoot = createRoot(papelizWebappRootElement)
const papelizWebappStartedAtMilliseconds = performance.now()

function drawPapelizWebappStart(isPapelizThemePreferenceRead: boolean) {
  papelizWebappReactRoot.render(
    <StrictMode>
      <PapelizWebappStart isPapelizThemePreferenceRead={isPapelizThemePreferenceRead} papelizWebappStartedAtMilliseconds={papelizWebappStartedAtMilliseconds} />
    </StrictMode>,
  )
}

// The opening screen shows at once, so the page is never blank while the app starts. The saved theme
// is applied before the app draws under it (public/papeliz-theme-boot.js already set the theme shared
// with the website before the first paint), and a choice made in another tab, of the app or of the
// website, follows.
async function startPapelizWebapp() {
  drawPapelizWebappStart(false)
  const papelizThemePreference = await loadPapelizThemePreference()
  applyPapelizThemePreference(papelizThemePreference)
  usePapelizThemeStore.setState({ papelizThemePreference })
  followPapelizThemePreferenceFromOtherTabs()
  // "Match this device" follows the device when it switches between light and dark.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyPapelizThemePreference(usePapelizThemeStore.getState().papelizThemePreference)
  })
  drawPapelizWebappStart(true)
}

showPapelizConsoleWarning()
void startPapelizWebapp()
