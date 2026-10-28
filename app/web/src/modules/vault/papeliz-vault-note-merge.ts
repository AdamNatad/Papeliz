// Three-way merge for a note saved in two places at once (two tabs, or another app): the version
// this tab started from (`base`), the version saved since (`theirs`, "saved" to the user) and this
// tab's version (`mine`). Line by line, diff3-style:
// - a spot only one side changed takes that side's change;
// - a spot both sides changed the same way takes it once;
// - a spot both sides changed differently is a conflict, which the user settles (Keep both, Keep
//   saved, Keep mine), Keep both by default, so saved text is never dropped silently.
// Two refinements keep conflicts small: what both sides share at a conflict's edges is moved out of
// it, and a conflicting stretch of the same length on all three sides is compared line by line, so
// edits to neighbouring lines combine. Pure: no stores and no I/O.

export type PapelizVaultNoteMergeChoice = 'both' | 'saved' | 'mine'

interface PapelizMergeStableChunk {
  mergeChunkKind: 'stable'
  mergeChunkLines: string[]
}

interface PapelizMergeConflictChunk {
  mergeChunkKind: 'conflict'
  baseLines: string[]
  theirLines: string[]
  myLines: string[]
}

type PapelizMergeChunk = PapelizMergeStableChunk | PapelizMergeConflictChunk

// One spot both sides changed differently, as the user sees it.
export interface PapelizVaultNoteMergeConflict {
  mergeConflictId: string
  baseText: string
  savedText: string
  myText: string
}

export type PapelizVaultNoteMergeResult =
  | { mergeOutcome: 'clean'; mergedVaultNoteText: string }
  | {
      mergeOutcome: 'conflict'
      mergeConflicts: PapelizVaultNoteMergeConflict[]
      // What it takes to write the note once each conflict is settled.
      mergeChunks: PapelizMergeChunk[]
      mergedLineEnding: '\n' | '\r\n'
      hasMergedFinalNewline: boolean
    }

// Myers' diff gives up past this many edits between two sides (its trace is kept in O(D²) memory),
// and the stretch between the common edges becomes one conflict instead.
const papelizMergeMaximumEditDistance = 2000
// An upper bound on diagonal steps, so a strange input can't stall a save.
const papelizMergeMaximumDiffWork = 50_000_000

// Index pairs [aIndex, bIndex] of a longest common subsequence of `aLines` and `bLines`, in order, or
// null when the two are too different to diff within the limits.
export function findLongestCommonLineSubsequence(aLines: readonly string[], bLines: readonly string[]): Array<[number, number]> | null {
  // Interning makes every comparison an integer compare, however long the lines are.
  const lineIds = new Map<string, number>()
  const internLines = (lines: readonly string[]): Int32Array => {
    const internedLines = new Int32Array(lines.length)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!
      let lineId = lineIds.get(line)
      if (lineId === undefined) {
        lineId = lineIds.size
        lineIds.set(line, lineId)
      }
      internedLines[lineIndex] = lineId
    }
    return internedLines
  }
  const leftLineIds = internLines(aLines)
  const rightLineIds = internLines(bLines)

  let sharedPrefixLength = 0
  while (sharedPrefixLength < leftLineIds.length && sharedPrefixLength < rightLineIds.length && leftLineIds[sharedPrefixLength] === rightLineIds[sharedPrefixLength]) {
    sharedPrefixLength += 1
  }
  let sharedSuffixLength = 0
  while (
    sharedSuffixLength < leftLineIds.length - sharedPrefixLength &&
    sharedSuffixLength < rightLineIds.length - sharedPrefixLength &&
    leftLineIds[leftLineIds.length - 1 - sharedSuffixLength] === rightLineIds[rightLineIds.length - 1 - sharedSuffixLength]
  ) {
    sharedSuffixLength += 1
  }

  const middlePairs = findMyersPairs(
    leftLineIds.subarray(sharedPrefixLength, leftLineIds.length - sharedSuffixLength),
    rightLineIds.subarray(sharedPrefixLength, rightLineIds.length - sharedSuffixLength),
  )
  if (middlePairs === null) return null

  const linePairs: Array<[number, number]> = []
  for (let lineIndex = 0; lineIndex < sharedPrefixLength; lineIndex += 1) linePairs.push([lineIndex, lineIndex])
  for (const [leftIndex, rightIndex] of middlePairs) linePairs.push([leftIndex + sharedPrefixLength, rightIndex + sharedPrefixLength])
  for (let suffixIndex = sharedSuffixLength; suffixIndex > 0; suffixIndex -= 1) linePairs.push([leftLineIds.length - suffixIndex, rightLineIds.length - suffixIndex])
  return linePairs
}

