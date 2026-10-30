import { AppWindow, FolderOpen, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizInfoTip } from '../ui/papeliz-info-tip'
import { PapelizSolidCircleCheckIcon, PapelizSolidCircleXIcon } from '../ui/papeliz-solid-circle-icons'
import { findPapelizBrowserVaultNameProblem, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { PapelizBrowserVaultNameField } from './papeliz-browser-vault-name-field'

// Where a new vault is kept: a folder on the disk (Chrome, Edge and Brave) or this browser.
export type PapelizNewVaultPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// The help guide on starting, opening and importing a vault.
const papelizNewVaultHelpArticleUrl = 'https://papeliz.com/help/open-a-folder/'
const papelizNewVaultHelpLinkLabel = 'Help: start or open a vault'

type PapelizNewVaultPlaceBadgeTone = 'recommended' | 'risky' | 'off'

interface PapelizNewVaultPlaceDescription {
  newVaultPlace: PapelizNewVaultPlace
  NewVaultPlaceIcon: LucideIcon
  newVaultPlaceTitle: string
  newVaultPlaceBadgeText: string
  newVaultPlaceBadgeTone: PapelizNewVaultPlaceBadgeTone
  newVaultPlaceLine: string
}

const papelizNewVaultPlaceDescriptions: readonly PapelizNewVaultPlaceDescription[] = [
  {
    newVaultPlace: 'folder-on-disk',
    NewVaultPlaceIcon: FolderOpen,
    newVaultPlaceTitle: 'Folder Storage',
    newVaultPlaceBadgeText: 'Recommended',
    newVaultPlaceBadgeTone: 'recommended',
    newVaultPlaceLine: 'Stores your notes in a folder on your machine',
  },
  {
    newVaultPlace: 'browser-vault-in-opfs',
    NewVaultPlaceIcon: AppWindow,
    newVaultPlaceTitle: 'Browser Storage',
    newVaultPlaceBadgeText: 'Risky',
    newVaultPlaceBadgeTone: 'risky',
    newVaultPlaceLine: 'Stores your notes inside this browser',
  },
]

const papelizNewVaultPlaceBadgeToneClassNames: Record<PapelizNewVaultPlaceBadgeTone, string> = {
  recommended: 'border-papeliz-diff-added-ink/30 bg-papeliz-diff-added text-papeliz-diff-added-ink',
  risky: 'border-papeliz-diff-removed-ink/30 bg-papeliz-diff-removed text-papeliz-diff-removed-ink',
  off: 'border-papeliz-diff-removed-ink/30 bg-papeliz-diff-removed text-papeliz-diff-removed-ink',
}

// One cell of the comparison: a short value, and its info icon's title and points.
interface PapelizNewVaultPlaceComparisonCell {
  comparisonCellText: string
  comparisonCellInfoTipTitle: string
  comparisonCellInfoTipLines: readonly string[]
}

interface PapelizNewVaultPlaceComparisonRow {
  comparisonRowLabel: string
  comparisonRowCellByPlace: Record<PapelizNewVaultPlace, PapelizNewVaultPlaceComparisonCell>
}

// The comparison under the cards: one short value per place, so nothing wraps, each with an info icon
// that explains it.
const papelizNewVaultPlaceComparisonRows: readonly PapelizNewVaultPlaceComparisonRow[] = [
  {
    comparisonRowLabel: 'Saved in',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'A folder on your computer',
        comparisonCellInfoTipTitle: 'A folder you choose',
        comparisonCellInfoTipLines: [
          'Each note is saved as a file in that folder.',
          'You can open, copy and back up your notes like any other file.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'This browser',
        comparisonCellInfoTipTitle: 'Inside this browser',
        comparisonCellInfoTipLines: [
          'Your notes are kept in this browser’s own storage, not in a folder you can see.',
          'Only this browser on this device has them.',
        ],
      },
    },
  },
  {
    comparisonRowLabel: 'Kept',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'Until you delete them',
        comparisonCellInfoTipTitle: 'Stays on your machine',
        comparisonCellInfoTipLines: [
          'Your notes stay in the folder until you move or delete them.',
          'Clearing your browser’s data or uninstalling the browser won’t delete them.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'Temporary',
        comparisonCellInfoTipTitle: 'Temporary storage',
        comparisonCellInfoTipLines: [
          'Clearing this site’s data in your browser deletes the vault and every note in it.',
          'Safari keeps it for 7 days of use without opening Papeliz; after that it can delete it.',
          'Other browsers keep it until you clear it, unless the device runs very low on space.',
          'Download a backup now and then to keep a copy.',
        ],
      },
    },
  },
  {
    comparisonRowLabel: 'Works in',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'Chrome, Edge and Brave',
        comparisonCellInfoTipTitle: 'Needs folder access',
        comparisonCellInfoTipLines: [
          'Opening a folder on your disk needs a browser feature that Chrome, Edge and Brave have on a computer.',
          'Firefox, Safari and phone browsers can’t open folders, so they use Browser Storage.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'Most browsers, incl. non-Chromium',
        comparisonCellInfoTipTitle: 'Works almost everywhere',
        comparisonCellInfoTipLines: [
          'Chromium-based browsers like Chrome, Edge and Brave, and non-Chromium based browsers like Firefox and Safari.',
          'Chrome and Edge 103, Firefox 113 and Safari 16.4 or later, on computers and phones.',
          'Each browser keeps its own vaults: another browser on this device can’t see them.',
        ],
      },
    },
  },
]

