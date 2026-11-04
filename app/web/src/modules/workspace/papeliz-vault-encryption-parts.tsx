import { Lock, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizLoadingStartedAtMilliseconds } from '../ui/papeliz-loading-clock'
import type { PapelizLoadingStep } from '../ui/papeliz-loading-progress-count'
import { PapelizLoadingReadout } from '../ui/papeliz-loading-readout'
import { describePapelizFailureCode } from '../vault/papeliz-failure-code-words'
import {
  describePapelizVaultEncryptionFailureCode,
  isPapelizEndToEndVaultAdapter,
  type PapelizVaultEncryptionKindChangeDirection,
  type PapelizVaultEncryptionKindChangeProgress,
} from '../vault/papeliz-vault-encryption'
import {
  papelizEndToEndVaultAssistantLine,
  papelizEndToEndVaultBadgeWords,
  papelizRememberEndToEndVaultInBrowserLine,
  papelizRememberEndToEndVaultInWindowsLine,
} from './papeliz-vault-encryption-screen-words'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// The pieces the screens for an End-to-end vault share: its letter with the lock, its purple badge,
// what Remember on This Device means here, a change of kind's progress, and the AI Assistant's line.

// A vault's first letter in its soft blue tile, as Recent Vaults shows it; an End-to-end vault's has a
// small purple lock on its corner.
export function PapelizVaultLetterTile({ papelizVaultDisplayName, isEndToEndVault }: { papelizVaultDisplayName: string; isEndToEndVault: boolean }) {
  return (
    <span aria-hidden="true" className="relative grid size-9 flex-none place-items-center rounded-lg bg-papeliz-blue-soft text-[15px] font-semibold text-papeliz-blue">
      {papelizVaultDisplayName.trim().charAt(0).toUpperCase() || '·'}
      {isEndToEndVault && (
        <span className="absolute -right-[5px] -bottom-[5px] grid size-[17px] place-items-center rounded-full bg-papeliz-callout-purple-ink text-papeliz-surface shadow-[0_0_0_2px_var(--color-papeliz-surface)]">
          <Lock className="size-[10px]" strokeWidth={2.5} />
        </span>
      )}
    </span>
  )
}

export const papelizVaultRowBadgeClassName = 'inline-flex h-[18px] flex-none items-center gap-1 rounded-full px-[7px] text-[10.5px] font-semibold whitespace-nowrap'
export const papelizEndToEndVaultBadgeColorClassName = 'bg-papeliz-callout-purple-ground text-papeliz-callout-purple-ink'

// "End-to-End Encryption", in purple with a lock: on an End-to-end vault's row and on Unlock.
export function PapelizEndToEndVaultBadge({ className }: { className?: string }) {
  return (
    <span className={joinPapelizClassNames(papelizVaultRowBadgeClassName, papelizEndToEndVaultBadgeColorClassName, className)}>
      <Lock className="size-3" aria-hidden="true" />
      {papelizEndToEndVaultBadgeWords}
    </span>
  )
}

// A failure's whole message: "Couldn’t unlock “My Notes”. …", with the encryption's own sentence for
// its codes and the general one for a vault's ("Disk Full").
export function describePapelizVaultEncryptionFailureMessage(failureHeadline: string, vaultEncryptionFailureCode: string): string {
  return `${failureHeadline}. ${describePapelizVaultEncryptionFailureCode(vaultEncryptionFailureCode) ?? describePapelizFailureCode(vaultEncryptionFailureCode)}`
}

// What Remember on This Device means where this app keeps the key.
export function readPapelizRememberEndToEndVaultLine(): string {
  return isPapelizDesktopApp ? papelizRememberEndToEndVaultInWindowsLine : papelizRememberEndToEndVaultInBrowserLine
}

// "Encrypting My Notes" and the readout, while a change of kind rewrites the vault's files: counting the
// files first, while the bar slides, then the files done, counted on the bar, with the steps open under it.
export function PapelizVaultEncryptionChangeProgressBlock({
  papelizVaultDisplayName,
  vaultEncryptionKindChangeDirection,
  vaultEncryptionKindChangeProgress,
  children,
}: {
  papelizVaultDisplayName: string
  vaultEncryptionKindChangeDirection: PapelizVaultEncryptionKindChangeDirection
  vaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgress | null
  children?: ReactNode
}) {
  const vaultEncryptionChangeStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  const vaultEncryptionChangeWord = vaultEncryptionKindChangeDirection === 'to-end-to-end' ? 'Encrypting' : 'Decrypting'
  const vaultEncryptionChangeFilesInAll = vaultEncryptionKindChangeProgress?.vaultEncryptionChangeFilesInAll ?? 0
  const vaultEncryptionChangeFilesDone = vaultEncryptionKindChangeProgress?.vaultEncryptionChangeFilesDone ?? 0
  const vaultEncryptionChangeSteps: PapelizLoadingStep[] = [
    { loadingStepLabel: 'Counting the files', loadingStepState: vaultEncryptionKindChangeProgress === null ? 'running' : 'done' },
    {
      loadingStepLabel: vaultEncryptionChangeWord,
      loadingStepState:
        vaultEncryptionKindChangeProgress === null
          ? 'waiting'
          : vaultEncryptionChangeFilesInAll > 0 && vaultEncryptionChangeFilesDone >= vaultEncryptionChangeFilesInAll
            ? 'done'
            : 'running',
      loadingStepWeight: 9,
      loadingStepDoneUnitCount: vaultEncryptionChangeFilesDone,
      loadingStepUnitCount: vaultEncryptionChangeFilesInAll,
      loadingStepUnitWord: vaultEncryptionChangeFilesInAll === 1 ? 'file' : 'files',
    },
  ]
  return (
    <div role="status" aria-label={`${vaultEncryptionChangeWord} ${papelizVaultDisplayName}`} className="flex flex-col gap-2">
      <p className="text-[13.5px] font-semibold text-papeliz-ink">
        {vaultEncryptionChangeWord} {papelizVaultDisplayName}
      </p>
      <PapelizLoadingReadout
        loadingWords={vaultEncryptionKindChangeProgress === null ? 'Counting the files' : vaultEncryptionChangeWord}
        loadingSteps={vaultEncryptionChangeSteps}
        loadingStartedAtMilliseconds={vaultEncryptionChangeStartedAtMilliseconds}
      />
      {children}
    </div>
  )
}

// The AI Assistant's line in an End-to-end vault, above its box: End-to-end covers the files, not
// what is sent to the provider. Nothing in any other vault.
export function PapelizEndToEndVaultAssistantLine() {
  const isOpenVaultEndToEnd = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault !== null && isPapelizEndToEndVaultAdapter(workspaceState.openVault.papelizVaultAdapter))
  if (!isOpenVaultEndToEnd) return null
  return (
    <p className="flex flex-none items-start gap-1.5 px-[18px] pb-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">
      <ShieldAlert className="mt-px size-3.5 flex-none text-papeliz-callout-purple-ink" aria-hidden="true" />
      <span>{papelizEndToEndVaultAssistantLine}</span>
    </p>
  )
}
