import { Images, MessageCircleQuestion, Paintbrush, type LucideIcon } from 'lucide-react'
import { create } from 'zustand'

// The Imagine view's three sections, chosen with the switch at its top: Ask (talk a picture through
// with the chat model before it is drawn), Draw (prompts and the pictures they make) and Gallery
// (every picture). Their names live only here, so a rename touches this list and nothing else.

export type PapelizImagineSection = 'ask' | 'draw' | 'gallery'

export const papelizImagineSectionChoices: ReadonlyArray<{ imagineSection: PapelizImagineSection; imagineSectionLabel: string; ImagineSectionIcon: LucideIcon }> = [
  { imagineSection: 'ask', imagineSectionLabel: 'Ask', ImagineSectionIcon: MessageCircleQuestion },
  { imagineSection: 'draw', imagineSectionLabel: 'Draw', ImagineSectionIcon: Paintbrush },
  { imagineSection: 'gallery', imagineSectionLabel: 'Gallery', ImagineSectionIcon: Images },
]

export function readPapelizImagineSectionLabel(imagineSection: PapelizImagineSection): string {
  return papelizImagineSectionChoices.find((imagineSectionChoice) => imagineSectionChoice.imagineSection === imagineSection)?.imagineSectionLabel ?? imagineSection
}

interface PapelizImagineSectionState {
  // Opens on Draw, and stays where it was left while the page is open.
  chosenImagineSection: PapelizImagineSection
  // A Draw entry brought into view and marked for a moment (Show in Draw, from Gallery); Draw clears it.
  drawThreadEntryIdToShow: string | null
  // The Draw box takes focus once it shows (Draw This, from Ask).
  isDrawBoxFocusPending: boolean
  chooseImagineSection: (imagineSection: PapelizImagineSection) => void
  showDrawThreadEntry: (imagineThreadEntryId: string) => void
  finishShowingDrawThreadEntry: () => void
  openDrawWithBoxFocused: () => void
  finishFocusingDrawBox: () => void
}

export const usePapelizImagineSectionStore = create<PapelizImagineSectionState>()((setImagineSectionState) => ({
  chosenImagineSection: 'draw',
  drawThreadEntryIdToShow: null,
  isDrawBoxFocusPending: false,
  // Leaving Draw drops an entry still waiting to be shown there.
  chooseImagineSection: (chosenImagineSection) =>
    setImagineSectionState(chosenImagineSection === 'draw' ? { chosenImagineSection } : { chosenImagineSection, drawThreadEntryIdToShow: null }),
  showDrawThreadEntry: (drawThreadEntryIdToShow) => setImagineSectionState({ chosenImagineSection: 'draw', drawThreadEntryIdToShow }),
  finishShowingDrawThreadEntry: () => setImagineSectionState({ drawThreadEntryIdToShow: null }),
  openDrawWithBoxFocused: () => setImagineSectionState({ chosenImagineSection: 'draw', isDrawBoxFocusPending: true }),
  finishFocusingDrawBox: () => setImagineSectionState({ isDrawBoxFocusPending: false }),
}))