// Cancel and the action: flat, square-cornered and one width (the footer's ref sets it).
const newVaultFormFooterButtonClassName =
  'inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-md border border-black/10 px-3 text-[13px] font-medium whitespace-nowrap text-white transition-[filter,transform] duration-150 ease-out hover:brightness-[.94] active:scale-[.99] disabled:pointer-events-none disabled:opacity-50'

interface PapelizNewVaultFormProps {
  newVaultFormHeadingId: string
  // Why this browser can't keep a vault in a folder, or null when it can. The folder card then stays,
  // greyed, and says why.
  folderAccessOffReasonText: string | null
  suggestedBrowserVaultName: string
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  onNewVaultConfirm: (typedBrowserVaultName: string, chosenNewVaultPlace: PapelizNewVaultPlace) => void
  onNewVaultCancel: () => void
}

// New Vault, in the start card in place of Recent Vaults: the two places as cards (an icon tile, a
// badge, one line and a radio at the right edge) and a comparison under them, with Cancel at the left
// edge and the action at the right. Browser Storage asks for the new vault's name in its card; a folder
// takes its name from the folder picked next. Esc cancels.
export function PapelizNewVaultForm({
  newVaultFormHeadingId,
  folderAccessOffReasonText,
  suggestedBrowserVaultName,
  existingBrowserVaultRecords,
  onNewVaultConfirm,
  onNewVaultCancel,
}: PapelizNewVaultFormProps) {
  const newVaultFormRef = useRef<HTMLDivElement>(null)
  const browserVaultNameInputRef = useRef<HTMLInputElement>(null)
  const newVaultFormFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const newVaultFormIdPrefix = useId()
  const newVaultPlacePromptId = `${newVaultFormIdPrefix}-place-prompt`
  const folderAccessOffReasonId = `${newVaultFormIdPrefix}-folder-access-off-reason`
  const isFolderVaultOn = folderAccessOffReasonText === null
  const [typedBrowserVaultName, setTypedBrowserVaultName] = useState(suggestedBrowserVaultName)
  const [chosenNewVaultPlace, setChosenNewVaultPlace] = useState<PapelizNewVaultPlace>(isFolderVaultOn ? 'folder-on-disk' : 'browser-vault-in-opfs')
  const isBrowserVaultNameAsked = chosenNewVaultPlace === 'browser-vault-in-opfs'
  const browserVaultNameProblem = isBrowserVaultNameAsked ? findPapelizBrowserVaultNameProblem(typedBrowserVaultName, existingBrowserVaultRecords, null) : null

  // The Name field opens with the name chosen, ready to type over.
  useEffect(() => {
    browserVaultNameInputRef.current?.focus()
    browserVaultNameInputRef.current?.select()
  }, [isBrowserVaultNameAsked])

  // Opened from New Vault: focus moves to the chosen place, unless the Name field took it above.
  useEffect(() => {
    if (document.activeElement === browserVaultNameInputRef.current) return
    newVaultFormRef.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus()
  }, [])

  const confirmNewVault = () => {
    if (browserVaultNameProblem !== null) return
    onNewVaultConfirm(typedBrowserVaultName.trim(), chosenNewVaultPlace)
  }

  return (
    <div
      ref={newVaultFormRef}
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onNewVaultCancel()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        <div className="flex items-center gap-2">
          <h2 id={newVaultFormHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
            New Vault
          </h2>
          <a
            href={papelizNewVaultHelpArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={papelizNewVaultHelpLinkLabel}
            title={papelizNewVaultHelpLinkLabel}
            className="grid size-[22px] flex-none place-items-center rounded-full border border-papeliz-line text-[12.5px] leading-none font-bold text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft hover:text-papeliz-blue"
          >
            ?
          </a>
        </div>
        <p id={newVaultPlacePromptId} className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">
          Choose where to keep this vault.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-2.5 pb-3">
        <div role="radiogroup" aria-labelledby={newVaultPlacePromptId} className="flex flex-col gap-2">
          {papelizNewVaultPlaceDescriptions.map((newVaultPlaceDescription) => {
            const { newVaultPlace, NewVaultPlaceIcon } = newVaultPlaceDescription
            const isNewVaultPlaceChosen = newVaultPlace === chosenNewVaultPlace
            const isNewVaultPlaceOff = newVaultPlace === 'folder-on-disk' && !isFolderVaultOn
            return (
              <div
                key={newVaultPlace}
                className={joinPapelizClassNames(
                  'rounded-xl border transition-colors',
                  isNewVaultPlaceChosen
                    ? 'border-papeliz-blue-line bg-papeliz-blue-soft'
                    : isNewVaultPlaceOff
                      ? 'border-papeliz-line bg-papeliz-surface-soft'
                      : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-hover',
                )}
              >
                {/* Icon tile, then the title, its badge and its line; the radio sits at the right edge. An
                    off card dims all but its badge, and its line says why. */}
                <label className={joinPapelizClassNames('flex items-center gap-3 px-3.5 py-2.5', isNewVaultPlaceOff ? 'cursor-not-allowed' : 'cursor-pointer')}>
                  <span
                    aria-hidden="true"
                    className={joinPapelizClassNames(
                      'grid size-9 flex-none place-items-center rounded-[9px] transition-colors',
                      isNewVaultPlaceChosen ? 'bg-papeliz-chosen-tab-ground text-white' : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
                      isNewVaultPlaceOff && 'opacity-55',
                    )}
                  >
                    <NewVaultPlaceIcon className="size-[19px]" />
                  </span>
                  <input
                    type="radio"
                    name={`${newVaultFormIdPrefix}-new-vault-place`}
                    value={newVaultPlace}
                    checked={isNewVaultPlaceChosen}
                    disabled={isNewVaultPlaceOff}
                    aria-describedby={isNewVaultPlaceOff ? folderAccessOffReasonId : undefined}
                    onChange={() => setChosenNewVaultPlace(newVaultPlace)}
                    className={joinPapelizClassNames('order-last size-4 flex-none accent-papeliz-blue', isNewVaultPlaceOff ? 'opacity-55' : 'cursor-pointer')}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px] whitespace-nowrap">
                    <span className="flex min-w-0 items-center gap-2 text-[14.5px] leading-tight font-semibold text-papeliz-ink">
                      <span className={joinPapelizClassNames(isNewVaultPlaceOff && 'opacity-55')}>{newVaultPlaceDescription.newVaultPlaceTitle}</span>
                      <span
                        className={joinPapelizClassNames(
                          'rounded-full border px-1.5 py-px text-[10px] leading-snug font-semibold',
                          papelizNewVaultPlaceBadgeToneClassNames[isNewVaultPlaceOff ? 'off' : newVaultPlaceDescription.newVaultPlaceBadgeTone],
                        )}
                      >
                        {isNewVaultPlaceOff ? 'Off in this browser' : newVaultPlaceDescription.newVaultPlaceBadgeText}
                      </span>
                    </span>
                    {isNewVaultPlaceOff ? (
                      <span id={folderAccessOffReasonId} className="truncate text-[12.5px] leading-snug font-medium max-sm:whitespace-normal text-papeliz-diff-removed-ink">
                        {folderAccessOffReasonText}
                      </span>
                    ) : (
                      <span className="truncate text-[12.5px] leading-snug text-papeliz-ink-subtle max-sm:whitespace-normal">{newVaultPlaceDescription.newVaultPlaceLine}</span>
                    )}
                  </span>
                </label>
                {/* The name, lined up under the title: the card's edge (14px), the tile (36px) and its gap (12px). */}
                {isNewVaultPlaceChosen && newVaultPlace === 'browser-vault-in-opfs' && (
                  <div className="pr-3.5 pb-3 pl-[62px]">
                    <PapelizBrowserVaultNameField
                      browserVaultNameInputRef={browserVaultNameInputRef}
                      typedBrowserVaultName={typedBrowserVaultName}
                      browserVaultNameProblem={browserVaultNameProblem}
                      browserVaultNameProblemId={`${newVaultFormIdPrefix}-name-problem`}
                      browserVaultNameFieldLayout="label-beside-field"
                      onBrowserVaultNameType={setTypedBrowserVaultName}
                      onBrowserVaultNameSubmit={confirmNewVault}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* The comparison: what each place means, side by side; the chosen place's column lights up. Every
            cell stays on one line, so a phone scrolls the table sideways. */}
        <div className="relative flex-none overflow-x-auto rounded-xl border border-papeliz-line bg-papeliz-surface-soft">
          <table className="w-full border-collapse text-[12px] leading-snug">
            <caption className="sr-only">How the two places compare</caption>
            <thead>
              <tr>
                <td className="w-px" />
                {papelizNewVaultPlaceDescriptions.map(({ newVaultPlace, NewVaultPlaceIcon, newVaultPlaceTitle }) => (
                  <th
                    key={newVaultPlace}
                    scope="col"
                    className={joinPapelizClassNames(
                      'px-2.5 py-[5px] text-left font-semibold whitespace-nowrap text-papeliz-ink transition-colors duration-300',
                      newVaultPlace === chosenNewVaultPlace && 'bg-papeliz-blue-soft',
                      newVaultPlace === 'folder-on-disk' && !isFolderVaultOn && 'opacity-55',
                    )}
                  >
                    <NewVaultPlaceIcon
                      className={joinPapelizClassNames('mr-1.5 inline size-[13px] align-[-2px]', newVaultPlace === chosenNewVaultPlace ? 'text-papeliz-blue' : 'text-papeliz-ink-muted')}
                      aria-hidden="true"
                    />
                    {newVaultPlaceTitle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {papelizNewVaultPlaceComparisonRows.map((comparisonRow) => (
                <tr key={comparisonRow.comparisonRowLabel} className="border-t border-papeliz-line">
                  <th scope="row" className="w-px px-2.5 py-[5px] text-left font-medium whitespace-nowrap text-papeliz-ink-subtle">
                    {comparisonRow.comparisonRowLabel}
                  </th>
                  {papelizNewVaultPlaceDescriptions.map(({ newVaultPlace, newVaultPlaceTitle }) => {
                    const comparisonCell = comparisonRow.comparisonRowCellByPlace[newVaultPlace]
                    return (
                      <td
                        key={newVaultPlace}
                        className={joinPapelizClassNames(
                          'px-2.5 py-[5px] whitespace-nowrap transition-colors duration-300',
                          newVaultPlace === chosenNewVaultPlace ? 'bg-papeliz-blue-soft text-papeliz-ink' : 'text-papeliz-ink-muted',
                          newVaultPlace === 'folder-on-disk' && !isFolderVaultOn && 'opacity-55',
                        )}
                      >
                        {comparisonCell.comparisonCellText}
                        <PapelizInfoTip
                          infoTipButtonLabel={`About “${comparisonCell.comparisonCellText}” in ${newVaultPlaceTitle}`}
                          infoTipTitle={comparisonCell.comparisonCellInfoTipTitle}
                          infoTipLines={comparisonCell.comparisonCellInfoTipLines}
                          infoTipButtonClassName="-my-0.5 ml-1.5"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel at the left edge, the action at the right, so the two never sit side by side. */}
      <div ref={newVaultFormFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onNewVaultCancel} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, 'bg-papeliz-red-gradient-start')}>
          <PapelizSolidCircleXIcon className="size-[15px] flex-none" />
          Cancel
        </button>
        <button
          type="button"
          disabled={browserVaultNameProblem !== null}
          onClick={confirmNewVault}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, 'bg-papeliz-chosen-tab-ground')}
        >
          <PapelizSolidCircleCheckIcon className="size-[15px] flex-none" />
          {isBrowserVaultNameAsked ? 'Create Vault' : 'Pick Folder'}
        </button>
      </div>
    </div>
  )
}
