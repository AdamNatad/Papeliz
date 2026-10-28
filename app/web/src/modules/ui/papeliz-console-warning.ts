// A warning printed once in the browser's developer console: people are sometimes told to paste
// code there to "unlock" something, which hands a stranger the page. Papeliz keeps the user's API
// keys and notes in this page, so the warning says so. Printed after the page's own start-up logs,
// in Papeliz's blue on a dark ground so it reads in a light or dark console.

const papelizConsoleWarningGroundRule =
  'background-color: #111112; padding: 5px 10px; border-radius: 5px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); text-shadow: none; font-weight: normal;'

const papelizConsoleWarningStopRule = `${papelizConsoleWarningGroundRule} color: #ff4d4f; font-size: 40px; font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;`
const papelizConsoleWarningTitleRule = `${papelizConsoleWarningGroundRule} color: #ffffff; -webkit-text-stroke: 1px #0064d4; font-size: 30px; font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;`
const papelizConsoleWarningMessageRule = `${papelizConsoleWarningGroundRule} color: #ffffff; font-size: 16px; font-family: Figtree, system-ui, sans-serif;`

const papelizConsoleWarningLines: ReadonlyArray<{ consoleWarningText: string; consoleWarningRule: string }> = [
  { consoleWarningText: 'STOP!', consoleWarningRule: papelizConsoleWarningStopRule },
  { consoleWarningText: 'Great power comes with great responsibility! - Adam Natad', consoleWarningRule: papelizConsoleWarningTitleRule },
  {
    consoleWarningText:
      'This is a browser feature intended for developers. If someone told you to copy and paste something here to enable a feature or "hack" something, it is a scam and will give them your API keys and your notes.',
    consoleWarningRule: papelizConsoleWarningMessageRule,
  },
  { consoleWarningText: 'See https://en.wikipedia.org/wiki/Self-XSS for more information.', consoleWarningRule: papelizConsoleWarningMessageRule },
]

let hasPapelizConsoleWarningShown = false

export function showPapelizConsoleWarning(): void {
  if (hasPapelizConsoleWarningShown) return
  hasPapelizConsoleWarningShown = true
  for (const { consoleWarningText, consoleWarningRule } of papelizConsoleWarningLines) {
    setTimeout(console.log.bind(console, `%c${consoleWarningText}`, consoleWarningRule), 0)
  }
}
