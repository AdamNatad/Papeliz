'use client'

import { ArrowRight, ChevronDown, Download, Rocket, SquareTerminal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { FaAndroid, FaApple, FaWindows } from 'react-icons/fa6'
import { SiHarmonyos } from 'react-icons/si'
import { PapelizSiteComingSoonPill } from '@/components/marketing/papeliz-site-coming-soon-pill'
import { papelizSiteDownloadUrl } from '@/lib/papeliz-site-config'
import { papelizAccountAppPath } from './papeliz-account-config'

type PapelizAccountDownloadTargetId = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'harmonyos'

type PapelizAccountDownloadTarget = {
  papelizAccountDownloadTargetId: PapelizAccountDownloadTargetId
  papelizAccountDownloadTargetLabel: string
  papelizAccountDownloadTargetDetail: string
  PapelizAccountDownloadTargetLogo: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
}

// Every app Papeliz offers, in the order the menu lists them.
const papelizAccountDownloadTargets: readonly PapelizAccountDownloadTarget[] = [
  { papelizAccountDownloadTargetId: 'windows', papelizAccountDownloadTargetLabel: 'Windows', papelizAccountDownloadTargetDetail: 'Windows 10 and 11', PapelizAccountDownloadTargetLogo: FaWindows },
  { papelizAccountDownloadTargetId: 'macos', papelizAccountDownloadTargetLabel: 'macOS', papelizAccountDownloadTargetDetail: 'Apple silicon and Intel', PapelizAccountDownloadTargetLogo: FaApple },
  { papelizAccountDownloadTargetId: 'linux', papelizAccountDownloadTargetLabel: 'Linux', papelizAccountDownloadTargetDetail: 'AppImage and .deb', PapelizAccountDownloadTargetLogo: SquareTerminal },
  { papelizAccountDownloadTargetId: 'ios', papelizAccountDownloadTargetLabel: 'iPhone and iPad', papelizAccountDownloadTargetDetail: 'App Store', PapelizAccountDownloadTargetLogo: FaApple },
  { papelizAccountDownloadTargetId: 'android', papelizAccountDownloadTargetLabel: 'Android', papelizAccountDownloadTargetDetail: 'Google Play', PapelizAccountDownloadTargetLogo: FaAndroid },
  { papelizAccountDownloadTargetId: 'harmonyos', papelizAccountDownloadTargetLabel: 'HarmonyOS', papelizAccountDownloadTargetDetail: 'AppGallery', PapelizAccountDownloadTargetLogo: SiHarmonyos },
]

// The system this browser runs on, to mark its row "This device".
function readPapelizAccountThisDeviceDownloadTargetId(): PapelizAccountDownloadTargetId | null {
  const browserUserAgent = navigator.userAgent
  if (/HarmonyOS|OpenHarmony/i.test(browserUserAgent)) return 'harmonyos'
  if (/Android/i.test(browserUserAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(browserUserAgent) || (/Macintosh/i.test(browserUserAgent) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Windows/i.test(browserUserAgent)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(browserUserAgent)) return 'macos'
  if (/Linux|X11|CrOS/i.test(browserUserAgent)) return 'linux'
  return null
}

function PapelizAccountDownloadMenuItems() {
  const [thisDeviceDownloadTargetId] = useState(readPapelizAccountThisDeviceDownloadTargetId)
  return (
    <>
      <p className="mx-2.5 mt-1.5 mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-papeliz-ink-subtle uppercase">Download Papeliz</p>
      {papelizAccountDownloadTargets.map((papelizAccountDownloadTarget) => {
        const downloadTargetIsThisDevice = papelizAccountDownloadTarget.papelizAccountDownloadTargetId === thisDeviceDownloadTargetId
        const downloadTargetContent = (
          <>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-papeliz-line bg-papeliz-surface-soft text-papeliz-ink">
              <papelizAccountDownloadTarget.PapelizAccountDownloadTargetLogo className="size-[17px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] leading-tight font-semibold">{papelizAccountDownloadTarget.papelizAccountDownloadTargetLabel}</span>
              <span className="block text-xs leading-snug text-papeliz-ink-muted">{papelizAccountDownloadTarget.papelizAccountDownloadTargetDetail}</span>
            </span>
            {papelizSiteDownloadUrl ? (
              downloadTargetIsThisDevice && <span className="text-[11px] font-bold whitespace-nowrap text-papeliz-blue">This device</span>
            ) : (
              <PapelizSiteComingSoonPill />
            )}
          </>
        )
        const downloadTargetClassName = `flex items-center gap-[11px] rounded-lg px-2.5 py-[7px] text-left ${downloadTargetIsThisDevice ? 'bg-papeliz-blue-soft' : ''}`
        return papelizSiteDownloadUrl ? (
          <a
            key={papelizAccountDownloadTarget.papelizAccountDownloadTargetId}
            role="menuitem"
            href={`${papelizSiteDownloadUrl}#papeliz-download-${papelizAccountDownloadTarget.papelizAccountDownloadTargetId}`}
            className={`${downloadTargetClassName} transition-colors hover:bg-papeliz-surface-soft`}
          >
            {downloadTargetContent}
          </a>
        ) : (
          <div key={papelizAccountDownloadTarget.papelizAccountDownloadTargetId} role="menuitem" aria-disabled="true" className={downloadTargetClassName}>
            {downloadTargetContent}
          </div>
        )
      })}
      {papelizSiteDownloadUrl && (
        <a
          href={papelizSiteDownloadUrl}
          className="mt-1 flex items-center justify-between border-t border-papeliz-line px-2.5 pt-2.5 pb-1 text-[12.5px] font-semibold text-papeliz-blue hover:underline"
        >
          All downloads
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </>
  )
}

// Closes an open menu on a press outside it or on Escape, and gives focus back to its button.
function useClosePapelizAccountMenuOutside(menuIsOpen: boolean, closeMenu: () => void) {
  const papelizAccountMenuRootRef = useRef<HTMLDivElement>(null)
  const papelizAccountMenuButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuIsOpen) return
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!papelizAccountMenuRootRef.current?.contains(pointerEvent.target as Node)) closeMenu()
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      closeMenu()
      papelizAccountMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuIsOpen, closeMenu])
  return { papelizAccountMenuRootRef, papelizAccountMenuButtonRef }
}

const papelizAccountLaunchLinkClassName =
  'flex min-h-10 items-center justify-center gap-2 px-3 text-sm font-semibold whitespace-nowrap text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white'

// The sidebar's split button: Launch Papeliz opens the app in a new tab; the arrow opens the
// download menu.
export function PapelizAccountSidebarLaunchButton() {
  const [downloadMenuIsOpen, setDownloadMenuIsOpen] = useState(false)
  const closeDownloadMenu = useCallback(() => setDownloadMenuIsOpen(false), [])
  const { papelizAccountMenuRootRef, papelizAccountMenuButtonRef } = useClosePapelizAccountMenuOutside(downloadMenuIsOpen, closeDownloadMenu)
  return (
    <div ref={papelizAccountMenuRootRef} className="relative -mx-2.5 mb-5">
      <div className="flex overflow-hidden rounded-lg bg-papeliz-gradient-start shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(0_40_100/0.18)]">
        <a href={papelizAccountAppPath} target="_blank" rel="noopener" className={`${papelizAccountLaunchLinkClassName} flex-1 hover:bg-white/10`}>
          <Rocket className="size-[17px] shrink-0" aria-hidden="true" />
          Launch Papeliz
        </a>
        <button
          ref={papelizAccountMenuButtonRef}
          type="button"
          aria-label="Download Papeliz"
          aria-haspopup="menu"
          aria-expanded={downloadMenuIsOpen}
          onClick={() => setDownloadMenuIsOpen((downloadMenuWasOpen) => !downloadMenuWasOpen)}
          className={`flex cursor-pointer items-center gap-[3px] border-l border-white/30 px-[11px] text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white ${
            downloadMenuIsOpen ? 'bg-black/20' : ''
          }`}
        >
          <Download className="size-4" aria-hidden="true" />
          <ChevronDown className={`size-[13px] transition-transform ${downloadMenuIsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {downloadMenuIsOpen && (
        <div
          role="menu"
          aria-label="Download Papeliz"
          className="papeliz-pop-enter absolute top-[calc(100%+6px)] left-0 z-30 grid w-[316px] rounded-xl border border-papeliz-line bg-papeliz-surface p-1.5 text-papeliz-ink shadow-papeliz-pop"
        >
          <PapelizAccountDownloadMenuItems />
        </div>
      )}
    </div>
  )
}

// On a phone: Launch and Download side by side at one size; the download menu is a sheet from
// the bottom.
export function PapelizAccountPhoneLaunchButtons() {
  const [downloadSheetIsOpen, setDownloadSheetIsOpen] = useState(false)
  const closeDownloadSheet = useCallback(() => setDownloadSheetIsOpen(false), [])
  const { papelizAccountMenuRootRef, papelizAccountMenuButtonRef } = useClosePapelizAccountMenuOutside(downloadSheetIsOpen, closeDownloadSheet)
  const phoneLaunchButtonClassName = 'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-semibold whitespace-nowrap'
  return (
    <div className="mt-0.5 mb-3.5 grid grid-cols-2 gap-2">
      <a
        href={papelizAccountAppPath}
        target="_blank"
        rel="noopener"
        className={`${phoneLaunchButtonClassName} bg-papeliz-gradient-start text-white shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(0_40_100/0.18)]`}
      >
        <Rocket className="size-[17px] shrink-0" aria-hidden="true" />
        Launch Papeliz
      </a>
      <div ref={papelizAccountMenuRootRef} className="contents">
        <button
          ref={papelizAccountMenuButtonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={downloadSheetIsOpen}
          onClick={() => setDownloadSheetIsOpen((downloadSheetWasOpen) => !downloadSheetWasOpen)}
          className={`${phoneLaunchButtonClassName} cursor-pointer border bg-papeliz-blue-soft text-papeliz-blue ${downloadSheetIsOpen ? 'border-papeliz-blue' : 'border-papeliz-blue-line'}`}
        >
          <Download className="size-4 shrink-0" aria-hidden="true" />
          Download
          <ChevronDown className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
        </button>
        {downloadSheetIsOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-[rgb(8_12_20/0.45)]" aria-hidden="true" onClick={closeDownloadSheet} />
            <div
              role="menu"
              aria-label="Download Papeliz"
              className="fixed inset-x-0 bottom-0 z-50 grid rounded-t-[20px] bg-papeliz-surface px-2.5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] text-papeliz-ink shadow-papeliz-pop before:mx-auto before:mt-0.5 before:mb-2 before:block before:h-1 before:w-10 before:rounded-full before:bg-papeliz-line-strong"
            >
              <PapelizAccountDownloadMenuItems />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
