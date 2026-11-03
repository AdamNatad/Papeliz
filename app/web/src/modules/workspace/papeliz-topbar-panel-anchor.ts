// What a top-bar panel (Export, Settings) hangs from: its own button, or the bar's More button when the
// bar has no room for the two and has folded them into More, which leaves their buttons without a box.
export const papelizTopbarMoreButtonAttributeName = 'data-papeliz-topbar-more-button'

export function findPapelizTopbarPanelAnchorElement(topbarPanelButtonElement: HTMLElement): HTMLElement {
  if (topbarPanelButtonElement.getClientRects().length > 0) return topbarPanelButtonElement
  return document.querySelector<HTMLElement>(`[${papelizTopbarMoreButtonAttributeName}]`) ?? topbarPanelButtonElement
}
