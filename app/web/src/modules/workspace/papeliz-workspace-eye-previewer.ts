import { create } from 'zustand'
import type { PapelizAssistantChatEntry, PapelizAssistantProposal } from '../assistant/papeliz-assistant-conversation-store'
import { usePapelizAssistantConversationStore } from '../assistant/papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore } from '../assistant/papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from '../assistant/papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from '../assistant/papeliz-assistant-provider-settings-store'
import type { PapelizNoteViewMode } from '../note-editor/papeliz-note-editor'
import { describePapelizFolderAccessOffReason, type PapelizFolderAccessOffReason } from '../vault/papeliz-folder-access-support'
import { PapelizInMemoryVaultAdapter, type PapelizInMemoryVaultNote } from '../vault/papeliz-in-memory-vault-adapter'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizRememberedVaultFolder } from '../vault/papeliz-remembered-vault-folders'
import { papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import type { PapelizVaultAdapter, PapelizVaultTreeListingOptions } from '../vault/papeliz-vault-adapter'
import { usePapelizStartScreenEyePreviewStore, type PapelizStartScreenEyePreview } from './papeliz-start-screen-eye-preview-store'
import { usePapelizWorkspaceStore, type PapelizLoadedVaultNote } from './papeliz-workspace-store'

// The eye previewer, in development builds only (papeliz-workspace-eye-previewer-slot.tsx). It sits
// in the start screen's Recent Vaults heading and in a vault's file list header, and holds the app
// in one of its states so every label, message and toast can be looked at without making it happen
// for real:
// - the start screen's states, first: the folder actions off in this browser, Open Vault failing,
//   and the Recent and Hidden lists with made-up vaults (papeliz-start-screen-eye-preview-store.ts);
// - a vault's states: a made-up vault opened in the workspace and held in one of its states.
// Nothing is read from or written to a disk or the browser's storage, no message goes to a provider
// and no setting is saved. Live puts everything back.

// Every state the previewer can hold, in its menu's order.
export const papelizWorkspaceEyePreviewerStates = [
  'start-folder-access-unsupported',
  'start-folder-access-writes-blocked',
  'start-folder-access-chooser-unavailable',
  'start-open-vault-permission-refused',
  'start-open-vault-folder-gone',
  'start-recent-vaults-empty',
  'start-recent-vaults-listed',
  'start-recent-vaults-many',
  'start-recent-vaults-search-no-match',
  'start-recent-vaults-reloading',
  'start-hidden-vaults-empty',
  'start-hidden-vaults-listed',
  'start-hidden-vault-delete-one',
  'start-hidden-vaults-delete-all',
  'start-hidden-vaults-deleting',
  'start-hidden-vault-deleted',
  'start-hidden-vaults-delete-partly-failed',
  'note-md-code',
  'note-md-view',
  'note-loading',
  'note-load-failed',
  'note-unsaved',
  'note-saving',
  'note-save-failed',
  'note-locked',
  'note-locked-by-folder',
  'no-note-open',
  'many-notes-open',
  'file-list-reading',
  'file-list-failed',
  'vault-empty',
  'assistant-not-set-up',
  'assistant-ready',
  'assistant-answered',
  'assistant-writing',
  'assistant-changes-waiting',
  'assistant-provider-error',
  'toast-info',
  'toast-error',
  'toast-error-try-again',
  'focus-mode',
  'close-vault-question',
] as const

export type PapelizWorkspaceEyePreviewerState = (typeof papelizWorkspaceEyePreviewerStates)[number]

type PapelizStartScreenEyePreviewerState = Extract<PapelizWorkspaceEyePreviewerState, `start-${string}`>
type PapelizVaultEyePreviewerState = Exclude<PapelizWorkspaceEyePreviewerState, PapelizStartScreenEyePreviewerState>

function isStartScreenEyePreviewerState(workspaceEyePreviewerState: PapelizWorkspaceEyePreviewerState): workspaceEyePreviewerState is PapelizStartScreenEyePreviewerState {
  return workspaceEyePreviewerState.startsWith('start-')
}

interface PapelizWorkspaceEyePreviewerHeld {
  // The state held now; null is Live.
  heldWorkspaceEyePreviewerState: PapelizWorkspaceEyePreviewerState | null
}

export const usePapelizWorkspaceEyePreviewerStore = create<PapelizWorkspaceEyePreviewerHeld>()(() => ({
  heldWorkspaceEyePreviewerState: null,
}))

const papelizEyePreviewerVaultDisplayName = 'Preview vault'
const papelizEyePreviewerVaultIdPrefix = 'papeliz-workspace-eye-previewer-vault-'
const papelizEyePreviewerActiveNoteRelativePath = 'Projects/Garden plan.md'
const papelizEyePreviewerFirstTabRelativePaths = ['Start here.md', 'Inbox.md']
// A stray request from a preview (an inline edit, say) goes to this computer's port 1 and fails at
// once, so it never reaches a provider.
const papelizEyePreviewerProviderBaseUrl = 'http://127.0.0.1:1/papeliz-eye-previewer'
const papelizEyePreviewerProviderApiKey = 'papeliz-eye-previewer-made-up-key'

// The made-up vault shows as a folder on disk, as most vaults are, while its notes stay in memory.
class PapelizWorkspaceEyePreviewerVaultAdapter implements PapelizVaultAdapter {
  readonly papelizVaultKind = 'folder-on-disk' as const
  private readonly inMemoryVaultAdapter: PapelizInMemoryVaultAdapter

  constructor(previewVaultNotes: readonly PapelizInMemoryVaultNote[]) {
    this.inMemoryVaultAdapter = new PapelizInMemoryVaultAdapter(previewVaultNotes)
  }

  listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions) {
    return this.inMemoryVaultAdapter.listVaultTreeEntries(vaultTreeListingOptions)
  }
  readVaultNoteText(vaultNoteRelativePath: string) {
    return this.inMemoryVaultAdapter.readVaultNoteText(vaultNoteRelativePath)
  }
  writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string) {
    return this.inMemoryVaultAdapter.writeVaultNoteText(vaultNoteRelativePath, vaultNoteText)
  }
  createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string) {
    return this.inMemoryVaultAdapter.createVaultNote(vaultNoteRelativePath, vaultNoteText)
  }
  createVaultFolder(vaultFolderRelativePath: string) {
    return this.inMemoryVaultAdapter.createVaultFolder(vaultFolderRelativePath)
  }
  createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob) {
    return this.inMemoryVaultAdapter.createVaultAttachmentFile(vaultAttachmentFileRelativePath, vaultAttachmentFileBlob)
  }
  listVaultAttachmentFileRelativePaths() {
    return this.inMemoryVaultAdapter.listVaultAttachmentFileRelativePaths()
  }
  readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string) {
    return this.inMemoryVaultAdapter.readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath)
  }
  renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string) {
    return this.inMemoryVaultAdapter.renameVaultEntry(fromVaultEntryRelativePath, toVaultEntryRelativePath)
  }
  copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string) {
    return this.inMemoryVaultAdapter.copyVaultEntry(fromVaultEntryRelativePath, toVaultEntryRelativePath)
  }
  moveVaultEntryToTrash(vaultEntryRelativePath: string) {
    return this.inMemoryVaultAdapter.moveVaultEntryToTrash(vaultEntryRelativePath)
  }
  readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string) {
    return this.inMemoryVaultAdapter.readPapelizVaultSettingsFile(papelizVaultSettingsFileName)
  }
  writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string) {
    return this.inMemoryVaultAdapter.writePapelizVaultSettingsFile(papelizVaultSettingsFileName, papelizVaultSettingsFileText)
  }
}

