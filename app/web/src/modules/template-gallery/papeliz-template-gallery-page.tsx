import { Eye, Hourglass, LayoutTemplate, RefreshCw, RotateCcw, Search, Upload, WifiOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { pickFreePapelizBrowserVaultName, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { usePapelizBrowserStorageStore } from '../workspace/papeliz-browser-storage-store'
import { PapelizNewVaultForm, type PapelizNewVaultPlace } from '../workspace/papeliz-new-vault-form'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizTemplateGalleryRow, PapelizTemplateGalleryTab, PapelizTemplateVaultFolderImporter } from './papeliz-template-gallery-contract'
import {
  describeTemplateGalleryDay,
  describeTemplateGalleryRowDetail,
  describeTemplateGalleryTag,
  PapelizTemplateGalleryCenteredStep,
  PapelizTemplateGalleryRowDetail,
  PapelizTemplateGalleryRowTags,
  PapelizTemplateGalleryThumbnail,
  PapelizTemplateGalleryVotePill,
  type PapelizTemplateAuthorPictureUrlBuilder,
  type PapelizTemplateGalleryScreenModel,
} from './papeliz-template-gallery-page-parts'
import { usePapelizTemplateGalleryPagePreviewStore } from './papeliz-template-gallery-page-preview-store'
import { PapelizTemplateGalleryPreviewPage } from './papeliz-template-gallery-preview-page'
import { usePapelizTemplateGalleryStore } from './papeliz-template-gallery-store'
import { PapelizTemplateGallerySubmitPage } from './papeliz-template-gallery-submit-page'
import { PapelizTemplateGalleryTemplatePage } from './papeliz-template-gallery-template-page'
import {
  PapelizTemplateGalleryCommandsPage,
  PapelizTemplateGalleryImportIntoVaultPage,
  PapelizTemplateGalleryNewVaultTemplateStatus,
  PapelizTemplateGalleryVaultImportingPage,
  PapelizTemplateGalleryVaultMakingPage,
} from './papeliz-template-gallery-use-template-page'

// Templates, in the start card in place of Recent Vaults (as Synced Vaults is): the gallery's three
// tabs, Featured, New and Top 100, each a list of rows like Recent Vaults, with tag chips and a search
// that filter it in the browser. A row opens the template's page; its Preview button opens the files,
// read-only. Use Template, on either, reads and checks the template's files, shows the commands it
// names (when it does), then New Vault's form with the template at its top, then the vault being made,
// and opens it. Submit Template checks a GitHub repository's link. In development builds the start
// screen's previewer can hold any of these pages with made-up templates.

// One of the Templates pages. They stack: Back goes to the one before.
export type PapelizTemplateGalleryScreen =
  | { templateGalleryScreenKind: 'gallery' }
  | { templateGalleryScreenKind: 'template-page'; papelizTemplateGalleryId: string }
  | { templateGalleryScreenKind: 'preview'; papelizTemplateGalleryId: string }
  | { templateGalleryScreenKind: 'submit' }
  // Use Template, for a template that runs commands: its commands, to read before going on.
  | { templateGalleryScreenKind: 'commands'; papelizTemplateGalleryId: string }
  | { templateGalleryScreenKind: 'new-vault'; papelizTemplateGalleryId: string; suggestedNewVaultName: string; initialNewVaultPlace?: PapelizNewVaultPlace }
  | { templateGalleryScreenKind: 'making-vault'; papelizTemplateGalleryId: string; newVaultName: string; newVaultPlace: PapelizNewVaultPlace }
  // Import from Template, in an open vault: Import into This Vault, then the files being written.
  | { templateGalleryScreenKind: 'import-into-vault'; papelizTemplateGalleryId: string }
  | { templateGalleryScreenKind: 'importing-into-vault'; papelizTemplateGalleryId: string }

const papelizTemplateGalleryTabChoices = [
  { slidingChoiceValue: 'featured', slidingChoiceContent: 'Featured' },
  { slidingChoiceValue: 'new', slidingChoiceContent: 'New' },
  { slidingChoiceValue: 'top-100', slidingChoiceContent: 'Top 100' },
] as const

const subscribeToNoTemplateGalleryPreview = () => () => undefined

// What a search matches: the name, the description, the author and the tags.
function doesTemplateMatchSearch(templateGalleryRow: PapelizTemplateGalleryRow, lowerCaseSearchText: string): boolean {
  if (lowerCaseSearchText.length === 0) return true
  return [templateGalleryRow.templateName, templateGalleryRow.templateDescription, templateGalleryRow.templateRepositoryOwner, ...templateGalleryRow.templateTags.map(describeTemplateGalleryTag)].some(
    (templateSearchedText) => templateSearchedText.toLowerCase().includes(lowerCaseSearchText),
  )
}

// Import from Template, in an open vault: Use Template brings the template into a new folder of this
// vault instead of making a vault.
export interface PapelizTemplateGalleryVaultImport {
  importingVaultDisplayName: string
  importIntoNewVaultFolder: PapelizTemplateVaultFolderImporter
  // Imported: the new folder, and the template's first note inside it.
  onTemplateImportedIntoVault: (importedVaultFolderRelativePath: string, templateFirstNotePath: string | null) => void
}

interface PapelizTemplateGalleryPageProps {
  templateGalleryPageHeadingId: string
  // For New Vault's form, as on the start screen.
  folderAccessOffReasonText: string | null
  browserVaultOffReasonText: string | null
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  onTemplateGalleryPageClose: () => void
  // A vault made from a template: it opens on the template's first note.
  onTemplateVaultOpen: (papelizOpenVault: PapelizOpenVault, templateFirstNotePath: string) => Promise<void>
  // The folder window failed to open from the click: opening a folder is off until Try Again.
  onVaultFolderChooserUnavailable: () => void
  // Set in an open vault, for Import from Template.
  templateGalleryVaultImport?: PapelizTemplateGalleryVaultImport
}

export function PapelizTemplateGalleryPage({
  templateGalleryPageHeadingId,
  folderAccessOffReasonText,
  browserVaultOffReasonText,
  existingBrowserVaultRecords,
  onTemplateGalleryPageClose,
  onTemplateVaultOpen,
  onVaultFolderChooserUnavailable,
  templateGalleryVaultImport,
}: PapelizTemplateGalleryPageProps) {
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const askBrowserToKeepStorage = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.askBrowserToKeepStorage)
  // A held preview (development builds only) stands in for the gallery store, on the start screen.
  const heldStartScreenTemplateGalleryPreview = usePapelizTemplateGalleryPagePreviewStore((templateGalleryPagePreviewState) => templateGalleryPagePreviewState.heldTemplateGalleryPagePreview)
  const heldTemplateGalleryPagePreview = templateGalleryVaultImport === undefined ? heldStartScreenTemplateGalleryPreview : null
  const previewTemplateGalleryModelStore = heldTemplateGalleryPagePreview?.previewTemplateGalleryModelStore ?? null
  const previewTemplateGalleryScreenModel = useSyncExternalStore(
    previewTemplateGalleryModelStore?.subscribe ?? subscribeToNoTemplateGalleryPreview,
    () => previewTemplateGalleryModelStore?.getState() ?? null,
  )
  const liveTemplateGalleryScreenModel: PapelizTemplateGalleryScreenModel = usePapelizTemplateGalleryStore()
  const templateGalleryScreenModel = previewTemplateGalleryScreenModel ?? liveTemplateGalleryScreenModel
  const { openTemplateGallery, cancelTemplateUse, resetTemplateCheckRun, resetTemplateRecheck } = templateGalleryScreenModel

  const [templateGalleryScreens, setTemplateGalleryScreens] = useState<readonly PapelizTemplateGalleryScreen[]>(
    () => heldTemplateGalleryPagePreview?.previewTemplateGalleryScreens ?? [{ templateGalleryScreenKind: 'gallery' }],
  )
  // A page opened from another moves focus to its heading; the gallery opened from the start screen
  // leaves focus on Templates' button, as Synced Vaults does.
  const [isTemplateGalleryScreenChanged, setTemplateGalleryScreenChanged] = useState(false)
  const shownTemplateGalleryScreen: PapelizTemplateGalleryScreen = templateGalleryScreens[templateGalleryScreens.length - 1] ?? { templateGalleryScreenKind: 'gallery' }
  // Why Import into This Vault didn't import, shown on its page (a notice would sit under the dialog).
  const [templateVaultImportFailureMessage, setTemplateVaultImportFailureMessage] = useState<string | null>(null)
  const [templateGallerySearchText, setTemplateGallerySearchText] = useState('')
  const [chosenTemplateGalleryTag, setChosenTemplateGalleryTag] = useState<string | null>(null)
  // When the pages opened: "Listed 2 days ago" and the New tag count from it.
  const [templateGalleryOpenedAt] = useState(() => Date.now())

  // The gallery opens on Featured; a build with the Templates server asks it for New and Top 100.
  useEffect(() => {
    void openTemplateGallery()
  }, [openTemplateGallery])
  // Leaving Templates stops a read under way and forgets what Use Template, Check and Recheck had
  // found. (A held preview keeps its own, so a page picked again opens the same.)
  useEffect(
    () => () => {
      const liveTemplateGalleryStoreState = usePapelizTemplateGalleryStore.getState()
      liveTemplateGalleryStoreState.cancelTemplateUse()
      liveTemplateGalleryStoreState.resetTemplateCheckRun()
      liveTemplateGalleryStoreState.resetTemplateRecheck()
    },
    [],
  )

  const openTemplateGalleryScreen = (openedTemplateGalleryScreen: PapelizTemplateGalleryScreen) => {
    setTemplateGalleryScreenChanged(true)
    setTemplateGalleryScreens((previousTemplateGalleryScreens) => [...previousTemplateGalleryScreens, openedTemplateGalleryScreen])
  }
  // The shown page gives way to another, so Back skips it (the commands, once read).
  const replaceTemplateGalleryScreen = (replacingTemplateGalleryScreen: PapelizTemplateGalleryScreen) => {
    setTemplateGalleryScreenChanged(true)
    setTemplateGalleryScreens((previousTemplateGalleryScreens) => [...previousTemplateGalleryScreens.slice(0, -1), replacingTemplateGalleryScreen])
  }
  // Back: the page before, or out of Templates from the gallery. A template's page or Preview closing
  // forgets its Recheck, so the next one opened starts fresh.
  const closeShownTemplateGalleryScreen = () => {
    if (templateGalleryScreens.length <= 1) {
      onTemplateGalleryPageClose()
      return
    }
    if (shownTemplateGalleryScreen.templateGalleryScreenKind === 'template-page' || shownTemplateGalleryScreen.templateGalleryScreenKind === 'preview') resetTemplateRecheck()
    setTemplateGalleryScreenChanged(true)
    setTemplateGalleryScreens((previousTemplateGalleryScreens) => previousTemplateGalleryScreens.slice(0, -1))
  }

  // Use Template: its files are read and checked while the commands (for a template that runs them)
  // or New Vault's form show.
  const startUsingTemplate = (templateGalleryRow: PapelizTemplateGalleryRow) => {
    void templateGalleryScreenModel.prepareTemplateUse(templateGalleryRow)
    openTemplateGalleryScreen(
      templateGalleryRow.isTemplateRunningCommands
        ? { templateGalleryScreenKind: 'commands', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId }
        : buildTemplateTargetScreen(templateGalleryRow),
    )
  }
  // Where Use Template goes once any commands are read: New Vault's form, or Import into This Vault.
  const buildTemplateTargetScreen = (templateGalleryRow: PapelizTemplateGalleryRow): PapelizTemplateGalleryScreen =>
    templateGalleryVaultImport === undefined
      ? {
          templateGalleryScreenKind: 'new-vault',
          papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId,
          suggestedNewVaultName: pickFreePapelizBrowserVaultName(templateGalleryRow.templateName, existingBrowserVaultRecords),
        }
      : { templateGalleryScreenKind: 'import-into-vault', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId }

  // Import into This Vault, from its click: the files are written into a new folder with their progress
  // showing; then the gallery closes on the template's first note. If it isn't imported, the page comes
  // back with what went wrong.
  const importTemplateIntoVault = async (templateGalleryRow: PapelizTemplateGalleryRow, vaultImport: PapelizTemplateGalleryVaultImport) => {
    setTemplateVaultImportFailureMessage(null)
    replaceTemplateGalleryScreen({ templateGalleryScreenKind: 'importing-into-vault', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId })
    const templateImportResult = await templateGalleryScreenModel.importPapelizTemplateIntoVault(vaultImport.importIntoNewVaultFolder)
    if (templateImportResult.vaultFolderImportOutcome === 'imported') {
      vaultImport.onTemplateImportedIntoVault(templateImportResult.importedVaultFolderRelativePath, templateImportResult.templateFirstNotePath)
      return
    }
    replaceTemplateGalleryScreen({ templateGalleryScreenKind: 'import-into-vault', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId })
    setTemplateVaultImportFailureMessage(templateImportResult.vaultFolderImportFailureMessage)
  }
  const cancelUsingTemplate = () => {
    cancelTemplateUse()
    closeShownTemplateGalleryScreen()
  }

  // New Vault's form confirmed, from its click (Folder Storage opens the folder window first). The vault
  // is made with its progress showing, then opens; if it isn't, the form comes back with the name typed.
  const makeTemplateVault = async (templateGalleryRow: PapelizTemplateGalleryRow, typedNewVaultName: string, chosenNewVaultPlace: PapelizNewVaultPlace) => {
    if (chosenNewVaultPlace === 'browser-vault-in-opfs') askBrowserToKeepStorage()
    replaceTemplateGalleryScreen({
      templateGalleryScreenKind: 'making-vault',
      papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId,
      newVaultName: typedNewVaultName,
      newVaultPlace: chosenNewVaultPlace,
    })
    const templateVaultMakeResult = await templateGalleryScreenModel.makePapelizTemplateVault(typedNewVaultName, chosenNewVaultPlace)
    if (templateVaultMakeResult.openVaultOutcome === 'opened') {
      await onTemplateVaultOpen(templateVaultMakeResult.papelizOpenVault, templateVaultMakeResult.templateFirstNotePath ?? templateGalleryRow.templateFirstNotePath)
      return
    }
    replaceTemplateGalleryScreen({
      templateGalleryScreenKind: 'new-vault',
      papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId,
      suggestedNewVaultName: typedNewVaultName,
      initialNewVaultPlace: chosenNewVaultPlace,
    })
    if (templateVaultMakeResult.openVaultOutcome === 'cancelled') showWorkspaceNotice('info', 'No folder opened.')
    else if (templateVaultMakeResult.openVaultOutcome === 'chooser-unavailable') onVaultFolderChooserUnavailable()
    else showWorkspaceNotice(heldTemplateGalleryPagePreview === null ? 'error' : 'info', templateVaultMakeResult.openVaultFailureMessage)
  }

  if (shownTemplateGalleryScreen.templateGalleryScreenKind === 'submit') {
    return (
      <PapelizTemplateGallerySubmitPage
        templateGalleryPageHeadingId={templateGalleryPageHeadingId}
        templateCheckRunState={templateGalleryScreenModel.templateCheckRunState}
        onTemplateRepositoryLinkCheck={(typedTemplateRepositoryLink) => void templateGalleryScreenModel.checkTemplateRepositoryLink(typedTemplateRepositoryLink)}
        onTemplateCheckRunReset={resetTemplateCheckRun}
        onSubmitTemplatePageClose={() => {
          resetTemplateCheckRun()
          closeShownTemplateGalleryScreen()
        }}
      />
    )
  }

  if (shownTemplateGalleryScreen.templateGalleryScreenKind !== 'gallery') {
    const shownTemplateGalleryRow = templateGalleryScreenModel.findTemplateGalleryRow(shownTemplateGalleryScreen.papelizTemplateGalleryId)
    if (shownTemplateGalleryRow === null) {
      // The gallery read again without it: Templates shows instead.
      return (
        <PapelizTemplateGalleryCenteredStep TemplateGalleryStepIcon={LayoutTemplate} templateGalleryStepTitle="This template isn’t listed now" templateGalleryStepText="It may have been taken off the gallery.">
          <PapelizPillButton pillButtonVariant="outline" className="mt-2" onClick={() => setTemplateGalleryScreens([{ templateGalleryScreenKind: 'gallery' }])}>
            Back to Templates
          </PapelizPillButton>
        </PapelizTemplateGalleryCenteredStep>
      )
    }
    const { templateUseState } = templateGalleryScreenModel
    const isThisTemplateInUse = templateUseState.templateUseStage !== 'idle' && templateUseState.templateGalleryRow.papelizTemplateGalleryId === shownTemplateGalleryRow.papelizTemplateGalleryId
    // Checked files that turn out to bring commands the gallery didn't mark: they show before the form.
    const areTemplateCommandsUnread =
      isThisTemplateInUse && templateUseState.templateUseStage === 'ready' && templateUseState.templateRunCommands.length > 0 && !templateUseState.isTemplateRunCommandsAcknowledged
    switch (shownTemplateGalleryScreen.templateGalleryScreenKind) {
      case 'template-page':
        return (
          <PapelizTemplateGalleryTemplatePage
            key={shownTemplateGalleryRow.papelizTemplateGalleryId}
            templateGalleryPageHeadingId={templateGalleryPageHeadingId}
            isTemplateGalleryPageHeadingFocusedFirst={isTemplateGalleryScreenChanged}
            templateGalleryRow={shownTemplateGalleryRow}
            templateGalleryScreenModel={templateGalleryScreenModel}
            templateGalleryOpenedAt={templateGalleryOpenedAt}
            onTemplatePageClose={closeShownTemplateGalleryScreen}
            onTemplatePreviewOpen={() => openTemplateGalleryScreen({ templateGalleryScreenKind: 'preview', papelizTemplateGalleryId: shownTemplateGalleryRow.papelizTemplateGalleryId })}
            onTemplateUse={() => startUsingTemplate(shownTemplateGalleryRow)}
          />
        )
      case 'preview':
        return (
          <PapelizTemplateGalleryPreviewPage
            key={shownTemplateGalleryRow.papelizTemplateGalleryId}
            templateGalleryPageHeadingId={templateGalleryPageHeadingId}
            isTemplateGalleryPageHeadingFocusedFirst={isTemplateGalleryScreenChanged}
            templateGalleryRow={shownTemplateGalleryRow}
            templateGalleryScreenModel={templateGalleryScreenModel}
            templateGalleryOpenedAt={templateGalleryOpenedAt}
            onTemplatePreviewClose={closeShownTemplateGalleryScreen}
            onTemplateUse={() => startUsingTemplate(shownTemplateGalleryRow)}
          />
        )
      case 'commands':
      case 'new-vault':
      case 'import-into-vault': {
        if (shownTemplateGalleryScreen.templateGalleryScreenKind === 'commands' || areTemplateCommandsUnread) {
          return (
            <PapelizTemplateGalleryCommandsPage
              key={shownTemplateGalleryRow.papelizTemplateGalleryId}
              templateGalleryPageHeadingId={templateGalleryPageHeadingId}
              templateGalleryRow={shownTemplateGalleryRow}
              templateUseState={isThisTemplateInUse ? templateUseState : { templateUseStage: 'idle' }}
              onTemplateCommandsCancel={cancelUsingTemplate}
              onTemplateCommandsAccept={() => {
                templateGalleryScreenModel.acknowledgeTemplateRunCommands(true)
                if (shownTemplateGalleryScreen.templateGalleryScreenKind !== 'commands') return
                replaceTemplateGalleryScreen(buildTemplateTargetScreen(shownTemplateGalleryRow))
              }}
            />
          )
        }
        if (shownTemplateGalleryScreen.templateGalleryScreenKind === 'import-into-vault') {
          if (templateGalleryVaultImport === undefined) return null
          return (
            <PapelizTemplateGalleryImportIntoVaultPage
              key={shownTemplateGalleryRow.papelizTemplateGalleryId}
              templateGalleryPageHeadingId={templateGalleryPageHeadingId}
              templateGalleryRow={shownTemplateGalleryRow}
              importingVaultDisplayName={templateGalleryVaultImport.importingVaultDisplayName}
              templateUseState={isThisTemplateInUse ? templateUseState : { templateUseStage: 'idle' }}
              onTemplateImportCancel={cancelUsingTemplate}
              templateVaultImportFailureMessage={templateVaultImportFailureMessage}
              onTemplateImportConfirm={() => void importTemplateIntoVault(shownTemplateGalleryRow, templateGalleryVaultImport)}
            />
          )
        }
        return (
          <PapelizNewVaultForm
            key={`${shownTemplateGalleryRow.papelizTemplateGalleryId}-${templateGalleryScreens.length}`}
            newVaultFormHeadingId={templateGalleryPageHeadingId}
            folderAccessOffReasonText={folderAccessOffReasonText}
            browserVaultOffReasonText={browserVaultOffReasonText}
            suggestedNewVaultName={shownTemplateGalleryScreen.suggestedNewVaultName}
            initialNewVaultPlace={shownTemplateGalleryScreen.initialNewVaultPlace}
            existingBrowserVaultRecords={existingBrowserVaultRecords}
            newVaultFromTemplate={{
              newVaultTemplateName: shownTemplateGalleryRow.templateName,
              newVaultTemplateDetailLine: describeTemplateGalleryRowDetail(shownTemplateGalleryRow),
              newVaultTemplateThumbnail: <PapelizTemplateGalleryThumbnail templateGalleryRow={shownTemplateGalleryRow} templateThumbnailSize="row" />,
              newVaultTemplateStatus: <PapelizTemplateGalleryNewVaultTemplateStatus templateUseState={isThisTemplateInUse ? templateUseState : { templateUseStage: 'idle' }} />,
            }}
            isNewVaultConfirmHeld={!isThisTemplateInUse || templateUseState.templateUseStage !== 'ready'}
            onNewVaultConfirm={(typedNewVaultName, chosenNewVaultPlace) => void makeTemplateVault(shownTemplateGalleryRow, typedNewVaultName, chosenNewVaultPlace)}
            onNewVaultCancel={cancelUsingTemplate}
          />
        )
      }
      case 'making-vault':
        return (
          <PapelizTemplateGalleryVaultMakingPage
            templateGalleryPageHeadingId={templateGalleryPageHeadingId}
            templateGalleryRow={shownTemplateGalleryRow}
            newVaultName={shownTemplateGalleryScreen.newVaultName}
            newVaultPlace={shownTemplateGalleryScreen.newVaultPlace}
            templateUseState={isThisTemplateInUse ? templateUseState : { templateUseStage: 'idle' }}
          />
        )
      case 'importing-into-vault':
        return (
          <PapelizTemplateGalleryVaultImportingPage
            templateGalleryPageHeadingId={templateGalleryPageHeadingId}
            templateGalleryRow={shownTemplateGalleryRow}
            importingVaultDisplayName={templateGalleryVaultImport?.importingVaultDisplayName ?? ''}
            templateUseState={isThisTemplateInUse ? templateUseState : { templateUseStage: 'idle' }}
          />
        )
    }
  }

  return (
    <PapelizTemplateGalleryList
      templateGalleryPageHeadingId={templateGalleryPageHeadingId}
      isTemplateGalleryPageHeadingFocusedFirst={isTemplateGalleryScreenChanged}
      templateGalleryScreenModel={templateGalleryScreenModel}
      templateGalleryOpenedAt={templateGalleryOpenedAt}
      templateGallerySearchText={templateGallerySearchText}
      chosenTemplateGalleryTag={chosenTemplateGalleryTag}
      onTemplateGallerySearchTextChange={setTemplateGallerySearchText}
      onTemplateGalleryTagChoose={setChosenTemplateGalleryTag}
      onTemplateGalleryClose={onTemplateGalleryPageClose}
      isTemplateGalleryImportingIntoVault={templateGalleryVaultImport !== undefined}
      onTemplatePageOpen={(templateGalleryRow) => openTemplateGalleryScreen({ templateGalleryScreenKind: 'template-page', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId })}
      onTemplatePreviewOpen={(templateGalleryRow) => openTemplateGalleryScreen({ templateGalleryScreenKind: 'preview', papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId })}
      onSubmitTemplateOpen={() => openTemplateGalleryScreen({ templateGalleryScreenKind: 'submit' })}
    />
  )
}

