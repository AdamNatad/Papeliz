import { Ban, Plus } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizColorPicker } from '../ui/papeliz-color-picker'
import type { PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { subscribeToPapelizWindowWidthChange } from '../ui/papeliz-window-width-change'
import type { PapelizVaultEntryKind } from '../vault/papeliz-vault-adapter'
import {
  describePapelizVaultEntryLookColor,
  papelizVaultEntryLookColorNames,
  papelizVaultEntryLookIcons,
  type PapelizVaultEntryLook,
  type PapelizVaultEntryLookIconName,
} from './papeliz-vault-entry-looks'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

interface PapelizVaultEntryLookPanelProps {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
  vaultEntryDisplayName: string
  lookPanelPosition: PapelizPopoverMenuPosition
  onLookPanelClose: () => void
}

const papelizLookPanelViewportMargin = 8

// Color and Icon, from a note's or folder's menu in the file list: eight colors, none, or one of the
// user's own, and an icon from the set. Each pick applies at once and the panel stays open, so the
// row can be seen changing; Reset to default takes both back.
export function PapelizVaultEntryLookPanel({
  vaultEntryRelativePath,
  vaultEntryKind,
  vaultEntryDisplayName,
  lookPanelPosition,
  onLookPanelClose,
}: PapelizVaultEntryLookPanelProps) {
  const vaultEntryLook = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultEntryLooks[vaultEntryRelativePath])
  const setVaultEntryLook = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultEntryLook)
  const lookPanelRef = useRef<HTMLDivElement>(null)
  const onLookPanelCloseRef = useRef(onLookPanelClose)
  const [clampedLookPanelPosition, setClampedLookPanelPosition] = useState(lookPanelPosition)
  const [isCustomColorPickerShown, setIsCustomColorPickerShown] = useState(false)
  const currentLook: PapelizVaultEntryLook = vaultEntryLook ?? {}
  const defaultIconName: PapelizVaultEntryLookIconName = vaultEntryKind === 'folder' ? 'folder' : 'file-text'
  const isCustomColorChosen = currentLook.lookColor?.startsWith('#') === true

  useEffect(() => {
    onLookPanelCloseRef.current = onLookPanelClose
  })

  // Keeps the panel inside the window, as a menu does.
  useLayoutEffect(() => {
    const lookPanelElement = lookPanelRef.current
    if (lookPanelElement === null) return
    const lookPanelRect = lookPanelElement.getBoundingClientRect()
    setClampedLookPanelPosition({
      menuAnchorLeft: Math.max(
        papelizLookPanelViewportMargin,
        Math.min(lookPanelPosition.menuAnchorLeft, window.innerWidth - lookPanelRect.width - papelizLookPanelViewportMargin),
      ),
      menuAnchorTop: Math.max(
        papelizLookPanelViewportMargin,
        Math.min(lookPanelPosition.menuAnchorTop, window.innerHeight - lookPanelRect.height - papelizLookPanelViewportMargin),
      ),
    })
  }, [lookPanelPosition, isCustomColorPickerShown])

  useEffect(() => {
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!lookPanelRef.current?.contains(pointerEvent.target as Node)) onLookPanelCloseRef.current()
    }
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      onLookPanelCloseRef.current()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('keydown', closeOnEscape)
    const stopWatchingWindowWidth = subscribeToPapelizWindowWidthChange(() => onLookPanelCloseRef.current())
    lookPanelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('keydown', closeOnEscape)
      stopWatchingWindowWidth()
    }
  }, [])

  const changeLook = (lookChanges: PapelizVaultEntryLook) => {
    const nextLook: PapelizVaultEntryLook = { ...currentLook, ...lookChanges }
    // The default icon is the same as none.
    if (nextLook.lookIconName === defaultIconName) delete nextLook.lookIconName
    if (nextLook.lookColor === undefined) delete nextLook.lookColor
    setVaultEntryLook(vaultEntryRelativePath, nextLook)
  }

  const swatchClassName =
    'grid size-7 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue pointer-coarse:size-9'
  const chosenSwatchRingClassName = 'shadow-[0_0_0_2px_var(--color-papeliz-surface),0_0_0_4px_var(--color-papeliz-blue)]'

  return createPortal(
    <div
      ref={lookPanelRef}
      role="dialog"
      aria-label={`Color and icon of ${vaultEntryDisplayName}`}
      className="papeliz-pop-enter fixed z-50 max-h-[calc(100dvh-16px)] w-[268px] overflow-y-auto overscroll-contain rounded-2xl border border-papeliz-line bg-papeliz-surface p-3 text-papeliz-ink shadow-papeliz-pop pointer-coarse:w-[300px]"
      style={{ left: clampedLookPanelPosition.menuAnchorLeft, top: clampedLookPanelPosition.menuAnchorTop }}
    >
      <p className="truncate text-[13px] font-semibold">{vaultEntryDisplayName}</p>

      <p className="mt-2.5 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Color</p>
      <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          role="radio"
          aria-checked={currentLook.lookColor === undefined}
          aria-label="No color"
          title="No color"
          onClick={() => changeLook({ lookColor: undefined })}
          className={joinPapelizClassNames(swatchClassName, 'bg-papeliz-surface-gray text-papeliz-ink-muted', currentLook.lookColor === undefined && chosenSwatchRingClassName)}
        >
          <Ban className="size-3.5" aria-hidden="true" />
        </button>
        {papelizVaultEntryLookColorNames.map((lookColorName) => (
          <button
            key={lookColorName}
            type="button"
            role="radio"
            aria-checked={currentLook.lookColor === lookColorName}
            aria-label={lookColorName}
            title={lookColorName[0]?.toUpperCase() + lookColorName.slice(1)}
            onClick={() => changeLook({ lookColor: lookColorName })}
            className={joinPapelizClassNames(swatchClassName, currentLook.lookColor === lookColorName && chosenSwatchRingClassName)}
            style={{ background: describePapelizVaultEntryLookColor(lookColorName) }}
          />
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isCustomColorChosen}
          aria-label="Your own color"
          title="Your own color"
          aria-expanded={isCustomColorPickerShown}
          onClick={() => setIsCustomColorPickerShown(!isCustomColorPickerShown)}
          className={joinPapelizClassNames(swatchClassName, 'bg-papeliz-surface-gray text-papeliz-ink-muted', isCustomColorChosen && chosenSwatchRingClassName)}
          style={isCustomColorChosen && currentLook.lookColor !== undefined ? { background: currentLook.lookColor, color: '#fff' } : undefined}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {isCustomColorPickerShown && (
        <div className="mt-2.5 rounded-xl bg-papeliz-surface-soft p-2">
          <PapelizColorPicker
            colorPickerLabel="Your own color"
            initialHexColor={isCustomColorChosen && currentLook.lookColor !== undefined ? currentLook.lookColor : '#0064d4'}
            chooseColorButtonLabel="Use"
            onColorChoose={(chosenHexColor) => {
              changeLook({ lookColor: chosenHexColor.toLowerCase() as `#${string}` })
              setIsCustomColorPickerShown(false)
            }}
          />
        </div>
      )}

      <p className="mt-3 mb-1.5 text-[12px] font-medium text-papeliz-ink-subtle">Icon</p>
      <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
        {(Object.entries(papelizVaultEntryLookIcons) as Array<[PapelizVaultEntryLookIconName, (typeof papelizVaultEntryLookIcons)[PapelizVaultEntryLookIconName]]>).map(
          ([lookIconName, LookIcon]) => {
            const isLookIconChosen = (currentLook.lookIconName ?? defaultIconName) === lookIconName
            return (
              <button
                key={lookIconName}
                type="button"
                role="radio"
                aria-checked={isLookIconChosen}
                aria-label={lookIconName.replace(/-/g, ' ')}
                title={lookIconName.replace(/-/g, ' ')}
                onClick={() => changeLook({ lookIconName })}
                className={joinPapelizClassNames(
                  'grid h-7 place-items-center rounded-lg transition-colors pointer-coarse:h-9',
                  isLookIconChosen ? 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink' : 'text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink',
                )}
                style={isLookIconChosen && currentLook.lookColor !== undefined ? { color: describePapelizVaultEntryLookColor(currentLook.lookColor) } : undefined}
              >
                <LookIcon className="size-4" aria-hidden="true" />
              </button>
            )
          },
        )}
      </div>

      <button
        type="button"
        disabled={vaultEntryLook === undefined}
        onClick={() => setVaultEntryLook(vaultEntryRelativePath, {})}
        className="mt-3 text-[12.5px] font-medium text-papeliz-blue hover:underline disabled:pointer-events-none disabled:opacity-40"
      >
        Reset to default
      </button>
    </div>,
    document.body,
  )
}
