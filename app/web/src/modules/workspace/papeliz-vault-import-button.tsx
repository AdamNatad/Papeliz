import { FileArchive, Files, Folder, Import, LayoutTemplate } from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { PapelizImportZipError, papelizImportZipMostTotalByteCount } from '../export-zip/papeliz-import-zip-file-reader'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import {
  papelizImportedFilesVaultFolderName,
  planPapelizVaultFolderImportFromFiles,
  planPapelizVaultFolderImportFromZip,
  type PapelizVaultFolderImportPlan,
} from '../vault/papeliz-vault-folder-import'
import { PapelizFileListHeaderSolidButton } from './papeliz-file-list-header-solid-button'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// The template gallery loads only when Import from Template is chosen, as on the start screen.
const PapelizTemplateGalleryPage = lazy(() =>
  import('../template-gallery/papeliz-template-gallery-page').then((templateGalleryPageModule) => ({ default: templateGalleryPageModule.PapelizTemplateGalleryPage })),
)

// Import, beside New in the file list's header: Import from Files, Import from Folder, Import from Zip
// and Import from Template. Files and Folder open the browser's own window straight away, one for
// files and one for a folder, since no browser window picks both. Each brings what it imports into its
// own new folder at the vault's top (papeliz-vault-folder-import.ts), never over anything already
// there: a picked folder under its own name, loose files under "Imported Files", a zip under its name
// without ".zip", a template under its name, or the next free name ("Imported Files 2"). The folder
// then shows, open, in the file list, and is an ordinary folder to rename or move.
export function PapelizVaultImportButton() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const importIntoNewVaultFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.importIntoNewVaultFolder)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const vaultImportButtonRef = useRef<HTMLButtonElement>(null)
  const pickedFilesInputRef = useRef<HTMLInputElement>(null)
  const pickedFolderInputRef = useRef<HTMLInputElement>(null)
  const pickedZipInputRef = useRef<HTMLInputElement>(null)
  const [vaultImportMenuPosition, setVaultImportMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const [isTemplateImportDialogShown, setTemplateImportDialogShown] = useState(false)
  const [isVaultImportRunning, setVaultImportRunning] = useState(false)

  // The folder picker reads a whole folder: an attribute React doesn't type.
  useEffect(() => {
    pickedFolderInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  if (openVault === null) return null

  // Plans the import, writes it into its new folder, and says what came in.
  const importIntoNewFolder = async (importSourceName: string, planVaultFolderImport: () => Promise<PapelizVaultFolderImportPlan>) => {
    setVaultImportRunning(true)
    try {
      let vaultFolderImportPlan: PapelizVaultFolderImportPlan
      try {
        vaultFolderImportPlan = await planVaultFolderImport()
      } catch (vaultFolderImportPlanError) {
        showWorkspaceNotice('error', describePapelizFailureMessage(`Couldn’t import “${importSourceName}”`, vaultFolderImportPlanError))
        return
      }
      if (vaultFolderImportPlan.importFileCount === 0) {
        showWorkspaceNotice('info', `“${importSourceName}” has no files Papeliz imports.`)
        return
      }
      const vaultFolderImportResult = await importIntoNewVaultFolder(vaultFolderImportPlan)
      if (vaultFolderImportResult.vaultFolderImportOutcome === 'failed') {
        showWorkspaceNotice('error', vaultFolderImportResult.vaultFolderImportFailureMessage)
        return
      }
      const { importedFileCount, importedVaultFolderRelativePath } = vaultFolderImportResult
      const leftOutSentence =
        vaultFolderImportPlan.skippedImportFileCount === 0
          ? ''
          : ` ${vaultFolderImportPlan.skippedImportFileCount} left out: Git’s folder, system leftovers, or another vault’s own Papeliz folders.`
      showWorkspaceNotice('info', `Imported ${importedFileCount === 1 ? '1 file' : `${importedFileCount.toLocaleString('en-US')} files`} into “${importedVaultFolderRelativePath}”.${leftOutSentence}`)
    } finally {
      setVaultImportRunning(false)
    }
  }

  const takePickedFiles = (changeEvent: ChangeEvent<HTMLInputElement>): File[] => {
    const pickedFiles = [...(changeEvent.target.files ?? [])]
    changeEvent.target.value = ''
    return pickedFiles
  }

  const vaultImportMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'import-from-files',
      menuItemLabel: 'Import from Files',
      MenuItemIcon: Files,
      onMenuItemSelect: () => pickedFilesInputRef.current?.click(),
    },
    {
      menuItemKey: 'import-from-folder',
      menuItemLabel: 'Import from Folder',
      MenuItemIcon: Folder,
      onMenuItemSelect: () => pickedFolderInputRef.current?.click(),
    },
    {
      menuItemKey: 'import-from-zip',
      menuItemLabel: 'Import from Zip',
      MenuItemIcon: FileArchive,
      onMenuItemSelect: () => pickedZipInputRef.current?.click(),
    },
    {
      menuItemKey: 'import-from-template',
      menuItemLabel: 'Import from Template',
      MenuItemIcon: LayoutTemplate,
      onMenuItemSelect: () => setTemplateImportDialogShown(true),
    },
  ]

  return (
    <>
      <PapelizFileListHeaderSolidButton
        ref={vaultImportButtonRef}
        fileListHeaderSolidButtonLabel="Import"
        aria-haspopup="menu"
        aria-expanded={vaultImportMenuPosition !== null}
        aria-busy={isVaultImportRunning || undefined}
        disabled={isVaultImportRunning}
        onClick={() => {
          const vaultImportButtonRect = vaultImportButtonRef.current?.getBoundingClientRect()
          setVaultImportMenuPosition({ menuAnchorLeft: vaultImportButtonRect?.left ?? 16, menuAnchorTop: (vaultImportButtonRect?.bottom ?? 48) + 4 })
        }}
      >
        <Import className="size-[15px]" aria-hidden="true" />
      </PapelizFileListHeaderSolidButton>

      <input
        ref={pickedFilesInputRef}
        type="file"
        multiple
        hidden
        aria-label="Files to import"
        onChange={(changeEvent) => {
          const pickedFiles = takePickedFiles(changeEvent)
          if (pickedFiles.length > 0) void importIntoNewFolder(papelizImportedFilesVaultFolderName, async () => planPapelizVaultFolderImportFromFiles(pickedFiles))
        }}
      />
      <input
        ref={pickedFolderInputRef}
        type="file"
        hidden
        aria-label="Folder to import"
        onChange={(changeEvent) => {
          const pickedFiles = takePickedFiles(changeEvent)
          const pickedFolderName = pickedFiles[0]?.webkitRelativePath.split('/')[0] ?? 'the folder'
          if (pickedFiles.length > 0) void importIntoNewFolder(pickedFolderName, async () => planPapelizVaultFolderImportFromFiles(pickedFiles))
        }}
      />
      <input
        ref={pickedZipInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        aria-label="Zip to import"
        onChange={(changeEvent) => {
          const [pickedZipFile] = takePickedFiles(changeEvent)
          if (pickedZipFile === undefined) return
          void importIntoNewFolder(pickedZipFile.name.replace(/\.zip$/i, ''), async () => {
            // A zip is read whole, so one too large is turned down before it is.
            if (pickedZipFile.size > papelizImportZipMostTotalByteCount) throw new PapelizImportZipError('Zip Too Large')
            return planPapelizVaultFolderImportFromZip(pickedZipFile.name, new Uint8Array(await pickedZipFile.arrayBuffer()))
          })
        }}
      />

      {vaultImportMenuPosition !== null && (
        <PapelizPopoverMenu menuLabel="Import" menuPosition={vaultImportMenuPosition} menuItems={vaultImportMenuItems} onMenuClose={() => setVaultImportMenuPosition(null)} />
      )}

      {isTemplateImportDialogShown && (
        <PapelizVaultTemplateImportDialog importingVaultDisplayName={openVault.papelizVaultDisplayName} onTemplateImportDialogClose={() => setTemplateImportDialogShown(false)} />
      )}
    </>
  )
}

// Import from Template: the template gallery, its pages and Preview, over the vault, on the browser's
// own <dialog> (focus stays inside; Esc goes back a page, and out from the gallery). Use Template ends
// in Import into This Vault, and once the folder is made the dialog closes on the template's first
// note.
function PapelizVaultTemplateImportDialog({ importingVaultDisplayName, onTemplateImportDialogClose }: { importingVaultDisplayName: string; onTemplateImportDialogClose: () => void }) {
  const templateImportDialogRef = useRef<HTMLDialogElement>(null)
  const templateImportDialogHeadingId = useId()
  const importIntoNewVaultFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.importIntoNewVaultFolder)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)

  useEffect(() => {
    const templateImportDialogElement = templateImportDialogRef.current
    if (templateImportDialogElement === null) return
    templateImportDialogElement.showModal()
    return () => templateImportDialogElement.close()
  }, [])

  return (
    <dialog
      ref={templateImportDialogRef}
      aria-labelledby={templateImportDialogHeadingId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onTemplateImportDialogClose()
      }}
      className="papeliz-dialog-enter m-auto h-[min(640px,calc(100dvh-32px))] w-[min(820px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop open:flex"
    >
      <Suspense fallback={null}>
        <PapelizTemplateGalleryPage
          templateGalleryPageHeadingId={templateImportDialogHeadingId}
          folderAccessOffReasonText={null}
          browserVaultOffReasonText={null}
          existingBrowserVaultRecords={[]}
          onTemplateGalleryPageClose={onTemplateImportDialogClose}
          onTemplateVaultOpen={async () => undefined}
          onVaultFolderChooserUnavailable={() => undefined}
          templateGalleryVaultImport={{
            importingVaultDisplayName,
            importIntoNewVaultFolder,
            onTemplateImportedIntoVault: (importedVaultFolderRelativePath, templateFirstNotePath) => {
              onTemplateImportDialogClose()
              showWorkspaceNotice('info', `Imported the template into “${importedVaultFolderRelativePath}”.`)
              if (templateFirstNotePath !== null) void openVaultNote(templateFirstNotePath)
            },
          }}
        />
      </Suspense>
    </dialog>
  )
}
