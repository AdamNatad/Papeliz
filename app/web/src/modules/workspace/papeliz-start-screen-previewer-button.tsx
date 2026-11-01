import { Eye } from 'lucide-react'
import { useState } from 'react'
import { returnPapelizSyncSyncedVaultsPageToLive, usePapelizSyncSyncedVaultsPagePreviewStore } from '../sync/papeliz-sync-synced-vaults-page-preview-store'
import { usePapelizSyncSyncedVaultsPagePreviewerMenuItems } from '../sync/papeliz-sync-synced-vaults-page-previewer-menu-items'
import { usePapelizTemplateGalleryPagePreviewerMenuItems } from '../template-gallery/papeliz-template-gallery-page-previewer-menu-items'
import { returnPapelizTemplateGalleryPageToLive, usePapelizTemplateGalleryPagePreviewStore } from '../template-gallery/papeliz-template-gallery-page-preview-store'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'

const papelizStartScreenPreviewerMenuWidth = 252

// The start screen's previewer: a small dark button floating at its bottom right, development builds
// only. Its menu holds Live, then each state of the Templates pages and of the Synced Vaults page; a
// pick opens that page in that state with made-up templates, or a made-up account and vaults, and a
// dot on the button says one is held. Holding one page puts the other back to live.
export function PapelizStartScreenPreviewerButton() {
  const heldSyncedVaultsPagePreview = usePapelizSyncSyncedVaultsPagePreviewStore((syncedVaultsPagePreviewState) => syncedVaultsPagePreviewState.heldSyncedVaultsPagePreview)
  const heldTemplateGalleryPagePreview = usePapelizTemplateGalleryPagePreviewStore((templateGalleryPagePreviewState) => templateGalleryPagePreviewState.heldTemplateGalleryPagePreview)
  const [startScreenPreviewerMenuPosition, setStartScreenPreviewerMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const templateGalleryPagePreviewerMenuItems = usePapelizTemplateGalleryPagePreviewerMenuItems(returnPapelizSyncSyncedVaultsPageToLive)
  const syncedVaultsPagePreviewerMenuItems = usePapelizSyncSyncedVaultsPagePreviewerMenuItems(returnPapelizTemplateGalleryPageToLive)
  const isStartScreenPreviewHeld = heldSyncedVaultsPagePreview !== null || heldTemplateGalleryPagePreview !== null

  const startScreenPreviewerMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'live',
      menuItemLabel: 'Live',
      MenuItemIcon: Eye,
      isMenuItemChecked: !isStartScreenPreviewHeld,
      onMenuItemSelect: () => {
        returnPapelizSyncSyncedVaultsPageToLive()
        returnPapelizTemplateGalleryPageToLive()
      },
    },
    ...templateGalleryPagePreviewerMenuItems,
    ...syncedVaultsPagePreviewerMenuItems,
  ]

  return (
    <>
      <button
        type="button"
        aria-label="Preview start screen states"
        title="Preview start screen states (development builds only)"
        aria-haspopup="menu"
        aria-expanded={startScreenPreviewerMenuPosition !== null}
        data-papeliz-start-screen-preview={heldTemplateGalleryPagePreview?.templateGalleryPagePreviewChoiceKey ?? heldSyncedVaultsPagePreview?.syncedVaultsPagePreviewChoiceKey ?? 'live'}
        onClick={(clickEvent) => {
          // The menu opens to the button's left, as low as it fits.
          const previewerButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setStartScreenPreviewerMenuPosition({
            menuAnchorLeft: previewerButtonRect.left - papelizStartScreenPreviewerMenuWidth - 8,
            menuAnchorTop: previewerButtonRect.bottom,
          })
        }}
        className="fixed right-4 bottom-4 z-40 grid size-9 place-items-center rounded-lg border border-[#0A2552] bg-[#0E3270] text-white shadow-papeliz-pop transition-[background-color,transform] duration-150 hover:bg-[#123C85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue active:scale-[0.94]"
      >
        <Eye className="size-[17px]" aria-hidden="true" />
        {isStartScreenPreviewHeld && <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-papeliz-surface bg-[#F2B53A]" />}
      </button>
      {startScreenPreviewerMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Preview start screen states"
          menuPosition={startScreenPreviewerMenuPosition}
          menuItems={startScreenPreviewerMenuItems}
          onMenuClose={() => setStartScreenPreviewerMenuPosition(null)}
        />
      )}
    </>
  )
}
