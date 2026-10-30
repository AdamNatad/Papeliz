import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { isPapelizSyncPassphraseLongEnough, papelizSyncPassphraseStrengthWords, ratePapelizSyncPassphraseStrength } from './papeliz-sync-screen-words'

export const papelizSyncTextFieldClassName =
  'h-10 w-full min-w-0 rounded-xl border border-papeliz-line-strong bg-papeliz-surface px-3 text-[14px] text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle focus:border-papeliz-blue focus:ring-2 focus:ring-papeliz-blue/20'

interface PapelizSyncPassphraseFieldProps {
  syncPassphraseFieldLabel: string
  syncPassphrase: string
  onSyncPassphraseChange: (syncPassphrase: string) => void
  isSyncPassphraseShown: boolean
  onSyncPassphraseShownToggle?: () => void
  syncPassphraseAutoComplete: 'new-password' | 'current-password'
  isSyncPassphraseFieldFocusedFirst?: boolean
}

export function PapelizSyncPassphraseField({
  syncPassphraseFieldLabel,
  syncPassphrase,
  onSyncPassphraseChange,
  isSyncPassphraseShown,
  onSyncPassphraseShownToggle,
  syncPassphraseAutoComplete,
  isSyncPassphraseFieldFocusedFirst = false,
}: PapelizSyncPassphraseFieldProps) {
  const syncPassphraseFieldId = useId()
  return (
    <div>
      <label htmlFor={syncPassphraseFieldId} className="mb-1 block text-[12px] font-medium text-papeliz-ink-subtle">
        {syncPassphraseFieldLabel}
      </label>
      <div className="relative">
        <input
          id={syncPassphraseFieldId}
          type={isSyncPassphraseShown ? 'text' : 'password'}
          value={syncPassphrase}
          onChange={(changeEvent) => onSyncPassphraseChange(changeEvent.target.value)}
          autoComplete={syncPassphraseAutoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // The first field of a step; the dialog has just opened from a click.
          autoFocus={isSyncPassphraseFieldFocusedFirst}
          className={joinPapelizClassNames(papelizSyncTextFieldClassName, onSyncPassphraseShownToggle !== undefined && 'pr-10')}
        />
        {onSyncPassphraseShownToggle !== undefined && (
          <button
            type="button"
            aria-label={isSyncPassphraseShown ? 'Hide passphrase' : 'Show passphrase'}
            title={isSyncPassphraseShown ? 'Hide passphrase' : 'Show passphrase'}
            aria-pressed={isSyncPassphraseShown}
            onClick={onSyncPassphraseShownToggle}
            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-papeliz-ink-subtle hover:bg-papeliz-hover hover:text-papeliz-ink"
          >
            {isSyncPassphraseShown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  )
}

interface PapelizSyncNewPassphraseFieldsProps {
  newSyncPassphrase: string
  onNewSyncPassphraseChange: (newSyncPassphrase: string) => void
  repeatedSyncPassphrase: string
  onRepeatedSyncPassphraseChange: (repeatedSyncPassphrase: string) => void
  newSyncPassphraseFieldLabel?: string
}

// A new passphrase, typed twice, with the strength meter. The rule is the engine's: 12 characters
// or more, counted after NFC.
export function PapelizSyncNewPassphraseFields({
  newSyncPassphrase,
  onNewSyncPassphraseChange,
  repeatedSyncPassphrase,
  onRepeatedSyncPassphraseChange,
  newSyncPassphraseFieldLabel = 'Sync passphrase',
}: PapelizSyncNewPassphraseFieldsProps) {
  const [isSyncPassphraseShown, setIsSyncPassphraseShown] = useState(false)
  const syncPassphraseStrength = ratePapelizSyncPassphraseStrength(newSyncPassphrase)
  const isRepeatedPassphraseDifferent = repeatedSyncPassphrase !== '' && repeatedSyncPassphrase.normalize('NFC') !== newSyncPassphrase.normalize('NFC')
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <PapelizSyncPassphraseField
          syncPassphraseFieldLabel={newSyncPassphraseFieldLabel}
          syncPassphrase={newSyncPassphrase}
          onSyncPassphraseChange={onNewSyncPassphraseChange}
          isSyncPassphraseShown={isSyncPassphraseShown}
          onSyncPassphraseShownToggle={() => setIsSyncPassphraseShown(!isSyncPassphraseShown)}
          syncPassphraseAutoComplete="new-password"
          isSyncPassphraseFieldFocusedFirst
        />
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((strengthBarNumber) => (
            <span
              key={strengthBarNumber}
              className={joinPapelizClassNames(
                'h-1 flex-1 rounded-full',
                syncPassphraseStrength >= strengthBarNumber ? (syncPassphraseStrength <= 1 ? 'bg-papeliz-warning-ink' : 'bg-papeliz-ok') : 'bg-papeliz-surface-gray',
              )}
            />
          ))}
        </div>
        <p className="mt-1 text-[11.5px] text-papeliz-ink-subtle" aria-live="polite">
          {newSyncPassphrase === '' ? 'At least 12 characters. A few unrelated words make a strong one.' : papelizSyncPassphraseStrengthWords[syncPassphraseStrength]}
        </p>
      </div>
      <div>
        <PapelizSyncPassphraseField
          syncPassphraseFieldLabel="Type it again"
          syncPassphrase={repeatedSyncPassphrase}
          onSyncPassphraseChange={onRepeatedSyncPassphraseChange}
          isSyncPassphraseShown={isSyncPassphraseShown}
          syncPassphraseAutoComplete="new-password"
        />
        {isRepeatedPassphraseDifferent && <p className="mt-1 text-[11.5px] text-papeliz-diff-removed-ink">The two don’t match yet.</p>}
      </div>
    </div>
  )
}

export function isPapelizSyncNewPassphraseReady(newSyncPassphrase: string, repeatedSyncPassphrase: string): boolean {
  return isPapelizSyncPassphraseLongEnough(newSyncPassphrase) && newSyncPassphrase.normalize('NFC') === repeatedSyncPassphrase.normalize('NFC')
}
