import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { PapelizSiteDiscordMark, PapelizSiteGitHubMark } from '@/components/logo/papeliz-site-channel-marks'
import { PapelizSiteComingSoonPill } from '@/components/marketing/papeliz-site-coming-soon-pill'
import {
  papelizSiteCommunityChannels,
  papelizSiteCommunityHeading,
  papelizSiteCommunityLead,
} from '@/lib/papeliz-site-community'
import { papelizSiteDiscordUrl, papelizSiteGitHubRepositoryUrl } from '@/lib/papeliz-site-config'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Community',
  papelizSitePageDescription: 'Where to ask about Papeliz, share how you use it, report a bug, or help build it: Discord and GitHub.',
  papelizSitePagePath: '/community/',
})

type PapelizSiteCommunityButtonProps = {
  papelizSiteCommunityButtonUrl: string | null
  papelizSiteCommunityButtonClassName: string
  children: ReactNode
}

// A pill button. Until its address exists it keeps its look, is not a link, and says "Coming soon".
function PapelizSiteCommunityButton({ papelizSiteCommunityButtonUrl, papelizSiteCommunityButtonClassName, children }: PapelizSiteCommunityButtonProps) {
  const papelizSiteCommunityButtonBaseClassName = 'inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold whitespace-nowrap'
  if (!papelizSiteCommunityButtonUrl) {
    return (
      <span aria-disabled="true" className={`${papelizSiteCommunityButtonBaseClassName} ${papelizSiteCommunityButtonClassName}`}>
        {children}
        <PapelizSiteComingSoonPill />
      </span>
    )
  }
  return (
    <a
      href={papelizSiteCommunityButtonUrl}
      className={`${papelizSiteCommunityButtonBaseClassName} transition-colors ${papelizSiteCommunityButtonClassName}`}
    >
      {children}
    </a>
  )
}

export default function PapelizSiteCommunityPage() {
  return (
    <>
      <section className="text-center">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-22 sm:pb-16">
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.15] font-normal tracking-tight text-balance sm:text-5xl">{papelizSiteCommunityHeading}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-papeliz-ink-muted">{papelizSiteCommunityLead}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <PapelizSiteCommunityButton
              papelizSiteCommunityButtonUrl={papelizSiteDiscordUrl}
              papelizSiteCommunityButtonClassName={`bg-papeliz-blue text-papeliz-on-blue ${papelizSiteDiscordUrl ? 'hover:bg-papeliz-blue-hover' : ''}`}
            >
              <PapelizSiteDiscordMark className="size-[18px] shrink-0" />
              Join the Discord
            </PapelizSiteCommunityButton>
            <PapelizSiteCommunityButton
              papelizSiteCommunityButtonUrl={papelizSiteGitHubRepositoryUrl}
              papelizSiteCommunityButtonClassName={`bg-papeliz-surface-gray text-papeliz-ink ${papelizSiteGitHubRepositoryUrl ? 'hover:bg-papeliz-surface-gray-hover' : ''}`}
            >
              <PapelizSiteGitHubMark className="size-[18px] shrink-0" />
              Papeliz on GitHub
            </PapelizSiteCommunityButton>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto grid max-w-[1000px] pb-16 md:grid-cols-2 md:gap-x-18 md:pb-18">
          {papelizSiteCommunityChannels.map((papelizSiteCommunityChannel) => (
            <article key={papelizSiteCommunityChannel.papelizSiteCommunityChannelTitle} className="border-t border-papeliz-line pt-8 pb-9">
              <h2 className="text-2xl font-semibold tracking-[-0.015em]">{papelizSiteCommunityChannel.papelizSiteCommunityChannelTitle}</h2>
              <p className="mt-2.5 text-[17px] leading-relaxed text-papeliz-ink-muted">{papelizSiteCommunityChannel.papelizSiteCommunityChannelBody}</p>
              {papelizSiteCommunityChannel.papelizSiteCommunityChannelUrl ? (
                <a
                  href={papelizSiteCommunityChannel.papelizSiteCommunityChannelUrl}
                  className="mt-3.5 inline-flex items-center gap-1.5 font-semibold text-papeliz-blue underline-offset-4 hover:underline"
                >
                  {papelizSiteCommunityChannel.papelizSiteCommunityChannelActionLabel}
                  <ArrowRight className="size-[17px] shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-3.5 flex flex-wrap items-center gap-2 font-semibold text-papeliz-ink-muted">
                  {papelizSiteCommunityChannel.papelizSiteCommunityChannelActionLabel}
                  <PapelizSiteComingSoonPill />
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
