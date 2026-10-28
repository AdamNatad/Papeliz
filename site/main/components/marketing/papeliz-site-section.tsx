import type { ReactNode } from 'react'

type PapelizSiteSectionProps = {
  papelizSiteSectionAnchor: string
  papelizSiteSectionTitle: ReactNode
  children: ReactNode
}

// A full-width page section with a heading. Its scroll margin clears the sticky header, which is 44 px
// taller on phones (the row of links under the bar).
export function PapelizSiteSection({ papelizSiteSectionAnchor, papelizSiteSectionTitle, children }: PapelizSiteSectionProps) {
  return (
    <section id={papelizSiteSectionAnchor} className="scroll-mt-31 py-20 sm:py-24 md:scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl leading-tight font-normal tracking-tight text-balance sm:text-4xl">{papelizSiteSectionTitle}</h2>
        {children}
      </div>
    </section>
  )
}
