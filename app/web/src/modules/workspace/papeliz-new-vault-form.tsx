import { AppWindow, FileText, Folder, FolderOpen, Lock, TriangleAlert, type LucideIcon } from 'lucide-react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { isPapelizSyncEngineInThisBuild } from 'virtual:papeliz-sync-engine-availability'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PapelizSyncSignInPageLinks } from '../sync/papeliz-sync-blocked-sign-in-links'
import type { PapelizSyncVaultEncryptionChoice } from '../sync/papeliz-sync-engine-contract'
import { readPapelizSyncDevFakeEngineScenarioText, usePapelizSyncEngineSnapshot, usePapelizSyncEngineStore } from '../sync/papeliz-sync-engine-store'
import { describePapelizSyncSignInFromClickFailure, startPapelizSyncSignInFromClick, usePapelizSyncFlowStore } from '../sync/papeliz-sync-flow-store'
import { PapelizSyncNewPassphraseFields } from '../sync/papeliz-sync-passphrase-fields'
import { PapelizSyncSwitch } from '../sync/papeliz-sync-page-parts'
import { papelizSyncVaultNameReadableLine } from '../sync/papeliz-sync-screen-words'
import { papelizMainActionButtonColorClassName, papelizOutlineButtonColorClassName } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizInfoTip } from '../ui/papeliz-info-tip'
import { findPapelizBrowserVaultNameProblem, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import {
  describeNewFolderVaultNameTakenMessage,
  findPapelizNewFolderVaultNameProblem,
  findPapelizNewVaultFolderNameTaken,
  readPapelizNewVaultDefaultParentFolder,
  type PapelizNewVaultParentFolder,
} from '../vault/papeliz-open-vault'
import type { PapelizVaultEncryptionKind } from '../vault/papeliz-vault-encryption'
import { PapelizBrowserVaultNameField } from './papeliz-browser-vault-name-field'
import {
  canPapelizSyncCarryNewVault,
  describePapelizNewVaultParentFolderPlace,
  findPapelizNewVaultCreateBlock,
  isPapelizNewVaultSyncThisVaultOn,
  readPapelizNewVaultEncryptionChoice,
  readPapelizNewVaultParentFolderName,
  readPapelizNewVaultPartsKind,
  readPapelizNewVaultSyncVaultEncryptionChoice,
  type PapelizNewVaultEncryptionChoice,
  type PapelizNewVaultEncryptionPick,
} from './papeliz-new-vault-form-rules'
import {
  papelizEndToEndVaultPassphraseNotRecoverableLine,
  papelizNewEndToEndVaultPassphraseFieldLabel,
  papelizNewEndToEndVaultNotSyncedYetLine,
  papelizNewStandardVaultSyncThisVaultLine,
  papelizVaultEncryptionKindDisplayNames,
  papelizVaultEncryptionKindLines,
} from './papeliz-vault-encryption-screen-words'

// Where a new vault is kept: a folder on the disk (Chrome, Edge and Brave) or this browser.
export type PapelizNewVaultPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// The help guide on starting, opening and importing a vault.
const papelizNewVaultHelpArticleUrl = 'https://papeliz.com/help/open-a-folder/'
const papelizNewVaultHelpLinkLabel = 'Help: start or open a vault'

// How long the name rests before Papeliz looks whether the place picked already has it.
const papelizNewVaultFolderNameTakenCheckDelayMilliseconds = 150

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
    newVaultPlaceLine: 'A folder on your machine.',
  },
  {
    newVaultPlace: 'browser-vault-in-opfs',
    NewVaultPlaceIcon: AppWindow,
    newVaultPlaceTitle: 'Browser Storage',
    newVaultPlaceBadgeText: 'Risky',
    newVaultPlaceBadgeTone: 'risky',
    newVaultPlaceLine: 'Inside this browser.',
  },
]

// Standard is a page, since its files on disk aren't encrypted; End-to-end is a lock.
const papelizNewVaultEncryptionKindIcons: Record<PapelizVaultEncryptionKind, LucideIcon> = {
  standard: FileText,
  'end-to-end': Lock,
}

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
  'inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-[background-color,border-color,color,filter,transform] duration-150 ease-out active:scale-[.99] disabled:pointer-events-none disabled:opacity-50'
// Their colors, every main button's (papeliz-buttons.tsx): Cancel is white with an outline and turns
// soft blue when hovered; the action is solid blue. The Synced Vaults page and the browser vault
// Rename dialog use them too.
export const newVaultFormFooterCancelButtonColorClassName = papelizOutlineButtonColorClassName
export const newVaultFormFooterActionButtonColorClassName = papelizMainActionButtonColorClassName

// What Create Vault hands on besides the name and the place.
export interface PapelizNewVaultConfirmDetails {
  // The folder the vault's folder is made in, when the form picked one (null: none picked yet, so it
  // is asked for now).
  newVaultParentFolder: PapelizNewVaultParentFolder | null
  // Standard, or End-to-end with its passphrase.
  newVaultEncryptionChoice: PapelizNewVaultEncryptionChoice
  // The kind to turn Sync on with once the vault opens, or null when it doesn't sync.
  newVaultSyncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice | null
}

