import { FileArchive, Folder } from 'lucide-react'
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import {
  importPapelizBrowserVault,
  planPapelizBrowserVaultImportFromFolder,
  planPapelizBrowserVaultImportFromZip,
  type PapelizBrowserVaultImportPlan,
} from '../vault/papeliz-browser-vault-import'
import { formatPapelizStorageByteCount } from '../vault/papeliz-browser-vault-storage'
import { findPapelizBrowserVaultNameProblem, pickFreePapelizBrowserVaultName, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { usePapelizBrowserStorageStore } from './papeliz-browser-storage-store'

// The browser's folder upload: React has no prop for it, so the attribute goes in as it is.
const papelizFolderUploadInputAttributes = { webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement>

type PapelizBrowserVaultImportStep =
  | { browserVaultImportStepKind: 'choose-source' }
  | { browserVaultImportStepKind: 'name-vault'; browserVaultImportPlan: PapelizBrowserVaultImportPlan }
  | { browserVaultImportStepKind: 'importing'; importedFileCount: number; importFileCount: number }

interface PapelizBrowserVaultImportDialogProps {
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  onBrowserVaultImported: (importedBrowserVaultRecord: PapelizBrowserVaultRecord, importedFileCount: number) => void
  onBrowserVaultImportClose: (wasImportStopped: boolean) => void
}

// Import Vault: pick a `.zip` (a Papeliz backup, or any zip of notes) or a folder, name the new
// vault, and watch it fill, with Stop. An import always makes a new vault in this browser.
export function PapelizBrowserVaultImportDialog({ existingBrowserVaultRecords, onBrowserVaultImported, onBrowserVaultImportClose }: PapelizBrowserVaultImportDialogProps) {
  const importDialogRef = useRef<HTMLDialogElement>(null)
  const zipFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const browserVaultNameInputRef = useRef<HTMLInputElement>(null)
  const importAbortControllerRef = useRef<AbortController | null>(null)
  const askBrowserToKeepStorage = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.askBrowserToKeepStorage)
  const [browserVaultImportStep, setBrowserVaultImportStep] = useState<PapelizBrowserVaultImportStep>({ browserVaultImportStepKind: 'choose-source' })
  const [typedBrowserVaultName, setTypedBrowserVaultName] = useState('')
  const [browserVaultImportProblem, setBrowserVaultImportProblem] = useState<string | null>(null)
  const [isImportSourceReading, setImportSourceReading] = useState(false)

  useEffect(() => {
    const importDialogElement = importDialogRef.current
    if (importDialogElement === null) return
    importDialogElement.showModal()
    return () => importDialogElement.close()
  }, [])

  useEffect(() => {
    if (browserVaultImportStep.browserVaultImportStepKind !== 'name-vault') return
    browserVaultNameInputRef.current?.focus()
    browserVaultNameInputRef.current?.select()
  }, [browserVaultImportStep.browserVaultImportStepKind])

  const browserVaultNameProblem =
    browserVaultImportStep.browserVaultImportStepKind === 'name-vault' ? findPapelizBrowserVaultNameProblem(typedBrowserVaultName, existingBrowserVaultRecords) : null

  const readImportSource = async (importSourceDescription: string, planBrowserVaultImport: () => Promise<PapelizBrowserVaultImportPlan>) => {
    setBrowserVaultImportProblem(null)
    setImportSourceReading(true)
    try {
      const browserVaultImportPlan = await planBrowserVaultImport()
      setTypedBrowserVaultName(pickFreePapelizBrowserVaultName(browserVaultImportPlan.suggestedBrowserVaultName, existingBrowserVaultRecords))
      setBrowserVaultImportStep({ browserVaultImportStepKind: 'name-vault', browserVaultImportPlan })
    } catch (importSourceError) {
      setBrowserVaultImportProblem(`Couldn’t read ${importSourceDescription} (${describePapelizVaultError(importSourceError)})`)
    } finally {
      setImportSourceReading(false)
    }
  }

  // Runs from Import's click: Firefox asks there whether to keep this site's storage.
  const startBrowserVaultImport = async () => {
    if (browserVaultImportStep.browserVaultImportStepKind !== 'name-vault' || browserVaultNameProblem !== null) return
    const { browserVaultImportPlan } = browserVaultImportStep
    askBrowserToKeepStorage()
    const importAbortController = new AbortController()
    importAbortControllerRef.current = importAbortController
    setBrowserVaultImportStep({ browserVaultImportStepKind: 'importing', importedFileCount: 0, importFileCount: browserVaultImportPlan.browserVaultImportFiles.length })
    try {
      const importedBrowserVaultRecord = await importPapelizBrowserVault(typedBrowserVaultName.trim(), browserVaultImportPlan, {
        browserVaultImportAbortSignal: importAbortController.signal,
        onBrowserVaultImportProgress: (importedFileCount, importFileCount) =>
          setBrowserVaultImportStep({ browserVaultImportStepKind: 'importing', importedFileCount, importFileCount }),
      })
      onBrowserVaultImported(importedBrowserVaultRecord, browserVaultImportPlan.importFileCount)
    } catch (browserVaultImportError) {
      if (importAbortController.signal.aborted) {
        onBrowserVaultImportClose(true)
        return
      }
      setBrowserVaultImportProblem(`Couldn’t import “${typedBrowserVaultName.trim()}” (${describePapelizVaultError(browserVaultImportError)})`)
      setBrowserVaultImportStep({ browserVaultImportStepKind: 'name-vault', browserVaultImportPlan })
    } finally {
      importAbortControllerRef.current = null
    }
  }

  const cancelBrowserVaultImport = () => {
    if (importAbortControllerRef.current !== null) importAbortControllerRef.current.abort()
    else onBrowserVaultImportClose(false)
  }

  return (
    <dialog
      ref={importDialogRef}
      aria-labelledby="papeliz-browser-vault-import-title"
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        cancelBrowserVaultImport()
      }}
      className="papeliz-dialog-enter m-auto w-[min(440px,calc(100vw-32px))] rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="p-6">
        <h2 id="papeliz-browser-vault-import-title" className="text-lg font-semibold">
          {browserVaultImportStep.browserVaultImportStepKind === 'importing' ? `Importing “${typedBrowserVaultName.trim()}”` : 'Import vault'}
        </h2>

        {browserVaultImportStep.browserVaultImportStepKind === 'choose-source' && (
          <>
            <p className="mt-2 text-[15px] text-papeliz-ink-muted">Makes a new vault in this browser from notes you have. Nothing is replaced.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 max-[380px]:grid-cols-1">
              <button
                type="button"
                disabled={isImportSourceReading}
                onClick={() => zipFileInputRef.current?.click()}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-papeliz-line p-3 text-left text-[12.5px] text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40 disabled:opacity-60"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-papeliz-blue-soft text-papeliz-blue">
                  <FileArchive className="size-4" aria-hidden="true" />
                </span>
                <b className="text-[13.5px] font-semibold text-papeliz-ink">A .zip file</b>
                A Papeliz backup, or any zip of notes.
              </button>
              <button
                type="button"
                disabled={isImportSourceReading}
                onClick={() => folderInputRef.current?.click()}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-papeliz-line p-3 text-left text-[12.5px] text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40 disabled:opacity-60"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-papeliz-blue-soft text-papeliz-blue">
                  <Folder className="size-4" aria-hidden="true" />
                </span>
                <b className="text-[13.5px] font-semibold text-papeliz-ink">A folder</b>
                Copies its notes and files in.
              </button>
            </div>
            <input
              ref={zipFileInputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(changeEvent) => {
                const pickedZipFile = changeEvent.target.files?.[0]
                changeEvent.target.value = ''
                if (pickedZipFile === undefined) return
                void readImportSource(`“${pickedZipFile.name}”`, async () =>
                  planPapelizBrowserVaultImportFromZip(pickedZipFile.name, new Uint8Array(await pickedZipFile.arrayBuffer())),
                )
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              {...papelizFolderUploadInputAttributes}
              onChange={(changeEvent) => {
                const pickedFolderFiles = [...(changeEvent.target.files ?? [])]
                changeEvent.target.value = ''
                void readImportSource('the folder', () => planPapelizBrowserVaultImportFromFolder(pickedFolderFiles))
              }}
            />
            {isImportSourceReading && <p className="mt-3 text-[13px] text-papeliz-ink-muted">Reading…</p>}
          </>
        )}

        {browserVaultImportStep.browserVaultImportStepKind === 'name-vault' && (
          <>
            <p className="mt-2 text-[15px] text-papeliz-ink-muted">
              {browserVaultImportStep.browserVaultImportPlan.importFileCount.toLocaleString()}{' '}
              {browserVaultImportStep.browserVaultImportPlan.importFileCount === 1 ? 'file' : 'files'},{' '}
              {formatPapelizStorageByteCount(browserVaultImportStep.browserVaultImportPlan.importTotalByteCount)}
              {browserVaultImportStep.browserVaultImportPlan.skippedImportFileCount > 0 &&
                ` (${browserVaultImportStep.browserVaultImportPlan.skippedImportFileCount.toLocaleString()} left out)`}
              . It’s kept in this browser.
            </p>
            <label className="mt-4 block text-[13px] font-medium text-papeliz-ink">
              Name
              <input
                ref={browserVaultNameInputRef}
                value={typedBrowserVaultName}
                maxLength={120}
                onChange={(changeEvent) => setTypedBrowserVaultName(changeEvent.target.value)}
                onKeyDown={(keyDownEvent) => {
                  if (keyDownEvent.key !== 'Enter') return
                  keyDownEvent.preventDefault()
                  void startBrowserVaultImport()
                }}
                aria-invalid={browserVaultNameProblem !== null || undefined}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
              />
            </label>
            {browserVaultNameProblem !== null && typedBrowserVaultName.length > 0 && (
              <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-papeliz-diff-removed-ink">
                Can’t use this name ({browserVaultNameProblem})
              </p>
            )}
          </>
        )}

        {browserVaultImportStep.browserVaultImportStepKind === 'importing' && (
          <>
            <p className="mt-2 text-[15px] text-papeliz-ink-muted" aria-live="polite">
              {browserVaultImportStep.importedFileCount.toLocaleString()} of {browserVaultImportStep.importFileCount.toLocaleString()} files
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={browserVaultImportStep.importFileCount}
              aria-valuenow={browserVaultImportStep.importedFileCount}
              className="mt-3 h-2 overflow-hidden rounded-full bg-papeliz-surface-gray"
            >
              <div
                className="h-full rounded-full bg-papeliz-blue transition-[width] duration-150"
                style={{ width: `${browserVaultImportStep.importFileCount === 0 ? 100 : (browserVaultImportStep.importedFileCount / browserVaultImportStep.importFileCount) * 100}%` }}
              />
            </div>
          </>
        )}

        {browserVaultImportProblem !== null && (
          <p role="alert" className="mt-3 text-[12.5px] font-medium text-papeliz-diff-removed-ink">
            {browserVaultImportProblem}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <PapelizPillButton pillButtonVariant="red-primary" onClick={cancelBrowserVaultImport}>
            {browserVaultImportStep.browserVaultImportStepKind === 'importing' ? 'Stop' : 'Cancel'}
          </PapelizPillButton>
          {browserVaultImportStep.browserVaultImportStepKind === 'name-vault' && (
            <PapelizPillButton pillButtonVariant="primary" disabled={browserVaultNameProblem !== null} onClick={() => void startBrowserVaultImport()}>
              Import
            </PapelizPillButton>
          )}
        </div>
      </div>
    </dialog>
  )
}
