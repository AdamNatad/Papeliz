'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { House, Menu, X } from 'lucide-react'
import { listPapelizHelpGroupArticles, papelizHelpGroups } from '@/lib/papeliz-help-content'
import { PapelizHelpAccessibilityMenuButton } from './papeliz-help-accessibility-menu-button'
import { PapelizHelpMark } from './papeliz-help-mark'
import { PapelizHelpSearch } from './papeliz-help-search'

// The website lives at the domain's root, outside the help site's /help base path, so its links are
// plain anchors: next/link would put /help in front.
const papelizWebsiteHomeUrl = '/'

// "/what-is-papeliz/" -> "what-is-papeliz"; the help home gives null. The pathname comes without
// the /help base path.
function findCurrentPapelizHelpArticleSlug(helpPathname: string): string | null {
  const helpPathSegments = helpPathname.split('/').filter((helpPathSegment) => helpPathSegment.length > 0)
  return helpPathSegments[0] ?? null
}

function PapelizHelpSidebarNavigation({ currentPapelizHelpArticleSlug }: { currentPapelizHelpArticleSlug: string | null }) {
  return (
    <nav aria-label="Guides" className="px-3 py-6">
      <Link
        href="/"
        aria-current={currentPapelizHelpArticleSlug === null ? 'page' : undefined}
        className={`block rounded-xl px-3 py-1.5 text-[14px] font-medium ${
          currentPapelizHelpArticleSlug === null ? 'bg-papeliz-blue-soft text-papeliz-blue' : 'text-papeliz-ink hover:bg-papeliz-surface-gray'
        }`}
      >
        Help home
      </Link>
      {papelizHelpGroups.map((papelizHelpGroup) => (
        <div key={papelizHelpGroup.papelizHelpGroupSlug} className="mt-6">
          <p className="px-3 text-[12px] font-semibold tracking-wide text-papeliz-ink-subtle uppercase">{papelizHelpGroup.groupTitle}</p>
          <ul className="mt-1.5 space-y-0.5">
            {listPapelizHelpGroupArticles(papelizHelpGroup.papelizHelpGroupSlug).map((papelizHelpArticle) => {
              const isCurrentArticle = papelizHelpArticle.papelizHelpArticleSlug === currentPapelizHelpArticleSlug
              return (
                <li key={papelizHelpArticle.papelizHelpArticleSlug}>
                  <Link
                    href={`/${papelizHelpArticle.papelizHelpArticleSlug}/`}
                    aria-current={isCurrentArticle ? 'page' : undefined}
                    className={`block rounded-xl px-3 py-1.5 text-[14px] leading-snug ${
                      isCurrentArticle ? 'bg-papeliz-blue-soft font-medium text-papeliz-blue' : 'text-papeliz-ink-muted hover:bg-papeliz-surface-gray hover:text-papeliz-ink'
                    }`}
                  >
                    {papelizHelpArticle.articleTitle}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

// The frame around every help page: the blue top bar with search, the Main Site link and the
// Accessibility menu, the guide list on the left (a drawer behind the Menu button below 1024 px),
// and the footer.
export function PapelizHelpShell({ children }: { children: ReactNode }) {
  const helpPathname = usePathname()
  const currentPapelizHelpArticleSlug = findCurrentPapelizHelpArticleSlug(helpPathname)
  const [isHelpDrawerOpen, setHelpDrawerOpen] = useState(false)
  const [helpDrawerPathname, setHelpDrawerPathname] = useState(helpPathname)
  const helpMenuButtonRef = useRef<HTMLButtonElement>(null)
  const helpDrawerPanelRef = useRef<HTMLDivElement>(null)

  // Following a link closes the drawer.
  if (helpDrawerPathname !== helpPathname) {
    setHelpDrawerPathname(helpPathname)
    setHelpDrawerOpen(false)
  }

  useEffect(() => {
    if (!isHelpDrawerOpen) return
    const helpMenuButton = helpMenuButtonRef.current
    helpDrawerPanelRef.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus()
    const closeDrawerOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') setHelpDrawerOpen(false)
    }
    document.addEventListener('keydown', closeDrawerOnEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeDrawerOnEscape)
      document.body.style.overflow = ''
      helpMenuButton?.focus()
    }
  }, [isHelpDrawerOpen])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#papeliz-help-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-papeliz-surface focus:px-4 focus:py-2 focus:shadow-papeliz-pop"
      >
        Skip to content
      </a>

      {/* The app's blue top bar. */}
      <header inert={isHelpDrawerOpen} className="papeliz-help-selection-on-color sticky top-0 z-40 bg-papeliz-topbar text-white">
        <div className="flex h-14 items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <button
            ref={helpMenuButtonRef}
            type="button"
            onClick={() => setHelpDrawerOpen(true)}
            aria-expanded={isHelpDrawerOpen}
            aria-controls="papeliz-help-drawer"
            className="-ml-2 grid size-10 flex-none place-items-center rounded-full text-white/90 hover:bg-white/15 hover:text-white focus-visible:outline-white lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="sr-only">Menu</span>
          </button>
          <Link href="/" className="flex flex-none items-center gap-2 rounded-full font-semibold tracking-[-0.01em] focus-visible:outline-white">
            <PapelizHelpMark size={26} papelizHelpMarkTone="on-blue" />
            <span className="max-sm:sr-only">Papeliz</span>
            <span className="font-normal text-white/80 max-sm:sr-only">Help</span>
          </Link>
          <div className="ml-auto w-full max-w-md min-w-0 sm:ml-6">
            <PapelizHelpSearch />
          </div>
          {/* Back to the website: the house and "Main Site", or the house alone as a round button on phones. */}
          <a
            href={papelizWebsiteHomeUrl}
            aria-label="Main Site"
            title="Main Site"
            className="grid size-[34px] flex-none place-items-center rounded-full text-white/90 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/15 hover:text-white focus-visible:outline-white active:scale-[.94] md:inline-flex md:size-auto md:gap-1.5 md:px-3 md:py-1.5 md:text-[14px]"
          >
            <House className="size-[18px] md:size-4" aria-hidden="true" />
            <span className="max-md:hidden">Main Site</span>
          </a>
          <PapelizHelpAccessibilityMenuButton />
        </div>
      </header>

      {/* While the drawer is open, the page behind it takes no focus or clicks. */}
      <div inert={isHelpDrawerOpen} className="mx-auto flex w-full max-w-[1400px] flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[272px] flex-none overflow-y-auto border-r border-papeliz-line lg:block">
          <PapelizHelpSidebarNavigation currentPapelizHelpArticleSlug={currentPapelizHelpArticleSlug} />
        </aside>
        <main id="papeliz-help-main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {isHelpDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Guides">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close the menu"
            onClick={() => setHelpDrawerOpen(false)}
            className="absolute inset-0 bg-papeliz-backdrop"
          />
          <div
            id="papeliz-help-drawer"
            ref={helpDrawerPanelRef}
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-papeliz-surface shadow-papeliz-pop"
          >
            <div className="flex h-14 flex-none items-center justify-between border-b border-papeliz-line px-4">
              <span className="flex items-center gap-2 font-semibold">
                <PapelizHelpMark size={24} /> Papeliz Help
              </span>
              <button
                type="button"
                onClick={() => setHelpDrawerOpen(false)}
                className="grid size-10 place-items-center rounded-full hover:bg-papeliz-surface-gray"
              >
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Close the menu</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PapelizHelpSidebarNavigation currentPapelizHelpArticleSlug={currentPapelizHelpArticleSlug} />
              <a href={papelizWebsiteHomeUrl} className="mx-6 mb-8 inline-flex items-center gap-1 text-[14px] text-papeliz-ink-muted hover:text-papeliz-ink">
                Main Site
              </a>
            </div>
          </div>
        </div>
      )}

      <footer inert={isHelpDrawerOpen} className="border-t border-papeliz-line bg-papeliz-surface-soft">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-6 text-[13px] text-papeliz-ink-subtle sm:flex-row sm:items-center sm:px-6">
          <p>© 2026 Natad Corporation · Papeliz is open source under the MIT License.</p>
          <a href={papelizWebsiteHomeUrl} className="hover:text-papeliz-ink sm:ml-auto">
            Main Site
          </a>
        </div>
      </footer>
    </div>
  )
}