interface PapelizNewVaultFormProps {
  newVaultFormHeadingId: string
  // Why this browser can't keep a vault in a folder, or in the browser, or null when it can. When one
  // can't, the other shows as the one place; when neither can, both stay, greyed, and say why.
  folderAccessOffReasonText: string | null
  browserVaultOffReasonText: string | null
  suggestedNewVaultName: string
  // The place chosen when the form opens; by default a folder where folders work.
  initialNewVaultPlace?: PapelizNewVaultPlace
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  // Use Template opens the form on a template: it is named at the top with how reading its files is
  // going, Cancel goes back to it, and the action waits until its files are read and checked.
  newVaultFromTemplate?: { newVaultTemplateName: string; newVaultTemplateDetailLine: string; newVaultTemplateThumbnail: ReactNode; newVaultTemplateStatus: ReactNode }
  isNewVaultConfirmHeld?: boolean
  // Where the vault's folder goes, picked from the form (Browse…), shown before Create Vault. Without
  // it the form shows no place row, and the place is picked once Create Vault is pressed.
  onNewVaultParentFolderPick?: () => Promise<PapelizNewVaultParentFolder | null>
  // Encryption under Location, and "Sync This Vault" where Sync is: the start page's New Vault has
  // them; Use Template's doesn't, since it makes a Standard vault.
  areNewVaultEncryptionAndSyncPartsShown?: boolean
  // Why the last Create Vault didn't make the vault, shown under Location.
  newVaultCreateFailureMessage?: string | null
  onNewVaultConfirm: (typedNewVaultName: string, chosenNewVaultPlace: PapelizNewVaultPlace, newVaultConfirmDetails: PapelizNewVaultConfirmDetails) => void
  onNewVaultCancel: () => void
}

// A small heading over a part of the form.
function PapelizNewVaultFormPartHeading({ newVaultFormPartHeadingId, children, newVaultFormPartHeadingEnd }: { newVaultFormPartHeadingId: string; children: ReactNode; newVaultFormPartHeadingEnd?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <h3 id={newVaultFormPartHeadingId} className="text-[12px] leading-snug font-semibold text-papeliz-ink">
        {children}
      </h3>
      {newVaultFormPartHeadingEnd !== undefined && <span className="ml-auto">{newVaultFormPartHeadingEnd}</span>}
    </div>
  )
}

