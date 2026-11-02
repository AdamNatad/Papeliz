import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

export interface PapelizListboxSelectOption {
  listboxOptionValue: string
  listboxOptionLabel: string
  // Muted words after the label, such as "saved".
  listboxOptionNote?: string
}

interface PapelizListboxSelectProps {
  // The trigger's id, for the field's `<label htmlFor>`.
  listboxSelectTriggerId: string
  // The id of that label. It names the trigger and the list.
  listboxSelectLabelId: string
  listboxSelectOptions: readonly PapelizListboxSelectOption[]
  chosenListboxOptionValue: string
  // Shown on the trigger while no option is chosen.
  listboxSelectPlaceholder?: string
  isListboxSelectDisabled?: boolean
  // Classes for the outer box, such as its margin or its flex size.
  className?: string
  // Regular: a full-width field. Compact: a small pill as wide as its words, beside a heading, whose
  // list opens wider than it, at its right edge; the trigger shows the label without its note.
  listboxSelectSize?: 'regular' | 'compact'
  onListboxOptionChoose: (listboxOptionValue: string) => void
}

// The compact select's list, wide enough for a label and its note.
const papelizCompactListboxSelectListboxWidth = 236

interface PapelizListboxSelectPlacement {
  isListboxShownAboveTrigger: boolean
  listboxMaxHeight: number
}

// Row height (h-9) and the list's padding plus border (p-1, 1px), so the list's height is known
// before it opens.
const papelizListboxSelectOptionRowHeight = 36
const papelizListboxSelectListboxFrameHeight = 10
const papelizListboxSelectListboxMaxHeight = 280
// The gap between trigger and list (mt-1.5), and the room kept free at the edge of the dialog.
const papelizListboxSelectListboxGap = 6
const papelizListboxSelectEdgeMargin = 8
// Letters typed within this many milliseconds search together.
const papelizListboxSelectTypeAheadPause = 600

// The strip of the screen the list can draw in: the window, cut down by every scrolling box around
// the select, up to its dialog (a modal dialog draws over the rest of the page).
function measurePapelizListboxSelectRoom(listboxSelectTriggerElement: HTMLElement): { listboxRoomTop: number; listboxRoomBottom: number } {
  let listboxRoomTop = 0
  let listboxRoomBottom = window.innerHeight
  for (
    let ancestorElement = listboxSelectTriggerElement.parentElement;
    ancestorElement !== null && ancestorElement !== document.body;
    ancestorElement = ancestorElement.parentElement
  ) {
    if (getComputedStyle(ancestorElement).overflowY !== 'visible') {
      const ancestorRect = ancestorElement.getBoundingClientRect()
      listboxRoomTop = Math.max(listboxRoomTop, ancestorRect.top)
      listboxRoomBottom = Math.min(listboxRoomBottom, ancestorRect.bottom)
    }
    if (ancestorElement instanceof HTMLDialogElement) break
  }
  return { listboxRoomTop, listboxRoomBottom }
}

