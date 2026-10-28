import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Joins Tailwind class names; when two classes set the same thing, the later one wins.
export function joinPapelizClassNames(...papelizClassValues: ClassValue[]): string {
  return twMerge(clsx(papelizClassValues))
}
