import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Privacy Policy',
  papelizSitePageDescription: 'How Papeliz handles your notes, your API key and the vaults you sync with Papeliz Sync.',
  papelizSitePagePath: '/privacy/',
})

export default function PapelizSitePrivacyPage() {
  return (
    <PapelizLegalDocument
      papelizLegalDocumentPath="/privacy/"
      papelizLegalDocumentTitle="Privacy Policy"
      papelizLegalDocumentSummary="Papeliz is a static web app with no server of its own. It never sees your key, and could read your notes only if you sync them with Papeliz Sync, the optional add-on, as a Standard vault. This page explains where your data goes. It is a draft and will be finalized before launch."
    >
      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your notes">
        <p>
          Your notes stay in the folder you open, on your own disk. Papeliz reads and writes that folder
          in your browser. Nothing is uploaded to Papeliz unless you sync that vault with Papeliz Sync.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Papeliz Sync">
        <p>
          Papeliz Sync, a paid add-on, keeps the vaults you choose the same on your devices. A synced
          vault is encrypted on your device before it is uploaded, and is one of two kinds, chosen when
          you turn Sync on for it. In a Standard vault, Papeliz keeps the vault’s key, so Papeliz could
          read it. An End-to-end vault has its own passphrase, which Papeliz never receives, so Papeliz
          can’t read it or recover the passphrase. Vault and device names are readable by Papeliz for
          both. Your AI provider keys never sync.
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

      <PapelizLegalDocumentSection papelizLegalSectionTitle="No account needed, no tracking">
        <p>
          Papeliz needs no account: you sign in only to use Papeliz Sync. There are no analytics on your
          notes. The website and the app are served as
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
