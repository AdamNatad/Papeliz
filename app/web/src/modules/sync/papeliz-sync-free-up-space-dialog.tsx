import { useEffect, useId, useState } from 'react'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizListboxSelect } from '../ui/papeliz-listbox-select'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import type { PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncOldVersionDeletionReading } from './papeliz-sync-engine-contract'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine } from './papeliz-sync-page-parts'
import {
  describePapelizSyncActionFailureNow,
  describePapelizSyncOldVersionSpace,
  papelizSyncOldVersionAgeChoices,
  type PapelizSyncOldVersionAgeChoice,
} from './papeliz-sync-screen-words'

// Free Up Space: deletes a synced vault's old versions saved more than 30 days, 90 days or a year ago, or
// all of them, after showing what that frees. The newest version of every file stays. With more than one
// vault on the account, it asks which. Works for any vault on the account, open here or not, locked or
// not, since Sync deletes by version without opening any file.

interface PapelizSyncFreeUpSpaceDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  accountVaults: readonly PapelizSyncAccountVaultReading[]
  // The vault it starts on: the open vault's, else the first.
  initialPapelizSyncVaultId: string | null
  onFreeUpSpaceDone: (freeUpSpaceOutcome: PapelizSyncActionOutcome<PapelizSyncOldVersionDeletionReading>) => void
  onFreeUpSpaceCancel: () => void
}

function readPapelizSyncOldVersionSpaceKey(papelizSyncVaultId: string, oldVersionAgeChoice: PapelizSyncOldVersionAgeChoice): string {
  return `${papelizSyncVaultId}:${oldVersionAgeChoice}`
}

