import {
  papelizSiteSyncConnectedDeviceLimit,
  papelizSiteSyncFreePlan,
  papelizSiteSyncPlanEncryptionLine,
  papelizSiteSyncPlans,
  type PapelizSiteSyncPlan,
  type PapelizSiteSyncPlanId,
} from '../../main/lib/papeliz-site-sync-plans'
import { helpBulletList, helpDetailList, helpNote, helpNumberedSteps, helpParagraph, helpSection, type PapelizHelpArticle } from './papeliz-help-content-blocks'

// Papeliz Sync's plans, each plan's details, and its old versions. The numbers come from the website's
// plan data, the one copy the help site can read; that data has no attachment history, so its lengths are
// here, and a test of Sync's plan table checks them.

export const papelizHelpSyncPlansArticleSlug = 'sync-plans'
export const papelizHelpSyncOldVersionsArticleSlug = 'sync-old-versions'

// Days an attachment's old versions are kept: every file that isn't a note.
export const papelizHelpSyncAttachmentHistoryDayCounts: Readonly<Record<'free' | PapelizSiteSyncPlanId, number>> = {
  free: 7,
  standard: 14,
  plus: 14,
  pro: 14,
}

// "7 days", "2 weeks", "1 month", "12 months".
function describePapelizHelpSyncHistoryLength(historyDayCount: number | null, historyMonthCount: number | null): string {
  if (historyMonthCount !== null && historyMonthCount > 0) return `${historyMonthCount} ${historyMonthCount === 1 ? 'month' : 'months'}`
  const historyDays = historyDayCount ?? 0
  if (historyDays > 0 && historyDays % 7 === 0 && historyDays !== 7) return `${historyDays / 7} weeks`
  return `${historyDays} ${historyDays === 1 ? 'day' : 'days'}`
}

function describePapelizHelpSyncPlanPrice(papelizSiteSyncPlan: PapelizSiteSyncPlan): string {
  const yearlyMonthlyRateUsd = papelizSiteSyncPlan.papelizSiteSyncPlanYearlyPriceUsd / 12
  return `$${papelizSiteSyncPlan.papelizSiteSyncPlanMonthlyPriceUsd} a month, or $${Number.isInteger(yearlyMonthlyRateUsd) ? yearlyMonthlyRateUsd : yearlyMonthlyRateUsd.toFixed(2)} a month billed yearly`
}

const papelizHelpSyncFreePlanDetails = helpDetailList([
  ['Price', 'Free, with every Papeliz account'],
  ['Storage', `${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanStorageLabel}, old versions included`],
  ['Synced vaults', String(papelizSiteSyncFreePlan.papelizSiteSyncFreePlanVaultLimit)],
  ['Devices', String(papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit)],
  ['Largest file', papelizSiteSyncFreePlan.papelizSiteSyncFreePlanLargestFileLabel],
  ['Version history of notes', describePapelizHelpSyncHistoryLength(papelizSiteSyncFreePlan.papelizSiteSyncFreePlanNoteHistoryDayCount, null)],
  ['Version history of attachments', describePapelizHelpSyncHistoryLength(papelizHelpSyncAttachmentHistoryDayCounts.free, null)],
  ['Encryption', papelizSiteSyncPlanEncryptionLine],
])

function readPapelizHelpSyncPaidPlanDetails(papelizSiteSyncPlan: PapelizSiteSyncPlan) {
  return helpDetailList([
    ['Price', describePapelizHelpSyncPlanPrice(papelizSiteSyncPlan)],
    ['Storage', `${papelizSiteSyncPlan.papelizSiteSyncPlanStorageLabel}, old versions included`],
    ['Synced vaults', String(papelizSiteSyncPlan.papelizSiteSyncPlanVaultLimit)],
    ['Files in each vault', papelizSiteSyncPlan.papelizSiteSyncPlanFilesPerVaultLimit.toLocaleString('en-US')],
    ['Devices', String(papelizSiteSyncConnectedDeviceLimit)],
    ['Largest file', papelizSiteSyncPlan.papelizSiteSyncPlanLargestFileLabel],
    ['Version history of notes', describePapelizHelpSyncHistoryLength(null, papelizSiteSyncPlan.papelizSiteSyncPlanNoteHistoryMonthCount)],
    ['Version history of attachments', describePapelizHelpSyncHistoryLength(papelizHelpSyncAttachmentHistoryDayCounts[papelizSiteSyncPlan.papelizSiteSyncPlanId], null)],
    ['Encryption', papelizSiteSyncPlanEncryptionLine],
  ])
}

