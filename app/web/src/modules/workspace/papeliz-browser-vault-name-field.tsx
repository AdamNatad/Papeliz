import type { Ref } from 'react'
import { describePapelizFailureCode } from '../vault/papeliz-failure-code-words'

interface PapelizBrowserVaultNameFieldProps {
  browserVaultNameInputRef: Ref<HTMLInputElement>
  typedBrowserVaultName: string
  // Why the typed name can't be used, as a code ("Name Taken"), or null when it can.
  browserVaultNameProblem: string | null
  browserVaultNameProblemId: string
  onBrowserVaultNameType: (typedBrowserVaultName: string) => void
  // Enter in the field.
  onBrowserVaultNameSubmit: () => void
}

// A vault's Vault Name field: New Vault's, for a vault in a folder or in the browser, and a browser
// vault's Rename. A name that can't be used says why under the field.
export function PapelizBrowserVaultNameField({
  browserVaultNameInputRef,
  typedBrowserVaultName,
  browserVaultNameProblem,
  browserVaultNameProblemId,
  onBrowserVaultNameType,
  onBrowserVaultNameSubmit,
}: PapelizBrowserVaultNameFieldProps) {
  return (
    <>
      <label className="block text-[12px] leading-snug font-semibold whitespace-nowrap text-papeliz-ink">
        Vault Name
        <input
          ref={browserVaultNameInputRef}
          value={typedBrowserVaultName}
          maxLength={120}
          onChange={(changeEvent) => onBrowserVaultNameType(changeEvent.target.value)}
          onKeyDown={(keyDownEvent) => {
            if (keyDownEvent.key !== 'Enter') return
            keyDownEvent.preventDefault()
            onBrowserVaultNameSubmit()
          }}
          aria-invalid={browserVaultNameProblem !== null || undefined}
          aria-describedby={browserVaultNameProblem === null ? undefined : browserVaultNameProblemId}
          autoComplete="off"
          spellCheck={false}
          className="mt-1 block h-[30px] w-full rounded-md border border-papeliz-line bg-papeliz-surface px-2.5 text-[13px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:ring-2 focus:ring-papeliz-blue-line/55 focus:outline-none"
        />
      </label>
      {browserVaultNameProblem !== null && typedBrowserVaultName.length > 0 && (
        <p id={browserVaultNameProblemId} role="alert" className="mt-1 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          {describePapelizFailureCode(browserVaultNameProblem, { failedEntryName: typedBrowserVaultName.trim(), failedEntryKind: 'vault' })}
        </p>
      )}
    </>
  )
}
