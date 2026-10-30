import { Accessibility, ChevronLeft, ChevronRight, FolderX, Lock, LockOpen, Maximize2, RefreshCw, Settings, Share, User, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizMediaQuery } from '../ui/papeliz-media-query'
import { subscribeToPapelizWindowWidthChange } from '../ui/papeliz-window-width-change'
import { usePapelizKeyBindingShortcutLabel } from './papeliz-key-bindings-store'
import { PapelizSettingsGearExportPage } from './papeliz-settings-gear-export-page'
import { PapelizSettingsGearAccessibilityPage, PapelizSettingsGearSettingsPage, PapelizSettingsGearTeaserPage } from './papeliz-settings-gear-pages'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

type PapelizSettingsGearPage = 'account' | 'sync' | 'settings' | 'export' | 'accessibility'

const papelizSettingsGearPageChoices: Record<PapelizSettingsGearPage, { settingsGearPageLabel: string; SettingsGearPageIcon: LucideIcon }> = {
  account: { settingsGearPageLabel: 'Account', SettingsGearPageIcon: User },
  sync: { settingsGearPageLabel: 'Sync', SettingsGearPageIcon: RefreshCw },
  settings: { settingsGearPageLabel: 'Settings', SettingsGearPageIcon: Settings },
  export: { settingsGearPageLabel: 'Export', SettingsGearPageIcon: Share },
  accessibility: { settingsGearPageLabel: 'Accessibility', SettingsGearPageIcon: Accessibility },
}

// The list's groups, split by lines: Account | Sync, Settings, Export | Accessibility (then the
// switches and Close Vault in the workspace). The start page has no vault, so no Settings or Export.
const papelizSettingsGearWorkspacePageGroups: ReadonlyArray<ReadonlyArray<PapelizSettingsGearPage>> = [['account'], ['sync', 'settings', 'export'], ['accessibility']]
const papelizSettingsGearStartPagePageGroups: ReadonlyArray<ReadonlyArray<PapelizSettingsGearPage>> = [['account'], ['sync'], ['accessibility']]

const papelizSettingsGearRowClassName =
  'flex h-9 w-full flex-none items-center gap-2.5 rounded-full px-2.5 text-left text-[13px] font-medium whitespace-nowrap transition-colors hover:bg-papeliz-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-papeliz-blue pointer-coarse:h-11'

function PapelizSettingsGearListLine() {
  return <div role="separator" className="mx-1.5 my-1 h-px flex-none bg-papeliz-line" />
}

interface PapelizSettingsGearSwitchRowProps {
  switchRowLabel: string
  switchRowTitle: string
  isSwitchRowOn: boolean
  SwitchRowIcon: LucideIcon
  onSwitchRowToggle: () => void
}

// Lock All Notes and Focus Mode: rows that turn something on and off, with a switch at their end.
function PapelizSettingsGearSwitchRow({ switchRowLabel, switchRowTitle, isSwitchRowOn, SwitchRowIcon, onSwitchRowToggle }: PapelizSettingsGearSwitchRowProps) {
  return (
    <button type="button" role="switch" aria-checked={isSwitchRowOn} title={switchRowTitle} onClick={onSwitchRowToggle} className={joinPapelizClassNames(papelizSettingsGearRowClassName, 'gap-2 pr-2')}>
      <SwitchRowIcon className={joinPapelizClassNames('size-4 flex-none', isSwitchRowOn ? 'text-papeliz-blue' : 'text-papeliz-ink-muted')} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{switchRowLabel}</span>
      <span
        aria-hidden="true"
        className={joinPapelizClassNames(
          'relative h-4 w-7 flex-none rounded-full transition-colors after:absolute after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgb(17_17_18/0.25)] after:transition-[left] after:duration-150',
          isSwitchRowOn ? 'bg-papeliz-blue after:left-3.5' : 'bg-papeliz-line-strong after:left-0.5',
        )}
      />
    </button>
  )
}

interface PapelizSettingsGearButtonProps {
  // The workspace's gear has every page, the switches and Close Vault; the start page's has Account,
  // Sync and Accessibility (the theme only), since no vault is open there.
  settingsGearPlace: 'workspace' | 'start-page'
}

