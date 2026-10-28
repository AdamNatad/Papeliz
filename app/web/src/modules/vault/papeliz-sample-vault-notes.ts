import type { PapelizInMemoryVaultNote } from './papeliz-in-memory-vault-adapter'

export const papelizSampleVaultDisplayName = 'Sample vault'
export const papelizSampleVaultFirstNoteRelativePath = 'Start here.md'

// The bundled sample vault: a few short, linked notes that show what Papeliz does. It opens in
// memory, so trying Papeliz needs no folder and changes nothing on disk.
export const papelizSampleVaultNotes: readonly PapelizInMemoryVaultNote[] = [
  {
    vaultNoteRelativePath: 'Start here.md',
    vaultNoteText: `---
tags: [papeliz, start]
created: 2026-10-27
---
# Start here

Welcome to the sample vault. Every note here is a plain Markdown file, kept in memory while this tab is open, so change, rename or delete anything you like.

## Try these

- [ ] Click into this line and type: **MD View** shows the note rendered and you can write in it.
- [ ] Switch to **MD Code** with the switch at the top (or \`Ctrl+E\`) to see the raw Markdown.
- [ ] Press the lock at the top right to read without changing anything.
- [ ] Follow a link: [[Links between notes]].
- [ ] Rename this note from the file list on the left, or make one of your own with **New**.

> [!tip] Your own folder
> When you're ready, go back to the start page and open a folder of \`.md\` files. Papeliz edits them right where they are.

Read on: [[Writing in MD View]], [[Writing in MD Code]], [[Callouts]] and [[Your files stay yours]].
`,
  },
  {
    vaultNoteRelativePath: 'Guides/Writing in MD View.md',
    vaultNoteText: `---
tags: [guide, view]
---
# Writing in MD View

MD View shows the note rendered — headings, lists, tables, task lists, code blocks and callouts — and you can still write in it. The Markdown of the line you're on shows up so you can edit it, and hides again when you move on.

## What it understands

- GitHub-flavored Markdown: tables, ~~strikethrough~~, task lists and links like https://example.com
- \`[[Wikilinks]]\` between notes, with an optional label: [[Links between notes|how links work]]
- Callouts such as \`> [!note]\`, described in [[Callouts]]
- Tags like #reading and #markdown

## Try it

- [x] Open the sample vault
- [ ] Tick this box with a click
- [ ] Put the cursor inside a link, then press \`Ctrl+Enter\` to open it

> [!note] The lock
> With the lock on, MD View becomes a clean page for reading, and nothing can change by accident. Properties at the top of a note show as chips there.

Everything in a note is cleaned before it is shown, so a note can never run code inside Papeliz.
`,
  },
  {
    vaultNoteRelativePath: 'Guides/Writing in MD Code.md',
    vaultNoteText: `---
tags: [guide, code]
---
# Writing in MD Code

MD Code shows the note exactly as it is stored: raw Markdown, with colors for headings, links and code, and a line number on every line. Nothing is converted behind your back, so the file stays the same Markdown you typed.

## Handy keys

| Keys | What they do |
| --- | --- |
| \`Ctrl+F\` | Find and replace in the note |
| \`Ctrl+Z\` / \`Ctrl+Y\` | Undo and redo |
| \`Ctrl+E\` | Switch between MD Code and MD View |
| \`Ctrl+S\` | Save now (saving also happens on its own) |
| \`[[\` | Start a link and pick a note from the list |

## Saving

Papeliz saves a moment after you stop typing. The bar at the bottom says when the note is saved.

\`\`\`md
# A heading
Some **bold** text and a [[link to another note]].
\`\`\`

Next: [[Writing in MD View]].
`,
  },
  {
    vaultNoteRelativePath: 'Guides/Links between notes.md',
    vaultNoteText: `---
tags: [guide, links]
---
# Links between notes

Put a note's name in double square brackets to link to it. In MD View, click the link to open that note.

| You type | You get |
| --- | --- |
| \`[[Callouts]]\` | [[Callouts]] |
| \`[[Callouts\\|a label]]\` | [[Callouts\\|a label]] |
| \`[[Projects/Garden plan]]\` | [[Projects/Garden plan]] |

A link to a note that doesn't exist yet looks different: [[An idea for later]]. Click it and Papeliz creates the note for you.

Back to [[Start here]].
`,
  },
  {
    vaultNoteRelativePath: 'Guides/Callouts.md',
    vaultNoteText: `---
tags: [guide, viewer]
---
# Callouts

A callout is a quote whose first line names its kind in square brackets.

> [!note]
> A plain note, for something worth pointing out.

> [!tip] Keep it short
> A callout can have its own title after the kind.

> [!warning]
> Something to be careful about.

> [!danger] Don't skip this
> Something that can go wrong.

> [!example]
> - Callouts can hold lists
> - and **formatting**, too.

In MD Code a callout is still an ordinary \`>\` quote, so it reads fine in any Markdown app.
`,
  },
  {
    vaultNoteRelativePath: 'Guides/Your files stay yours.md',
    vaultNoteText: `---
tags: [guide, files]
---
# Your files stay yours

- Your notes are plain \`.md\` files in a folder you choose. Papeliz has no server and no accounts; nothing leaves your device.
- Deleting a note moves it into the vault's \`.trash\` folder. Nothing is erased.
- Papeliz never writes inside hidden folders (names that start with a dot, such as \`.git\`), so a folder another app also uses keeps working there.
- This sample vault lives only in this tab. Reload the page and it starts fresh.

See also [[Start here]].
`,
  },
  {
    vaultNoteRelativePath: 'Projects/Garden plan.md',
    vaultNoteText: `---
tags: [project, garden]
status: planning
---
# Garden plan

Three raised beds along the south fence. Water early in the morning.

| Bed | Spring | Autumn |
| --- | --- | --- |
| North | Peas | Garlic |
| Middle | Tomatoes | Spinach |
| South | Beans | Kale |

## To do

- [x] Measure the beds
- [ ] Order seeds
- [ ] Mix compost into the middle bed

> [!note] Watering
> Tomatoes want deep watering twice a week rather than a little every day.

Books to read first are on the [[Reading list]].
`,
  },
  {
    vaultNoteRelativePath: 'Projects/Reading list.md',
    vaultNoteText: `---
tags: [reading]
---
# Reading list

- [x] A beginner's guide to vegetable gardens
- [ ] Soil, compost and worms
- [ ] Saving seeds from year to year

Notes from these go in [[Garden plan]].
`,
  },
  {
    vaultNoteRelativePath: 'Inbox.md',
    vaultNoteText: `# Inbox

Quick thoughts to sort out later.

- Ask about the shared tool shed
- Try writing a note with a [[link to a note that doesn't exist yet]]
`,
  },
]
