import { useCallback, useState } from 'react'
import type { PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'

// The place a person picked in each storage place list, kept for the page load outside the list's own
// component. A list drawn again (its parent mounted anew, or the dev server's hot reload) opens on the
// place already picked, never back on its first place, so the place sent is always the one shown and
// never the nearest place picked for the person. One entry per radio group.
const papelizAccountSyncStoragePlaceChoicesThisPageLoad = new Map<string, PapelizSyncStoragePlace>()

// The place picked in this group this page load, or its first place when none was picked yet.
export function readPapelizAccountSyncStoragePlaceChoice(syncStoragePlaceChoicesGroupName: string, firstPapelizSyncStoragePlace: PapelizSyncStoragePlace): PapelizSyncStoragePlace {
  return papelizAccountSyncStoragePlaceChoicesThisPageLoad.get(syncStoragePlaceChoicesGroupName) ?? firstPapelizSyncStoragePlace
}

export function rememberPapelizAccountSyncStoragePlaceChoice(syncStoragePlaceChoicesGroupName: string, chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace): void {
  papelizAccountSyncStoragePlaceChoicesThisPageLoad.set(syncStoragePlaceChoicesGroupName, chosenPapelizSyncStoragePlace)
}

// For tests: the page load starting over.
export function forgetPapelizAccountSyncStoragePlaceChoices(): void {
  papelizAccountSyncStoragePlaceChoicesThisPageLoad.clear()
}

// A storage place list's choice: the place picked earlier this page load, or its first place (the one
// nearest the browser, or one the app already chose), and the setter that keeps it.
export function usePapelizAccountSyncStoragePlaceChoice(
  syncStoragePlaceChoicesGroupName: string,
  firstPapelizSyncStoragePlace: PapelizSyncStoragePlace,
): [PapelizSyncStoragePlace, (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => void] {
  const [chosenPapelizSyncStoragePlace, setChosenPapelizSyncStoragePlace] = useState(() =>
    readPapelizAccountSyncStoragePlaceChoice(syncStoragePlaceChoicesGroupName, firstPapelizSyncStoragePlace),
  )
  const choosePapelizSyncStoragePlace = useCallback(
    (newlyChosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
      rememberPapelizAccountSyncStoragePlaceChoice(syncStoragePlaceChoicesGroupName, newlyChosenPapelizSyncStoragePlace)
      setChosenPapelizSyncStoragePlace(newlyChosenPapelizSyncStoragePlace)
    },
    [syncStoragePlaceChoicesGroupName],
  )
  return [chosenPapelizSyncStoragePlace, choosePapelizSyncStoragePlace]
}
