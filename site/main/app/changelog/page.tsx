import Link from 'next/link'
import { PapelizSitePageIntro } from '@/components/marketing/papeliz-site-page-intro'
import { papelizSiteChangelogEntries } from '@/lib/papeliz-site-changelog'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Changelog',
  papelizSitePageDescription: 'What has changed in Papeliz, newest first.',
  papelizSitePagePath: '/changelog/',
})

const papelizSiteChangelogDateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

export default function PapelizSiteChangelogPage() {
  return (
    <>
      <PapelizSitePageIntro papelizSitePageHeading="What has changed">
        <p>
          Papeliz has no public release yet, so this log records what has been built so far. The{' '}
          <Link href="/roadmap/" className="font-medium text-papeliz-blue hover:underline">roadmap</Link> shows what comes next.
        </p>
      </PapelizSitePageIntro>

      <ol className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {papelizSiteChangelogEntries.map((papelizSiteChangelogEntry) => (
          <li
            key={`${papelizSiteChangelogEntry.papelizSiteChangelogDate}-${papelizSiteChangelogEntry.papelizSiteChangelogTitle}`}
            className="grid gap-2 border-t border-papeliz-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8"
          >
            <div className="text-sm text-papeliz-ink-muted">
              <time dateTime={papelizSiteChangelogEntry.papelizSiteChangelogDate}>
                {papelizSiteChangelogDateFormat.format(new Date(`${papelizSiteChangelogEntry.papelizSiteChangelogDate}T00:00:00Z`))}
              </time>
              <p className="mt-1 font-mono text-xs text-papeliz-ink-subtle">Milestone {papelizSiteChangelogEntry.papelizSiteChangelogMilestone}</p>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{papelizSiteChangelogEntry.papelizSiteChangelogTitle}</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-papeliz-ink-muted marker:text-papeliz-line-strong">
                {papelizSiteChangelogEntry.papelizSiteChangelogChanges.map((papelizSiteChangelogChange) => (
                  <li key={papelizSiteChangelogChange}>{papelizSiteChangelogChange}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
