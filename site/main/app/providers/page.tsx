import Link from 'next/link'
import { KeyRound, Laptop, Link2, Server } from 'lucide-react'
import { PapelizSitePageIntro } from '@/components/marketing/papeliz-site-page-intro'
import { papelizSiteHelpUrl } from '@/lib/papeliz-site-config'
import {
  papelizSiteHostedProviders,
  papelizSiteLocalProviders,
  papelizSiteRecommendedProvider,
  type PapelizSiteProvider,
} from '@/lib/papeliz-site-providers'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'AI Providers',
  papelizSitePageDescription:
    'Bring your own AI provider: Papeliz’s assistant works with any OpenAI-compatible API, with presets for popular hosted providers and models on your own computer.',
  papelizSitePagePath: '/providers/',
})

function PapelizSiteProviderCard({ papelizSiteProvider }: { papelizSiteProvider: PapelizSiteProvider }) {
  return (
    <li className="rounded-3xl border border-papeliz-line bg-papeliz-surface p-5">
      <h3 className="font-semibold">{papelizSiteProvider.papelizSiteProviderName}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteProvider.papelizSiteProviderDescription}</p>
      {papelizSiteProvider.papelizSiteProviderBaseUrl && (
        <p className="mt-3 truncate font-mono text-[13px] text-papeliz-ink-subtle">{papelizSiteProvider.papelizSiteProviderBaseUrl}</p>
      )}
    </li>
  )
}

export default function PapelizSiteProvidersPage() {
  return (
    <>
      <PapelizSitePageIntro papelizSitePageHeading="Bring your own AI provider">
        <p>
          Papeliz’s assistant speaks the OpenAI-compatible format. Pick a preset, paste your API key, and
          the assistant talks straight from your device to that provider. A preset only fills in the
          base URL; you can change it, and the model, at any time.
        </p>
      </PapelizSitePageIntro>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <section aria-labelledby="papeliz-site-providers-recommended">
          <p className="text-sm font-semibold text-papeliz-blue">Recommended</p>
          <h2 id="papeliz-site-providers-recommended" className="mt-1 text-2xl font-normal tracking-tight sm:text-3xl">
            {papelizSiteRecommendedProvider.papelizSiteProviderName}
          </h2>
          <div className="mt-6 rounded-3xl border border-papeliz-blue-line bg-papeliz-blue-soft p-6">
            <p className="max-w-3xl text-[15px] leading-relaxed">
              Papeliz’s assistant is built first around Meta’s Muse Spark models, and the Meta Model API is
              the preset selected out of the box. Long context lets the assistant work across many notes at
              once, and the API accepts calls straight from the app.
            </p>
            <dl className="mt-5 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-[15px]">
              <dt className="text-papeliz-ink-muted">Base URL</dt>
              <dd className="font-mono text-sm break-all">{papelizSiteRecommendedProvider.papelizSiteProviderBaseUrl}</dd>
              <dt className="text-papeliz-ink-muted">Models</dt>
              <dd className="font-mono text-sm">{papelizSiteRecommendedProvider.papelizSiteProviderModelNames.join(', ')}</dd>
              <dt className="text-papeliz-ink-muted">API key</dt>
              <dd>
                From the{' '}
                <a href={papelizSiteRecommendedProvider.papelizSiteProviderKeyPageUrl} className="font-medium text-papeliz-blue hover:underline">
                  {papelizSiteRecommendedProvider.papelizSiteProviderKeyPageLabel}
                </a>
              </dd>
            </dl>
          </div>
        </section>

        <section aria-labelledby="papeliz-site-providers-hosted">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
              <Server className="size-5" aria-hidden="true" />
            </span>
            <h2 id="papeliz-site-providers-hosted" className="text-2xl font-normal tracking-tight">
              Other hosted providers
            </h2>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papelizSiteHostedProviders.map((papelizSiteHostedProvider) => (
              <PapelizSiteProviderCard key={papelizSiteHostedProvider.papelizSiteProviderName} papelizSiteProvider={papelizSiteHostedProvider} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="papeliz-site-providers-local">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
              <Laptop className="size-5" aria-hidden="true" />
            </span>
            <h2 id="papeliz-site-providers-local" className="text-2xl font-normal tracking-tight">
              On your own computer
            </h2>
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-papeliz-ink-muted">
            Run models locally and nothing leaves your machine. Papeliz connects to the local server
            from your device, with no API key needed.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {papelizSiteLocalProviders.map((papelizSiteLocalProvider) => (
              <PapelizSiteProviderCard key={papelizSiteLocalProvider.papelizSiteProviderName} papelizSiteProvider={papelizSiteLocalProvider} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="papeliz-site-providers-custom" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-papeliz-line p-6">
            <Link2 className="size-5 text-papeliz-blue" aria-hidden="true" />
            <h2 id="papeliz-site-providers-custom" className="mt-3 text-lg font-semibold">
              Any other provider
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-papeliz-ink-muted">
              Choose Custom and type the base URL of any OpenAI-compatible API, hosted or running on your
              own machine.
            </p>
          </div>
          <div className="rounded-3xl border border-papeliz-line p-6">
            <KeyRound className="size-5 text-papeliz-blue" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">Where your key goes</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-papeliz-ink-muted">
              Your key is stored only on your device and sent only to the provider you pick. There is no
              Papeliz server in between.{' '}
              <Link href="/privacy/" className="font-medium text-papeliz-blue hover:underline">
                Read the privacy details
              </Link>
              {papelizSiteHelpUrl && (
                <>
                  {' '}or the{' '}
                  <a href={`${papelizSiteHelpUrl}choose-a-provider/`} className="font-medium text-papeliz-blue hover:underline">
                    guide to choosing a provider
                  </a>
                </>
              )}
              .
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
