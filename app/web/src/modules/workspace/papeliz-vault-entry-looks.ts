import {
  Archive,
  BookOpen,
  Bookmark,
  Briefcase,
  Calendar,
  Camera,
  Code,
  Coffee,
  FileText,
  Flag,
  Flower2,
  Folder,
  GraduationCap,
  Heart,
  Inbox,
  Lightbulb,
  Map as MapIcon,
  Music,
  Puzzle,
  Rocket,
  Sprout,
  Star,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { isVaultRelativePathInsideFolder, replaceVaultRelativePathPrefix } from '../vault/papeliz-vault-relative-paths'

// A note's or folder's look in the file list: a color for its icon and name, and an icon of its own
// in place of the note or folder icon. Picked from the row's menu (Color and Icon). The looks travel
// with the vault, in `.papeliz/file-list-looks.json`:
//   { "about": "…", "fileListLooks": { "Projects": { "lookColor": "green", "lookIconName": "sprout" } } }

export const papelizFileListLooksFileName = 'file-list-looks.json'

// A named color (its shades for light and dark are the `--color-papeliz-look-*` tokens), or a custom
// `#rrggbb`.
export const papelizVaultEntryLookColorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'] as const
export type PapelizVaultEntryLookColorName = (typeof papelizVaultEntryLookColorNames)[number]

export const papelizVaultEntryLookIcons = {
  folder: Folder,
  'file-text': FileText,
  'book-open': BookOpen,
  bookmark: Bookmark,
  star: Star,
  heart: Heart,
  flag: Flag,
  inbox: Inbox,
  archive: Archive,
  lightbulb: Lightbulb,
  sprout: Sprout,
  flower: Flower2,
  briefcase: Briefcase,
  calendar: Calendar,
  code: Code,
  music: Music,
  camera: Camera,
  map: MapIcon,
  users: Users,
  'graduation-cap': GraduationCap,
  coffee: Coffee,
  rocket: Rocket,
  target: Target,
  puzzle: Puzzle,
} as const satisfies Record<string, LucideIcon>
export type PapelizVaultEntryLookIconName = keyof typeof papelizVaultEntryLookIcons

export interface PapelizVaultEntryLook {
  lookColor?: PapelizVaultEntryLookColorName | `#${string}`
  lookIconName?: PapelizVaultEntryLookIconName
}

// Each look by the note's or folder's path in the vault.
export type PapelizVaultEntryLooks = Readonly<Record<string, PapelizVaultEntryLook>>

const papelizCustomLookColorPattern = /^#[0-9a-f]{6}$/i

function isLookColor(lookColor: unknown): lookColor is NonNullable<PapelizVaultEntryLook['lookColor']> {
  return typeof lookColor === 'string' && ((papelizVaultEntryLookColorNames as readonly string[]).includes(lookColor) || papelizCustomLookColorPattern.test(lookColor))
}

function isLookIconName(lookIconName: unknown): lookIconName is PapelizVaultEntryLookIconName {
  return typeof lookIconName === 'string' && Object.hasOwn(papelizVaultEntryLookIcons, lookIconName)
}

// The CSS color a look's color names, for the icon and the name.
export function describePapelizVaultEntryLookColor(lookColor: NonNullable<PapelizVaultEntryLook['lookColor']>): string {
  return lookColor.startsWith('#') ? lookColor : `var(--color-papeliz-look-${lookColor})`
}

export function parsePapelizFileListLooksFile(fileListLooksFileText: string | null): Record<string, PapelizVaultEntryLook> {
  if (fileListLooksFileText === null) return {}
  let storedFileListLooks: unknown
  try {
    storedFileListLooks = (JSON.parse(fileListLooksFileText) as { fileListLooks?: unknown } | null)?.fileListLooks
  } catch {
    return {}
  }
  if (typeof storedFileListLooks !== 'object' || storedFileListLooks === null) return {}
  const vaultEntryLooks: Record<string, PapelizVaultEntryLook> = {}
  for (const [vaultEntryRelativePath, storedLook] of Object.entries(storedFileListLooks)) {
    if (typeof storedLook !== 'object' || storedLook === null) continue
    const { lookColor, lookIconName } = storedLook as Record<string, unknown>
    const vaultEntryLook: PapelizVaultEntryLook = {
      ...(isLookColor(lookColor) ? { lookColor } : {}),
      ...(isLookIconName(lookIconName) ? { lookIconName } : {}),
    }
    if (vaultEntryLook.lookColor !== undefined || vaultEntryLook.lookIconName !== undefined) vaultEntryLooks[vaultEntryRelativePath] = vaultEntryLook
  }
  return vaultEntryLooks
}

export function formatPapelizFileListLooksFile(vaultEntryLooks: PapelizVaultEntryLooks): string {
  return `${JSON.stringify({ about: 'The colors and icons of notes and folders in Papeliz’s file list.', fileListLooks: vaultEntryLooks }, null, 2)}\n`
}

// Sets one entry's look; an empty look takes the entry back to the default.
export function setPapelizVaultEntryLook(
  vaultEntryLooks: PapelizVaultEntryLooks,
  vaultEntryRelativePath: string,
  vaultEntryLook: PapelizVaultEntryLook,
): Record<string, PapelizVaultEntryLook> {
  const nextVaultEntryLooks = { ...vaultEntryLooks }
  if (vaultEntryLook.lookColor === undefined && vaultEntryLook.lookIconName === undefined) delete nextVaultEntryLooks[vaultEntryRelativePath]
  else nextVaultEntryLooks[vaultEntryRelativePath] = vaultEntryLook
  return nextVaultEntryLooks
}

// Keeps looks on entries that were renamed or moved, and on everything inside a moved folder.
export function carryVaultEntryLooksThroughMove(
  vaultEntryLooks: PapelizVaultEntryLooks,
  fromVaultEntryRelativePath: string,
  toVaultEntryRelativePath: string,
): Record<string, PapelizVaultEntryLook> {
  return Object.fromEntries(
    Object.entries(vaultEntryLooks).map(([vaultEntryRelativePath, vaultEntryLook]) => [
      replaceVaultRelativePathPrefix(vaultEntryRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath),
      vaultEntryLook,
    ]),
  )
}

// Drops the looks of an entry that went to the trash and of everything inside it.
export function removeVaultEntryLooksInside(vaultEntryLooks: PapelizVaultEntryLooks, removedVaultEntryRelativePath: string): Record<string, PapelizVaultEntryLook> {
  return Object.fromEntries(
    Object.entries(vaultEntryLooks).filter(([vaultEntryRelativePath]) => !isVaultRelativePathInsideFolder(vaultEntryRelativePath, removedVaultEntryRelativePath)),
  )
}
