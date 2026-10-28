import { useCallback, useMemo } from 'react'
import { createPapelizWikilinkTargetResolver, type PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// Opening `[[links]]` from anywhere outside the note itself (the assistant's answers, Backlinks):
// a link to an existing note opens it, a link to a missing note creates it.
export function usePapelizVaultWikilinkActivation(): {
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  activateWikilink: (wikilinkTargetNoteName: string) => void
  activateRelativeNoteLink: (linkHref: string) => void
} {
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const openOrCreateVaultNoteForWikilinkTarget = usePapelizWorkspaceStore((workspaceState) => workspaceState.openOrCreateVaultNoteForWikilinkTarget)
  const resolveWikilinkTarget = useMemo(
    () =>
      createPapelizWikilinkTargetResolver(
        vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
      ),
    [vaultTreeEntries],
  )
  const activateWikilink = useCallback(
    (wikilinkTargetNoteName: string) =>
      void openOrCreateVaultNoteForWikilinkTarget(resolveWikilinkTarget(wikilinkTargetNoteName, activeVaultNoteRelativePath), wikilinkTargetNoteName),
    [activeVaultNoteRelativePath, openOrCreateVaultNoteForWikilinkTarget, resolveWikilinkTarget],
  )
  const activateRelativeNoteLink = useCallback(
    (linkHref: string) => activateWikilink(decodeURIComponent(linkHref.split('#')[0] ?? '')),
    [activateWikilink],
  )
  return { resolveWikilinkTarget, activateWikilink, activateRelativeNoteLink }
}
