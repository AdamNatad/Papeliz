// The theme, as in the app (app/web/src/modules/ui/papeliz-theme.ts): Light, the default; Dark; or
// the device's ("system"). "system" leaves it to the prefers-color-scheme media query in
// globals.css; the other two pin it with data-papeliz-theme on <html>.
export type PapelizSiteThemePreference = 'system' | 'light' | 'dark'

// Kept in the browser's localStorage, so the website and the help site, served from one domain,
// share the choice.
export const papelizSiteThemePreferenceStorageKey = 'papelizThemePreference'

// The browser's own bar matches the blue top bar, as in the app.
const papelizSiteBrowserBarColorsByTheme = { light: '#0064d4', dark: '#0d2f5c' } as const
export const papelizSiteLightBrowserBarColor = papelizSiteBrowserBarColorsByTheme.light

// Runs in <head> before the page paints, so a dark choice never flashes light. It also follows the
// device while the choice is "Device", and a choice made in another tab of the site.
export const papelizSiteThemeBootScript = `(function () {
  var themeStorageKey = ${JSON.stringify(papelizSiteThemePreferenceStorageKey)};
  var browserBarColors = ${JSON.stringify(papelizSiteBrowserBarColorsByTheme)};
  var darkDeviceQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function readThemePreference() {
    try {
      var storedThemePreference = window.localStorage.getItem(themeStorageKey);
      return storedThemePreference === 'dark' || storedThemePreference === 'system' ? storedThemePreference : 'light';
    } catch (storageError) {
      return 'light';
    }
  }
  function applyThemePreference() {
    var themePreference = readThemePreference();
    if (themePreference === 'system') document.documentElement.removeAttribute('data-papeliz-theme');
    else document.documentElement.setAttribute('data-papeliz-theme', themePreference);
    var shownTheme = themePreference === 'system' ? (darkDeviceQuery.matches ? 'dark' : 'light') : themePreference;
    var browserBarColorMeta = document.querySelector('meta[name="theme-color"]');
    if (browserBarColorMeta) browserBarColorMeta.setAttribute('content', browserBarColors[shownTheme]);
  }
  applyThemePreference();
  document.addEventListener('DOMContentLoaded', applyThemePreference);
  darkDeviceQuery.addEventListener('change', applyThemePreference);
  window.addEventListener('storage', function (storageEvent) {
    if (storageEvent.key === themeStorageKey) applyThemePreference();
  });
})();`

function isPapelizSiteThemePreference(storedThemePreference: unknown): storedThemePreference is PapelizSiteThemePreference {
  return storedThemePreference === 'system' || storedThemePreference === 'light' || storedThemePreference === 'dark'
}

export function readPapelizSiteThemePreference(): PapelizSiteThemePreference {
  try {
    const storedThemePreference = window.localStorage.getItem(papelizSiteThemePreferenceStorageKey)
    return isPapelizSiteThemePreference(storedThemePreference) ? storedThemePreference : 'light'
  } catch {
    return 'light'
  }
}

export function choosePapelizSiteThemePreference(papelizSiteThemePreference: PapelizSiteThemePreference): void {
  const htmlElement = document.documentElement
  // Colors ease into the new theme for a quarter second, then transitions go back to normal.
  htmlElement.classList.add('papeliz-theme-is-changing')
  window.setTimeout(() => htmlElement.classList.remove('papeliz-theme-is-changing'), 300)
  if (papelizSiteThemePreference === 'system') delete htmlElement.dataset['papelizTheme']
  else htmlElement.dataset['papelizTheme'] = papelizSiteThemePreference
  const shownTheme =
    papelizSiteThemePreference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : papelizSiteThemePreference
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', papelizSiteBrowserBarColorsByTheme[shownTheme])
  try {
    window.localStorage.setItem(papelizSiteThemePreferenceStorageKey, papelizSiteThemePreference)
  } catch {
    // Storage can be blocked (a private window, site data turned off); the choice then lasts for this page.
  }
}
