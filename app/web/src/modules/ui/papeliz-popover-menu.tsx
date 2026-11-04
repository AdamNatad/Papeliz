import { Check, type LucideIcon } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from './papeliz-class-names'
import { givePapelizFocusBackWithTitleHeldBack } from './papeliz-focus-back-with-title-held-back'
import { subscribeToPapelizWindowWidthChange } from './papeliz-window-width-change'

export interface PapelizPopoverMenuItem {
  menuItemKey: string
  menuItemLabel: string
  MenuItemIcon?: LucideIcon
  isDangerousMenuItem?: boolean
  // Shown greyed out; the arrow keys pass over it and a click does nothing.
  isMenuItemDisabled?: boolean
  // Set for a choice among several (a radio item); true marks the current one.
  isMenuItemChecked?: boolean
  // Starts a new group under this heading, with a line above it unless it opens the menu.
  menuItemGroupHeading?: string
  // A quieter second line under the label ("muse-voice-transcribe-1.0 now", "Typed").
  menuItemDetailText?: string
  // A count or short value at the row's right end ("148").
  menuItemTrailingText?: string
  onMenuItemSelect: () => void
}

export interface PapelizPopoverMenuPosition {
  menuAnchorLeft: number
  menuAnchorTop: number
}

interface PapelizPopoverMenuProps {
  menuLabel: string
  menuPosition: PapelizPopoverMenuPosition
  menuItems: readonly PapelizPopoverMenuItem[]
  onMenuClose: () => void
}

const papelizPopoverMenuViewportMargin = 8
// A right-click this recent opened the menu that is opening now.
const papelizRightClickMenuOpeningMilliseconds = 1000
const papelizFocusableElementSelector = 'button, a[href], input, select, textarea, [tabindex]'

// A right-click doesn't move focus, so the item right-clicked is noted here: a menu it opens gives
// focus back to it, and so does a dialog opened from that menu (papeliz-confirm-dialog.tsx takes
// focus from whatever had it as it opens).
let lastRightClickedElement: Element | null = null
let lastRightClickedAt = 0
if (typeof document !== 'undefined') {
  document.addEventListener(
    'contextmenu',
    (contextMenuEvent) => {
      lastRightClickedElement = contextMenuEvent.target instanceof Element ? contextMenuEvent.target : null
      lastRightClickedAt = performance.now()
    },
    true,
  )
}

// What the menu gives focus back to when it closes: what had focus, else the item just right-clicked.
function findPapelizPopoverMenuReturnFocusElement(): HTMLElement | null {
  const focusedElement = document.activeElement
  if (focusedElement instanceof HTMLElement && focusedElement !== document.body) return focusedElement
  if (performance.now() - lastRightClickedAt > papelizRightClickMenuOpeningMilliseconds) return null
  const rightClickedFocusableElement = lastRightClickedElement?.closest(papelizFocusableElementSelector)
  return rightClickedFocusableElement instanceof HTMLElement ? rightClickedFocusableElement : null
}

// The items focus moves between, in order: every item but a turned-off one.
export function listPapelizPopoverMenuFocusableItemIndexes(menuItems: readonly PapelizPopoverMenuItem[]): number[] {
  return menuItems.flatMap((menuItem, menuItemIndex) => (menuItem.isMenuItemDisabled === true ? [] : [menuItemIndex]))
}

const papelizPopoverMenuFocusKeys = ['ArrowDown', 'ArrowUp', 'Home', 'End']

// The item ArrowDown, ArrowUp, Home or End moves focus to from the focused one (-1 when focus is on
// none of them), or null for any other key. The arrows wrap around.
export function findPapelizPopoverMenuItemIndexAfterKey(
  menuItems: readonly PapelizPopoverMenuItem[],
  focusedMenuItemIndex: number,
  pressedKey: string,
): number | null {
  if (!papelizPopoverMenuFocusKeys.includes(pressedKey)) return null
  const focusableMenuItemIndexes = listPapelizPopoverMenuFocusableItemIndexes(menuItems)
  const focusableMenuItemCount = focusableMenuItemIndexes.length
  const focusedFocusablePosition = focusableMenuItemIndexes.indexOf(focusedMenuItemIndex)
  const nextFocusablePosition =
    pressedKey === 'ArrowDown'
      ? (focusedFocusablePosition + 1) % focusableMenuItemCount
      : pressedKey === 'ArrowUp'
        ? (focusedFocusablePosition - 1 + focusableMenuItemCount) % focusableMenuItemCount
        : pressedKey === 'Home'
          ? 0
          : focusableMenuItemCount - 1
  return focusableMenuItemIndexes[nextFocusablePosition] ?? null
}

