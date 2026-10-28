import { findPapelizVaultNoteBacklinks } from '../links/papeliz-vault-note-index'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import {
  describeVaultEntryNameProblem,
  isVaultNoteFileName,
  isVaultRelativePathWritableByPapeliz,
  papelizVaultNoteFileExtension,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { getPapelizVaultSearchClient, readLatestPapelizVaultNoteText, usePapelizVaultKnowledgeStore } from '../workspace/papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizChatToolCall, PapelizChatToolDefinition } from './papeliz-openai-compatible-client'
import { isPapelizChatSessionNotePath } from './papeliz-assistant-chat-session-files'
import {
  findPapelizAssistantVaultEntryTrashProblem,
  keepOutermostPapelizVaultEntries,
  listPapelizAssistantWholeVaultTrashEntries,
} from './papeliz-assistant-vault-entry-trash'
import { applyPapelizVaultNoteTextEdits, type PapelizVaultNoteTextEdit } from './papeliz-vault-note-text-edits'

// The tools the assistant can call. Four only look; three propose. A proposal changes nothing: it
// becomes a card the user accepts or rejects (papeliz-assistant-conversation-store.ts), unless the
// user turned on Bypass permission, when it applies at once.

export interface PapelizAssistantProposalDraft {
  assistantProposalKind: 'edit-note' | 'create-note' | 'trash-entries'
  // The note an edit or a new note is for; for 'trash-entries', the first entry.
  vaultNoteRelativePath: string
  proposalReason: string
  vaultNoteTextEdits: PapelizVaultNoteTextEdit[]
  newVaultNoteText: string
  // The note as it was when proposed, for the diff.
  originalVaultNoteText: string
  // For 'trash-entries': the notes and folders to move into `.trash`.
  trashedVaultEntryRelativePaths: string[]
}

export type PapelizAssistantToolActivityKind = 'searched' | 'read' | 'listed-links' | 'listed-notes' | 'proposed' | 'failed'

export interface PapelizAssistantToolOutcome {
  toolResultText: string
  toolActivityKind: PapelizAssistantToolActivityKind
  toolActivityLabel: string
  toolActivityVaultNoteRelativePaths: string[]
  proposalDraft: PapelizAssistantProposalDraft | null
}

const papelizReadVaultNoteCharacterLimit = 40_000
const papelizListedVaultNotesLimit = 400

export const papelizAssistantVaultToolDefinitions: PapelizChatToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'searchVaultNotes',
      description: 'Full-text search over every note in the vault. Returns each match’s path, title and a snippet around the match.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The words to look for.' },
          limit: { type: 'integer', description: 'Most results to return (default 8, at most 20).' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readVaultNote',
      description: 'Read the whole Markdown text of one note. Read a note before proposing changes to it.',
      parameters: {
        type: 'object',
        properties: { vaultNoteRelativePath: { type: 'string', description: 'The note’s path in the vault, for example "Projects/Garden plan.md".' } },
        required: ['vaultNoteRelativePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listVaultNoteLinks',
      description: 'For one note: the [[links]] it makes, the notes that link to it (backlinks), its tags and its headings.',
      parameters: {
        type: 'object',
        properties: { vaultNoteRelativePath: { type: 'string', description: 'The note’s path in the vault.' } },
        required: ['vaultNoteRelativePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listVaultNotes',
      description: 'List the notes in the vault (path, tags and how many links each makes).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposeVaultNoteEdit',
      description:
        'Propose changes to an existing note. Nothing changes until the user accepts the diff. Each edit replaces one exact passage: findText must appear exactly once in the note (quote enough of it to be unique) and replaceWithText takes its place. An empty findText adds replaceWithText at the end of the note.',
      parameters: {
        type: 'object',
        properties: {
          vaultNoteRelativePath: { type: 'string', description: 'The note’s path in the vault.' },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: { findText: { type: 'string' }, replaceWithText: { type: 'string' } },
              required: ['findText', 'replaceWithText'],
            },
          },
          reason: { type: 'string', description: 'One short sentence the user sees: why this change.' },
        },
        required: ['vaultNoteRelativePath', 'edits', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposeVaultNoteCreate',
      description: 'Propose a new note. Nothing is created until the user accepts.',
      parameters: {
        type: 'object',
        properties: {
          vaultNoteRelativePath: { type: 'string', description: 'Where the new note goes, ending in .md, for example "Ideas/Compost.md".' },
          noteText: { type: 'string', description: 'The new note’s Markdown.' },
          reason: { type: 'string', description: 'One short sentence the user sees: why this note.' },
        },
        required: ['vaultNoteRelativePath', 'noteText', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposeVaultEntriesTrash',
      description:
        'Propose deleting notes or folders: they move into the vault’s .trash folder, where the user can restore them; nothing is erased. Give their paths, or wholeVault true for everything in the vault. Saved chats (.csessions), hidden folders and locked notes are never moved, and are reported back as skipped.',
      parameters: {
        type: 'object',
        properties: {
          vaultEntryRelativePaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Notes ("Ideas/Compost.md") or folders ("Ideas") to move to the trash.',
          },
          wholeVault: { type: 'boolean', description: 'True to move everything in the vault to the trash.' },
          reason: { type: 'string', description: 'One short sentence the user sees: why delete these.' },
        },
        required: ['reason'],
      },
    },
  },
]

function readToolArguments(toolCall: PapelizChatToolCall): Record<string, unknown> {
  try {
    const toolArguments: unknown = JSON.parse(toolCall.function.arguments || '{}')
    return typeof toolArguments === 'object' && toolArguments !== null ? (toolArguments as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function readStringArgument(toolArguments: Record<string, unknown>, argumentName: string): string {
  const argumentValue = toolArguments[argumentName]
  return typeof argumentValue === 'string' ? argumentValue : ''
}

function failedToolOutcome(toolActivityLabel: string, toolProblem: string): PapelizAssistantToolOutcome {
  return {
    toolResultText: JSON.stringify({ error: toolProblem }),
    toolActivityKind: 'failed',
    toolActivityLabel: `${toolActivityLabel}: ${toolProblem}`,
    toolActivityVaultNoteRelativePaths: [],
    proposalDraft: null,
  }
}

// Accepts "Garden plan", "Garden plan.md" or a full path, and finds the note it means.
function resolveToolVaultNoteRelativePath(typedVaultNoteRelativePath: string): string | null {
  const vaultNoteRelativePaths = Object.keys(usePapelizVaultKnowledgeStore.getState().vaultNoteIndexEntriesByRelativePath)
  const cleanedVaultNoteRelativePath = typedVaultNoteRelativePath.trim().replace(/^\[\[|\]\]$/g, '')
  if (vaultNoteRelativePaths.includes(cleanedVaultNoteRelativePath)) return cleanedVaultNoteRelativePath
  return createPapelizWikilinkTargetResolver(vaultNoteRelativePaths)(cleanedVaultNoteRelativePath, null)
}

// Accepts a note or folder path as listed (with or without a trailing "/" or ".md"), or a note's name,
// and finds the vault entry it means.
function resolveToolVaultEntryRelativePath(typedVaultEntryRelativePath: string, vaultEntryRelativePaths: readonly string[]): string | null {
  const cleanedVaultEntryRelativePath = typedVaultEntryRelativePath.trim().replace(/^\/+|\/+$/g, '')
  const lowerCaseVaultEntryRelativePath = cleanedVaultEntryRelativePath.toLowerCase()
  const listedVaultEntryRelativePath = vaultEntryRelativePaths.find(
    (vaultEntryRelativePath) =>
      vaultEntryRelativePath.toLowerCase() === lowerCaseVaultEntryRelativePath ||
      vaultEntryRelativePath.toLowerCase() === `${lowerCaseVaultEntryRelativePath}${papelizVaultNoteFileExtension}`,
  )
  return listedVaultEntryRelativePath ?? resolveToolVaultNoteRelativePath(cleanedVaultEntryRelativePath)
}

export async function executePapelizAssistantVaultTool(toolCall: PapelizChatToolCall): Promise<PapelizAssistantToolOutcome> {
  const openVault = usePapelizWorkspaceStore.getState().openVault
  if (openVault === null) return failedToolOutcome(toolCall.function.name, 'No vault is open.')
  const toolArguments = readToolArguments(toolCall)
  const knowledgeState = usePapelizVaultKnowledgeStore.getState()

  switch (toolCall.function.name) {
    case 'searchVaultNotes': {
      const searchQueryText = readStringArgument(toolArguments, 'query')
      const requestedLimit = typeof toolArguments['limit'] === 'number' ? toolArguments['limit'] : 8
      const vaultSearchResults = await getPapelizVaultSearchClient().searchVaultNotes(searchQueryText, Math.min(Math.max(1, requestedLimit), 20))
      return {
        toolResultText: JSON.stringify({ results: vaultSearchResults }),
        toolActivityKind: 'searched',
        toolActivityLabel: `Searched notes for “${searchQueryText}” · ${vaultSearchResults.length} found`,
        toolActivityVaultNoteRelativePaths: vaultSearchResults.map((vaultSearchResult) => vaultSearchResult.vaultNoteRelativePath),
        proposalDraft: null,
      }
    }
    case 'readVaultNote': {
      const vaultNoteRelativePath = resolveToolVaultNoteRelativePath(readStringArgument(toolArguments, 'vaultNoteRelativePath'))
      if (vaultNoteRelativePath === null) return failedToolOutcome('Read a note', 'There is no note with that name or path.')
      try {
        const vaultNoteText = await readLatestPapelizVaultNoteText(openVault, vaultNoteRelativePath)
        const isTruncated = vaultNoteText.length > papelizReadVaultNoteCharacterLimit
        return {
          toolResultText: JSON.stringify({
            vaultNoteRelativePath,
            noteText: isTruncated ? vaultNoteText.slice(0, papelizReadVaultNoteCharacterLimit) : vaultNoteText,
            isTruncated,
          }),
          toolActivityKind: 'read',
          toolActivityLabel: 'Read',
          toolActivityVaultNoteRelativePaths: [vaultNoteRelativePath],
          proposalDraft: null,
        }
      } catch (vaultReadError) {
        return failedToolOutcome('Read a note', describePapelizVaultError(vaultReadError))
      }
    }
    case 'listVaultNoteLinks': {
      const vaultNoteRelativePath = resolveToolVaultNoteRelativePath(readStringArgument(toolArguments, 'vaultNoteRelativePath'))
      const vaultNoteIndexEntry = vaultNoteRelativePath === null ? undefined : knowledgeState.vaultNoteIndexEntriesByRelativePath[vaultNoteRelativePath]
      if (vaultNoteRelativePath === null || vaultNoteIndexEntry === undefined) return failedToolOutcome('List links', 'There is no note with that name or path.')
      const vaultNoteIndexEntries = Object.values(knowledgeState.vaultNoteIndexEntriesByRelativePath)
      const resolveWikilinkTarget = createPapelizWikilinkTargetResolver(vaultNoteIndexEntries.map((indexEntry) => indexEntry.vaultNoteRelativePath))
      return {
        toolResultText: JSON.stringify({
          vaultNoteRelativePath,
          outgoingLinks: vaultNoteIndexEntry.outgoingWikilinkTargetNames.map((wikilinkTargetName) => ({
            linkedNoteName: wikilinkTargetName,
            linkedVaultNoteRelativePath: resolveWikilinkTarget(wikilinkTargetName, vaultNoteRelativePath),
          })),
          backlinks: findPapelizVaultNoteBacklinks(vaultNoteIndexEntries, vaultNoteRelativePath),
          tags: vaultNoteIndexEntry.vaultNoteTags,
          headings: vaultNoteIndexEntry.vaultNoteHeadings.map((noteHeading) => `${'#'.repeat(noteHeading.noteHeadingDepth)} ${noteHeading.noteHeadingText}`),
        }),
        toolActivityKind: 'listed-links',
        toolActivityLabel: 'Looked at the links of',
        toolActivityVaultNoteRelativePaths: [vaultNoteRelativePath],
        proposalDraft: null,
      }
    }
    case 'listVaultNotes': {
      const vaultNoteIndexEntries = Object.values(knowledgeState.vaultNoteIndexEntriesByRelativePath)
      return {
        toolResultText: JSON.stringify({
          noteCount: vaultNoteIndexEntries.length,
          notes: vaultNoteIndexEntries.slice(0, papelizListedVaultNotesLimit).map((vaultNoteIndexEntry) => ({
            vaultNoteRelativePath: vaultNoteIndexEntry.vaultNoteRelativePath,
            tags: vaultNoteIndexEntry.vaultNoteTags,
            outgoingLinkCount: vaultNoteIndexEntry.outgoingWikilinkTargetNames.length,
          })),
        }),
        toolActivityKind: 'listed-notes',
        toolActivityLabel: `Listed the vault’s ${vaultNoteIndexEntries.length} notes`,
        toolActivityVaultNoteRelativePaths: [],
        proposalDraft: null,
      }
    }
    case 'proposeVaultNoteEdit': {
      const vaultNoteRelativePath = resolveToolVaultNoteRelativePath(readStringArgument(toolArguments, 'vaultNoteRelativePath'))
      if (vaultNoteRelativePath === null) return failedToolOutcome('Propose an edit', 'There is no note with that name or path. Use proposeVaultNoteCreate for a new note.')
      if (isPapelizChatSessionNotePath(vaultNoteRelativePath)) return failedToolOutcome('Propose an edit', 'Saved chats are not edited.')
      if (!isVaultRelativePathWritableByPapeliz(vaultNoteRelativePath)) return failedToolOutcome('Propose an edit', 'Notes in hidden folders are not edited.')
      const vaultNoteTextEdits = (Array.isArray(toolArguments['edits']) ? toolArguments['edits'] : [])
        .filter((typedEdit): typedEdit is Record<string, unknown> => typeof typedEdit === 'object' && typedEdit !== null)
        .map((typedEdit) => ({ findText: readStringArgument(typedEdit, 'findText'), replaceWithText: readStringArgument(typedEdit, 'replaceWithText') }))
      if (vaultNoteTextEdits.length === 0) return failedToolOutcome('Propose an edit', 'The proposal had no edits.')
      try {
        const originalVaultNoteText = await readLatestPapelizVaultNoteText(openVault, vaultNoteRelativePath)
        const vaultNoteTextEditsResult = applyPapelizVaultNoteTextEdits(originalVaultNoteText, vaultNoteTextEdits)
        if (vaultNoteTextEditsResult.vaultNoteTextEditsOutcome === 'refused') {
          return failedToolOutcome('Propose an edit', `${vaultNoteTextEditsResult.vaultNoteTextEditsProblem} Read the note again and quote its text exactly.`)
        }
        return {
          toolResultText: JSON.stringify({ proposed: true, vaultNoteRelativePath, note: 'The user will review this diff; it is not applied yet.' }),
          toolActivityKind: 'proposed',
          toolActivityLabel: 'Proposed an edit to',
          toolActivityVaultNoteRelativePaths: [vaultNoteRelativePath],
          proposalDraft: {
            assistantProposalKind: 'edit-note',
            vaultNoteRelativePath,
            proposalReason: readStringArgument(toolArguments, 'reason'),
            vaultNoteTextEdits,
            newVaultNoteText: vaultNoteTextEditsResult.editedVaultNoteText,
            originalVaultNoteText,
            trashedVaultEntryRelativePaths: [],
          },
        }
      } catch (vaultReadError) {
        return failedToolOutcome('Propose an edit', describePapelizVaultError(vaultReadError))
      }
    }
    case 'proposeVaultNoteCreate': {
      const typedVaultNoteRelativePath = readStringArgument(toolArguments, 'vaultNoteRelativePath').trim().replace(/^\/+/, '')
      const vaultNoteRelativePath = isVaultNoteFileName(typedVaultNoteRelativePath) ? typedVaultNoteRelativePath : `${typedVaultNoteRelativePath}${papelizVaultNoteFileExtension}`
      const vaultPathProblem = splitVaultRelativePath(vaultNoteRelativePath)
        .map((vaultPathSegment) => describeVaultEntryNameProblem(vaultPathSegment))
        .find((vaultPathSegmentProblem) => vaultPathSegmentProblem !== null)
      if (typedVaultNoteRelativePath.length === 0 || vaultPathProblem !== undefined) {
        return failedToolOutcome('Propose a note', vaultPathProblem ?? 'The new note needs a name.')
      }
      const isNameTaken = Object.keys(knowledgeState.vaultNoteIndexEntriesByRelativePath).some(
        (existingVaultNoteRelativePath) => existingVaultNoteRelativePath.toLowerCase() === vaultNoteRelativePath.toLowerCase(),
      )
      if (isNameTaken) return failedToolOutcome('Propose a note', `“${vaultNoteRelativePath}” already exists. Use proposeVaultNoteEdit to change it.`)
      return {
        toolResultText: JSON.stringify({ proposed: true, vaultNoteRelativePath, note: 'The user will decide whether to create it.' }),
        toolActivityKind: 'proposed',
        toolActivityLabel: 'Proposed a new note',
        toolActivityVaultNoteRelativePaths: [],
        proposalDraft: {
          assistantProposalKind: 'create-note',
          vaultNoteRelativePath,
          proposalReason: readStringArgument(toolArguments, 'reason'),
          vaultNoteTextEdits: [],
          newVaultNoteText: readStringArgument(toolArguments, 'noteText'),
          originalVaultNoteText: '',
          trashedVaultEntryRelativePaths: [],
        },
      }
    }
    case 'proposeVaultEntriesTrash': {
      const { vaultTreeEntries, isWholeVaultEditingLocked, lockedVaultEntryRelativePaths } = usePapelizWorkspaceStore.getState()
      const vaultEntryRelativePaths = vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
      const typedVaultEntryRelativePaths = (Array.isArray(toolArguments['vaultEntryRelativePaths']) ? toolArguments['vaultEntryRelativePaths'] : []).filter(
        (typedVaultEntryRelativePath): typedVaultEntryRelativePath is string => typeof typedVaultEntryRelativePath === 'string',
      )
      const skippedVaultEntries: Array<{ vaultEntryRelativePath: string; skippedBecause: string }> = []
      const requestedVaultEntryRelativePaths: string[] =
        toolArguments['wholeVault'] === true ? listPapelizAssistantWholeVaultTrashEntries(vaultEntryRelativePaths, isWholeVaultEditingLocked, lockedVaultEntryRelativePaths) : []
      for (const typedVaultEntryRelativePath of typedVaultEntryRelativePaths) {
        const resolvedVaultEntryRelativePath = resolveToolVaultEntryRelativePath(typedVaultEntryRelativePath, vaultEntryRelativePaths)
        if (resolvedVaultEntryRelativePath === null) {
          skippedVaultEntries.push({ vaultEntryRelativePath: typedVaultEntryRelativePath, skippedBecause: 'Not In Vault' })
          continue
        }
        const vaultEntryTrashProblem = findPapelizAssistantVaultEntryTrashProblem(resolvedVaultEntryRelativePath, isWholeVaultEditingLocked, lockedVaultEntryRelativePaths)
        if (vaultEntryTrashProblem === null) requestedVaultEntryRelativePaths.push(resolvedVaultEntryRelativePath)
        else skippedVaultEntries.push({ vaultEntryRelativePath: resolvedVaultEntryRelativePath, skippedBecause: vaultEntryTrashProblem })
      }
      const trashedVaultEntryRelativePaths = keepOutermostPapelizVaultEntries(requestedVaultEntryRelativePaths)
      if (trashedVaultEntryRelativePaths.length === 0) {
        return failedToolOutcome(
          'Propose deleting',
          skippedVaultEntries.length > 0
            ? `Nothing may be moved: ${skippedVaultEntries.map((skippedVaultEntry) => `${skippedVaultEntry.vaultEntryRelativePath} (${skippedVaultEntry.skippedBecause})`).join(', ')}`
            : 'Name the notes or folders to delete.',
        )
      }
      return {
        toolResultText: JSON.stringify({
          proposed: true,
          vaultEntryRelativePaths: trashedVaultEntryRelativePaths,
          skipped: skippedVaultEntries,
          note: 'The user will decide. Accepted entries move into the vault’s .trash folder; nothing is erased.',
        }),
        toolActivityKind: 'proposed',
        toolActivityLabel: 'Proposed deleting',
        toolActivityVaultNoteRelativePaths: trashedVaultEntryRelativePaths.filter(isVaultNoteFileName),
        proposalDraft: {
          assistantProposalKind: 'trash-entries',
          vaultNoteRelativePath: trashedVaultEntryRelativePaths[0] ?? '',
          proposalReason: readStringArgument(toolArguments, 'reason'),
          vaultNoteTextEdits: [],
          newVaultNoteText: '',
          originalVaultNoteText: '',
          trashedVaultEntryRelativePaths,
        },
      }
    }
    default:
      return failedToolOutcome(toolCall.function.name, 'Papeliz has no tool by that name.')
  }
}
