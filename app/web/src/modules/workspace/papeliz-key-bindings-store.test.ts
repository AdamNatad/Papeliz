import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  describePapelizKeyboardShortcut,
  doesKeyboardEventMatchPapelizKeyboardShortcut,
  doesPapelizKeyboardShortcutLeaveTypingFree,
  findPapelizKeyBindingConflict,
  isPapelizKeyBindingPressed,
  normalizePapelizKeyboardShortcut,
  parsePapelizKeyboardShortcut,
  readPapelizKeyBindingShortcut,
  readPapelizKeyboardShortcutFromEvent,
  usePapelizKeyBindingsStore,
  type PapelizShortcutKeyboardEvent,
} from './papeliz-key-bindings-store'

// The browser's settings, kept in memory for these tests.
const savedTestUserSettingValues = vi.hoisted(() => new Map<string, unknown>())

vi.mock('../settings/papeliz-user-settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../settings/papeliz-user-settings')>()),
  readPapelizUserSetting: async (papelizUserSettingName: string, fallbackUserSettingValue: unknown) =>
    savedTestUserSettingValues.has(papelizUserSettingName) ? savedTestUserSettingValues.get(papelizUserSettingName) : fallbackUserSettingValue,
  writePapelizUserSetting: async (papelizUserSettingName: string, papelizUserSettingValue: unknown) => {
    savedTestUserSettingValues.set(papelizUserSettingName, papelizUserSettingValue)
  },
}))

function createTestShortcutKeyboardEvent(pressedTestKeys: Partial<PapelizShortcutKeyboardEvent> & { key: string }): PapelizShortcutKeyboardEvent {
  return { code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...pressedTestKeys }
}

function readTestKeyBindings() {
  return usePapelizKeyBindingsStore.getState().papelizKeyBindings
}

beforeEach(() => {
  usePapelizKeyBindingsStore.getState().resetAllKeyBindingShortcuts()
  savedTestUserSettingValues.clear()
})

describe('reading a shortcut', () => {
  it('reads the modifiers in any order and case, and the key', () => {
    const modShiftF = { isModKeyHeld: true, isCtrlKeyHeld: false, isMetaKeyHeld: false, isAltKeyHeld: false, isShiftKeyHeld: true, shortcutKeyName: 'f' }
    expect(parsePapelizKeyboardShortcut('Mod-Shift-f')).toEqual(modShiftF)
    expect(parsePapelizKeyboardShortcut('shift-mod-F')).toEqual(modShiftF)
    expect(parsePapelizKeyboardShortcut('Mod-Enter')?.shortcutKeyName).toBe('Enter')
    expect(parsePapelizKeyboardShortcut('Mod--')?.shortcutKeyName).toBe('-')
    expect(parsePapelizKeyboardShortcut('Alt-Space')?.shortcutKeyName).toBe('Space')
  })

  it('refuses what is not a shortcut', () => {
    expect(parsePapelizKeyboardShortcut('')).toBeNull()
    expect(parsePapelizKeyboardShortcut('Hyper-x')).toBeNull()
  })

  it('spells the same keys one way on each platform', () => {
    expect(normalizePapelizKeyboardShortcut('Ctrl-Shift-F', false)).toBe('Mod-Shift-f')
    expect(normalizePapelizKeyboardShortcut('Shift-Mod-f', false)).toBe('Mod-Shift-f')
    expect(normalizePapelizKeyboardShortcut('Cmd-b', true)).toBe('Mod-b')
    expect(normalizePapelizKeyboardShortcut('Ctrl-b', true)).toBe('Ctrl-b')
    expect(normalizePapelizKeyboardShortcut('Meta-b', false)).toBe('Meta-b')
  })
})

