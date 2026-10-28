import type { ReactNode } from 'react'

type PapelizLegalDocumentProps = {
  papelizLegalDocumentHeading: string
  papelizLegalDocumentLead: ReactNode
  children: ReactNode
}

// The shared layout of the privacy, terms and license pages.
export function PapelizLegalDocument({ papelizLegalDocumentHeading, papelizLegalDocumentLead, children }: PapelizLegalDocumentProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <h1 className="text-4xl leading-tight font-normal tracking-tight text-balance">{papelizLegalDocumentHeading}</h1>
      <div className="mt-4 text-lg leading-relaxed text-papeliz-ink-muted">{papelizLegalDocumentLead}</div>
      {children}
    </article>
  )
}

export function PapelizLegalDocumentSection({ papelizLegalSectionTitle, children }: { papelizLegalSectionTitle: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{papelizLegalSectionTitle}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-papeliz-ink-muted">{children}</div>
    </section>
  )
}
