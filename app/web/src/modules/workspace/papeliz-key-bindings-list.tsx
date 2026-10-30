import { RotateCcw } from 'lucide-react'
import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import {
  describePapelizKeyboardShortcut,
  doesPapelizKeyboardShortcutLeaveTypingFree,
  findPapelizKeyBindingConflict,
  isPapelizMacKeyboard,
  readPapelizKeyboardShortcutFromEvent,
  usePapelizKeyBindingsStore,
  type PapelizKeyBinding,
  type PapelizKeyBindingActionId,
} from './papeliz-key-bindings-store'

const papelizKeyBindingTypingFreeHint = isPapelizMacKeyboard ? 'Hold ⌘, ⌃ or ⌥ too, so typing still works.' : 'Hold Ctrl or Alt too, so typing still works.'

// Every shortcut that can change, on a key chip. Click a chip (or press Enter on it), then press the
// new keys; Esc stops without a change. Keys another action already uses are refused, naming it.
// Changes save as they happen. Shown in the Settings gear's Settings page.
export function PapelizKeyBindingsList() {
  const keyBindingsListIdPrefix = useId()
  const papelizKeyBindings = usePapelizKeyBindingsStore((keyBindingsState) => keyBindingsState.papelizKeyBindings)
  const changeKeyBindingShortcut = usePapelizKeyBindingsStore((keyBindingsState) => keyBindingsState.changeKeyBindingShortcut)
  const resetKeyBindingShortcut = usePapelizKeyBindingsStore((keyBindingsState) => keyBindingsState.resetKeyBindingShortcut)
  const resetAllKeyBindingShortcuts = usePapelizKeyBindingsStore((keyBindingsState) => keyBindingsState.resetAllKeyBindingShortcuts)
  // The action waiting for its new keys, and why the last keys pressed for it were refused.
  const [recordingKeyBindingActionId, setRecordingKeyBindingActionId] = useState<PapelizKeyBindingActionId | null>(null)
  const [keyBindingRefusalMessage, setKeyBindingRefusalMessage] = useState<string | null>(null)
  // Read out by screen readers: waiting for keys, a shortcut changed, a reset.
  const [keyBindingsAnnouncement, setKeyBindingsAnnouncement] = useState('')
  const isAnyKeyBindingChanged = papelizKeyBindings.some((keyBinding) => keyBinding.papelizKeyBindingUserShortcut !== null)

  const stopRecordingKeyBinding = () => {
    setRecordingKeyBindingActionId(null)
    setKeyBindingRefusalMessage(null)
  }

  const startRecordingKeyBinding = (keyBinding: PapelizKeyBinding) => {
    setRecordingKeyBindingActionId(keyBinding.papelizKeyBindingActionId)
    setKeyBindingRefusalMessage(null)
    setKeyBindingsAnnouncement(`${keyBinding.keyBindingActionLabel}: press the new keys, or Esc to cancel.`)
  }

  const recordPressedKeys = (keyboardEvent: ReactKeyboardEvent<HTMLButtonElement>, keyBinding: PapelizKeyBinding) => {
    // Tab still moves on (and the blur stops recording), so the keyboard is never stuck here.
    if (keyboardEvent.key === 'Tab' && !keyboardEvent.ctrlKey && !keyboardEvent.altKey && !keyboardEvent.metaKey) return
    // Nothing else reaches the panel, the browser or the workspace's own shortcuts while recording.
    keyboardEvent.preventDefault()
    keyboardEvent.stopPropagation()
    if (keyboardEvent.key === 'Escape') {
      stopRecordingKeyBinding()
      setKeyBindingsAnnouncement(`${keyBinding.keyBindingActionLabel} is unchanged.`)
      return
    }
    const pressedKeyboardShortcut = readPapelizKeyboardShortcutFromEvent(keyboardEvent.nativeEvent)
    // A modifier on its own: wait for the rest.
    if (pressedKeyboardShortcut === null) return
    if (!doesPapelizKeyboardShortcutLeaveTypingFree(pressedKeyboardShortcut)) {
      setKeyBindingRefusalMessage(papelizKeyBindingTypingFreeHint)
      return
    }
    const conflictingActionLabel = findPapelizKeyBindingConflict(pressedKeyboardShortcut, keyBinding.papelizKeyBindingActionId, papelizKeyBindings)
    if (conflictingActionLabel !== null) {
      setKeyBindingRefusalMessage(`${conflictingActionLabel} already uses ${describePapelizKeyboardShortcut(pressedKeyboardShortcut)}.`)
      return
    }
    changeKeyBindingShortcut(keyBinding.papelizKeyBindingActionId, pressedKeyboardShortcut)
    stopRecordingKeyBinding()
    setKeyBindingsAnnouncement(`${keyBinding.keyBindingActionLabel} is now ${describePapelizKeyboardShortcut(pressedKeyboardShortcut)}.`)
  }

  return (
    <div>
      <p id={`${keyBindingsListIdPrefix}-help`} className="text-[12px] leading-[1.4] text-papeliz-ink-muted">
        Click a shortcut, then press the new keys. Changes save as you go.
      </p>

      <ul aria-describedby={`${keyBindingsListIdPrefix}-help`} className="mt-2.5 divide-y divide-papeliz-line rounded-xl border border-papeliz-line">
        {papelizKeyBindings.map((keyBinding) => {
          const { papelizKeyBindingActionId, keyBindingActionLabel, papelizKeyBindingDefaultShortcut, papelizKeyBindingUserShortcut } = keyBinding
          const isRecordingKeyBinding = recordingKeyBindingActionId === papelizKeyBindingActionId
          const keyBindingRowIdPrefix = `${keyBindingsListIdPrefix}-${papelizKeyBindingActionId}`
          const isKeyBindingRefusalShown = isRecordingKeyBinding && keyBindingRefusalMessage !== null
          return (
            <li key={papelizKeyBindingActionId} className="py-1.5 pr-1.5 pl-2.5">
              <div className="flex min-h-7 items-center gap-2">
                <span id={`${keyBindingRowIdPrefix}-label`} className="min-w-0 flex-1 text-[12.5px] leading-[1.3]">
                  {keyBindingActionLabel}
                </span>
                {papelizKeyBindingUserShortcut !== null && (
                  <button
                    type="button"
                    aria-label={`Reset ${keyBindingActionLabel}`}
                    title={`Back to ${describePapelizKeyboardShortcut(papelizKeyBindingDefaultShortcut)}`}
                    onClick={() => {
                      resetKeyBindingShortcut(papelizKeyBindingActionId)
                      setKeyBindingsAnnouncement(`${keyBindingActionLabel} is back to ${describePapelizKeyboardShortcut(papelizKeyBindingDefaultShortcut)}.`)
                    }}
                    className="flex-none text-[11.5px] font-medium text-papeliz-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue"
                  >
                    Reset
                  </button>
                )}
                <button
                  id={`${keyBindingRowIdPrefix}-chip`}
                  type="button"
                  aria-labelledby={`${keyBindingRowIdPrefix}-label ${keyBindingRowIdPrefix}-chip`}
                  aria-describedby={isKeyBindingRefusalShown ? `${keyBindingRowIdPrefix}-refusal` : undefined}
                  title={isRecordingKeyBinding ? 'Press the new keys, or Esc to cancel' : 'Change this shortcut'}
                  onClick={() => (isRecordingKeyBinding ? stopRecordingKeyBinding() : startRecordingKeyBinding(keyBinding))}
                  onKeyDown={(keyboardEvent) => {
                    if (isRecordingKeyBinding) recordPressedKeys(keyboardEvent, keyBinding)
                  }}
                  onBlur={() => {
                    if (isRecordingKeyBinding) stopRecordingKeyBinding()
                  }}
                  className={joinPapelizClassNames(
                    'inline-flex h-7 flex-none items-center justify-center rounded-lg border px-2 text-[11.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue pointer-coarse:h-9',
                    isRecordingKeyBinding
                      ? 'border-papeliz-blue bg-papeliz-blue-soft text-papeliz-blue'
                      : 'border-papeliz-line-strong bg-papeliz-surface-soft text-papeliz-ink hover:bg-papeliz-hover',
                  )}
                >
                  {isRecordingKeyBinding ? (
                    'Press the keys…'
                  ) : (
                    <kbd className="font-sans">{describePapelizKeyboardShortcut(papelizKeyBindingUserShortcut ?? papelizKeyBindingDefaultShortcut)}</kbd>
                  )}
                </button>
              </div>
              {isKeyBindingRefusalShown && (
                <p id={`${keyBindingRowIdPrefix}-refusal`} role="alert" className="mt-1 text-right text-[11.5px] text-papeliz-diff-removed-ink">
                  {keyBindingRefusalMessage}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {keyBindingsAnnouncement}
      </p>

      <PapelizPillButton
        pillButtonVariant="gray"
        pillButtonSize="small"
        disabled={!isAnyKeyBindingChanged}
        onClick={() => {
          stopRecordingKeyBinding()
          resetAllKeyBindingShortcuts()
          setKeyBindingsAnnouncement('Every shortcut is back to its default.')
        }}
        className="mt-2.5"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Reset All
      </PapelizPillButton>
    </div>
  )
}
