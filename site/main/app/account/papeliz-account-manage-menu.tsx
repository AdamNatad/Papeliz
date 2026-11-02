'use client'

import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { papelizAccountRowActionWidthClassName, papelizAccountSecondaryButtonClassName } from './papeliz-account-card-frame'
import { useClosePapelizAccountMenuOutside } from './papeliz-account-launch-menu'

export type PapelizAccountManageMenuChoice = {
  manageMenuChoiceLabel: string
  ManageMenuChoiceIcon: LucideIcon
  manageMenuChoiceIsDanger?: boolean
  onManageMenuChoose: () => void
}

const papelizAccountManageMenuChoiceClassName =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] font-semibold transition-colors hover:bg-papeliz-surface-soft focus-visible:bg-papeliz-surface-soft'

// One action in a row's actions dialog on a phone, where a tap on the row opens that row's choices.
export const papelizAccountRowActionsDialogButtonClassName =
  'flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-[10px] border border-papeliz-line bg-papeliz-surface px-3.5 text-left text-[14.5px] font-semibold transition-colors hover:bg-papeliz-surface-soft active:bg-papeliz-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue'

// A row's actions on a computer: one Manage button whose menu holds the row's choices, a removal last
// and in red, the same for vaults and devices. It opens with the first choice focused; Up, Down, Home
// and End move between them; Tab, Escape and a press outside close it. A choice puts focus back on
// Manage before it acts, so a dialog it opens returns focus there.
export function PapelizAccountManageMenu({ manageMenuLabel, manageMenuChoices }: { manageMenuLabel: string; manageMenuChoices: readonly PapelizAccountManageMenuChoice[] }) {
  const [manageMenuIsOpen, setManageMenuIsOpen] = useState(false)
  const closeManageMenu = useCallback(() => setManageMenuIsOpen(false), [])
  const { papelizAccountMenuRootRef, papelizAccountMenuButtonRef } = useClosePapelizAccountMenuOutside(manageMenuIsOpen, closeManageMenu)
  const manageMenuRef = useRef<HTMLDivElement>(null)
  const manageMenuId = useId()

  useEffect(() => {
    if (manageMenuIsOpen) manageMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [manageMenuIsOpen])

  function moveWithinManageMenu(manageMenuKeyEvent: KeyboardEvent<HTMLDivElement>) {
    if (manageMenuKeyEvent.key === 'Tab') {
      closeManageMenu()
      return
    }
    const manageMenuItems = [...(manageMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const focusedManageMenuItemIndex = manageMenuItems.indexOf(document.activeElement as HTMLElement)
    const lastManageMenuItemIndex = manageMenuItems.length - 1
    const nextManageMenuItemIndex = {
      ArrowDown: focusedManageMenuItemIndex >= lastManageMenuItemIndex ? 0 : focusedManageMenuItemIndex + 1,
      ArrowUp: focusedManageMenuItemIndex <= 0 ? lastManageMenuItemIndex : focusedManageMenuItemIndex - 1,
      Home: 0,
      End: lastManageMenuItemIndex,
    }[manageMenuKeyEvent.key]
    if (nextManageMenuItemIndex === undefined) return
    manageMenuKeyEvent.preventDefault()
    manageMenuItems[nextManageMenuItemIndex]?.focus()
  }

  return (
    <div ref={papelizAccountMenuRootRef} className="relative">
      <button
        ref={papelizAccountMenuButtonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={manageMenuIsOpen}
        aria-controls={manageMenuIsOpen ? manageMenuId : undefined}
        aria-label={manageMenuLabel}
        onClick={() => setManageMenuIsOpen((manageMenuWasOpen) => !manageMenuWasOpen)}
        className={`${papelizAccountSecondaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
      >
        Manage
        <ChevronDown className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${manageMenuIsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {manageMenuIsOpen && (
        <div
          ref={manageMenuRef}
          id={manageMenuId}
          role="menu"
          aria-label={manageMenuLabel}
          onKeyDown={moveWithinManageMenu}
          className="papeliz-pop-enter absolute top-[calc(100%+6px)] right-0 z-30 grid w-[220px] rounded-xl border border-papeliz-line bg-papeliz-surface p-1.5 text-papeliz-ink shadow-papeliz-pop"
        >
          {manageMenuChoices.map(({ manageMenuChoiceLabel, ManageMenuChoiceIcon, manageMenuChoiceIsDanger = false, onManageMenuChoose }) => (
            <button
              key={manageMenuChoiceLabel}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                papelizAccountMenuButtonRef.current?.focus()
                closeManageMenu()
                onManageMenuChoose()
              }}
              className={`${papelizAccountManageMenuChoiceClassName} ${manageMenuChoiceIsDanger ? 'text-papeliz-diff-removed-ink' : ''}`}
            >
              <ManageMenuChoiceIcon className={`size-[17px] shrink-0 ${manageMenuChoiceIsDanger ? '' : 'text-papeliz-ink-muted'}`} aria-hidden="true" />
              {manageMenuChoiceLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
