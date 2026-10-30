import { EyeOff, GitMerge, KeyRound, Lock, RefreshCw, Sparkles, FolderOpen, type LucideIcon } from 'lucide-react'
import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import { PapelizSiteQuestionList } from '@/components/pricing/papeliz-site-question-list'
import { PapelizSiteSyncPlanGrid } from '@/components/pricing/papeliz-site-sync-plan-grid'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import {
  papelizSiteSyncConnectedDeviceLimit,
  papelizSiteSyncEducationAndNonProfitDiscountPercent,
  papelizSiteSyncRefundWindowDayCount,
  createPapelizSiteSyncSignUpHref,
} from '@/lib/papeliz-site-sync-plans'
import { papelizSiteSyncQuestions } from '@/lib/papeliz-site-sync-questions'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Papeliz Sync',
  papelizSitePageDescription:
    'Papeliz Sync keeps your vaults the same on the web, desktop and mobile. End-to-end encrypted: Papeliz stores your synced notes but can never read them.',
  papelizSitePagePath: '/sync/',
})

type PapelizSiteSyncCard = {
  papelizSiteSyncCardTitle: string
  papelizSiteSyncCardBody: string
  PapelizSiteSyncCardIcon: LucideIcon
}

const papelizSiteSyncPrivacyCards: PapelizSiteSyncCard[] = [
  {
    PapelizSiteSyncCardIcon: Lock,
    papelizSiteSyncCardTitle: 'End-to-end encrypted.',
    papelizSiteSyncCardBody:
      'Your notes, file and folder names and settings are encrypted on your device before they leave it. Papeliz stores them, and never holds a key that opens them.',
  },
  {
    PapelizSiteSyncCardIcon: EyeOff,
    papelizSiteSyncCardTitle: 'What Papeliz never sees.',
    papelizSiteSyncCardBody:
      'The text of your notes, your attachments, the names of your files, folders and vaults, your tags and links, and your passphrase.',
  },
  {
    PapelizSiteSyncCardIcon: KeyRound,
    papelizSiteSyncCardTitle: 'Your passphrase, your Recovery Key.',
    papelizSiteSyncCardBody:
      'Only you know your passphrase. If you forget it, the Recovery Key you keep from set-up opens your notes again.',
  },
  {
    PapelizSiteSyncCardIcon: Sparkles,
    papelizSiteSyncCardTitle: 'Your AI stays yours.',
    papelizSiteSyncCardBody:
      'Sync never carries an AI request. The assistant talks straight to your provider, and your keys sync only if you turn that on, encrypted like a note.',
  },
]

const papelizSiteSyncDetailColumns = [
  {
    papelizSiteSyncDetailColumnTitle: 'What syncs',
    papelizSiteSyncDetailColumnItems: [
      { papelizSiteSyncDetailLabel: 'Notes', papelizSiteSyncDetailBody: 'Every Markdown note in the vault.' },
      { papelizSiteSyncDetailLabel: 'Attachments', papelizSiteSyncDetailBody: 'Pictures, PDFs and any other file.' },
      { papelizSiteSyncDetailLabel: 'Vault settings', papelizSiteSyncDetailBody: 'File order, colors, icons and locks.' },
      { papelizSiteSyncDetailLabel: 'Chats and app settings', papelizSiteSyncDetailBody: 'On unless you turn them off.' },
    ],
  },
  {
    papelizSiteSyncDetailColumnTitle: 'Every device',
    papelizSiteSyncDetailColumnItems: [
      { papelizSiteSyncDetailLabel: 'Web', papelizSiteSyncDetailBody: 'A folder on disk, or a vault kept in the browser.' },
      { papelizSiteSyncDetailLabel: 'Desktop', papelizSiteSyncDetailBody: 'Windows, macOS and Linux.' },
      { papelizSiteSyncDetailLabel: 'Mobile', papelizSiteSyncDetailBody: 'Android, iOS and HarmonyOS.' },
      {
        papelizSiteSyncDetailLabel: 'Any number of devices',
        papelizSiteSyncDetailBody: `Up to ${papelizSiteSyncConnectedDeviceLimit} connected at once.`,
      },
    ],
  },
  {
    papelizSiteSyncDetailColumnTitle: 'Where it lives',
    papelizSiteSyncDetailColumnItems: [
      { papelizSiteSyncDetailLabel: 'Your pick', papelizSiteSyncDetailBody: 'North America (East or West), Europe, Asia-Pacific or Oceania.' },
      { papelizSiteSyncDetailLabel: 'Chosen once', papelizSiteSyncDetailBody: 'Before you subscribe, and it stays there.' },
      { papelizSiteSyncDetailLabel: 'Europe', papelizSiteSyncDetailBody: 'Your synced data never leaves the EU.' },
    ],
  },
]

