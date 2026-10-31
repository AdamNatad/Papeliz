import type { ReactNode } from 'react'

// One account row. On a computer: the title over a muted value, the action on the right, and a
// line under it. On a phone: a small label over the value, inside a grouped card.
export function PapelizAccountRow({
  papelizAccountRowTitle,
  papelizAccountRowValue,
  papelizAccountRowAction,
  papelizAccountRowExtra,
  papelizAccountRowIsDanger = false,
}: {
  papelizAccountRowTitle: string
  papelizAccountRowValue?: ReactNode
  papelizAccountRowAction?: ReactNode
  papelizAccountRowExtra?: ReactNode
  papelizAccountRowIsDanger?: boolean
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-6 md:px-0 md:py-5 md:last:border-b">
      <div className="min-w-0 flex-1">
        <h2
          className={`${papelizAccountRowValue ? 'text-xs font-medium text-papeliz-ink-subtle' : `text-[14.5px] font-semibold ${papelizAccountRowIsDanger ? 'text-papeliz-diff-removed-ink' : ''}`} md:text-base md:font-semibold md:text-papeliz-ink`}
        >
          {papelizAccountRowTitle}
        </h2>
        {papelizAccountRowValue && (
          <p className="truncate text-[14.5px] font-semibold md:mt-1 md:text-sm md:font-normal md:whitespace-normal md:text-papeliz-ink-muted">{papelizAccountRowValue}</p>
        )}
        {papelizAccountRowExtra}
      </div>
      {papelizAccountRowAction}
    </div>
  )
}

// A row's description under its title, wrapping on a phone where a value would be cut short.
export function PapelizAccountRowDescription({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-[13px] text-pretty text-papeliz-ink-muted md:mt-1 md:text-sm">{children}</p>
}

// Rows that belong together; a separate card on a phone, one continuous list on a computer.
export function PapelizAccountRowGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-papeliz-line bg-papeliz-surface [&+&]:mt-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:[&+&]:mt-0">
      {children}
    </div>
  )
}
