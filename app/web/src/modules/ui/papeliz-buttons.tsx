import type { ComponentProps } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

type PapelizPillButtonVariant = 'primary' | 'red-primary' | 'gray' | 'line' | 'on-topbar' | 'danger'
type PapelizPillButtonSize = 'small' | 'medium' | 'large'

const papelizPillButtonVariantClassNames: Record<PapelizPillButtonVariant, string> = {
  primary: 'bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white hover:brightness-[.94]',
  // The red equivalent of primary: Cancel in dialogs.
  'red-primary': 'bg-linear-to-r from-papeliz-red-gradient-start to-papeliz-red-gradient-end text-white hover:brightness-[.94]',
  'on-topbar': 'bg-white text-papeliz-gradient-start hover:bg-white/90 focus-visible:outline-white',
  gray: 'bg-papeliz-hover text-papeliz-ink hover:bg-papeliz-press',
  line: 'border border-papeliz-line-strong text-papeliz-ink hover:bg-papeliz-hover',
  // For an action that erases something for good.
  danger: 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink hover:brightness-[.95]',
}

const papelizPillButtonSizeClassNames: Record<PapelizPillButtonSize, string> = {
  small: 'h-[30px] px-3 text-[13px] gap-1.5',
  medium: 'h-9 px-4 text-sm gap-[7px]',
  large: 'h-12 px-[22px] text-[15px] gap-2',
}

interface PapelizPillButtonProps extends ComponentProps<'button'> {
  pillButtonVariant?: PapelizPillButtonVariant
  pillButtonSize?: PapelizPillButtonSize
}

// The fully rounded pill button of the blue-and-white look.
export function PapelizPillButton({
  pillButtonVariant = 'gray',
  pillButtonSize = 'medium',
  className,
  type = 'button',
  ...buttonProps
}: PapelizPillButtonProps) {
  return (
    <button
      type={type}
      className={joinPapelizClassNames(
        'inline-flex flex-none items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,filter,transform] duration-150 ease-out active:scale-[.97] disabled:opacity-50',
        papelizPillButtonVariantClassNames[pillButtonVariant],
        papelizPillButtonSizeClassNames[pillButtonSize],
        className,
      )}
      {...buttonProps}
    />
  )
}

type PapelizIconButtonSize = 'extra-small' | 'small' | 'medium'

const papelizIconButtonSizeClassNames: Record<PapelizIconButtonSize, string> = {
  'extra-small': 'size-[22px]',
  small: 'size-7',
  medium: 'size-[34px]',
}

type PapelizIconButtonTone = 'surface' | 'topbar'

const papelizIconButtonToneClassNames: Record<PapelizIconButtonTone, string> = {
  surface:
    'text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue aria-expanded:bg-papeliz-hover',
  topbar:
    'text-white/90 hover:bg-white/15 hover:text-white aria-pressed:bg-white/20 aria-pressed:text-white aria-expanded:bg-white/15 focus-visible:outline-white',
}

interface PapelizIconButtonProps extends ComponentProps<'button'> {
  iconButtonLabel: string
  iconButtonSize?: PapelizIconButtonSize
  // `topbar` is for the blue bar: white icons, translucent white hover.
  iconButtonTone?: PapelizIconButtonTone
}

// A round icon-only button. `iconButtonLabel` is its accessible name and its tooltip.
export function PapelizIconButton({
  iconButtonLabel,
  iconButtonSize = 'medium',
  iconButtonTone = 'surface',
  className,
  type = 'button',
  title,
  ...buttonProps
}: PapelizIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={iconButtonLabel}
      title={title ?? iconButtonLabel}
      className={joinPapelizClassNames(
        'grid flex-none place-items-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[.94] disabled:opacity-50',
        papelizIconButtonToneClassNames[iconButtonTone],
        papelizIconButtonSizeClassNames[iconButtonSize],
        className,
      )}
      {...buttonProps}
    />
  )
}