const papelizSiteSyncMergeCards: PapelizSiteSyncCard[] = [
  {
    PapelizSiteSyncCardIcon: GitMerge,
    papelizSiteSyncCardTitle: 'Line by line.',
    papelizSiteSyncCardBody: 'Edits from two devices merge. If both changed the same line, Papeliz asks which to keep.',
  },
  {
    PapelizSiteSyncCardIcon: RefreshCw,
    papelizSiteSyncCardTitle: 'In the background.',
    papelizSiteSyncCardBody: 'Sync runs while you write, and catches up on changes made while Papeliz was closed.',
  },
  {
    PapelizSiteSyncCardIcon: FolderOpen,
    papelizSiteSyncCardTitle: 'Still your files.',
    papelizSiteSyncCardBody: 'On every device, your notes stay plain Markdown files. Sync keeps the copies the same.',
  },
]

function PapelizSiteSyncSectionHeading({ papelizSiteSyncSectionHeadingId, papelizSiteSyncSectionHeadingTitle, papelizSiteSyncSectionHeadingLead }: {
  papelizSiteSyncSectionHeadingId: string
  papelizSiteSyncSectionHeadingTitle: string
  papelizSiteSyncSectionHeadingLead: string
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 id={papelizSiteSyncSectionHeadingId} className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
        {papelizSiteSyncSectionHeadingTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-papeliz-ink-muted sm:text-lg">{papelizSiteSyncSectionHeadingLead}</p>
    </div>
  )
}

function PapelizSiteSyncCardItem({ papelizSiteSyncCard }: { papelizSiteSyncCard: PapelizSiteSyncCard }) {
  return (
    <article className="rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-6">
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
        <papelizSiteSyncCard.PapelizSiteSyncCardIcon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-base font-semibold">{papelizSiteSyncCard.papelizSiteSyncCardTitle}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteSyncCard.papelizSiteSyncCardBody}</p>
    </article>
  )
}

// Papeliz Sync's own page (Adam, 2026-10-31): what it does,
// what stays private, what syncs and where, then the plans and the questions.
export default function PapelizSiteSyncPage() {
  // The top's Sign up starts with Standard, billed yearly, as the plans below show first.
  const papelizSiteSyncHeroSignUpHref = createPapelizSiteSyncSignUpHref('standard', 'yearly')
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 pb-16 sm:px-6 sm:pb-20">
      <PapelizSiteCenteredPageHero papelizSiteCenteredPageHeroHeading="All your notes, on all your devices.">
        <p>Papeliz Sync keeps your vaults the same on the web, desktop and mobile, end-to-end encrypted.</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {papelizSiteSyncHeroSignUpHref && (
            <a
              href={papelizSiteSyncHeroSignUpHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-papeliz-blue px-6 text-[15px] font-medium text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover"
            >
              Sign up
            </a>
          )}
          <a
            href="#sync-plans"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-papeliz-line-strong px-6 text-[15px] font-medium text-papeliz-ink transition-colors hover:bg-papeliz-hover"
          >
            See plans
          </a>
        </div>
      </PapelizSiteCenteredPageHero>

      <section aria-labelledby="sync-private-title" className="space-y-8">
        <PapelizSiteSyncSectionHeading
          papelizSiteSyncSectionHeadingId="sync-private-title"
          papelizSiteSyncSectionHeadingTitle="Private by design"
          papelizSiteSyncSectionHeadingLead="Sync works quietly in the background, and only you can read what it carries."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {papelizSiteSyncPrivacyCards.map((papelizSiteSyncPrivacyCard) => (
            <PapelizSiteSyncCardItem key={papelizSiteSyncPrivacyCard.papelizSiteSyncCardTitle} papelizSiteSyncCard={papelizSiteSyncPrivacyCard} />
          ))}
        </div>
      </section>

      <section aria-label="What syncs, on which devices, and where" className="grid gap-8 sm:grid-cols-3">
        {papelizSiteSyncDetailColumns.map((papelizSiteSyncDetailColumn) => (
          <div key={papelizSiteSyncDetailColumn.papelizSiteSyncDetailColumnTitle} className="border-t border-papeliz-line pt-5">
            <h3 className="text-lg font-semibold tracking-tight">{papelizSiteSyncDetailColumn.papelizSiteSyncDetailColumnTitle}</h3>
            <dl className="mt-4 space-y-4">
              {papelizSiteSyncDetailColumn.papelizSiteSyncDetailColumnItems.map((papelizSiteSyncDetail) => (
                <div key={papelizSiteSyncDetail.papelizSiteSyncDetailLabel}>
                  <dt className="text-[15px] font-semibold">{papelizSiteSyncDetail.papelizSiteSyncDetailLabel}</dt>
                  <dd className="mt-0.5 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteSyncDetail.papelizSiteSyncDetailBody}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section aria-labelledby="sync-merge-title" className="space-y-8">
        <PapelizSiteSyncSectionHeading
          papelizSiteSyncSectionHeadingId="sync-merge-title"
          papelizSiteSyncSectionHeadingTitle="Write anywhere, lose nothing"
          papelizSiteSyncSectionHeadingLead="Edit the same vault on two devices, even the same note. Sync brings the edits together."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {papelizSiteSyncMergeCards.map((papelizSiteSyncMergeCard) => (
            <PapelizSiteSyncCardItem key={papelizSiteSyncMergeCard.papelizSiteSyncCardTitle} papelizSiteSyncCard={papelizSiteSyncMergeCard} />
          ))}
        </div>
      </section>

      <section id="sync-plans" aria-labelledby="sync-plans-title" className="scroll-mt-31 md:scroll-mt-20">
        <PapelizSiteSyncSectionHeading
          papelizSiteSyncSectionHeadingId="sync-plans-title"
          papelizSiteSyncSectionHeadingTitle="Pricing"
          papelizSiteSyncSectionHeadingLead="Three plans, billed monthly or yearly. Prices in USD."
        />
        <PapelizSiteSyncPlanGrid papelizSiteSyncPlanGridShows="every-plan" />
        <dl className="mx-auto mt-8 max-w-3xl space-y-2.5 text-sm leading-relaxed text-papeliz-ink-muted">
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-papeliz-ink">Refunds</dt>
            <dd>No trial. A full refund within {papelizSiteSyncRefundWindowDayCount} days of subscribing.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-papeliz-ink">Education and non-profits</dt>
            <dd>{papelizSiteSyncEducationAndNonProfitDiscountPercent}% off any plan, as a code after a short check.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-papeliz-ink">Signing up</dt>
            <dd>In Papeliz, open Settings › Sync and choose a plan.</dd>
          </div>
        </dl>
      </section>

      <PapelizSiteQuestionList
        papelizSiteQuestionListAnchor="sync-questions"
        papelizSiteQuestionListHeading="A few more details"
        papelizSiteQuestions={papelizSiteSyncQuestions}
      />
    </div>
  )
}
