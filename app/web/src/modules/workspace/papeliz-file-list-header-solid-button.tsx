import type { ComponentProps } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'

interface PapelizFileListHeaderSolidButtonProps extends ComponentProps<'button'> {
  // Its accessible name and its tooltip.
  fileListHeaderSolidButtonLabel: string
}

// New and Import in the file list's header: the previewer's solid square (a white icon, a thin darker
// edge, a soft top highlight) in the main buttons' blue, the same in both themes. Darker while hovered
// or while its menu is open.
export function PapelizFileListHeaderSolidButton({ fileListHeaderSolidButtonLabel, className, type = 'button', ...buttonProps }: PapelizFileListHeaderSolidButtonProps) {
  return (
    <button
      type={type}
      aria-label={fileListHeaderSolidButtonLabel}
      title={fileListHeaderSolidButtonLabel}
      className={joinPapelizClassNames(
        'grid size-7 flex-none place-items-center rounded-md border border-[#0057ba] bg-papeliz-gradient-start text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[background-color,transform] duration-150 hover:bg-[#0057ba] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue active:scale-[0.94] disabled:opacity-50 aria-expanded:bg-[#0057ba]',
        className,
      )}
      {...buttonProps}
    />
  )
}
