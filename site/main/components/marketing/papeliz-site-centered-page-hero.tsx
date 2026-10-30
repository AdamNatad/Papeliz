import type { ReactNode } from 'react'

type PapelizSiteCenteredPageHeroProps = {
  papelizSiteCenteredPageHeroHeading: ReactNode
  // An underline in Papeliz blue under the heading, as Pricing's.
  papelizSiteCenteredPageHeroHeadingIsUnderlined?: boolean
  children?: ReactNode
}

// The centered top of the Pricing and Sync pages: the page's one h1
// and a short lead, with no border under them.
export function PapelizSiteCenteredPageHero({
  papelizSiteCenteredPageHeroHeading,
  papelizSiteCenteredPageHeroHeadingIsUnderlined = false,
  children,
}: PapelizSiteCenteredPageHeroProps) {
  return (
    <section className="mx-auto max-w-[900px] pt-15.5 text-center sm:pt-19">
      <h1
        className={`text-[clamp(2.375rem,8vw,4rem)] leading-[1.08] font-normal tracking-tight text-balance ${
          papelizSiteCenteredPageHeroHeadingIsUnderlined
            ? 'underline decoration-papeliz-blue decoration-3 underline-offset-[0.2em] sm:decoration-4'
            : ''
        }`}
      >
        {papelizSiteCenteredPageHeroHeading}
      </h1>
      {children && <div className="mx-auto mt-6 max-w-[620px] text-lg leading-normal text-balance text-papeliz-ink-muted sm:text-[22px]">{children}</div>}
    </section>
  )
}
