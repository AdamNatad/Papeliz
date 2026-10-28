import Link from 'next/link'
import { PapelizSitePageIntro } from '@/components/marketing/papeliz-site-page-intro'
import { type PapelizSiteRoadmapStatus, papelizSiteRoadmapMilestones, papelizSiteRoadmapStatusLabels } from '@/lib/papeliz-site-roadmap'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Roadmap',
  papelizSitePageDescription: 'What’s in Papeliz today, what’s being built next — Papeliz Sync — and the ideas after that.',
  papelizSitePagePath: '/roadmap/',
})

const papelizSiteRoadmapStatusClasses: Record<PapelizSiteRoadmapStatus, string> = {
  done: 'bg-papeliz-diff-added text-papeliz-diff-added-ink',
  'in-progress': 'bg-papeliz-blue-soft text-papeliz-blue',
  'up-next': 'bg-papeliz-surface-gray text-papeliz-ink',
  later: 'bg-papeliz-surface-gray text-papeliz-ink-muted',
}

function PapelizSiteRoadmapStatusBadge({ papelizSiteRoadmapStatus }: { papelizSiteRoadmapStatus: PapelizSiteRoadmapStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${papelizSiteRoadmapStatusClasses[papelizSiteRoadmapStatus]}`}>
      {papelizSiteRoadmapStatusLabels[papelizSiteRoadmapStatus]}
    </span>
  )
}

export default function PapelizSiteRoadmapPage() {
  return (
    <>
      <PapelizSitePageIntro papelizSitePageHeading="What we are building, in order">
        <p>
          The order and the scope, without dates. For what has already happened, see the{' '}
          <Link href="/changelog/" className="font-medium text-papeliz-blue hover:underline">changelog</Link>.
        </p>
      </PapelizSitePageIntro>

      <ol className="mx-auto max-w-4xl space-y-12 px-4 py-16 sm:px-6">
        {papelizSiteRoadmapMilestones.map((papelizSiteRoadmapMilestone) => (
          <li key={papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneVersion}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm text-papeliz-ink-subtle">{papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneVersion}</span>
              <h2 className="text-2xl font-semibold tracking-tight">{papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneTitle}</h2>
              <PapelizSiteRoadmapStatusBadge papelizSiteRoadmapStatus={papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneStatus} />
            </div>
            <p className="mt-2 text-[17px] text-papeliz-ink-muted">{papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneSummary}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
              {papelizSiteRoadmapMilestone.papelizSiteRoadmapMilestoneSteps.map((papelizSiteRoadmapStep) => (
                <section key={papelizSiteRoadmapStep.papelizSiteRoadmapStepTitle} className="rounded-3xl border border-papeliz-line bg-papeliz-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{papelizSiteRoadmapStep.papelizSiteRoadmapStepTitle}</h3>
                    <PapelizSiteRoadmapStatusBadge papelizSiteRoadmapStatus={papelizSiteRoadmapStep.papelizSiteRoadmapStepStatus} />
                  </div>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-papeliz-ink-muted marker:text-papeliz-line-strong">
                    {papelizSiteRoadmapStep.papelizSiteRoadmapStepItems.map((papelizSiteRoadmapStepItem) => (
                      <li key={papelizSiteRoadmapStepItem}>{papelizSiteRoadmapStepItem}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
