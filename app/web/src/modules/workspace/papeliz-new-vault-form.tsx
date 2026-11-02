import { AppWindow, FolderOpen, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { papelizMainActionButtonColorClassName, papelizOutlineButtonColorClassName } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizInfoTip } from '../ui/papeliz-info-tip'
import { findPapelizBrowserVaultNameProblem, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { findPapelizNewFolderVaultNameProblem } from '../vault/papeliz-open-vault'
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
    comparisonRowLabel: 'Location',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'Your chosen folder',
        comparisonCellInfoTipTitle: 'Your notes, your folder',
        comparisonCellInfoTipLines: [
          'Every note is saved as a Markdown file in a folder you choose.',
          'You can open, edit, move, and back up your notes outside Papeliz.',
          'Your files remain accessible through your computer’s file manager.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'Inside your browser',
        comparisonCellInfoTipTitle: 'Saved inside your browser',
        comparisonCellInfoTipLines: [
          'Your notes are stored in your browser’s private storage instead of a regular folder.',
          'Your vaults are kept separately in each browser profile.',
          'Other browsers and devices cannot access them automatically.',
        ],
      },
    },
  },
  {
    comparisonRowLabel: 'Duration',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'Until removed',
        comparisonCellInfoTipTitle: 'Independent of your browser',
        comparisonCellInfoTipLines: [
          'Your notes remain in your chosen folder until they’re moved or deleted.',
          'Clearing browser data or uninstalling your browser won’t delete your notes.',
          'Your files remain accessible even without Papeliz.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'Not guaranteed',
        comparisonCellInfoTipTitle: 'Your browser controls storage',
        comparisonCellInfoTipLines: [
          'Your notes remain saved when you close Papeliz or restart your browser.',
          'Clearing Papeliz’s site data permanently deletes your browser vaults.',
          'Safari may remove stored data after seven days of Safari use without interacting with Papeliz.',
          'Browsers may also remove stored data when your device runs low on space.',
          'Download backups regularly to keep your notes safe.',
        ],
      },
    },
  },
  {
    comparisonRowLabel: 'Compatibility',
    comparisonRowCellByPlace: {
      'folder-on-disk': {
        comparisonCellText: 'Chrome, Edge and Brave',
        comparisonCellInfoTipTitle: 'Requires folder access',
        comparisonCellInfoTipLines: [
          'Folder Storage works in supported desktop browsers, including Chrome, Edge, and Brave.',
          'Your browser must support opening and saving files directly in a folder.',
          'Firefox, Safari, and most mobile browsers use Browser Storage instead.',
        ],
      },
      'browser-vault-in-opfs': {
        comparisonCellText: 'Most modern browsers',
        comparisonCellInfoTipTitle: 'Works across most modern browsers',
        comparisonCellInfoTipLines: [
          'Browser Storage works in supported versions of Chrome, Edge, Brave, Firefox, and Safari.',
          'It uses OPFS (Origin Private File System), a private storage area for saving files inside your browser.',
          'Your vaults remain separate between browsers, browser profiles, and devices.',
        ],
      },
    },
  },
]

// Cancel and the action: pills of one width (the footer's ref sets it), like a dialog's. Fetch from
// Sync's page uses the same.
export const newVaultFormFooterButtonClassName =
  'inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color,filter,transform] duration-150 ease-out active:scale-[.97] disabled:pointer-events-none disabled:opacity-50'
// Their colors, every main button's (papeliz-buttons.tsx): Cancel is white with an outline and turns
// soft blue when hovered; the action is solid blue. The Synced Vaults page and the browser vault
// Rename dialog use them too.
export const newVaultFormFooterCancelButtonColorClassName = papelizOutlineButtonColorClassName
export const newVaultFormFooterActionButtonColorClassName = papelizMainActionButtonColorClassName

interface PapelizNewVaultFormProps {
  newVaultFormHeadingId: string
  // Why this browser can't keep a vault in a folder, or in the browser, or null when it can. That card
  // then stays, greyed, and says why.
  folderAccessOffReasonText: string | null
  browserVaultOffReasonText: string | null
  suggestedNewVaultName: string
  // The place chosen when the form opens; by default a folder where folders work. The form comes back
  // on the place it had when making a folder vault didn't go through.
  initialNewVaultPlace?: PapelizNewVaultPlace
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  // Use Template opens the form on a template: it is named at the top with how reading its files is
  // going, Cancel goes back to it, and the action waits until its files are read and checked.
  newVaultFromTemplate?: { newVaultTemplateName: string; newVaultTemplateDetailLine: string; newVaultTemplateThumbnail: ReactNode; newVaultTemplateStatus: ReactNode }
  isNewVaultConfirmHeld?: boolean
  onNewVaultConfirm: (typedNewVaultName: string, chosenNewVaultPlace: PapelizNewVaultPlace) => void
  onNewVaultCancel: () => void
}

