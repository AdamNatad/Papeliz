import type { Ref } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

interface PapelizBrowserVaultNameFieldProps {
  browserVaultNameInputRef: Ref<HTMLInputElement>
  typedBrowserVaultName: string
  // Why the typed name can't be used, or null when it can.
  browserVaultNameProblem: string | null
  browserVaultNameProblemId: string
  // "Name" over the field (Rename), or beside it on one line (New Vault's Empty row).
  browserVaultNameFieldLayout?: 'label-over-field' | 'label-beside-field'
  onBrowserVaultNameType: (typedBrowserVaultName: string) => void
  // Enter in the field.
  onBrowserVaultNameSubmit: () => void
}

// A browser vault's Name field, for New Vault and for Rename. A name that can't be used says why under
// the field.
export function PapelizBrowserVaultNameField({
  browserVaultNameInputRef,
  typedBrowserVaultName,
  browserVaultNameProblem,
  browserVaultNameProblemId,
  browserVaultNameFieldLayout = 'label-over-field',
  onBrowserVaultNameType,
  onBrowserVaultNameSubmit,
}: PapelizBrowserVaultNameFieldProps) {
  const isLabelBesideField = browserVaultNameFieldLayout === 'label-beside-field'
  return (
    <>
      <label
        className={joinPapelizClassNames(
          'text-[12px] leading-snug font-semibold whitespace-nowrap text-papeliz-ink',
          isLabelBesideField ? 'flex min-w-0 flex-1 items-center gap-2.5' : 'block',
        )}
      >
        Name
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
          className={joinPapelizClassNames(
            'block h-[30px] w-full rounded-md border border-papeliz-line bg-papeliz-surface px-2.5 text-[13px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:ring-2 focus:ring-papeliz-blue-line/55 focus:outline-none',
            isLabelBesideField ? 'min-w-0 flex-1' : 'mt-1',
          )}
        />
      </label>
      {browserVaultNameProblem !== null && typedBrowserVaultName.length > 0 && (
        <p id={browserVaultNameProblemId} role="alert" className="mt-1 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          Can’t use this name ({browserVaultNameProblem})
        </p>
      )}
    </>
  )
}