describe('showing a shortcut', () => {
  it('writes the keys out on Windows and Linux', () => {
    expect(describePapelizKeyboardShortcut('Mod-Shift-f', false)).toBe('Ctrl+Shift+F')
    expect(describePapelizKeyboardShortcut('Mod-Enter', false)).toBe('Ctrl+Enter')
    expect(describePapelizKeyboardShortcut('Mod-Alt-ArrowUp', false)).toBe('Ctrl+Alt+↑')
    expect(describePapelizKeyboardShortcut('F2', false)).toBe('F2')
  })

  it('uses the Mac’s symbols, in the Mac’s order', () => {
    expect(describePapelizKeyboardShortcut('Mod-b', true)).toBe('⌘B')
    expect(describePapelizKeyboardShortcut('Mod-Shift-f', true)).toBe('⇧⌘F')
    expect(describePapelizKeyboardShortcut('Ctrl-Alt-k', true)).toBe('⌃⌥K')
    expect(describePapelizKeyboardShortcut('Mod-Enter', true)).toBe('⌘↩')
  })
})

describe('matching a key press', () => {
  it('takes Mod as Ctrl on Windows and as ⌘ on a Mac', () => {
    const ctrlB = createTestShortcutKeyboardEvent({ key: 'b', code: 'KeyB', ctrlKey: true })
    const commandB = createTestShortcutKeyboardEvent({ key: 'b', code: 'KeyB', metaKey: true })
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(ctrlB, 'Mod-b', false)).toBe(true)
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(commandB, 'Mod-b', false)).toBe(false)
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(commandB, 'Mod-b', true)).toBe(true)
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(ctrlB, 'Mod-b', true)).toBe(false)
  })

  it('needs exactly the shortcut’s modifiers', () => {
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(createTestShortcutKeyboardEvent({ key: 'B', code: 'KeyB', ctrlKey: true, shiftKey: true }), 'Mod-b', false)).toBe(false)
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(createTestShortcutKeyboardEvent({ key: 'b', code: 'KeyB', ctrlKey: true, altKey: true }), 'Mod-b', false)).toBe(false)
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(createTestShortcutKeyboardEvent({ key: 'b', code: 'KeyB' }), 'Mod-b', false)).toBe(false)
  })

  it('reads a shifted letter as its letter', () => {
    const ctrlShiftF = createTestShortcutKeyboardEvent({ key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true })
    expect(readPapelizKeyboardShortcutFromEvent(ctrlShiftF, false)).toBe('Mod-Shift-f')
    expect(doesKeyboardEventMatchPapelizKeyboardShortcut(ctrlShiftF, 'Mod-Shift-f', false)).toBe(true)
  })

  it('goes by the key’s place for other alphabets, ⌥ characters and digits', () => {
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'и', code: 'KeyB', ctrlKey: true }), false)).toBe('Mod-b')
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'ƒ', code: 'KeyF', metaKey: true, altKey: true }), true)).toBe('Mod-Alt-f')
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true }), false)).toBe('Mod-Shift-1')
  })

  it('reads named keys and signs', () => {
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'Enter', code: 'Enter', ctrlKey: true }), false)).toBe('Mod-Enter')
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: ' ', code: 'Space', altKey: true }), false)).toBe('Alt-Space')
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: '/', code: 'Slash', ctrlKey: true }), false)).toBe('Mod-/')
  })

  it('keeps waiting while only modifiers are held', () => {
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), false)).toBeNull()
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'Shift', code: 'ShiftLeft', ctrlKey: true, shiftKey: true }), false)).toBeNull()
    expect(readPapelizKeyboardShortcutFromEvent(createTestShortcutKeyboardEvent({ key: 'Meta', code: 'MetaLeft', metaKey: true }), true)).toBeNull()
  })

  it('follows a changed binding at once', () => {
    const ctrlB = createTestShortcutKeyboardEvent({ key: 'b', code: 'KeyB', ctrlKey: true })
    const ctrlJ = createTestShortcutKeyboardEvent({ key: 'j', code: 'KeyJ', ctrlKey: true })
    expect(isPapelizKeyBindingPressed(ctrlB, 'note-format-bold', false)).toBe(true)
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('note-format-bold', 'Mod-j')
    expect(isPapelizKeyBindingPressed(ctrlB, 'note-format-bold', false)).toBe(false)
    expect(isPapelizKeyBindingPressed(ctrlJ, 'note-format-bold', false)).toBe(true)
  })
})

