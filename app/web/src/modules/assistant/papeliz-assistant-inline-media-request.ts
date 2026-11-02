// The media action the next inline card opens with (Transcribe Here, Imagine Here from the note's
// right-click menu), handed from the editor to the card. Kept apart so neither imports the other.

export type PapelizInlineMediaAction = 'imagine' | 'transcribe' | 'describe-picture' | 'edit-picture'

let pendingPapelizInlineMediaAction: PapelizInlineMediaAction | null = null

export function requestPapelizInlineMediaActionForNextCard(inlineMediaAction: PapelizInlineMediaAction | null): void {
  pendingPapelizInlineMediaAction = inlineMediaAction
}

// Gives the pending action once, then forgets it.
export function takePapelizPendingInlineMediaAction(): PapelizInlineMediaAction | null {
  const inlineMediaAction = pendingPapelizInlineMediaAction
  pendingPapelizInlineMediaAction = null
  return inlineMediaAction
}
