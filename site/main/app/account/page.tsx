import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import { PapelizAccountPageLoader } from './papeliz-account-page-loader'
import papelizAccountStyles from './papeliz-account.module.css'

export const metadata = {
  ...createPapelizSitePageMetadata({
    papelizSitePageTitle: 'Account',
    papelizSitePageDescription: 'Sign in to Papeliz to keep your notes in sync on all your devices.',
    papelizSitePagePath: '/account/',
  }),
  robots: { index: false, follow: false },
}

// papeliz.com/account: Papeliz's own sign-in page and, once signed in, the account's page. It is
// the only page that loads Clerk's code, bundled into the site, and only in the browser: the
// exported HTML holds no Clerk code at all.
export default function PapelizAccountPage() {
  return (
    <div data-papeliz-account-page="" className={papelizAccountStyles.papelizAccountPage}>
      <PapelizAccountPageLoader />
    </div>
  )
}
