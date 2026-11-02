import Link from 'next/link'
import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { PapelizLegalWhenAccountsOpenBlock } from '@/components/legal/papeliz-legal-sync-draft'
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
      papelizLegalDocumentSummary="Papeliz is a static web app. It never sees your key, and could read your notes only if you sync them with Papeliz Sync, the optional add-on, as a Standard vault. This page explains where your data goes. It is a draft and will be finalized before launch."
    >
      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your notes">
        <p>
          Your notes stay on your device: in the folder you open on your own disk, or in your browser’s
          own storage for a vault kept in the browser. Papeliz reads and writes them in your browser.
          Nothing is uploaded to Papeliz unless you sync that vault with Papeliz Sync.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Pictures and video in your notes">
        <p>
          Pictures and videos stored in your vault are read from it in your browser, and showing them sends
          them nowhere. A picture or video with a web address loads from that address when the note shows
          it. That site sees the request, as any website does, but never which note it is in.
        </p>
        <p>
          A YouTube video in a note shows as a poster drawn by Papeliz, so nothing is sent to YouTube while
          you read. When you press play, the video loads from YouTube’s privacy-enhanced player
          (youtube-nocookie.com), and from then on YouTube sees your visit, as it would on its own site. It
          is told that the video is playing on papeliz.com, never which note it is in.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Templates">
        <p>
          Papeliz contacts other services for templates only when you open Templates. The list of templates
          is built into Papeliz. A template’s files come from jsDelivr, or from GitHub when jsDelivr can’t be
          reached, and its pictures and its author’s picture from jsDelivr or GitHub. Check, in Submit
          Template, asks GitHub and jsDelivr about the repository you paste. These services see the request,
          as any website does, but never your notes or your key.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Papeliz Sync">
        <p>
          Papeliz Sync, an optional add-on, keeps the vaults you choose the same on your devices. A synced
          vault is encrypted on your device before it is uploaded, and is one of two kinds, chosen when
          you turn Sync on for it. In a Standard vault, Papeliz keeps the vault’s key, so Papeliz could
          read it. An End-to-end vault has its own passphrase, which Papeliz never receives, so Papeliz
          can’t read it or recover the passphrase. Vault and device names are readable by Papeliz for
          both. Your AI provider keys never sync.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Your API key">
        <p>
          You bring your own key for each AI provider you add. Each key is stored only in your browser
          and is sent only to its own provider, with your requests.
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
          storage. Clearing your browser data removes them, and erases any vault kept in the browser; your
          notes on disk are not affected.
        </p>
      </PapelizLegalDocumentSection>

      <PapelizLegalWhenAccountsOpenBlock papelizLegalWhenAccountsOpenNotice="Papeliz accounts and Papeliz Sync aren’t open yet. The sections below will apply once they open. Until then nothing here is collected: there is no sign-in, no payment and no synced copy.">
        <PapelizLegalDocumentSection papelizLegalSectionTitle="Your Papeliz account">
          <p>
            You need an account only for Papeliz Sync. You make one by signing in on papeliz.com/account,
            with an email code, Google or Apple. Our sign-in provider keeps your email address, your
            username, the Google or Apple account you connect, and your sign-in sessions, under its own
            privacy policy. Papeliz Sync’s servers keep only the sign-in provider’s ID for you, not your
            email address.
          </p>
          <p>
            The account page uses the sign-in provider’s session cookie on papeliz.com/account alone. No
            other page loads it, and nothing on it tracks you.
          </p>
        </PapelizLegalDocumentSection>

        <PapelizLegalDocumentSection papelizLegalSectionTitle="What Papeliz Sync keeps">
          <p>
            Papeliz Sync runs on servers Papeliz operates with its hosting provider. For your account, it
            keeps:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>your account ID, the storage place you chose, your plan, and your subscription’s state and dates;</li>
            <li>the payment provider’s IDs for you and your subscription, never your card;</li>
            <li>each device signed in to Sync: its kind, the name it gives itself, and when it was added and last synced;</li>
            <li>each synced vault: its name, its kind, its key wrapped so Papeliz can’t use it (End-to-end) or wrapped with Papeliz’s own key (Standard), and how many files and bytes it holds;</li>
            <li>your vaults’ files and their older versions, encrypted on your device before they are uploaded;</li>
            <li>counts of what you upload and download, to apply your plan’s limits.</li>
          </ul>
          <p>
            Its servers never log what a request carries: no note content, no encrypted file or name, and no
            key. Our hosting provider keeps standard request logs, such as the address a request came from
            and when.
          </p>
          <p>
            Your synced files are stored in the place you chose when you signed up: eastern or western North
            America, the EU, Asia-Pacific or Oceania. Your account’s details are kept in that same place. The
            small index that finds your account when you sign in holds only a keyed hash of your sign-in ID,
            your account ID and its place.
          </p>
          <p>
            Papeliz Sync also keeps encrypted backups of these details and of your files, which are already
            encrypted on your device, so they can be restored after a failure. These backups may be kept
            outside your region.
          </p>
        </PapelizLegalDocumentSection>

        <PapelizLegalDocumentSection papelizLegalSectionTitle="Papeliz’s Templates server">
          <p>
            More templates, submitting, votes, reports and Recheck come with Papeliz’s Templates server. Then
            Papeliz reads the list of templates from it, and Recheck and Submit Template ask GitHub for a
            template’s newest version. The Templates server keeps only the public list of template
            repositories, with their votes and reports, and knows who submitted, voted or reported only by a
            keyed hash of the account’s ID. It doesn’t log what a request carries or where it came from.
          </p>
        </PapelizLegalDocumentSection>

        <PapelizLegalDocumentSection papelizLegalSectionTitle="Payments">
          <p>
            Papeliz Sync is sold by our payment provider, the merchant of record: it sells the subscription in
            its own name, takes the payment and charges any sales tax or VAT. It collects your name, email
            address, billing country and payment details under its own privacy policy. Papeliz receives only
            what the subscription needs: its plan, its state, its dates, whether a discount applies, and the
            provider’s IDs for you and the subscription.
          </p>
        </PapelizLegalDocumentSection>

        <PapelizLegalDocumentSection papelizLegalSectionTitle="How long we keep it">
          <p>
            While your subscription runs, Papeliz Sync keeps your synced vaults and their history for your
            plan’s length. When a subscription ends, uploads stop, the synced copy stays readable for 30 days,
            is kept 60 more days, and is then deleted. The notes on your devices are never touched.
          </p>
          <p>
            Delete Account on papeliz.com/account deletes at once every synced copy and its history, your
            devices and your account with Papeliz Sync, cancels your subscription, then deletes your sign-in.
            When your account or a synced vault is deleted, the encrypted backup copies of its files are
            removed once their storage lock ends, within 30 days. When your account is deleted, its details
            also leave the encrypted database backups within 90 days. The payment provider keeps its records
            of your payments for as long as tax law requires.
          </p>
        </PapelizLegalDocumentSection>

        <PapelizLegalDocumentSection papelizLegalSectionTitle="Your choices">
          <p>
            You can see your devices, synced vaults and subscription on papeliz.com/account, remove a device,
            remove a vault from Sync, and delete your account. Your notes are always on your own devices, and
            any synced vault can be downloaded again while its copy is readable. For anything else about your
            data, <Link href="/community/" className="font-medium text-papeliz-blue hover:underline">contact us</Link>.
          </p>
        </PapelizLegalDocumentSection>
      </PapelizLegalWhenAccountsOpenBlock>
    </PapelizLegalDocument>
  )
}
