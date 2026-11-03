import { useLayoutEffect, type RefObject } from 'react'

// What the chat box's row gives up, in this order, when its buttons don't fit its width. It works as
// the top bar does (papeliz-workspace-topbar.tsx): it takes the fewest steps that make the row fit,
// measuring after each, and measures again whenever the row or one of its buttons changes width.
//  1. Effort shows its icon alone.
//  2. What the assistant sees shows its icon alone, and so do Review in Write and Focus mode's mode
//     chip. Bypass keeps its word, because it warns.
//  3. While the assistant answers, Queue and Steer show their icons alone.
//  4. The ring's percent goes.
//  5. The chips' chevrons go. They are still menus, and say so to a screen reader.
//  6. The model chip shows its short name (`spark-1.3`), with a C tag for a Contributor id
//     (papeliz-assistant-model-short-names.ts).
//  7. The gaps tighten.
//  8. Effort folds into the model chip's menu, as an Effort group under the models.
//  9. The mic and Send shrink to 28px, the size of +; on a touch screen they narrow to 36px.
// 10. While the assistant answers with a message typed, the model chip steps aside for Queue, Steer and
//     Stop, and comes back when the answer ends.
// 11. Last, a long name is cut after a whole hyphen part (`my-local…`), one part at a time.
// Each step is a data attribute on the row, which its buttons' classes read. A step with nothing to
// give up in the row as it is (no Effort chip, say) is passed over. Every hidden word stays in its
// button's tooltip and accessible name; the ring, the mic and Send never go.

export const papelizComposerRowGroupClassName = 'group/papeliz-composer-row'

export const papelizComposerRowGiveWaySteps: ReadonlyArray<{ composerRowGiveWayAttributeName: string; composerRowGiveWayHiddenSelector: string | null }> = [
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-effort-icon', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-give-way-label="effort"]' },
  {
    composerRowGiveWayAttributeName: 'data-papeliz-composer-sees-icon',
    composerRowGiveWayHiddenSelector: '[data-papeliz-composer-give-way-label="sees"], [data-papeliz-composer-give-way-label="review"], [data-papeliz-composer-give-way-label="mode"]',
  },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-steer-icons', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-give-way-label="steer"]' },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-ring-percent-hidden', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-give-way-ring-percent]' },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-chevrons-hidden', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-give-way-chevron]' },
  {
    composerRowGiveWayAttributeName: 'data-papeliz-composer-model-short-name',
    composerRowGiveWayHiddenSelector: '[data-papeliz-composer-model-full-name]:not([data-papeliz-composer-model-name-same-as-short])',
  },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-gaps-tight', composerRowGiveWayHiddenSelector: null },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-effort-folded', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-effort-chip]' },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-round-buttons-small', composerRowGiveWayHiddenSelector: null },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-model-chip-aside', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-model-chip-steps-aside]' },
  { composerRowGiveWayAttributeName: 'data-papeliz-composer-model-name-cut', composerRowGiveWayHiddenSelector: '[data-papeliz-composer-model-name-cut]' },
]

export const papelizComposerEffortFoldedAttributeName = 'data-papeliz-composer-effort-folded'

// The classes that read the steps, for the row's buttons.
export const papelizComposerRowGiveWayClassNames = {
  effortChipLabel: 'group-data-[papeliz-composer-effort-icon]/papeliz-composer-row:hidden',
  contextChoiceLabel: 'group-data-[papeliz-composer-sees-icon]/papeliz-composer-row:hidden',
  queueAndSteerLabel: 'group-data-[papeliz-composer-steer-icons]/papeliz-composer-row:hidden',
  queueAndSteerPill: 'group-data-[papeliz-composer-steer-icons]/papeliz-composer-row:px-2',
  contextRingPercent: 'group-data-[papeliz-composer-ring-percent-hidden]/papeliz-composer-row:hidden',
  chipChevron: 'group-data-[papeliz-composer-chevrons-hidden]/papeliz-composer-row:hidden',
  modelChipFullName: 'group-data-[papeliz-composer-model-short-name]/papeliz-composer-row:hidden group-data-[papeliz-composer-model-name-cut]/papeliz-composer-row:hidden',
  modelChipShortName: 'hidden group-data-[papeliz-composer-model-short-name]/papeliz-composer-row:inline group-data-[papeliz-composer-model-name-cut]/papeliz-composer-row:hidden',
  modelChipContributorTag: 'hidden group-data-[papeliz-composer-model-short-name]/papeliz-composer-row:inline-block',
  modelChipNameCut: 'hidden group-data-[papeliz-composer-model-name-cut]/papeliz-composer-row:inline',
  modelChipSteppingAside: 'group-data-[papeliz-composer-model-chip-aside]/papeliz-composer-row:hidden',
  quietButtonTight: 'group-data-[papeliz-composer-gaps-tight]/papeliz-composer-row:px-1',
  contextRingTight:
    'group-data-[papeliz-composer-gaps-tight]/papeliz-composer-row:px-1 group-data-[papeliz-composer-round-buttons-small]/papeliz-composer-row:min-w-[26px] pointer-coarse:group-data-[papeliz-composer-round-buttons-small]/papeliz-composer-row:min-w-9',
  effortChip: 'group-data-[papeliz-composer-effort-folded]/papeliz-composer-row:hidden',
  sendButtonGap: 'group-data-[papeliz-composer-gaps-tight]/papeliz-composer-row:ml-0.5',
  roundButtonSmall:
    'group-data-[papeliz-composer-round-buttons-small]/papeliz-composer-row:size-7 pointer-coarse:group-data-[papeliz-composer-round-buttons-small]/papeliz-composer-row:h-10 pointer-coarse:group-data-[papeliz-composer-round-buttons-small]/papeliz-composer-row:w-9',
} as const

