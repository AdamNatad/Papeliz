import { ArrowUp, FileAudio, Plus, Square } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { PapelizAssistantContextWindowRing } from './papeliz-assistant-context-window-gauge'
import {
  PapelizOnePressMicAudioFileInput,
  PapelizOnePressMicButton,
  PapelizOnePressMicProblemLine,
  PapelizOnePressMicRecorderRow,
  handlePapelizOnePressMicKey,
  useIsPapelizOnePressMicBusy,
} from './papeliz-assistant-one-press-mic'
import type { PapelizOnePressMicStore } from './papeliz-assistant-one-press-mic-controller'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import type { PapelizChatSessionTokenUsage } from './papeliz-assistant-token-usage'

// The box Imagine's Ask and Draw share, laid out as the chat box is: the text on top, then one quiet
// row with + (a menu that always ends with Transcribe an Audio File), the context ring for a section
// that talks with a chat model (Ask), the section's own chips, the one-press mic and a round Send. Enter sends, Shift+Enter starts a new line. One press on the mic
// turns the row into the recorder (papeliz-assistant-one-press-mic.tsx), and the words land after
// what is typed.

// The quiet buttons along the bottom of the box, as in the chat box; on a touch screen at least 40px
// each way, for a finger.
export const papelizImagineBoxQuietButtonClassName =
  'flex h-7 min-w-0 flex-none items-center gap-1 rounded-lg px-1.5 text-[12.5px] text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:bg-papeliz-hover pointer-coarse:h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center'

// The popover menu's rows (h-9), a group heading with its line, and its padding, so a menu that opens
// above its button can be placed before it is drawn.
const papelizImagineBoxMenuRowHeight = 36
const papelizImagineBoxMenuGroupHeadingHeight = 30
const papelizImagineBoxMenuFrameHeight = 10

function measurePapelizImagineBoxMenuHeight(menuItems: readonly PapelizPopoverMenuItem[]): number {
  const menuGroupHeadingCount = menuItems.filter((menuItem) => menuItem.menuItemGroupHeading !== undefined).length
  return menuItems.length * papelizImagineBoxMenuRowHeight + menuGroupHeadingCount * papelizImagineBoxMenuGroupHeadingHeight + papelizImagineBoxMenuFrameHeight
}

function placePapelizImagineBoxMenuAbove(clickEvent: MouseEvent<HTMLButtonElement>, menuItems: readonly PapelizPopoverMenuItem[]): PapelizPopoverMenuPosition {
  const menuButtonRect = clickEvent.currentTarget.getBoundingClientRect()
  // Above the button, as the box sits at the bottom; the menu keeps itself inside the window.
  return { menuAnchorLeft: menuButtonRect.left, menuAnchorTop: menuButtonRect.top - measurePapelizImagineBoxMenuHeight(menuItems) - 6 }
}

interface PapelizImagineBoxMenuButtonProps {
  menuLabel: string
  menuItems: readonly PapelizPopoverMenuItem[]
  menuButtonAriaLabel: string
  menuButtonTitle: string
  menuButtonClassName?: string
  children: ReactNode
}

// A chip in the box's row that opens its menu above itself.
export function PapelizImagineBoxMenuButton({ menuLabel, menuItems, menuButtonAriaLabel, menuButtonTitle, menuButtonClassName, children }: PapelizImagineBoxMenuButtonProps) {
  const [menuPosition, setMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuPosition !== null}
        aria-label={menuButtonAriaLabel}
        title={menuButtonTitle}
        onClick={(clickEvent) => setMenuPosition(placePapelizImagineBoxMenuAbove(clickEvent, menuItems))}
        className={joinPapelizClassNames(papelizImagineBoxQuietButtonClassName, menuButtonClassName)}
      >
        {children}
      </button>
      {menuPosition !== null && <PapelizPopoverMenu menuLabel={menuLabel} menuPosition={menuPosition} menuItems={menuItems} onMenuClose={() => setMenuPosition(null)} />}
    </>
  )
}