export function isPapelizWorkspaceEyePreviewerVault(papelizOpenVault: PapelizOpenVault | null): boolean {
  return papelizOpenVault !== null && papelizOpenVault.papelizVaultId.startsWith(papelizEyePreviewerVaultIdPrefix)
}

// What the previews change outside the made-up vault, as it was before the first one, for Live.
interface PapelizWorkspaceEyePreviewerOutsideState {
  activeAssistantProviderId: string
  providerSettingsByProviderId: ReturnType<typeof usePapelizAssistantProviderSettingsStore.getState>['providerSettingsByProviderId']
  saveAssistantProviderSettings: ReturnType<typeof usePapelizAssistantProviderSettingsStore.getState>['saveAssistantProviderSettings']
  forgetAssistantProviderSettings: ReturnType<typeof usePapelizAssistantProviderSettingsStore.getState>['forgetAssistantProviderSettings']
  sendAssistantMessage: ReturnType<typeof usePapelizAssistantConversationStore.getState>['sendAssistantMessage']
  stopAssistant: ReturnType<typeof usePapelizAssistantConversationStore.getState>['stopAssistant']
}

let heldOutsideState: PapelizWorkspaceEyePreviewerOutsideState | null = null
let nextEyePreviewerVaultNumber = 1
let isSwitchingEyePreviewerState = false
let stopWatchingEyePreviewerVault: (() => void) | null = null

