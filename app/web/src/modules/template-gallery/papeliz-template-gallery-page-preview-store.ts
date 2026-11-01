import { create, type StoreApi } from 'zustand'
import type { PapelizTemplateGalleryScreen } from './papeliz-template-gallery-page'
import type { PapelizTemplateGalleryScreenModel } from './papeliz-template-gallery-page-parts'

// What the Templates pages show while the start screen's previewer (development builds only,
// papeliz-template-gallery-page-previewer-menu-items.ts) holds one of their states: the page to open
// on, and a made-up gallery standing in for the gallery store, with its own templates, files and
// answers. Nothing else sets it, so outside development builds it stays null and the pages are always
// live.
export interface PapelizTemplateGalleryPagePreview {
  // Each pick starts the pages over.
  templateGalleryPagePreviewNumber: number
  templateGalleryPagePreviewChoiceKey: string
  // The pages open on the last one; Back goes through the ones before it.
  previewTemplateGalleryScreens: readonly PapelizTemplateGalleryScreen[]
  previewTemplateGalleryModelStore: StoreApi<PapelizTemplateGalleryScreenModel>
}

interface PapelizTemplateGalleryPagePreviewState {
  heldTemplateGalleryPagePreview: PapelizTemplateGalleryPagePreview | null
}

export const usePapelizTemplateGalleryPagePreviewStore = create<PapelizTemplateGalleryPagePreviewState>()(() => ({
  heldTemplateGalleryPagePreview: null,
}))

export function returnPapelizTemplateGalleryPageToLive(): void {
  usePapelizTemplateGalleryPagePreviewStore.setState({ heldTemplateGalleryPagePreview: null })
}
