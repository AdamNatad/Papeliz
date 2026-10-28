import { useState, type CSSProperties } from 'react'
import { convertHexColorToHsl, convertHslToHexColor, parsePapelizHexColor, type PapelizHslColor } from './papeliz-color-values'

interface PapelizColorPickerProps {
  colorPickerLabel: string
  initialHexColor: string
  chooseColorButtonLabel: string
  onColorChoose: (hexColor: string) => void
}

// The shade slider runs from a light tint to a deep tone of the hue, never to black or gray.
const papelizColorPickerLightestShade = 82
const papelizColorPickerDeepestShade = 28

// Any color, picked by its hue and its shade (light to deep), with a preview of the color as text
// and as a card, and its hex value to type or copy. "Use" hands the color back.
export function PapelizColorPicker({ colorPickerLabel, initialHexColor, chooseColorButtonLabel, onColorChoose }: PapelizColorPickerProps) {
  const [pickedHslColor, setPickedHslColor] = useState<PapelizHslColor>(() => {
    const initialHslColor = convertHexColorToHsl(initialHexColor)
    // Grays and near-blacks start on a lively hue instead.
    return initialHslColor.colorSaturation < 20 ? { colorHue: 262, colorSaturation: 75, colorLightness: 52 } : initialHslColor
  })
  const pickedHexColor = convertHslToHexColor(pickedHslColor)
  const [typedHexColor, setTypedHexColor] = useState(pickedHexColor)
  const sliderSaturation = Math.max(55, pickedHslColor.colorSaturation)

  const pickColor = (nextHslColor: PapelizHslColor) => {
    setPickedHslColor(nextHslColor)
    setTypedHexColor(convertHslToHexColor(nextHslColor))
  }

  const hueTrackStyle: CSSProperties = {
    background: `linear-gradient(to right, ${[0, 45, 90, 135, 180, 225, 270, 315, 360].map((trackHue) => `hsl(${trackHue} ${sliderSaturation}% 52%)`).join(', ')})`,
    ['--papeliz-color-picker-thumb' as string]: `hsl(${Math.round(pickedHslColor.colorHue)} ${sliderSaturation}% 52%)`,
  }
  const shadeTrackStyle: CSSProperties = {
    background: `linear-gradient(to right, hsl(${Math.round(pickedHslColor.colorHue)} ${sliderSaturation}% ${papelizColorPickerLightestShade}%), hsl(${Math.round(pickedHslColor.colorHue)} ${sliderSaturation}% 52%), hsl(${Math.round(pickedHslColor.colorHue)} ${sliderSaturation}% ${papelizColorPickerDeepestShade}%))`,
    ['--papeliz-color-picker-thumb' as string]: pickedHexColor,
  }

  return (
    <div role="group" aria-label={colorPickerLabel} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 rounded-xl bg-papeliz-surface px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]">
        <span aria-hidden="true" className="size-7 flex-none rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" style={{ background: pickedHexColor }} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: pickedHexColor }}>
          Sample text
        </span>
        <span
          aria-hidden="true"
          className="h-6 w-12 flex-none rounded-md"
          style={{ background: `color-mix(in oklab, ${pickedHexColor} 18%, var(--color-papeliz-surface))`, boxShadow: `inset 3px 0 0 ${pickedHexColor}` }}
        />
      </div>
      <label className="flex flex-col gap-1 text-[11.5px] font-medium text-papeliz-ink-subtle">
        Hue
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.round(pickedHslColor.colorHue)}
          onChange={(changeEvent) => pickColor({ ...pickedHslColor, colorHue: Number(changeEvent.target.value), colorSaturation: sliderSaturation })}
          onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
          className="papeliz-color-picker-slider"
          style={hueTrackStyle}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11.5px] font-medium text-papeliz-ink-subtle">
        Shade
        <input
          type="range"
          min={papelizColorPickerDeepestShade}
          max={papelizColorPickerLightestShade}
          step={1}
          // Light on the left, deep on the right.
          value={papelizColorPickerLightestShade + papelizColorPickerDeepestShade - Math.round(Math.min(papelizColorPickerLightestShade, Math.max(papelizColorPickerDeepestShade, pickedHslColor.colorLightness)))}
          onChange={(changeEvent) =>
            pickColor({
              ...pickedHslColor,
              colorSaturation: sliderSaturation,
              colorLightness: papelizColorPickerLightestShade + papelizColorPickerDeepestShade - Number(changeEvent.target.value),
            })
          }
          onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
          className="papeliz-color-picker-slider"
          style={shadeTrackStyle}
        />
      </label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Hex color"
          spellCheck={false}
          value={typedHexColor}
          onChange={(changeEvent) => {
            setTypedHexColor(changeEvent.target.value)
            const typedColor = parsePapelizHexColor(changeEvent.target.value)
            if (typedColor !== null) setPickedHslColor(convertHexColorToHsl(typedColor))
          }}
          onKeyDown={(keyboardEvent) => {
            keyboardEvent.stopPropagation()
            if (keyboardEvent.key === 'Enter') onColorChoose(pickedHexColor)
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-papeliz-line-strong bg-papeliz-surface px-2.5 font-mono text-[12.5px] text-papeliz-ink focus:border-papeliz-blue-line focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onColorChoose(pickedHexColor)}
          className="h-8 flex-none rounded-lg bg-papeliz-blue px-3.5 text-[12.5px] font-semibold text-white transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue"
        >
          {chooseColorButtonLabel}
        </button>
      </div>
    </div>
  )
}