function showPreviewOnlyNotice(previewOnlyMessage: string): void {
  usePapelizWorkspaceStore.getState().showWorkspaceNotice('info', previewOnlyMessage)
}

// Keeps the previews to themselves: the provider settings and the assistant's send, stop and save
// work only in memory while a preview is held.
function setAsideOutsideStateOnce(): void {
  if (heldOutsideState !== null) return
  const providerSettingsState = usePapelizAssistantProviderSettingsStore.getState()
  const conversationState = usePapelizAssistantConversationStore.getState()
  heldOutsideState = {
    activeAssistantProviderId: providerSettingsState.activeAssistantProviderId,
    providerSettingsByProviderId: providerSettingsState.providerSettingsByProviderId,
    saveAssistantProviderSettings: providerSettingsState.saveAssistantProviderSettings,
    forgetAssistantProviderSettings: providerSettingsState.forgetAssistantProviderSettings,
    sendAssistantMessage: conversationState.sendAssistantMessage,
    stopAssistant: conversationState.stopAssistant,
  }
  usePapelizAssistantProviderSettingsStore.setState({
    saveAssistantProviderSettings: async () => showPreviewOnlyNotice('Settings not saved (Preview Only).'),
    forgetAssistantProviderSettings: async () => showPreviewOnlyNotice('Settings not changed (Preview Only).'),
  })
  usePapelizAssistantConversationStore.setState({
    sendAssistantMessage: async () => showPreviewOnlyNotice('Nothing sent (Preview Only).'),
    // Stop ends the made-up answer where it is.
    stopAssistant: () =>
      usePapelizAssistantConversationStore.setState((conversationState) => ({
        isAssistantRunning: false,
        chatEntries: conversationState.chatEntries.map((chatEntry) =>
          chatEntry.chatEntryKind === 'assistant-message' ? { ...chatEntry, isChatEntryStreaming: false } : chatEntry,
        ),
      })),
  })
  // Leaving the made-up vault any other way (Start page, Close vault) is Live too.
  stopWatchingEyePreviewerVault = usePapelizWorkspaceStore.subscribe((workspaceState, previousWorkspaceState) => {
    if (isSwitchingEyePreviewerState || workspaceState.openVault === previousWorkspaceState.openVault) return
    if (!isPapelizWorkspaceEyePreviewerVault(workspaceState.openVault)) putBackOutsideState()
  })
}

function clearAssistantConversation(chatVaultId: string | null): void {
  usePapelizAssistantConversationStore.setState({
    chatVaultId,
    chatEntries: [],
    providerChatMessages: [],
    assistantProposalsById: {},
    isAssistantRunning: false,
    pendingSelectionContext: null,
    chatSessionVaultNoteRelativePath: null,
    composerDraftText: '',
  })
}

function putBackOutsideState(): void {
  stopWatchingEyePreviewerVault?.()
  stopWatchingEyePreviewerVault = null
  if (heldOutsideState !== null) {
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: heldOutsideState.activeAssistantProviderId,
      providerSettingsByProviderId: heldOutsideState.providerSettingsByProviderId,
      saveAssistantProviderSettings: heldOutsideState.saveAssistantProviderSettings,
      forgetAssistantProviderSettings: heldOutsideState.forgetAssistantProviderSettings,
    })
    usePapelizAssistantConversationStore.setState({
      sendAssistantMessage: heldOutsideState.sendAssistantMessage,
      stopAssistant: heldOutsideState.stopAssistant,
    })
    heldOutsideState = null
  }
  clearAssistantConversation(null)
  usePapelizAssistantPanelUiStore.setState({ assistantPanelTab: 'chat', isProviderSettingsDialogOpen: false })
  usePapelizWorkspaceEyePreviewerStore.setState({ heldWorkspaceEyePreviewerState: null })
  usePapelizStartScreenEyePreviewStore.setState({ heldStartScreenEyePreview: null })
}

// Live: closes the made-up vault (back to the start page), shows the real start screen and puts
// everything back.
export async function returnPapelizWorkspaceEyePreviewerToLive(): Promise<void> {
  if (isPapelizWorkspaceEyePreviewerVault(usePapelizWorkspaceStore.getState().openVault)) {
    await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
  }
  putBackOutsideState()
}

function setPreviewProviderReady(isPreviewProviderReady: boolean): void {
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore.getState().activeAssistantProviderId
  const providerPreset = findPapelizAssistantProviderPreset(activeAssistantProviderId)
  usePapelizAssistantProviderSettingsStore.setState({
    providerSettingsByProviderId: isPreviewProviderReady
      ? {
          [activeAssistantProviderId]: {
            papelizAssistantProviderId: activeAssistantProviderId,
            providerBaseUrl: papelizEyePreviewerProviderBaseUrl,
            providerModelName: providerPreset.suggestedProviderModelNames[0] ?? 'preview-model',
            providerApiKey: papelizEyePreviewerProviderApiKey,
          },
        }
      : {},
  })
}