export const papelizHelpSyncArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: papelizHelpSyncPlansArticleSlug,
    articleTitle: 'Papeliz Sync plans',
    articleSummary: 'Each plan’s storage, vaults, devices, file sizes and version history.',
    papelizHelpGroupSlug: 'reference',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('Every plan', [
        helpParagraph(
          'Papeliz Sync keeps your vaults the same on every device. Every Papeliz account comes with **Free**; **Standard**, **Plus** and **Pro** are paid plans. You choose and change your plan on the gear’s **Sync** page, under **Plans**.',
        ),
        helpBulletList([
          'Storage counts every file Sync keeps, old versions included. See [[sync-old-versions]].',
          'Devices are the devices syncing at the same time.',
          'Version history is how long old versions are kept. An attachment is every file that isn’t a note: pictures, PDFs and everything else.',
          'Every plan offers **Standard** and **End-to-end** encryption, chosen vault by vault.',
        ]),
      ]),
      helpSection('Free', [papelizHelpSyncFreePlanDetails]),
      ...papelizSiteSyncPlans.map((papelizSiteSyncPlan) => helpSection(papelizSiteSyncPlan.papelizSiteSyncPlanName, [readPapelizHelpSyncPaidPlanDetails(papelizSiteSyncPlan)])),
      helpSection('When storage is full', [
        helpParagraph(
          'Uploads wait until there’s room. Downloads go on, and every change stays saved on your device. To sync again, free up space by deleting old versions, or move to a bigger plan.',
        ),
      ]),
    ],
    relatedArticleSlugs: [papelizHelpSyncOldVersionsArticleSlug, 'settings-gear'],
  },
  {
    papelizHelpArticleSlug: papelizHelpSyncOldVersionsArticleSlug,
    articleTitle: 'Old versions and freeing up space',
    articleSummary: 'Look at, restore or delete old versions, and free up Sync storage.',
    papelizHelpGroupSlug: 'reference',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('How old versions are kept', [
        helpParagraph(
          'Each time a synced file changes, Sync keeps the version it replaced: every version from the last hour, then one an hour for a week, then one a day, for as long as your plan’s version history. See [[sync-plans]].',
        ),
        helpParagraph('Old versions count toward your storage.'),
      ]),
      helpSection('Look at or restore a version', [
        helpNumberedSteps([
          'Open the note.',
          'In the gear’s **Sync** page, under **Settings**, choose **Old Versions**.',
          'Choose **Look** to read a version, or **Restore** to make it the newest version on every device. The version it replaces stays in the list.',
        ]),
      ]),
      helpSection('Delete old versions of a note', [
        helpParagraph(
          'In **Old Versions**, choose **Delete** beside a version, or **Delete All Old Versions**. Each asks first. The newest version always stays, and so does the note on your devices.',
        ),
      ]),
      helpSection('Free up space', [
        helpNumberedSteps([
          'In the gear’s **Sync** page, under **Settings**, choose **Free Up Space** below the storage bar. When your storage is full, the notice at the top has it too.',
          'With more than one synced vault, choose the vault.',
          'Choose which old versions to delete: **Over 30 Days**, **Over 90 Days**, **Over a Year** or **All**. Papeliz shows how many that is and how much storage it frees.',
          'Choose **Delete Old Versions**.',
        ]),
        helpParagraph('Storage drops right away, on every device.'),
        helpNote(
          'Deleted versions can’t be restored. A version whose contents another file or kept version still holds frees no storage. The newest version of every file always stays.',
        ),
      ]),
      helpSection('Standard and End-to-end vaults', [
        helpParagraph(
          'Deleting works the same for both. Sync deletes versions without opening any file, so an End-to-end vault needs no passphrase for it, and it works from any signed-in device.',
        ),
      ]),
    ],
    relatedArticleSlugs: [papelizHelpSyncPlansArticleSlug, 'rename-move-and-trash'],
  },
]