describe('conflicts', () => {
  it('refuses keys another action uses, by its name', () => {
    expect(findPapelizKeyBindingConflict('Mod-i', 'note-format-bold', readTestKeyBindings(), false)).toBe('Italic')
    expect(findPapelizKeyBindingConflict('Ctrl-Shift-F', 'note-format-bold', readTestKeyBindings(), false)).toBe('Focus mode')
  })

  it('refuses the editor’s own shortcuts', () => {
    expect(findPapelizKeyBindingConflict('Mod-c', 'note-format-bold', readTestKeyBindings(), false)).toBe('Copy')
    expect(findPapelizKeyBindingConflict('Mod-Shift-z', 'note-format-bold', readTestKeyBindings(), false)).toBe('Redo')
  })

  it('lets an action keep its own keys, and goes by each action’s current keys', () => {
    expect(findPapelizKeyBindingConflict('Mod-b', 'note-format-bold', readTestKeyBindings(), false)).toBeNull()
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('note-format-italic', 'Mod-j')
    expect(findPapelizKeyBindingConflict('Mod-i', 'note-format-bold', readTestKeyBindings(), false)).toBeNull()
    expect(findPapelizKeyBindingConflict('Mod-j', 'note-format-bold', readTestKeyBindings(), false)).toBe('Italic')
  })

  it('keeps plain typing free', () => {
    expect(doesPapelizKeyboardShortcutLeaveTypingFree('b')).toBe(false)
    expect(doesPapelizKeyboardShortcutLeaveTypingFree('Shift-b')).toBe(false)
    expect(doesPapelizKeyboardShortcutLeaveTypingFree('Mod-b')).toBe(true)
    expect(doesPapelizKeyboardShortcutLeaveTypingFree('Alt-b')).toBe(true)
    expect(doesPapelizKeyboardShortcutLeaveTypingFree('F2')).toBe(true)
  })
})

describe('changing and resetting', () => {
  it('saves a change at once, and Reset brings the default back', () => {
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('note-format-bold', 'Mod-j')
    expect(readPapelizKeyBindingShortcut('note-format-bold', readTestKeyBindings())).toBe('Mod-j')
    expect(savedTestUserSettingValues.get('papelizKeyBindings')).toEqual({ 'note-format-bold': 'Mod-j' })
    usePapelizKeyBindingsStore.getState().resetKeyBindingShortcut('note-format-bold')
    expect(readPapelizKeyBindingShortcut('note-format-bold', readTestKeyBindings())).toBe('Mod-b')
    expect(savedTestUserSettingValues.get('papelizKeyBindings')).toEqual({})
  })

  it('counts the default’s own keys as no change', () => {
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('note-format-bold', 'Mod-b')
    expect(readTestKeyBindings().every((keyBinding) => keyBinding.papelizKeyBindingUserShortcut === null)).toBe(true)
  })

  it('resets every shortcut at once', () => {
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('note-format-bold', 'Mod-j')
    usePapelizKeyBindingsStore.getState().changeKeyBindingShortcut('focus-mode-toggle', 'Mod-Alt-f')
    usePapelizKeyBindingsStore.getState().resetAllKeyBindingShortcuts()
    expect(readTestKeyBindings().every((keyBinding) => keyBinding.papelizKeyBindingUserShortcut === null)).toBe(true)
    expect(readPapelizKeyBindingShortcut('focus-mode-toggle', readTestKeyBindings())).toBe('Mod-Shift-f')
  })

  it('loads saved shortcuts and leaves out what it does not know', async () => {
    savedTestUserSettingValues.set('papelizKeyBindings', { 'note-format-bold': 'Mod-j', 'note-format-italic': 42, 'note-format-underline': 'Hyper-q', 'no-such-action': 'Mod-q' })
    await usePapelizKeyBindingsStore.getState().loadKeyBindings()
    expect(readPapelizKeyBindingShortcut('note-format-bold', readTestKeyBindings())).toBe('Mod-j')
    expect(readPapelizKeyBindingShortcut('note-format-italic', readTestKeyBindings())).toBe('Mod-i')
    expect(readPapelizKeyBindingShortcut('note-format-underline', readTestKeyBindings())).toBe('Mod-u')
  })
})
