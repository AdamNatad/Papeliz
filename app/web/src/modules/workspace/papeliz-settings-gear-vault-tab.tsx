import { FileText, Lock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PapelizSyncSwitch } from '../sync/papeliz-sync-page-parts'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { findPapelizBrowserVaultNameProblem, listPapelizBrowserVaults, renameOpenPapelizBrowserVault, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import { renameOpenPapelizFolderVault } from '../vault/papeliz-open-vault'
import {
  canPapelizVaultAdapterBeEndToEnd,
  forgetPapelizVaultEncryptionKeyOnThisDevice,
  isPapelizEndToEndVaultAdapter,
  isPapelizVaultEncryptionKeyRememberedOnThisDevice,
  rememberPapelizVaultEncryptionKeyOnThisDevice,
  type PapelizEndToEndVaultAdapter,
} from '../vault/papeliz-vault-encryption'
import { findPapelizVaultOwnNameProblem } from '../vault/papeliz-vault-own-name'
import { usePapelizBrowserVaultBackupReminderStore } from './papeliz-browser-vault-backup-reminder-store'
import { PapelizBrowserVaultNameField } from './papeliz-browser-vault-name-field'
import { PapelizVaultEncryptionChangeDialog, type PapelizVaultEncryptionChange } from './papeliz-vault-encryption-change-dialog'
import { describePapelizVaultEncryptionFailureMessage, papelizEndToEndVaultBadgeColorClassName, readPapelizRememberEndToEndVaultLine } from './papeliz-vault-encryption-parts'
import {
  describePapelizEndToEndVaultCardLine,
  papelizRememberEndToEndVaultSwitchLabel,
  papelizVaultEncryptionKindDisplayNames,
  papelizVaultEncryptionKindLines,
} from './papeliz-vault-encryption-screen-words'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// Settings › Vault: the open vault's name, then its Encryption. A browser vault renames here, unless
// another tab has it open too. A folder vault renames here too: its name is kept in the vault, and the
// folder on disk keeps its own. The sample vault's name is fixed, and it is never encrypted.
export function PapelizSettingsGearVaultTab() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  if (openVault === null) return null
  return (
    <div className="flex flex-col gap-4">
      <PapelizSettingsGearVaultName />
      {(isPapelizEndToEndVaultAdapter(openVault.papelizVaultAdapter) || canPapelizVaultAdapterBeEndToEnd(openVault.papelizVaultAdapter)) && (
        <PapelizSettingsGearVaultEncryptionCard key={openVault.papelizVaultId} />
      )}
    </div>
  )
}

function PapelizSettingsGearVaultName() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  if (openVault === null) return null
  const openVaultKind = openVault.papelizVaultAdapter.papelizVaultKind
  if (openVaultKind === 'browser-vault-in-opfs') {
    return <PapelizSettingsGearBrowserVaultRename key={openVault.papelizVaultId} papelizVaultId={openVault.papelizVaultId} openVaultDisplayName={openVault.papelizVaultDisplayName} />
  }
  if (openVaultKind === 'folder-on-disk') return <PapelizSettingsGearFolderVaultRename key={openVault.papelizVaultId} openVaultDisplayName={openVault.papelizVaultDisplayName} />
  return (
    <div>
      <p className="text-[12px] leading-snug font-semibold text-papeliz-ink">Vault Name</p>
      <p className="mt-1 flex h-[30px] items-center truncate rounded-md border border-papeliz-line bg-papeliz-surface-soft px-2.5 text-[13px] text-papeliz-ink-muted">
        {openVault.papelizVaultDisplayName}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-papeliz-ink-subtle">The sample vault keeps its name.</p>
    </div>
  )
}

interface PapelizSettingsGearVaultRenameRowProps {
  typedVaultName: string
  // Why the typed name can't be used, as a code ("Name Taken"), or null when it can.
  vaultNameProblem: string | null
  isVaultRenameOff: boolean
  vaultRenameFailureMessage: string | null
  // Where the vault is kept, under the field.
  vaultStorageLine: string
  onVaultNameType: (typedVaultName: string) => void
  onVaultRename: () => void
}