// The Settings gear in the blue top bar. It opens a panel: the list on the left, the chosen page on
// the right, opening on Accessibility. Below the md breakpoint the list fills the panel and each page
// opens over it with a back arrow. Esc, a click outside or a change in window width closes it.
export function PapelizSettingsGearButton({ settingsGearPlace }: PapelizSettingsGearButtonProps) {
  const isWorkspaceSettingsGear = settingsGearPlace === 'workspace'
  const isSettingsGearSideBySide = usePapelizMediaQuery('(min-width: 768px)')
  const isWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.isWholeVaultEditingLocked)
  const setWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.setWholeVaultEditingLocked)
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const setFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.setFocusModeOn)
  const setVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultCloseConfirmationShown)
  const focusModeShortcutLabel = usePapelizKeyBindingShortcutLabel('focus-mode-toggle')
  const [settingsGearPanelAnchor, setSettingsGearPanelAnchor] = useState<{ anchorRight: number; anchorTop: number } | null>(null)
  const [chosenSettingsGearPage, setChosenSettingsGearPage] = useState<PapelizSettingsGearPage>('accessibility')
  // Phones only: a page is open over the list.
  const [isSettingsGearPageOpenOnPhone, setIsSettingsGearPageOpenOnPhone] = useState(false)
  const settingsGearPanelRef = useRef<HTMLDivElement>(null)
  const settingsGearButtonRef = useRef<HTMLButtonElement>(null)
  const settingsGearPageGroups = isWorkspaceSettingsGear ? papelizSettingsGearWorkspacePageGroups : papelizSettingsGearStartPagePageGroups
  const isSettingsGearPanelOpen = settingsGearPanelAnchor !== null

  const closeSettingsGearPanel = () => setSettingsGearPanelAnchor(null)

  useLayoutEffect(() => {
    if (!isSettingsGearPanelOpen) return
    // The chosen page's row on desktop; the list's first row on phones.
    const settingsGearPanelElement = settingsGearPanelRef.current
    ;(
      settingsGearPanelElement?.querySelector<HTMLButtonElement>('[aria-current="page"]') ??
      settingsGearPanelElement?.querySelector<HTMLButtonElement>('[data-papeliz-settings-gear-first-row]')
    )?.focus()
  }, [isSettingsGearPanelOpen])

  useEffect(() => {
    if (!isSettingsGearPanelOpen) return
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      const pointerTarget = pointerEvent.target as Node
      if (!settingsGearPanelRef.current?.contains(pointerTarget) && !settingsGearButtonRef.current?.contains(pointerTarget)) setSettingsGearPanelAnchor(null)
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return
      // The workspace leaves focus mode on Esc too; this Esc only closes the panel.
      keyboardEvent.preventDefault()
      setSettingsGearPanelAnchor(null)
      settingsGearButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    // Only a change in width closes it: on a phone the height changes whenever the address bar
    // hides or the keyboard opens, and the panel would close under the user's finger.
    const stopWatchingWindowWidth = subscribeToPapelizWindowWidthChange(() => setSettingsGearPanelAnchor(null))
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      stopWatchingWindowWidth()
    }
  }, [isSettingsGearPanelOpen])

  const openSettingsGearPage = (settingsGearPage: PapelizSettingsGearPage) => {
    setChosenSettingsGearPage(settingsGearPage)
    setIsSettingsGearPageOpenOnPhone(true)
  }

  const renderSettingsGearPage = (): ReactNode => {
    if (chosenSettingsGearPage === 'account' || chosenSettingsGearPage === 'sync') return <PapelizSettingsGearTeaserPage settingsGearTeaser={chosenSettingsGearPage} />
    if (chosenSettingsGearPage === 'settings') return <PapelizSettingsGearSettingsPage />
    if (chosenSettingsGearPage === 'export') return <PapelizSettingsGearExportPage />
    return <PapelizSettingsGearAccessibilityPage isNoteDisplaySettingsShown={isWorkspaceSettingsGear} />
  }

  const settingsGearList = (
    <nav aria-label="Settings" className="flex min-h-0 flex-col gap-0.5">
      {settingsGearPageGroups.map((settingsGearPageGroup, settingsGearPageGroupIndex) => (
        <div key={settingsGearPageGroup.join('-')} className="flex flex-col gap-0.5">
          {settingsGearPageGroupIndex > 0 && <PapelizSettingsGearListLine />}
          {settingsGearPageGroup.map((settingsGearPage, settingsGearPageIndex) => {
            const { settingsGearPageLabel, SettingsGearPageIcon } = papelizSettingsGearPageChoices[settingsGearPage]
            const isSettingsGearPageChosen = isSettingsGearSideBySide && settingsGearPage === chosenSettingsGearPage
            return (
              <button
                key={settingsGearPage}
                type="button"
                aria-current={isSettingsGearPageChosen ? 'page' : undefined}
                data-papeliz-settings-gear-first-row={settingsGearPageGroupIndex === 0 && settingsGearPageIndex === 0 ? true : undefined}
                onClick={() => openSettingsGearPage(settingsGearPage)}
                className={joinPapelizClassNames(
                  papelizSettingsGearRowClassName,
                  isSettingsGearPageChosen && 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink hover:bg-papeliz-chosen-row-ground',
                )}
              >
                <SettingsGearPageIcon
                  className={joinPapelizClassNames('size-4 flex-none', isSettingsGearPageChosen ? 'text-papeliz-chosen-row-ink' : 'text-papeliz-ink-muted')}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{settingsGearPageLabel}</span>
                {!isSettingsGearSideBySide && <ChevronRight className="size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      ))}
      {isWorkspaceSettingsGear && (
        <>
          <PapelizSettingsGearSwitchRow
            switchRowLabel="Lock All Notes"
            switchRowTitle={
              isWholeVaultEditingLocked
                ? 'Every note is locked. Turn it off; notes you locked one by one stay locked.'
                : 'Lock every note in this vault, so they can be read but not changed'
            }
            isSwitchRowOn={isWholeVaultEditingLocked}
            SwitchRowIcon={isWholeVaultEditingLocked ? Lock : LockOpen}
            onSwitchRowToggle={() => setWholeVaultEditingLocked(!isWholeVaultEditingLocked)}
          />
          <PapelizSettingsGearSwitchRow
            switchRowLabel="Focus Mode"
            switchRowTitle={`Focus Mode (${focusModeShortcutLabel})`}
            isSwitchRowOn={isFocusModeOn}
            SwitchRowIcon={Maximize2}
            onSwitchRowToggle={() => setFocusModeOn(!isFocusModeOn)}
          />
          <div className="mt-auto flex-none border-t border-papeliz-line pt-1.5">
            <button
              type="button"
              title="Close this vault and go back to the start page"
              onClick={() => {
                // Focus waits on the gear, so it comes back there when the question closes.
                settingsGearButtonRef.current?.focus()
                closeSettingsGearPanel()
                setVaultCloseConfirmationShown(true)
              }}
              className={papelizSettingsGearRowClassName}
            >
              <FolderX className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Close Vault</span>
            </button>
          </div>
        </>
      )}
    </nav>
  )

  const isPhonePageShown = !isSettingsGearSideBySide && isSettingsGearPageOpenOnPhone

  return (
    <>
      <PapelizIconButton
        ref={settingsGearButtonRef}
        iconButtonLabel="Settings"
        iconButtonTone="topbar"
        aria-haspopup="dialog"
        aria-expanded={isSettingsGearPanelOpen}
        onClick={(clickEvent) => {
          if (isSettingsGearPanelOpen) {
            closeSettingsGearPanel()
            return
          }
          const settingsGearButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setChosenSettingsGearPage('accessibility')
          setIsSettingsGearPageOpenOnPhone(false)
          setSettingsGearPanelAnchor({ anchorRight: window.innerWidth - settingsGearButtonRect.right, anchorTop: settingsGearButtonRect.bottom + 6 })
        }}
      >
        <Settings className="size-[18px]" aria-hidden="true" />
      </PapelizIconButton>
      {settingsGearPanelAnchor !== null &&
        createPortal(
          <div
            ref={settingsGearPanelRef}
            role="dialog"
            aria-label="Settings"
            className={joinPapelizClassNames(
              'papeliz-pop-enter fixed z-50 flex overflow-hidden rounded-2xl border border-papeliz-line bg-papeliz-surface text-papeliz-ink shadow-papeliz-pop',
              isSettingsGearSideBySide ? 'w-[474px]' : 'w-[min(360px,calc(100vw-16px))]',
            )}
            style={{
              right: Math.max(8, settingsGearPanelAnchor.anchorRight),
              top: settingsGearPanelAnchor.anchorTop,
              maxHeight: `calc(100dvh - ${settingsGearPanelAnchor.anchorTop + 8}px)`,
            }}
          >
            {isSettingsGearSideBySide ? (
              <>
                <div className="flex w-[184px] flex-none flex-col overflow-y-auto border-r border-papeliz-line bg-papeliz-surface-soft p-2 [scrollbar-width:thin]">{settingsGearList}</div>
                <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-3.5 [scrollbar-width:thin]">{renderSettingsGearPage()}</div>
              </>
            ) : isPhonePageShown ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-none items-center gap-1 border-b border-papeliz-line px-2 py-1.5">
                  <PapelizIconButton iconButtonLabel="Back" iconButtonSize="small" onClick={() => setIsSettingsGearPageOpenOnPhone(false)} className="pointer-coarse:size-10">
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </PapelizIconButton>
                  <p className="text-[14px] font-semibold">{papelizSettingsGearPageChoices[chosenSettingsGearPage].settingsGearPageLabel}</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 [scrollbar-width:thin]">{renderSettingsGearPage()}</div>
              </div>
            ) : (
              <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">{settingsGearList}</div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
