import type { PapelizChatUserContentPart } from './papeliz-openai-compatible-client'

// Files and pictures added to a message for the AI Assistant, with the + button, by pasting or by
// dropping them on the box. A picture goes to the model as a picture (for models that can see); a
// text file's text goes with the message. Other kinds of file are turned away.

export interface PapelizAssistantAttachment {
  assistantAttachmentId: string
  attachmentFileName: string
  attachmentKind: 'image' | 'text-file'
  // A picture as a `data:` URL: sent to the provider and shown in the chat.
  attachmentImageDataUrl: string | null
  attachmentFileText: string | null
  attachmentFileBlob: Blob
  // Where a copy of the picture was saved in the vault, once it is (`.csessions/attachments/…`).
  savedAttachmentVaultFileRelativePath: string | null
}

export const papelizAssistantAttachmentLimit = 8
const papelizAssistantImageByteLimit = 10 * 1024 * 1024
const papelizAssistantTextFileByteLimit = 1024 * 1024
const papelizAssistantTextFileCharacterLimit = 100_000
// The pictures the providers take.
const papelizAssistantImageMimeTypes: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const papelizAssistantTextFileNamePattern = /\.(md|markdown|txt|text|csv|tsv|json|jsonl|ya?ml|xml|html?|css|js|jsx|mjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|sh|ps1|sql|log|ini|toml|env)$/i

let nextAssistantAttachmentNumber = 1

async function readBlobAsDataUrl(attachmentBlob: Blob, attachmentMimeType: string): Promise<string> {
  const attachmentBytes = new Uint8Array(await attachmentBlob.arrayBuffer())
  let attachmentBinaryText = ''
  for (let byteOffset = 0; byteOffset < attachmentBytes.length; byteOffset += 0x8000) {
    attachmentBinaryText += String.fromCharCode(...attachmentBytes.subarray(byteOffset, byteOffset + 0x8000))
  }
  return `data:${attachmentMimeType};base64,${btoa(attachmentBinaryText)}`
}

// Reads one file the user added, or says why it can't be added, as an error toast's tag.
export async function readPapelizAssistantAttachmentFile(
  attachmentFile: File,
): Promise<{ attachmentReadOutcome: 'read'; assistantAttachment: PapelizAssistantAttachment } | { attachmentReadOutcome: 'refused'; attachmentRefusedBecause: string }> {
  const assistantAttachmentId = `papeliz-attachment-${nextAssistantAttachmentNumber++}`
  if (attachmentFile.type.startsWith('image/')) {
    if (!papelizAssistantImageMimeTypes.includes(attachmentFile.type)) return { attachmentReadOutcome: 'refused', attachmentRefusedBecause: 'Picture Type Not Supported' }
    if (attachmentFile.size > papelizAssistantImageByteLimit) return { attachmentReadOutcome: 'refused', attachmentRefusedBecause: 'Over 10 MB' }
    return {
      attachmentReadOutcome: 'read',
      assistantAttachment: {
        assistantAttachmentId,
        attachmentFileName: attachmentFile.name || 'picture.png',
        attachmentKind: 'image',
        attachmentImageDataUrl: await readBlobAsDataUrl(attachmentFile, attachmentFile.type),
        attachmentFileText: null,
        attachmentFileBlob: attachmentFile,
        savedAttachmentVaultFileRelativePath: null,
      },
    }
  }
  if (attachmentFile.type.startsWith('text/') || papelizAssistantTextFileNamePattern.test(attachmentFile.name)) {
    if (attachmentFile.size > papelizAssistantTextFileByteLimit) return { attachmentReadOutcome: 'refused', attachmentRefusedBecause: 'Over 1 MB' }
    const attachmentFileText = await attachmentFile.text()
    return {
      attachmentReadOutcome: 'read',
      assistantAttachment: {
        assistantAttachmentId,
        attachmentFileName: attachmentFile.name || 'file.txt',
        attachmentKind: 'text-file',
        attachmentImageDataUrl: null,
        attachmentFileText:
          attachmentFileText.length > papelizAssistantTextFileCharacterLimit
            ? `${attachmentFileText.slice(0, papelizAssistantTextFileCharacterLimit)}\n…(the rest of the file is left out)`
            : attachmentFileText,
        attachmentFileBlob: attachmentFile,
        savedAttachmentVaultFileRelativePath: null,
      },
    }
  }
  return { attachmentReadOutcome: 'refused', attachmentRefusedBecause: 'File Type Not Supported' }
}

// What the provider is sent for a message with attachments: the message with each text file's text
// after it, then the pictures.
export function buildPapelizAssistantUserMessageContent(
  userMessageText: string,
  assistantAttachments: readonly PapelizAssistantAttachment[],
): string | PapelizChatUserContentPart[] {
  const textFileParts = assistantAttachments
    .filter((assistantAttachment) => assistantAttachment.attachmentKind === 'text-file')
    .map((assistantAttachment) => `<attached-file name="${assistantAttachment.attachmentFileName}">\n${assistantAttachment.attachmentFileText ?? ''}\n</attached-file>`)
  const userMessageWithFilesText = [userMessageText, ...textFileParts].filter((messagePart) => messagePart.length > 0).join('\n\n')
  const imageParts: PapelizChatUserContentPart[] = assistantAttachments
    .filter((assistantAttachment) => assistantAttachment.attachmentImageDataUrl !== null)
    .map((assistantAttachment) => ({ type: 'image_url', image_url: { url: assistantAttachment.attachmentImageDataUrl ?? '' } }))
  if (imageParts.length === 0) return userMessageWithFilesText
  return [{ type: 'text', text: userMessageWithFilesText.length > 0 ? userMessageWithFilesText : 'See the attached pictures.' }, ...imageParts]
}

// The lines a saved chat keeps for a message's attachments: each saved picture as an image (its
// path is from the chat's own folder), each other file by name.
export function describePapelizAssistantAttachmentsForTranscript(assistantAttachments: readonly PapelizAssistantAttachment[]): string {
  return assistantAttachments
    .map((assistantAttachment) =>
      assistantAttachment.savedAttachmentVaultFileRelativePath !== null
        ? `![${assistantAttachment.attachmentFileName}](<${assistantAttachment.savedAttachmentVaultFileRelativePath.split('/').slice(1).join('/')}>)`
        : `Attached: ${assistantAttachment.attachmentFileName}`,
    )
    .join('\n')
}
