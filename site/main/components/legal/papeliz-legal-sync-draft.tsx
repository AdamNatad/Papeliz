import type { ReactNode } from 'react'

// The Privacy Policy's and the Terms' sections for a Papeliz account, its payments and Papeliz Sync's
// servers, drafted for review before Sync opens. Until accounts open, every build and the dev server show
// them together at the end of the page, in one framed block whose notice says they don't apply yet. Once
// accounts open and the words are approved, the frame goes and the sections stay.
export function PapelizLegalWhenAccountsOpenBlock({
  papelizLegalWhenAccountsOpenNotice,
  children,
}: {
  papelizLegalWhenAccountsOpenNotice: string
  children: ReactNode
}) {
  return (
    <div className="mt-12 rounded-2xl border-2 border-papeliz-blue-line bg-papeliz-blue-soft/40 px-5 py-6 sm:px-8 sm:py-8">
      <div className="text-base leading-relaxed">
        <p className="text-lg font-semibold text-papeliz-blue">When accounts open</p>
        <p className="mt-1 text-papeliz-ink-muted">{papelizLegalWhenAccountsOpenNotice}</p>
      </div>
      {children}
    </div>
  )
}