// The cut name's element is left empty by React and filled here, one cut at a time, from the list of
// cuts it carries.
const papelizComposerModelNameCutSelector = '[data-papeliz-composer-model-name-cut]'

function doesPapelizComposerRowFit(composerRowElement: HTMLElement): boolean {
  return composerRowElement.scrollWidth <= composerRowElement.clientWidth + 0.5
}

export function fitPapelizComposerRowToItsRoom(composerRowElement: HTMLElement): void {
  for (const { composerRowGiveWayAttributeName } of papelizComposerRowGiveWaySteps) composerRowElement.removeAttribute(composerRowGiveWayAttributeName)
  const modelNameCutElement = composerRowElement.querySelector<HTMLElement>(papelizComposerModelNameCutSelector)
  const modelNameCuts: string[] = modelNameCutElement === null ? [] : JSON.parse(modelNameCutElement.dataset.papelizComposerModelNameCuts ?? '[]')
  if (modelNameCutElement !== null) modelNameCutElement.textContent = modelNameCuts[0] ?? ''
  for (const { composerRowGiveWayAttributeName, composerRowGiveWayHiddenSelector } of papelizComposerRowGiveWaySteps) {
    if (doesPapelizComposerRowFit(composerRowElement)) return
    if (composerRowGiveWayHiddenSelector !== null && composerRowElement.querySelector(composerRowGiveWayHiddenSelector) === null) continue
    composerRowElement.setAttribute(composerRowGiveWayAttributeName, '')
  }
  // The cut name loses one more whole hyphen part at a time until the row fits.
  if (modelNameCutElement === null || !composerRowElement.hasAttribute('data-papeliz-composer-model-name-cut')) return
  for (let modelNameCutIndex = 1; modelNameCutIndex < modelNameCuts.length && !doesPapelizComposerRowFit(composerRowElement); modelNameCutIndex++) {
    modelNameCutElement.textContent = modelNameCuts[modelNameCutIndex] ?? ''
  }
}

// Fits the row before it is painted after each render of the box, again whenever the row or one of its
// buttons changes width (a chip's words change while the box itself doesn't render), and once the fonts
// have loaded. A refit waits for the next frame, so it never changes the layout inside the resize
// observer's own call, and several in one frame make one.
export function usePapelizComposerRowFit(composerRowRef: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const composerRowElement = composerRowRef.current
    if (composerRowElement === null) return
    fitPapelizComposerRowToItsRoom(composerRowElement)
    let composerRowRefitFrame = 0
    const refitComposerRowInNextFrame = () => {
      cancelAnimationFrame(composerRowRefitFrame)
      composerRowRefitFrame = requestAnimationFrame(() => fitPapelizComposerRowToItsRoom(composerRowElement))
    }
    const composerRowResizeObserver = new ResizeObserver(refitComposerRowInNextFrame)
    composerRowResizeObserver.observe(composerRowElement)
    for (const composerRowChildElement of composerRowElement.children) composerRowResizeObserver.observe(composerRowChildElement)
    let isComposerRowGone = false
    void document.fonts?.ready.then(() => {
      if (!isComposerRowGone) fitPapelizComposerRowToItsRoom(composerRowElement)
    })
    return () => {
      isComposerRowGone = true
      cancelAnimationFrame(composerRowRefitFrame)
      composerRowResizeObserver.disconnect()
    }
  })
}
