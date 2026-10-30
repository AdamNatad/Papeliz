import Link from 'next/link'
import { BookOpen, Check, FolderOpen, KeyRound, Lock, PenLine, Server, ShieldCheck } from 'lucide-react'
import { PapelizSiteAppButton } from '@/components/marketing/papeliz-site-app-button'
import { PapelizSiteHeroTypedWord } from '@/components/marketing/papeliz-site-hero-typed-word'
import { PapelizSiteIntroducingBadge } from '@/components/marketing/papeliz-site-introducing-badge'
import { PapelizSiteSection } from '@/components/marketing/papeliz-site-section'
import { PapelizWorkspacePreview } from '@/components/marketing/papeliz-workspace-preview'
import { papelizSiteAppUrl, papelizSiteGitHubRepositoryUrl } from '@/lib/papeliz-site-config'
import { createPapelizSiteSoftwareJsonLd, serializePapelizSiteJsonLd } from '@/lib/papeliz-site-jsonld'
import { papelizSiteOtherProviderNames } from '@/lib/papeliz-site-providers'

// The end of the title, "The AI Markdown Editor / for your …", types each of these in turn.
const papelizSiteHeroTypedWords = ['knowledge base.', 'notes.', 'ideas.', 'projects.'] as const

const papelizSiteFeatureCards = [
  {
    icon: FolderOpen,
    title: 'Your files stay yours',
    body: 'Notes are plain .md files in a folder on your disk. Existing Markdown folders open as they are.',
  },
  {
    icon: BookOpen,
    title: 'Two views, one switch',
    body: 'MD Code shows the raw Markdown with syntax colors and line numbers. MD View shows the rendered note.',
  },
  {
    icon: PenLine,
    title: 'An assistant that edits',
    body: 'Select text and ask for Shorter, Rewrite or Fix grammar. Every change arrives as a diff you accept or reject.',
  },
  {
    icon: KeyRound,
    title: 'Your key, your provider',
    body: 'The assistant talks straight from your device to the AI provider you pick. No account, no Papeliz server.',
  },
]

const papelizSiteAssistantSteps = [
  'Ask about a note, a selection or your whole vault, and get answers that cite your notes as links.',
  'Rewrite a paragraph in place: the change shows as a diff before anything is saved.',
  'Let it suggest links and tags across your notes, then review each change.',
  'Switch to focus mode for just your note and a floating prompt box.',
]


const papelizSitePrivacyPoints = [
  { icon: Server, title: 'No Papeliz server', body: 'Papeliz runs entirely on your device. No backend, no account, no analytics on your notes.' },
  { icon: FolderOpen, title: 'Notes stay on your disk', body: 'Papeliz reads and writes the folder you open, and never touches its hidden folders.' },
  { icon: Lock, title: 'You choose what is shared', body: 'Each message shows which notes go to your provider. Nothing is sent until you send it.' },
  { icon: ShieldCheck, title: 'Safe rendering', body: 'Notes are sanitized before display, so a note can never run code in the page that holds your key.' },
]

