import { useCallback, type RefCallback } from 'react'

// Cancel and the action in a dialog's or form's footer share one width: the widest button's own
// width, never below the minimum, so the two read as a pair and a longer label widens both together.
function equalizePapelizFooterButtonWidths(papelizFooterElement: HTMLElement, papelizFooterButtonMinimumWidthPx: number): void {
  const papelizFooterButtons = Array.from(papelizFooterElement.querySelectorAll('button'))
  // Each at its own width first, then all at the widest.
  for (const papelizFooterButton of papelizFooterButtons) papelizFooterButton.style.removeProperty('width')
  let widestPapelizFooterButtonWidth = papelizFooterButtonMinimumWidthPx
  for (const papelizFooterButton of papelizFooterButtons) {
    // offsetWidth too: a pressed button's scale shrinks only its drawn box. Rounded up below, so a
    // 101.4px label never gets 101px and wraps.
    widestPapelizFooterButtonWidth = Math.max(widestPapelizFooterButtonWidth, papelizFooterButton.getBoundingClientRect().width, papelizFooterButton.offsetWidth)
  }
  for (const papelizFooterButton of papelizFooterButtons) papelizFooterButton.style.width = `${Math.ceil(widestPapelizFooterButtonWidth)}px`
}

// A callback ref for a footer: its buttons keep one width while it is shown, again when a label
// changes (Pick folder becomes Create vault) and once the web fonts load. Only text and child changes
// are watched, so the widths it sets never set it off again.
export function usePapelizFooterEqualButtonWidthRef(papelizFooterButtonMinimumWidthPx = 100): RefCallback<HTMLElement> {
  return useCallback(
    (papelizFooterElement: HTMLElement | null) => {
      if (papelizFooterElement === null) return
      equalizePapelizFooterButtonWidths(papelizFooterElement, papelizFooterButtonMinimumWidthPx)
      const papelizFooterLabelObserver = new MutationObserver(() => equalizePapelizFooterButtonWidths(papelizFooterElement, papelizFooterButtonMinimumWidthPx))
      papelizFooterLabelObserver.observe(papelizFooterElement, { childList: true, characterData: true, subtree: true })
      let isPapelizFooterShown = true
      void document.fonts.ready.then(() => {
        if (isPapelizFooterShown) equalizePapelizFooterButtonWidths(papelizFooterElement, papelizFooterButtonMinimumWidthPx)
      })
      return () => {
        isPapelizFooterShown = false
        papelizFooterLabelObserver.disconnect()
      }
    },
    [papelizFooterButtonMinimumWidthPx],
  )
}
