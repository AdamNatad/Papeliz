import { create } from 'zustand'
import {
  readPapelizBrowserStorageEstimate,
  readPapelizBrowserStorageKeptState,
  requestPapelizBrowserStorageKept,
  type PapelizBrowserStorageEstimate,
  type PapelizBrowserStorageKeptState,
} from '../vault/papeliz-browser-vault-storage'

// What this tab knows about the browser's storage, for a browser vault's Reminder tab and status bar:
// whether the browser keeps it, and how full it is.
interface PapelizBrowserStorageState {
  browserStorageKeptState: PapelizBrowserStorageKeptState
  browserStorageEstimate: PapelizBrowserStorageEstimate | null
  // Asks the browser to keep this site's storage. Run it from the click that makes or opens a
  // browser vault: Firefox asks the user then.
  askBrowserToKeepStorage: () => void
  refreshBrowserStorageState: () => Promise<void>
}

export const usePapelizBrowserStorageStore = create<PapelizBrowserStorageState>()((setBrowserStorageState) => ({
  browserStorageKeptState: 'unknown',
  browserStorageEstimate: null,

  askBrowserToKeepStorage: () => {
    void requestPapelizBrowserStorageKept().then((browserStorageKeptState) => setBrowserStorageState({ browserStorageKeptState }))
  },

  refreshBrowserStorageState: async () => {
    const [browserStorageKeptState, browserStorageEstimate] = await Promise.all([readPapelizBrowserStorageKeptState(), readPapelizBrowserStorageEstimate()])
    setBrowserStorageState({ browserStorageKeptState, browserStorageEstimate })
  },
}))
