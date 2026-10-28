import Link from 'next/link'
import { PapelizMark } from '@/components/logo/papeliz-mark'
import { PapelizSiteAccessibilityMenuButton } from '@/components/theme/papeliz-site-accessibility-menu-button'
import { PapelizSiteGitHubIconButton } from './papeliz-site-github-icon-button'
import { PapelizSiteHeaderCommunityLink } from './papeliz-site-header-community-link'
import { PapelizSiteHeaderNavigation } from './papeliz-site-header-navigation'
import { PapelizSiteHeaderPhoneRow } from './papeliz-site-header-phone-row'
import { PapelizSiteUseAppMenu } from './papeliz-site-use-app-menu'

// The app's blue top bar: the white mark, the page links, then at the right GitHub, the
// Accessibility menu, Community and Use App. The bar is the underline's frame (see the navigation).
// Phones move the page links and Community to a row under the bar. The bar needs 366 px, so
// narrower phones leave GitHub out, and below 360 px its side padding is 12 px instead of 16.
export function PapelizSiteHeader() {
  return (
    <header className="papeliz-site-selection-on-color sticky top-0 z-40 bg-papeliz-topbar text-white">
      <div data-papeliz-site-header-bar className="relative mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 max-[359px]:px-3 sm:px-6 lg:gap-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-full text-[17px] font-semibold tracking-[-0.01em] focus-visible:outline-white">
          <PapelizMark size={28} papelizMarkTone="on-blue" />
          Papeliz
        </Link>
        <PapelizSiteHeaderNavigation />
        <div className="ml-auto flex items-center gap-2">
          <PapelizSiteGitHubIconButton />
          <PapelizSiteAccessibilityMenuButton />
          <PapelizSiteHeaderCommunityLink />
          <PapelizSiteUseAppMenu />
        </div>
      </div>
      <PapelizSiteHeaderPhoneRow />
    </header>
  )
}
