import { Rocket } from 'lucide-react'
import { papelizSiteAppUrl } from '@/lib/papeliz-site-config'

type PapelizSiteAppButtonProps = {
  papelizSiteAppButtonSize?: 'large' | 'small' | 'compact'
}

const papelizSiteAppButtonSizeClasses = {
  large: 'h-12 px-6 text-[15px]',
  small: 'h-10 px-5 text-sm',
  compact: 'h-9 px-4 text-sm',
}

// "Use App", as in the header, or "Coming soon" until the app has a public address.
export function PapelizSiteAppButton({ papelizSiteAppButtonSize = 'large' }: PapelizSiteAppButtonProps) {
  const papelizSiteAppButtonSizeClass = papelizSiteAppButtonSizeClasses[papelizSiteAppButtonSize]
  if (!papelizSiteAppUrl) {
    return (
      <span className={`inline-flex items-center rounded-full bg-papeliz-blue-soft font-medium text-papeliz-blue ${papelizSiteAppButtonSizeClass}`}>
        Coming soon
      </span>
    )
  }
  return (
    <a
      href={papelizSiteAppUrl}
      className={`inline-flex items-center gap-2 rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end font-medium whitespace-nowrap text-white transition hover:brightness-[.94] ${papelizSiteAppButtonSizeClass}`}
    >
      <Rocket className="size-4 shrink-0" aria-hidden="true" />
      Use App
    </a>
  )
}
