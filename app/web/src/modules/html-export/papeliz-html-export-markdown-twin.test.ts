import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { buildPapelizHtmlExportMarkdownTwin } from './papeliz-html-export-markdown-twin'
import { createPapelizHtmlExportVaultFileResolver } from './papeliz-html-export-vault-files'

const testExportedTwinHrefsByVaultNoteRelativePath = new Map([
  ['Projects/Launch plan.md', 'launch-plan.md'],
  ['Projects/Budget.md', 'budget.md'],
  ['Guides/Callouts.md', '../guides/callouts.md'],
])

function buildTestTwin(vaultNoteText: string): string {
  return buildPapelizHtmlExportMarkdownTwin({
    vaultNoteRelativePath: 'Projects/Launch plan.md',
    vaultNoteText,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver(['Projects/Launch plan.md', 'Projects/Budget.md', 'Guides/Callouts.md', 'Inbox.md']),
    getHtmlExportNoteTwinHref: (targetVaultNoteRelativePath) => testExportedTwinHrefsByVaultNoteRelativePath.get(targetVaultNoteRelativePath) ?? null,
    resolveVaultFileReference: createPapelizHtmlExportVaultFileResolver(['Projects/pictures/plan.png', 'files/brief notes.pdf']),
    getHtmlExportVaultFileTwinHref: (vaultFileRelativePath) => `../attachments/${vaultFileRelativePath.split('/').map(encodeURIComponent).join('/')}`,
  })
}

describe('an exported note’s Markdown twin', () => {
  it('turns wikilinks into Markdown links to the other twins', () => {
    expect(buildTestTwin('See [[Budget]], [[Callouts|the cards]] and [[Budget#This year]].')).toBe(
      'See [Budget](budget.md), [the cards](../guides/callouts.md) and [Budget › This year](budget.md#this-year).',
    )
  })

  it('keeps the text of a wikilink to a note outside the export, or to no note', () => {
    expect(buildTestTwin('Ask [[Inbox]], [[Someday|later_on]] or [[#Goals]].')).toBe('Ask Inbox, later\\_on or [Goals](launch-plan.md#goals).')
  })

  it('points `.md` links at twins and drops links to notes outside the export', () => {
    expect(buildTestTwin('[money](Budget.md#totals) and [box](../Inbox.md "Inbox") and [](Budget.md)\n\n[ref]: Budget.md "The budget"')).toBe(
      '[money](budget.md#totals) and box and [](budget.md)\n\n[ref]: budget.md "The budget"',
    )
  })

  it('leaves code, frontmatter, web links and wikilinks inside links as written', () => {
    const noteText = [
      '---',
      'related: "[[Budget]]"',
      '---',
      'Type `[[Budget]]` to link.',
      '',
      '```mermaid',
      'flowchart LR',
      '  A["[[Budget]]"] --> B',
      '```',
      '',
      '[see [[Budget]]](https://papeliz.com) and <https://example.com>',
    ].join('\n')
    expect(buildTestTwin(noteText)).toBe(noteText)
  })

  it('points pictures and files at their copies', () => {
    expect(buildTestTwin('![[plan.png]] ![[plan.png|300]] ![[plan.png|The plan]] [[brief notes.pdf|the brief]] ![[brief notes.pdf]]')).toBe(
      '![plan.png](../attachments/Projects/pictures/plan.png) ![plan.png](../attachments/Projects/pictures/plan.png) ![The plan](../attachments/Projects/pictures/plan.png) [the brief](../attachments/files/brief%20notes.pdf) [brief notes.pdf](../attachments/files/brief%20notes.pdf)',
    )
    expect(buildTestTwin('![The \\[plan\\]](pictures/plan.png "Plan") and [brief](../files/brief%20notes.pdf) and ![Gone](gone.png)')).toBe(
      '![The \\[plan\\]](../attachments/Projects/pictures/plan.png "Plan") and [brief](../attachments/files/brief%20notes.pdf) and ![Gone](gone.png)',
    )
  })

  it('works inside tables', () => {
    expect(buildTestTwin('| Note | Why |\n| --- | --- |\n| [[Budget\\|Money]] | totals |')).toBe('| Note | Why |\n| --- | --- |\n| [Money](budget.md) | totals |')
  })
})
