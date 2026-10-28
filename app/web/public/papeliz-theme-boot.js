// Runs in <head> before the page paints, so a dark choice never flashes light. It reads the theme
// shared with the website (localStorage "papelizThemePreference": light, dark or system; anything
// else is light) and sets data-papeliz-theme and the browser bar's color. A same-origin file, so
// the Content-Security-Policy's script-src 'self' allows it. The app takes over once it loads
// (src/modules/ui/papeliz-theme.ts).
;(function () {
  var themeStorageKey = 'papelizThemePreference'
  var browserBarColors = { light: '#0064d4', dark: '#0d2f5c' }
  var themePreference = 'light'
  try {
    var storedThemePreference = window.localStorage.getItem(themeStorageKey)
    if (storedThemePreference === 'dark' || storedThemePreference === 'system') themePreference = storedThemePreference
  } catch {
    // Storage can be blocked (a private window, site data turned off): Light.
    themePreference = 'light'
  }
  if (themePreference === 'system') document.documentElement.removeAttribute('data-papeliz-theme')
  else document.documentElement.setAttribute('data-papeliz-theme', themePreference)
  var shownTheme = themePreference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themePreference
  var browserBarColorMeta = document.querySelector('meta[name="theme-color"]')
  if (browserBarColorMeta) browserBarColorMeta.setAttribute('content', browserBarColors[shownTheme])
})()