function updateActivePreviewNote(updateLoadedVaultNote: (loadedVaultNote: PapelizLoadedVaultNote) => PapelizLoadedVaultNote): void {
  usePapelizWorkspaceStore.setState((workspaceState) => {
    const activeLoadedVaultNote = workspaceState.loadedVaultNotesByRelativePath[papelizEyePreviewerActiveNoteRelativePath]
    if (activeLoadedVaultNote === undefined) return workspaceState
    return {
      loadedVaultNotesByRelativePath: {
        ...workspaceState.loadedVaultNotesByRelativePath,
        [papelizEyePreviewerActiveNoteRelativePath]: updateLoadedVaultNote(activeLoadedVaultNote),
      },
    }
  })
}

let nextPreviewChatEntryNumber = 1
function createPreviewChatEntryId(): string {
  return `papeliz-eye-previewer-chat-entry-${nextPreviewChatEntryNumber++}`
}

const papelizEyePreviewerQuestionText = 'How often should I water the tomatoes?'

function previewQuestionAndLookups(): PapelizAssistantChatEntry[] {
  return [
    { chatEntryId: createPreviewChatEntryId(), chatEntryKind: 'user-message', chatEntryText: papelizEyePreviewerQuestionText, chatEntryContextLabel: 'Garden plan' },
    {
      chatEntryId: createPreviewChatEntryId(),
      chatEntryKind: 'tool-activity',
      toolActivityKind: 'searched',
      toolActivityLabel: 'Searched for “tomatoes”',
      toolActivityVaultNoteRelativePaths: [papelizEyePreviewerActiveNoteRelativePath],
    },
    {
      chatEntryId: createPreviewChatEntryId(),
      chatEntryKind: 'tool-activity',
      toolActivityKind: 'read',
      toolActivityLabel: 'Read',
      toolActivityVaultNoteRelativePaths: [papelizEyePreviewerActiveNoteRelativePath],
    },
  ]
}

const papelizEyePreviewerAnswerText =
  'Your **Garden plan** says tomatoes want deep watering **twice a week** rather than a little every day, early in the morning. They grow in the middle bed.'