// Myers' O(ND) greedy diff, keeping each step's diagonal window for the backtrack.
function findMyersPairs(leftLineIds: Int32Array, rightLineIds: Int32Array): Array<[number, number]> | null {
  const leftLength = leftLineIds.length
  const rightLength = rightLineIds.length
  if (leftLength === 0 || rightLength === 0) return []
  const maximumSteps = leftLength + rightLength
  const diagonalOffset = maximumSteps + 1
  const furthestReach = new Int32Array(2 * maximumSteps + 3)
  // stepTrace[step] holds furthestReach before that step, for diagonals -step-1..step+1.
  const stepTrace: Int32Array[] = []
  let diffWork = 0
  for (let step = 0; step <= maximumSteps; step += 1) {
    if (step > papelizMergeMaximumEditDistance) return null
    stepTrace.push(furthestReach.slice(diagonalOffset - step - 1, diagonalOffset + step + 2))
    for (let diagonal = -step; diagonal <= step; diagonal += 2) {
      let leftAt =
        diagonal === -step || (diagonal !== step && furthestReach[diagonalOffset + diagonal - 1]! < furthestReach[diagonalOffset + diagonal + 1]!)
          ? furthestReach[diagonalOffset + diagonal + 1]!
          : furthestReach[diagonalOffset + diagonal - 1]! + 1
      let rightAt = leftAt - diagonal
      while (leftAt < leftLength && rightAt < rightLength && leftLineIds[leftAt] === rightLineIds[rightAt]) {
        leftAt += 1
        rightAt += 1
        diffWork += 1
      }
      furthestReach[diagonalOffset + diagonal] = leftAt
      diffWork += 1
      if (diffWork > papelizMergeMaximumDiffWork) return null
      if (leftAt >= leftLength && rightAt >= rightLength) return backtrackMyersPairs(stepTrace, step, leftLength, rightLength)
    }
  }
  return null
}

function backtrackMyersPairs(stepTrace: Int32Array[], lastStep: number, leftLength: number, rightLength: number): Array<[number, number]> {
  const linePairs: Array<[number, number]> = []
  let leftAt = leftLength
  let rightAt = rightLength
  for (let step = lastStep; step >= 0; step -= 1) {
    const stepWindow = stepTrace[step]!
    const reachOn = (diagonal: number) => stepWindow[diagonal + step + 1]!
    const diagonal = leftAt - rightAt
    const previousDiagonal = diagonal === -step || (diagonal !== step && reachOn(diagonal - 1) < reachOn(diagonal + 1)) ? diagonal + 1 : diagonal - 1
    const previousLeftAt = reachOn(previousDiagonal)
    const previousRightAt = previousLeftAt - previousDiagonal
    while (leftAt > previousLeftAt && rightAt > previousRightAt) {
      leftAt -= 1
      rightAt -= 1
      linePairs.push([leftAt, rightAt])
    }
    leftAt = previousLeftAt
    rightAt = previousRightAt
  }
  linePairs.reverse()
  return linePairs
}

function areSameLines(leftLines: readonly string[], rightLines: readonly string[]): boolean {
  return leftLines.length === rightLines.length && leftLines.every((line, lineIndex) => rightLines[lineIndex] === line)
}

function pushStableLines(mergeChunks: PapelizMergeChunk[], stableLines: readonly string[]): void {
  if (stableLines.length === 0) return
  const lastMergeChunk = mergeChunks[mergeChunks.length - 1]
  if (lastMergeChunk?.mergeChunkKind === 'stable') lastMergeChunk.mergeChunkLines.push(...stableLines)
  else mergeChunks.push({ mergeChunkKind: 'stable', mergeChunkLines: [...stableLines] })
}

function startsWithLines(lines: readonly string[], headLines: readonly string[]): boolean {
  return headLines.length <= lines.length && headLines.every((line, lineIndex) => lines[lineIndex] === line)
}

function endsWithLines(lines: readonly string[], tailLines: readonly string[]): boolean {
  return tailLines.length <= lines.length && tailLines.every((line, lineIndex) => lines[lines.length - tailLines.length + lineIndex] === line)
}

