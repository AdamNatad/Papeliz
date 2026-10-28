import type { ReactNode } from 'react'

type PapelizSiteSectionProps = {
  papelizSiteSectionAnchor: string
  papelizSiteSectionTitle: ReactNode
  children: ReactNode
}

// A full-width page section with a heading.
export function PapelizSiteSection({ papelizSiteSectionAnchor, papelizSiteSectionTitle, children }: PapelizSiteSectionProps) {
  return (
    <section id={papelizSiteSectionAnchor} className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl leading-tight font-normal tracking-tight text-balance sm:text-4xl">{papelizSiteSectionTitle}</h2>
        {children}
      </div>
    </section>
  )
}
