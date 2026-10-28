import Link from 'next/link'
import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { papelizSiteCopyrightHolder } from '@/lib/papeliz-site-config'
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
    </PapelizLegalDocument>
  )
}