function previewProposals(): PapelizAssistantProposal[] {
  const gardenPlanNote = papelizSampleVaultNotes.find((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath === papelizEyePreviewerActiveNoteRelativePath)
  const gardenPlanText = gardenPlanNote?.vaultNoteText ?? ''
  return [
    {
      assistantProposalId: 'papeliz-eye-previewer-proposal-edit',
      assistantProposalKind: 'edit-note',
      vaultNoteRelativePath: papelizEyePreviewerActiveNoteRelativePath,
      proposalReason: 'Add when to water to the plan.',
      vaultNoteTextEdits: [
        { findText: 'Water early in the morning.', replaceWithText: 'Water early in the morning, deeply, twice a week.' },
      ],
      newVaultNoteText: gardenPlanText.replace('Water early in the morning.', 'Water early in the morning, deeply, twice a week.'),
      originalVaultNoteText: gardenPlanText,
      trashedVaultEntryRelativePaths: [],
      proposalStatus: 'pending',
      proposalProblem: null,
    },
    {
      assistantProposalId: 'papeliz-eye-previewer-proposal-create',
      assistantProposalKind: 'create-note',
      vaultNoteRelativePath: 'Projects/Watering.md',
      proposalReason: 'Keep the watering times in one place.',
      vaultNoteTextEdits: [],
      newVaultNoteText: '# Watering\n\n- Tomatoes: deeply, twice a week\n- Beans and peas: when the top of the soil is dry\n\nFrom the [[Garden plan]].\n',
      originalVaultNoteText: '',
      trashedVaultEntryRelativePaths: [],
      proposalStatus: 'pending',
      proposalProblem: null,
    },
  ]
}

function applyAssistantPreviewState(previewVaultId: string, workspaceEyePreviewerState: PapelizVaultEyePreviewerState): void {
  usePapelizWorkspaceStore.getState().setAssistantPanelOpen(true)
  usePapelizAssistantPanelUiStore.setState({ assistantPanelTab: 'chat', isProviderSettingsDialogOpen: false })
  setPreviewProviderReady(workspaceEyePreviewerState !== 'assistant-not-set-up')
  clearAssistantConversation(previewVaultId)
  if (workspaceEyePreviewerState === 'assistant-answered') {
    usePapelizAssistantConversationStore.setState({
      chatEntries: [
        ...previewQuestionAndLookups(),
        { chatEntryId: createPreviewChatEntryId(), chatEntryKind: 'assistant-message', chatEntryText: papelizEyePreviewerAnswerText, isChatEntryStreaming: false },
      ],
    })
  } else if (workspaceEyePreviewerState === 'assistant-writing') {
    usePapelizAssistantConversationStore.setState({
      isAssistantRunning: true,
      chatEntries: [
        ...previewQuestionAndLookups(),
        {
          chatEntryId: createPreviewChatEntryId(),
          chatEntryKind: 'assistant-message',
          chatEntryText: 'Your **Garden plan** says tomatoes want deep watering',
          isChatEntryStreaming: true,
        },
      ],
    })
  } else if (workspaceEyePreviewerState === 'assistant-changes-waiting') {
    const previewAssistantProposals = previewProposals()
    usePapelizAssistantConversationStore.setState({
      assistantProposalsById: Object.fromEntries(
        previewAssistantProposals.map((previewAssistantProposal) => [previewAssistantProposal.assistantProposalId, previewAssistantProposal]),
      ),
      chatEntries: [
        { chatEntryId: createPreviewChatEntryId(), chatEntryKind: 'user-message', chatEntryText: 'Write down when to water each bed.', chatEntryContextLabel: 'Garden plan' },
        {
          chatEntryId: createPreviewChatEntryId(),
          chatEntryKind: 'tool-activity',
          toolActivityKind: 'read',
          toolActivityLabel: 'Read',
          toolActivityVaultNoteRelativePaths: [papelizEyePreviewerActiveNoteRelativePath],
        },
        {
          chatEntryId: createPreviewChatEntryId(),
          chatEntryKind: 'assistant-message',
          chatEntryText: 'Here are two changes. Nothing changes until you accept them.',
          isChatEntryStreaming: false,
        },
        ...previewAssistantProposals.map(
          (previewAssistantProposal): PapelizAssistantChatEntry => ({
            chatEntryId: createPreviewChatEntryId(),
            chatEntryKind: 'proposal',
            assistantProposalId: previewAssistantProposal.assistantProposalId,
          }),
        ),
      ],
    })
  } else if (workspaceEyePreviewerState === 'assistant-provider-error') {
    usePapelizAssistantConversationStore.setState({
      chatEntries: [
        { chatEntryId: createPreviewChatEntryId(), chatEntryKind: 'user-message', chatEntryText: papelizEyePreviewerQuestionText, chatEntryContextLabel: 'Garden plan' },
        // The words the provider client uses for a refused key.
        { chatEntryId: createPreviewChatEntryId(), chatEntryKind: 'notice', chatEntryText: 'The provider refused the API key (401).', isChatEntryError: true },
      ],
    })
  }
}

// ---- The start screen's states ----

let nextStartScreenEyePreviewNumber = 1
const papelizEyePreviewerMinuteMilliseconds = 60_000

// A remembered folder for a preview: a name only. Its made-up handle is never used, since every
// action on it in a preview says so instead (papeliz-welcome-screen.tsx).
function createPreviewRememberedVaultFolder(
  previewVaultDisplayName: string,
  openedMinutesAgo: number,
  hiddenMinutesAgo: number | null,
): PapelizRememberedVaultFolder {
  const previewNow = Date.now()
  return {
    papelizVaultId: `papeliz-eye-previewer-remembered-vault-${previewVaultDisplayName.toLowerCase().replaceAll(' ', '-')}`,
    papelizVaultDisplayName: previewVaultDisplayName,
    papelizVaultFolderHandle: { kind: 'directory', name: previewVaultDisplayName } as unknown as FileSystemDirectoryHandle,
    papelizVaultLastOpenedAt: previewNow - openedMinutesAgo * papelizEyePreviewerMinuteMilliseconds,
    papelizVaultHiddenAt: hiddenMinutesAgo === null ? null : previewNow - hiddenMinutesAgo * papelizEyePreviewerMinuteMilliseconds,
  }
}

function createPreviewRecentVaultFolders(previewVaultCount: 'few' | 'many'): PapelizRememberedVaultFolder[] {
  const previewRecentVaultNames =
    previewVaultCount === 'few'
      ? ['Garden journal', 'Work notes', 'Reading notes', 'Recipes']
      : [
          'Garden journal', 'Work notes', 'Reading notes', 'Recipes', 'Thesis', 'Travel plans', 'Meeting notes',
          'Book drafts', 'Course notes', 'Home projects', 'Ideas', 'Research', 'Daily log', 'Fitness',
        ]
  return previewRecentVaultNames.map((previewRecentVaultName, previewRecentVaultIndex) =>
    createPreviewRememberedVaultFolder(previewRecentVaultName, [3, 95, 60 * 26, 60 * 24 * 6][previewRecentVaultIndex] ?? 60 * 24 * (previewRecentVaultIndex + 3), null),
  )
}

function createPreviewHiddenVaultFolders(previewHiddenVaultNames: readonly string[]): PapelizRememberedVaultFolder[] {
  return previewHiddenVaultNames.map((previewHiddenVaultName, previewHiddenVaultIndex) =>
    createPreviewRememberedVaultFolder(previewHiddenVaultName, 60 * 24 * 30, [12, 60 * 5, 60 * 24 * 2][previewHiddenVaultIndex] ?? 60 * 24 * 3),
  )
}

const papelizEyePreviewerHiddenVaultNames = ['Old drafts', 'Trip 2025', 'Class notes']

function describeStartScreenEyePreview(
  startScreenEyePreviewerState: PapelizStartScreenEyePreviewerState,
): Omit<PapelizStartScreenEyePreview, 'startScreenEyePreviewNumber'> {
  const liveLikeStartScreenEyePreview = {
    previewRememberedVaultFolders: [...createPreviewRecentVaultFolders('few'), ...createPreviewHiddenVaultFolders(papelizEyePreviewerHiddenVaultNames.slice(0, 2))],
    previewFolderAccessOffReason: null as PapelizFolderAccessOffReason | null,
    isPreviewHiddenVaultListShown: false,
    previewRecentVaultSearchText: '',
    isPreviewRecentVaultListReloading: false,
    previewVaultFolderDeleteScope: null as PapelizStartScreenEyePreview['previewVaultFolderDeleteScope'],
    isPreviewVaultFolderDeleting: false,
    previewStartScreenNotice: null as PapelizStartScreenEyePreview['previewStartScreenNotice'],
  }
  const hiddenListStartScreenEyePreview = {
    ...liveLikeStartScreenEyePreview,
    previewRememberedVaultFolders: [...createPreviewRecentVaultFolders('few'), ...createPreviewHiddenVaultFolders(papelizEyePreviewerHiddenVaultNames)],
    isPreviewHiddenVaultListShown: true,
  }
  switch (startScreenEyePreviewerState) {
    // A browser without folder access has never opened one, so its list is empty.
    case 'start-folder-access-unsupported':
      return { ...liveLikeStartScreenEyePreview, previewRememberedVaultFolders: [], previewFolderAccessOffReason: 'unsupported' }
    case 'start-folder-access-writes-blocked':
      return { ...liveLikeStartScreenEyePreview, previewRememberedVaultFolders: [], previewFolderAccessOffReason: 'writes-blocked' }
    case 'start-folder-access-chooser-unavailable':
      return {
        ...liveLikeStartScreenEyePreview,
        previewRememberedVaultFolders: [],
        previewFolderAccessOffReason: 'chooser-unavailable',
        previewStartScreenNotice: { previewNoticeKind: 'error', previewNoticeMessage: describePapelizFolderAccessOffReason('chooser-unavailable') },
      }
    // The words Open Vault uses (papeliz-open-vault.ts).
    case 'start-open-vault-permission-refused':
      return {
        ...liveLikeStartScreenEyePreview,
        previewStartScreenNotice: { previewNoticeKind: 'error', previewNoticeMessage: 'Couldn’t open the folder (No Permission)' },
      }
    case 'start-open-vault-folder-gone':
      return {
        ...liveLikeStartScreenEyePreview,
        previewStartScreenNotice: { previewNoticeKind: 'error', previewNoticeMessage: 'Couldn’t open “Field Notes” (Folder Not Found)' },
      }
    case 'start-recent-vaults-empty':
      return { ...liveLikeStartScreenEyePreview, previewRememberedVaultFolders: [] }
    case 'start-recent-vaults-listed':
      return liveLikeStartScreenEyePreview
    case 'start-recent-vaults-many':
      return { ...liveLikeStartScreenEyePreview, previewRememberedVaultFolders: createPreviewRecentVaultFolders('many') }
    case 'start-recent-vaults-search-no-match':
      return { ...liveLikeStartScreenEyePreview, previewRecentVaultSearchText: 'Taxes' }
    case 'start-recent-vaults-reloading':
      return { ...liveLikeStartScreenEyePreview, isPreviewRecentVaultListReloading: true }
    case 'start-hidden-vaults-empty':
      return { ...liveLikeStartScreenEyePreview, previewRememberedVaultFolders: createPreviewRecentVaultFolders('few'), isPreviewHiddenVaultListShown: true }
    case 'start-hidden-vaults-listed':
      return hiddenListStartScreenEyePreview
    case 'start-hidden-vault-delete-one':
      return { ...hiddenListStartScreenEyePreview, previewVaultFolderDeleteScope: 'one-vault' }
    case 'start-hidden-vaults-delete-all':
      return { ...hiddenListStartScreenEyePreview, previewVaultFolderDeleteScope: 'all-hidden-vaults' }
    case 'start-hidden-vaults-deleting':
      return { ...hiddenListStartScreenEyePreview, isPreviewVaultFolderDeleting: true }
    // The words Delete uses (papeliz-welcome-screen.tsx).
    case 'start-hidden-vault-deleted':
      return {
        ...hiddenListStartScreenEyePreview,
        previewRememberedVaultFolders: [...createPreviewRecentVaultFolders('few'), ...createPreviewHiddenVaultFolders(papelizEyePreviewerHiddenVaultNames.slice(1))],
        previewStartScreenNotice: { previewNoticeKind: 'info', previewNoticeMessage: `Deleted “${papelizEyePreviewerHiddenVaultNames[0]}”.` },
      }
    case 'start-hidden-vaults-delete-partly-failed':
      return {
        ...hiddenListStartScreenEyePreview,
        previewRememberedVaultFolders: [...createPreviewRecentVaultFolders('few'), ...createPreviewHiddenVaultFolders(papelizEyePreviewerHiddenVaultNames.slice(2))],
        previewStartScreenNotice: {
          previewNoticeKind: 'error',
          previewNoticeMessage: `Couldn’t delete 1 of ${papelizEyePreviewerHiddenVaultNames.length} vaults (Still Hidden)`,
        },
      }
  }
}

// Shows the start screen in `startScreenEyePreviewerState`. An open vault closes first, the usual
// way (its notes are saved).
async function holdStartScreenEyePreviewerState(startScreenEyePreviewerState: PapelizStartScreenEyePreviewerState): Promise<void> {
  isSwitchingEyePreviewerState = true
  try {
    await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
  } finally {
    isSwitchingEyePreviewerState = false
  }
  putBackOutsideState()
  usePapelizWorkspaceEyePreviewerStore.setState({ heldWorkspaceEyePreviewerState: startScreenEyePreviewerState })
  usePapelizStartScreenEyePreviewStore.setState({
    heldStartScreenEyePreview: {
      startScreenEyePreviewNumber: nextStartScreenEyePreviewNumber++,
      ...describeStartScreenEyePreview(startScreenEyePreviewerState),
    },
  })
}

// ---- A vault's states ----

function describeFirstNoteViewMode(workspaceEyePreviewerState: PapelizVaultEyePreviewerState): PapelizNoteViewMode {
  return workspaceEyePreviewerState === 'note-md-view' || workspaceEyePreviewerState === 'note-locked' || workspaceEyePreviewerState === 'note-locked-by-folder'
    ? 'md-view'
    : 'md-code'
}

// Holds `workspaceEyePreviewerState`. Picking a state again starts it over.
export async function holdPapelizWorkspaceEyePreviewerState(workspaceEyePreviewerState: PapelizWorkspaceEyePreviewerState): Promise<void> {
  if (isStartScreenEyePreviewerState(workspaceEyePreviewerState)) {
    await holdStartScreenEyePreviewerState(workspaceEyePreviewerState)
    return
  }
  await holdVaultEyePreviewerState(workspaceEyePreviewerState)
}

// Opens a fresh made-up vault in `workspaceEyePreviewerState`. A real vault that is open closes
// first, the usual way (its notes are saved).
async function holdVaultEyePreviewerState(workspaceEyePreviewerState: PapelizVaultEyePreviewerState): Promise<void> {
  usePapelizStartScreenEyePreviewStore.setState({ heldStartScreenEyePreview: null })
  // The saved provider settings load first, so they can't land over a preview's afterwards.
  await usePapelizAssistantProviderSettingsStore.getState().loadAssistantProviderSettings()
  setAsideOutsideStateOnce()
  usePapelizWorkspaceEyePreviewerStore.setState({ heldWorkspaceEyePreviewerState: workspaceEyePreviewerState })

  const previewVault: PapelizOpenVault = {
    papelizVaultId: `${papelizEyePreviewerVaultIdPrefix}${nextEyePreviewerVaultNumber++}`,
    papelizVaultDisplayName: papelizEyePreviewerVaultDisplayName,
    papelizVaultAdapter: new PapelizWorkspaceEyePreviewerVaultAdapter(workspaceEyePreviewerState === 'vault-empty' ? [] : papelizSampleVaultNotes),
  }
  const isNoteOpenedFirst = !['no-note-open', 'file-list-reading', 'file-list-failed', 'vault-empty'].includes(workspaceEyePreviewerState)
  isSwitchingEyePreviewerState = true
  try {
    clearAssistantConversation(previewVault.papelizVaultId)
    setPreviewProviderReady(false)
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(previewVault, {
      firstVaultNoteRelativePathToOpen: null,
      firstNoteViewMode: describeFirstNoteViewMode(workspaceEyePreviewerState),
      expandAllTopLevelFolders: true,
    })
  } finally {
    isSwitchingEyePreviewerState = false
  }
  const workspaceState = usePapelizWorkspaceStore.getState()
  if (workspaceState.openVault !== previewVault) return

  if (isNoteOpenedFirst) {
    const previewTabRelativePaths =
      workspaceEyePreviewerState === 'many-notes-open'
        ? papelizSampleVaultNotes.map((sampleVaultNote) => sampleVaultNote.vaultNoteRelativePath).filter((vaultNoteRelativePath) => vaultNoteRelativePath !== papelizEyePreviewerActiveNoteRelativePath)
        : papelizEyePreviewerFirstTabRelativePaths
    for (const previewTabRelativePath of previewTabRelativePaths) await workspaceState.openVaultNote(previewTabRelativePath)
    await workspaceState.openVaultNote(papelizEyePreviewerActiveNoteRelativePath)
  }

  switch (workspaceEyePreviewerState) {
    case 'note-loading':
      updateActivePreviewNote((loadedVaultNote) => ({ ...loadedVaultNote, noteLoadState: 'loading' }))
      break
    case 'note-load-failed':
      // The words the vault uses for a file that has gone from the folder.
      updateActivePreviewNote((loadedVaultNote) => ({ ...loadedVaultNote, noteLoadState: 'load-failed', noteLoadErrorMessage: 'The file is no longer in the folder.' }))
      break
    case 'note-unsaved':
      updateActivePreviewNote((loadedVaultNote) => ({ ...loadedVaultNote, noteSaveState: 'unsaved' }))
      break
    case 'note-saving':
      updateActivePreviewNote((loadedVaultNote) => ({ ...loadedVaultNote, noteSaveState: 'saving' }))
      break
    case 'note-save-failed':
      // The words the vault uses when another program holds the file.
      updateActivePreviewNote((loadedVaultNote) => ({ ...loadedVaultNote, noteSaveState: 'save-failed', noteSaveErrorMessage: 'File In Use' }))
      break
    case 'note-locked':
      usePapelizWorkspaceStore.setState({ lockedVaultEntryRelativePaths: [papelizEyePreviewerActiveNoteRelativePath] })
      break
    case 'note-locked-by-folder':
      usePapelizWorkspaceStore.setState({ lockedVaultEntryRelativePaths: ['Projects'] })
      break
    case 'file-list-reading':
      usePapelizWorkspaceStore.setState({ vaultTreeEntries: [], vaultTreeLoadState: 'loading' })
      break
    case 'file-list-failed':
      usePapelizWorkspaceStore.setState({ vaultTreeEntries: [], vaultTreeLoadState: 'load-failed' })
      break
    case 'assistant-not-set-up':
    case 'assistant-ready':
    case 'assistant-answered':
    case 'assistant-writing':
    case 'assistant-changes-waiting':
    case 'assistant-provider-error':
      applyAssistantPreviewState(previewVault.papelizVaultId, workspaceEyePreviewerState)
      break
    case 'toast-info':
      // The words the file list uses after Move to Trash.
      workspaceState.showWorkspaceNotice('info', 'Moved “Inbox” to the trash.')
      break
    case 'toast-error':
      workspaceState.showWorkspaceNotice('error', 'Couldn’t save the chat (Disk Full)')
      break
    case 'toast-error-try-again':
      workspaceState.showWorkspaceNotice('error', describePapelizFolderAccessOffReason('chooser-unavailable'), {
        workspaceNoticeActionLabel: 'Try again',
        onWorkspaceNoticeAction: () => undefined,
      })
      break
    case 'focus-mode':
      workspaceState.setFocusModeOn(true)
      break
    case 'close-vault-question':
      workspaceState.setVaultCloseConfirmationShown(true)
      break
    case 'note-md-code':
    case 'note-md-view':
    case 'no-note-open':
    case 'many-notes-open':
    case 'vault-empty':
      break
  }
}