function countSharedPrefixLines(leftLines: readonly string[], rightLines: readonly string[], lineLimit: number): number {
  let sharedLineCount = 0
  while (sharedLineCount < lineLimit && leftLines[sharedLineCount] === rightLines[sharedLineCount]) sharedLineCount += 1
  return sharedLineCount
}

function countSharedSuffixLines(leftLines: readonly string[], rightLines: readonly string[], lineLimit: number): number {
  let sharedLineCount = 0
  while (sharedLineCount < lineLimit && leftLines[leftLines.length - 1 - sharedLineCount] === rightLines[rightLines.length - 1 - sharedLineCount]) sharedLineCount += 1
  return sharedLineCount
}

// Settles one stretch between two anchors all three sides share.
function mergeLineRegion(
  baseLines: string[],
  theirLines: string[],
  myLines: string[],
  mergeChunks: PapelizMergeChunk[],
  isEqualLengthAligned: boolean,
  isAfterSharedEdges = false,
): void {
  if (areSameLines(theirLines, myLines)) return pushStableLines(mergeChunks, theirLines)
  if (areSameLines(baseLines, theirLines)) return pushStableLines(mergeChunks, myLines)
  if (areSameLines(baseLines, myLines)) return pushStableLines(mergeChunks, theirLines)
  if (isAfterSharedEdges) {
    // Both sides made the same change at this spot's edges and one only goes further. Saved text
    // left over always stays; my leftovers stay when they are new text rather than base text the
    // saved side removed.
    if (myLines.length === 0) return pushStableLines(mergeChunks, theirLines)
    if (theirLines.length === 0 && !myLines.some((myLine) => baseLines.includes(myLine))) return pushStableLines(mergeChunks, myLines)
  }

  // As git does: what both sides share at the edges is not part of the conflict. The base is
  // trimmed only as far as it matches those edges too.
  const shorterSideLength = Math.min(theirLines.length, myLines.length)
  const sharedPrefixLength = countSharedPrefixLines(theirLines, myLines, shorterSideLength)
  const sharedSuffixLength = countSharedSuffixLines(theirLines, myLines, shorterSideLength - sharedPrefixLength)
  if (sharedPrefixLength > 0 || sharedSuffixLength > 0) {
    const basePrefixLength = countSharedPrefixLines(baseLines, theirLines, Math.min(sharedPrefixLength, baseLines.length))
    const baseSuffixLength = countSharedSuffixLines(baseLines, theirLines, Math.min(sharedSuffixLength, baseLines.length - basePrefixLength))
    pushStableLines(mergeChunks, theirLines.slice(0, sharedPrefixLength))
    mergeLineRegion(
      baseLines.slice(basePrefixLength, baseLines.length - baseSuffixLength),
      theirLines.slice(sharedPrefixLength, theirLines.length - sharedSuffixLength),
      myLines.slice(sharedPrefixLength, myLines.length - sharedSuffixLength),
      mergeChunks,
      isEqualLengthAligned,
      true,
    )
    pushStableLines(mergeChunks, theirLines.slice(theirLines.length - sharedSuffixLength))
    return
  }

  // One side only added lines before or after this stretch and the other edited it: keep the edit
  // and the addition. Both sides adding at the same spot still asks.
  const extendsBase = (sideLines: readonly string[]) =>
    baseLines.length > 0 && sideLines.length > baseLines.length && (startsWithLines(sideLines, baseLines) || endsWithLines(sideLines, baseLines))
  if (extendsBase(theirLines) && !extendsBase(myLines)) {
    return pushStableLines(
      mergeChunks,
      startsWithLines(theirLines, baseLines) ? [...myLines, ...theirLines.slice(baseLines.length)] : [...theirLines.slice(0, theirLines.length - baseLines.length), ...myLines],
    )
  }
  if (extendsBase(myLines) && !extendsBase(theirLines)) {
    return pushStableLines(
      mergeChunks,
      startsWithLines(myLines, baseLines) ? [...theirLines, ...myLines.slice(baseLines.length)] : [...myLines.slice(0, myLines.length - baseLines.length), ...theirLines],
    )
  }

  if (isEqualLengthAligned && baseLines.length === theirLines.length && theirLines.length === myLines.length) {
    for (let lineIndex = 0; lineIndex < baseLines.length; lineIndex += 1) {
      const baseLine = baseLines[lineIndex]!
      const theirLine = theirLines[lineIndex]!
      const myLine = myLines[lineIndex]!
      if (theirLine === myLine || baseLine === myLine) pushStableLines(mergeChunks, [theirLine])
      else if (baseLine === theirLine) pushStableLines(mergeChunks, [myLine])
      else mergeChunks.push({ mergeChunkKind: 'conflict', baseLines: [baseLine], theirLines: [theirLine], myLines: [myLine] })
    }
    return
  }

  mergeChunks.push({ mergeChunkKind: 'conflict', baseLines: [...baseLines], theirLines: [...theirLines], myLines: [...myLines] })
}

