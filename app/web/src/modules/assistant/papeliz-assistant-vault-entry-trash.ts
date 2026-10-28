import { isVaultNoteFileName, isVaultRelativePathInsideFolder, isVaultRelativePathWritableByPapeliz } from '../vault/papeliz-vault-relative-paths'
import { findLockingVaultEntry } from '../workspace/papeliz-vault-entry-locks'
import { isPapelizChatSessionNotePath, papelizChatSessionsFolderName, papelizEarlierChatSessionsFolderNames } from './papeliz-assistant-chat-session-files'

// What the AI Assistant may move into the vault's `.trash` folder: notes and folders the user could
// change themself. Saved chats are never its to move, whatever else is allowed, and neither are
// hidden folders (`.trash` itself, `.papeliz`, `.git`) or anything a lock covers. Nothing is erased:
// a trashed note or folder can be moved back.

const papelizAssistantUntrashableFolderNames: readonly string[] = [papelizChatSessionsFolderName, ...papelizEarlierChatSessionsFolderNames]

// Why the AI Assistant may not move `vaultEntryRelativePath` to the trash, as a short Title Case tag
// ("Saved Chats"), or null when it may.
export function findPapelizAssistantVaultEntryTrashProblem(
  vaultEntryRelativePath: string,
  isWholeVaultEditingLocked: boolean,
  lockedVaultEntryRelativePaths: readonly string[],
): string | null {
  if (vaultEntryRelativePath.length === 0) return 'Whole Vault'
  const isSavedChatsFolderOrInside = papelizAssistantUntrashableFolderNames.some((untrashableFolderName) =>
    isVaultRelativePathInsideFolder(vaultEntryRelativePath, untrashableFolderName),
  )
  if (isSavedChatsFolderOrInside || isPapelizChatSessionNotePath(vaultEntryRelativePath)) return 'Saved Chats'
  if (!isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath)) return 'Hidden Folder'
  if (isWholeVaultEditingLocked) return 'All Notes Locked'
  const lockingVaultEntryRelativePath = findLockingVaultEntry(lockedVaultEntryRelativePaths, vaultEntryRelativePath)
  if (lockingVaultEntryRelativePath !== null) {
    return lockingVaultEntryRelativePath === vaultEntryRelativePath && isVaultNoteFileName(vaultEntryRelativePath) ? 'Note Locked' : 'Folder Locked'
  }
  if (lockedVaultEntryRelativePaths.some((lockedVaultEntryRelativePath) => isVaultRelativePathInsideFolder(lockedVaultEntryRelativePath, vaultEntryRelativePath))) {
    return 'Has Locked Notes'
  }
  return null
}

// The notes and folders a "whole vault" request means: everything at the top of the vault that the
// AI Assistant may move, so `.csessions`, `.trash` and other hidden folders stay.
export function listPapelizAssistantWholeVaultTrashEntries(
  vaultEntryRelativePaths: readonly string[],
  isWholeVaultEditingLocked: boolean,
  lockedVaultEntryRelativePaths: readonly string[],
): string[] {
  return vaultEntryRelativePaths.filter(
    (vaultEntryRelativePath) =>
      !vaultEntryRelativePath.includes('/') && findPapelizAssistantVaultEntryTrashProblem(vaultEntryRelativePath, isWholeVaultEditingLocked, lockedVaultEntryRelativePaths) === null,
  )
}

// Leaves out entries inside a folder that is also in the list, since moving the folder moves them.
export function keepOutermostPapelizVaultEntries(vaultEntryRelativePaths: readonly string[]): string[] {
  const uniqueVaultEntryRelativePaths = [...new Set(vaultEntryRelativePaths)]
  return uniqueVaultEntryRelativePaths.filter(
    (vaultEntryRelativePath) =>
      !uniqueVaultEntryRelativePaths.some(
        (otherVaultEntryRelativePath) => otherVaultEntryRelativePath !== vaultEntryRelativePath && isVaultRelativePathInsideFolder(vaultEntryRelativePath, otherVaultEntryRelativePath),
      ),
  )
}
