import { reportPapelizSyncVaultFileSaved } from '../sync/papeliz-sync-workspace-reports'
import { PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'

// Where Imagine's pictures and Transcribe's kept recordings go in the vault, and the Markdown that
// puts a picture into a note. One visible folder at the vault's top, `Attachments/`, so the files
// sit beside the notes, travel with the vault and are synced like any other file. A note links to
// a file by its path from the note's own folder ("../Attachments/…"), which every Markdown app reads.

export const papelizAssistantMediaAttachmentsFolderRelativePath = 'Attachments'

// Lowercase words joined by dashes, at most `maximumSlugLength` characters: "a-red-fox-in-snow".
export function slugifyPapelizMediaFileWords(fileWordsText: string, maximumSlugLength = 48): string {
  const fileWordsSlug = fileWordsText
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return fileWordsSlug.slice(0, maximumSlugLength).replace(/-+$/g, '')
}

// "2026-11-03-0612", in this device's time.
export function formatPapelizMediaFileTimestamp(fileDate: Date): string {
  const padTwoDigits = (dateNumber: number) => String(dateNumber).padStart(2, '0')
  return `${fileDate.getFullYear()}-${padTwoDigits(fileDate.getMonth() + 1)}-${padTwoDigits(fileDate.getDate())}-${padTwoDigits(fileDate.getHours())}${padTwoDigits(fileDate.getMinutes())}`
}

// "imagine-2026-11-03-0612-a-red-fox-in-snow": what a file is, when it was made and what of.
export function buildPapelizMediaFileBaseName(mediaFileKindWord: string, fileDate: Date, fileWordsText: string): string {
  const fileWordsSlug = slugifyPapelizMediaFileWords(fileWordsText)
  return [mediaFileKindWord, formatPapelizMediaFileTimestamp(fileDate), fileWordsSlug].filter((fileNamePart) => fileNamePart.length > 0).join('-')
}

// The path from a note's folder to a vault file, for a link in that note.
export function buildPapelizVaultFileLinkPathFromNote(fromVaultNoteRelativePath: string, toVaultFileRelativePath: string): string {
  const fromFolderSegments = splitVaultRelativePath(getVaultEntryParentFolderRelativePath(fromVaultNoteRelativePath))
  const toFileSegments = splitVaultRelativePath(toVaultFileRelativePath)
  let sharedSegmentCount = 0
  while (
    sharedSegmentCount < fromFolderSegments.length &&
    sharedSegmentCount < toFileSegments.length - 1 &&
    fromFolderSegments[sharedSegmentCount] === toFileSegments[sharedSegmentCount]
  ) {
    sharedSegmentCount += 1
  }
  return [...fromFolderSegments.slice(sharedSegmentCount).map(() => '..'), ...toFileSegments.slice(sharedSegmentCount)].join('/')
}

// `![alt](path)`, with the path in angle brackets when it holds a space or a bracket, and the alt
// text kept to one line without brackets.
export function buildPapelizPictureLinkMarkdown(pictureAltText: string, pictureLinkPath: string): string {
  const cleanedPictureAltText = pictureAltText.replace(/[[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  const writtenPictureLinkPath = /[\s()<>]/.test(pictureLinkPath) ? `<${pictureLinkPath.replace(/[<>]/g, '')}>` : pictureLinkPath
  return `![${cleanedPictureAltText}](${writtenPictureLinkPath})`
}

export interface PapelizNoteTextInsertion {
  insertedAtTextOffset: number
  insertedNoteText: string
  editedVaultNoteText: string
}

// Where a note's front matter (the `---` block of properties at its top) ends, or 0 when it has none.
export function findPapelizNoteFrontMatterEndOffset(vaultNoteText: string): number {
  const openingLineMatch = /^---[ \t]*\r?\n/.exec(vaultNoteText)
  if (openingLineMatch === null) return 0
  const closingLinePattern = /^(?:---|\.\.\.)[ \t]*$/gm
  closingLinePattern.lastIndex = openingLineMatch[0].length
  const closingLineMatch = closingLinePattern.exec(vaultNoteText)
  return closingLineMatch === null ? 0 : closingLineMatch.index + closingLineMatch[0].length
}

// A block (a picture link, say) put on lines of its own: after the line the cursor is on, with a blank
// line before and after it, so it never splits a sentence, and never inside the front matter. No cursor
// puts it at the end of the note.
export function insertPapelizBlockAfterCursorLine(vaultNoteText: string, cursorTextOffset: number | null, insertedBlockText: string): PapelizNoteTextInsertion {
  const clampedCursorOffset = cursorTextOffset === null ? vaultNoteText.length : Math.max(0, Math.min(cursorTextOffset, vaultNoteText.length))
  const cursorLineEndOffset = vaultNoteText.indexOf('\n', clampedCursorOffset)
  const insertedAtTextOffset = Math.max(cursorLineEndOffset === -1 ? vaultNoteText.length : cursorLineEndOffset, findPapelizNoteFrontMatterEndOffset(vaultNoteText))
  const textBeforeInsertion = vaultNoteText.slice(0, insertedAtTextOffset)
  const textAfterInsertion = vaultNoteText.slice(insertedAtTextOffset)
  const separatorBefore = textBeforeInsertion.length === 0 || textBeforeInsertion.endsWith('\n\n') ? '' : textBeforeInsertion.endsWith('\n') ? '\n' : '\n\n'
  // The text after starts at the cursor line's own line break, which ends the block's line.
  const separatorAfter = textAfterInsertion.length === 0 ? '\n' : textAfterInsertion.startsWith('\n\n') ? '' : '\n'
  const insertedNoteText = `${separatorBefore}${insertedBlockText}${separatorAfter}`
  return { insertedAtTextOffset, insertedNoteText, editedVaultNoteText: `${textBeforeInsertion}${insertedNoteText}${textAfterInsertion}` }
}

function readOpenVault() {
  const openVault = usePapelizWorkspaceStore.getState().openVault
  if (openVault === null) throw new PapelizVaultOperationError('No Vault Open')
  return openVault
}

// A free path in the vault's `Attachments/` folder for a file of this base name: the name itself, or
// with "-2", "-3"… when that is taken.
export async function pickPapelizFreeMediaFileRelativePath(mediaFileBaseName: string, mediaFileExtension: string): Promise<string> {
  const openVault = readOpenVault()
  const takenVaultRelativePaths = new Set(
    [
      ...(await openVault.papelizVaultAdapter.listVaultAttachmentFileRelativePaths()),
      ...usePapelizWorkspaceStore.getState().vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
    ].map((takenVaultRelativePath) => takenVaultRelativePath.toLowerCase()),
  )
  const attachmentsFolderRelativePath = papelizAssistantMediaAttachmentsFolderRelativePath
  let mediaFileRelativePath = `${attachmentsFolderRelativePath}/${mediaFileBaseName}${mediaFileExtension}`
  for (let candidateNumber = 2; takenVaultRelativePaths.has(mediaFileRelativePath.toLowerCase()); candidateNumber += 1) {
    mediaFileRelativePath = `${attachmentsFolderRelativePath}/${mediaFileBaseName}-${candidateNumber}${mediaFileExtension}`
  }
  return mediaFileRelativePath
}

// Writes a file at a path inside `Attachments/` (made when it isn't there). Fails when the name was
// taken in the meantime, so a link already shown in a diff never points at another file.
export async function writePapelizMediaFileToVault(mediaFileRelativePath: string, mediaFileBlob: Blob): Promise<void> {
  const openVault = readOpenVault()
  const isAttachmentsFolderListed = usePapelizWorkspaceStore
    .getState()
    .vaultTreeEntries.some(
      (vaultTreeEntry) =>
        vaultTreeEntry.vaultEntryKind === 'folder' && vaultTreeEntry.vaultEntryRelativePath.toLowerCase() === papelizAssistantMediaAttachmentsFolderRelativePath.toLowerCase(),
    )
  if (!isAttachmentsFolderListed) {
    try {
      await openVault.papelizVaultAdapter.createVaultFolder(papelizAssistantMediaAttachmentsFolderRelativePath)
    } catch (attachmentsFolderCreateError) {
      // Made since the list was last read: it is there, as wanted.
      if (!(attachmentsFolderCreateError instanceof PapelizVaultOperationError && attachmentsFolderCreateError.message === 'Name Taken')) throw attachmentsFolderCreateError
    }
  }
  await openVault.papelizVaultAdapter.createVaultAttachmentFile(mediaFileRelativePath, mediaFileBlob)
  reportPapelizSyncVaultFileSaved(openVault.papelizVaultId, mediaFileRelativePath)
  if (!isAttachmentsFolderListed) await usePapelizWorkspaceStore.getState().refreshVaultTree()
}