// Three-way merge of line lists; neighbouring stable lines come back as one chunk.
function mergeLines(baseLines: readonly string[], theirLines: readonly string[], myLines: readonly string[]): PapelizMergeChunk[] {
  const mergeChunks: PapelizMergeChunk[] = []
  // Edges all three share are stable without a diff.
  const shortestSideLength = Math.min(baseLines.length, theirLines.length, myLines.length)
  let sharedPrefixLength = 0
  while (sharedPrefixLength < shortestSideLength && baseLines[sharedPrefixLength] === theirLines[sharedPrefixLength] && baseLines[sharedPrefixLength] === myLines[sharedPrefixLength]) {
    sharedPrefixLength += 1
  }
  let sharedSuffixLength = 0
  while (
    sharedSuffixLength < shortestSideLength - sharedPrefixLength &&
    baseLines[baseLines.length - 1 - sharedSuffixLength] === theirLines[theirLines.length - 1 - sharedSuffixLength] &&
    baseLines[baseLines.length - 1 - sharedSuffixLength] === myLines[myLines.length - 1 - sharedSuffixLength]
  ) {
    sharedSuffixLength += 1
  }
  pushStableLines(mergeChunks, baseLines.slice(0, sharedPrefixLength))

  const baseMiddle = baseLines.slice(sharedPrefixLength, baseLines.length - sharedSuffixLength)
  const theirMiddle = theirLines.slice(sharedPrefixLength, theirLines.length - sharedSuffixLength)
  const myMiddle = myLines.slice(sharedPrefixLength, myLines.length - sharedSuffixLength)
  const baseToTheirPairs = findLongestCommonLineSubsequence(baseMiddle, theirMiddle)
  const baseToMyPairs = findLongestCommonLineSubsequence(baseMiddle, myMiddle)

  if (baseToTheirPairs === null || baseToMyPairs === null) {
    // Too different to line up: the whole middle is one spot.
    mergeLineRegion(baseMiddle, theirMiddle, myMiddle, mergeChunks, false)
  } else {
    const theirIndexByBaseIndex = new Int32Array(baseMiddle.length).fill(-1)
    const myIndexByBaseIndex = new Int32Array(baseMiddle.length).fill(-1)
    for (const [baseIndex, theirIndex] of baseToTheirPairs) theirIndexByBaseIndex[baseIndex] = theirIndex
    for (const [baseIndex, myIndex] of baseToMyPairs) myIndexByBaseIndex[baseIndex] = myIndex
    // A base line both sides kept is an anchor; the anchors cut all three lists into stretches.
    let baseAt = 0
    let theirAt = 0
    let myAt = 0
    for (let baseIndex = 0; baseIndex < baseMiddle.length; baseIndex += 1) {
      const theirIndex = theirIndexByBaseIndex[baseIndex]!
      const myIndex = myIndexByBaseIndex[baseIndex]!
      if (theirIndex < 0 || myIndex < 0) continue
      mergeLineRegion(baseMiddle.slice(baseAt, baseIndex), theirMiddle.slice(theirAt, theirIndex), myMiddle.slice(myAt, myIndex), mergeChunks, true)
      pushStableLines(mergeChunks, [baseMiddle[baseIndex]!])
      baseAt = baseIndex + 1
      theirAt = theirIndex + 1
      myAt = myIndex + 1
    }
    mergeLineRegion(baseMiddle.slice(baseAt), theirMiddle.slice(theirAt), myMiddle.slice(myAt), mergeChunks, true)
  }

  pushStableLines(mergeChunks, baseLines.slice(baseLines.length - sharedSuffixLength))
  return mergeChunks
}

interface PapelizSplitNoteText {
  noteLines: string[]
  noteLineEnding: '\n' | '\r\n'
  hasFinalNewline: boolean
}

