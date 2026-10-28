import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Privacy',
  papelizSitePageDescription: 'How Papeliz handles your notes and your API key: it has no server, so it never sees either.',
  papelizSitePagePath: '/privacy/',
})

export default function PapelizSitePrivacyPage() {
  return (
    <PapelizLegalDocument
      papelizLegalDocumentHeading="Papeliz never sees your notes or your key"
      papelizLegalDocumentLead={
        <p>
          Papeliz is a static web app with no server of its own. This page explains where your data
          goes. It is a draft and will be finalized before launch.
        </p>
      }
    >
      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your notes">
        <p>
          Your notes stay in the folder you open, on your own disk. Papeliz reads and writes that folder
          in your browser. Nothing is uploaded to Papeliz, because there is nowhere to upload it to.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your API key">
        <p>
          You bring your own key for the AI provider you choose. It is stored only in your browser and
          is sent only to that provider, with your requests.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="What the assistant sends">
        <p>
          When you message the assistant, the text you send and the notes you choose to share go from
          your browser straight to your provider. Each message shows which notes are included. The
          provider’s own privacy policy applies to that data.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="No accounts, no tracking">
        <p>
          Papeliz has no accounts and no analytics on your notes. The website and the app are served as
          static files; the hosting provider keeps standard request logs.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Settings in your browser">
        <p>
          Papeliz keeps its settings, search index and the list of folders you opened in your browser’s
          storage. Clearing your browser data removes them; your notes on disk are not affected.
        </p>
      </PapelizLegalDocumentSection>
    </PapelizLegalDocument>
  )
}
