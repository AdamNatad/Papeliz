import { Keyboard, RotateCcw, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
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

interface PapelizKeyBindingsDialogProps {
  onKeyBindingsDialogClose: () => void
}

const papelizKeyBindingTypingFreeHint = isPapelizMacKeyboard ? 'Hold ⌘, ⌃ or ⌥ too, so typing still works.' : 'Hold Ctrl or Alt too, so typing still works.'

// Accessibility > Key Bindings: each shortcut that can change, on a key chip. Click a chip (or press
// Enter on it), then press the new keys; Esc stops without a change. Keys another action already
// uses are refused, naming it. Changes save as they happen, so Done only closes.
export function PapelizKeyBindingsDialog({ onKeyBindingsDialogClose }: PapelizKeyBindingsDialogProps) {
  const keyBindingsDialogRef = useRef<HTMLDialogElement>(null)
  const keyBindingsDialogIdPrefix = useId()
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

  useEffect(() => {
    const keyBindingsDialogElement = keyBindingsDialogRef.current
    if (keyBindingsDialogElement === null) return
    const focusedBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
    keyBindingsDialogElement.showModal()
    return () => {
      keyBindingsDialogElement.close()
      if (focusedBeforeDialog?.isConnected) focusedBeforeDialog.focus()
    }
  }, [])

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
    // Nothing else reaches the dialog, the browser or the workspace's own shortcuts while recording.
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
    <dialog
      ref={keyBindingsDialogRef}
      aria-labelledby={`${keyBindingsDialogIdPrefix}-title`}
      aria-describedby={`${keyBindingsDialogIdPrefix}-help`}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        if (recordingKeyBindingActionId !== null) stopRecordingKeyBinding()
        else onKeyBindingsDialogClose()
      }}
      // Esc belongs to the dialog here, not to the workspace (which would also leave focus mode).
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Escape') keyboardEvent.stopPropagation()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === keyBindingsDialogRef.current) onKeyBindingsDialogClose()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
            <Keyboard className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${keyBindingsDialogIdPrefix}-title`} className="text-lg font-semibold">
              Key Bindings
            </h2>
            <p id={`${keyBindingsDialogIdPrefix}-help`} className="text-sm text-papeliz-ink-muted">
              Click a shortcut, then press the new keys. Changes save as you go.
            </p>
          </div>
          <PapelizIconButton iconButtonLabel="Close" iconButtonSize="small" onClick={onKeyBindingsDialogClose}>
            <X className="size-4" aria-hidden="true" />
          </PapelizIconButton>
        </div>

        <ul className="mt-5 divide-y divide-papeliz-line rounded-2xl border border-papeliz-line">
          {papelizKeyBindings.map((keyBinding) => {
            const { papelizKeyBindingActionId, keyBindingActionLabel, papelizKeyBindingDefaultShortcut, papelizKeyBindingUserShortcut } = keyBinding
            const isRecordingKeyBinding = recordingKeyBindingActionId === papelizKeyBindingActionId
            const keyBindingRowIdPrefix = `${keyBindingsDialogIdPrefix}-${papelizKeyBindingActionId}`
            const isKeyBindingRefusalShown = isRecordingKeyBinding && keyBindingRefusalMessage !== null
            return (
              <li key={papelizKeyBindingActionId} className="px-4 py-2.5">
                <div className="flex min-h-8 items-center gap-3">
                  <span id={`${keyBindingRowIdPrefix}-label`} className="min-w-0 flex-1 text-sm">
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
                      className="flex-none text-[12.5px] font-medium text-papeliz-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue"
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
                      'inline-flex h-8 min-w-[84px] flex-none items-center justify-center rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue',
                      isRecordingKeyBinding
                        ? 'border-papeliz-blue bg-papeliz-blue-soft text-papeliz-blue'
                        : 'border-papeliz-line-strong bg-papeliz-surface-soft text-papeliz-ink hover:bg-papeliz-hover',
                    )}
                  >
                    {isRecordingKeyBinding ? (
                      'Press the new keys…'
                    ) : (
                      <kbd className="font-sans">{describePapelizKeyboardShortcut(papelizKeyBindingUserShortcut ?? papelizKeyBindingDefaultShortcut)}</kbd>
                    )}
                  </button>
                </div>
                {isKeyBindingRefusalShown && (
                  <p id={`${keyBindingRowIdPrefix}-refusal`} role="alert" className="mt-1.5 text-right text-[12.5px] text-papeliz-diff-removed-ink">
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

        <div className="mt-6 flex items-center gap-2">
          <PapelizPillButton
            pillButtonVariant="gray"
            disabled={!isAnyKeyBindingChanged}
            onClick={() => {
              stopRecordingKeyBinding()
              resetAllKeyBindingShortcuts()
              setKeyBindingsAnnouncement('Every shortcut is back to its default.')
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset All
          </PapelizPillButton>
          <PapelizPillButton pillButtonVariant="primary" className="ml-auto" onClick={onKeyBindingsDialogClose}>
            Done
          </PapelizPillButton>
        </div>
      </div>
    </dialog>
  )
}