// A select in the Papeliz look: a pill that opens a rounded list. The list is drawn inside the
// select's own box (not portaled), so it works inside a modal dialog. It opens below the trigger,
// or above it when there is more room there. Arrow keys, Home, End, typed letters, Enter or Space
// to choose, Esc to close; focus returns to the trigger.
export function PapelizListboxSelect({
  listboxSelectTriggerId,
  listboxSelectLabelId,
  listboxSelectOptions,
  chosenListboxOptionValue,
  listboxSelectPlaceholder = '',
  isListboxSelectDisabled = false,
  className,
  listboxSelectSize = 'regular',
  onListboxOptionChoose,
}: PapelizListboxSelectProps) {
  const isListboxSelectCompact = listboxSelectSize === 'compact'
  const listboxSelectRef = useRef<HTMLDivElement>(null)
  const listboxSelectTriggerRef = useRef<HTMLButtonElement>(null)
  const listboxElementRef = useRef<HTMLDivElement>(null)
  const listboxElementId = useId()
  const listboxTypeAheadTextRef = useRef('')
  const listboxTypeAheadTypedAtRef = useRef(Number.NEGATIVE_INFINITY)
  // Null while the list is closed.
  const [openListboxPlacement, setOpenListboxPlacement] = useState<PapelizListboxSelectPlacement | null>(null)
  const [highlightedListboxOptionIndex, setHighlightedListboxOptionIndex] = useState(0)

  const isListboxOpen = openListboxPlacement !== null && !isListboxSelectDisabled && listboxSelectOptions.length > 0
  const chosenListboxOptionIndex = listboxSelectOptions.findIndex((listboxSelectOption) => listboxSelectOption.listboxOptionValue === chosenListboxOptionValue)
  const chosenListboxOption = listboxSelectOptions[chosenListboxOptionIndex]
  const shownHighlightedListboxOptionIndex = Math.min(highlightedListboxOptionIndex, listboxSelectOptions.length - 1)

  const openListbox = () => {
    const listboxSelectTriggerElement = listboxSelectTriggerRef.current
    if (listboxSelectTriggerElement === null || isListboxSelectDisabled || listboxSelectOptions.length === 0) return
    const listboxSelectTriggerRect = listboxSelectTriggerElement.getBoundingClientRect()
    const { listboxRoomTop, listboxRoomBottom } = measurePapelizListboxSelectRoom(listboxSelectTriggerElement)
    const listboxRoomBelow = listboxRoomBottom - listboxSelectTriggerRect.bottom - papelizListboxSelectListboxGap - papelizListboxSelectEdgeMargin
    const listboxRoomAbove = listboxSelectTriggerRect.top - listboxRoomTop - papelizListboxSelectListboxGap - papelizListboxSelectEdgeMargin
    const listboxFullHeight = Math.min(
      papelizListboxSelectListboxMaxHeight,
      listboxSelectOptions.length * papelizListboxSelectOptionRowHeight + papelizListboxSelectListboxFrameHeight,
    )
    const isListboxShownAboveTrigger = listboxRoomBelow < listboxFullHeight && listboxRoomAbove > listboxRoomBelow
    setOpenListboxPlacement({
      isListboxShownAboveTrigger,
      // Never shorter than two rows, even in a very short window.
      listboxMaxHeight: Math.max(
        2 * papelizListboxSelectOptionRowHeight + papelizListboxSelectListboxFrameHeight,
        Math.min(papelizListboxSelectListboxMaxHeight, isListboxShownAboveTrigger ? listboxRoomAbove : listboxRoomBelow),
      ),
    })
    setHighlightedListboxOptionIndex(Math.max(0, chosenListboxOptionIndex))
    listboxTypeAheadTextRef.current = ''
  }

  const closeListbox = (shouldFocusTrigger: boolean) => {
    setOpenListboxPlacement(null)
    if (shouldFocusTrigger) listboxSelectTriggerRef.current?.focus()
  }

  const chooseListboxOption = (listboxOptionIndex: number) => {
    const chosenOption = listboxSelectOptions[listboxOptionIndex]
    closeListbox(true)
    // Like a native select: choosing the option already chosen changes nothing.
    if (chosenOption !== undefined && chosenOption.listboxOptionValue !== chosenListboxOptionValue) onListboxOptionChoose(chosenOption.listboxOptionValue)
  }

  // The next option whose label starts with the letters typed so far. Pressing one letter again
  // and again steps through the options that start with it.
  const findTypeAheadListboxOptionIndex = (typedListboxKey: string, typedAt: number): number | null => {
    const typeAheadText = (typedAt - listboxTypeAheadTypedAtRef.current > papelizListboxSelectTypeAheadPause ? '' : listboxTypeAheadTextRef.current) + typedListboxKey.toLowerCase()
    listboxTypeAheadTextRef.current = typeAheadText
    listboxTypeAheadTypedAtRef.current = typedAt
    const isOneLetterRepeated = [...typeAheadText].every((typedLetter) => typedLetter === typeAheadText[0])
    const searchedText = isOneLetterRepeated ? typeAheadText.slice(0, 1) : typeAheadText
    const searchStartIndex = isOneLetterRepeated ? shownHighlightedListboxOptionIndex + 1 : shownHighlightedListboxOptionIndex
    for (let searchOffset = 0; searchOffset < listboxSelectOptions.length; searchOffset += 1) {
      const searchedOptionIndex = (searchStartIndex + searchOffset) % listboxSelectOptions.length
      if (listboxSelectOptions[searchedOptionIndex]?.listboxOptionLabel.toLowerCase().startsWith(searchedText)) return searchedOptionIndex
    }
    return null
  }

  const handleListboxKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const lastListboxOptionIndex = listboxSelectOptions.length - 1
    let nextListboxOptionIndex: number | null = null
    if (keyboardEvent.key === 'ArrowDown') nextListboxOptionIndex = Math.min(lastListboxOptionIndex, shownHighlightedListboxOptionIndex + 1)
    else if (keyboardEvent.key === 'ArrowUp') nextListboxOptionIndex = Math.max(0, shownHighlightedListboxOptionIndex - 1)
    else if (keyboardEvent.key === 'Home') nextListboxOptionIndex = 0
    else if (keyboardEvent.key === 'End') nextListboxOptionIndex = lastListboxOptionIndex
    else if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault()
      chooseListboxOption(shownHighlightedListboxOptionIndex)
      return
    } else if (keyboardEvent.key === 'Escape') {
      // Canceling the key also keeps a surrounding modal dialog open: Esc closes only the list.
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      closeListbox(true)
      return
    } else if (keyboardEvent.key === 'Tab') {
      // Back on the trigger, the Tab itself then moves on to the next field.
      closeListbox(true)
      return
    } else if (keyboardEvent.key.length === 1 && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey && !keyboardEvent.altKey) {
      nextListboxOptionIndex = findTypeAheadListboxOptionIndex(keyboardEvent.key, keyboardEvent.timeStamp)
    }
    if (nextListboxOptionIndex !== null) {
      keyboardEvent.preventDefault()
      setHighlightedListboxOptionIndex(nextListboxOptionIndex)
    }
  }

  // Focus moves into the list while it is open.
  useEffect(() => {
    if (isListboxOpen) listboxElementRef.current?.focus({ preventScroll: true })
  }, [isListboxOpen])

  // A press anywhere outside the select or its label closes the list.
  useEffect(() => {
    if (!isListboxOpen) return
    const closeListboxOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pressedNode = pointerEvent.target instanceof Node ? pointerEvent.target : null
      const isPressInsideListboxSelect = listboxSelectRef.current?.contains(pressedNode) === true
      const isPressOnListboxSelectLabel = document.getElementById(listboxSelectLabelId)?.contains(pressedNode) === true
      if (!isPressInsideListboxSelect && !isPressOnListboxSelectLabel) setOpenListboxPlacement(null)
    }
    document.addEventListener('pointerdown', closeListboxOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeListboxOnOutsidePointer, true)
  }, [isListboxOpen, listboxSelectLabelId])

  // Keep the highlighted row in view inside the list, without scrolling the dialog around it.
  useLayoutEffect(() => {
    const listboxElement = listboxElementRef.current
    if (!isListboxOpen || listboxElement === null) return
    const highlightedListboxOptionElement = listboxElement.children[shownHighlightedListboxOptionIndex]
    if (!(highlightedListboxOptionElement instanceof HTMLElement)) return
    const listboxPaddingTop = 4
    if (highlightedListboxOptionElement.offsetTop - listboxPaddingTop < listboxElement.scrollTop) {
      listboxElement.scrollTop = highlightedListboxOptionElement.offsetTop - listboxPaddingTop
    } else if (highlightedListboxOptionElement.offsetTop + highlightedListboxOptionElement.offsetHeight + listboxPaddingTop > listboxElement.scrollTop + listboxElement.clientHeight) {
      listboxElement.scrollTop = highlightedListboxOptionElement.offsetTop + highlightedListboxOptionElement.offsetHeight + listboxPaddingTop - listboxElement.clientHeight
    }
  }, [isListboxOpen, shownHighlightedListboxOptionIndex])

  return (
    <div ref={listboxSelectRef} className={joinPapelizClassNames('relative', className)}>
      <button
        ref={listboxSelectTriggerRef}
        id={listboxSelectTriggerId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isListboxOpen}
        aria-controls={isListboxOpen ? listboxElementId : undefined}
        // The field's label, then the chosen option.
        aria-labelledby={`${listboxSelectLabelId} ${listboxSelectTriggerId}`}
        disabled={isListboxSelectDisabled}
        onClick={() => (isListboxOpen ? closeListbox(false) : openListbox())}
        onKeyDown={(keyboardEvent) => {
          if (!isListboxOpen && (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'ArrowUp')) {
            keyboardEvent.preventDefault()
            openListbox()
          } else if (isListboxOpen && keyboardEvent.key === 'Escape') {
            keyboardEvent.preventDefault()
            keyboardEvent.stopPropagation()
            closeListbox(true)
          }
        }}
        className={joinPapelizClassNames(
          'flex items-center rounded-full border border-papeliz-line-strong bg-papeliz-surface text-left text-papeliz-ink transition-colors disabled:text-papeliz-ink-subtle',
          isListboxSelectCompact ? 'h-7 gap-1 pr-1.5 pl-2.5 text-[12.5px] font-medium hover:bg-papeliz-hover pointer-coarse:h-9' : 'h-10 w-full gap-2 pr-3 pl-4 text-sm',
        )}
      >
        <span className={joinPapelizClassNames('min-w-0 flex-1 truncate', chosenListboxOption === undefined && 'text-papeliz-ink-subtle')}>
          {chosenListboxOption?.listboxOptionLabel ?? listboxSelectPlaceholder}
        </span>
        {!isListboxSelectCompact && chosenListboxOption?.listboxOptionNote !== undefined && (
          <span className="flex-none text-[12px] text-papeliz-ink-subtle">{chosenListboxOption.listboxOptionNote}</span>
        )}
        <ChevronDown
          className={joinPapelizClassNames('size-4 flex-none text-papeliz-ink-muted transition-transform duration-150', isListboxOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {isListboxOpen && (
        <div
          ref={listboxElementRef}
          id={listboxElementId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={listboxSelectLabelId}
          aria-activedescendant={`${listboxElementId}-option-${shownHighlightedListboxOptionIndex}`}
          onKeyDown={handleListboxKeyDown}
          onBlur={(focusEvent) => {
            // Focus went to another field. (No target means the window lost focus; the list stays.)
            if (focusEvent.relatedTarget instanceof Node && listboxSelectRef.current?.contains(focusEvent.relatedTarget) !== true) setOpenListboxPlacement(null)
          }}
          className={joinPapelizClassNames(
            'papeliz-pop-enter absolute z-20 overflow-y-auto overscroll-contain rounded-2xl border border-papeliz-line bg-papeliz-surface p-1 shadow-papeliz-pop select-none focus-visible:outline-none [scrollbar-width:thin]',
            isListboxSelectCompact ? 'right-0' : 'inset-x-0',
            openListboxPlacement.isListboxShownAboveTrigger ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
          style={{ maxHeight: openListboxPlacement.listboxMaxHeight, width: isListboxSelectCompact ? papelizCompactListboxSelectListboxWidth : undefined }}
        >
          {listboxSelectOptions.map((listboxSelectOption, listboxOptionIndex) => {
            const isChosenListboxOption = listboxOptionIndex === chosenListboxOptionIndex
            return (
              <div
                key={listboxSelectOption.listboxOptionValue}
                id={`${listboxElementId}-option-${listboxOptionIndex}`}
                role="option"
                aria-selected={isChosenListboxOption}
                onPointerMove={() => {
                  if (listboxOptionIndex !== shownHighlightedListboxOptionIndex) setHighlightedListboxOptionIndex(listboxOptionIndex)
                }}
                onClick={() => chooseListboxOption(listboxOptionIndex)}
                className={joinPapelizClassNames(
                  'flex h-9 cursor-pointer items-center gap-2.5 rounded-full px-3 text-papeliz-ink hover:bg-papeliz-hover',
                  isListboxSelectCompact ? 'text-[13px]' : 'text-sm',
                  listboxOptionIndex === shownHighlightedListboxOptionIndex && 'bg-papeliz-hover',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{listboxSelectOption.listboxOptionLabel}</span>
                {listboxSelectOption.listboxOptionNote !== undefined && (
                  <span className="flex-none text-[12px] text-papeliz-ink-subtle">{listboxSelectOption.listboxOptionNote}</span>
                )}
                <Check className={joinPapelizClassNames('size-4 flex-none text-papeliz-blue', !isChosenListboxOption && 'invisible')} aria-hidden="true" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
