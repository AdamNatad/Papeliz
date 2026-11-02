import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { PapelizHtmlExportStartingTheme } from '../html-export/papeliz-html-export-note-stylesheet'
import { PapelizColorPicker } from '../ui/papeliz-color-picker'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizNoteTextSizeSlider } from './papeliz-note-text-size-slider'
import type { PapelizNoteTypography } from './papeliz-note-typography-store'
import { papelizNoteColumnWidthChoices, papelizNoteFontFamilyChoices } from './papeliz-settings-gear-pages'

// Export › HTML's settings (papeliz-settings-gear-export-page.tsx), in the dialog HTML's gear opens:
// the theme the pages open in, the accent their links take, and their font, text size and width,
// which start as the Accessibility page's. Every change is kept at once.

export interface PapelizSettingsGearHtmlExportSettings {
  // Null: the Accessibility page's font, size and width, as they are when exporting.
  htmlExportNoteTypography: PapelizNoteTypography | null
  htmlExportStartingTheme: PapelizHtmlExportStartingTheme
  // Null: MD View's blue.
  htmlExportAccentHexColor: string | null
}

export const papelizDefaultSettingsGearHtmlExportSettings: PapelizSettingsGearHtmlExportSettings = {
  htmlExportNoteTypography: null,
  htmlExportStartingTheme: 'device',
  htmlExportAccentHexColor: null,
}

export const papelizSettingsGearHtmlExportStartingThemeChoices = [
  { htmlExportStartingTheme: 'light', startingThemeLabel: 'Light', StartingThemeIcon: Sun },
  { htmlExportStartingTheme: 'dark', startingThemeLabel: 'Dark', StartingThemeIcon: Moon },
  { htmlExportStartingTheme: 'device', startingThemeLabel: 'Device', StartingThemeIcon: Monitor },
] as const satisfies ReadonlyArray<{ htmlExportStartingTheme: PapelizHtmlExportStartingTheme; startingThemeLabel: string; StartingThemeIcon: typeof Sun }>

// MD View's blue in the light theme, where the color picker starts.
const papelizMdViewAccentHexColor = '#0064d4'

function PapelizHtmlExportSettingsLabel({ children, isFirstLabel = false }: { children: ReactNode; isFirstLabel?: boolean }) {
  return <p className={`${isFirstLabel ? '' : 'mt-3.5 '}mb-1.5 text-[12.5px] font-medium`}>{children}</p>
}

interface PapelizSettingsGearExportHtmlSettingsProps {
  htmlExportSettings: PapelizSettingsGearHtmlExportSettings
  onHtmlExportSettingsChange: (changedHtmlExportSettings: PapelizSettingsGearHtmlExportSettings) => void
  // The Accessibility page's text settings, which the pages use until they get their own.
  accessibilityNoteTypography: PapelizNoteTypography
}

