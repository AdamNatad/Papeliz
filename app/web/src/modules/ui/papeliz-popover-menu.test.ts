import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  findPapelizPopoverMenuItemIndexAfterKey,
  listPapelizPopoverMenuFocusableItemIndexes,
  PapelizPopoverMenuItemButton,
  pressPapelizPopoverMenuItem,
  type PapelizPopoverMenuItem,
} from './papeliz-popover-menu'

// A menu's turned-off item: the arrow keys, Home and End pass over it, a press does nothing, and it is
// marked aria-disabled. A menu with none moves exactly as before.

function makeTestPopoverMenuItem(menuItemLabel: string, isMenuItemDisabled?: boolean): PapelizPopoverMenuItem {
  return { menuItemKey: menuItemLabel, menuItemLabel, isMenuItemDisabled, onMenuItemSelect: vi.fn() }
}

const noteTabMenuItems = [makeTestPopoverMenuItem('Close'), makeTestPopoverMenuItem('Close Others', true), makeTestPopoverMenuItem('Close All')]

describe('a turned-off menu item', () => {
  it('is never focused: not first, and not by the arrow keys, Home or End', () => {
    expect(listPapelizPopoverMenuFocusableItemIndexes(noteTabMenuItems)).toEqual([0, 2])
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 0, 'ArrowDown')).toBe(2)
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 2, 'ArrowDown')).toBe(0)
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 2, 'ArrowUp')).toBe(0)
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 0, 'ArrowUp')).toBe(2)
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 2, 'Home')).toBe(0)
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 0, 'End')).toBe(2)
    // Focus left on the turned-off item (a click puts it there) moves on to the first one.
    expect(findPapelizPopoverMenuItemIndexAfterKey(noteTabMenuItems, 1, 'ArrowDown')).toBe(0)
  })

  it('does nothing when pressed, and leaves the menu open', () => {
    const closePopoverMenu = vi.fn()
    const closeOthersMenuItem = noteTabMenuItems[1]!
    pressPapelizPopoverMenuItem(closeOthersMenuItem, closePopoverMenu)
    expect(closePopoverMenu).not.toHaveBeenCalled()
    expect(closeOthersMenuItem.onMenuItemSelect).not.toHaveBeenCalled()
  })

  it('is marked aria-disabled, and greyed out', () => {
    const renderMenuItemButton = (menuItem: PapelizPopoverMenuItem) =>
      renderToStaticMarkup(
        createElement(PapelizPopoverMenuItemButton, { menuItem, setMenuItemButtonElement: () => undefined, onMenuItemButtonClick: () => undefined }),
      )
    const closeOthersMarkup = renderMenuItemButton(noteTabMenuItems[1]!)
    expect(closeOthersMarkup).toContain('role="menuitem"')
    expect(closeOthersMarkup).toContain('aria-disabled="true"')
    expect(closeOthersMarkup).toContain('opacity-60')
    const closeMarkup = renderMenuItemButton(noteTabMenuItems[0]!)
    expect(closeMarkup).not.toContain('aria-disabled')
    expect(closeMarkup).not.toContain('opacity-60')
  })
})

describe('a menu with no turned-off item', () => {
  const fileListNewMenuItems = [makeTestPopoverMenuItem('New Note'), makeTestPopoverMenuItem('New Folder'), makeTestPopoverMenuItem('Paste')]

  it('moves focus through every item, wrapping at the ends', () => {
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 0, 'ArrowDown')).toBe(1)
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 2, 'ArrowDown')).toBe(0)
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 0, 'ArrowUp')).toBe(2)
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 1, 'Home')).toBe(0)
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 1, 'End')).toBe(2)
    expect(findPapelizPopoverMenuItemIndexAfterKey(fileListNewMenuItems, 1, 'Enter')).toBeNull()
  })

  it('closes the menu, then runs the item, when one is pressed', () => {
    const menuEventOrder: string[] = []
    const newNoteMenuItem = { ...fileListNewMenuItems[0]!, onMenuItemSelect: () => menuEventOrder.push('item ran') }
    pressPapelizPopoverMenuItem(newNoteMenuItem, () => menuEventOrder.push('menu closed'))
    expect(menuEventOrder).toEqual(['menu closed', 'item ran'])
  })
})
