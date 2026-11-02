import type { ComponentProps } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

interface PapelizTopbarFrostedSquareButtonProps extends ComponentProps<'button'> {
  // Its accessible name and its tooltip.
  topbarFrostedSquareButtonLabel: string
}

// AI Assistant and Settings on the blue top bar: a square with a light white tint, a thin white edge
// and a white icon, the shape of the file list's New and Import. While its panel is open (pressed, or
// expanded) it turns solid white with a blue icon.
export function PapelizTopbarFrostedSquareButton({ topbarFrostedSquareButtonLabel, className, type = 'button', ...buttonProps }: PapelizTopbarFrostedSquareButtonProps) {
  return (
    <button
      type={type}
      aria-label={topbarFrostedSquareButtonLabel}
      title={topbarFrostedSquareButtonLabel}
      className={joinPapelizClassNames(
        'grid size-8 flex-none place-items-center rounded-[7px] border border-white/25 bg-white/15 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[background-color,border-color,color,transform] duration-150 ease-out hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[.94] aria-expanded:border-white aria-expanded:bg-white aria-expanded:text-papeliz-gradient-start aria-pressed:border-white aria-pressed:bg-white aria-pressed:text-papeliz-gradient-start',
        className,
      )}
      {...buttonProps}
    />
  )
}
