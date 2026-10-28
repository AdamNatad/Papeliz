import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function PapelizSiteNotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-papeliz-blue">404</p>
      <h1 className="mt-2 text-3xl font-normal tracking-tight">This page isn’t here</h1>
      <p className="mt-3 text-papeliz-ink-muted">The link may be old, or the page moved.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end px-5 font-medium text-white"
      >
        Back to Papeliz
      </Link>
    </div>
  )
}
