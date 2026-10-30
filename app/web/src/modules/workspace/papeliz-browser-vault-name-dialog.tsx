import { useEffect, useRef, useState } from 'react'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { findPapelizBrowserVaultNameProblem, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'

// Where a new vault is kept: a folder on the disk (Chrome and Edge) or this browser.
export type PapelizNewVaultPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

interface PapelizBrowserVaultNameDialogProps {
  // New vault, or Rename for a browser vault already in the list.
  browserVaultNameDialogPurpose: 'create' | 'rename'
  renamedBrowserVaultRecord?: PapelizBrowserVaultRecord
  // Chrome and Edge keep both kinds, so New vault asks where; other browsers only keep browser vaults.
  isNewVaultPlaceChoiceShown: boolean
  suggestedBrowserVaultName: string
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  onBrowserVaultNameConfirm: (typedBrowserVaultName: string, chosenNewVaultPlace: PapelizNewVaultPlace) => void
  onBrowserVaultNameCancel: () => void
}

// New vault (its name, and in Chrome and Edge where to keep it) and Rename for a browser vault. A
// name that can't be used says why under the field, and holds the button back. A folder takes its
// name from the folder picked next, so choosing it hides the field.
export function PapelizBrowserVaultNameDialog({
  browserVaultNameDialogPurpose,
  renamedBrowserVaultRecord,
  isNewVaultPlaceChoiceShown,
  suggestedBrowserVaultName,
  existingBrowserVaultRecords,
  onBrowserVaultNameConfirm,
  onBrowserVaultNameCancel,
}: PapelizBrowserVaultNameDialogProps) {
  const browserVaultNameInputRef = useRef<HTMLInputElement>(null)
  const [typedBrowserVaultName, setTypedBrowserVaultName] = useState(suggestedBrowserVaultName)
  const [chosenNewVaultPlace, setChosenNewVaultPlace] = useState<PapelizNewVaultPlace>(isNewVaultPlaceChoiceShown ? 'folder-on-disk' : 'browser-vault-in-opfs')
  const isBrowserVaultNameAsked = chosenNewVaultPlace === 'browser-vault-in-opfs'
  const browserVaultNameProblem = isBrowserVaultNameAsked
    ? findPapelizBrowserVaultNameProblem(typedBrowserVaultName, existingBrowserVaultRecords, renamedBrowserVaultRecord?.papelizVaultId ?? null)
    : null
  const isRenameUnchanged = renamedBrowserVaultRecord !== undefined && typedBrowserVaultName.trim() === renamedBrowserVaultRecord.papelizVaultDisplayName

  // The dialog opens with the name chosen, ready to type over. Its own effect has shown it by now.
  useEffect(() => {
    browserVaultNameInputRef.current?.focus()
    browserVaultNameInputRef.current?.select()
  }, [isBrowserVaultNameAsked])

  const confirmBrowserVaultName = () => {
    if (browserVaultNameProblem !== null) return
    onBrowserVaultNameConfirm(typedBrowserVaultName.trim(), chosenNewVaultPlace)
  }

  return (
    <PapelizConfirmDialog
      confirmDialogTitle={
        browserVaultNameDialogPurpose === 'create' ? 'New vault' : `Rename “${renamedBrowserVaultRecord?.papelizVaultDisplayName ?? ''}”`
      }
      confirmDialogBody={
        <>
          {isNewVaultPlaceChoiceShown && (
            <div className="mb-4">
              <p className="mb-1.5 text-[13px] font-medium text-papeliz-ink">Keep it</p>
              <PapelizSlidingChoiceGroup<PapelizNewVaultPlace>
                slidingChoiceGroupLabel="Keep it"
                slidingChoiceGroupRole="radiogroup"
                slidingChoiceGroupTone="solid-blue"
                slidingChoices={[
                  { slidingChoiceValue: 'folder-on-disk', slidingChoiceContent: 'Folder on disk' },
                  { slidingChoiceValue: 'browser-vault-in-opfs', slidingChoiceContent: 'In this browser' },
                ]}
                chosenSlidingChoiceValue={chosenNewVaultPlace}
                onSlidingChoiceSelect={setChosenNewVaultPlace}
              />
            </div>
          )}
          {browserVaultNameDialogPurpose === 'create' && (
            <p>
              {isBrowserVaultNameAsked
                ? 'It’s kept in this browser. Download a backup now and then.'
                : 'Pick or make a folder next. Your notes are saved in it as Markdown files.'}
            </p>
          )}
          {isBrowserVaultNameAsked && (
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
                  if (!isRenameUnchanged) confirmBrowserVaultName()
                }}
                aria-invalid={browserVaultNameProblem !== null || undefined}
                aria-describedby={browserVaultNameProblem === null ? undefined : 'papeliz-browser-vault-name-problem'}
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
              />
            </label>
          )}
          {browserVaultNameProblem !== null && typedBrowserVaultName.length > 0 && (
            <p id="papeliz-browser-vault-name-problem" role="alert" className="mt-1.5 text-[12.5px] font-medium text-papeliz-diff-removed-ink">
              Can’t use this name ({browserVaultNameProblem})
            </p>
          )}
        </>
      }
      confirmButtonLabel={browserVaultNameDialogPurpose === 'rename' ? 'Rename' : isBrowserVaultNameAsked ? 'Create vault' : 'Pick folder'}
      isConfirmButtonDisabled={browserVaultNameProblem !== null || isRenameUnchanged}
      onConfirm={confirmBrowserVaultName}
      onCancel={onBrowserVaultNameCancel}
    />
  )
}