export function PapelizSyncFreeUpSpaceDialog({ papelizSyncEngine, accountVaults, initialPapelizSyncVaultId, onFreeUpSpaceDone, onFreeUpSpaceCancel }: PapelizSyncFreeUpSpaceDialogProps) {
  const vaultFieldId = useId()
  const [chosenPapelizSyncVaultId, setChosenPapelizSyncVaultId] = useState(
    () => accountVaults.find((accountVault) => accountVault.papelizSyncVaultId === initialPapelizSyncVaultId)?.papelizSyncVaultId ?? accountVaults[0]?.papelizSyncVaultId ?? '',
  )
  const [chosenOldVersionAgeChoice, setChosenOldVersionAgeChoice] = useState<PapelizSyncOldVersionAgeChoice>('30-days')
  // What each vault and age would free, read once each.
  const [oldVersionSpaceOutcomesByKey, setOldVersionSpaceOutcomesByKey] = useState<ReadonlyMap<string, PapelizSyncActionOutcome<PapelizSyncOldVersionDeletionReading>>>(new Map())
  const [isFreeUpSpaceRunning, setIsFreeUpSpaceRunning] = useState(false)
  const chosenAgeChoice = papelizSyncOldVersionAgeChoices.find((ageChoice) => ageChoice.oldVersionAgeChoice === chosenOldVersionAgeChoice) ?? papelizSyncOldVersionAgeChoices[0]!
  const chosenOldVersionSpaceKey = readPapelizSyncOldVersionSpaceKey(chosenPapelizSyncVaultId, chosenOldVersionAgeChoice)
  const chosenOldVersionSpaceOutcome = oldVersionSpaceOutcomesByKey.get(chosenOldVersionSpaceKey)

  useEffect(() => {
    if (chosenPapelizSyncVaultId === '' || oldVersionSpaceOutcomesByKey.has(chosenOldVersionSpaceKey)) return
    let isFreeUpSpaceDialogLeft = false
    void papelizSyncEngine.readSyncVaultOldVersionSpace(chosenPapelizSyncVaultId, chosenAgeChoice.syncOldVersionsOlderThanDayCount).then((oldVersionSpaceOutcome) => {
      if (!isFreeUpSpaceDialogLeft) setOldVersionSpaceOutcomesByKey((readOutcomesByKey) => new Map(readOutcomesByKey).set(chosenOldVersionSpaceKey, oldVersionSpaceOutcome))
    })
    return () => {
      isFreeUpSpaceDialogLeft = true
    }
  }, [papelizSyncEngine, chosenPapelizSyncVaultId, chosenAgeChoice, chosenOldVersionSpaceKey, oldVersionSpaceOutcomesByKey])

  const freeUpSpace = async () => {
    setIsFreeUpSpaceRunning(true)
    const freeUpSpaceOutcome = await papelizSyncEngine.deleteSyncVaultOldVersions(chosenPapelizSyncVaultId, chosenAgeChoice.syncOldVersionsOlderThanDayCount)
    setIsFreeUpSpaceRunning(false)
    onFreeUpSpaceDone(freeUpSpaceOutcome)
  }

  const isNothingToDelete = chosenOldVersionSpaceOutcome?.syncActionOutcome !== 'done' || chosenOldVersionSpaceOutcome.syncActionDoneValue.syncOldVersionCount === 0

  return (
    <PapelizConfirmDialog
      confirmDialogTitle="Free Up Space"
      confirmDialogBody={
        <>
          <p>Delete old versions from Sync, on every device. The newest version of every file stays, and so do the files on your devices.</p>
          {accountVaults.length > 1 && (
            <>
              <label id={`${vaultFieldId}-label`} htmlFor={vaultFieldId} className="mt-4 mb-1.5 block text-[13px] font-medium text-papeliz-ink">
                Vault
              </label>
              <PapelizListboxSelect
                listboxSelectTriggerId={vaultFieldId}
                listboxSelectLabelId={`${vaultFieldId}-label`}
                listboxSelectOptions={accountVaults.map((accountVault) => ({ listboxOptionValue: accountVault.papelizSyncVaultId, listboxOptionLabel: accountVault.syncVaultName }))}
                chosenListboxOptionValue={chosenPapelizSyncVaultId}
                isListboxSelectDisabled={isFreeUpSpaceRunning}
                onListboxOptionChoose={setChosenPapelizSyncVaultId}
              />
            </>
          )}
          <p className="mt-4 mb-1.5 text-[13px] font-medium text-papeliz-ink">Old Versions to Delete</p>
          <PapelizSlidingChoiceGroup<PapelizSyncOldVersionAgeChoice>
            slidingChoiceGroupLabel="Old versions to delete"
            slidingChoiceGroupRole="radiogroup"
            slidingChoices={papelizSyncOldVersionAgeChoices.map((ageChoice) => ({ slidingChoiceValue: ageChoice.oldVersionAgeChoice, slidingChoiceContent: ageChoice.oldVersionAgeChoiceLabel }))}
            chosenSlidingChoiceValue={chosenOldVersionAgeChoice}
            onSlidingChoiceSelect={(oldVersionAgeChoice) => {
              if (!isFreeUpSpaceRunning) setChosenOldVersionAgeChoice(oldVersionAgeChoice)
            }}
          />
          <div className="mt-3 min-h-[2.9em] text-[13px] leading-[1.45]" aria-live="polite">
            {chosenOldVersionSpaceOutcome === undefined ? (
              <PapelizSyncLoadingLine>Reading what this frees…</PapelizSyncLoadingLine>
            ) : chosenOldVersionSpaceOutcome.syncActionOutcome === 'failed' ? (
              <PapelizSyncFailureLine>{describePapelizSyncActionFailureNow(chosenOldVersionSpaceOutcome)}</PapelizSyncFailureLine>
            ) : (
              <p>
                {describePapelizSyncOldVersionSpace(chosenOldVersionSpaceOutcome.syncActionDoneValue, chosenAgeChoice.syncOldVersionsOlderThanDayCount)}
                {chosenOldVersionSpaceOutcome.syncActionDoneValue.syncOldVersionCount > 0 && ' This can’t be undone.'}
              </p>
            )}
          </div>
        </>
      }
      confirmButtonLabel={isFreeUpSpaceRunning ? 'Deleting…' : 'Delete Old Versions'}
      isConfirmActionDangerous
      isConfirmButtonDisabled={isFreeUpSpaceRunning || isNothingToDelete}
      onConfirm={() => void freeUpSpace()}
      onCancel={() => {
        if (!isFreeUpSpaceRunning) onFreeUpSpaceCancel()
      }}
    />
  )
}
