import { BookOpen, Download, Rocket, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { papelizSiteAppUrl, papelizSiteHelpUrl } from '@/lib/papeliz-site-config'
import {
  papelizSiteDownloadReleaseName,
  papelizSiteDownloadReleasePageUrl,
  papelizSiteDownloadTargets,
  type PapelizSiteDownloadTarget,
  type PapelizSiteDownloadTargetFile,
} from '@/lib/papeliz-site-downloads'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Download',
  papelizSitePageDescription:
    'Download Papeliz 1.0.0 Preview 1 for Windows and Android, or use it on the web. macOS, Linux, iPhone and iPad, and HarmonyOS are coming soon. Free and open source.',
  papelizSitePagePath: '/download/',
})

const papelizSiteInstallSteps = [
  { papelizSiteInstallStepTitle: 'Choose your platform', papelizSiteInstallStepBody: 'Pick your device above, or use Papeliz on the web.' },
  { papelizSiteInstallStepTitle: 'Install Papeliz', papelizSiteInstallStepBody: 'Install it the way your device usually installs apps.' },
  {
    papelizSiteInstallStepTitle: 'Open your notes',
    papelizSiteInstallStepBody: 'Open a folder of Markdown notes, start a new vault or a template, and write. Every feature of the app is free.',
  },
]

// The apps with a build, as white buttons that download their file; the rest, muted, under Coming soon.
const papelizSiteReadyDownloadTargets = papelizSiteDownloadTargets.filter(
  (papelizSiteDownloadTarget): papelizSiteDownloadTarget is PapelizSiteDownloadTarget & { papelizSiteDownloadTargetFile: PapelizSiteDownloadTargetFile } =>
    papelizSiteDownloadTarget.papelizSiteDownloadTargetFile !== null,
)
const papelizSiteComingSoonDownloadTargets = papelizSiteDownloadTargets.filter((papelizSiteDownloadTarget) => papelizSiteDownloadTarget.papelizSiteDownloadTargetFile === null)

// The Download page: one panel in the top bar's blue. The apps with a build are white buttons that
// download their file from the GitHub release, with a quiet line for the release page and the unsigned
// installer; the apps to come sit below, muted and not links. Then how to install and where to get help.
export default function PapelizSiteDownloadPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
      <section aria-labelledby="papeliz-site-download-title" className="papeliz-site-selection-on-color rounded-3xl bg-papeliz-topbar p-5 text-white shadow-papeliz-card sm:p-8">
        <h1 id="papeliz-site-download-title" className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
          Download Papeliz
        </h1>
        <p className="mt-1.5 text-[15px] text-white/90">{papelizSiteDownloadReleaseName} · Free and open source</p>

        <ul aria-label="Downloads" className="mt-6 grid gap-3 sm:grid-cols-2">
          {papelizSiteReadyDownloadTargets.map((papelizSiteDownloadTarget) => (
            <li
              key={papelizSiteDownloadTarget.papelizSiteDownloadTargetId}
              id={`papeliz-download-${papelizSiteDownloadTarget.papelizSiteDownloadTargetId}`}
              className="min-w-0 scroll-mt-31 md:scroll-mt-20"
            >
              <a
                href={papelizSiteDownloadTarget.papelizSiteDownloadTargetFile.papelizSiteDownloadTargetFileUrl}
                className="papeliz-site-selection-on-surface flex min-h-[72px] items-center gap-3.5 rounded-[18px] bg-papeliz-surface py-3 pr-3.5 pl-3 text-papeliz-ink shadow-papeliz-pop transition-transform hover:-translate-y-px focus-visible:outline-white sm:min-h-20 sm:pr-4 sm:pl-3.5"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-papeliz-blue text-papeliz-on-blue">
                  <papelizSiteDownloadTarget.PapelizSiteDownloadTargetLogo className="size-6" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] leading-tight font-bold sm:text-lg">Download for {papelizSiteDownloadTarget.papelizSiteDownloadTargetLabel}</span>
                  <span className="mt-1 block text-[13.5px] leading-snug text-papeliz-ink-muted">
                    {papelizSiteDownloadTarget.papelizSiteDownloadTargetDetail} · {papelizSiteDownloadTarget.papelizSiteDownloadTargetFile.papelizSiteDownloadTargetFileDescription}
                  </span>
                </span>
                <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue sm:grid">
                  <Download className="size-[18px]" aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mx-0.5 mt-3.5 text-[13.5px] leading-normal text-white/90">
          Every file and the SHA-256 checksums are on the{' '}
          <a href={papelizSiteDownloadReleasePageUrl} className="font-semibold text-white underline underline-offset-[3px] focus-visible:outline-white">
            release page
          </a>
          . The Windows installer isn’t code-signed yet, so if Windows shows “Windows protected your PC”, choose More info, then Run anyway.
        </p>

        <div className="mt-6 border-t border-white/15 pt-5">
          <h2 className="mb-2.5 text-xs font-bold tracking-[0.06em] text-white/80 uppercase">Coming soon</h2>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {papelizSiteComingSoonDownloadTargets.map((papelizSiteDownloadTarget) => (
              <li
                key={papelizSiteDownloadTarget.papelizSiteDownloadTargetId}
                id={`papeliz-download-${papelizSiteDownloadTarget.papelizSiteDownloadTargetId}`}
                className="flex min-w-0 scroll-mt-31 items-center gap-2.5 rounded-[14px] border border-dashed border-white/30 px-3 py-2.5 text-white/65 md:scroll-mt-20"
              >
                <papelizSiteDownloadTarget.PapelizSiteDownloadTargetLogo className="size-[18px] shrink-0 opacity-80" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-semibold">{papelizSiteDownloadTarget.papelizSiteDownloadTargetLabel}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-white/55">{papelizSiteDownloadTarget.papelizSiteDownloadTargetDetail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {papelizSiteAppUrl && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5">
            <p className="text-[15px] text-white/90">Prefer your browser? Papeliz runs on the web too.</p>
            <a
              href={papelizSiteAppUrl}
              className="papeliz-site-selection-on-surface inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-papeliz-gradient-start transition-colors hover:bg-white/90 focus-visible:outline-white"
            >
              <Rocket className="size-4 shrink-0" aria-hidden="true" />
              Launch WebApp
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
