import { ArrowRight, BookOpen, Rocket, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { papelizSiteAppUrl, papelizSiteHelpUrl } from '@/lib/papeliz-site-config'
import { papelizSiteDownloadTargets } from '@/lib/papeliz-site-downloads'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Download',
  papelizSitePageDescription:
    'Download Papeliz for Windows, macOS, Linux, iPhone and iPad, Android and HarmonyOS, or use it on the web. Free and open source.',
  papelizSitePagePath: '/download/',
})

const papelizSiteInstallSteps = [
  { papelizSiteInstallStepTitle: 'Choose your platform', papelizSiteInstallStepBody: 'Pick your device above, or use Papeliz on the web.' },
  { papelizSiteInstallStepTitle: 'Install Papeliz', papelizSiteInstallStepBody: 'Install it the way your device usually installs apps.' },
  {
    papelizSiteInstallStepTitle: 'Open your notes',
    papelizSiteInstallStepBody: 'Open a folder of Markdown notes, or start a new vault, and write. Every feature is free.',
  },
]

// The Download page (Adam, 2026-10-31): every app in one panel in the top bar's blue, each row a link
// once its app's address is set, then how to install and where to get help.
export default function PapelizSiteDownloadPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
      <section aria-labelledby="papeliz-site-download-title" className="papeliz-site-selection-on-color rounded-3xl bg-papeliz-topbar p-5 text-white shadow-papeliz-card sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h1 id="papeliz-site-download-title" className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
            Download Papeliz
          </h1>
          <p className="text-[15px] text-white/90">Choose your platform to get started.</p>
        </div>

        <ul aria-label="Papeliz apps" className="grid gap-2.5 md:grid-cols-2">
          {papelizSiteDownloadTargets.map((papelizSiteDownloadTarget) => {
            const papelizSiteDownloadTargetContent = (
              <>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-papeliz-gradient-start">
                  <papelizSiteDownloadTarget.PapelizSiteDownloadTargetLogo className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight font-semibold">{papelizSiteDownloadTarget.papelizSiteDownloadTargetLabel}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-white/80">{papelizSiteDownloadTarget.papelizSiteDownloadTargetDetail}</span>
                </span>
                {papelizSiteDownloadTarget.papelizSiteDownloadTargetUrl && <ArrowRight className="size-4 shrink-0 text-white/90" aria-hidden="true" />}
              </>
            )
            const papelizSiteDownloadTargetClassName = 'flex min-h-16 items-center gap-3.5 rounded-2xl bg-white/10 px-4 py-3'
            return (
              <li
                key={papelizSiteDownloadTarget.papelizSiteDownloadTargetId}
                id={`papeliz-download-${papelizSiteDownloadTarget.papelizSiteDownloadTargetId}`}
                className="min-w-0 scroll-mt-31 md:scroll-mt-20"
              >
                {papelizSiteDownloadTarget.papelizSiteDownloadTargetUrl ? (
                  <a
                    href={papelizSiteDownloadTarget.papelizSiteDownloadTargetUrl}
                    className={`${papelizSiteDownloadTargetClassName} transition-colors hover:bg-white/15 focus-visible:outline-white`}
                  >
                    {papelizSiteDownloadTargetContent}
                  </a>
                ) : (
                  <div className={papelizSiteDownloadTargetClassName}>{papelizSiteDownloadTargetContent}</div>
                )}
              </li>
            )
          })}
        </ul>

        {papelizSiteAppUrl && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5">
            <p className="text-[15px] text-white/90">Prefer your browser? Papeliz runs on the web too.</p>
            <a
              href={papelizSiteAppUrl}
              className="papeliz-site-selection-on-surface inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-papeliz-gradient-start transition-colors hover:bg-white/90 focus-visible:outline-white"
            >
              <Rocket className="size-4 shrink-0" aria-hidden="true" />
              Use App
            </a>
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="papeliz-site-install-title" className="rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-5 sm:p-6">
          <h2 id="papeliz-site-install-title" className="text-2xl font-semibold tracking-tight">
            How to install Papeliz
          </h2>
          <ol className="mt-5 overflow-hidden rounded-2xl border border-papeliz-line bg-papeliz-surface">
            {papelizSiteInstallSteps.map((papelizSiteInstallStep, papelizSiteInstallStepIndex) => (
              <li
                key={papelizSiteInstallStep.papelizSiteInstallStepTitle}
                className="flex items-start gap-3.5 border-t border-papeliz-line px-4 py-3.5 first:border-t-0"
              >
                <span
                  aria-hidden="true"
                  className="mt-px inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-papeliz-blue text-[13px] font-semibold text-papeliz-on-blue"
                >
                  {papelizSiteInstallStepIndex + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{papelizSiteInstallStep.papelizSiteInstallStepTitle}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-papeliz-ink-muted">{papelizSiteInstallStep.papelizSiteInstallStepBody}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <aside aria-labelledby="papeliz-site-download-help-title" className="flex rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-5 sm:p-6">
          <div className="flex w-full flex-col items-center justify-center text-center">
            <h2 id="papeliz-site-download-help-title" className="text-2xl font-semibold tracking-tight">
              Need help?
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-papeliz-ink-muted sm:text-base">Read the guides, or ask the community.</p>
            <div className="mt-5 grid w-full max-w-xs gap-2">
              {papelizSiteHelpUrl && (
                <a
                  href={papelizSiteHelpUrl}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-papeliz-blue px-4 text-sm font-semibold text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Help guides
                </a>
              )}
              <Link
                href="/community/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-papeliz-blue bg-papeliz-surface px-4 text-sm font-semibold text-papeliz-blue transition-colors hover:bg-papeliz-blue-soft"
              >
                <UsersRound className="size-4" aria-hidden="true" />
                Community
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
