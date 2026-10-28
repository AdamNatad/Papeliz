'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { papelizSiteHeaderCommunityLink } from '@/lib/papeliz-site-navigation'
import { createPapelizSiteHeaderLinkClassName } from './papeliz-site-header-navigation'

// "Community" at the header's right, looking like the page links. On /community/ it turns white and
// the page links' underline moves under it. Phones leave it to the footer: the header has no room.
export function PapelizSiteHeaderCommunityLink() {
  const papelizSiteHeaderCommunityLinkIsCurrent = usePathname() === papelizSiteHeaderCommunityLink.papelizSiteNavigationHref
  return (
    <Link
      href={papelizSiteHeaderCommunityLink.papelizSiteNavigationHref}
      aria-current={papelizSiteHeaderCommunityLinkIsCurrent ? 'page' : undefined}
      className={`hidden md:block ${createPapelizSiteHeaderLinkClassName(papelizSiteHeaderCommunityLinkIsCurrent)}`}
    >
      <span data-papeliz-site-header-link-label>{papelizSiteHeaderCommunityLink.papelizSiteNavigationLabel}</span>
    </Link>
  )
}
