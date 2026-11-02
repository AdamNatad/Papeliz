import { createPapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// A picture in a note, for Describe Picture and Edit Picture: the `![alt](address)` or `![[file]]`
// under the cursor or in the selection, and the picture itself, read from the vault (or its https
// address) to send to the person's own provider.

export interface PapelizNotePictureLink {
  // Where the link is in the text it was found in.
  pictureLinkFrom: number
  pictureLinkTo: number
  pictureLinkMarkdown: string
  pictureAltText: string
  // As the note writes it: a vault path ("../Attachments/fox.png") or an https address.
  pictureAddress: string
  pictureLinkKind: 'markdown-image' | 'wikilink-embed'
}

const papelizMarkdownImagePattern = /!\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]+)(?:\s+"[^"\n]*")?\s*\)/g
const papelizWikilinkEmbedPattern = /!\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g
const papelizDescribablePictureExtensionPattern = /\.(png|jpe?g|webp|gif)$/i

function listPictureLinks(searchedText: string, searchedTextOffset: number): PapelizNotePictureLink[] {
  const pictureLinks: PapelizNotePictureLink[] = []
  for (const imageMatch of searchedText.matchAll(papelizMarkdownImagePattern)) {
    pictureLinks.push({
      pictureLinkFrom: searchedTextOffset + imageMatch.index,
      pictureLinkTo: searchedTextOffset + imageMatch.index + imageMatch[0].length,
      pictureLinkMarkdown: imageMatch[0],
      pictureAltText: imageMatch[1] ?? '',
      pictureAddress: (imageMatch[2] ?? '').replace(/^<(.*)>$/, '$1'),
      pictureLinkKind: 'markdown-image',
    })
  }
  for (const embedMatch of searchedText.matchAll(papelizWikilinkEmbedPattern)) {
    const embeddedFileName = (embedMatch[1] ?? '').trim()
    if (!papelizDescribablePictureExtensionPattern.test(embeddedFileName)) continue
    pictureLinks.push({
      pictureLinkFrom: searchedTextOffset + embedMatch.index,
      pictureLinkTo: searchedTextOffset + embedMatch.index + embedMatch[0].length,
      pictureLinkMarkdown: embedMatch[0],
      pictureAltText: '',
      pictureAddress: embeddedFileName,
      pictureLinkKind: 'wikilink-embed',
    })
  }
  return pictureLinks.sort((firstLink, secondLink) => firstLink.pictureLinkFrom - secondLink.pictureLinkFrom)
}

// The picture link the cursor is in or next to, or the first one the selection touches, on the
// lines from `selectionFrom` to `selectionTo`; null when there is none.
export function findPapelizNotePictureLinkAround(noteText: string, selectionFrom: number, selectionTo: number): PapelizNotePictureLink | null {
  const linesFrom = noteText.lastIndexOf('\n', Math.max(0, selectionFrom - 1)) + 1
  const linesToIndex = noteText.indexOf('\n', selectionTo)
  const linesTo = linesToIndex === -1 ? noteText.length : linesToIndex
  const pictureLinks = listPictureLinks(noteText.slice(linesFrom, linesTo), linesFrom)
  const touchedPictureLink = pictureLinks.find((pictureLink) => pictureLink.pictureLinkFrom <= selectionTo && pictureLink.pictureLinkTo >= selectionFrom)
  if (touchedPictureLink !== undefined) return touchedPictureLink
  // A cursor elsewhere on a line with one picture means that picture.
  return selectionFrom === selectionTo && pictureLinks.length === 1 ? (pictureLinks[0] ?? null) : null
}

// The link with new alt text: `![new](same)`, or for `![[file]]`, `![[file|new]]`.
export function replacePapelizPictureLinkAltText(pictureLink: PapelizNotePictureLink, newPictureAltText: string): string {
  const cleanedAltText = newPictureAltText.replace(/[[\]|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (pictureLink.pictureLinkKind === 'wikilink-embed') return `![[${pictureLink.pictureAddress}|${cleanedAltText}]]`
  return pictureLink.pictureLinkMarkdown.replace(/^!\[[^\]\n]*\]/, () => `![${cleanedAltText}]`)
}

const papelizPictureMimeTypesByExtension: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
const papelizSentPictureByteLimit = 20 * 1024 * 1024

async function readBlobAsDataUrl(pictureBlob: Blob, pictureMimeType: string): Promise<string> {
  const pictureBytes = new Uint8Array(await pictureBlob.arrayBuffer())
  let pictureBinaryText = ''
  for (let byteOffset = 0; byteOffset < pictureBytes.length; byteOffset += 0x8000) pictureBinaryText += String.fromCharCode(...pictureBytes.subarray(byteOffset, byteOffset + 0x8000))
  return `data:${pictureMimeType};base64,${btoa(pictureBinaryText)}`
}

// The picture as the provider is sent it: a vault picture as a `data:` URL; a web picture by its https
// address, which the provider reads itself.
export async function readPapelizNotePictureForProvider(pictureLink: PapelizNotePictureLink, vaultNoteRelativePath: string): Promise<string> {
  const pictureAddress = pictureLink.pictureAddress.trim()
  if (/^https:\/\//i.test(pictureAddress)) return pictureAddress
  if (/^[a-z][a-z0-9+.-]*:/i.test(pictureAddress)) throw new PapelizAssistantProviderError('Only pictures in the vault or on https can be sent.', null)
  const openVault = usePapelizWorkspaceStore.getState().openVault
  if (openVault === null) throw new PapelizAssistantProviderError('Open the vault first.', null)
  let decodedPictureAddress = pictureAddress
  try {
    decodedPictureAddress = decodeURIComponent(pictureAddress)
  } catch {
    // Not percent-encoded: read as written.
  }
  const resolveVaultFile = createPapelizHtmlExportVaultFileResolver(await openVault.papelizVaultAdapter.listVaultAttachmentFileRelativePaths())
  const pictureVaultFileRelativePath = resolveVaultFile(decodedPictureAddress, vaultNoteRelativePath)
  if (pictureVaultFileRelativePath === null) throw new PapelizAssistantProviderError(`“${decodedPictureAddress}” isn’t in the vault.`, null)
  const pictureMimeType = papelizPictureMimeTypesByExtension[/\.([^./]+)$/.exec(pictureVaultFileRelativePath)?.[1]?.toLowerCase() ?? '']
  if (pictureMimeType === undefined) throw new PapelizAssistantProviderError('Only PNG, JPEG, WebP and GIF pictures can be sent.', null)
  const pictureBlob = await openVault.papelizVaultAdapter.readVaultAttachmentFileBlob(pictureVaultFileRelativePath)
  if (pictureBlob.size > papelizSentPictureByteLimit) throw new PapelizAssistantProviderError('The picture is over 20 MB.', null)
  return readBlobAsDataUrl(pictureBlob, pictureMimeType)
}
