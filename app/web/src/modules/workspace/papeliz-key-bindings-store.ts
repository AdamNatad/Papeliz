import { create } from 'zustand'
import { papelizKeyBindingsSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// The shortcuts a user can change in Accessibility > Key Bindings. Each is written the way
// CodeMirror writes keys ("Mod-Shift-f", where Mod is ⌘ on a Mac and Ctrl elsewhere). The window's
// shortcuts and the note editor's both check a key press against the current binding at the moment
// it is pressed, so a change works at once, in every open note. Only the changed shortcuts are kept
// in the browser's settings.

export type PapelizKeyBindingActionId =
  | 'note-view-switch'
  | 'vault-notes-save-all'
  | 'focus-mode-toggle'
  | 'note-format-bold'
  | 'note-format-italic'
  | 'note-format-underline'
  | 'assistant-inline-edit'
  | 'md-view-wikilink-open'

export interface PapelizKeyBinding {
  papelizKeyBindingActionId: PapelizKeyBindingActionId
  keyBindingActionLabel: string
  papelizKeyBindingDefaultShortcut: string
  // Null keeps the default.
  papelizKeyBindingUserShortcut: string | null
}

// In the order the Key Bindings dialog lists them.
export const papelizDefaultKeyBindings: readonly PapelizKeyBinding[] = [
  { papelizKeyBindingActionId: 'note-view-switch', keyBindingActionLabel: 'Switch MD Code / MD View', papelizKeyBindingDefaultShortcut: 'Mod-e', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'vault-notes-save-all', keyBindingActionLabel: 'Save all notes now', papelizKeyBindingDefaultShortcut: 'Mod-s', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'focus-mode-toggle', keyBindingActionLabel: 'Focus mode', papelizKeyBindingDefaultShortcut: 'Mod-Shift-f', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'note-format-bold', keyBindingActionLabel: 'Bold', papelizKeyBindingDefaultShortcut: 'Mod-b', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'note-format-italic', keyBindingActionLabel: 'Italic', papelizKeyBindingDefaultShortcut: 'Mod-i', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'note-format-underline', keyBindingActionLabel: 'Underline', papelizKeyBindingDefaultShortcut: 'Mod-u', papelizKeyBindingUserShortcut: null },
  { papelizKeyBindingActionId: 'assistant-inline-edit', keyBindingActionLabel: 'Edit with Assistant', papelizKeyBindingDefaultShortcut: 'Mod-k', papelizKeyBindingUserShortcut: null },
  {
    papelizKeyBindingActionId: 'md-view-wikilink-open',
    keyBindingActionLabel: 'Open the link under the cursor',
    papelizKeyBindingDefaultShortcut: 'Mod-Enter',
    papelizKeyBindingUserShortcut: null,
  },
]

// Shortcuts the editor keeps for itself: no action can take them.
const papelizFixedKeyboardShortcuts: ReadonlyArray<{ fixedKeyboardShortcutLabel: string; fixedKeyboardShortcut: string }> = [
  { fixedKeyboardShortcutLabel: 'Undo', fixedKeyboardShortcut: 'Mod-z' },
  { fixedKeyboardShortcutLabel: 'Redo', fixedKeyboardShortcut: 'Mod-y' },
  { fixedKeyboardShortcutLabel: 'Redo', fixedKeyboardShortcut: 'Mod-Shift-z' },
  { fixedKeyboardShortcutLabel: 'Cut', fixedKeyboardShortcut: 'Mod-x' },
  { fixedKeyboardShortcutLabel: 'Copy', fixedKeyboardShortcut: 'Mod-c' },
  { fixedKeyboardShortcutLabel: 'Paste', fixedKeyboardShortcut: 'Mod-v' },
  { fixedKeyboardShortcutLabel: 'Select all', fixedKeyboardShortcut: 'Mod-a' },
  { fixedKeyboardShortcutLabel: 'Find', fixedKeyboardShortcut: 'Mod-f' },
]

// A Mac (or an iPad with a keyboard), where Mod is ⌘; everywhere else Mod is Ctrl.
export const isPapelizMacKeyboard: boolean = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

export interface PapelizParsedKeyboardShortcut {
  isModKeyHeld: boolean
  isCtrlKeyHeld: boolean
  isMetaKeyHeld: boolean
  isAltKeyHeld: boolean
  isShiftKeyHeld: boolean
  // A lowercase letter or digit, a sign such as "/", or a key's name: "Enter", "F2", "Space".
  shortcutKeyName: string
}

// What the shortcut code reads from a key press; tests pass plain objects.
export type PapelizShortcutKeyboardEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

const papelizModifierOnlyKeyNames = new Set(['Control', 'Shift', 'Alt', 'AltGraph', 'Meta', 'OS', 'Super', 'Hyper', 'Fn', 'FnLock', 'CapsLock', 'NumLock', 'ScrollLock'])

function normalizeShortcutKeyName(shortcutKeyName: string): string {
  if (shortcutKeyName === ' ' || /^space$/i.test(shortcutKeyName)) return 'Space'
  return shortcutKeyName.length === 1 ? shortcutKeyName.toLowerCase() : shortcutKeyName
}

// "Mod-Shift-f" into its parts, or null when it is not a shortcut. As in CodeMirror, the modifiers
// can come in any order and case, and "Mod--" is Mod with the minus key.
export function parsePapelizKeyboardShortcut(keyboardShortcut: string): PapelizParsedKeyboardShortcut | null {
  const shortcutParts = keyboardShortcut.split(/-(?!$)/)
  const shortcutKeyName = shortcutParts.pop()
  if (shortcutKeyName === undefined || shortcutKeyName.length === 0) return null
  const parsedKeyboardShortcut: PapelizParsedKeyboardShortcut = {
    isModKeyHeld: false,
    isCtrlKeyHeld: false,
    isMetaKeyHeld: false,
    isAltKeyHeld: false,
    isShiftKeyHeld: false,
    shortcutKeyName: normalizeShortcutKeyName(shortcutKeyName),
  }
  for (const shortcutModifierName of shortcutParts) {
    if (/^mod$/i.test(shortcutModifierName)) parsedKeyboardShortcut.isModKeyHeld = true
    else if (/^(c|ctrl|control)$/i.test(shortcutModifierName)) parsedKeyboardShortcut.isCtrlKeyHeld = true
    else if (/^(cmd|meta|m)$/i.test(shortcutModifierName)) parsedKeyboardShortcut.isMetaKeyHeld = true
    else if (/^a(lt)?$/i.test(shortcutModifierName)) parsedKeyboardShortcut.isAltKeyHeld = true
    else if (/^s(hift)?$/i.test(shortcutModifierName)) parsedKeyboardShortcut.isShiftKeyHeld = true
    else return null
  }
  return parsedKeyboardShortcut
}

// The keys of a shortcut on this platform: the command key (⌘ on a Mac, Ctrl elsewhere) and the
// other control key (Ctrl on a Mac, the Windows or Meta key elsewhere).
interface PapelizPlatformShortcutKeys {
  isCommandKeyHeld: boolean
  isOtherControlKeyHeld: boolean
  isAltKeyHeld: boolean
  isShiftKeyHeld: boolean
  shortcutKeyName: string
}

function readPlatformShortcutKeys(parsedKeyboardShortcut: PapelizParsedKeyboardShortcut, isMacKeyboard: boolean): PapelizPlatformShortcutKeys {
  return {
    isCommandKeyHeld: parsedKeyboardShortcut.isModKeyHeld || (isMacKeyboard ? parsedKeyboardShortcut.isMetaKeyHeld : parsedKeyboardShortcut.isCtrlKeyHeld),
    isOtherControlKeyHeld: isMacKeyboard ? parsedKeyboardShortcut.isCtrlKeyHeld : parsedKeyboardShortcut.isMetaKeyHeld,
    isAltKeyHeld: parsedKeyboardShortcut.isAltKeyHeld,
    isShiftKeyHeld: parsedKeyboardShortcut.isShiftKeyHeld,
    shortcutKeyName: parsedKeyboardShortcut.shortcutKeyName,
  }
}

function joinPlatformShortcutKeys(platformShortcutKeys: PapelizPlatformShortcutKeys, isMacKeyboard: boolean): string {
  return [
    platformShortcutKeys.isCommandKeyHeld ? 'Mod' : null,
    platformShortcutKeys.isOtherControlKeyHeld ? (isMacKeyboard ? 'Ctrl' : 'Meta') : null,
    platformShortcutKeys.isAltKeyHeld ? 'Alt' : null,
    platformShortcutKeys.isShiftKeyHeld ? 'Shift' : null,
    platformShortcutKeys.shortcutKeyName,
  ]
    .filter((shortcutPart) => shortcutPart !== null)
    .join('-')
}

// One spelling per platform, so two spellings of the same keys compare equal: the command key is
// written Mod, and the modifiers come in one order ("Ctrl-Shift-F" on Windows is "Mod-Shift-f").
export function normalizePapelizKeyboardShortcut(keyboardShortcut: string, isMacKeyboard = isPapelizMacKeyboard): string | null {
  const parsedKeyboardShortcut = parsePapelizKeyboardShortcut(keyboardShortcut)
  return parsedKeyboardShortcut === null ? null : joinPlatformShortcutKeys(readPlatformShortcutKeys(parsedKeyboardShortcut, isMacKeyboard), isMacKeyboard)
}

// The key a press names, spelled as in a shortcut. Letters follow the keyboard's layout, as in
// CodeMirror; when the layout has no Latin letters (or ⌥ on a Mac types "ƒ" for F), the key's place
// on the keyboard names it instead. Digits always go by place, so ⇧1 is Shift-1 and not "!".
function readPressedShortcutKeyName(keyboardEvent: PapelizShortcutKeyboardEvent): string | null {
  const pressedKeyText = typeof keyboardEvent.key === 'string' ? keyboardEvent.key : ''
  const pressedKeyCode = typeof keyboardEvent.code === 'string' ? keyboardEvent.code : ''
  if (papelizModifierOnlyKeyNames.has(pressedKeyText)) return null
  if (/^[a-z]$/i.test(pressedKeyText)) return pressedKeyText.toLowerCase()
  const letterKeyCodeMatch = /^Key([A-Z])$/.exec(pressedKeyCode)
  if (letterKeyCodeMatch?.[1] !== undefined) return letterKeyCodeMatch[1].toLowerCase()
  const digitKeyCodeMatch = /^Digit([0-9])$/.exec(pressedKeyCode)
  if (digitKeyCodeMatch?.[1] !== undefined) return digitKeyCodeMatch[1]
  if (pressedKeyText.length === 0 || pressedKeyText === 'Unidentified' || pressedKeyText === 'Dead') return null
  return normalizeShortcutKeyName(pressedKeyText)
}

// The shortcut a key press makes, or null while only modifiers are held.
export function readPapelizKeyboardShortcutFromEvent(keyboardEvent: PapelizShortcutKeyboardEvent, isMacKeyboard = isPapelizMacKeyboard): string | null {
  const shortcutKeyName = readPressedShortcutKeyName(keyboardEvent)
  if (shortcutKeyName === null) return null
  return joinPlatformShortcutKeys(
    {
      isCommandKeyHeld: isMacKeyboard ? keyboardEvent.metaKey : keyboardEvent.ctrlKey,
      isOtherControlKeyHeld: isMacKeyboard ? keyboardEvent.ctrlKey : keyboardEvent.metaKey,
      isAltKeyHeld: keyboardEvent.altKey,
      isShiftKeyHeld: keyboardEvent.shiftKey,
      shortcutKeyName,
    },
    isMacKeyboard,
  )
}

// True when the press is exactly the shortcut: the same key with the same modifiers, no more.
export function doesKeyboardEventMatchPapelizKeyboardShortcut(
  keyboardEvent: PapelizShortcutKeyboardEvent,
  keyboardShortcut: string,
  isMacKeyboard = isPapelizMacKeyboard,
): boolean {
  const pressedKeyboardShortcut = readPapelizKeyboardShortcutFromEvent(keyboardEvent, isMacKeyboard)
  return pressedKeyboardShortcut !== null && pressedKeyboardShortcut === normalizePapelizKeyboardShortcut(keyboardShortcut, isMacKeyboard)
}

const papelizMacShortcutKeyLabels: Record<string, string> = {
  Enter: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: 'Esc',
  Tab: '⇥',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}
const papelizOtherShortcutKeyLabels: Record<string, string> = { Escape: 'Esc', Delete: 'Del', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }

// The shortcut as people read it: "Ctrl+Shift+F" on Windows and Linux, "⇧⌘F" on a Mac (its
// symbols in the Mac's own order: ⌃ ⌥ ⇧ ⌘).
export function describePapelizKeyboardShortcut(keyboardShortcut: string, isMacKeyboard = isPapelizMacKeyboard): string {
  const parsedKeyboardShortcut = parsePapelizKeyboardShortcut(keyboardShortcut)
  if (parsedKeyboardShortcut === null) return keyboardShortcut
  const { isCommandKeyHeld, isOtherControlKeyHeld, isAltKeyHeld, isShiftKeyHeld, shortcutKeyName } = readPlatformShortcutKeys(parsedKeyboardShortcut, isMacKeyboard)
  const shortcutKeyLabel =
    (isMacKeyboard ? papelizMacShortcutKeyLabels : papelizOtherShortcutKeyLabels)[shortcutKeyName] ??
    (shortcutKeyName.length === 1 ? shortcutKeyName.toUpperCase() : shortcutKeyName)
  if (isMacKeyboard) {
    return `${isOtherControlKeyHeld ? '⌃' : ''}${isAltKeyHeld ? '⌥' : ''}${isShiftKeyHeld ? '⇧' : ''}${isCommandKeyHeld ? '⌘' : ''}${shortcutKeyLabel}`
  }
  return [isCommandKeyHeld ? 'Ctrl' : null, isOtherControlKeyHeld ? 'Meta' : null, isAltKeyHeld ? 'Alt' : null, isShiftKeyHeld ? 'Shift' : null, shortcutKeyLabel]
    .filter((shortcutLabelPart) => shortcutLabelPart !== null)
    .join('+')
}

// A shortcut needs Ctrl, ⌘ or Alt, unless it is a function key such as F2, so typing in a note
// still types.
export function doesPapelizKeyboardShortcutLeaveTypingFree(keyboardShortcut: string): boolean {
  const parsedKeyboardShortcut = parsePapelizKeyboardShortcut(keyboardShortcut)
  if (parsedKeyboardShortcut === null) return false
  const { isModKeyHeld, isCtrlKeyHeld, isMetaKeyHeld, isAltKeyHeld, shortcutKeyName } = parsedKeyboardShortcut
  return isModKeyHeld || isCtrlKeyHeld || isMetaKeyHeld || isAltKeyHeld || /^F([1-9]|1[0-9]|2[0-4])$/.test(shortcutKeyName)
}

export function readPapelizKeyBindingShortcut(keyBindingActionId: PapelizKeyBindingActionId, papelizKeyBindings: readonly PapelizKeyBinding[]): string {
  const papelizKeyBinding = papelizKeyBindings.find((keyBinding) => keyBinding.papelizKeyBindingActionId === keyBindingActionId)
  return papelizKeyBinding === undefined ? '' : (papelizKeyBinding.papelizKeyBindingUserShortcut ?? papelizKeyBinding.papelizKeyBindingDefaultShortcut)
}

export function describePapelizKeyBindingShortcut(
  keyBindingActionId: PapelizKeyBindingActionId,
  papelizKeyBindings: readonly PapelizKeyBinding[],
  isMacKeyboard = isPapelizMacKeyboard,
): string {
  return describePapelizKeyboardShortcut(readPapelizKeyBindingShortcut(keyBindingActionId, papelizKeyBindings), isMacKeyboard)
}

// The action (or the editor's own command) that already uses these keys, by its label; null when
// they are free for `changedKeyBindingActionId`, which may keep its own.
export function findPapelizKeyBindingConflict(
  keyboardShortcut: string,
  changedKeyBindingActionId: PapelizKeyBindingActionId,
  papelizKeyBindings: readonly PapelizKeyBinding[],
  isMacKeyboard = isPapelizMacKeyboard,
): string | null {
  const normalizedKeyboardShortcut = normalizePapelizKeyboardShortcut(keyboardShortcut, isMacKeyboard)
  if (normalizedKeyboardShortcut === null) return null
  const isSameShortcut = (otherKeyboardShortcut: string) => normalizePapelizKeyboardShortcut(otherKeyboardShortcut, isMacKeyboard) === normalizedKeyboardShortcut
  const conflictingKeyBinding = papelizKeyBindings.find(
    (keyBinding) =>
      keyBinding.papelizKeyBindingActionId !== changedKeyBindingActionId &&
      isSameShortcut(keyBinding.papelizKeyBindingUserShortcut ?? keyBinding.papelizKeyBindingDefaultShortcut),
  )
  if (conflictingKeyBinding !== undefined) return conflictingKeyBinding.keyBindingActionLabel
  return papelizFixedKeyboardShortcuts.find(({ fixedKeyboardShortcut }) => isSameShortcut(fixedKeyboardShortcut))?.fixedKeyboardShortcutLabel ?? null
}

// What is saved: only the changed shortcuts, by action.
type PapelizSavedKeyBindingShortcuts = Partial<Record<PapelizKeyBindingActionId, string>>

function collectSavedKeyBindingShortcuts(papelizKeyBindings: readonly PapelizKeyBinding[]): PapelizSavedKeyBindingShortcuts {
  const savedKeyBindingShortcuts: PapelizSavedKeyBindingShortcuts = {}
  for (const keyBinding of papelizKeyBindings) {
    if (keyBinding.papelizKeyBindingUserShortcut !== null) savedKeyBindingShortcuts[keyBinding.papelizKeyBindingActionId] = keyBinding.papelizKeyBindingUserShortcut
  }
  return savedKeyBindingShortcuts
}

function saveKeyBindings(papelizKeyBindings: readonly PapelizKeyBinding[]): void {
  void writePapelizUserSetting(papelizKeyBindingsSettingName, collectSavedKeyBindingShortcuts(papelizKeyBindings)).catch(() => undefined)
}

interface PapelizKeyBindingsState {
  papelizKeyBindings: readonly PapelizKeyBinding[]
  loadKeyBindings: () => Promise<void>
  // Saves at once. The default's own keys count as no change. The caller checks for conflicts first.
  changeKeyBindingShortcut: (keyBindingActionId: PapelizKeyBindingActionId, keyboardShortcut: string) => void
  resetKeyBindingShortcut: (keyBindingActionId: PapelizKeyBindingActionId) => void
  resetAllKeyBindingShortcuts: () => void
}

export const usePapelizKeyBindingsStore = create<PapelizKeyBindingsState>()((setKeyBindingsState, getKeyBindingsState) => {
  const replaceKeyBindingUserShortcut = (keyBindingActionId: PapelizKeyBindingActionId, keyBindingUserShortcut: string | null) => {
    const changedKeyBindings = getKeyBindingsState().papelizKeyBindings.map((keyBinding) =>
      keyBinding.papelizKeyBindingActionId === keyBindingActionId ? { ...keyBinding, papelizKeyBindingUserShortcut: keyBindingUserShortcut } : keyBinding,
    )
    setKeyBindingsState({ papelizKeyBindings: changedKeyBindings })
    saveKeyBindings(changedKeyBindings)
  }

  return {
    papelizKeyBindings: papelizDefaultKeyBindings,

    loadKeyBindings: async () => {
      const savedKeyBindingShortcuts = await readPapelizUserSetting<unknown>(papelizKeyBindingsSettingName, null)
      if (savedKeyBindingShortcuts === null || typeof savedKeyBindingShortcuts !== 'object') return
      setKeyBindingsState({
        // Unknown actions, and anything that is not a shortcut, are left out.
        papelizKeyBindings: papelizDefaultKeyBindings.map((keyBinding) => {
          const savedKeyBindingShortcut: unknown = (savedKeyBindingShortcuts as Record<string, unknown>)[keyBinding.papelizKeyBindingActionId]
          if (typeof savedKeyBindingShortcut !== 'string' || parsePapelizKeyboardShortcut(savedKeyBindingShortcut) === null) return keyBinding
          return { ...keyBinding, papelizKeyBindingUserShortcut: savedKeyBindingShortcut }
        }),
      })
    },

    changeKeyBindingShortcut: (keyBindingActionId, keyboardShortcut) => {
      const papelizKeyBinding = getKeyBindingsState().papelizKeyBindings.find((keyBinding) => keyBinding.papelizKeyBindingActionId === keyBindingActionId)
      if (papelizKeyBinding === undefined) return
      const isDefaultShortcut = normalizePapelizKeyboardShortcut(keyboardShortcut) === normalizePapelizKeyboardShortcut(papelizKeyBinding.papelizKeyBindingDefaultShortcut)
      replaceKeyBindingUserShortcut(keyBindingActionId, isDefaultShortcut ? null : keyboardShortcut)
    },

    resetKeyBindingShortcut: (keyBindingActionId) => replaceKeyBindingUserShortcut(keyBindingActionId, null),

    resetAllKeyBindingShortcuts: () => {
      setKeyBindingsState({ papelizKeyBindings: papelizDefaultKeyBindings })
      saveKeyBindings(papelizDefaultKeyBindings)
    },
  }
})

// Whether a key press is the action's current shortcut; read at the moment of the press, so it
// always follows the latest change.
export function isPapelizKeyBindingPressed(
  keyboardEvent: PapelizShortcutKeyboardEvent,
  keyBindingActionId: PapelizKeyBindingActionId,
  isMacKeyboard = isPapelizMacKeyboard,
): boolean {
  const keyboardShortcut = readPapelizKeyBindingShortcut(keyBindingActionId, usePapelizKeyBindingsStore.getState().papelizKeyBindings)
  return doesKeyboardEventMatchPapelizKeyboardShortcut(keyboardEvent, keyboardShortcut, isMacKeyboard)
}

// The action's shortcut as people read it ("Ctrl+B", "⌘B"), for titles and menus.
export function usePapelizKeyBindingShortcutLabel(keyBindingActionId: PapelizKeyBindingActionId): string {
  return usePapelizKeyBindingsStore((keyBindingsState) => describePapelizKeyBindingShortcut(keyBindingActionId, keyBindingsState.papelizKeyBindings))
}
