import { CopyPlus, Lock, LockOpen, Pencil, Share, SquareMenu, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { PapelizConfirmDialog } from '../../web/src/modules/ui/papeliz-confirm-dialog'
import { getVaultNoteTitle } from '../../web/src/modules/vault/papeliz-vault-relative-paths'
import { findLockingVaultEntry } from '../../web/src/modules/workspace/papeliz-vault-entry-locks'
import { PapelizSettingsGearExportPage } from '../../web/src/modules/workspace/papeliz-settings-gear-export-page'
import { usePapelizWorkspaceStore } from '../../web/src/modules/workspace/papeliz-workspace-store'
import { usePapelizMobileBackStep } from './papeliz-mobile-back-steps'

interface PapelizMobileNoteMoreMenuProps {
  vaultNoteRelativePath: string
  // Rename happens in the file list, where the name is edited in place.
  onRenameInFileList: () => void
}

// More (the square menu) at the top bar's end, on Note: Export first, the web's own Export page in a
// sheet, then what the file list's menu does to the open note.
export function PapelizMobileNoteMoreMenu({ vaultNoteRelativePath, onRenameInFileList }: PapelizMobileNoteMoreMenuProps) {
  const [isMoreMenuOpen, setMoreMenuOpen] = useState(false)
  const [isExportSheetOpen, setExportSheetOpen] = useState(false)
  const [isMoveToTrashConfirmationShown, setMoveToTrashConfirmationShown] = useState(false)
  const lockedVaultEntryRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.lockedVaultEntryRelativePaths)
  const revealVaultEntryInFileList = usePapelizWorkspaceStore((workspaceState) => workspaceState.revealVaultEntryInFileList)
  const startRenamingVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.startRenamingVaultEntry)
  const setVaultEntryEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultEntryEditingLocked)
  const duplicateVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.duplicateVaultEntry)
  const moveVaultEntryToTrash = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultEntryToTrash)

  // Back closes what is open here first: the menu, the Export sheet or the Move to Trash question.
  usePapelizMobileBackStep(isMoreMenuOpen, () => setMoreMenuOpen(false))
  usePapelizMobileBackStep(isExportSheetOpen, () => setExportSheetOpen(false))
  usePapelizMobileBackStep(isMoveToTrashConfirmationShown, () => setMoveToTrashConfirmationShown(false))

  // Only the note's own lock is changed here; a lock on a folder above it stays the file list's.
  const isNoteItselfLocked = findLockingVaultEntry(lockedVaultEntryRelativePaths, vaultNoteRelativePath) === vaultNoteRelativePath

  const chooseMoreMenuItem = (moreMenuItemAction: () => void) => {
    setMoreMenuOpen(false)
    moreMenuItemAction()
  }

  return (
    <>
      <button
        type="button"
        className="papeliz-mobile-top-bar-button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={isMoreMenuOpen}
        onClick={() => setMoreMenuOpen(!isMoreMenuOpen)}
      >
        <span className="papeliz-mobile-top-bar-frosted-square">
          <SquareMenu aria-hidden="true" />
        </span>
      </button>

      {/* Drawn inside the blue top bar, so what opens from it takes the page's own ink, not the bar's white. */}
      <span className="papeliz-mobile-top-bar-overlays">
        {isMoreMenuOpen && (
          <>
            <div className="papeliz-mobile-menu-backdrop" onClick={() => setMoreMenuOpen(false)} />
            <div role="menu" aria-label="More" className="papeliz-mobile-more-menu">
              <p className="papeliz-mobile-more-menu-title">{getVaultNoteTitle(vaultNoteRelativePath)}</p>
              <button type="button" role="menuitem" className="papeliz-mobile-more-menu-item is-export" onClick={() => chooseMoreMenuItem(() => setExportSheetOpen(true))}>
                <Share aria-hidden="true" />
                Export…
              </button>
              <hr className="papeliz-mobile-more-menu-divider" />
              <button
                type="button"
                role="menuitem"
                className="papeliz-mobile-more-menu-item"
                onClick={() =>
                  chooseMoreMenuItem(() => {
                    onRenameInFileList()
                    revealVaultEntryInFileList(vaultNoteRelativePath, 'note')
                    startRenamingVaultEntry(vaultNoteRelativePath)
                  })
                }
              >
                <Pencil aria-hidden="true" />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className="papeliz-mobile-more-menu-item"
                onClick={() => chooseMoreMenuItem(() => setVaultEntryEditingLocked(vaultNoteRelativePath, !isNoteItselfLocked))}
              >
                {isNoteItselfLocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
                {isNoteItselfLocked ? 'Unlock Editing' : 'Lock Editing'}
              </button>
              <button type="button" role="menuitem" className="papeliz-mobile-more-menu-item" onClick={() => chooseMoreMenuItem(() => void duplicateVaultEntry(vaultNoteRelativePath))}>
                <CopyPlus aria-hidden="true" />
                Duplicate
              </button>
              <hr className="papeliz-mobile-more-menu-divider" />
              <button type="button" role="menuitem" className="papeliz-mobile-more-menu-item is-danger" onClick={() => chooseMoreMenuItem(() => setMoveToTrashConfirmationShown(true))}>
                <Trash2 aria-hidden="true" />
                Move to Trash
              </button>
            </div>
          </>
        )}
  
        {isExportSheetOpen && (
          <>
            <div className="papeliz-mobile-sheet-backdrop" onClick={() => setExportSheetOpen(false)} />
            <section role="dialog" aria-label="Export" className="papeliz-mobile-sheet">
              <header className="papeliz-mobile-sheet-head">
                <b>Export</b>
                <button type="button" className="papeliz-mobile-sheet-close" aria-label="Close Export" onClick={() => setExportSheetOpen(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="papeliz-mobile-sheet-body">
                <PapelizSettingsGearExportPage />
              </div>
            </section>
          </>
        )}
  
        {isMoveToTrashConfirmationShown && (
          <PapelizConfirmDialog
            confirmDialogTitle="Move to Trash?"
            confirmDialogBody={
              <p>
                “{getVaultNoteTitle(vaultNoteRelativePath)}” moves into this vault’s <code>.trash</code> folder. Nothing is erased.
              </p>
            }
            confirmButtonLabel="Move to Trash"
            onCancel={() => setMoveToTrashConfirmationShown(false)}
            onConfirm={() => {
              setMoveToTrashConfirmationShown(false)
              void moveVaultEntryToTrash(vaultNoteRelativePath)
            }}
          />
        )}
      </span>
    </>
  )
}
