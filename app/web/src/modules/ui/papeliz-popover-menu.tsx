import { Check, type LucideIcon } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from './papeliz-class-names'

export interface PapelizPopoverMenuItem {
  menuItemKey: string
  menuItemLabel: string
  MenuItemIcon?: LucideIcon
  isDangerousMenuItem?: boolean
  // Set for a choice among several (a radio item); true marks the current one.
  isMenuItemChecked?: boolean
  // Starts a new group under this heading, with a line above it unless it opens the menu.
  menuItemGroupHeading?: string
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

// A small menu that opens at a point (a button's corner or the mouse), with arrow keys, Home, End,
// Enter and Esc. Focus returns to whatever had it when the menu opened.
export function PapelizPopoverMenu({ menuLabel, menuPosition, menuItems, onMenuClose }: PapelizPopoverMenuProps) {
  const popoverMenuRef = useRef<HTMLDivElement>(null)
  const menuItemButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [clampedMenuPosition, setClampedMenuPosition] = useState(menuPosition)
  const onMenuCloseRef = useRef(onMenuClose)

  useEffect(() => {
    onMenuCloseRef.current = onMenuClose
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
    const focusedBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null
    menuItemButtonRefs.current[0]?.focus()
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!popoverMenuRef.current?.contains(pointerEvent.target as Node)) onMenuCloseRef.current()
    }
    const closeOnWindowChange = () => onMenuCloseRef.current()
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    window.addEventListener('resize', closeOnWindowChange)
    window.addEventListener('blur', closeOnWindowChange)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      window.removeEventListener('resize', closeOnWindowChange)
      window.removeEventListener('blur', closeOnWindowChange)
      // Give focus back unless something else (a rename field, say) has already taken it.
      if (focusedBeforeMenu?.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
        focusedBeforeMenu.focus()
      }
    }
  }, [])

  const moveMenuFocus = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const menuItemButtons = menuItemButtonRefs.current.filter((menuItemButton): menuItemButton is HTMLButtonElement => menuItemButton !== null)
    const focusedMenuItemIndex = menuItemButtons.findIndex((menuItemButton) => menuItemButton === document.activeElement)
    let nextMenuItemIndex: number | null = null
    if (keyboardEvent.key === 'ArrowDown') nextMenuItemIndex = (focusedMenuItemIndex + 1) % menuItemButtons.length
    if (keyboardEvent.key === 'ArrowUp') nextMenuItemIndex = (focusedMenuItemIndex - 1 + menuItemButtons.length) % menuItemButtons.length
    if (keyboardEvent.key === 'Home') nextMenuItemIndex = 0
    if (keyboardEvent.key === 'End') nextMenuItemIndex = menuItemButtons.length - 1
    if (nextMenuItemIndex !== null) {
      keyboardEvent.preventDefault()
      menuItemButtons[nextMenuItemIndex]?.focus()
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
        <button
          ref={(menuItemButton) => {
            menuItemButtonRefs.current[menuItemIndex] = menuItemButton
          }}
          type="button"
          role={menuItem.isMenuItemChecked === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={menuItem.isMenuItemChecked}
          tabIndex={-1}
          onClick={() => {
            onMenuClose()
            menuItem.onMenuItemSelect()
          }}
          className={joinPapelizClassNames(
            'flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-left text-sm font-medium text-papeliz-ink hover:bg-papeliz-hover focus-visible:bg-papeliz-hover focus-visible:outline-none',
            menuItem.isDangerousMenuItem && 'text-papeliz-diff-removed-ink',
          )}
        >
          {menuItem.MenuItemIcon !== undefined && <menuItem.MenuItemIcon className="size-4 flex-none opacity-80" aria-hidden="true" />}
          {menuItem.menuItemLabel}
          {menuItem.isMenuItemChecked === true && <Check className="ml-auto size-4 flex-none text-papeliz-blue" aria-hidden="true" />}
        </button>
        </Fragment>
      ))}
    </div>,
    document.body,
  )
}
