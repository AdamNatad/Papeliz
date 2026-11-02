import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pressPapelizDesktopWindowBar } from './papeliz-desktop-window-controls'

// The tests run without a page: an element on the bar is a stand-in that says whether it sits inside
// something that keeps its own presses (a button, the note view switch).
class TestBarElement {
  constructor(readonly isInsideInteractiveElement: boolean) {}

  closest(): TestBarElement | null {
    return this.isInsideInteractiveElement ? this : null
  }
}

function createTestBarPress(barPressButton: number, barPressDetail: number, isInsideInteractiveElement: boolean) {
  const testBarPress = {
    button: barPressButton,
    detail: barPressDetail,
    target: new TestBarElement(isInsideInteractiveElement) as unknown as EventTarget,
    isDefaultPrevented: false,
    preventDefault: () => {
      testBarPress.isDefaultPrevented = true
    },
  }
  return testBarPress
}

describe('a press on the blue bar in Papeliz for Windows', () => {
  const desktopWindowCalls: string[] = []
  const testDesktopWindow = {
    startDesktopWindowDragging: async () => {
      desktopWindowCalls.push('drag')
    },
    toggleDesktopWindowMaximized: async () => {
      desktopWindowCalls.push('maximize or restore')
    },
  }

  beforeEach(() => {
    vi.stubGlobal('Element', TestBarElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    desktopWindowCalls.length = 0
  })

  it('moves the window from the bar’s empty space, and maximizes or restores it on a double-click', () => {
    const firstPress = createTestBarPress(0, 1, false)
    pressPapelizDesktopWindowBar(firstPress, testDesktopWindow)
    pressPapelizDesktopWindowBar(createTestBarPress(0, 2, false), testDesktopWindow)
    expect(desktopWindowCalls).toEqual(['drag', 'maximize or restore'])
    expect(firstPress.isDefaultPrevented).toBe(true)
  })

  it('leaves presses on the bar’s buttons and switch, and other mouse buttons, to themselves', () => {
    const buttonPress = createTestBarPress(0, 1, true)
    pressPapelizDesktopWindowBar(buttonPress, testDesktopWindow)
    pressPapelizDesktopWindowBar(createTestBarPress(2, 1, false), testDesktopWindow)
    pressPapelizDesktopWindowBar(createTestBarPress(1, 1, false), testDesktopWindow)
    expect(desktopWindowCalls).toEqual([])
    expect(buttonPress.isDefaultPrevented).toBe(false)
  })
})
