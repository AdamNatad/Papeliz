import { papelizSiteHelpUrl } from './papeliz-site-config'
import {
  papelizSiteSyncConnectedDeviceLimit,
  papelizSiteSyncEducationAndNonProfitDiscountPercent,
  papelizSiteSyncFreePlan,
  papelizSiteSyncPlans,
  papelizSiteSyncRefundWindowDayCount,
  readPapelizSiteSyncPlanYearlyDiscountPercent,
} from './papeliz-site-sync-plans'

// An answer is plain text, or text with links.
export type PapelizSiteQuestionAnswerPart = string | { papelizSiteQuestionAnswerLinkLabel: string; papelizSiteQuestionAnswerLinkHref: string }

export type PapelizSiteQuestion = {
  papelizSiteQuestionAnchor: string
  papelizSiteQuestionText: string
  papelizSiteQuestionAnswerParts: PapelizSiteQuestionAnswerPart[]
}

// The Pricing page's questions.
export const papelizSitePricingQuestions: PapelizSiteQuestion[] = [
  {
    papelizSiteQuestionAnchor: 'commercial-use',
    papelizSiteQuestionText: 'Do I have to pay for commercial use?',
    papelizSiteQuestionAnswerParts: [
      'No. Papeliz is free for any use, work included, under the MIT License. The assistant runs on your own API key, so your AI provider bills you for what you use, not Papeliz.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'do-i-need-sync',
    papelizSiteQuestionText: 'Do I need Papeliz Sync?',
    papelizSiteQuestionAnswerParts: [
      'No. A vault is a folder of Markdown files on your disk or in your browser, and Papeliz works with it as it is. Sync is for keeping the same vaults on all your devices.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'how-do-i-sign-up',
    papelizSiteQuestionText: 'How do I sign up for Sync?',
    papelizSiteQuestionAnswerParts: [
      'Choose a plan on this page, or in Papeliz under Settings › Sync. You sign in and pick where your synced notes are stored. Free starts right away; a paid plan then goes to checkout.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'free-trial-and-refunds',
    papelizSiteQuestionText: 'Is there a free trial?',
    papelizSiteQuestionAnswerParts: [
      `No. Free is a plan, not a trial, and it stays free: ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanStorageLabel} of storage, ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanVaultLimit} synced vault and ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} devices. A paid plan can be fully refunded within ${papelizSiteSyncRefundWindowDayCount} days of subscribing.`,
    ],
  },
  {
    papelizSiteQuestionAnchor: 'monthly-or-yearly',
    papelizSiteQuestionText: 'Can I pay monthly?',
    papelizSiteQuestionAnswerParts: [
      `Yes. Yearly is chosen first, and costs ${readPapelizSiteSyncPlanYearlyDiscountPercent(papelizSiteSyncPlans[0]!)}% less than twelve months billed monthly. Monthly is one click away, above the plans.`,
    ],
  },
  {
    papelizSiteQuestionAnchor: 'what-counts-toward-storage',
    papelizSiteQuestionText: 'What counts toward my storage?',
    papelizSiteQuestionAnswerParts: [
      'Every file you sync, with its old versions. You can delete old versions to free up space; the current version of each file always stays.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'education-and-non-profit-discount',
    papelizSiteQuestionText: 'Is there a discount for education and non-profits?',
    papelizSiteQuestionAnswerParts: [
      `Yes: ${papelizSiteSyncEducationAndNonProfitDiscountPercent}% off any plan, monthly or yearly, as a code after a short check.`,
    ],
  },
  {
    papelizSiteQuestionAnchor: 'can-papeliz-read-my-notes',
    papelizSiteQuestionText: 'Can Papeliz read my synced notes?',
    papelizSiteQuestionAnswerParts: [
      'Only in a Standard vault. When you turn Sync on for a vault, you choose Standard or End-to-end, and either way its files are encrypted on your device before they’re uploaded. Papeliz keeps a Standard vault’s key, so it could read that vault. An End-to-end vault has its own passphrase, which Papeliz never receives, so Papeliz can’t read it. Vault and device names are readable for both. ',
      { papelizSiteQuestionAnswerLinkLabel: 'How Sync works', papelizSiteQuestionAnswerLinkHref: '/sync/' },
    ],
  },
  {
    papelizSiteQuestionAnchor: 'when-a-subscription-ends',
    papelizSiteQuestionText: 'What happens if I cancel?',
    papelizSiteQuestionAnswerParts: [
      'Uploads stop, and your synced copy stays readable for 30 days, so any device can still download it. It is deleted 60 days after that, with an email before each date. The notes on your devices are never touched.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'currency-and-tax',
    papelizSiteQuestionText: 'Which currency are the prices in?',
    papelizSiteQuestionAnswerParts: ['US dollars, before any sales tax or VAT that applies where you live.'],
  },
]

// The Sync page's questions: how Sync works.
export const papelizSiteSyncQuestions: PapelizSiteQuestion[] = [
  {
    papelizSiteQuestionAnchor: 'what-syncs',
    papelizSiteQuestionText: 'What does Sync keep in sync?',
    papelizSiteQuestionAnswerParts: [
      'Your notes, attachments such as pictures and PDFs, and the vault’s own Papeliz settings. Assistant chats and app settings sync too, unless you turn them off. AI provider keys never sync: you paste yours on each device.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'two-devices-edit-one-note',
    papelizSiteQuestionText: 'What if two devices edit the same note?',
    papelizSiteQuestionAnswerParts: [
      'The edits merge line by line. If both devices changed the same line, Papeliz asks you which to keep. Nothing is dropped.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'forgotten-passphrase',
    papelizSiteQuestionText: 'What if I forget my passphrase?',
    papelizSiteQuestionAnswerParts: [
      'Only End-to-end vaults have a passphrase, and Papeliz can’t recover it. If you forget it, choose Remove from Sync for that vault, then turn Sync on again from a device that still has its notes. The notes on your devices stay as they are.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'switch-standard-and-end-to-end',
    papelizSiteQuestionText: 'Can I switch a vault between Standard and End-to-end?',
    papelizSiteQuestionAnswerParts: [
      'Only by syncing it again: choose Remove from Sync for that vault, then turn Sync on with the other choice. The notes on your devices stay as they are.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'where-is-it-stored',
    papelizSiteQuestionText: 'Where is my synced data stored?',
    papelizSiteQuestionAnswerParts: [
      'In the place you pick when you sign up for Sync: North America (East or West), Europe, Asia-Pacific or Oceania. Europe is stored in the EU. You pick once, and it stays there.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'sync-and-the-assistant',
    papelizSiteQuestionText: 'Does Sync send my notes to an AI?',
    papelizSiteQuestionAnswerParts: [
      'No. Sync never carries an AI request. The assistant still talks straight to the provider you chose, with your own key.',
    ],
  },
  {
    papelizSiteQuestionAnchor: 'how-many-devices',
    papelizSiteQuestionText: 'How many devices can I use?',
    papelizSiteQuestionAnswerParts: [
      `As many as you like, on the web, desktop and mobile. Up to ${papelizSiteSyncConnectedDeviceLimit} can be connected at once on a paid plan, and ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} on Free.`,
    ],
  },
]

// "More questions?" under each page's questions.
export const papelizSiteQuestionsHelpUrl = papelizSiteHelpUrl
