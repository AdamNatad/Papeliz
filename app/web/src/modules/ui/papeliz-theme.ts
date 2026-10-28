import { create } from 'zustand'
import { papelizThemePreferenceSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// Light (the default), dark, or whatever the device uses. "system" leaves it to the
// `prefers-color-scheme` media query in papeliz-webapp.css; the other two pin it with
// `data-papeliz-theme` on <html>.
export type PapelizThemePreference = 'system' | 'light' | 'dark'

// The choice is shared with the website and the help site, served from the same domain: they keep it
// in localStorage under this key (site/main/lib/papeliz-site-theme.ts), with the same three values.
// public/papeliz-theme-boot.js reads it before the first paint, so a dark choice never flashes light.
export const papelizThemePreferenceStorageKey = 'papelizThemePreference'

const papelizThemePreferences: readonly PapelizThemePreference[] = ['system', 'light', 'dark']
const papelizBrowserBarColorsByTheme = { light: '#0064d4', dark: '#0d2f5c' } as const

function isPapelizThemePreference(storedValue: unknown): storedValue is PapelizThemePreference {
  return papelizThemePreferences.includes(storedValue as PapelizThemePreference)
}

export function resolvePapelizTheme(papelizThemePreference: PapelizThemePreference): 'light' | 'dark' {
  if (papelizThemePreference !== 'system') return papelizThemePreference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyPapelizThemePreference(papelizThemePreference: PapelizThemePreference): void {
  const htmlElement = document.documentElement
  if (papelizThemePreference === 'system') delete htmlElement.dataset['papelizTheme']
  else htmlElement.dataset['papelizTheme'] = papelizThemePreference
  // The browser's own bar matches the blue topbar.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', papelizBrowserBarColorsByTheme[resolvePapelizTheme(papelizThemePreference)])
}

// The choice shared with the website, or null when there is none, it is unknown, or storage is blocked
// (a private window, site data turned off).
export function readSharedPapelizThemePreference(): PapelizThemePreference | null {
  try {
    const sharedThemePreference = window.localStorage.getItem(papelizThemePreferenceStorageKey)
    return isPapelizThemePreference(sharedThemePreference) ? sharedThemePreference : null
  } catch {
    return null
  }
}

function writeSharedPapelizThemePreference(papelizThemePreference: PapelizThemePreference): void {
  try {
    window.localStorage.setItem(papelizThemePreferenceStorageKey, papelizThemePreference)
  } catch {
    // Storage can be blocked; the choice is still kept in the app's own settings.
  }
}

// The order a saved choice is read in: the one shared with the website, then the app's own setting
// (from before the two were shared), then Light.
export function pickPapelizThemePreferenceInReadOrder(sharedThemePreference: unknown, appSettingThemePreference: unknown): PapelizThemePreference {
  if (isPapelizThemePreference(sharedThemePreference)) return sharedThemePreference
  if (isPapelizThemePreference(appSettingThemePreference)) return appSettingThemePreference
  return 'light'
}

export async function loadPapelizThemePreference(): Promise<PapelizThemePreference> {
  // The shared choice is read at once, so the app need not wait for its own settings.
  const sharedThemePreference = readSharedPapelizThemePreference()
  if (sharedThemePreference !== null) return sharedThemePreference
  const appSettingThemePreference = await readPapelizUserSetting<unknown>(papelizThemePreferenceSettingName, null)
  const papelizThemePreference = pickPapelizThemePreferenceInReadOrder(null, appSettingThemePreference)
  // A choice made in the app before it was shared now reaches the website too.
  if (isPapelizThemePreference(appSettingThemePreference)) writeSharedPapelizThemePreference(papelizThemePreference)
  return papelizThemePreference
}

interface PapelizThemeState {
  papelizThemePreference: PapelizThemePreference
  setPapelizThemePreference: (papelizThemePreference: PapelizThemePreference) => void
}

// Colors ease into the new theme for a quarter second, then transitions go back to normal.
function easeIntoPapelizThemePreference(papelizThemePreference: PapelizThemePreference): void {
  document.documentElement.classList.add('papeliz-theme-is-changing')
  window.setTimeout(() => document.documentElement.classList.remove('papeliz-theme-is-changing'), 300)
  applyPapelizThemePreference(papelizThemePreference)
}

export const usePapelizThemeStore = create<PapelizThemeState>()((setThemeState) => ({
  papelizThemePreference: 'light',
  setPapelizThemePreference: (papelizThemePreference) => {
    easeIntoPapelizThemePreference(papelizThemePreference)
    setThemeState({ papelizThemePreference })
    writeSharedPapelizThemePreference(papelizThemePreference)
    void writePapelizUserSetting(papelizThemePreferenceSettingName, papelizThemePreference).catch(() => undefined)
  },
}))

// A choice made in another tab, of the app or of the website, shows here too.
export function followPapelizThemePreferenceFromOtherTabs(): void {
  window.addEventListener('storage', (storageEvent) => {
    if (storageEvent.key !== papelizThemePreferenceStorageKey) return
    const sharedThemePreference = isPapelizThemePreference(storageEvent.newValue) ? storageEvent.newValue : 'light'
    if (sharedThemePreference === usePapelizThemeStore.getState().papelizThemePreference) return
    easeIntoPapelizThemePreference(sharedThemePreference)
    usePapelizThemeStore.setState({ papelizThemePreference: sharedThemePreference })
    void writePapelizUserSetting(papelizThemePreferenceSettingName, sharedThemePreference).catch(() => undefined)
  })
}
