import { EyeOff, GitMerge, KeyRound, Lock, RefreshCw, Sparkles, FolderOpen, type LucideIcon } from 'lucide-react'
import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import { PapelizSiteQuestionList } from '@/components/pricing/papeliz-site-question-list'
import { PapelizSiteSyncPlanGrid } from '@/components/pricing/papeliz-site-sync-plan-grid'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import { createPapelizSiteSyncSignUpHref, papelizSiteSyncConnectedDeviceLimit, papelizSiteSyncFreePlan } from '@/lib/papeliz-site-sync-plans'
import { papelizSiteSyncQuestions } from '@/lib/papeliz-site-sync-questions'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Papeliz Sync',
  papelizSitePageDescription:
    'Papeliz Sync keeps your vaults the same on the web, desktop and mobile, with end-to-end encryption for the vaults you choose.',
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
    papelizSiteSyncCardTitle: 'Encrypted on your device.',
    papelizSiteSyncCardBody:
      'Your notes, attachments, settings, and file and folder names are encrypted on your device before they’re uploaded. Vault and device names aren’t.',
  },
  {
    PapelizSiteSyncCardIcon: KeyRound,
    papelizSiteSyncCardTitle: 'Standard: no passphrase.',
    papelizSiteSyncCardBody:
      'Papeliz keeps the vault’s key, so the vault opens on any device you sign in on. It also means Papeliz could read it.',
  },
  {
    PapelizSiteSyncCardIcon: EyeOff,
    papelizSiteSyncCardTitle: 'End-to-end: only you can read it.',
    papelizSiteSyncCardBody:
      'The vault has its own passphrase, which Papeliz never receives. Papeliz can’t read the vault, and can’t recover the passphrase if you forget it.',
  },
  {
    PapelizSiteSyncCardIcon: Sparkles,
    papelizSiteSyncCardTitle: 'Your AI stays yours.',
    papelizSiteSyncCardBody:
      'Sync never carries an AI request, and your AI provider keys never sync. The assistant talks straight to your provider.',
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
        papelizSiteSyncDetailBody: `Up to ${papelizSiteSyncConnectedDeviceLimit} connected at once, or ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} on Free.`,
      },
    ],
  },
  {
    papelizSiteSyncDetailColumnTitle: 'Where it lives',
    papelizSiteSyncDetailColumnItems: [
      { papelizSiteSyncDetailLabel: 'Your pick', papelizSiteSyncDetailBody: 'Eastern North America, Western North America, Europe, Asia-Pacific or Oceania.' },
      { papelizSiteSyncDetailLabel: 'Chosen once', papelizSiteSyncDetailBody: 'When you sign up, and it stays there.' },
      { papelizSiteSyncDetailLabel: 'Europe', papelizSiteSyncDetailBody: 'Stored in the EU.' },
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
  // The top's See plans, then Subscribe, which checks out Standard, billed yearly, like that plan's own
  // Subscribe below: signed in, straight to checkout; signed out, sign-in first (Adam, 2026-11-03: "see
  // plans on the left and Subscribe on the right", then "Standard, yearly").
  const papelizSiteSyncHeroSubscribeHref = createPapelizSiteSyncSignUpHref('standard', 'yearly')
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 pb-16 sm:px-6 sm:pb-20">
      <PapelizSiteCenteredPageHero papelizSiteCenteredPageHeroHeading="All your notes, on all your devices.">
        <p>Papeliz Sync keeps your vaults the same on the web, desktop and mobile, with end-to-end encryption for the vaults you choose.</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#sync-plans"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-papeliz-line-strong px-6 text-[15px] font-medium text-papeliz-ink transition-colors hover:bg-papeliz-hover"
          >
            See plans
          </a>
          {papelizSiteSyncHeroSubscribeHref && (
            <a
              href={papelizSiteSyncHeroSubscribeHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-papeliz-blue px-6 text-[15px] font-medium text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover"
            >
              Subscribe
            </a>
          )}
        </div>
      </PapelizSiteCenteredPageHero>

      <section aria-labelledby="sync-private-title" className="space-y-8">
        <PapelizSiteSyncSectionHeading
          papelizSiteSyncSectionHeadingId="sync-private-title"
          papelizSiteSyncSectionHeadingTitle="Private by design"
          papelizSiteSyncSectionHeadingLead="Sync works quietly in the background. For each vault you sync, you choose Standard or End-to-end."
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
          papelizSiteSyncSectionHeadingLead="Free, and three paid plans billed yearly or monthly. Prices in USD."
        />
        {/* The Pricing page's plan block. Refunds, the discount and signing up are answered in Pricing's FAQ. */}
        <PapelizSiteSyncPlanGrid />
      </section>

      <PapelizSiteQuestionList
        papelizSiteQuestionListAnchor="sync-questions"
        papelizSiteQuestionListHeading="A few more details"
        papelizSiteQuestions={papelizSiteSyncQuestions}
      />
    </div>
  )
}
