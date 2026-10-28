import { Tag, tags } from '@lezer/highlight'
import type { MarkdownConfig } from '@lezer/markdown'

// Papeliz's additions to the note editor's Markdown parser, shared by MD Code and MD View: the
// YAML frontmatter block at the top of a note, and `[[wikilinks]]`, each as its own syntax node
// so MD Code can color them and MD View can render them.

export const papelizNoteEditorFrontmatterTag = Tag.define()
export const papelizNoteEditorWikilinkTag = Tag.define(tags.link)

const papelizFrontmatterFenceLinePattern = /^(---|\.\.\.)\s*$/

export const papelizNoteEditorFrontmatterSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'PapelizFrontmatter', block: true, style: papelizNoteEditorFrontmatterTag },
    { name: 'PapelizFrontmatterFence', style: tags.processingInstruction },
  ],
  parseBlock: [
    {
      name: 'PapelizFrontmatter',
      before: 'HorizontalRule',
      parse(blockContext, markdownLine) {
        // Frontmatter only counts on the very first line of the note.
        if (blockContext.lineStart !== 0 || markdownLine.text.trimEnd() !== '---') return false
        const frontmatterStart = blockContext.lineStart
        const frontmatterChildren = [blockContext.elt('PapelizFrontmatterFence', frontmatterStart, frontmatterStart + 3)]
        while (blockContext.nextLine()) {
          if (papelizFrontmatterFenceLinePattern.test(markdownLine.text)) {
            const closingFenceStart = blockContext.lineStart
            frontmatterChildren.push(blockContext.elt('PapelizFrontmatterFence', closingFenceStart, closingFenceStart + 3))
            blockContext.nextLine()
            blockContext.addElement(blockContext.elt('PapelizFrontmatter', frontmatterStart, closingFenceStart + 3, frontmatterChildren))
            return true
          }
        }
        blockContext.addElement(blockContext.elt('PapelizFrontmatter', frontmatterStart, blockContext.prevLineEnd(), frontmatterChildren))
        return true
      },
    },
  ],
}

const openingSquareBracketCharacterCode = 91
const closingSquareBracketCharacterCode = 93
const lineFeedCharacterCode = 10

export const papelizNoteEditorWikilinkSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'PapelizWikilink', style: papelizNoteEditorWikilinkTag },
    { name: 'PapelizWikilinkMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'PapelizWikilink',
      before: 'Link',
      parse(inlineContext, nextCharacterCode, wikilinkStart) {
        if (nextCharacterCode !== openingSquareBracketCharacterCode) return -1
        if (inlineContext.char(wikilinkStart + 1) !== openingSquareBracketCharacterCode) return -1
        for (let characterPosition = wikilinkStart + 2; characterPosition < inlineContext.end - 1; characterPosition += 1) {
          const characterCode = inlineContext.char(characterPosition)
          if (characterCode === lineFeedCharacterCode || characterCode === openingSquareBracketCharacterCode) return -1
          if (characterCode === closingSquareBracketCharacterCode) {
            if (inlineContext.char(characterPosition + 1) !== closingSquareBracketCharacterCode || characterPosition === wikilinkStart + 2) return -1
            const wikilinkEnd = characterPosition + 2
            return inlineContext.addElement(
              inlineContext.elt('PapelizWikilink', wikilinkStart, wikilinkEnd, [
                inlineContext.elt('PapelizWikilinkMark', wikilinkStart, wikilinkStart + 2),
                inlineContext.elt('PapelizWikilinkMark', characterPosition, wikilinkEnd),
              ]),
            )
          }
        }
        return -1
      },
    },
  ],
}