export function PapelizImagineBoxSendButton({ sendButtonTitle, isSendDisabled, onSend }: { sendButtonTitle: string; isSendDisabled: boolean; onSend: () => void }) {
  return (
    <button
      type="button"
      aria-label="Send"
      title={sendButtonTitle}
      disabled={isSendDisabled}
      onClick={onSend}
      className="ml-1 grid size-8 flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity,background-color] hover:brightness-95 active:scale-90 disabled:opacity-40 pointer-coarse:size-10"
    >
      <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}

export function PapelizImagineBoxStopButton({ stopButtonTitle, onStop }: { stopButtonTitle: string; onStop: () => void }) {
  return (
    <button
      type="button"
      aria-label="Stop"
      title={stopButtonTitle}
      onClick={onStop}
      className="ml-1 grid size-8 flex-none place-items-center rounded-full bg-papeliz-ink text-papeliz-surface transition-transform active:scale-90 pointer-coarse:size-10"
    >
      <Square className="size-3.5 fill-current" aria-hidden="true" />
    </button>
  )
}

interface PapelizImagineBoxProps {
  boxTextAreaRef: RefObject<HTMLTextAreaElement | null>
  boxText: string
  boxTextLabel: string
  boxPlaceholder: string
  onBoxTextChange: (boxText: string) => void
  // Enter, unless the mic is busy; the section decides whether anything goes.
  onBoxSend: () => void
  // A pasted picture, for a box that takes pictures.
  onBoxPictureFilesPaste?: (pictureFiles: File[]) => void
  // A line inside the card above the text, such as the way to choose a provider.
  boxNotice?: ReactNode
  // + menu's own rows, before Transcribe an Audio File.
  boxAddMenuItems: readonly PapelizPopoverMenuItem[]
  boxAddButtonTitle: string
  audioFileInputLabel: string
  // The talk's tokens, for the context ring beside the chips; left out where no chat model answers.
  boxContextTokenUsage?: PapelizChatSessionTokenUsage | undefined
  // The chips between + and the mic.
  boxChips?: ReactNode
  onePressMicStore: PapelizOnePressMicStore
  // In place of recording, before there is anything to send the words to.
  onMicPressInstead?: (() => void) | undefined
  // Send or Stop. While the mic is busy they stay in place, held, so ✓ lands on the mic's own spot.
  boxSendControls: ReactNode
  // Lit while a picture is dragged over the section.
  isBoxLit?: boolean
}

export function PapelizImagineBox({
  boxTextAreaRef,
  boxText,
  boxTextLabel,
  boxPlaceholder,
  onBoxTextChange,
  onBoxSend,
  onBoxPictureFilesPaste,
  boxNotice,
  boxAddMenuItems,
  boxAddButtonTitle,
  audioFileInputLabel,
  boxContextTokenUsage,
  boxChips,
  onePressMicStore,
  onMicPressInstead,
  boxSendControls,
  isBoxLit = false,
}: PapelizImagineBoxProps) {
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const isMicBusy = useIsPapelizOnePressMicBusy(onePressMicStore)
  const audioFileInputRef = useRef<HTMLInputElement>(null)
  const [addMenuPosition, setAddMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  // The strip along the box's top edge where the context ring's card opens.
  const [imagineBoxTopEdgeStripElement, setImagineBoxTopEdgeStripElement] = useState<HTMLDivElement | null>(null)
  const addMenuItems: PapelizPopoverMenuItem[] = [
    ...boxAddMenuItems,
    { menuItemKey: 'audio-file', menuItemLabel: 'Transcribe an Audio File', MenuItemIcon: FileAudio, onMenuItemSelect: () => audioFileInputRef.current?.click() },
  ]

  useEffect(() => {
    // The text grows with what is typed, up to a few lines.
    const boxTextArea = boxTextAreaRef.current
    if (boxTextArea === null) return
    boxTextArea.style.height = 'auto'
    boxTextArea.style.height = `${Math.min(boxTextArea.scrollHeight, 160)}px`
  }, [boxText, boxTextAreaRef])

  return (
    <div className="flex-none px-3.5 pb-2">
      <div ref={setImagineBoxTopEdgeStripElement} className="relative z-30 h-0" />
      <div
        // While the mic records, Enter finishes and Esc throws the recording away, wherever focus is.
        onKeyDown={(keyboardEvent) => void handlePapelizOnePressMicKey(keyboardEvent, onePressMicStore)}
        className={joinPapelizClassNames(
          'rounded-[20px] border border-papeliz-line-strong bg-papeliz-surface pt-2.5 pr-2 pb-2 pl-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_4px_var(--color-papeliz-blue-soft)]',
          (isBoxLit || isMicBusy) && 'border-papeliz-blue-line shadow-[0_0_0_4px_var(--color-papeliz-blue-soft)]',
        )}
      >
        {boxNotice}
        <textarea
          ref={boxTextAreaRef}
          rows={1}
          value={boxText}
          aria-label={boxTextLabel}
          placeholder={boxPlaceholder}
          onChange={(changeEvent) => onBoxTextChange(changeEvent.target.value)}
          onPaste={(pasteEvent) => {
            if (onBoxPictureFilesPaste === undefined || pasteEvent.clipboardData.files.length === 0) return
            pasteEvent.preventDefault()
            onBoxPictureFilesPaste([...pasteEvent.clipboardData.files])
          }}
          // What is typed stays in view while the mic records; the words then land after it.
          readOnly={isMicBusy}
          onKeyDown={(keyboardEvent) => {
            // While the mic is busy, Enter and Esc belong to it (the box's own key handler, above).
            if (isMicBusy) return
            if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey && !keyboardEvent.nativeEvent.isComposing) {
              keyboardEvent.preventDefault()
              onBoxSend()
            }
          }}
          className="block min-h-6 w-full resize-none bg-transparent text-[14.5px] leading-normal text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle"
        />
        <div className="@container mt-1.5 flex min-w-0 items-center gap-0.5">
          {isMicBusy ? (
            <PapelizOnePressMicRecorderRow onePressMicStore={onePressMicStore} trailingControls={boxSendControls} />
          ) : (
            <>
              <button
                type="button"
                aria-label="Add"
                aria-haspopup="menu"
                aria-expanded={addMenuPosition !== null}
                title={boxAddButtonTitle}
                onClick={(clickEvent) => setAddMenuPosition(placePapelizImagineBoxMenuAbove(clickEvent, addMenuItems))}
                className="mr-0.5 grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:bg-papeliz-hover pointer-coarse:size-10"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-1 flex-1" />
              {boxContextTokenUsage !== undefined && (
                <PapelizAssistantContextWindowRing
                  contextTokenCount={boxContextTokenUsage.chatSessionContextTokenCount}
                  isContextTokenCountEstimated={boxContextTokenUsage.isChatSessionContextTokenCountEstimated}
                  conversationTokenUsageTally={boxContextTokenUsage.chatSessionTokenUsageTally}
                  conversationModelTokenUsageTallies={boxContextTokenUsage.chatSessionModelTokenUsageTallies}
                  contextWindowCardHostElement={imagineBoxTopEdgeStripElement}
                />
              )}
              {boxChips}
              <PapelizOnePressMicButton onePressMicStore={onePressMicStore} onMicPressInstead={onMicPressInstead} />
              {boxSendControls}
            </>
          )}
        </div>
        {addMenuPosition !== null && <PapelizPopoverMenu menuLabel="Add" menuPosition={addMenuPosition} menuItems={addMenuItems} onMenuClose={() => setAddMenuPosition(null)} />}
      </div>
      <PapelizOnePressMicAudioFileInput onePressMicStore={onePressMicStore} audioFileInputRef={audioFileInputRef} audioFileInputLabel={audioFileInputLabel} />
      <PapelizOnePressMicProblemLine
        onePressMicStore={onePressMicStore}
        onBringAudioFile={() => audioFileInputRef.current?.click()}
        onChooseProvider={() => requestAssistantProviderSettingsPage()}
        className="mt-1.5 px-2"
      />
    </div>
  )
}

// The line inside a box before it can send: what is missing, and the button that fixes it.
export function PapelizImagineBoxNotice({ boxNoticeIcon, boxNoticeText, boxNoticeAction }: { boxNoticeIcon: ReactNode; boxNoticeText: string; boxNoticeAction: ReactNode }) {
  return (
    <div className="mb-2 -ml-1.5 flex items-center gap-2 rounded-2xl bg-papeliz-blue-soft py-1.5 pr-1.5 pl-2.5 text-[13px] leading-snug text-papeliz-ink-muted">
      {boxNoticeIcon}
      <span className="min-w-0 flex-1">{boxNoticeText}</span>
      {boxNoticeAction}
    </div>
  )
}
