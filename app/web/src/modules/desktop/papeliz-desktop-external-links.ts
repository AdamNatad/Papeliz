import type { PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'

// A web address the person's own browser should open.
function isPapelizExternalWebAddress(linkAddress: string): boolean {
  return /^https?:\/\//i.test(linkAddress)
}

// Papeliz for Windows opens web links in the person's own browser, never in a Papeliz window: a pressed
// link to a web address (any button, any target, since following it in place would take the app's own
// window away) and the page's own `window.open` (MD View's Ctrl+click) all go there. Links inside the
// app, and anything that isn't a web address, behave as in the web app. Gives back the call that puts
// the page's own behaviour back.
export function sendPapelizDesktopExternalLinksToSystemBrowser(papelizDesktopPlatform: PapelizDesktopPlatform): () => void {
  const openPageWindow = window.open.bind(window)
  window.open = (openedAddress?: string | URL, openedTarget?: string, openedFeatures?: string) => {
    const openedAddressText = openedAddress === undefined ? '' : String(openedAddress)
    if (!isPapelizExternalWebAddress(openedAddressText)) return openPageWindow(openedAddress, openedTarget, openedFeatures)
    void papelizDesktopPlatform.openLinkInSystemBrowser(openedAddressText)
    return null
  }

  const openClickedExternalLinkInSystemBrowser = (pointerEvent: MouseEvent) => {
    if (pointerEvent.defaultPrevented || !(pointerEvent.target instanceof Element)) return
    const clickedLink = pointerEvent.target.closest('a[href]')
    if (!(clickedLink instanceof HTMLAnchorElement) || !isPapelizExternalWebAddress(clickedLink.href) || clickedLink.origin === window.location.origin) return
    pointerEvent.preventDefault()
    void papelizDesktopPlatform.openLinkInSystemBrowser(clickedLink.href)
  }
  document.addEventListener('click', openClickedExternalLinkInSystemBrowser)
  document.addEventListener('auxclick', openClickedExternalLinkInSystemBrowser)

  return () => {
    window.open = openPageWindow
    document.removeEventListener('click', openClickedExternalLinkInSystemBrowser)
    document.removeEventListener('auxclick', openClickedExternalLinkInSystemBrowser)
  }
}
