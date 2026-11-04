// Edge shows the title of an element focused from a key as a tooltip that stays until focus moves on,
// and a menu or a dialog puts focus back on what had it when it closes, from Esc as often as not. So
// that element's title is taken off while focus goes back, and comes back once focus leaves it or the
// pointer comes over it (at once if focus went elsewhere).
export function givePapelizFocusBackWithTitleHeldBack(focusReturnElement: HTMLElement, giveFocusBack: () => void) {
  const heldBackTitleText = focusReturnElement.getAttribute('title')
  if (heldBackTitleText === null) {
    giveFocusBack()
    return
  }
  focusReturnElement.removeAttribute('title')
  const putTitleBack = () => {
    focusReturnElement.removeEventListener('blur', putTitleBack)
    focusReturnElement.removeEventListener('pointerenter', putTitleBack)
    // Unless its own code has set a new one meanwhile.
    if (!focusReturnElement.hasAttribute('title')) focusReturnElement.setAttribute('title', heldBackTitleText)
  }
  giveFocusBack()
  if (document.activeElement !== focusReturnElement) {
    putTitleBack()
    return
  }
  focusReturnElement.addEventListener('blur', putTitleBack)
  focusReturnElement.addEventListener('pointerenter', putTitleBack)
}