// New Vault, in the start card in place of Recent Vaults: the vault's name first (every vault has one),
// then the two places as cards (an icon tile, a badge, one line and a radio at the right edge) and a
// comparison under them, with Cancel at the left edge and the action at the right. A browser vault is
// made under the name; a folder vault is a new folder of that name, made in the place picked next. The
// action stays off until the name can be used, and says why under the field. Esc cancels. From Use
// Template, the template it starts from sits above the name.
export function PapelizNewVaultForm({
  newVaultFormHeadingId,
  folderAccessOffReasonText,
  browserVaultOffReasonText,
  suggestedNewVaultName,
  initialNewVaultPlace,
  existingBrowserVaultRecords,
  newVaultFromTemplate,
  isNewVaultConfirmHeld = false,
  onNewVaultConfirm,
  onNewVaultCancel,
}: PapelizNewVaultFormProps) {
  const newVaultNameInputRef = useRef<HTMLInputElement>(null)
  const newVaultFormFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const newVaultFormIdPrefix = useId()
  const newVaultPlacePromptId = `${newVaultFormIdPrefix}-place-prompt`
  const newVaultPlaceOffReasonTexts: Record<PapelizNewVaultPlace, string | null> = {
    'folder-on-disk': folderAccessOffReasonText,
    'browser-vault-in-opfs': browserVaultOffReasonText,
  }
  const isFolderVaultOn = folderAccessOffReasonText === null
  const [typedNewVaultName, setTypedNewVaultName] = useState(suggestedNewVaultName)
  const [chosenNewVaultPlace, setChosenNewVaultPlace] = useState<PapelizNewVaultPlace>(
    initialNewVaultPlace !== undefined && newVaultPlaceOffReasonTexts[initialNewVaultPlace] === null
      ? initialNewVaultPlace
      : isFolderVaultOn
        ? 'folder-on-disk'
        : 'browser-vault-in-opfs',
  )
  const isFolderVaultChosen = chosenNewVaultPlace === 'folder-on-disk'
  const newVaultNameProblem = isFolderVaultChosen
    ? findPapelizNewFolderVaultNameProblem(typedNewVaultName)
    : findPapelizBrowserVaultNameProblem(typedNewVaultName, existingBrowserVaultRecords, null)

  // The Name field opens with the name chosen, ready to type over.
  useEffect(() => {
    newVaultNameInputRef.current?.focus()
    newVaultNameInputRef.current?.select()
  }, [])

  const confirmNewVault = () => {
    if (newVaultNameProblem !== null || isNewVaultConfirmHeld) return
    onNewVaultConfirm(typedNewVaultName.trim(), chosenNewVaultPlace)
  }

  return (
    <div
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-2 pb-3">
        {newVaultFromTemplate !== undefined && (
          <div className="flex flex-none flex-col gap-2 rounded-xl border border-papeliz-line bg-papeliz-surface-soft px-2.5 py-2">
            <div className="flex items-center gap-3">
              {newVaultFromTemplate.newVaultTemplateThumbnail}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-semibold">From {newVaultFromTemplate.newVaultTemplateName}</span>
                <span className="truncate text-[11.5px] text-papeliz-ink-subtle">{newVaultFromTemplate.newVaultTemplateDetailLine}</span>
              </span>
            </div>
            {newVaultFromTemplate.newVaultTemplateStatus}
          </div>
        )}
        <div>
          <PapelizBrowserVaultNameField
            browserVaultNameInputRef={newVaultNameInputRef}
            typedBrowserVaultName={typedNewVaultName}
            browserVaultNameProblem={newVaultNameProblem}
            browserVaultNameProblemId={`${newVaultFormIdPrefix}-name-problem`}
            onBrowserVaultNameType={setTypedNewVaultName}
            onBrowserVaultNameSubmit={confirmNewVault}
          />
        </div>
        <p id={newVaultPlacePromptId} className="mt-1 text-[12.5px] text-papeliz-ink-muted">
          Choose where to keep this vault.
        </p>
        <div role="radiogroup" aria-labelledby={newVaultPlacePromptId} className="flex flex-col gap-2">
          {papelizNewVaultPlaceDescriptions.map((newVaultPlaceDescription) => {
            const { newVaultPlace, NewVaultPlaceIcon } = newVaultPlaceDescription
            const isNewVaultPlaceChosen = newVaultPlace === chosenNewVaultPlace
            const newVaultPlaceOffReasonText = newVaultPlaceOffReasonTexts[newVaultPlace]
            const isNewVaultPlaceOff = newVaultPlaceOffReasonText !== null
            const newVaultPlaceOffReasonId = `${newVaultFormIdPrefix}-${newVaultPlace}-off-reason`
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
                    aria-describedby={isNewVaultPlaceOff ? newVaultPlaceOffReasonId : undefined}
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
                      <span id={newVaultPlaceOffReasonId} className="truncate text-[12.5px] leading-snug font-medium max-sm:whitespace-normal text-papeliz-diff-removed-ink">
                        {newVaultPlaceOffReasonText}
                      </span>
                    ) : (
                      <span className="truncate text-[12.5px] leading-snug text-papeliz-ink-subtle max-sm:whitespace-normal">{newVaultPlaceDescription.newVaultPlaceLine}</span>
                    )}
                  </span>
                </label>
              </div>
            )
          })}
        </div>

        {/* The comparison: what each place means, side by side; the chosen place's column lights up. Every
            cell stays on one line. Too narrow for that (a phone), each place gets its own short list,
            one under the other, the chosen one lit. */}
        <div className="flex flex-none flex-col gap-2 sm:hidden">
          {papelizNewVaultPlaceDescriptions.map(({ newVaultPlace, NewVaultPlaceIcon, newVaultPlaceTitle }) => (
            <div
              key={newVaultPlace}
              className={joinPapelizClassNames(
                'rounded-xl border border-papeliz-line text-[12px] leading-snug transition-colors duration-300',
                newVaultPlace === chosenNewVaultPlace ? 'bg-papeliz-blue-soft' : 'bg-papeliz-surface-soft',
                newVaultPlaceOffReasonTexts[newVaultPlace] !== null && 'opacity-55',
              )}
            >
              <h3 className="px-2.5 py-[5px] font-semibold text-papeliz-ink">
                <NewVaultPlaceIcon
                  className={joinPapelizClassNames('mr-1.5 inline size-[13px] align-[-2px]', newVaultPlace === chosenNewVaultPlace ? 'text-papeliz-blue' : 'text-papeliz-ink-muted')}
                  aria-hidden="true"
                />
                {newVaultPlaceTitle}
              </h3>
              <dl>
                {papelizNewVaultPlaceComparisonRows.map((comparisonRow) => {
                  const comparisonCell = comparisonRow.comparisonRowCellByPlace[newVaultPlace]
                  return (
                    <div key={comparisonRow.comparisonRowLabel} className="flex items-center justify-between gap-3 border-t border-papeliz-line px-2.5 py-[5px]">
                      <dt className="font-medium whitespace-nowrap text-papeliz-ink-subtle">{comparisonRow.comparisonRowLabel}</dt>
                      <dd className={joinPapelizClassNames('flex min-w-0 items-center text-right', newVaultPlace === chosenNewVaultPlace ? 'text-papeliz-ink' : 'text-papeliz-ink-muted')}>
                        {comparisonCell.comparisonCellText}
                        <PapelizInfoTip
                          infoTipButtonLabel={`About “${comparisonCell.comparisonCellText}” in ${newVaultPlaceTitle}`}
                          infoTipTitle={comparisonCell.comparisonCellInfoTipTitle}
                          infoTipLines={comparisonCell.comparisonCellInfoTipLines}
                          infoTipButtonClassName="-my-0.5 ml-1.5"
                        />
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>
        <div className="relative flex-none overflow-x-auto rounded-xl border border-papeliz-line bg-papeliz-surface-soft max-sm:hidden">
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
                      newVaultPlaceOffReasonTexts[newVaultPlace] !== null && 'opacity-55',
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
                          newVaultPlaceOffReasonTexts[newVaultPlace] !== null && 'opacity-55',
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
        <button type="button" onClick={onNewVaultCancel} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={newVaultNameProblem !== null || isNewVaultConfirmHeld}
          onClick={confirmNewVault}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
        >
          {isFolderVaultChosen ? 'Pick Folder' : 'Create Vault'}
        </button>
      </div>
    </div>
  )
}
