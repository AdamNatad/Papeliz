import Link from 'next/link'
import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { isPapelizLegalSyncDraftShown, PapelizLegalSyncDraftNotice } from '@/components/legal/papeliz-legal-sync-draft'
import { papelizSiteCopyrightHolder } from '@/lib/papeliz-site-config'
import { papelizSiteSyncEducationAndNonProfitDiscountPercent, papelizSiteSyncRefundWindowDayCount } from '@/lib/papeliz-site-sync-plans'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Terms of Service',
  papelizSitePageDescription: 'The terms for using the Papeliz website and app: free, open source, provided as is, with your own AI provider.',
  papelizSitePagePath: '/terms/',
})

export default function PapelizSiteTermsPage() {
  return (
    <PapelizLegalDocument
      papelizLegalDocumentPath="/terms/"
      papelizLegalDocumentTitle="Terms of Service"
      papelizLegalDocumentSummary="The terms for using the Papeliz website and the Papeliz web app, in plain language. This is a draft and will be finalized before launch."
    >
      <PapelizLegalDocumentSection papelizLegalSectionTitle="Free and open source">
        <p>
          Papeliz is free to use. Its source code is released by {papelizSiteCopyrightHolder} under
          the <Link href="/license/" className="font-medium text-papeliz-blue hover:underline">MIT License</Link>,
          which governs how you may use, copy, change and share the code.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your notes are yours">
        <p>
          You own what you write. Papeliz works on files in a folder you choose, inside your browser,
          and does not receive a copy of them. Keep your own backups: Papeliz writes to your files as
          you edit, and a mistake, a browser problem or a bug could change or lose content.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your AI provider">
        <p>
          The assistant uses an AI provider you pick, with an API key you supply. Your use of that
          provider is between you and the provider: its terms, prices and privacy policy apply, and
          any charges for your requests are yours.
        </p>
        <p>
          AI output can be wrong. Papeliz shows every proposed change as a diff so you can check it
          before it is saved; you are responsible for what you accept.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Using the website fairly">
        <p>
          Do not use the website or the app to break the law, to harm others, or to disrupt the
          service or the people who use it.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="No warranty">
        <p>
          Papeliz is provided “as is”, without warranty of any kind. To the extent the law allows,{' '}
          {papelizSiteCopyrightHolder} is not liable for any loss or damage that comes from using the
          website or the app.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Changes">
        <p>
          These terms may change as Papeliz grows. The current version is always on this page, and
          the <Link href="/changelog/" className="font-medium text-papeliz-blue hover:underline">changelog</Link> will
          note any change that matters.
        </p>
      </PapelizLegalDocumentSection>

      {isPapelizLegalSyncDraftShown && (
        <>
          <PapelizLegalSyncDraftNotice>
            The sections below cover Papeliz Sync, its account and its payments. They show only on the dev
            server until their words are approved; the published page leaves them out.
          </PapelizLegalSyncDraftNotice>

          <PapelizLegalDocumentSection papelizLegalSectionTitle="Papeliz Sync">
            <p>
              Papeliz Sync is an optional paid add-on that keeps the vaults you choose the same on your
              devices. It needs a Papeliz account, made on papeliz.com/account. Each plan’s limits are on
              the <Link href="/sync/" className="font-medium text-papeliz-blue hover:underline">Sync page</Link>,
              and fair-use limits on daily transfers keep the service working for everyone. Papeliz may pause
              uploads for an account that tries to get around the limits or harms the service; downloads go on.
            </p>
            <p>
              We work to keep Sync available, but it can be slow or down at times. Keep your own backups:
              the notes on your devices stay the main copy.
            </p>
          </PapelizLegalDocumentSection>

          <PapelizLegalDocumentSection papelizLegalSectionTitle="Buying a subscription">
            <p>
              Subscriptions are sold by our payment provider, the merchant of record. Its terms apply to the
              purchase, and it charges any sales tax or VAT where you live. Prices are in US dollars. A
              subscription renews each month or each year, as you chose, until you cancel it.
            </p>
            <p>
              You can cancel at any time from Billing on your account page. Sync then stays on until the end
              of the period you paid for. There is no free trial; instead, you get a full refund if you ask
              within {papelizSiteSyncRefundWindowDayCount} days of subscribing. Education and non-profit
              customers can get {papelizSiteSyncEducationAndNonProfitDiscountPercent}% off as a code, after a
              short check.
            </p>
            <p>
              If a payment fails, Sync goes on while the payment provider tries again. If it can’t collect
              the payment, the subscription ends.
            </p>
          </PapelizLegalDocumentSection>

          <PapelizLegalDocumentSection papelizLegalSectionTitle="When a subscription ends">
            <p>
              Uploads stop. Your synced copy stays readable for 30 days, so any device can still download it,
              then it is kept for 60 more days and deleted. The notes on your devices are never touched.
              Subscribing again before it is deleted picks up where you left off.
            </p>
          </PapelizLegalDocumentSection>

          <PapelizLegalDocumentSection papelizLegalSectionTitle="Your account and your passphrases">
            <p>
              Keep your sign-in safe; what happens through it is your responsibility. An End-to-end vault’s
              passphrase never reaches Papeliz, so Papeliz can’t recover it: if every device forgets it and you
              lose it, that vault’s synced copy can’t be opened.
            </p>
            <p>
              You can delete your account at any time on papeliz.com/account. That cancels your subscription
              at once and deletes every synced copy; the notes on your devices stay.
            </p>
          </PapelizLegalDocumentSection>

          <PapelizLegalDocumentSection papelizLegalSectionTitle="Changes to plans and prices">
            <p>
              A change to a plan’s price or limits that affects a running subscription is announced before it
              applies, and takes effect at your next renewal. You can cancel before then.
            </p>
          </PapelizLegalDocumentSection>
        </>
      )}
    </PapelizLegalDocument>
  )
}
