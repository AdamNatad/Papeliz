import { describe, expect, it } from 'vitest'
import {
  buildPapelizAssistantUserMessageContent,
  describePapelizAssistantAttachmentsForTranscript,
  readPapelizAssistantAttachmentFile,
  type PapelizAssistantAttachment,
} from './papeliz-assistant-attachments'

async function readTestAttachment(attachmentFile: File): Promise<PapelizAssistantAttachment> {
  const attachmentReadResult = await readPapelizAssistantAttachmentFile(attachmentFile)
  if (attachmentReadResult.attachmentReadOutcome !== 'read') throw new Error(attachmentReadResult.attachmentRefusedBecause)
  return attachmentReadResult.assistantAttachment
}

describe('files and pictures added to a message', () => {
  it('reads a picture as a data URL and a text file as text, and turns other files away', async () => {
    const pictureAttachment = await readTestAttachment(new File([new Uint8Array([137, 80, 78, 71])], 'beds.png', { type: 'image/png' }))
    expect(pictureAttachment.attachmentImageDataUrl).toBe('data:image/png;base64,iVBORw==')
    const textAttachment = await readTestAttachment(new File(['name,count\nkale,3'], 'seeds.csv', { type: '' }))
    expect(textAttachment).toMatchObject({ attachmentKind: 'text-file', attachmentFileText: 'name,count\nkale,3' })
    expect(await readPapelizAssistantAttachmentFile(new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }))).toEqual({
      attachmentReadOutcome: 'refused',
      attachmentRefusedBecause: 'File Type Not Supported',
    })
    expect(await readPapelizAssistantAttachmentFile(new File(['x'], 'scan.bmp', { type: 'image/bmp' }))).toMatchObject({ attachmentRefusedBecause: 'Picture Type Not Supported' })
  })

  it('sends text files inside the message and pictures as image parts', async () => {
    const pictureAttachment = await readTestAttachment(new File([new Uint8Array([1, 2])], 'beds.png', { type: 'image/png' }))
    const textAttachment = await readTestAttachment(new File(['kale'], 'seeds.txt', { type: 'text/plain' }))
    expect(buildPapelizAssistantUserMessageContent('Plan this', [textAttachment])).toBe('Plan this\n\n<attached-file name="seeds.txt">\nkale\n</attached-file>')
    expect(buildPapelizAssistantUserMessageContent('', [pictureAttachment])).toEqual([
      { type: 'text', text: 'See the attached pictures.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AQI=' } },
    ])
    expect(
      describePapelizAssistantAttachmentsForTranscript([{ ...pictureAttachment, savedAttachmentVaultFileRelativePath: '.csessions/attachments/beds.png' }, textAttachment]),
    ).toBe('![beds.png](<attachments/beds.png>)\nAttached: seeds.txt')
  })
})
