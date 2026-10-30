import {
  helpBulletList,
  helpCodeSample,
  helpNote,
  helpNumberedSteps,
  helpParagraph,
  helpSection,
  helpShortcutTable,
  type PapelizHelpArticle,
} from './papeliz-help-content-blocks'

export const papelizHelpWritingArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'md-code',
    articleTitle: 'Write in MD Code',
    articleSummary: 'The raw Markdown with line numbers and syntax colors, like a code editor.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('What you see', [
        helpParagraph(
          'MD Code shows a note exactly as it is saved: every Markdown mark visible, in a monospace font with line numbers. Headings, links, code and frontmatter each get their own color.',
        ),
      ]),
      helpSection('Your text is never converted', [
        helpParagraph(
          'Papeliz edits the Markdown text itself, in both views. The file stays byte for byte what you typed, so it reads the same in any other Markdown app.',
        ),
      ]),
      helpSection('Editing helpers', [
        helpBulletList([
          'Undo and redo keep a history for each note, even when you switch tabs or views.',
          'Typing `[[` suggests notes to link to. See [[links-between-notes]].',
          '`Ctrl+B` and `Ctrl+I` make the selection bold or italic.',
          'Right-click opens the note menu with more formatting. See [[format-text]].',
          '`Ctrl+F` opens find and replace. See [[find-and-replace]].',
        ]),
      ]),
    ],
    relatedArticleSlugs: ['md-view', 'switch-views-and-lock', 'find-and-replace'],
  },
  {
    papelizHelpArticleSlug: 'md-view',
    articleTitle: 'Read and write in MD View',
    articleSummary: 'The note rendered, and still editable in place.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Rendered as you write', [
        helpParagraph(
          'MD View shows the note rendered: headings, lists, links, tags and cards look the way they read. It is still the same Markdown text underneath. On the lines your cursor is on, the raw Markdown shows so you can edit it; the rest stays rendered.',
        ),
      ]),
      helpSection('Links and checkboxes', [
        helpBulletList([
          'Click a wikilink to open its note. A link to a note that doesn’t exist yet creates it.',
          'With the cursor in a wikilink, `Ctrl+Enter` opens it.',
          '`Ctrl`+click a web link to open it in a new tab. A plain click places the cursor.',
          'Click a task’s checkbox to tick it or clear it.',
        ]),
      ]),
      helpSection('Properties', [
        helpParagraph(
          'The frontmatter at the top of a note, the YAML between two `---` lines, shows as property chips. See [[tags-properties-and-cards]].',
        ),
      ]),
      helpSection('A clean page with the lock', [
        helpParagraph(
          'Lock a note and MD View becomes a clean rendered page that can be read but not changed. See [[switch-views-and-lock]].',
        ),
      ]),
    ],
    relatedArticleSlugs: ['md-code', 'switch-views-and-lock', 'supported-markdown'],
  },
  {
    papelizHelpArticleSlug: 'switch-views-and-lock',
    articleTitle: 'Switch views and lock a note',
    articleSummary: 'One switch for MD Code and MD View, and a lock for notes you only want to read.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('The main switch', [
        helpParagraph(
          'The switch in the middle of the top bar picks how your notes show: **MD Code** or **MD View**. `Ctrl+E` switches between them from anywhere in the workspace.',
        ),
        helpParagraph('Switching keeps your place: the text, the cursor and the undo history stay as they were.'),
      ]),
      helpSection('Lock a note', [
        helpNumberedSteps(['Open the note.', 'Choose the lock at the front of its tab, above the note.']),
        helpParagraph(
          'A locked note can be read, selected, copied and searched, but not changed. In MD View, a locked note shows as a clean rendered page. Choose the lock again to unlock it.',
        ),
      ]),
      helpSection('Lock a whole folder', [
        helpParagraph(
          'In the file list, right-click a folder and choose **Lock editing of its notes**. Every note in it stays locked until you choose **Unlock editing**. A single note has **Lock editing** in the same menu.',
        ),
      ]),
      helpSection('Lock every note', [
        helpParagraph(
          'Open the gear at the right end of the top bar and turn on **Lock All Notes**. Every note in the vault stays locked until you turn it off. Notes you locked one by one stay locked after that.',
        ),
        helpNote('Locking is a Papeliz setting. It doesn’t change the files’ permissions on your disk, and other apps can still edit them.'),
      ]),
    ],
    relatedArticleSlugs: ['md-code', 'md-view', 'file-explorer'],
  },
  {
    papelizHelpArticleSlug: 'links-between-notes',
    articleTitle: 'Link your notes',
    articleSummary: 'Wikilinks connect notes by name, with suggestions as you type.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Write a wikilink', [
        helpParagraph('Put a note’s name between double brackets: `[[Garden plan]]`. You don’t need the folder or the `.md` ending.'),
        helpBulletList([
          '`[[Garden plan|my garden]]` shows the words “my garden” instead of the name.',
          '`[[Garden plan#Beds]]` links to the heading “Beds” in that note.',
          '`[[Projects/Garden plan]]` names the folder too, for when two notes share a name.',
        ]),
      ]),
      helpSection('Suggestions as you type', [
        helpParagraph('Type `[[` and Papeliz suggests notes from the vault. Keep typing to narrow the list, then press `Enter` to insert the link.'),
      ]),
      helpSection('How a link finds its note', [
        helpParagraph(
          'Names compare without case. Papeliz looks for an exact path first, then a note in the same folder as the linking note, then any note with that name, preferring the nearest.',
        ),
      ]),
      helpSection('Links to notes that don’t exist yet', [
        helpParagraph(
          'A link to a missing note looks different in MD View. Click it to create the note: `[[Ideas/New thing]]` creates `New thing.md` in the `Ideas` folder.',
        ),
        helpNote('Renaming a note doesn’t update the links that point to it yet. Update those links by hand for now.'),
      ]),
    ],
    relatedArticleSlugs: ['md-view', 'backlinks-and-outline', 'rename-move-and-trash'],
  },
  {
    papelizHelpArticleSlug: 'tags-properties-and-cards',
    articleTitle: 'Tags, properties and cards',
    articleSummary: 'Tags in your text, properties in frontmatter, and callout cards for what should stand out.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Tags', [
        helpParagraph(
          'Write `#tag` or `#nested/tag` anywhere in your text, and MD View shows it as a chip. A tag needs at least one letter, so `#1` and `C#` stay plain text. Inside code, links and frontmatter, a `#` stays text.',
        ),
      ]),
      helpSection('Properties', [
        helpParagraph('Properties live in the note’s frontmatter: YAML between two `---` lines at the very top of the note.'),
        helpCodeSample(`---
status: draft
tags: [garden, plans]
---`),
        helpParagraph(
          'MD View shows them as chips. Papeliz reads the common shapes (a single value, a list in brackets, or a list of lines starting with `-`) and shows anything more complex as its raw text. Reading properties never changes the note.',
        ),
      ]),
      helpSection('Cards', [
        helpParagraph('A quote whose first line is `[!kind]` becomes a card, also called a callout. A title can follow the kind:'),
        helpCodeSample(`> [!tip] Keep it short
> The body of the card.`),
        helpParagraph(
          'Add a color after a bar: `[!note|green]`. The color names are red, orange, yellow, green, teal, blue, purple, pink and gray, or use any hex color such as `#7c3aed`.',
        ),
        helpParagraph(
          'In the note menu, the **Cards** row turns the selected lines into a Note, Success, Warning, Danger or Quote card, or a custom card in any color.',
        ),
        helpNote('In the Markdown file a card stays an ordinary quote, so the note still reads well in any Markdown app.'),
      ]),
    ],
    relatedArticleSlugs: ['md-view', 'format-text', 'supported-markdown'],
  },
  {
    papelizHelpArticleSlug: 'format-text',
    articleTitle: 'Format text',
    articleSummary: 'Bold, headings, lists, colors and sizes, from the keyboard or the note menu.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('From the keyboard', [
        helpShortcutTable([
          ['Ctrl+B', 'Bold'],
          ['Ctrl+I', 'Italic'],
        ]),
      ]),
      helpSection('The note menu', [
        helpParagraph('Right-click in a note to open its menu:'),
        helpBulletList([
          '**Format**: bold, italic, strikethrough, code, a link to a note, or a web link.',
          '**Turn the lines into**: heading 1, 2 or 3, a bulleted list, a numbered list, a checklist, or a quote.',
          '**Text color** and **Text size**: color the selection from the palette or with any color, and make it larger or smaller.',
          '**Cards**: turn the lines into a callout card. See [[tags-properties-and-cards]].',
          '**Assistant**: Edit with Assistant and Ask Assistant, still in development. See [[inline-edits]].',
          'Cut, copy, paste, select all, undo and redo.',
        ]),
      ]),
      helpSection('How colors and sizes are saved', [
        helpParagraph(
          'Colored or resized text is saved as one small HTML tag around the words, such as `<span style="color: purple">words</span>`. It is the only HTML Papeliz shows, and only with a checked color and size. Other Markdown apps may show the tag as text.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['md-code', 'md-view', 'tags-properties-and-cards'],
  },
  {
    papelizHelpArticleSlug: 'find-and-replace',
    articleTitle: 'Find and replace',
    articleSummary: 'Search inside the open note and replace what you find.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Find in the note', [
        helpNumberedSteps([
          'In a note, press `Ctrl+F`. The find bar opens at the top of the note.',
          'Type what you’re looking for. Every match is highlighted.',
          'Press `Enter` for the next match and `Shift+Enter` for the previous one.',
        ]),
      ]),
      helpSection('Replace', [
        helpParagraph(
          'Type the new text in the find bar’s replace field, then choose **replace** for the current match or **replace all**. Options in the bar match case, use a regular expression, or match whole words.',
        ),
        helpParagraph('In a locked note you can still find, but not replace.'),
      ]),
      helpSection('Shortcuts', [
        helpShortcutTable([
          ['Ctrl+F', 'Open the find bar'],
          ['Ctrl+G', 'Next match'],
          ['Ctrl+Shift+G', 'Previous match'],
          ['Ctrl+D', 'Also select the next match of the selection'],
          ['Esc', 'Close the find bar'],
        ]),
      ]),
      helpSection('Search across notes', [
        helpParagraph('To search every note in the vault, use **Search notes** at the top of the file list. See [[file-explorer]].'),
      ]),
    ],
    relatedArticleSlugs: ['md-code', 'file-explorer', 'keyboard-shortcuts'],
  },
  {
    papelizHelpArticleSlug: 'text-settings-and-theme',
    articleTitle: 'Text settings and theme',
    articleSummary: 'Choose the font, size and width of your notes, a light or dark theme, and how note tabs show.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Text settings', [
        helpParagraph(
          'Open the gear at the right end of the top bar. Its **Accessibility** page sets how notes look: the **Font** (Sans, Serif or Mono), the **Text size**, and the **Text width** (Narrow, Normal, Wide or Full). Changes show at once, and Papeliz remembers them. MD Code always uses a monospace font, a little smaller than your text size.',
        ),
        helpParagraph(
          '**Text size** is a slider from 14 to 24 px. Drag it, click along it, or use the arrow keys, `Home` and `End`. **Reset Text Settings** puts the font, size and width back to their defaults.',
        ),
      ]),
      helpSection('Theme', [
        helpParagraph('**Theme**, at the top of the same page, picks **Light**, **Dark**, or **Device**, which follows your device’s setting. The start page’s gear has it too.'),
      ]),
      helpSection('Note tabs', [
        helpParagraph(
          '**Note tabs** picks how tabs show when they don’t fit in one row. **Scroll** keeps one row that scrolls sideways, and **Stack** wraps them onto more rows, so every tab shows.',
        ),
      ]),
      helpSection('Panels', [
        helpParagraph(
          'Drag the edge of the file list or the Assistant panel to resize it, and Papeliz remembers the width. In a narrow window both open as drawers over the note, and `Esc` closes them.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['settings-gear', 'switch-views-and-lock', 'keyboard-shortcuts'],
  },
  {
    papelizHelpArticleSlug: 'backlinks-and-outline',
    articleTitle: 'Backlinks and Outline',
    articleSummary: 'See which notes link to this one, and jump between its headings.',
    papelizHelpGroupSlug: 'writing',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('Backlinks', [
        helpParagraph(
          'The **Backlinks** tab in the Assistant panel lists every note that links to the open note, the notes with the most links first. The tab’s label shows how many there are. Click one to open it.',
        ),
      ]),
      helpSection('Outline', [
        helpParagraph('The **Outline** tab lists the open note’s headings. Click a heading to move there.'),
      ]),
    ],
    relatedArticleSlugs: ['links-between-notes', 'chat-with-the-assistant'],
  },
]
