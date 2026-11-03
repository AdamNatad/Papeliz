// The AI Assistant's cards on its white page: a proposed change, a question, a plan. Flat, with a
// hairline frame and no shadow or grey footer band; the one waiting for you (a question to answer, a
// change or a plan step to review) gets a blue outline, so the eye finds it.

export const papelizAssistantPaperCardClassName = 'papeliz-pop-enter overflow-hidden rounded-[14px] border bg-papeliz-surface'

export function readPapelizAssistantPaperCardFrameClassName(isPaperCardWaitingForYou: boolean): string {
  return isPaperCardWaitingForYou ? 'border-papeliz-blue-line shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)]' : 'border-papeliz-line'
}

// The card's foot, under a hairline, on the card's own white.
export const papelizAssistantPaperCardFootClassName = 'border-t border-papeliz-line px-3.5 pt-2 pb-3'
