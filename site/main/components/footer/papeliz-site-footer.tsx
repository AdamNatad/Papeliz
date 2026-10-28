'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { FaDiscord, FaGithub } from 'react-icons/fa'
import { PapelizMark } from '@/components/logo/papeliz-mark'
import { papelizSiteCopyrightHolder, papelizSiteCopyrightYear } from '@/lib/papeliz-site-config'
import { papelizSiteFooterLinks, papelizSiteFooterSocialLinks, type PapelizSiteFooterSocialLink } from '@/lib/papeliz-site-navigation'

const papelizSiteFooterSocialIcons: Record<PapelizSiteFooterSocialLink['papelizSiteFooterSocialChannel'], ComponentType<{ className?: string }>> = {
  github: FaGithub,
  discord: FaDiscord,
}

// "/about/" and "/about" are the same page.
function normalizePapelizSiteFooterPath(papelizSiteFooterPath: string) {
  return papelizSiteFooterPath !== '/' ? papelizSiteFooterPath.replace(/\/+$/, '') : '/'
}

// The footer, laid out as on Adam's other site and in Papeliz blue (Adam, 2026-10-28): on the left the mark, the
// description and the community buttons; on the right "Made with ❤️" over every page's link and the copyright. Text
// stays at 90% white or more, so it keeps WCAG AA on the light theme's blue.
export function PapelizSiteFooter() {
  const papelizSiteCurrentPath = normalizePapelizSiteFooterPath(usePathname())

  return (
    <footer className="papeliz-site-selection-on-color bg-papeliz-topbar text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 max-[360px]:px-3">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <PapelizMark size={32} papelizMarkTone="on-blue" />
              <span className="text-2xl leading-none font-semibold tracking-[-0.01em]">Papeliz</span>
            </div>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-pretty text-white/90">
              A free and open-source Markdown editor and viewer with a built-in AI assistant.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {papelizSiteFooterSocialLinks.map((papelizSiteFooterSocialLink) => {
                const PapelizSiteFooterSocialIcon = papelizSiteFooterSocialIcons[papelizSiteFooterSocialLink.papelizSiteFooterSocialChannel]
                const papelizSiteFooterSocialButtonClassName = 'inline-flex size-10 items-center justify-center rounded-full bg-white/10'
                // Until the channel exists the button stays, but is not a link, and says so.
                if (!papelizSiteFooterSocialLink.papelizSiteFooterSocialUrl) {
                  const papelizSiteFooterSocialComingSoonLabel = `${papelizSiteFooterSocialLink.papelizSiteFooterSocialLabel}: coming soon`
                  return (
                    <span
                      key={papelizSiteFooterSocialLink.papelizSiteFooterSocialChannel}
                      role="img"
                      aria-label={papelizSiteFooterSocialComingSoonLabel}
                      title={papelizSiteFooterSocialComingSoonLabel}
                      className={papelizSiteFooterSocialButtonClassName}
                    >
                      <PapelizSiteFooterSocialIcon className="size-5" />
                    </span>
                  )
                }
                return (
                  <a
                    key={papelizSiteFooterSocialLink.papelizSiteFooterSocialChannel}
                    href={papelizSiteFooterSocialLink.papelizSiteFooterSocialUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={papelizSiteFooterSocialLink.papelizSiteFooterSocialLabel}
                    title={papelizSiteFooterSocialLink.papelizSiteFooterSocialLabel}
                    className={`${papelizSiteFooterSocialButtonClassName} transition-colors hover:bg-white/15 focus-visible:outline-white`}
                  >
                    <PapelizSiteFooterSocialIcon className="size-5" />
                  </a>
                )
              })}
            </div>

            <p className="mt-4 text-xs text-white/90">Follow and join the community.</p>
          </div>

          <div className="min-w-0 md:justify-self-end">
            <h2 className="text-sm font-semibold text-white">Made with ❤️</h2>

            <nav aria-label="Footer" className="mt-4 grid grid-cols-2 gap-3 max-[280px]:grid-cols-1">
              {papelizSiteFooterLinks.map((papelizSiteFooterLink) => {
                const papelizSiteFooterLinkIsCurrent =
                  !papelizSiteFooterLink.papelizSiteNavigationIsExternal &&
                  normalizePapelizSiteFooterPath(papelizSiteFooterLink.papelizSiteNavigationHref) === papelizSiteCurrentPath
                const papelizSiteFooterLinkClassName = `group relative inline-flex w-fit max-w-full min-w-0 text-sm font-medium transition-colors duration-200 focus-visible:outline-white ${
                  papelizSiteFooterLinkIsCurrent ? 'text-white' : 'text-white/90 hover:text-white'
                }`
                // The underline slides in from the left on hover, and stays under the current page.
                const papelizSiteFooterLinkContent = (
                  <>
                    <span className="min-w-0 truncate">{papelizSiteFooterLink.papelizSiteNavigationLabel}</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute -bottom-1 left-0 h-0.75 w-full origin-left rounded-full bg-white transition-transform duration-300 ease-out ${
                        papelizSiteFooterLinkIsCurrent ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </>
                )
                return papelizSiteFooterLink.papelizSiteNavigationIsExternal ? (
                  <a
                    key={papelizSiteFooterLink.papelizSiteNavigationHref}
                    href={papelizSiteFooterLink.papelizSiteNavigationHref}
                    className={papelizSiteFooterLinkClassName}
                  >
                    {papelizSiteFooterLinkContent}
                  </a>
                ) : (
                  <Link
                    key={papelizSiteFooterLink.papelizSiteNavigationHref}
                    href={papelizSiteFooterLink.papelizSiteNavigationHref}
                    aria-current={papelizSiteFooterLinkIsCurrent ? 'page' : undefined}
                    className={papelizSiteFooterLinkClassName}
                  >
                    {papelizSiteFooterLinkContent}
                  </Link>
                )
              })}
            </nav>

            <p className="mt-6 text-xs text-white/90">
              © {papelizSiteCopyrightYear} {papelizSiteCopyrightHolder}. Released under the MIT License.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
