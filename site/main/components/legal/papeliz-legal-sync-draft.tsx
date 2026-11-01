import type { ReactNode } from 'react'

// The Privacy Policy's and the Terms' sections for a Papeliz account, its payments and Papeliz Sync's
// servers, drafted for review before Sync's paid launch. They show only on the dev server: the built
// site leaves them out, so a deploy never publishes them. Once the words are approved, the switch
// goes and the sections stay.
export const isPapelizLegalSyncDraftShown = process.env.NODE_ENV === 'development'

// Above the drafted sections, so nobody reading the dev server takes them for the terms in force.
export function PapelizLegalSyncDraftNotice({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-12 rounded-xl border-2 border-dashed border-papeliz-blue-line bg-papeliz-blue-soft px-5 py-4 text-base leading-relaxed text-papeliz-ink">
      <p className="font-semibold">Draft for review: not in force</p>
      <p className="mt-1 text-papeliz-ink-muted">{children}</p>
    </aside>
  )
}