// The Vault Name field with Rename beside it, then why a rename failed, then where the vault is kept.
function PapelizSettingsGearVaultRenameRow({
  typedVaultName,
  vaultNameProblem,
  isVaultRenameOff,
  vaultRenameFailureMessage,
  vaultStorageLine,
  onVaultNameType,
  onVaultRename,
}: PapelizSettingsGearVaultRenameRowProps) {
  const vaultRenameIdPrefix = useId()
  const vaultRenameInputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      {/* The field and Rename side by side; Rename lines up with the box, under the label. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PapelizBrowserVaultNameField
            browserVaultNameInputRef={vaultRenameInputRef}
            typedBrowserVaultName={typedVaultName}
            browserVaultNameProblem={vaultNameProblem}
            browserVaultNameProblemId={`${vaultRenameIdPrefix}-name-problem`}
            onBrowserVaultNameType={onVaultNameType}
            onBrowserVaultNameSubmit={onVaultRename}
          />
        </div>
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="mt-[20.5px]" disabled={isVaultRenameOff} onClick={onVaultRename}>
          Rename
        </PapelizPillButton>
      </div>
      {vaultRenameFailureMessage !== null && (
        <p role="alert" className="mt-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          {vaultRenameFailureMessage}
        </p>
      )}
      <p className="mt-1.5 text-[12px] leading-snug text-papeliz-ink-subtle">{vaultStorageLine}</p>
    </div>
  )
}

// A folder vault's own name, saved in the vault (sealed when it is End-to-end): the top bar, the window's
// title and Recent Vaults show it at once.
function PapelizSettingsGearFolderVaultRename({ openVaultDisplayName }: { openVaultDisplayName: string }) {
  const setOpenVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.setOpenVaultDisplayName)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const [typedFolderVaultName, setTypedFolderVaultName] = useState(openVaultDisplayName)
  const [isFolderVaultRenameRunning, setFolderVaultRenameRunning] = useState(false)
  const [folderVaultRenameFailureMessage, setFolderVaultRenameFailureMessage] = useState<string | null>(null)

  const folderVaultNameProblem = findPapelizVaultOwnNameProblem(typedFolderVaultName)
  const isFolderVaultRenameOff = folderVaultNameProblem !== null || typedFolderVaultName.trim() === openVaultDisplayName || isFolderVaultRenameRunning

  const renameOpenFolderVault = async () => {
    // The vault as it is now: a change of kind since this tab opened gives it another adapter.
    const renamedOpenVault = usePapelizWorkspaceStore.getState().openVault
    if (isFolderVaultRenameOff || renamedOpenVault === null) return
    setFolderVaultRenameRunning(true)
    setFolderVaultRenameFailureMessage(null)
    try {
      const renamedFolderVaultName = await renameOpenPapelizFolderVault(renamedOpenVault, typedFolderVaultName)
      setOpenVaultDisplayName(renamedFolderVaultName)
      setTypedFolderVaultName(renamedFolderVaultName)
      showWorkspaceNotice('info', `Renamed to “${renamedFolderVaultName}”.`)
    } catch (folderVaultRenameError) {
      setFolderVaultRenameFailureMessage(
        describePapelizFailureMessage(`Couldn’t rename “${openVaultDisplayName}”`, folderVaultRenameError, { failedEntryName: typedFolderVaultName, failedEntryKind: 'vault' }),
      )
    } finally {
      setFolderVaultRenameRunning(false)
    }
  }

  return (
    <PapelizSettingsGearVaultRenameRow
      typedVaultName={typedFolderVaultName}
      vaultNameProblem={folderVaultNameProblem}
      isVaultRenameOff={isFolderVaultRenameOff}
      vaultRenameFailureMessage={folderVaultRenameFailureMessage}
      vaultStorageLine="Folder Storage. The folder on your computer keeps its own name."
      onVaultNameType={(changedFolderVaultName) => {
        setTypedFolderVaultName(changedFolderVaultName)
        setFolderVaultRenameFailureMessage(null)
      }}
      onVaultRename={() => void renameOpenFolderVault()}
    />
  )
}

function PapelizSettingsGearBrowserVaultRename({ papelizVaultId, openVaultDisplayName }: { papelizVaultId: string; openVaultDisplayName: string }) {
  const setOpenVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.setOpenVaultDisplayName)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
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
    <PapelizSettingsGearVaultRenameRow
      typedVaultName={typedBrowserVaultName}
      vaultNameProblem={browserVaultNameProblem}
      isVaultRenameOff={isBrowserVaultRenameOff}
      vaultRenameFailureMessage={browserVaultRenameFailureMessage}
      vaultStorageLine="Browser Storage. Kept inside this browser."
      onVaultNameType={(changedBrowserVaultName) => {
        setTypedBrowserVaultName(changedBrowserVaultName)
        setBrowserVaultRenameFailureMessage(null)
      }}
      onVaultRename={() => void renameOpenBrowserVault()}
    />
  )
}

// Encryption, under the name: the vault's kind with its one line, and its changes. A Standard vault
// offers Change to End-to-end; an End-to-end one Change Passphrase, Change to Standard and Remember
// on This Device. Each change opens its own dialog.
function PapelizSettingsGearVaultEncryptionCard() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const listedVaultFileCount = usePapelizWorkspaceStore(
    (workspaceState) => workspaceState.vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind !== 'folder').length,
  )
  const [openVaultEncryptionChange, setOpenVaultEncryptionChange] = useState<PapelizVaultEncryptionChange | null>(null)
  const vaultEncryptionHeadingId = useId()
  if (openVault === null) return null
  const openVaultAdapter = openVault.papelizVaultAdapter
  const isOpenVaultEndToEnd = isPapelizEndToEndVaultAdapter(openVaultAdapter)
  const openVaultEncryptionKind = isOpenVaultEndToEnd ? 'end-to-end' : 'standard'

  return (
    <section aria-labelledby={vaultEncryptionHeadingId} className="flex flex-col gap-2.5">
      <h3 id={vaultEncryptionHeadingId} className="text-[12px] leading-snug font-semibold text-papeliz-ink">
        Encryption
      </h3>
      <div className="-mt-1 flex flex-col gap-2.5 rounded-xl border border-papeliz-line p-2.5">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className={joinPapelizClassNames(
              'grid size-[30px] flex-none place-items-center rounded-lg',
              isOpenVaultEndToEnd ? papelizEndToEndVaultBadgeColorClassName : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
            )}
          >
            {isOpenVaultEndToEnd ? <Lock className="size-4" /> : <FileText className="size-4" />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13.5px] leading-tight font-semibold text-papeliz-ink">{papelizVaultEncryptionKindDisplayNames[openVaultEncryptionKind]}</span>
            <span className="text-[12px] leading-snug text-papeliz-ink-subtle">
              {isOpenVaultEndToEnd ? describePapelizEndToEndVaultCardLine(listedVaultFileCount) : papelizVaultEncryptionKindLines.standard}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpenVaultEndToEnd ? (
            <>
              <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" onClick={() => setOpenVaultEncryptionChange('change-passphrase')}>
                Change Passphrase
              </PapelizPillButton>
              <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" onClick={() => setOpenVaultEncryptionChange('to-standard')}>
                Change to Standard
              </PapelizPillButton>
            </>
          ) : (
            <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" className="gap-1.5" onClick={() => setOpenVaultEncryptionChange('to-end-to-end')}>
              <Lock className="size-3.5" aria-hidden="true" />
              Change to End-to-end
            </PapelizPillButton>
          )}
        </div>
      </div>
      {isOpenVaultEndToEnd && <PapelizSettingsGearRememberEndToEndVaultSwitch key={openVaultAdapter.papelizEncryptedVaultId} endToEndVaultAdapter={openVaultAdapter} />}
      {openVaultEncryptionChange !== null && (
        <PapelizVaultEncryptionChangeDialog
          changedOpenVault={openVault}
          vaultEncryptionChange={openVaultEncryptionChange}
          listedVaultFileCount={listedVaultFileCount}
          onVaultEncryptionChangeDialogClose={() => setOpenVaultEncryptionChange(null)}
        />
      )}
    </section>
  )
}

// Remember on This Device, for the open End-to-end vault: on, this device opens it without the
// passphrase; off, the key it kept is forgotten.
function PapelizSettingsGearRememberEndToEndVaultSwitch({ endToEndVaultAdapter }: { endToEndVaultAdapter: PapelizEndToEndVaultAdapter }) {
  const [isVaultKeyRemembered, setIsVaultKeyRemembered] = useState<boolean | null>(null)
  const [isRememberChangeRunning, setIsRememberChangeRunning] = useState(false)
  const [rememberChangeFailureMessage, setRememberChangeFailureMessage] = useState<string | null>(null)
  const rememberLineId = useId()

  useEffect(() => {
    let isSwitchShown = true
    void isPapelizVaultEncryptionKeyRememberedOnThisDevice(endToEndVaultAdapter.papelizEncryptedVaultId)
      .catch(() => false)
      .then((isRemembered) => {
        if (isSwitchShown) setIsVaultKeyRemembered(isRemembered)
      })
    return () => {
      isSwitchShown = false
    }
  }, [endToEndVaultAdapter])

  const toggleVaultKeyRemembered = async () => {
    if (isVaultKeyRemembered === null || isRememberChangeRunning) return
    const isRememberWanted = !isVaultKeyRemembered
    setIsRememberChangeRunning(true)
    setRememberChangeFailureMessage(null)
    try {
      const rememberChangeResult = isRememberWanted
        ? await rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)
        : await forgetPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter.papelizEncryptedVaultId)
      if (rememberChangeResult.vaultEncryptionActionOutcome === 'done') setIsVaultKeyRemembered(isRememberWanted)
      else
        setRememberChangeFailureMessage(
          describePapelizVaultEncryptionFailureMessage(isRememberWanted ? 'Couldn’t remember it on this device' : 'Couldn’t forget it on this device', rememberChangeResult.vaultEncryptionFailureCode),
        )
    } finally {
      setIsRememberChangeRunning(false)
    }
  }

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] leading-tight font-semibold text-papeliz-ink">{papelizRememberEndToEndVaultSwitchLabel}</span>
          <span id={rememberLineId} className="text-[12px] leading-snug text-papeliz-ink-subtle">
            {readPapelizRememberEndToEndVaultLine()}
          </span>
        </span>
        <PapelizSyncSwitch
          syncSwitchLabel={papelizRememberEndToEndVaultSwitchLabel}
          isSyncSwitchOn={isVaultKeyRemembered === true}
          isSyncSwitchDisabled={isVaultKeyRemembered === null || isRememberChangeRunning}
          onSyncSwitchToggle={() => void toggleVaultKeyRemembered()}
        />
      </div>
      {rememberChangeFailureMessage !== null && (
        <p role="alert" className="mt-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          {rememberChangeFailureMessage}
        </p>
      )}
    </div>
  )
}