// One choice as a tile: an icon tile, the title, a line under it, and the radio at the right edge. The
// two web places and the two kinds of encryption use it, side by side. Choosing one cross-fades its
// border, ground and icon tile over 180 ms while the one left behind fades back, and the radio's dot
// grows from its centre; a press sinks the tile slightly, and a hover tints its border and icon tile.
// With reduced motion it all changes at once (papeliz-webapp.css), and a press doesn't sink it.
function PapelizNewVaultChoiceTile({
  choiceTileGroupName,
  choiceTileValue,
  ChoiceTileIcon,
  choiceTileTitle,
  choiceTileLine,
  isChoiceTileChosen,
  choiceTileOffReasonText = null,
  choiceTileOffReasonId,
  onChoiceTileChoose,
}: {
  choiceTileGroupName: string
  choiceTileValue: string
  ChoiceTileIcon: LucideIcon
  choiceTileTitle: string
  choiceTileLine: ReactNode
  isChoiceTileChosen: boolean
  choiceTileOffReasonText?: string | null
  choiceTileOffReasonId?: string
  onChoiceTileChoose: () => void
}) {
  const isChoiceTileOff = choiceTileOffReasonText !== null
  return (
    <label
      className={joinPapelizClassNames(
        'group/papeliz-new-vault-choice-tile flex items-start gap-2.5 rounded-xl border px-2.5 py-2 transition-[background-color,border-color,transform] duration-[180ms] ease-out',
        isChoiceTileChosen
          ? 'cursor-pointer border-papeliz-blue-line bg-papeliz-blue-soft'
          : isChoiceTileOff
            ? 'cursor-not-allowed border-papeliz-line bg-papeliz-surface-soft'
            : 'cursor-pointer border-papeliz-line bg-papeliz-surface hover:border-papeliz-blue-line/60 hover:bg-papeliz-hover',
        !isChoiceTileOff && 'active:scale-[0.98] motion-reduce:active:scale-100',
      )}
    >
      <span
        aria-hidden="true"
        className={joinPapelizClassNames(
          'grid size-[30px] flex-none place-items-center rounded-lg transition-[background-color,color] duration-[180ms] ease-out',
          isChoiceTileChosen
            ? 'bg-papeliz-chosen-tab-ground text-white'
            : joinPapelizClassNames(
                'bg-papeliz-surface-gray text-papeliz-ink-muted',
                !isChoiceTileOff && 'group-hover/papeliz-new-vault-choice-tile:bg-papeliz-blue-soft group-hover/papeliz-new-vault-choice-tile:text-papeliz-blue',
              ),
          isChoiceTileOff && 'opacity-55',
        )}
      >
        <ChoiceTileIcon className="size-4" />
      </span>
      <input
        type="radio"
        name={choiceTileGroupName}
        value={choiceTileValue}
        checked={isChoiceTileChosen}
        disabled={isChoiceTileOff}
        aria-describedby={isChoiceTileOff ? choiceTileOffReasonId : undefined}
        onChange={onChoiceTileChoose}
        className={joinPapelizClassNames(
          // The dot is a circle drawn at the radio's centre, grown from nothing when it is chosen.
          'order-last mt-0.5 size-4 flex-none appearance-none rounded-full border-[1.5px] border-papeliz-line-strong bg-papeliz-surface bg-[radial-gradient(circle,var(--color-papeliz-blue)_0_45%,transparent_48%)] bg-center bg-no-repeat [background-size:0%_0%] transition-[background-size,border-color] duration-[180ms] ease-[var(--ease-papeliz-out)] checked:border-papeliz-blue checked:[background-size:100%_100%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue',
          isChoiceTileOff ? 'opacity-55' : 'cursor-pointer',
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={joinPapelizClassNames('text-[13.5px] leading-tight font-semibold text-papeliz-ink', isChoiceTileOff && 'opacity-55')}>{choiceTileTitle}</span>
        {isChoiceTileOff ? (
          <span id={choiceTileOffReasonId} className="text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
            {choiceTileOffReasonText}
          </span>
        ) : (
          <span className="text-[12px] leading-snug text-papeliz-ink-subtle">{choiceTileLine}</span>
        )}
      </span>
    </label>
  )
}

function PapelizNewVaultPlaceBadge({ newVaultPlaceBadgeTone, children }: { newVaultPlaceBadgeTone: PapelizNewVaultPlaceBadgeTone; children: ReactNode }) {
  return (
    <span className={joinPapelizClassNames('mr-1 inline-block rounded-full border px-1.5 text-[10px] leading-snug font-semibold', papelizNewVaultPlaceBadgeToneClassNames[newVaultPlaceBadgeTone])}>
      {children}
    </span>
  )
}

// A red line under Location: the name taken in the place picked, or why Create Vault didn't work.
function PapelizNewVaultFailureLine({ children, newVaultFailureLineId }: { children: ReactNode; newVaultFailureLineId?: string }) {
  return (
    <p id={newVaultFailureLineId} role="alert" className="mt-1.5 flex items-start gap-2 rounded-lg bg-papeliz-diff-removed px-2.5 py-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
      <TriangleAlert className="mt-px size-3.5 flex-none" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

// New Vault, in the start card in place of Recent Vaults, the same on the web and in Papeliz for
// Windows: the vault's name, then Location, then Encryption, then (in a build with Sync) "Sync This
// Vault", each under a small heading, with Cancel at the footer's left edge and Create Vault at its
// right. Location shows only what this app has: in Papeliz for Windows the folder the vault's folder
// will be made in, as its whole path, with Browse… to pick another; on the web its storage places as
// two tiles (or, where only one works, that one as a plain line), then for Folder Storage the folder
// it goes in, with Browse…. Compare shows how the places differ. Encryption is Standard or End-to-end,
// Standard first; End-to-end asks its passphrase in place, twice, with the warning that it can't be
// recovered. "Sync This Vault" syncs the vault with the kind picked above it. Create Vault stays off
// until the vault can be made, and says why. Esc cancels.
export function PapelizNewVaultForm({
  newVaultFormHeadingId,
  folderAccessOffReasonText,
  browserVaultOffReasonText,
  suggestedNewVaultName,
  initialNewVaultPlace,
  existingBrowserVaultRecords,
  newVaultFromTemplate,
  isNewVaultConfirmHeld = false,
  onNewVaultParentFolderPick,
  areNewVaultEncryptionAndSyncPartsShown = false,
  newVaultCreateFailureMessage = null,
  onNewVaultConfirm,
  onNewVaultCancel,
}: PapelizNewVaultFormProps) {
  const newVaultNameInputRef = useRef<HTMLInputElement>(null)
  const newVaultFormFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const newVaultFormIdPrefix = useId()
  const newVaultPlaceOffReasonTexts: Record<PapelizNewVaultPlace, string | null> = {
    'folder-on-disk': folderAccessOffReasonText,
    'browser-vault-in-opfs': browserVaultOffReasonText,
  }
  const isFolderVaultOn = isPapelizDesktopApp || folderAccessOffReasonText === null
  const [typedNewVaultName, setTypedNewVaultName] = useState(suggestedNewVaultName)
  const [chosenNewVaultPlace, setChosenNewVaultPlace] = useState<PapelizNewVaultPlace>(
    isPapelizDesktopApp
      ? 'folder-on-disk'
      : initialNewVaultPlace !== undefined && newVaultPlaceOffReasonTexts[initialNewVaultPlace] === null
        ? initialNewVaultPlace
        : isFolderVaultOn
          ? 'folder-on-disk'
          : 'browser-vault-in-opfs',
  )
  const isFolderVaultChosen = chosenNewVaultPlace === 'folder-on-disk'
  const newVaultNameProblem = isFolderVaultChosen
    ? findPapelizNewFolderVaultNameProblem(typedNewVaultName)
    : findPapelizBrowserVaultNameProblem(typedNewVaultName, existingBrowserVaultRecords, null)
  const trimmedNewVaultName = typedNewVaultName.trim()

  // The web shows its places as tiles while both can be used, or neither can (each then says why); a
  // browser with only one shows it as a plain line. Papeliz for Windows keeps every vault in a folder.
  const usableNewVaultPlaces = papelizNewVaultPlaceDescriptions.filter((newVaultPlaceDescription) => newVaultPlaceOffReasonTexts[newVaultPlaceDescription.newVaultPlace] === null)
  const onlyUsableNewVaultPlaceDescription = !isPapelizDesktopApp && usableNewVaultPlaces.length === 1 ? usableNewVaultPlaces[0] : undefined
  const areNewVaultPlaceTilesShown = !isPapelizDesktopApp && onlyUsableNewVaultPlaceDescription === undefined
  const [isNewVaultPlaceComparisonShown, setIsNewVaultPlaceComparisonShown] = useState(false)

  // Where the vault's folder goes. Papeliz for Windows starts at `<Documents>\Papeliz`; the web, which
  // can't reach a folder until one is picked, starts with none.
  const isNewVaultParentFolderRowShown = isFolderVaultChosen && onNewVaultParentFolderPick !== undefined
  const [newVaultParentFolder, setNewVaultParentFolder] = useState<PapelizNewVaultParentFolder | null>(null)
  const [isNewVaultParentFolderPicking, setIsNewVaultParentFolderPicking] = useState(false)
  const isNewVaultParentFolderPicked = useRef(false)
  const isNewVaultParentFolderPickable = onNewVaultParentFolderPick !== undefined
  useEffect(() => {
    if (!isPapelizDesktopApp || !isNewVaultParentFolderPickable) return
    let isNewVaultFormLeft = false
    void readPapelizNewVaultDefaultParentFolder().then((newVaultDefaultParentFolder) => {
      if (!isNewVaultFormLeft && !isNewVaultParentFolderPicked.current) setNewVaultParentFolder(newVaultDefaultParentFolder)
    })
    return () => {
      isNewVaultFormLeft = true
    }
  }, [isNewVaultParentFolderPickable])
  const pickNewVaultParentFolder = async () => {
    if (onNewVaultParentFolderPick === undefined) return
    setIsNewVaultParentFolderPicking(true)
    try {
      const pickedNewVaultParentFolder = await onNewVaultParentFolderPick()
      if (pickedNewVaultParentFolder === null) return
      isNewVaultParentFolderPicked.current = true
      setNewVaultParentFolder(pickedNewVaultParentFolder)
    } finally {
      setIsNewVaultParentFolderPicking(false)
    }
  }

  // Whether the place picked already has the name: looked at a moment after the name or place changes.
  const [newVaultFolderNameTakenReading, setNewVaultFolderNameTakenReading] = useState<{
    readNewVaultParentFolder: PapelizNewVaultParentFolder
    readNewVaultName: string
    newVaultFolderNameTaken: 'folder-not-empty' | 'file-has-the-name' | null
  } | null>(null)
  const isNewVaultFolderNameCheckable = isNewVaultParentFolderRowShown && newVaultParentFolder !== null && findPapelizNewFolderVaultNameProblem(typedNewVaultName) === null
  useEffect(() => {
    if (!isNewVaultFolderNameCheckable || newVaultParentFolder === null) return
    let isCheckOutdated = false
    const newVaultFolderNameTakenCheckTimer = setTimeout(() => {
      void findPapelizNewVaultFolderNameTaken(newVaultParentFolder, trimmedNewVaultName).then((newVaultFolderNameTaken) => {
        if (!isCheckOutdated) setNewVaultFolderNameTakenReading({ readNewVaultParentFolder: newVaultParentFolder, readNewVaultName: trimmedNewVaultName, newVaultFolderNameTaken })
      })
    }, papelizNewVaultFolderNameTakenCheckDelayMilliseconds)
    return () => {
      isCheckOutdated = true
      clearTimeout(newVaultFolderNameTakenCheckTimer)
    }
  }, [isNewVaultFolderNameCheckable, newVaultParentFolder, trimmedNewVaultName])
  const newVaultFolderNameTaken =
    isNewVaultFolderNameCheckable &&
    newVaultFolderNameTakenReading !== null &&
    newVaultFolderNameTakenReading.readNewVaultParentFolder === newVaultParentFolder &&
    newVaultFolderNameTakenReading.readNewVaultName === trimmedNewVaultName
      ? newVaultFolderNameTakenReading.newVaultFolderNameTaken
      : null

  // Encryption, in every build, and "Sync This Vault" in a build with Sync. The switch is off until the
  // person is signed in to Sync, then on unless they turn it off.
  const isPapelizSyncInThisBuild = useMemo(() => isPapelizSyncEngineInThisBuild || readPapelizSyncDevFakeEngineScenarioText() !== null, [])
  const newVaultPartsKind = readPapelizNewVaultPartsKind(areNewVaultEncryptionAndSyncPartsShown, isPapelizSyncInThisBuild)
  const [chosenNewVaultEncryptionKind, setChosenNewVaultEncryptionKind] = useState<PapelizVaultEncryptionKind>('standard')
  const [typedNewVaultPassphrase, setTypedNewVaultPassphrase] = useState('')
  const [repeatedNewVaultPassphrase, setRepeatedNewVaultPassphrase] = useState('')
  const newVaultEncryptionPick: PapelizNewVaultEncryptionPick | null =
    newVaultPartsKind === 'none' ? null : { chosenNewVaultEncryptionKind, typedNewVaultPassphrase, repeatedNewVaultPassphrase }
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const syncEngineLoadState = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.syncEngineLoadState)
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const blockedSyncSignInPageUrl = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.blockedSyncSignInPageUrl)
  useEffect(() => {
    if (newVaultPartsKind === 'encryption-and-sync-switch') void loadPapelizSyncEngine()
  }, [newVaultPartsKind, loadPapelizSyncEngine])
  const isSignedInToSync = syncEngineReading?.syncEngineSnapshot.syncSignIn.syncSignInKind === 'signed-in'
  const [syncThisVaultSwitchPick, setSyncThisVaultSwitchPick] = useState<boolean | null>(null)
  const [isSyncSignInRunning, setIsSyncSignInRunning] = useState(false)
  const [syncSignInFailureWords, setSyncSignInFailureWords] = useState<string | null>(null)
  const isSyncThisVaultOn = newVaultPartsKind === 'encryption-and-sync-switch' && isPapelizNewVaultSyncThisVaultOn(isSignedInToSync, syncThisVaultSwitchPick, chosenNewVaultEncryptionKind)
  const signInToSyncFromNewVault = () => {
    if (syncEngineReading === null) return
    setSyncSignInFailureWords(null)
    setIsSyncSignInRunning(true)
    void startPapelizSyncSignInFromClick(syncEngineReading.papelizSyncEngine, null)
      .then((signInFromClickOutcome) => setSyncSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)))
      .finally(() => setIsSyncSignInRunning(false))
  }

  const newVaultCreateBlock = findPapelizNewVaultCreateBlock({
    newVaultNameProblem,
    newVaultFolderNameTaken,
    newVaultEncryptionPick,
    isNewVaultConfirmHeld: isNewVaultConfirmHeld || isNewVaultParentFolderPicking,
  })

  // The Name field opens with the name chosen, ready to type over.
  useEffect(() => {
    newVaultNameInputRef.current?.focus()
    newVaultNameInputRef.current?.select()
  }, [])

  const confirmNewVault = () => {
    if (newVaultCreateBlock !== null) return
    const newVaultEncryptionChoice = readPapelizNewVaultEncryptionChoice(newVaultEncryptionPick)
    onNewVaultConfirm(trimmedNewVaultName, chosenNewVaultPlace, {
      newVaultParentFolder: isNewVaultParentFolderRowShown ? newVaultParentFolder : null,
      newVaultEncryptionChoice,
      newVaultSyncVaultEncryptionChoice: readPapelizNewVaultSyncVaultEncryptionChoice(isSyncThisVaultOn, newVaultEncryptionChoice),
    })
  }

  const locationHeadingId = `${newVaultFormIdPrefix}-location-heading`
  const syncHeadingId = `${newVaultFormIdPrefix}-sync-heading`
  const encryptionHeadingId = `${newVaultFormIdPrefix}-encryption-heading`
  const newVaultParentFolderLineId = `${newVaultFormIdPrefix}-parent-folder-line`
  const newVaultPlaceComparisonId = `${newVaultFormIdPrefix}-place-comparison`
  const keptPlaceWords = isPapelizDesktopApp ? 'on this computer' : isFolderVaultChosen ? 'in your folder' : 'in this browser'

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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2 pb-3">
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

        <section aria-labelledby={locationHeadingId}>
          <PapelizNewVaultFormPartHeading
            newVaultFormPartHeadingId={locationHeadingId}
            newVaultFormPartHeadingEnd={
              !isPapelizDesktopApp && (
                <button
                  type="button"
                  aria-expanded={isNewVaultPlaceComparisonShown}
                  aria-controls={newVaultPlaceComparisonId}
                  onClick={() => setIsNewVaultPlaceComparisonShown(!isNewVaultPlaceComparisonShown)}
                  className="rounded-full px-1.5 text-[12px] font-medium text-papeliz-blue hover:bg-papeliz-blue-soft"
                >
                  {isNewVaultPlaceComparisonShown ? 'Hide Comparison' : 'Compare'}
                </button>
              )
            }
          >
            Location
          </PapelizNewVaultFormPartHeading>

          {areNewVaultPlaceTilesShown && (
            <div role="radiogroup" aria-labelledby={locationHeadingId} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {papelizNewVaultPlaceDescriptions.map((newVaultPlaceDescription) => {
                const newVaultPlaceOffReasonText = newVaultPlaceOffReasonTexts[newVaultPlaceDescription.newVaultPlace]
                return (
                  <PapelizNewVaultChoiceTile
                    key={newVaultPlaceDescription.newVaultPlace}
                    choiceTileGroupName={`${newVaultFormIdPrefix}-new-vault-place`}
                    choiceTileValue={newVaultPlaceDescription.newVaultPlace}
                    ChoiceTileIcon={newVaultPlaceDescription.NewVaultPlaceIcon}
                    choiceTileTitle={newVaultPlaceDescription.newVaultPlaceTitle}
                    choiceTileLine={
                      <>
                        <PapelizNewVaultPlaceBadge newVaultPlaceBadgeTone={newVaultPlaceDescription.newVaultPlaceBadgeTone}>{newVaultPlaceDescription.newVaultPlaceBadgeText}</PapelizNewVaultPlaceBadge>
                        {newVaultPlaceDescription.newVaultPlaceLine}
                      </>
                    }
                    isChoiceTileChosen={newVaultPlaceDescription.newVaultPlace === chosenNewVaultPlace}
                    choiceTileOffReasonText={newVaultPlaceOffReasonText}
                    choiceTileOffReasonId={`${newVaultFormIdPrefix}-${newVaultPlaceDescription.newVaultPlace}-off-reason`}
                    onChoiceTileChoose={() => setChosenNewVaultPlace(newVaultPlaceDescription.newVaultPlace)}
                  />
                )
              })}
            </div>
          )}
          {onlyUsableNewVaultPlaceDescription !== undefined && (
            <div className="flex items-center gap-2.5 rounded-xl border border-papeliz-line bg-papeliz-surface px-2.5 py-2">
              <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-lg bg-papeliz-surface-gray text-papeliz-ink-muted">
                <onlyUsableNewVaultPlaceDescription.NewVaultPlaceIcon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] leading-tight font-semibold text-papeliz-ink">{onlyUsableNewVaultPlaceDescription.newVaultPlaceTitle}</span>
                <span className="text-[12px] leading-snug text-papeliz-ink-subtle">
                  <PapelizNewVaultPlaceBadge newVaultPlaceBadgeTone={onlyUsableNewVaultPlaceDescription.newVaultPlaceBadgeTone}>
                    {onlyUsableNewVaultPlaceDescription.newVaultPlaceBadgeText}
                  </PapelizNewVaultPlaceBadge>
                  {onlyUsableNewVaultPlaceDescription.newVaultPlace === 'browser-vault-in-opfs'
                    ? 'Inside this browser, the only place it can keep vaults. Download backups to keep your notes safe.'
                    : onlyUsableNewVaultPlaceDescription.newVaultPlaceLine}
                </span>
              </span>
            </div>
          )}

          {isNewVaultParentFolderRowShown && (
            <div className={joinPapelizClassNames(!isPapelizDesktopApp && 'mt-2')}>
              <div className="flex items-center gap-2">
                <p
                  className={joinPapelizClassNames(
                    'flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] whitespace-nowrap',
                    newVaultFolderNameTaken !== null ? 'border-papeliz-diff-removed-ink/35 bg-papeliz-diff-removed' : 'border-papeliz-line bg-papeliz-surface-soft',
                  )}
                  title={newVaultParentFolder === null ? undefined : `${describePapelizNewVaultParentFolderPlace(newVaultParentFolder)}${trimmedNewVaultName}`}
                >
                  <Folder className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
                  <span className="sr-only">Where the vault’s folder goes: </span>
                  {newVaultParentFolder === null ? (
                    <span className="truncate text-papeliz-ink-subtle italic">No folder picked yet</span>
                  ) : (
                    <span className="truncate text-papeliz-ink-muted" dir="ltr">
                      {describePapelizNewVaultParentFolderPlace(newVaultParentFolder)}
                      {trimmedNewVaultName === '' ? (
                        <span className="text-papeliz-ink-subtle italic">vault name</span>
                      ) : (
                        <span className="font-semibold text-papeliz-ink">{trimmedNewVaultName}</span>
                      )}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={isNewVaultParentFolderPicking || isNewVaultConfirmHeld}
                  onClick={() => void pickNewVaultParentFolder()}
                  aria-describedby={newVaultParentFolderLineId}
                  aria-label="Browse for the Folder It Goes In"
                  className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName, 'h-[34px]')}
                >
                  Browse…
                </button>
              </div>
              {newVaultCreateFailureMessage !== null ? (
                <PapelizNewVaultFailureLine newVaultFailureLineId={newVaultParentFolderLineId}>{newVaultCreateFailureMessage}</PapelizNewVaultFailureLine>
              ) : newVaultFolderNameTaken !== null ? (
                <PapelizNewVaultFailureLine newVaultFailureLineId={newVaultParentFolderLineId}>
                  {describeNewFolderVaultNameTakenMessage(newVaultFolderNameTaken, trimmedNewVaultName)} Or open it with Open Vault.
                </PapelizNewVaultFailureLine>
              ) : (
                <p id={newVaultParentFolderLineId} className="mt-1 text-[12px] leading-snug text-papeliz-ink-subtle">
                  {newVaultParentFolder === null ? (
                    'Pick the folder it goes in, now or at Create Vault.'
                  ) : trimmedNewVaultName === '' || newVaultNameProblem !== null ? (
                    'Papeliz makes the vault’s folder here.'
                  ) : (
                    <>
                      Papeliz makes the folder <b className="font-semibold text-papeliz-ink-muted">{trimmedNewVaultName}</b> in “{readPapelizNewVaultParentFolderName(newVaultParentFolder)}”, with every note
                      in it {chosenNewVaultEncryptionKind === 'end-to-end' && newVaultEncryptionPick !== null ? 'encrypted' : 'as a Markdown file'}.
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          {!isNewVaultParentFolderRowShown && chosenNewVaultPlace === 'browser-vault-in-opfs' && areNewVaultPlaceTilesShown && (
            <p className="mt-1.5 text-[12px] leading-snug text-papeliz-ink-subtle">Kept inside this browser. Download backups to keep your notes safe.</p>
          )}
          {!isNewVaultParentFolderRowShown && newVaultCreateFailureMessage !== null && <PapelizNewVaultFailureLine>{newVaultCreateFailureMessage}</PapelizNewVaultFailureLine>}

          {!isPapelizDesktopApp && isNewVaultPlaceComparisonShown && (
            <div id={newVaultPlaceComparisonId} className="mt-2">
              <PapelizNewVaultPlaceComparison chosenNewVaultPlace={chosenNewVaultPlace} newVaultPlaceOffReasonTexts={newVaultPlaceOffReasonTexts} />
            </div>
          )}
        </section>

        {newVaultEncryptionPick !== null && (
          <PapelizNewVaultEncryptionPart
            newVaultEncryptionHeadingId={encryptionHeadingId}
            newVaultEncryptionPick={newVaultEncryptionPick}
            onNewVaultEncryptionKindChoose={setChosenNewVaultEncryptionKind}
            onNewVaultPassphraseType={setTypedNewVaultPassphrase}
            onNewVaultPassphraseRepeat={setRepeatedNewVaultPassphrase}
          />
        )}

        {newVaultPartsKind === 'encryption-and-sync-switch' && (
          <section aria-labelledby={syncHeadingId} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-papeliz-line px-2.5 py-2">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 id={syncHeadingId} className="text-[13.5px] leading-tight font-semibold text-papeliz-ink">
                  Sync This Vault
                </h3>
                <span className="text-[12px] leading-snug text-papeliz-ink-subtle">
                  {syncEngineLoadState === 'failed-to-load' ? (
                    'Papeliz Sync didn’t load. Turn it on later in Settings › Sync.'
                  ) : syncEngineReading === null ? (
                    'Checking Sync…'
                  ) : !isSignedInToSync ? (
                    <>
                      Sign in to Sync to keep it on your other devices.{' '}
                      <button type="button" disabled={isSyncSignInRunning} onClick={signInToSyncFromNewVault} className="font-semibold text-papeliz-blue hover:underline disabled:opacity-60">
                        {isSyncSignInRunning ? 'Waiting for the sign-in…' : 'Sign In'}
                      </button>
                    </>
                  ) : !canPapelizSyncCarryNewVault(chosenNewVaultEncryptionKind) ? (
                    papelizNewEndToEndVaultNotSyncedYetLine
                  ) : isSyncThisVaultOn ? (
                    papelizNewStandardVaultSyncThisVaultLine
                  ) : (
                    `It stays ${keptPlaceWords}. Turn Sync on later in Settings › Sync.`
                  )}
                </span>
              </span>
              <PapelizSyncSwitch
                syncSwitchLabel="Sync This Vault"
                isSyncSwitchOn={isSyncThisVaultOn}
                isSyncSwitchDisabled={!isSignedInToSync || !canPapelizSyncCarryNewVault(chosenNewVaultEncryptionKind) || isNewVaultConfirmHeld}
                onSyncSwitchToggle={() => setSyncThisVaultSwitchPick(!isSyncThisVaultOn)}
              />
            </div>
            {blockedSyncSignInPageUrl !== null && !isSignedInToSync && <PapelizSyncSignInPageLinks syncSignInPageUrl={blockedSyncSignInPageUrl} signInLinksAlignment="from-left-edge" />}
            {syncSignInFailureWords !== null && <PapelizNewVaultFailureLine>{syncSignInFailureWords}</PapelizNewVaultFailureLine>}
            {isSyncThisVaultOn && <p className="-mt-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">{papelizSyncVaultNameReadableLine}</p>}
          </section>
        )}
      </div>

      {/* Cancel at the left edge, the action at the right, so the two never sit side by side. */}
      <div ref={newVaultFormFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onNewVaultCancel} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={newVaultCreateBlock !== null}
          onClick={confirmNewVault}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
        >
          Create Vault
        </button>
      </div>
    </div>
  )
}

// Encryption, under Location: Standard or End-to-end as two tiles, Standard first, each with its one
// line. End-to-end asks its passphrase in place, twice, with the strength bars and the warning that
// it can't be recovered.
export function PapelizNewVaultEncryptionPart({
  newVaultEncryptionHeadingId,
  newVaultEncryptionPick,
  onNewVaultEncryptionKindChoose,
  onNewVaultPassphraseType,
  onNewVaultPassphraseRepeat,
}: {
  newVaultEncryptionHeadingId: string
  newVaultEncryptionPick: PapelizNewVaultEncryptionPick
  onNewVaultEncryptionKindChoose: (chosenNewVaultEncryptionKind: PapelizVaultEncryptionKind) => void
  onNewVaultPassphraseType: (typedNewVaultPassphrase: string) => void
  onNewVaultPassphraseRepeat: (repeatedNewVaultPassphrase: string) => void
}) {
  const isNewVaultPassphrasePartOpen = newVaultEncryptionPick.chosenNewVaultEncryptionKind === 'end-to-end'
  const newVaultPassphrasePartRef = useRef<HTMLDivElement>(null)
  // Choosing End-to-end puts the focus in the passphrase, once it is no longer inert.
  const wasNewVaultPassphrasePartOpen = useRef(isNewVaultPassphrasePartOpen)
  useEffect(() => {
    if (isNewVaultPassphrasePartOpen && !wasNewVaultPassphrasePartOpen.current) newVaultPassphrasePartRef.current?.querySelector('input')?.focus()
    wasNewVaultPassphrasePartOpen.current = isNewVaultPassphrasePartOpen
  }, [isNewVaultPassphrasePartOpen])
  return (
    <section aria-labelledby={newVaultEncryptionHeadingId}>
      <PapelizNewVaultFormPartHeading newVaultFormPartHeadingId={newVaultEncryptionHeadingId}>Encryption</PapelizNewVaultFormPartHeading>
      <div role="radiogroup" aria-labelledby={newVaultEncryptionHeadingId} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(['standard', 'end-to-end'] as const).map((newVaultEncryptionKind) => (
          <PapelizNewVaultChoiceTile
            key={newVaultEncryptionKind}
            choiceTileGroupName={`${newVaultEncryptionHeadingId}-kind`}
            choiceTileValue={newVaultEncryptionKind}
            ChoiceTileIcon={papelizNewVaultEncryptionKindIcons[newVaultEncryptionKind]}
            choiceTileTitle={papelizVaultEncryptionKindDisplayNames[newVaultEncryptionKind]}
            choiceTileLine={papelizVaultEncryptionKindLines[newVaultEncryptionKind]}
            isChoiceTileChosen={newVaultEncryptionKind === newVaultEncryptionPick.chosenNewVaultEncryptionKind}
            onChoiceTileChoose={() => onNewVaultEncryptionKindChoose(newVaultEncryptionKind)}
          />
        ))}
      </div>
      {/* End-to-end's passphrase opens under the tiles: it grows from no height and fades in over about
          220 ms, and shuts the same way when Standard is chosen again, while the form below moves with it.
          Shut, it is inert, so nothing in it takes focus. The strength bars fill with a short fade as the
          passphrase is typed. */}
      <div
        ref={newVaultPassphrasePartRef}
        inert={!isNewVaultPassphrasePartOpen}
        data-papeliz-new-vault-passphrase-part-open={isNewVaultPassphrasePartOpen}
        className={joinPapelizClassNames(
          'grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[var(--ease-papeliz-out)]',
          isNewVaultPassphrasePartOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="-mx-1 min-h-0 overflow-hidden px-1 [&_[aria-hidden=true]>span]:transition-[background-color] [&_[aria-hidden=true]>span]:duration-200">
          <PapelizSyncNewPassphraseFields
            newSyncPassphrase={newVaultEncryptionPick.typedNewVaultPassphrase}
            onNewSyncPassphraseChange={onNewVaultPassphraseType}
            repeatedSyncPassphrase={newVaultEncryptionPick.repeatedNewVaultPassphrase}
            onRepeatedSyncPassphraseChange={onNewVaultPassphraseRepeat}
            newSyncPassphraseFieldLabel={papelizNewEndToEndVaultPassphraseFieldLabel}
            isNewSyncPassphraseFieldFocusedFirst={false}
          />
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
            <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
            <span>{papelizEndToEndVaultPassphraseNotRecoverableLine}</span>
          </p>
        </div>
      </div>
    </section>
  )
}

// What each place means, side by side, behind Compare; the chosen place's column lights up. Every cell
// stays on one line. Too narrow for that (a phone), each place gets its own short list, one under the
// other, the chosen one lit.
function PapelizNewVaultPlaceComparison({
  chosenNewVaultPlace,
  newVaultPlaceOffReasonTexts,
}: {
  chosenNewVaultPlace: PapelizNewVaultPlace
  newVaultPlaceOffReasonTexts: Record<PapelizNewVaultPlace, string | null>
}) {
  return (
    <>
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
    </>
  )
}
