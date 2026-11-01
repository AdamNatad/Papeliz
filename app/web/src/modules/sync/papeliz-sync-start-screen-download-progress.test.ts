import { describe, expect, it } from 'vitest'
import { describePapelizSyncStartScreenDownloadFileCount, readPapelizSyncStartScreenDownloadPercent } from './papeliz-sync-start-screen-download-progress'
import type { PapelizSyncStartScreenDownload } from './papeliz-sync-start-screen-download-store'

function createTestSyncStartScreenDownload(syncTransferredFileCount: number | null, syncTransferFileCount: number | null): PapelizSyncStartScreenDownload {
  return {
    papelizVaultId: 'travel-journal-vault',
    papelizSyncVaultId: 'pzvault_travel',
    papelizVaultDisplayName: 'Travel journal',
    isSyncDownloadCopyOnly: false,
    syncStartScreenDownloadStage: 'downloading',
    syncTransferredFileCount,
    syncTransferFileCount,
    syncStartScreenDownloadStopWords: null,
  }
}

describe('a start-screen download’s progress', () => {
  it('says how many files are here, in the one file-count wording', () => {
    expect(describePapelizSyncStartScreenDownloadFileCount(createTestSyncStartScreenDownload(12, 1482))).toBe('12 of 1,482 files')
    expect(describePapelizSyncStartScreenDownloadFileCount(createTestSyncStartScreenDownload(0, 1))).toBe('0 of 1 file')
  })

  it('says nothing until the engine reports', () => {
    expect(describePapelizSyncStartScreenDownloadFileCount(createTestSyncStartScreenDownload(null, null))).toBeNull()
    expect(readPapelizSyncStartScreenDownloadPercent(createTestSyncStartScreenDownload(null, null))).toBeNull()
  })

  it('rounds the percent down, and has none for an empty vault', () => {
    expect(readPapelizSyncStartScreenDownloadPercent(createTestSyncStartScreenDownload(2, 3))).toBe(66)
    expect(readPapelizSyncStartScreenDownloadPercent(createTestSyncStartScreenDownload(0, 0))).toBeNull()
  })
})
