import Link from 'next/link'
import type { ReactNode } from 'react'

// The three legal pages, in the order of the Legal menu beside each of them.
export const papelizLegalDocumentLinks = [
  { papelizLegalDocumentHref: '/license/', papelizLegalDocumentLabel: 'License Overview' },
  { papelizLegalDocumentHref: '/terms/', papelizLegalDocumentLabel: 'Terms of Service' },
  { papelizLegalDocumentHref: '/privacy/', papelizLegalDocumentLabel: 'Privacy Policy' },
] as const

type PapelizLegalDocumentProps = {
  // This page's own path, so the Legal menu can mark it.
  papelizLegalDocumentPath: (typeof papelizLegalDocumentLinks)[number]['papelizLegalDocumentHref']
  papelizLegalDocumentTitle: string
  papelizLegalDocumentSummary: string
  children: ReactNode
}

// The shared layout of the license, terms and privacy pages (Adam, 2026-10-28): a Legal menu
// with the three documents on the left, kept in view while reading, and the document beside it with a large title,
// a one-line summary and sections ruled under their headings. Below 801 px the menu sits above the document, its
// links in a row.
export function PapelizLegalDocument({
  papelizLegalDocumentPath,
  papelizLegalDocumentTitle,
  papelizLegalDocumentSummary,
  children,
}: PapelizLegalDocumentProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-8 pt-2 pb-12 min-[801px]:grid-cols-[200px_minmax(0,1fr)] min-[801px]:gap-[clamp(40px,6vw,80px)] min-[801px]:pt-16">
        <nav
          aria-label="Legal"
          className="min-w-0 border-b border-papeliz-line pb-6 text-[15px] leading-normal min-[801px]:sticky min-[801px]:top-26 min-[801px]:self-start min-[801px]:border-b-0 min-[801px]:pb-0"
        >
          <p className="mb-2.5 font-semibold min-[801px]:mb-4">Legal</p>
          <ul className="flex flex-row flex-wrap gap-x-5.5 gap-y-0.5 min-[801px]:flex-col min-[801px]:gap-1">
            {papelizLegalDocumentLinks.map((papelizLegalDocumentLink) => {
              const papelizLegalDocumentLinkIsCurrent = papelizLegalDocumentLink.papelizLegalDocumentHref === papelizLegalDocumentPath
              return (
                <li key={papelizLegalDocumentLink.papelizLegalDocumentHref}>
                  <Link
                    href={papelizLegalDocumentLink.papelizLegalDocumentHref}
                    aria-current={papelizLegalDocumentLinkIsCurrent ? 'page' : undefined}
                    className={`block w-fit max-w-full py-1.5 underline-offset-4 [overflow-wrap:anywhere] hover:text-papeliz-blue hover:underline ${
                      papelizLegalDocumentLinkIsCurrent ? 'font-semibold text-papeliz-blue' : 'text-papeliz-ink-muted'
                    }`}
                  >
                    {papelizLegalDocumentLink.papelizLegalDocumentLabel}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <article className="min-w-0">
          <header className="mb-8 min-[801px]:mb-10">
            <h1 className="text-[clamp(36px,4.2vw,56px)] leading-[1.12] font-semibold tracking-[-0.04em] [overflow-wrap:anywhere]">
              {papelizLegalDocumentTitle}
            </h1>
            <p className="mt-5 max-w-[58ch] text-lg leading-normal text-papeliz-ink-muted min-[481px]:text-[22px]">{papelizLegalDocumentSummary}</p>
          </header>
          <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
        </article>
      </div>
    </div>
  )
}

// One section of a legal document: its heading ruled underneath, then the text.
export function PapelizLegalDocumentSection({ papelizLegalSectionTitle, children }: { papelizLegalSectionTitle: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-6 border-b border-papeliz-line pb-3.5 text-2xl leading-[1.35] font-semibold tracking-[-0.025em] min-[481px]:text-[28px]">
        {papelizLegalSectionTitle}
      </h2>
      <div className="space-y-5 text-base leading-[1.75] text-papeliz-ink">{children}</div>
    </section>
  )
}
