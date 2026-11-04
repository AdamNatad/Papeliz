// Papeliz for Windows' New Window shortcut: Ctrl+Shift+N, from any screen, the start screen too. A fixed
// shortcut, apart from the editor's key bindings, since it belongs to the window, not to a note.

export const papelizDesktopNewWindowShortcutLabel = 'Ctrl+Shift+N'

export function isPapelizDesktopNewWindowShortcut(
  keyboardEvent: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey' | 'repeat'>,
): boolean {
  return keyboardEvent.ctrlKey && keyboardEvent.shiftKey && !keyboardEvent.altKey && !keyboardEvent.metaKey && !keyboardEvent.repeat && keyboardEvent.key.toLowerCase() === 'n'
}
