import { getVaultEntryName, getVaultNoteTitle, isVaultRelativePathInsideFolder } from '../vault/papeliz-vault-relative-paths'

// What the AI Assistant sees besides what it looks up: the box's "sees" menu, kept with the
// conversation (papeliz-assistant-chat-session-files.ts).
// - `active-note`: This Note, the note open in front.
// - `open-notes`: Open Notes, every note open in a tab.
// - `selected-notes`: Selected Notes…, the notes picked from the list.
// - `folder`: A Folder…, every note in one folder and its subfolders.
// - `whole-vault`: Whole Vault, no note's text: it searches and reads with its tools.
export type PapelizAssistantContextMode = 'active-note' | 'open-notes' | 'selected-notes' | 'folder' | 'whole-vault'

export const papelizAssistantContextModes: readonly PapelizAssistantContextMode[] = ['active-note', 'open-notes', 'selected-notes', 'folder', 'whole-vault']

export function isPapelizAssistantContextMode(contextModeText: string): contextModeText is PapelizAssistantContextMode {
  return (papelizAssistantContextModes as readonly string[]).includes(contextModeText)
}

export interface PapelizAssistantContextChoice {
  assistantContextMode: PapelizAssistantContextMode
  // Selected Notes…'s notes, in the order picked.
  contextSelectedNoteRelativePaths: readonly string[]
  // A Folder…'s folder.
  contextFolderRelativePath: string | null
}

export const papelizDefaultAssistantContextChoice: PapelizAssistantContextChoice = {
  assistantContextMode: 'active-note',
  contextSelectedNoteRelativePaths: [],
  contextFolderRelativePath: null,
}

// What the workspace has, to tell which notes a choice covers.
export interface PapelizAssistantContextWorkspaceReading {
  activeVaultMarkdownNoteRelativePath: string | null
  openNoteTabMarkdownNoteRelativePaths: readonly string[]
  // Every note in the vault.
  vaultNoteRelativePaths: readonly string[]
}

// The notes a choice puts in the request, in order; Whole Vault puts none (its tools find them). Notes
// picked or opened that are gone from the vault are left out.
export function listPapelizAssistantContextNoteRelativePaths(assistantContextChoice: PapelizAssistantContextChoice, workspaceReading: PapelizAssistantContextWorkspaceReading): string[] {
  const vaultNoteRelativePathSet = new Set(workspaceReading.vaultNoteRelativePaths)
  switch (assistantContextChoice.assistantContextMode) {
    case 'active-note':
      return workspaceReading.activeVaultMarkdownNoteRelativePath === null ? [] : [workspaceReading.activeVaultMarkdownNoteRelativePath]
    case 'open-notes':
      return workspaceReading.openNoteTabMarkdownNoteRelativePaths.filter((vaultNoteRelativePath) => vaultNoteRelativePathSet.has(vaultNoteRelativePath))
    case 'selected-notes':
      return assistantContextChoice.contextSelectedNoteRelativePaths.filter((vaultNoteRelativePath) => vaultNoteRelativePathSet.has(vaultNoteRelativePath))
    case 'folder': {
      const contextFolderRelativePath = assistantContextChoice.contextFolderRelativePath
      if (contextFolderRelativePath === null) return []
      return workspaceReading.vaultNoteRelativePaths.filter((vaultNoteRelativePath) => isVaultRelativePathInsideFolder(vaultNoteRelativePath, contextFolderRelativePath))
    }
    case 'whole-vault':
      return []
  }
}

// The button's words: "This Note", "Open Notes", "3 Notes", the folder's name, "Whole Vault".
export function describePapelizAssistantContextChoiceButtonWords(assistantContextChoice: PapelizAssistantContextChoice, contextNoteCount: number): string {
  switch (assistantContextChoice.assistantContextMode) {
    case 'active-note':
      return 'This Note'
    case 'open-notes':
      return 'Open Notes'
    case 'selected-notes':
      return contextNoteCount === 1 ? '1 Note' : `${contextNoteCount} Notes`
    case 'folder':
      return assistantContextChoice.contextFolderRelativePath === null ? 'A Folder' : getVaultEntryName(assistantContextChoice.contextFolderRelativePath)
    case 'whole-vault':
      return 'Whole Vault'
  }
}

// What a message is about, over it in the conversation ("About Project Hub", "About 3 notes"), or null
// when it sees no note's text.
export function describePapelizAssistantContextChoiceAboutLabel(assistantContextChoice: PapelizAssistantContextChoice, contextNoteRelativePaths: readonly string[]): string | null {
  if (assistantContextChoice.assistantContextMode === 'whole-vault' || contextNoteRelativePaths.length === 0) return null
  if (assistantContextChoice.assistantContextMode === 'folder' && assistantContextChoice.contextFolderRelativePath !== null) return getVaultEntryName(assistantContextChoice.contextFolderRelativePath)
  if (contextNoteRelativePaths.length === 1) return getVaultNoteTitle(contextNoteRelativePaths[0]!)
  return assistantContextChoice.assistantContextMode === 'open-notes' ? `${contextNoteRelativePaths.length} open notes` : `${contextNoteRelativePaths.length} notes`
}

// The button's hover: what is included ("Sees 3 notes: Project Hub, Inbox, Meeting Notes 2026-11-02").
export function describePapelizAssistantContextChoiceTooltip(assistantContextChoice: PapelizAssistantContextChoice, contextNoteRelativePaths: readonly string[]): string {
  if (assistantContextChoice.assistantContextMode === 'whole-vault') return 'Sees the whole vault: it searches and reads notes as it needs them.'
  if (contextNoteRelativePaths.length === 0) {
    return assistantContextChoice.assistantContextMode === 'active-note' ? 'Sees the note in front, once one is open.' : 'Sees no note yet: choose some.'
  }
  const shownNoteTitles = contextNoteRelativePaths.slice(0, 6).map(getVaultNoteTitle)
  const moreNoteWords = contextNoteRelativePaths.length > shownNoteTitles.length ? `, and ${contextNoteRelativePaths.length - shownNoteTitles.length} more` : ''
  const noteCountWords = contextNoteRelativePaths.length === 1 ? '1 note' : `${contextNoteRelativePaths.length} notes`
  return `Sees ${noteCountWords}: ${shownNoteTitles.join(', ')}${moreNoteWords}.`
}