export function PapelizSettingsGearExportHtmlSettings({ htmlExportSettings, onHtmlExportSettingsChange, accessibilityNoteTypography }: PapelizSettingsGearExportHtmlSettingsProps) {
  const [isAccentColorPickerShown, setIsAccentColorPickerShown] = useState(false)
  const shownNoteTypography = htmlExportSettings.htmlExportNoteTypography ?? accessibilityNoteTypography
  const changeHtmlExportSettings = (changedSettings: Partial<PapelizSettingsGearHtmlExportSettings>) => onHtmlExportSettingsChange({ ...htmlExportSettings, ...changedSettings })
  // The first text change copies the Accessibility page's settings, so the others keep their values.
  const changeHtmlExportNoteTypography = (noteTypographyChanges: Partial<PapelizNoteTypography>) =>
    changeHtmlExportSettings({ htmlExportNoteTypography: { ...shownNoteTypography, ...noteTypographyChanges } })
  const accentHexColor = htmlExportSettings.htmlExportAccentHexColor

  return (
    <div>
      <PapelizHtmlExportSettingsLabel isFirstLabel>Theme</PapelizHtmlExportSettingsLabel>
      <PapelizSlidingChoiceGroup<PapelizHtmlExportStartingTheme>
        slidingChoiceGroupLabel="Theme"
        slidingChoiceGroupRole="radiogroup"
        chosenSlidingChoiceValue={htmlExportSettings.htmlExportStartingTheme}
        onSlidingChoiceSelect={(chosenStartingTheme) => changeHtmlExportSettings({ htmlExportStartingTheme: chosenStartingTheme })}
        slidingChoices={papelizSettingsGearHtmlExportStartingThemeChoices.map((startingThemeChoice) => ({
          slidingChoiceValue: startingThemeChoice.htmlExportStartingTheme,
          slidingChoiceContent: (
            <>
              <startingThemeChoice.StartingThemeIcon className="size-3.5" aria-hidden="true" />
              {startingThemeChoice.startingThemeLabel}
            </>
          ),
        }))}
      />
      <p className="mt-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">The pages open in it. A website’s readers can still switch it.</p>

      <PapelizHtmlExportSettingsLabel>Accent Color</PapelizHtmlExportSettingsLabel>
      <div className="flex items-center gap-2.5 rounded-xl border border-papeliz-line bg-papeliz-surface px-3 py-2">
        <span aria-hidden="true" className="size-5 flex-none rounded-full border border-black/10" style={{ background: accentHexColor ?? papelizMdViewAccentHexColor }} />
        <span className="min-w-0 flex-1 text-[13px]">
          {accentHexColor === null ? 'Papeliz Blue' : accentHexColor.toUpperCase()}
          <span className="block text-[11.5px] text-papeliz-ink-subtle">Links, tags and callouts</span>
        </span>
        {accentHexColor !== null && (
          <button
            type="button"
            onClick={() => {
              setIsAccentColorPickerShown(false)
              changeHtmlExportSettings({ htmlExportAccentHexColor: null })
            }}
            className="flex-none text-[12.5px] font-medium text-papeliz-blue hover:underline"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          aria-expanded={isAccentColorPickerShown}
          onClick={() => setIsAccentColorPickerShown(!isAccentColorPickerShown)}
          className="flex-none rounded-full border border-papeliz-line-strong bg-papeliz-surface px-3 py-1 text-[12.5px] font-medium transition-colors hover:bg-papeliz-hover"
        >
          {isAccentColorPickerShown ? 'Close' : 'Change'}
        </button>
      </div>
      {isAccentColorPickerShown && (
        <div className="mt-2 rounded-xl bg-papeliz-surface-soft p-2">
          <PapelizColorPicker
            colorPickerLabel="Accent Color"
            initialHexColor={accentHexColor ?? papelizMdViewAccentHexColor}
            chooseColorButtonLabel="Use"
            onColorChoose={(chosenHexColor) => {
              setIsAccentColorPickerShown(false)
              changeHtmlExportSettings({ htmlExportAccentHexColor: chosenHexColor.toLowerCase() })
            }}
          />
        </div>
      )}

      <PapelizHtmlExportSettingsLabel>Font</PapelizHtmlExportSettingsLabel>
      <PapelizSlidingChoiceGroup
        slidingChoiceGroupLabel="Font"
        slidingChoiceGroupRole="radiogroup"
        chosenSlidingChoiceValue={shownNoteTypography.noteFontFamily}
        onSlidingChoiceSelect={(chosenNoteFontFamily) => changeHtmlExportNoteTypography({ noteFontFamily: chosenNoteFontFamily })}
        slidingChoices={papelizNoteFontFamilyChoices.map((fontChoice) => ({
          slidingChoiceValue: fontChoice.noteFontFamily,
          slidingChoiceContent: fontChoice.fontChoiceLabel,
          slidingChoiceClassName: fontChoice.fontChoiceFontClassName,
        }))}
      />

      <PapelizHtmlExportSettingsLabel>Text Size</PapelizHtmlExportSettingsLabel>
      <PapelizNoteTextSizeSlider chosenNoteFontSize={shownNoteTypography.noteFontSize} onNoteFontSizeChoose={(chosenNoteFontSize) => changeHtmlExportNoteTypography({ noteFontSize: chosenNoteFontSize })} />

      <PapelizHtmlExportSettingsLabel>Text Width</PapelizHtmlExportSettingsLabel>
      <PapelizSlidingChoiceGroup
        slidingChoiceGroupLabel="Text Width"
        slidingChoiceGroupRole="radiogroup"
        chosenSlidingChoiceValue={shownNoteTypography.noteColumnWidth}
        onSlidingChoiceSelect={(chosenNoteColumnWidth) => changeHtmlExportNoteTypography({ noteColumnWidth: chosenNoteColumnWidth })}
        slidingChoices={papelizNoteColumnWidthChoices.map((widthChoice) => ({
          slidingChoiceValue: widthChoice.noteColumnWidth,
          slidingChoiceContent: widthChoice.widthChoiceLabel,
        }))}
      />
      <button
        type="button"
        disabled={htmlExportSettings.htmlExportNoteTypography === null}
        title="Font, text size and text width as on the Accessibility page"
        onClick={() => changeHtmlExportSettings({ htmlExportNoteTypography: null })}
        className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-papeliz-blue hover:underline disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Use My Accessibility Text
      </button>
    </div>
  )
}
