'use client'

import { papelizAccountTextLinkClassName } from './papeliz-account-card-frame'
import { papelizAccountNearestStoragePlaceBadgeClassName, papelizAccountStoragePlaceLabels } from './papeliz-account-config'
import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'

// The line under "Where should Sync keep your notes?" on the sign-up card, where the place is asked
// for the account itself. "Sync Free" is a bold link with the sliding underline and opens the Sync page
// in a new tab, so the card stays where it is.
export function PapelizAccountSyncFreeComesWithEveryAccountText() {
  return (
    <>
      Every account comes with{' '}
      <a href="/sync/" target="_blank" rel="noopener noreferrer" className={papelizAccountTextLinkClassName}>
        Sync Free
      </a>
      . Your notes are encrypted on your devices before they&rsquo;re stored.
    </>
  )
}

// Right above the button that sets the place, in the account page's red, since the place is for good.
export function PapelizAccountSyncStoragePlaceLockedLine() {
  return <p className="mt-3.5 text-center text-xs font-semibold text-papeliz-diff-removed-ink">You can&rsquo;t change server location later.</p>
}

// Where Sync keeps an account's notes: the five places as radio rows by name, the chosen one in blue,
// and "Nearest You" on the one nearest the browser's time zone. The same list on
// the sign-up card, the hand-over's card and checkout's dialog. Compact rows fit
// the sign-up card, which holds the username too.
export function PapelizAccountSyncStoragePlaceChoices({
  syncStoragePlaceChoicesGroupName,
  chosenPapelizSyncStoragePlace,
  nearestPapelizSyncStoragePlace,
  onPapelizSyncStoragePlaceChoose,
  isSyncStoragePlaceChoicesCompact = false,
}: {
  // The radio group's name, one per form on the page.
  syncStoragePlaceChoicesGroupName: string
  chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace
  nearestPapelizSyncStoragePlace: PapelizSyncStoragePlace
  onPapelizSyncStoragePlaceChoose: (papelizSyncStoragePlace: PapelizSyncStoragePlace) => void
  isSyncStoragePlaceChoicesCompact?: boolean
}) {
  return (
    <fieldset className={`m-0 grid border-0 p-0 ${isSyncStoragePlaceChoicesCompact ? 'gap-1.5' : 'gap-2'}`}>
      <legend className="sr-only">Storage place</legend>
      {papelizSyncStoragePlaces.map((papelizSyncStoragePlace) => (
        <label
          key={papelizSyncStoragePlace}
          className={`flex cursor-pointer items-center rounded-[10px] border ${isSyncStoragePlaceChoicesCompact ? 'gap-2.5 px-3 py-[7px]' : 'gap-3 px-3.5 py-2.5'} ${
            chosenPapelizSyncStoragePlace === papelizSyncStoragePlace ? 'border-papeliz-blue bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-surface-soft'
          }`}
        >
          <input
            type="radio"
            name={syncStoragePlaceChoicesGroupName}
            value={papelizSyncStoragePlace}
            checked={chosenPapelizSyncStoragePlace === papelizSyncStoragePlace}
            onChange={() => onPapelizSyncStoragePlaceChoose(papelizSyncStoragePlace)}
            className="size-4 accent-papeliz-gradient-start"
          />
          <span className="min-w-0 flex-1">
            <span className={`block font-semibold text-papeliz-ink ${isSyncStoragePlaceChoicesCompact ? 'text-[13px]' : 'text-sm'}`}>
              {papelizAccountStoragePlaceLabels[papelizSyncStoragePlace].storagePlaceName}
            </span>
          </span>
          {papelizSyncStoragePlace === nearestPapelizSyncStoragePlace && <span className={papelizAccountNearestStoragePlaceBadgeClassName}>Nearest You</span>}
        </label>
      ))}
    </fieldset>
  )
}
