import Link from 'next/link'
import { PapelizSitePageIntro } from '@/components/marketing/papeliz-site-page-intro'
import { papelizSiteCopyrightHolder, papelizSiteGitHubRepositoryUrl } from '@/lib/papeliz-site-config'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'About',
  papelizSitePageDescription: 'Why Papeliz exists: plain Markdown files you own, an assistant that edits, and your own key with no server in between.',
  papelizSitePagePath: '/about/',
})

const papelizSiteAboutPrinciples = [
  {
    papelizSiteAboutPrincipleTitle: 'Your files',
    papelizSiteAboutPrincipleBody:
      'Notes are plain Markdown in a folder you own. No special format and no lock-in: a folder from another Markdown app opens in Papeliz as it is, and keeps working in that app.',
  },
  {
    papelizSiteAboutPrincipleTitle: 'Your key, your provider',
    papelizSiteAboutPrincipleBody:
      'The assistant talks straight from your device to the provider you choose. There is no Papeliz server in between, so Papeliz never sees your key or your notes.',
  },
  {
    papelizSiteAboutPrincipleTitle: 'The AI proposes, you decide',
    papelizSiteAboutPrincipleBody: 'Every change the assistant wants to make arrives as a diff you accept or reject. It never writes silently.',
  },
  {
    papelizSiteAboutPrincipleTitle: 'An editor first',
    papelizSiteAboutPrincipleBody:
      'The assistant rewrites a selection, proposes changes, and suggests links and tags across notes. Papeliz is an editor with an assistant, not a chatbot that answers questions about your documents.',
  },
  {
    papelizSiteAboutPrincipleTitle: 'Use it anywhere',
    papelizSiteAboutPrincipleBody: 'Papeliz runs on the web, Windows, macOS, Linux, Android, iOS and HarmonyOS. Open a folder of notes and start writing.',
  },
  {
    papelizSiteAboutPrincipleTitle: 'Open source',
    papelizSiteAboutPrincipleBody: 'The whole app is released under the MIT License, so anyone can read it, change it and share it.',
  },
]

export default function PapelizSiteAboutPage() {
  return (
    <>
      <PapelizSitePageIntro papelizSitePageHeading="A quiet place to write, and an assistant that respects it">
        <p>
          Papeliz is a Markdown editor and AI-powered note-taking app for building your personal knowledge
          base. It works on a folder of notes you already own, with a built-in AI assistant.
        </p>
      </PapelizSitePageIntro>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">What we believe</h2>
        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {papelizSiteAboutPrinciples.map((papelizSiteAboutPrinciple) => (
            <div key={papelizSiteAboutPrinciple.papelizSiteAboutPrincipleTitle} className="border-t border-papeliz-line pt-5">
              <h3 className="font-semibold">{papelizSiteAboutPrinciple.papelizSiteAboutPrincipleTitle}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteAboutPrinciple.papelizSiteAboutPrincipleBody}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-papeliz-surface-soft">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Who makes it</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-papeliz-ink-muted">
              Papeliz is made by {papelizSiteCopyrightHolder}, which holds its copyright and releases it
              under the <Link href="/license/" className="font-medium text-papeliz-blue hover:underline">MIT License</Link>.
              It is free, with no accounts and no paid features.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Where it is going</h2>
            <p className="mt-3 text-[17px] leading-relaxed text-papeliz-ink-muted">
              Papeliz is in development. The <Link href="/roadmap/" className="font-medium text-papeliz-blue hover:underline">roadmap</Link> lists
              what the launch build includes and what comes after.{' '}
              {papelizSiteGitHubRepositoryUrl ? (
                <>
                  The source is on <a href={papelizSiteGitHubRepositoryUrl} className="font-medium text-papeliz-blue hover:underline">GitHub</a>.
                </>
              ) : (
                'The source will be public on GitHub at launch.'
              )}
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
