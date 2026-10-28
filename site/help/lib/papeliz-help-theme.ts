// The theme, as in the app (app/web/src/modules/ui/papeliz-theme.ts): Light, the default; Dark; or
// the device's ("system"). "system" leaves it to the prefers-color-scheme media query in
// app/globals.css; the other two pin it with data-papeliz-theme on <html>.
export type PapelizHelpThemePreference = 'system' | 'light' | 'dark'

// The same localStorage key as the website (site/main/lib/papeliz-site-theme.ts): the two are served
// from one domain, so they share the choice.
export const papelizHelpThemePreferenceStorageKey = 'papelizThemePreference'

// The browser's own bar matches the blue top bar, as in the app.
const papelizHelpBrowserBarColorsByTheme = { light: '#0064d4', dark: '#0d2f5c' } as const
export const papelizHelpLightBrowserBarColor = papelizHelpBrowserBarColorsByTheme.light

// Runs in <head> before the page paints, so a dark choice never flashes light. It also follows the
// device while the choice is "Device", and a choice made in another tab of the site or the website.
export const papelizHelpThemeBootScript = `(function () {
  var themeStorageKey = ${JSON.stringify(papelizHelpThemePreferenceStorageKey)};
  var browserBarColors = ${JSON.stringify(papelizHelpBrowserBarColorsByTheme)};
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

function isPapelizHelpThemePreference(storedThemePreference: unknown): storedThemePreference is PapelizHelpThemePreference {
  return storedThemePreference === 'system' || storedThemePreference === 'light' || storedThemePreference === 'dark'
}

export function readPapelizHelpThemePreference(): PapelizHelpThemePreference {
  try {
    const storedThemePreference = window.localStorage.getItem(papelizHelpThemePreferenceStorageKey)
    return isPapelizHelpThemePreference(storedThemePreference) ? storedThemePreference : 'light'
  } catch {
    return 'light'
  }
}

export function choosePapelizHelpThemePreference(papelizHelpThemePreference: PapelizHelpThemePreference): void {
  const htmlElement = document.documentElement
  // Colors ease into the new theme for a quarter second, then transitions go back to normal.
  htmlElement.classList.add('papeliz-theme-is-changing')
  window.setTimeout(() => htmlElement.classList.remove('papeliz-theme-is-changing'), 300)
  if (papelizHelpThemePreference === 'system') delete htmlElement.dataset['papelizTheme']
  else htmlElement.dataset['papelizTheme'] = papelizHelpThemePreference
  const shownTheme =
    papelizHelpThemePreference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : papelizHelpThemePreference
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', papelizHelpBrowserBarColorsByTheme[shownTheme])
  try {
    window.localStorage.setItem(papelizHelpThemePreferenceStorageKey, papelizHelpThemePreference)
  } catch {
    // Storage can be blocked (a private window, site data turned off); the choice then lasts for this page.
  }
}
