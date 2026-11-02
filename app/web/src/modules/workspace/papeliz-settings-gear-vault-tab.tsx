import { useEffect, useId, useRef, useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { findPapelizBrowserVaultNameProblem, listPapelizBrowserVaults, renameOpenPapelizBrowserVault, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import { usePapelizBrowserVaultBackupReminderStore } from './papeliz-browser-vault-backup-reminder-store'
import { PapelizBrowserVaultNameField } from './papeliz-browser-vault-name-field'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// Settings › Vault: the open vault's name. A browser vault renames here, unless another tab has it open
// too. A folder vault takes its folder's name, so it says how to change that; the sample vault's name
// is fixed.
export function PapelizSettingsGearVaultTab() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  if (openVault === null) return null
  const openVaultKind = openVault.papelizVaultAdapter.papelizVaultKind
  if (openVaultKind === 'browser-vault-in-opfs') {
    return <PapelizSettingsGearBrowserVaultRename key={openVault.papelizVaultId} papelizVaultId={openVault.papelizVaultId} openVaultDisplayName={openVault.papelizVaultDisplayName} />
  }
  return (
    <div>
      <p className="text-[12px] leading-snug font-semibold text-papeliz-ink">Vault Name</p>
      <p className="mt-1 flex h-[30px] items-center truncate rounded-md border border-papeliz-line bg-papeliz-surface-soft px-2.5 text-[13px] text-papeliz-ink-muted">
        {openVault.papelizVaultDisplayName}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-papeliz-ink-subtle">
        {openVaultKind === 'folder-on-disk'
          ? 'Folder Storage. A folder vault takes its folder’s name: rename the folder on your computer, then open it again.'
          : 'The sample vault keeps its name.'}
      </p>
    </div>
  )
}

function PapelizSettingsGearBrowserVaultRename({ papelizVaultId, openVaultDisplayName }: { papelizVaultId: string; openVaultDisplayName: string }) {
  const setOpenVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.setOpenVaultDisplayName)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const browserVaultRenameIdPrefix = useId()
  const browserVaultRenameInputRef = useRef<HTMLInputElement>(null)
  const [typedBrowserVaultName, setTypedBrowserVaultName] = useState(openVaultDisplayName)
  const [otherBrowserVaultRecords, setOtherBrowserVaultRecords] = useState<readonly PapelizBrowserVaultRecord[]>([])
  const [isBrowserVaultRenameRunning, setBrowserVaultRenameRunning] = useState(false)
  const [browserVaultRenameFailureMessage, setBrowserVaultRenameFailureMessage] = useState<string | null>(null)

  // The other browser vaults' names, so a taken one says so under the field.
  useEffect(() => {
    let isRenameTabShown = true
    void listPapelizBrowserVaults()
      .then((browserVaultRecords) => {
        if (isRenameTabShown) setOtherBrowserVaultRecords(browserVaultRecords)
      })
      .catch(() => undefined)
    return () => {
      isRenameTabShown = false
    }
  }, [])

  const browserVaultNameProblem = findPapelizBrowserVaultNameProblem(typedBrowserVaultName, otherBrowserVaultRecords, papelizVaultId)
  const isBrowserVaultNameUnchanged = typedBrowserVaultName.trim() === openVaultDisplayName
  const isBrowserVaultRenameOff = browserVaultNameProblem !== null || isBrowserVaultNameUnchanged || isBrowserVaultRenameRunning

  const renameOpenBrowserVault = async () => {
    if (isBrowserVaultRenameOff) return
    setBrowserVaultRenameRunning(true)
    setBrowserVaultRenameFailureMessage(null)
    try {
      const renamedBrowserVaultRecord = await renameOpenPapelizBrowserVault(papelizVaultId, typedBrowserVaultName)
      setOpenVaultDisplayName(renamedBrowserVaultRecord.papelizVaultDisplayName)
      setTypedBrowserVaultName(renamedBrowserVaultRecord.papelizVaultDisplayName)
      void usePapelizBrowserVaultBackupReminderStore.getState().refreshOpenBrowserVaultRecord(papelizVaultId)
      showWorkspaceNotice('info', `Renamed to “${renamedBrowserVaultRecord.papelizVaultDisplayName}”.`)
    } catch (browserVaultRenameError) {
      setBrowserVaultRenameFailureMessage(
        describePapelizFailureMessage(`Couldn’t rename “${openVaultDisplayName}”`, browserVaultRenameError, { failedEntryName: typedBrowserVaultName, failedEntryKind: 'vault' }),
      )
    } finally {
      setBrowserVaultRenameRunning(false)
    }
  }

  return (
    <div>
      {/* The field and Rename side by side; Rename lines up with the box, under the label. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PapelizBrowserVaultNameField
            browserVaultNameInputRef={browserVaultRenameInputRef}
            typedBrowserVaultName={typedBrowserVaultName}
            browserVaultNameProblem={browserVaultNameProblem}
            browserVaultNameProblemId={`${browserVaultRenameIdPrefix}-name-problem`}
            onBrowserVaultNameType={(changedBrowserVaultName) => {
              setTypedBrowserVaultName(changedBrowserVaultName)
              setBrowserVaultRenameFailureMessage(null)
            }}
            onBrowserVaultNameSubmit={() => void renameOpenBrowserVault()}
          />
        </div>
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="mt-[20.5px]" disabled={isBrowserVaultRenameOff} onClick={() => void renameOpenBrowserVault()}>
          Rename
        </PapelizPillButton>
      </div>
      {browserVaultRenameFailureMessage !== null && (
        <p role="alert" className="mt-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          {browserVaultRenameFailureMessage}
        </p>
      )}
      <p className="mt-1.5 text-[12px] leading-snug text-papeliz-ink-subtle">Browser Storage. Kept inside this browser.</p>
    </div>
  )
}
