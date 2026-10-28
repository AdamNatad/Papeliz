import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  joinVaultRelativePath,
  papelizVaultNoteFileExtension,
  pickFreeVaultEntryName,
  replaceVaultRelativePathPrefix,
} from '../vault/papeliz-vault-relative-paths'
import { papelizChatSessionsFolderName, papelizEarlierChatSessionsFolderNames, parsePapelizChatSessionFile } from './papeliz-assistant-chat-session-files'

// Moves saved chats out of the folders Papeliz used before (`.chatsession`, and before it the
// visible "Chat Sessions") into `.csessions`, so they leave the file list. Only notes that are saved
// chats move. A folder holding nothing but chats is renamed whole when `.csessions` isn't there yet;
// otherwise its chats move one by one, and a folder they leave empty goes to the vault's trash, so
// nothing is erased. Gives back where each chat went, by its earlier path.
export async function movePapelizEarlierChatSessionsIntoChatSessionsFolder(papelizVaultAdapter: PapelizVaultAdapter): Promise<Map<string, string>> {
  const movedChatSessionPaths = new Map<string, string>()
  const vaultTreeEntries = await papelizVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true })
  const takenVaultEntryPaths = new Set(vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath.toLowerCase()))

  for (const earlierChatSessionsFolderName of papelizEarlierChatSessionsFolderNames) {
    const isEarlierFolderInVault = vaultTreeEntries.some(
      (vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'folder' && vaultTreeEntry.vaultEntryRelativePath === earlierChatSessionsFolderName,
    )
    if (!isEarlierFolderInVault) continue
    const vaultEntriesInEarlierFolder = vaultTreeEntries.filter((vaultTreeEntry) =>
      vaultTreeEntry.vaultEntryRelativePath.startsWith(`${earlierChatSessionsFolderName}/`),
    )
    const earlierChatSessionPaths: string[] = []
    for (const vaultEntryInEarlierFolder of vaultEntriesInEarlierFolder) {
      if (vaultEntryInEarlierFolder.vaultEntryKind !== 'note') continue
      if (getVaultEntryParentFolderRelativePath(vaultEntryInEarlierFolder.vaultEntryRelativePath) !== earlierChatSessionsFolderName) continue
      const earlierNoteText = await papelizVaultAdapter.readVaultNoteText(vaultEntryInEarlierFolder.vaultEntryRelativePath).catch(() => '')
      if (parsePapelizChatSessionFile(earlierNoteText) !== null) earlierChatSessionPaths.push(vaultEntryInEarlierFolder.vaultEntryRelativePath)
    }
    if (earlierChatSessionPaths.length === 0) continue

    const doesEarlierFolderHoldOnlyChats = vaultEntriesInEarlierFolder.length === earlierChatSessionPaths.length
    const isChatSessionsFolderMissing = !takenVaultEntryPaths.has(papelizChatSessionsFolderName.toLowerCase())
    if (doesEarlierFolderHoldOnlyChats && isChatSessionsFolderMissing) {
      await papelizVaultAdapter.renameVaultEntry(earlierChatSessionsFolderName, papelizChatSessionsFolderName)
      for (const earlierChatSessionPath of earlierChatSessionPaths) {
        const movedChatSessionPath = replaceVaultRelativePathPrefix(earlierChatSessionPath, earlierChatSessionsFolderName, papelizChatSessionsFolderName)
        movedChatSessionPaths.set(earlierChatSessionPath, movedChatSessionPath)
        takenVaultEntryPaths.add(movedChatSessionPath.toLowerCase())
      }
      takenVaultEntryPaths.add(papelizChatSessionsFolderName.toLowerCase())
      continue
    }

    if (isChatSessionsFolderMissing) {
      await papelizVaultAdapter.createVaultFolder(papelizChatSessionsFolderName)
      takenVaultEntryPaths.add(papelizChatSessionsFolderName.toLowerCase())
    }
    for (const earlierChatSessionPath of earlierChatSessionPaths) {
      const earlierChatSessionNoteName = getVaultEntryName(earlierChatSessionPath)
      const movedChatSessionNoteName = pickFreeVaultEntryName(getVaultNoteTitle(earlierChatSessionNoteName), papelizVaultNoteFileExtension, (candidateVaultEntryName) =>
        takenVaultEntryPaths.has(joinVaultRelativePath(papelizChatSessionsFolderName, candidateVaultEntryName).toLowerCase()),
      )
      const movedChatSessionPath = joinVaultRelativePath(papelizChatSessionsFolderName, movedChatSessionNoteName)
      await papelizVaultAdapter.renameVaultEntry(earlierChatSessionPath, movedChatSessionPath)
      movedChatSessionPaths.set(earlierChatSessionPath, movedChatSessionPath)
      takenVaultEntryPaths.add(movedChatSessionPath.toLowerCase())
    }
    if (doesEarlierFolderHoldOnlyChats) await papelizVaultAdapter.moveVaultEntryToTrash(earlierChatSessionsFolderName)
  }
  return movedChatSessionPaths
}
