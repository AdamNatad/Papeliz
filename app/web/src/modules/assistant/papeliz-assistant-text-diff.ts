// A word-level diff for showing what the assistant wants to change. It splits both texts into
// words, spaces and punctuation, finds the longest run of tokens they share (LCS), and reports what
// was kept, removed and added. Notes are short enough that the quadratic table stays small; very
// long passages fall back to "all removed, all added" rather than stall the page.

export type PapelizTextDiffPartKind = 'kept' | 'removed' | 'added'

export interface PapelizTextDiffPart {
  textDiffPartKind: PapelizTextDiffPartKind
  textDiffPartText: string
}

const papelizTextDiffTokenPattern = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu
const papelizTextDiffMaximumTableCells = 4_000_000

function splitIntoDiffTokens(diffedText: string): string[] {
  return diffedText.match(papelizTextDiffTokenPattern) ?? []
}

function pushDiffPart(textDiffParts: PapelizTextDiffPart[], textDiffPartKind: PapelizTextDiffPartKind, textDiffPartText: string): void {
  if (textDiffPartText.length === 0) return
  const lastTextDiffPart = textDiffParts[textDiffParts.length - 1]
  if (lastTextDiffPart?.textDiffPartKind === textDiffPartKind) lastTextDiffPart.textDiffPartText += textDiffPartText
  else textDiffParts.push({ textDiffPartKind, textDiffPartText })
}

export function diffPapelizTextByWords(originalText: string, changedText: string): PapelizTextDiffPart[] {
  const textDiffParts: PapelizTextDiffPart[] = []
  if (originalText === changedText) {
    pushDiffPart(textDiffParts, 'kept', originalText)
    return textDiffParts
  }
  const originalTokens = splitIntoDiffTokens(originalText)
  const changedTokens = splitIntoDiffTokens(changedText)

  // Shared start and end are kept as they are; only the middle needs the table.
  let sharedStartLength = 0
  while (
    sharedStartLength < originalTokens.length &&
    sharedStartLength < changedTokens.length &&
    originalTokens[sharedStartLength] === changedTokens[sharedStartLength]
  ) {
    sharedStartLength += 1
  }
  let sharedEndLength = 0
  while (
    sharedEndLength < originalTokens.length - sharedStartLength &&
    sharedEndLength < changedTokens.length - sharedStartLength &&
    originalTokens[originalTokens.length - 1 - sharedEndLength] === changedTokens[changedTokens.length - 1 - sharedEndLength]
  ) {
    sharedEndLength += 1
  }
  const originalMiddleTokens = originalTokens.slice(sharedStartLength, originalTokens.length - sharedEndLength)
  const changedMiddleTokens = changedTokens.slice(sharedStartLength, changedTokens.length - sharedEndLength)

  pushDiffPart(textDiffParts, 'kept', originalTokens.slice(0, sharedStartLength).join(''))

  if ((originalMiddleTokens.length + 1) * (changedMiddleTokens.length + 1) > papelizTextDiffMaximumTableCells) {
    pushDiffPart(textDiffParts, 'removed', originalMiddleTokens.join(''))
    pushDiffPart(textDiffParts, 'added', changedMiddleTokens.join(''))
  } else {
    // sharedLengths[i][j]: longest shared run of originalMiddle[i..] and changedMiddle[j..].
    const columnCount = changedMiddleTokens.length + 1
    const sharedLengths = new Uint32Array((originalMiddleTokens.length + 1) * columnCount)
    for (let originalIndex = originalMiddleTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
      for (let changedIndex = changedMiddleTokens.length - 1; changedIndex >= 0; changedIndex -= 1) {
        sharedLengths[originalIndex * columnCount + changedIndex] =
          originalMiddleTokens[originalIndex] === changedMiddleTokens[changedIndex]
            ? (sharedLengths[(originalIndex + 1) * columnCount + changedIndex + 1] ?? 0) + 1
            : Math.max(
                sharedLengths[(originalIndex + 1) * columnCount + changedIndex] ?? 0,
                sharedLengths[originalIndex * columnCount + changedIndex + 1] ?? 0,
              )
      }
    }
    let originalIndex = 0
    let changedIndex = 0
    while (originalIndex < originalMiddleTokens.length && changedIndex < changedMiddleTokens.length) {
      if (originalMiddleTokens[originalIndex] === changedMiddleTokens[changedIndex]) {
        pushDiffPart(textDiffParts, 'kept', originalMiddleTokens[originalIndex] ?? '')
        originalIndex += 1
        changedIndex += 1
      } else if (
        (sharedLengths[(originalIndex + 1) * columnCount + changedIndex] ?? 0) >= (sharedLengths[originalIndex * columnCount + changedIndex + 1] ?? 0)
      ) {
        pushDiffPart(textDiffParts, 'removed', originalMiddleTokens[originalIndex] ?? '')
        originalIndex += 1
      } else {
        pushDiffPart(textDiffParts, 'added', changedMiddleTokens[changedIndex] ?? '')
        changedIndex += 1
      }
    }
    pushDiffPart(textDiffParts, 'removed', originalMiddleTokens.slice(originalIndex).join(''))
    pushDiffPart(textDiffParts, 'added', changedMiddleTokens.slice(changedIndex).join(''))
  }

  pushDiffPart(textDiffParts, 'kept', originalTokens.slice(originalTokens.length - sharedEndLength).join(''))
  return textDiffParts
}

// Turns diff parts back into either side, so a diff can be checked against its two texts.
export function joinPapelizTextDiffSide(textDiffParts: readonly PapelizTextDiffPart[], textDiffSide: 'original' | 'changed'): string {
  return textDiffParts
    .filter((textDiffPart) => textDiffPart.textDiffPartKind === 'kept' || textDiffPart.textDiffPartKind === (textDiffSide === 'original' ? 'removed' : 'added'))
    .map((textDiffPart) => textDiffPart.textDiffPartText)
    .join('')
}