// Splits a note into lines, keeping its line ending (CRLF only when every line uses it) and whether
// it ends with one.
function splitNoteTextLines(noteText: string): PapelizSplitNoteText {
  if (noteText === '') return { noteLines: [], noteLineEnding: '\n', hasFinalNewline: false }
  const noteLineEnding: '\n' | '\r\n' = noteText.includes('\r\n') && !/(^|[^\r])\n/.test(noteText) ? '\r\n' : '\n'
  const hasFinalNewline = noteText.endsWith(noteLineEnding)
  const noteBody = hasFinalNewline ? noteText.slice(0, noteText.length - noteLineEnding.length) : noteText
  return { noteLines: noteBody.split(noteLineEnding), noteLineEnding, hasFinalNewline }
}

function joinNoteTextLines(noteLines: readonly string[], noteLineEnding: '\n' | '\r\n', hasFinalNewline: boolean): string {
  if (noteLines.length === 0) return ''
  return noteLines.join(noteLineEnding) + (hasFinalNewline ? noteLineEnding : '')
}

// Mine where I changed it from the base, else the saved one.
function pickChangedSide<SideValue>(baseValue: SideValue, theirValue: SideValue, myValue: SideValue): SideValue {
  return myValue !== baseValue ? myValue : theirValue
}

export function mergePapelizVaultNoteText(baseNoteText: string, savedNoteText: string, myNoteText: string): PapelizVaultNoteMergeResult {
  const baseSplit = splitNoteTextLines(baseNoteText)
  const savedSplit = splitNoteTextLines(savedNoteText)
  const mySplit = splitNoteTextLines(myNoteText)
  const mergedLineEnding = pickChangedSide(baseSplit.noteLineEnding, savedSplit.noteLineEnding, mySplit.noteLineEnding)
  const hasMergedFinalNewline = pickChangedSide(baseSplit.hasFinalNewline, savedSplit.hasFinalNewline, mySplit.hasFinalNewline)
  const mergeChunks = mergeLines(baseSplit.noteLines, savedSplit.noteLines, mySplit.noteLines)
  if (mergeChunks.every((mergeChunk) => mergeChunk.mergeChunkKind === 'stable')) {
    return {
      mergeOutcome: 'clean',
      mergedVaultNoteText: joinNoteTextLines(
        mergeChunks.flatMap((mergeChunk) => (mergeChunk.mergeChunkKind === 'stable' ? mergeChunk.mergeChunkLines : [])),
        mergedLineEnding,
        hasMergedFinalNewline,
      ),
    }
  }
  let mergeConflictNumber = 0
  const mergeConflicts: PapelizVaultNoteMergeConflict[] = []
  for (const mergeChunk of mergeChunks) {
    if (mergeChunk.mergeChunkKind !== 'conflict') continue
    mergeConflictNumber += 1
    mergeConflicts.push({
      mergeConflictId: `conflict-${mergeConflictNumber}`,
      baseText: mergeChunk.baseLines.join('\n'),
      savedText: mergeChunk.theirLines.join('\n'),
      myText: mergeChunk.myLines.join('\n'),
    })
  }
  return { mergeOutcome: 'conflict', mergeConflicts, mergeChunks, mergedLineEnding, hasMergedFinalNewline }
}

// The note's text once each conflict is settled; one with no choice keeps both.
export function resolvePapelizVaultNoteMerge(
  mergeResult: PapelizVaultNoteMergeResult,
  mergeChoicesByConflictId: Readonly<Record<string, PapelizVaultNoteMergeChoice>> = {},
): string {
  if (mergeResult.mergeOutcome === 'clean') return mergeResult.mergedVaultNoteText
  const mergedLines: string[] = []
  let mergeConflictNumber = 0
  for (const mergeChunk of mergeResult.mergeChunks) {
    if (mergeChunk.mergeChunkKind === 'stable') {
      mergedLines.push(...mergeChunk.mergeChunkLines)
      continue
    }
    mergeConflictNumber += 1
    const mergeChoice = mergeChoicesByConflictId[`conflict-${mergeConflictNumber}`] ?? 'both'
    if (mergeChoice === 'saved') mergedLines.push(...mergeChunk.theirLines)
    else if (mergeChoice === 'mine') mergedLines.push(...mergeChunk.myLines)
    else mergedLines.push(...mergeChunk.theirLines, ...mergeChunk.myLines)
  }
  return joinNoteTextLines(mergedLines, mergeResult.mergedLineEnding, mergeResult.hasMergedFinalNewline)
}
