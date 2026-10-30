// Sets the site's light or dark theme before the page draws, from the reader's choice (Light, Dark
// or Match this device), so a dark page never flashes white. papeliz-site.js keeps it up to date.
;(function () {
  'use strict'
  var papelizSiteThemePreference = 'device'
  try {
    papelizSiteThemePreference = window.localStorage.getItem('papelizSiteThemePreference') || 'device'
  } catch (storageError) {
    // Storage can be off (a private window); the device's theme is used.
  }
  var isDarkTheme =
    papelizSiteThemePreference === 'dark' ||
    (papelizSiteThemePreference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-papeliz-site-theme', isDarkTheme ? 'dark' : 'light')
})()