export default function PapelizSiteHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializePapelizSiteJsonLd({ '@context': 'https://schema.org', ...createPapelizSiteSoftwareJsonLd() }) }}
      />
      <section className="relative overflow-hidden">
        {/* The badge sits close under the header and over the title (Adam, 2026-10-28):
            62 px from the header on phones and 76 px from 640 px up, then 16 px to the title. */}
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-15.5 pb-20 text-center sm:px-6 sm:pt-19">
          <PapelizSiteIntroducingBadge className="mb-4">Introducing Papeliz</PapelizSiteIntroducingBadge>
          <h1
            aria-label={`The AI Markdown Editor for your ${papelizSiteHeroTypedWords[0]}`}
            className="max-w-4xl text-[clamp(1.625rem,8.2vw,1.875rem)] leading-[1.1] font-normal tracking-tight sm:text-5xl md:text-6xl"
          >
            {/* Sized so "for your" and the longest typed word share one line from a 320 px phone up. */}
            <span aria-hidden="true">
              The AI Markdown Editor
              <br />
              <span className="whitespace-nowrap text-papeliz-blue">
                for your <PapelizSiteHeroTypedWord papelizSiteHeroTypedWords={papelizSiteHeroTypedWords} />
              </span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-papeliz-ink-muted">
            Create, edit, organize and connect your notes and ideas in plain Markdown, with a built-in AI
            assistant that runs on your own API key. Available on the web, Windows, macOS, Linux, Android,
            iOS and HarmonyOS.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/features/"
              className="inline-flex h-12 items-center rounded-full bg-papeliz-hover px-6 text-[15px] font-medium transition-colors hover:bg-papeliz-press"
            >
              See how it works
            </Link>
            <PapelizSiteAppButton />
          </div>
          <p className="mt-4 text-sm text-papeliz-ink-subtle">In development · free and open source</p>
          <div className="mt-14 w-full">
            <PapelizWorkspacePreview />
          </div>
        </div>
      </section>

      <PapelizSiteSection papelizSiteSectionAnchor="features" papelizSiteSectionTitle="A calm place for your notes, and help when you want it">
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {papelizSiteFeatureCards.map((papelizSiteFeatureCard) => (
            <div key={papelizSiteFeatureCard.title} className="rounded-3xl border border-papeliz-line bg-papeliz-surface p-6 shadow-papeliz-card">
              <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
                <papelizSiteFeatureCard.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{papelizSiteFeatureCard.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteFeatureCard.body}</p>
            </div>
          ))}
        </div>
        <Link href="/features/" className="mt-8 inline-flex font-medium text-papeliz-blue hover:underline">
          See every feature
        </Link>
      </PapelizSiteSection>

      <div className="bg-papeliz-surface-soft">
        <PapelizSiteSection papelizSiteSectionAnchor="assistant" papelizSiteSectionTitle="It edits with you, not around you">
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {papelizSiteAssistantSteps.map((papelizSiteAssistantStep) => (
              <li key={papelizSiteAssistantStep} className="flex gap-3 rounded-3xl bg-papeliz-surface p-5 text-[15px] leading-relaxed">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-papeliz-gradient-start text-white">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                {papelizSiteAssistantStep}
              </li>
            ))}
          </ul>
        </PapelizSiteSection>
      </div>

      <PapelizSiteSection papelizSiteSectionAnchor="providers" papelizSiteSectionTitle="Recommended: Muse Spark on the Meta Model API">
        <p className="mt-4 max-w-3xl text-lg text-papeliz-ink-muted">
          Papeliz’s assistant is built first around Meta’s Muse Spark models, and the Meta Model API is
          the preset selected out of the box. Papeliz speaks the OpenAI-compatible format, so any other
          compatible provider works too.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-papeliz-blue-line bg-papeliz-blue-soft p-6">
            <h3 className="text-lg font-semibold">Muse Spark · Meta Model API</h3>
            <dl className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-[15px]">
              <dt className="text-papeliz-ink-muted">Base URL</dt>
              <dd className="font-mono text-sm break-all">https://api.meta.ai/v1</dd>
              <dt className="text-papeliz-ink-muted">Model</dt>
              <dd className="font-mono text-sm">muse-spark-1.3</dd>
              <dt className="text-papeliz-ink-muted">API key</dt>
              <dd>
                From the{' '}
                <a href="https://dev.meta.ai/" className="font-medium text-papeliz-blue hover:underline">Model API dashboard</a>
              </dd>
            </dl>
            <p className="mt-4 text-[15px] text-papeliz-ink-muted">
              Long context lets the assistant work across many notes at once, and the API accepts calls
              straight from the app.
            </p>
          </div>
          <div className="rounded-3xl border border-papeliz-line p-6">
            <h3 className="text-lg font-semibold">Or any other provider</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {papelizSiteOtherProviderNames.map((papelizSiteOtherProviderName) => (
                <li key={papelizSiteOtherProviderName} className="rounded-full bg-papeliz-surface-gray px-3 py-1.5 text-sm font-medium">
                  {papelizSiteOtherProviderName}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] text-papeliz-ink-muted">
              Your key is stored only on your device and sent only to the provider you pick.
            </p>
          </div>
        </div>
        <Link href="/providers/" className="mt-8 inline-flex font-medium text-papeliz-blue hover:underline">
          See every provider
        </Link>
      </PapelizSiteSection>

      <div className="bg-papeliz-surface-soft">
        <PapelizSiteSection papelizSiteSectionAnchor="privacy" papelizSiteSectionTitle="Private by design">
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {papelizSitePrivacyPoints.map((papelizSitePrivacyPoint) => (
              <div key={papelizSitePrivacyPoint.title} className="rounded-3xl bg-papeliz-surface p-6">
                <papelizSitePrivacyPoint.icon className="size-5 text-papeliz-blue" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{papelizSitePrivacyPoint.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSitePrivacyPoint.body}</p>
              </div>
            ))}
          </div>
          <Link href="/privacy/" className="mt-8 inline-flex font-medium text-papeliz-blue hover:underline">
            Read the privacy details
          </Link>
        </PapelizSiteSection>
      </div>

      <PapelizSiteSection papelizSiteSectionAnchor="open-source" papelizSiteSectionTitle="Free, and open to read, change and share">
        <p className="mt-4 max-w-3xl text-lg text-papeliz-ink-muted">
          Papeliz is released under the MIT License and built in the open.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {papelizSiteAppUrl && <PapelizSiteAppButton papelizSiteAppButtonSize="small" />}
          {papelizSiteGitHubRepositoryUrl ? (
            <a href={papelizSiteGitHubRepositoryUrl} className="inline-flex h-10 items-center rounded-full bg-papeliz-hover px-5 text-sm font-medium hover:bg-papeliz-press">
              View the source on GitHub
            </a>
          ) : (
            <span className="inline-flex h-10 items-center rounded-full bg-papeliz-hover px-5 text-sm font-medium text-papeliz-ink-muted">
              Source on GitHub: coming soon
            </span>
          )}
        </div>
      </PapelizSiteSection>
    </>
  )
}
