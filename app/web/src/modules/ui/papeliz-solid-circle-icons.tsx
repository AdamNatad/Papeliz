import type { ComponentProps } from 'react'

// Solid circle icons for a button on a solid ground, where a line icon reads thin: a filled disc with
// the mark cut out. They take the text color, and their size from className.

export function PapelizSolidCircleXIcon(solidCircleIconProps: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...solidCircleIconProps}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zM8.47 8.47a.75.75 0 0 1 1.06 0L12 10.94l2.47-2.47a.75.75 0 1 1 1.06 1.06L13.06 12l2.47 2.47a.75.75 0 1 1-1.06 1.06L12 13.06l-2.47 2.47a.75.75 0 0 1-1.06-1.06L10.94 12 8.47 9.53a.75.75 0 0 1 0-1.06z"
      />
    </svg>
  )
}

export function PapelizSolidCircleCheckIcon(solidCircleIconProps: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...solidCircleIconProps}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm5.03 6.97a.75.75 0 0 0-1.06 0l-5.47 5.47-2.47-2.47a.75.75 0 1 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l6-6a.75.75 0 0 0 0-1.06z"
      />
    </svg>
  )
}
