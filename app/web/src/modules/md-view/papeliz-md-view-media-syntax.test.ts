import { GFM, parser as papelizMarkdownBaseParser } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax } from '../note-editor/papeliz-note-editor-markdown-syntax'
import { readPapelizMdViewImageSyntax, readPapelizMdViewLoneYouTubeLinkSyntax, readPapelizMdViewWikilinkEmbedSyntax } from './papeliz-md-view-media-syntax'

// The note editor's Markdown, as far as pictures and links go.
const papelizTestMarkdownParser = papelizMarkdownBaseParser.configure([GFM, papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax])

function findSyntaxNodes(vaultNoteText: string, syntaxNodeName: string) {
  const foundSyntaxNodes: Array<ReturnType<ReturnType<typeof papelizTestMarkdownParser.parse>['resolveInner']>> = []
  papelizTestMarkdownParser.parse(vaultNoteText).iterate({
    enter: (syntaxNodeRef) => {
      if (syntaxNodeRef.name === syntaxNodeName) foundSyntaxNodes.push(syntaxNodeRef.node)
    },
  })
  const readNoteText = (textFrom: number, textTo: number) => vaultNoteText.slice(textFrom, textTo)
  return { foundSyntaxNodes, readNoteText }
}

const youTubeTestVideoId = 'aBc_12-xYz9'

describe('pictures in the editable MD View', () => {
  it('reads a picture’s address, description and title', () => {
    const { foundSyntaxNodes, readNoteText } = findSyntaxNodes('Before ![Garden plan](pictures/plan.png "Spring beds") after', 'Image')
    expect(foundSyntaxNodes).toHaveLength(1)
    expect(readPapelizMdViewImageSyntax(foundSyntaxNodes[0]!, readNoteText)).toEqual({
      mdViewMediaSource: { mediaSourceKind: 'vault-picture', vaultMediaReference: 'pictures/plan.png' },
      mediaAlternativeText: 'Garden plan',
      mediaTitle: 'Spring beds',
    })
  })

  it('reads the picture inside a link, as P1-Workflow’s README starts', () => {
    const readmeFirstLine = '[![P1-Workflow: your personal knowledge base.](p1-workflow-social-preview.png)](https://papeliz.com/templates/p1-workflow/)'
    const { foundSyntaxNodes: linkNodes } = findSyntaxNodes(readmeFirstLine, 'Link')
    expect(linkNodes).toHaveLength(1)
    const linkImageNodes = linkNodes[0]!.getChildren('Image')
    expect(linkImageNodes).toHaveLength(1)
    expect(readPapelizMdViewImageSyntax(linkImageNodes[0]!, (textFrom, textTo) => readmeFirstLine.slice(textFrom, textTo))).toEqual({
      mdViewMediaSource: { mediaSourceKind: 'vault-picture', vaultMediaReference: 'p1-workflow-social-preview.png' },
      mediaAlternativeText: 'P1-Workflow: your personal knowledge base.',
      mediaTitle: null,
    })
    // The link's own address is its direct child, not the picture's.
    const linkUrlNode = linkNodes[0]!.getChild('URL')
    expect(readmeFirstLine.slice(linkUrlNode!.from, linkUrlNode!.to)).toBe('https://papeliz.com/templates/p1-workflow/')
  })

  it('reads `![[embeds]]` of vault pictures and videos, which the parser takes for a picture with no address', () => {
    const vaultNoteText = '![[dot.png|40]]\n\n![[Clips/demo.mp4|The demo]]\n\n![[Other note]]\n\n![[javascript:alert(1).png]]'
    const { foundSyntaxNodes, readNoteText } = findSyntaxNodes(vaultNoteText, 'Image')
    expect(foundSyntaxNodes.map((imageNode) => readNoteText(imageNode.from, imageNode.to))).toEqual(['![[dot.png|40]]', '![[Clips/demo.mp4|The demo]]', '![[Other note]]', '![[javascript:alert(1).png]]'])
    expect(foundSyntaxNodes.map((imageNode) => readPapelizMdViewImageSyntax(imageNode, readNoteText))).toEqual([null, null, null, null])
    expect(foundSyntaxNodes.map((imageNode) => readPapelizMdViewWikilinkEmbedSyntax(readNoteText(imageNode.from, imageNode.to)))).toEqual([
      { mdViewMediaSource: { mediaSourceKind: 'vault-picture', vaultMediaReference: 'dot.png' }, mediaAlternativeText: 'dot.png', mediaWidthPixels: 40, mediaHeightPixels: null },
      { mdViewMediaSource: { mediaSourceKind: 'vault-video', vaultMediaReference: 'Clips/demo.mp4' }, mediaAlternativeText: 'The demo', mediaWidthPixels: null, mediaHeightPixels: null },
      null,
      null,
    ])
    expect(readPapelizMdViewWikilinkEmbedSyntax('![[dot.png]] and more')).toBeNull()
  })

  it('refuses a javascript: or data: picture, and skips a reference picture', () => {
    const { foundSyntaxNodes, readNoteText } = findSyntaxNodes('![x](javascript:alert(1)) ![y](data:image/png;base64,AAAA) ![z][ref]\n\n[ref]: plan.png', 'Image')
    expect(foundSyntaxNodes.map((imageNode) => readPapelizMdViewImageSyntax(imageNode, readNoteText)?.mdViewMediaSource ?? null)).toEqual([
      { mediaSourceKind: 'not-shown' },
      { mediaSourceKind: 'not-shown' },
      null,
    ])
  })
})

describe('YouTube links alone on their line', () => {
  it('finds a Markdown link, a bare address and an <address> to a YouTube video', () => {
    for (const [paragraphText, youTubeLinkText] of [
      [`[Garden tour](https://www.youtube.com/watch?v=${youTubeTestVideoId})`, 'Garden tour'],
      [`https://youtu.be/${youTubeTestVideoId}`, ''],
      [`<https://www.youtube.com/watch?v=${youTubeTestVideoId}>`, ''],
      [`  [ Garden tour ](https://youtu.be/${youTubeTestVideoId})  `, 'Garden tour'],
    ] as const) {
      const { foundSyntaxNodes, readNoteText } = findSyntaxNodes(paragraphText, 'Paragraph')
      expect(readPapelizMdViewLoneYouTubeLinkSyntax(foundSyntaxNodes[0]!, readNoteText), paragraphText).toEqual({ youTubeVideoId: youTubeTestVideoId, youTubeLinkText })
    }
  })

  it('leaves a YouTube link inside a sentence, two links, and other links as links', () => {
    for (const paragraphText of [
      `Watch [the tour](https://youtu.be/${youTubeTestVideoId}) first.`,
      `https://youtu.be/${youTubeTestVideoId} https://youtu.be/${youTubeTestVideoId}`,
      '[Papeliz](https://papeliz.com/)',
      'https://youtube.com.evil.example/watch?v=aBc_12-xYz9',
      'Just words.',
    ]) {
      const { foundSyntaxNodes, readNoteText } = findSyntaxNodes(paragraphText, 'Paragraph')
      expect(readPapelizMdViewLoneYouTubeLinkSyntax(foundSyntaxNodes[0]!, readNoteText), paragraphText).toBeNull()
    }
  })
})
