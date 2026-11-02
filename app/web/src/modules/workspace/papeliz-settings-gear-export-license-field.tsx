import { ChevronDown } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  filterPapelizTemplateExportLicensePresets,
  findPapelizTemplateExportLicensePreset,
  type PapelizTemplateExportLicensePreset,
} from '../template-gallery/papeliz-template-export-licenses'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

// Template Settings' License (papeliz-settings-gear-export-template-settings.tsx): a box to type any
// license in, with a list of well-known ones under it. Hovering or moving to one shows what it lets
// others do in a dark bubble under it; the bubble is drawn inside the dialog, since a modal dialog
// covers anything drawn on the page.

interface PapelizSettingsGearExportLicenseFieldProps {
  typedTemplateLicenseText: string
  onTemplateLicenseTextChange: (changedTemplateLicenseText: string) => void
}

export function PapelizSettingsGearExportLicenseField({ typedTemplateLicenseText, onTemplateLicenseTextChange }: PapelizSettingsGearExportLicenseFieldProps) {
  const licenseFieldIdPrefix = useId()
  const licenseFieldRef = useRef<HTMLDivElement>(null)
  const [isLicenseListOpen, setIsLicenseListOpen] = useState(false)
  const [highlightedLicenseIndex, setHighlightedLicenseIndex] = useState(-1)
  // The license whose bubble shows, and how far below the field's top it sits.
  const [shownLicenseTooltip, setShownLicenseTooltip] = useState<{ licensePreset: PapelizTemplateExportLicensePreset; licenseTooltipTopPx: number } | null>(null)
  const shownLicensePresets = filterPapelizTemplateExportLicensePresets(typedTemplateLicenseText)
  const chosenLicensePreset = findPapelizTemplateExportLicensePreset(typedTemplateLicenseText)

  const showLicenseTooltipUnder = (licenseOptionElement: HTMLElement, licensePreset: PapelizTemplateExportLicensePreset) => {
    const licenseFieldElement = licenseFieldRef.current
    if (licenseFieldElement === null) return
    setShownLicenseTooltip({ licensePreset, licenseTooltipTopPx: licenseOptionElement.getBoundingClientRect().bottom - licenseFieldElement.getBoundingClientRect().top + 4 })
  }
  const chooseLicensePreset = (licensePreset: PapelizTemplateExportLicensePreset) => {
    onTemplateLicenseTextChange(licensePreset.templateLicenseDisplayName)
    setIsLicenseListOpen(false)
    setShownLicenseTooltip(null)
  }
  const handleLicenseFieldKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault()
      setIsLicenseListOpen(true)
      const nextLicenseIndex =
        keyboardEvent.key === 'ArrowDown' ? Math.min(shownLicensePresets.length - 1, highlightedLicenseIndex + 1) : Math.max(0, highlightedLicenseIndex - 1)
      setHighlightedLicenseIndex(nextLicenseIndex)
      const nextLicenseOptionElement = document.getElementById(`${licenseFieldIdPrefix}-option-${nextLicenseIndex}`)
      const nextLicensePreset = shownLicensePresets[nextLicenseIndex]
      if (nextLicenseOptionElement !== null && nextLicensePreset !== undefined) {
        nextLicenseOptionElement.scrollIntoView({ block: 'nearest' })
        showLicenseTooltipUnder(nextLicenseOptionElement, nextLicensePreset)
      }
    } else if (keyboardEvent.key === 'Enter' && isLicenseListOpen) {
      const highlightedLicensePreset = shownLicensePresets[highlightedLicenseIndex]
      keyboardEvent.preventDefault()
      if (highlightedLicensePreset !== undefined) chooseLicensePreset(highlightedLicensePreset)
      else setIsLicenseListOpen(false)
    } else if (keyboardEvent.key === 'Escape' && isLicenseListOpen) {
      // Only the list closes; the dialog stays.
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      setIsLicenseListOpen(false)
      setShownLicenseTooltip(null)
    }
  }

  return (
    <div ref={licenseFieldRef} className="relative">
      <div className="relative mt-1.5">
        <input
          id={`${licenseFieldIdPrefix}-input`}
          type="text"
          role="combobox"
          aria-label="License"
          aria-expanded={isLicenseListOpen}
          aria-controls={`${licenseFieldIdPrefix}-list`}
          aria-autocomplete="list"
          aria-activedescendant={isLicenseListOpen && highlightedLicenseIndex >= 0 ? `${licenseFieldIdPrefix}-option-${highlightedLicenseIndex}` : undefined}
          maxLength={80}
          placeholder="Pick one, or type your own"
          value={typedTemplateLicenseText}
          onFocus={() => setIsLicenseListOpen(true)}
          onChange={(changeEvent) => {
            onTemplateLicenseTextChange(changeEvent.target.value)
            setIsLicenseListOpen(true)
            setHighlightedLicenseIndex(-1)
            setShownLicenseTooltip(null)
          }}
          onBlur={() => {
            setIsLicenseListOpen(false)
            setShownLicenseTooltip(null)
          }}
          onKeyDown={handleLicenseFieldKeyDown}
          className="h-9 w-full rounded-full border border-papeliz-line-strong bg-papeliz-surface pr-9 pl-3.5 text-[13px] text-papeliz-ink placeholder:text-papeliz-ink-subtle"
        />
        <ChevronDown
          aria-hidden="true"
          className={joinPapelizClassNames('pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-papeliz-ink-muted transition-transform', isLicenseListOpen && 'rotate-180')}
        />
      </div>
      {isLicenseListOpen && shownLicensePresets.length > 0 && (
        <ul
          id={`${licenseFieldIdPrefix}-list`}
          role="listbox"
          aria-label="Licenses"
          onScroll={() => setShownLicenseTooltip(null)}
          className="mt-1 max-h-[220px] overflow-y-auto overscroll-contain rounded-2xl border border-papeliz-line bg-papeliz-surface p-1 [scrollbar-width:thin]"
        >
          {shownLicensePresets.map((licensePreset, licensePresetIndex) => (
            <li
              key={licensePreset.templateLicenseSpdxId}
              id={`${licenseFieldIdPrefix}-option-${licensePresetIndex}`}
              role="option"
              aria-selected={chosenLicensePreset?.templateLicenseSpdxId === licensePreset.templateLicenseSpdxId}
              // Keeps focus in the box, so choosing doesn't close the list first.
              onMouseDown={(mouseDownEvent) => mouseDownEvent.preventDefault()}
              onMouseEnter={(mouseEnterEvent) => {
                setHighlightedLicenseIndex(licensePresetIndex)
                showLicenseTooltipUnder(mouseEnterEvent.currentTarget, licensePreset)
              }}
              onMouseLeave={() => setShownLicenseTooltip(null)}
              onClick={() => chooseLicensePreset(licensePreset)}
              className={joinPapelizClassNames(
                'flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px]',
                licensePresetIndex === highlightedLicenseIndex ? 'bg-papeliz-hover' : 'hover:bg-papeliz-hover',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{licensePreset.templateLicenseDisplayName}</span>
              <span className="flex-none text-[11.5px] text-papeliz-ink-subtle">{licensePreset.templateLicenseSpdxId}</span>
            </li>
          ))}
        </ul>
      )}
      {isLicenseListOpen && shownLicenseTooltip !== null && (
        <div
          aria-hidden="true"
          style={{ top: shownLicenseTooltip.licenseTooltipTopPx }}
          className="papeliz-pop-enter pointer-events-none absolute right-2 left-2 z-20 rounded-lg bg-papeliz-ink px-2.5 py-1.5 text-[11.5px] leading-snug text-papeliz-surface shadow-papeliz-pop"
        >
          <b className="block font-semibold">{shownLicenseTooltip.licensePreset.templateLicenseDisplayName}</b>
          {shownLicenseTooltip.licensePreset.templateLicenseSummary}
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">
        {chosenLicensePreset !== undefined
          ? `${chosenLicensePreset.templateLicenseSummary} ${chosenLicensePreset.templateLicenseSpdxId === 'MIT' ? 'The .zip includes its LICENSE file.' : 'Add its LICENSE file before you submit.'}`
          : typedTemplateLicenseText.trim().length > 0
            ? 'Your own license. Add its text as a LICENSE file before you submit.'
            : 'Pick a license, or type the name of your own.'}
      </p>
    </div>
  )
}