interface PapelizTemplateGalleryListProps {
  templateGalleryPageHeadingId: string
  isTemplateGalleryPageHeadingFocusedFirst: boolean
  templateGalleryScreenModel: PapelizTemplateGalleryScreenModel
  templateGalleryOpenedAt: number
  templateGallerySearchText: string
  chosenTemplateGalleryTag: string | null
  onTemplateGallerySearchTextChange: (templateGallerySearchText: string) => void
  onTemplateGalleryTagChoose: (templateGalleryTag: string | null) => void
  onTemplateGalleryClose: () => void
  // In an open vault, an ✕ at the heading's right end closes the Templates dialog. The start screen's
  // Templates has none.
  isTemplateGalleryImportingIntoVault: boolean
  onTemplatePageOpen: (templateGalleryRow: PapelizTemplateGalleryRow) => void
  onTemplatePreviewOpen: (templateGalleryRow: PapelizTemplateGalleryRow) => void
  onSubmitTemplateOpen: () => void
}

// The gallery itself: its heading (the title; search, Refresh and Submit Template, then ✕ in an open
// vault), the three tabs and the tag chips, and the chosen tab's rows, or why there are none.
function PapelizTemplateGalleryList({
  templateGalleryPageHeadingId,
  isTemplateGalleryPageHeadingFocusedFirst,
  templateGalleryScreenModel,
  templateGalleryOpenedAt,
  templateGallerySearchText,
  chosenTemplateGalleryTag,
  onTemplateGallerySearchTextChange,
  onTemplateGalleryTagChoose,
  onTemplateGalleryClose,
  isTemplateGalleryImportingIntoVault,
  onTemplatePageOpen,
  onTemplatePreviewOpen,
  onSubmitTemplateOpen,
}: PapelizTemplateGalleryListProps) {
  const templateGalleryHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (isTemplateGalleryPageHeadingFocusedFirst) templateGalleryHeadingRef.current?.focus({ preventScroll: true })
  }, [isTemplateGalleryPageHeadingFocusedFirst])

  const { templateGalleryTab, templateGallerySnapshotState, featuredTemplateGalleryRows, newTemplateGalleryRows, topTemplateGalleryRows, selectTemplateGalleryTab } = templateGalleryScreenModel
  // Refresh asks for the list again and stays on the tab.
  const refreshTemplateGallery = () => void templateGalleryScreenModel.refreshTemplateGallery()
  const chosenTabTemplateGalleryRows =
    templateGalleryTab === 'featured' ? featuredTemplateGalleryRows : templateGalleryTab === 'new' ? newTemplateGalleryRows : topTemplateGalleryRows
  // The chips: every tag the gallery's templates carry, in A to Z order.
  const templateGalleryTags = useMemo(
    () =>
      [...new Set([...featuredTemplateGalleryRows, ...newTemplateGalleryRows, ...topTemplateGalleryRows].flatMap((templateGalleryRow) => templateGalleryRow.templateTags))].sort(
        (firstTemplateTag, secondTemplateTag) => describeTemplateGalleryTag(firstTemplateTag).localeCompare(describeTemplateGalleryTag(secondTemplateTag)),
      ),
    [featuredTemplateGalleryRows, newTemplateGalleryRows, topTemplateGalleryRows],
  )
  const lowerCaseSearchText = templateGallerySearchText.trim().toLowerCase()
  const shownTemplateGalleryRows = chosenTabTemplateGalleryRows.filter(
    (templateGalleryRow) =>
      (chosenTemplateGalleryTag === null || templateGalleryRow.templateTags.includes(chosenTemplateGalleryTag)) && doesTemplateMatchSearch(templateGalleryRow, lowerCaseSearchText),
  )
  // New and Top 100 come from the Templates server's list; Featured is built into the app.
  const isChosenTabFromServer = templateGalleryTab !== 'featured'
  const templateGallerySnapshotStage = templateGallerySnapshotState.templateGallerySnapshotStage
  const isTemplateGalleryRefreshTurning = templateGallerySnapshotStage === 'loading'

  let templateGalleryListBody
  if (isChosenTabFromServer && templateGallerySnapshotStage === 'not-available-yet') {
    templateGalleryListBody = (
      <PapelizTemplateGalleryCenteredStep
        TemplateGalleryStepIcon={Hourglass}
        templateGalleryStepTitle={templateGalleryTab === 'new' ? 'New isn’t available yet' : 'Top 100 isn’t available yet'}
        templateGalleryStepText={
          templateGalleryTab === 'new'
            ? 'Templates people submit show here, newest first, once the Templates server is running. Featured is ready now.'
            : 'The hundred best by votes show here once the Templates server is running. Featured is ready now.'
        }
      >
        <PapelizPillButton pillButtonVariant="outline" className="mt-2 pointer-coarse:h-10" onClick={() => selectTemplateGalleryTab('featured')}>
          See Featured
        </PapelizPillButton>
      </PapelizTemplateGalleryCenteredStep>
    )
  } else if (isChosenTabFromServer && templateGallerySnapshotStage === 'loading') {
    templateGalleryListBody = <PapelizTemplateGalleryCenteredStep isTemplateGalleryStepWaiting templateGalleryStepTitle="Reading Templates…" />
  } else if (isChosenTabFromServer && templateGallerySnapshotState.templateGallerySnapshotStage === 'offline') {
    templateGalleryListBody = (
      <PapelizTemplateGalleryCenteredStep TemplateGalleryStepIcon={WifiOff} templateGalleryStepTitle="Templates can’t be reached" templateGalleryStepText={templateGallerySnapshotState.templateGallerySnapshotProblemSentence}>
        <PapelizPillButton pillButtonVariant="outline" className="mt-2 pointer-coarse:h-10" onClick={refreshTemplateGallery}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Try Again
        </PapelizPillButton>
      </PapelizTemplateGalleryCenteredStep>
    )
  } else if (chosenTabTemplateGalleryRows.length === 0) {
    templateGalleryListBody = (
      <PapelizTemplateGalleryCenteredStep
        TemplateGalleryStepIcon={LayoutTemplate}
        templateGalleryStepTitle="No templates here yet"
        templateGalleryStepText={templateGalleryTab === 'featured' ? 'Featured templates show here once they’re picked.' : 'Submit one of your own from GitHub.'}
      />
    )
  } else {
    templateGalleryListBody = (
      <ul className="flex flex-col gap-1.5">
        {shownTemplateGalleryRows.length === 0 && (
          <li className="px-1 py-6 text-center text-[12.5px] text-papeliz-ink-muted">
            {lowerCaseSearchText.length > 0 ? `No template matches “${templateGallerySearchText.trim()}”` : 'No template has this tag'}
            {lowerCaseSearchText.length > 0 && chosenTemplateGalleryTag !== null ? ' with this tag.' : '.'}
          </li>
        )}
        {shownTemplateGalleryRows.map((templateGalleryRow) => (
          <PapelizTemplateGalleryRowItem
            key={templateGalleryRow.papelizTemplateGalleryId}
            templateGalleryRow={templateGalleryRow}
            isTemplateTopRankShown={templateGalleryTab === 'top-100'}
            isTemplateListedDayShown={templateGalleryTab === 'new'}
            templateGalleryOpenedAt={templateGalleryOpenedAt}
            buildTemplateAuthorPictureUrl={templateGalleryScreenModel.buildTemplateAuthorPictureUrl}
            onTemplatePageOpen={() => onTemplatePageOpen(templateGalleryRow)}
            onTemplatePreviewOpen={() => onTemplatePreviewOpen(templateGalleryRow)}
          />
        ))}
      </ul>
    )
  }

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onTemplateGalleryClose()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      {/* Heading, as Recent Vaults': the title on the left; search, Refresh and Submit Template on the
          right, which take a line of their own on a phone. In an open vault's dialog, ✕ closes it last,
          after a thin divider. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 px-3 pt-[11px] pb-1 sm:flex-nowrap">
        <div className="flex min-w-0 flex-none items-center gap-2">
          <h2 ref={templateGalleryHeadingRef} id={templateGalleryPageHeadingId} tabIndex={-1} className="text-[18px] font-semibold tracking-[-0.01em] focus:outline-none">
            Templates
          </h2>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1.5 max-sm:w-full sm:flex-1">
          <label className="flex h-8 min-w-24 flex-1 items-center gap-2 rounded-full border border-papeliz-line bg-papeliz-surface px-3 text-papeliz-ink-subtle focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] sm:max-w-[190px] pointer-coarse:h-10">
            <Search className="size-3.5 flex-none" aria-hidden="true" />
            <span className="sr-only">Find a template</span>
            <input
              type="search"
              value={templateGallerySearchText}
              onChange={(changeEvent) => onTemplateGallerySearchTextChange(changeEvent.target.value)}
              placeholder="Search templates"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-papeliz-ink placeholder:text-papeliz-ink-subtle focus:outline-none"
            />
          </label>
          <button
            type="button"
            aria-label="Refresh"
            title="Refresh"
            aria-busy={isTemplateGalleryRefreshTurning || undefined}
            onClick={refreshTemplateGallery}
            className="grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink pointer-coarse:size-10"
          >
            <RefreshCw className={joinPapelizClassNames('size-4', isTemplateGalleryRefreshTurning && 'animate-spin')} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Submit Template"
            title="Submit Template"
            onClick={onSubmitTemplateOpen}
            className="grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink pointer-coarse:size-10"
          >
            <Upload className="size-4" aria-hidden="true" />
          </button>
          {isTemplateGalleryImportingIntoVault && (
            <>
              <span aria-hidden="true" className="mx-0.5 h-5 w-px flex-none bg-papeliz-line" />
              <PapelizIconButton iconButtonLabel="Close Templates" iconButtonSize="small" className="pointer-coarse:size-10" onClick={onTemplateGalleryClose}>
                <X className="size-4" aria-hidden="true" />
              </PapelizIconButton>
            </>
          )}
        </div>
      </div>
      <p className="px-3 text-[12.5px] text-papeliz-ink-muted">{isTemplateGalleryImportingIntoVault ? 'Bring one the community made into this vault, in a folder of its own.' : 'Start a vault from one the community made.'}</p>

      {/* The tabs, then the tag chips (All first), in one line that scrolls sideways when it runs out. */}
      <div className="px-3 pt-2.5">
        <PapelizSlidingChoiceGroup<PapelizTemplateGalleryTab>
          slidingChoiceGroupLabel="Templates"
          slidingChoiceGroupRole="tablist"
          slidingChoiceGroupTone="solid-blue"
          slidingChoices={papelizTemplateGalleryTabChoices}
          chosenSlidingChoiceValue={templateGalleryTab}
          onSlidingChoiceSelect={selectTemplateGalleryTab}
          slidingChoiceGroupClassName="w-[280px] max-w-full"
        />
      </div>
      {templateGalleryTags.length > 0 && chosenTabTemplateGalleryRows.length > 0 && (
        <div role="group" aria-label="Tags" className="flex flex-none gap-1.5 overflow-x-auto px-3 pt-2 pb-0.5 [scrollbar-width:none]">
          {[null, ...templateGalleryTags].map((templateGalleryTag) => (
            <button
              key={templateGalleryTag ?? 'all'}
              type="button"
              aria-pressed={chosenTemplateGalleryTag === templateGalleryTag}
              onClick={() => onTemplateGalleryTagChoose(templateGalleryTag)}
              className="inline-flex h-6 flex-none items-center rounded-full border border-papeliz-line px-2.5 text-[11.5px] font-semibold whitespace-nowrap text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:border-papeliz-blue-line aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue pointer-coarse:h-8"
            >
              {templateGalleryTag === null ? 'All' : describeTemplateGalleryTag(templateGalleryTag)}
            </button>
          ))}
        </div>
      )}

      <div
        role="tabpanel"
        aria-label={papelizTemplateGalleryTabChoices.find((tabChoice) => tabChoice.slidingChoiceValue === templateGalleryTab)?.slidingChoiceContent}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2 pb-3"
      >
        {templateGalleryListBody}
      </div>

      {templateGallerySnapshotStage === 'not-available-yet' && templateGalleryTab === 'featured' && featuredTemplateGalleryRows.length > 0 && (
        <p className="px-3 pb-2.5 text-[11px] text-papeliz-ink-subtle">Votes, New and Top 100 open with the Templates server.</p>
      )}
    </div>
  )
}

