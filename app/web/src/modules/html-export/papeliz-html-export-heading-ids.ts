// Heading ids the way GitHub writes them, so `#launch-plan` links land on the "Launch plan"
// heading: lower case, punctuation dropped, spaces as hyphens, and `-1`, `-2` for repeats.

const papelizHeadingIdDroppedCharacterPattern = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu

export function createPapelizHtmlExportHeadingIdMaker(): (headingText: string) => string {
  const headingIdUseCounts = new Map<string, number>()
  return (headingText) => {
    const baseHeadingId = headingText.trim().toLowerCase().replace(papelizHeadingIdDroppedCharacterPattern, '').replace(/ /g, '-')
    let headingId = baseHeadingId
    let headingIdUseCount = headingIdUseCounts.get(baseHeadingId) ?? 0
    while (headingIdUseCounts.has(headingId)) {
      headingIdUseCount += 1
      headingId = `${baseHeadingId}-${headingIdUseCount}`
    }
    headingIdUseCounts.set(baseHeadingId, headingIdUseCount)
    headingIdUseCounts.set(headingId, 0)
    return headingId
  }
}