// A press on an item: a turned-off one does nothing; any other closes the menu, then runs the item.
export function pressPapelizPopoverMenuItem(menuItem: PapelizPopoverMenuItem, closePopoverMenu: () => void) {
  if (menuItem.isMenuItemDisabled === true) return
  closePopoverMenu()
  menuItem.onMenuItemSelect()
}

interface PapelizPopoverMenuItemButtonProps {
  menuItem: PapelizPopoverMenuItem
  setMenuItemButtonElement: (menuItemButton: HTMLButtonElement | null) => void
  onMenuItemButtonClick: () => void
}

export function PapelizPopoverMenuItemButton({ menuItem, setMenuItemButtonElement, onMenuItemButtonClick }: PapelizPopoverMenuItemButtonProps) {
  return (
    <button
      ref={setMenuItemButtonElement}
      type="button"
      role={menuItem.isMenuItemChecked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={menuItem.isMenuItemChecked}
      aria-disabled={menuItem.isMenuItemDisabled === true ? true : undefined}
      tabIndex={-1}
      onClick={onMenuItemButtonClick}
      className={joinPapelizClassNames(
        'flex w-full items-center gap-2.5 px-3 text-left text-sm font-medium text-papeliz-ink hover:bg-papeliz-hover focus-visible:bg-papeliz-hover focus-visible:outline-none',
        menuItem.menuItemDetailText === undefined ? 'h-9 rounded-full' : 'min-h-11 rounded-2xl py-1',
        menuItem.isDangerousMenuItem && 'text-papeliz-diff-removed-ink',
        menuItem.isMenuItemDisabled === true && 'cursor-default text-papeliz-ink-subtle opacity-60 hover:bg-transparent',
      )}
    >
      {menuItem.MenuItemIcon !== undefined && <menuItem.MenuItemIcon className="size-4 flex-none opacity-80" aria-hidden="true" />}
      {menuItem.menuItemDetailText === undefined ? (
        menuItem.menuItemLabel
      ) : (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate">{menuItem.menuItemLabel}</span>
          <span className="truncate text-[11.5px] font-normal text-papeliz-ink-subtle">{menuItem.menuItemDetailText}</span>
        </span>
      )}
      {menuItem.menuItemTrailingText !== undefined && (
        <span className="ml-auto flex-none pl-3 text-[12px] font-normal text-papeliz-ink-subtle tabular-nums">{menuItem.menuItemTrailingText}</span>
      )}
      {menuItem.isMenuItemChecked === true && (
        <Check className={joinPapelizClassNames('size-4 flex-none text-papeliz-blue', menuItem.menuItemTrailingText === undefined && 'ml-auto')} aria-hidden="true" />
      )}
    </button>
  )
}

// A small menu that opens at a point (a button's corner or the mouse), with arrow keys, Home, End,
// Enter and Esc. Focus returns to whatever had it when the menu opened, or to the item right-clicked.
export function PapelizPopoverMenu({ menuLabel, menuPosition, menuItems, onMenuClose }: PapelizPopoverMenuProps) {
  const popoverMenuRef = useRef<HTMLDivElement>(null)
  const menuItemButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [clampedMenuPosition, setClampedMenuPosition] = useState(menuPosition)
  // Read once, before the menu takes focus: an effect that runs again (React's development checks
  // run each twice) would find the menu's own first item instead.
  const [focusedBeforeMenu] = useState(findPapelizPopoverMenuReturnFocusElement)
  const onMenuCloseRef = useRef(onMenuClose)
  const menuItemsRef = useRef(menuItems)

  useEffect(() => {
    onMenuCloseRef.current = onMenuClose
    menuItemsRef.current = menuItems
  })

  useLayoutEffect(() => {
    const popoverMenuElement = popoverMenuRef.current
    if (popoverMenuElement === null) return
    const popoverMenuRect = popoverMenuElement.getBoundingClientRect()
    setClampedMenuPosition({
      menuAnchorLeft: Math.max(
        papelizPopoverMenuViewportMargin,
        Math.min(menuPosition.menuAnchorLeft, window.innerWidth - popoverMenuRect.width - papelizPopoverMenuViewportMargin),
      ),
      menuAnchorTop: Math.max(
        papelizPopoverMenuViewportMargin,
        Math.min(menuPosition.menuAnchorTop, window.innerHeight - popoverMenuRect.height - papelizPopoverMenuViewportMargin),
      ),
    })
  }, [menuPosition])

  useEffect(() => {
    const firstFocusableMenuItemIndex = listPapelizPopoverMenuFocusableItemIndexes(menuItemsRef.current)[0]
    if (firstFocusableMenuItemIndex !== undefined) menuItemButtonRefs.current[firstFocusableMenuItemIndex]?.focus()
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!popoverMenuRef.current?.contains(pointerEvent.target as Node)) onMenuCloseRef.current()
    }
    const closeOnWindowChange = () => onMenuCloseRef.current()
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    const stopWatchingWindowWidth = subscribeToPapelizWindowWidthChange(closeOnWindowChange)
    window.addEventListener('blur', closeOnWindowChange)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      stopWatchingWindowWidth()
      window.removeEventListener('blur', closeOnWindowChange)
      // Give focus back unless something else (a rename field, say) has already taken it, with no
      // tooltip on what it goes back to.
      if (focusedBeforeMenu?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
        givePapelizFocusBackWithTitleHeldBack(focusedBeforeMenu, () => focusedBeforeMenu.focus())
      }
    }
  }, [focusedBeforeMenu])

  const moveMenuFocus = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (papelizPopoverMenuFocusKeys.includes(keyboardEvent.key)) {
      keyboardEvent.preventDefault()
      const focusedMenuItemIndex = menuItemButtonRefs.current.findIndex((menuItemButton) => menuItemButton !== null && menuItemButton === document.activeElement)
      const nextMenuItemIndex = findPapelizPopoverMenuItemIndexAfterKey(menuItems, focusedMenuItemIndex, keyboardEvent.key)
      if (nextMenuItemIndex !== null) menuItemButtonRefs.current[nextMenuItemIndex]?.focus()
      return
    }
    if (keyboardEvent.key === 'Escape' || keyboardEvent.key === 'Tab') {
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      onMenuClose()
    }
  }

  return createPortal(
    <div
      ref={popoverMenuRef}
      role="menu"
      aria-label={menuLabel}
      onKeyDown={moveMenuFocus}
      // The browser's own menu never opens over this one.
      onContextMenu={(contextMenuEvent) => contextMenuEvent.preventDefault()}
      className="papeliz-pop-enter fixed z-50 max-h-[calc(100dvh-16px)] min-w-48 overflow-y-auto rounded-2xl border border-papeliz-line bg-papeliz-surface p-1 shadow-papeliz-pop"
      style={{ left: clampedMenuPosition.menuAnchorLeft, top: clampedMenuPosition.menuAnchorTop }}
    >
      {menuItems.map((menuItem, menuItemIndex) => (
        <Fragment key={menuItem.menuItemKey}>
        {menuItem.menuItemGroupHeading !== undefined && (
          <div role="presentation" className={joinPapelizClassNames('px-3 pt-1.5 pb-1 text-xs font-semibold text-papeliz-ink-subtle', menuItemIndex > 0 && 'mt-1 border-t border-papeliz-line pt-2')}>
            {menuItem.menuItemGroupHeading}
          </div>
        )}
        <PapelizPopoverMenuItemButton
          menuItem={menuItem}
          setMenuItemButtonElement={(menuItemButton) => {
            menuItemButtonRefs.current[menuItemIndex] = menuItemButton
          }}
          onMenuItemButtonClick={() =>
            pressPapelizPopoverMenuItem(menuItem, () => {
              // Focus goes back first, so a dialog the item opens returns it there when it closes. An item
              // chosen with Enter gives focus back from a key, so the title is held back here too.
              if (focusedBeforeMenu?.isConnected) givePapelizFocusBackWithTitleHeldBack(focusedBeforeMenu, () => focusedBeforeMenu.focus({ preventScroll: true }))
              onMenuClose()
            })
          }
        />
        </Fragment>
      ))}
    </div>,
    document.body,
  )
}
