import type { ReactNode } from 'react'

type PapelizSitePageIntroProps = {
  papelizSitePageHeading: ReactNode
  children?: ReactNode
}

// The top of an inner page: the page's one h1 and a short lead.
export function PapelizSitePageIntro({ papelizSitePageHeading, children }: PapelizSitePageIntroProps) {
  return (
    <div className="border-b border-papeliz-line">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20">
        <h1 className="max-w-3xl text-4xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">{papelizSitePageHeading}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-papeliz-ink-muted">{children}</div>}
      </div>
    </div>
  )
}
