import type { ReactNode } from 'react'

// The pill above the home page's title: the top bar's blue, a soft light sweeping across it, and a
// sparkle after the label. The sweep lives in globals.css (.papeliz-site-introducing-badge-sweep)
// and stops with reduced motion.
export function PapelizSiteIntroducingBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`papeliz-site-selection-on-color relative inline-flex items-center overflow-hidden rounded-full border border-papeliz-blue-line bg-papeliz-topbar px-4 py-1.5 text-sm font-medium text-white ${className ?? ''}`}
    >
      <span aria-hidden="true" className="papeliz-site-introducing-badge-sweep pointer-events-none absolute inset-0" />
      <span className="relative inline-flex items-center gap-1.5">
        {children}
        <span aria-hidden="true">✨</span>
      </span>
    </span>
  )
}
