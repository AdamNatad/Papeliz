import { FileAudio, ImagePlus, Paperclip, Plus } from 'lucide-react'
import { useState } from 'react'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { usePapelizChatImagineStore } from './papeliz-assistant-chat-imagine-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { joinPapelizTranscribedWordsToText, type PapelizOnePressMicStore } from './papeliz-assistant-one-press-mic-controller'
import { usePapelizOnePressMic } from './papeliz-assistant-one-press-mic'

// The chat box's own media parts, in the panel and in Focus mode alike:
// - + opens a menu: add files or pictures, transcribe an audio file into the box, or make a picture of
//   what is typed (shown in the chat with Remove C2PA, Save to Vault and Put in Note);
// - the one-press mic (papeliz-assistant-one-press-mic.tsx) puts the words it hears after what is
//   typed, to send as it is or after a change.

// The menu's three rows (h-9) and its padding, so it can open above + before it is drawn.
const papelizComposerAddMenuHeight = 3 * 36 + 10

// The chat box's mic: the words join the draft, and the box takes focus to send them.
export function usePapelizComposerOnePressMic(focusComposerTextAtEnd: () => void): PapelizOnePressMicStore {
  return usePapelizOnePressMic((transcribedWords) => {
    const { composerDraftText, setComposerDraftText } = usePapelizAssistantConversationStore.getState()
    setComposerDraftText(joinPapelizTranscribedWordsToText(composerDraftText, transcribedWords))
    focusComposerTextAtEnd()
  })
}

interface PapelizAssistantComposerAddMenuProps {
  onAddFilesOrPictures: () => void
  onTranscribeAudioFile: () => void
  isAddMenuDisabled?: boolean
}

export function PapelizAssistantComposerAddMenu({ onAddFilesOrPictures, onTranscribeAudioFile, isAddMenuDisabled = false }: PapelizAssistantComposerAddMenuProps) {
  const composerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.composerDraftText)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const imagineInChat = usePapelizChatImagineStore((chatImagineState) => chatImagineState.imagineInChat)
  const [addMenuPosition, setAddMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)

  return (
    <>
      <button
        type="button"
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={addMenuPosition !== null}
        title="Add files or pictures (or paste or drop them here), transcribe an audio file, or imagine a picture"
        disabled={isAddMenuDisabled}
        onClick={(clickEvent) => {
          const addButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          // Above +, as the box sits at the bottom; the menu keeps itself inside the window.
          setAddMenuPosition({ menuAnchorLeft: addButtonRect.left, menuAnchorTop: addButtonRect.top - papelizComposerAddMenuHeight - 6 })
        }}
        className="mr-0.5 grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-40 aria-expanded:bg-papeliz-hover pointer-coarse:size-10"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
      {addMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Add"
          menuPosition={addMenuPosition}
          onMenuClose={() => setAddMenuPosition(null)}
          menuItems={[
            { menuItemKey: 'files-or-pictures', menuItemLabel: 'Add Files or Pictures', MenuItemIcon: Paperclip, onMenuItemSelect: onAddFilesOrPictures },
            { menuItemKey: 'audio-file', menuItemLabel: 'Transcribe an Audio File', MenuItemIcon: FileAudio, onMenuItemSelect: onTranscribeAudioFile },
            {
              menuItemKey: 'imagine',
              menuItemLabel: 'Imagine a Picture',
              MenuItemIcon: ImagePlus,
              // A picture of what is typed: nothing to picture until something is.
              isMenuItemDisabled: composerDraftText.trim().length === 0,
              onMenuItemSelect: () => {
                const imaginePromptText = composerDraftText
                setComposerDraftText('')
                void imagineInChat(imaginePromptText)
              },
            },
          ]}
        />
      )}
    </>
  )
}
