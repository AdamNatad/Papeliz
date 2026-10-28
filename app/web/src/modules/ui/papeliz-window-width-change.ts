// Calls `onWindowWidthChange` when the window gets wider or narrower: a desktop window resized, or a
// phone turned. A change in height alone is left out, since phones change the height all the time
// (the address bar hides on scroll, the keyboard opens), and a menu closing then would close under
// the user's finger. Gives back the function that stops listening.
export function subscribeToPapelizWindowWidthChange(onWindowWidthChange: () => void): () => void {
  let lastWindowWidth = window.innerWidth
  const callOnWidthChange = () => {
    if (window.innerWidth === lastWindowWidth) return
    lastWindowWidth = window.innerWidth
    onWindowWidthChange()
  }
  window.addEventListener('resize', callOnWidthChange)
  return () => window.removeEventListener('resize', callOnWidthChange)
}
