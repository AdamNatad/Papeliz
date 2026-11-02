import type { ComponentProps } from 'react'
import { joinPapelizClassNames } from './papeliz-class-names'

type PapelizPillButtonVariant =
  | 'primary'
  | 'red-primary'
  | 'outline'
  | 'gray'
  | 'line'
  | 'on-topbar'
  | 'on-error-notice'
  | 'danger'
  | 'dialog-cancel'
  | 'dialog-confirm'
  | 'dialog-confirm-danger'
type PapelizPillButtonSize = 'small' | 'medium' | 'large'

// The main action's colors everywhere, the same as the website's account page Confirm and Cancel: solid
// blue, or solid red when it erases. The quieter choice beside it is white with an outline and turns soft blue when
// hovered. Buttons that aren't PapelizPillButton, such as New Vault's footer, share these too.
export const papelizMainActionButtonColorClassName =
  'bg-papeliz-gradient-start text-white shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(0_40_100/0.18)] enabled:hover:brightness-110'
export const papelizEraseActionButtonColorClassName =
  'bg-papeliz-diff-removed-ink text-papeliz-surface shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(100_20_20/0.18)] enabled:hover:brightness-110'
export const papelizOutlineButtonColorClassName =
  'border border-papeliz-line-strong bg-papeliz-surface text-papeliz-ink shadow-[0_1px_2px_rgb(16_24_40/0.08)] enabled:hover:border-papeliz-blue-line enabled:hover:bg-papeliz-blue-soft enabled:hover:text-papeliz-blue'

const papelizPillButtonVariantClassNames: Record<PapelizPillButtonVariant, string> = {
  primary: papelizMainActionButtonColorClassName,
  // The red equivalent of primary, for an action that erases, such as a proposal to move a note to the trash.
  'red-primary': papelizEraseActionButtonColorClassName,
  // The quieter choice beside a main action, outside a dialog.
  outline: papelizOutlineButtonColorClassName,
  'on-topbar': 'bg-white text-papeliz-gradient-start hover:bg-white/90 focus-visible:outline-white',
  gray: 'bg-papeliz-hover text-papeliz-ink hover:bg-papeliz-press',
  line: 'border border-papeliz-line-strong text-papeliz-ink hover:bg-papeliz-hover',
  // A button in a red error toast, such as Try again.
  'on-error-notice':
    'border border-papeliz-error-notice-line font-semibold text-papeliz-error-notice-ink hover:bg-papeliz-error-notice-line/15 focus-visible:outline-papeliz-error-notice-line',
  // For an action that erases something for good.
  danger: 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink hover:brightness-[.95]',
  // A dialog's buttons: Cancel, and the action.
  'dialog-cancel': papelizOutlineButtonColorClassName,
  'dialog-confirm': papelizMainActionButtonColorClassName,
  'dialog-confirm-danger': papelizEraseActionButtonColorClassName,
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
        'inline-flex flex-none items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,filter,transform] duration-150 ease-out active:scale-[.99] disabled:opacity-50',
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

type PapelizIconButtonTone = 'surface' | 'topbar' | 'error-notice'

const papelizIconButtonToneClassNames: Record<PapelizIconButtonTone, string> = {
  surface:
    'text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue aria-expanded:bg-papeliz-hover',
  topbar:
    'text-white/90 hover:bg-white/15 hover:text-white aria-pressed:bg-white/20 aria-pressed:text-white aria-expanded:bg-white/15 focus-visible:outline-white',
  'error-notice': 'text-papeliz-error-notice-ink/75 hover:bg-papeliz-error-notice-line/15 hover:text-papeliz-error-notice-ink',
}

interface PapelizIconButtonProps extends ComponentProps<'button'> {
  iconButtonLabel: string
  iconButtonSize?: PapelizIconButtonSize
  // `topbar` is for the blue bar: white icons, translucent white hover. `error-notice` is for a red
  // error toast.
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