interface PapelizTemplateGalleryRowItemProps {
  templateGalleryRow: PapelizTemplateGalleryRow
  isTemplateTopRankShown: boolean
  // New's rows say when each was listed.
  isTemplateListedDayShown: boolean
  templateGalleryOpenedAt: number
  buildTemplateAuthorPictureUrl: PapelizTemplateAuthorPictureUrlBuilder
  onTemplatePageOpen: () => void
  onTemplatePreviewOpen: () => void
}

// One template's row, as a Recent Vaults row: Top 100's rank, the thumbnail, the name with its tags, and
// the author's picture and name, license and file count; at the right the vote pill and Preview.
// Pressing the row opens the template's page. On a phone the votes and Preview take a line of their own.
function PapelizTemplateGalleryRowItem({
  templateGalleryRow,
  isTemplateTopRankShown,
  isTemplateListedDayShown,
  templateGalleryOpenedAt,
  buildTemplateAuthorPictureUrl,
  onTemplatePageOpen,
  onTemplatePreviewOpen,
}: PapelizTemplateGalleryRowItemProps) {
  const templateListedDay =
    isTemplateListedDayShown && templateGalleryRow.templateListedAt !== null ? describeTemplateGalleryDay(templateGalleryRow.templateListedAt, templateGalleryOpenedAt) : null
  return (
    <li className="group flex items-center rounded-xl border border-papeliz-line bg-papeliz-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40 hover:shadow-papeliz-card max-sm:flex-wrap">
      <button type="button" onClick={onTemplatePageOpen} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-left max-sm:pb-1">
        {isTemplateTopRankShown && templateGalleryRow.templateTopRank !== null && (
          <span className="w-5 flex-none text-right text-[12.5px] font-bold text-papeliz-ink-subtle tabular-nums">
            <span className="sr-only">Rank </span>
            {templateGalleryRow.templateTopRank}
          </span>
        )}
        <PapelizTemplateGalleryThumbnail templateGalleryRow={templateGalleryRow} templateThumbnailSize="row" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="min-w-0 truncate text-[13.5px] font-semibold">{templateGalleryRow.templateName}</span>
            <PapelizTemplateGalleryRowTags templateGalleryRow={templateGalleryRow} currentTime={templateGalleryOpenedAt} />
          </span>
          <PapelizTemplateGalleryRowDetail templateGalleryRow={templateGalleryRow} templateListedDay={templateListedDay} buildTemplateAuthorPictureUrl={buildTemplateAuthorPictureUrl} />
        </span>
      </button>
      <span className="mr-2.5 flex flex-none items-center gap-2 max-sm:mr-0 max-sm:w-full max-sm:justify-end max-sm:px-2.5 max-sm:pb-2">
        <PapelizTemplateGalleryVotePill templateGalleryRow={templateGalleryRow} />
        <PapelizPillButton
          pillButtonVariant="outline"
          pillButtonSize="small"
          aria-label={`Preview ${templateGalleryRow.templateName}`}
          onClick={onTemplatePreviewOpen}
          className="h-7 gap-1.5 px-2.5 text-[12px] pointer-coarse:h-10"
        >
          <Eye className="size-3.5 flex-none" aria-hidden="true" />
          Preview
        </PapelizPillButton>
      </span>
    </li>
  )
}
