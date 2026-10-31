'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import papelizAccountStyles from './papeliz-account.module.css'

// The account page's dialog: a title, the body, then the footer's buttons (Close first, the main
// action last). Escape, a click outside it and the footer's Close all close it, and focus goes back
// to the button that opened it.
export function PapelizAccountDialog({
  papelizAccountDialogTitle,
  papelizAccountDialogFooter,
  onPapelizAccountDialogClose,
  children,
}: {
  papelizAccountDialogTitle: string
  papelizAccountDialogFooter: ReactNode
  onPapelizAccountDialogClose: () => void
  children: ReactNode
}) {
  const papelizAccountDialogRef = useRef<HTMLDialogElement>(null)
  const papelizAccountDialogTitleId = useId()
  const papelizAccountDialogBackdropIsPressed = useRef(false)

  useEffect(() => {
    const papelizAccountDialogElement = papelizAccountDialogRef.current
    const papelizAccountDialogOpener = document.activeElement
    const papelizAccountPageOverflowBeforeDialog = document.body.style.overflow
    papelizAccountDialogElement?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      papelizAccountDialogElement?.close()
      document.body.style.overflow = papelizAccountPageOverflowBeforeDialog
      if (papelizAccountDialogOpener instanceof HTMLElement && papelizAccountDialogOpener.isConnected) papelizAccountDialogOpener.focus()
    }
  }, [])

  function isPapelizAccountDialogPointerOutside(papelizAccountDialogPointer: { clientX: number; clientY: number }) {
    const papelizAccountDialogBox = papelizAccountDialogRef.current?.getBoundingClientRect()
    return (
      !!papelizAccountDialogBox &&
      (papelizAccountDialogPointer.clientX < papelizAccountDialogBox.left ||
        papelizAccountDialogPointer.clientX > papelizAccountDialogBox.right ||
        papelizAccountDialogPointer.clientY < papelizAccountDialogBox.top ||
        papelizAccountDialogPointer.clientY > papelizAccountDialogBox.bottom)
    )
  }

  return (
    <dialog
      ref={papelizAccountDialogRef}
      aria-labelledby={papelizAccountDialogTitleId}
      className={`${papelizAccountStyles.papelizAccountDialogEnter} m-auto max-h-[calc(100dvh-48px)] w-[480px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[14px] border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-[0_24px_80px_rgb(0_40_100/0.25)] backdrop:bg-[rgb(10_20_40/0.4)] backdrop:backdrop-blur-[3px]`}
      onCancel={(papelizAccountDialogCancelEvent) => {
        papelizAccountDialogCancelEvent.preventDefault()
        onPapelizAccountDialogClose()
      }}
      onPointerDown={(papelizAccountDialogPointerEvent) => {
        papelizAccountDialogBackdropIsPressed.current =
          papelizAccountDialogPointerEvent.target === papelizAccountDialogRef.current && isPapelizAccountDialogPointerOutside(papelizAccountDialogPointerEvent)
      }}
      onClick={(papelizAccountDialogClickEvent) => {
        if (
          papelizAccountDialogBackdropIsPressed.current &&
          papelizAccountDialogClickEvent.target === papelizAccountDialogRef.current &&
          isPapelizAccountDialogPointerOutside(papelizAccountDialogClickEvent)
        ) {
          onPapelizAccountDialogClose()
        }
        papelizAccountDialogBackdropIsPressed.current = false
      }}
    >
      <header className="border-b border-papeliz-line px-5 py-4 sm:px-6">
        <h2 id={papelizAccountDialogTitleId} className="text-lg font-semibold tracking-[-0.01em]">
          {papelizAccountDialogTitle}
        </h2>
      </header>
      <div className="grid gap-3 px-5 py-6 text-[15px] leading-relaxed text-pretty text-papeliz-ink-muted sm:px-6">{children}</div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-papeliz-line px-5 py-4 sm:px-6 max-sm:[&>*]:flex-1">{papelizAccountDialogFooter}</footer>
    </dialog>
  )
}
