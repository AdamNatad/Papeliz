'use client'

import { useEffect } from 'react'

// A warning printed once in the browser's developer console: people are sometimes told to paste
// code there to "unlock" something, which hands a stranger the page. The website holds the Papeliz
// account sign-in, so the warning says that is what they would get. Printed after the page's own
// start-up logs, in Papeliz's blue on a dark ground so it reads in a light or dark console.
// The web app prints the same lines from its own copy, app/web/src/modules/ui/papeliz-console-warning.ts,
// which says the API keys and notes instead; a change to one goes into the other.

const papelizSiteConsoleWarningGroundRule =
  'background-color: #111112; padding: 5px 10px; border-radius: 5px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); text-shadow: none; font-weight: normal;'

const papelizSiteConsoleWarningStopRule = `${papelizSiteConsoleWarningGroundRule} color: #ff4d4f; font-size: 40px; font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;`
const papelizSiteConsoleWarningTitleRule = `${papelizSiteConsoleWarningGroundRule} color: #ffffff; -webkit-text-stroke: 1px #0064d4; font-size: 30px; font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;`
const papelizSiteConsoleWarningMessageRule = `${papelizSiteConsoleWarningGroundRule} color: #ffffff; font-size: 16px; font-family: Figtree, system-ui, sans-serif;`

const papelizSiteConsoleWarningLines: ReadonlyArray<{ consoleWarningText: string; consoleWarningRule: string }> = [
  { consoleWarningText: 'STOP!', consoleWarningRule: papelizSiteConsoleWarningStopRule },
  { consoleWarningText: 'Great power comes with great responsibility! - Adam Natad', consoleWarningRule: papelizSiteConsoleWarningTitleRule },
  {
    consoleWarningText:
      'This is a browser feature intended for developers. If someone told you to copy and paste something here to enable a feature or "hack" something, it is a scam and will give them access to your Papeliz account.',
    consoleWarningRule: papelizSiteConsoleWarningMessageRule,
  },
  { consoleWarningText: 'See https://en.wikipedia.org/wiki/Self-XSS for more information.', consoleWarningRule: papelizSiteConsoleWarningMessageRule },
]

// Once per page load: the root layout stays mounted across the site's own link clicks, and the flag
// holds through React running effects twice in development.
let hasPapelizSiteConsoleWarningShown = false

function showPapelizSiteConsoleWarning(): void {
  if (hasPapelizSiteConsoleWarningShown) return
  hasPapelizSiteConsoleWarningShown = true
  for (const { consoleWarningText, consoleWarningRule } of papelizSiteConsoleWarningLines) {
    setTimeout(console.log.bind(console, `%c${consoleWarningText}`, consoleWarningRule), 0)
  }
}

// Rendered once in the root layout. It draws nothing and adds nothing to the static HTML: the warning
// prints from the page's script bundle after React starts, so no inline script meets the account
// page's Content-Security-Policy.
export function PapelizSiteConsoleWarning(): null {
  useEffect(() => {
    showPapelizSiteConsoleWarning()
  }, [])
  return null
}
