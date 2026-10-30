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

export const papelizHelpReferenceArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'keyboard-shortcuts',
    articleTitle: 'Keyboard shortcuts',
    articleSummary: 'Every shortcut in Papeliz, in one place.',
    papelizHelpGroupSlug: 'reference',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Workspace', [
        helpNote('On a Mac, use `Cmd` wherever this page says `Ctrl`.'),
        helpShortcutTable([
          ['Ctrl+E', 'Switch between MD Code and MD View'],
          ['Ctrl+S', 'Save every open note now'],
          ['Ctrl+Shift+F', 'Turn focus mode on or off (in development)'],
          ['Esc', 'Leave focus mode, or close the file list or Assistant drawer in a narrow window'],
        ]),
      ]),
      helpSection('Writing', [
        helpShortcutTable([
          ['Ctrl+B', 'Bold'],
          ['Ctrl+I', 'Italic'],
          ['Ctrl+U', 'Underline'],
          ['Ctrl+Z', 'Undo'],
          [['Ctrl+Y', 'Ctrl+Shift+Z'], 'Redo'],
          ['[[', 'Suggest notes to link to'],
          ['Ctrl+Enter', 'Open the wikilink under the cursor (MD View)'],
          ['Ctrl+Click', 'Open a web link in a new tab (MD View)'],
        ]),
      ]),
      helpSection('Find', [
        helpShortcutTable([
          ['Ctrl+F', 'Find and replace in the note'],
          ['Ctrl+G', 'Next match'],
          ['Ctrl+Shift+G', 'Previous match'],
          ['Ctrl+D', 'Also select the next match of the selection'],
        ]),
      ]),
      helpSection('File list', [
        helpShortcutTable([
          ['F2', 'Rename'],
          ['Delete', 'Move to the vault’s trash'],
          [['→', '←'], 'Open or close a folder'],
          [['Alt+↑', 'Alt+↓'], 'Move up or down the list'],
          [['Ctrl+C', 'Ctrl+V'], 'Copy, then paste into the selected folder'],
        ]),
      ]),
      helpSection('Tabs', [
        helpShortcutTable([
          ['Delete', 'Close the focused tab'],
          [['Alt+Shift+←', 'Alt+Shift+→'], 'Move the focused tab'],
        ]),
      ]),
      helpSection('Assistant (in development)', [
        helpShortcutTable([
          ['Ctrl+K', 'Edit the selection with the assistant'],
          ['Enter', 'Send a message, or run an edit'],
          ['Shift+Enter', 'New line in a message'],
          ['Ctrl+Enter', 'Accept an edit to a selection'],
          ['Esc', 'Reject an edit to a selection'],
        ]),
      ]),
      helpSection('Change a shortcut', [
        helpParagraph(
          'Open the gear at the right end of the top bar and choose **Settings**. **Key Bindings** lists every shortcut you can change: switching views, saving, focus mode, bold, italic, underline, editing with the assistant, and opening the link under the cursor.',
        ),
        helpNumberedSteps(['Click a shortcut.', 'Press the new keys. `Esc` stops without a change.']),
        helpParagraph(
          'Changes save as you go. Keys another action already uses are refused, and Papeliz names that action. **Reset** puts one shortcut back, and **Reset All** puts them all back. This page lists the default keys.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['format-text', 'find-and-replace', 'file-explorer', 'settings-gear'],
  },
  {
    papelizHelpArticleSlug: 'supported-markdown',
    articleTitle: 'Supported Markdown',
    articleSummary: 'CommonMark and GitHub-flavored Markdown, plus wikilinks, tags, properties and cards.',
    papelizHelpGroupSlug: 'reference',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Standard Markdown', [
        helpBulletList([
          'CommonMark: headings, emphasis, lists, quotes, inline code, code blocks, links and horizontal rules.',
          'GitHub-flavored additions: tables, task lists, strikethrough and links written as plain addresses.',
        ]),
      ]),
      helpSection('Papeliz additions', [
        helpBulletList([
          'Wikilinks, with headings and labels: `[[Note#Heading|label]]`. See [[links-between-notes]].',
          'Tags: `#tag` and `#nested/tag`. See [[tags-properties-and-cards]].',
          'YAML frontmatter, shown as properties.',
          'Cards from quotes that start with `[!kind]`, in any color.',
          'Colored and resized text, in one checked `<span>` form. See [[format-text]].',
          'Diagrams: a code block marked `mermaid` shows as a Mermaid diagram in MD View, such as a flowchart or a sequence diagram. Click it to edit its source.',
          'Wikilinks with a label inside a table cell: `[[Note|label]]` stays one cell.',
        ]),
      ]),
      helpSection('An example', [
        helpCodeSample(`---
status: draft
---
# Garden plan

Three raised beds this year. See [[Reading list]] #garden

- [x] Order the soil
- [ ] Build the beds

> [!tip] Water in the morning
> The beds dry out by noon in summer.`),
      ]),
      helpSection('Not yet', [
        helpBulletList([
          'Math and code highlighting in the rendered page.',
          'Embeds with `![[ ]]` and attachments.',
          'Raw HTML, which isn’t rendered for your safety. See [[safe-rendering]].',
        ]),
      ]),
    ],
    relatedArticleSlugs: ['md-view', 'tags-properties-and-cards', 'links-between-notes'],
  },
  {
    papelizHelpArticleSlug: 'troubleshooting',
    articleTitle: 'Troubleshooting',
    articleSummary: 'Fixes for folder permissions, browser support, browser storage, saving and links.',
    papelizHelpGroupSlug: 'reference',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Papeliz asks for permission again', [
        helpParagraph(
          'Browsers give a site access to a folder only for a while. When you reopen a folder from Recent Vaults, the browser may ask again whether Papeliz may edit it. Allow it to continue. If you don’t, the vault stays closed and your files aren’t touched.',
        ),
      ]),
      helpSection('An action says Off in this browser', [
        helpParagraph('Hover over the action, or press it, to see why. Then:'),
        helpBulletList([
          '“Couldn’t keep vaults in this browser (Update It, Or Use Chrome, Edge Or Firefox)”: update your browser, or use Chrome or Edge 103, Firefox 113 or Safari 16.4 or later.',
          '“Couldn’t keep vaults in this browser (Storage Off)”: open Papeliz in a normal window instead of a private one, and allow site data for Papeliz in your browser’s settings.',
          '**Open Vault** that can’t open folders: only Chrome and Edge on a computer open folders on your disk, on a secure `https://` page. Elsewhere, keep the vault in your browser instead.',
          '“Couldn’t open the folder window (Use Its Own Tab)”: Papeliz is showing inside another site’s page. Open it in a tab of its own.',
        ]),
        helpParagraph('**Try Sample** works in every browser. See [[browser-support]].'),
      ]),
      helpSection('A note didn’t save', [
        helpParagraph(
          'The status bar shows the reason when a save fails. Check that the folder still exists and that Papeliz still has permission to edit it, then choose **Try again** or press `Ctrl+S`.',
        ),
      ]),
      helpSection('Browser Storage Full', [
        helpParagraph(
          'In a vault kept in your browser, a save that finds the browser’s storage full shows **Not saved** with “Browser Storage Full”, and a message offers **Download backup**. Your typing is still in the open tab, so keep the tab open. Download a backup, make room, for example by deleting a browser vault you no longer need, then choose **Try again**.',
        ),
      ]),
      helpSection('Storage nearly full', [
        helpParagraph(
          '**Storage nearly full**, in the status bar or the gear’s **Settings** › **Reminder**, means Papeliz is using 90% or more of the space this browser allows it. Download a backup now, then make room before a save fails.',
        ),
      ]),
      helpSection('Safari clears a browser vault', [
        helpParagraph(
          'Safari may clear a site’s storage when your disk runs low, or after 7 days of using Safari without opening Papeliz. That erases its browser vaults. Open Papeliz at least once a week, and keep a recent backup. If a vault is gone, its backup still has every note: in Chrome or Edge on a computer, unzip it and open the folder with **Open Vault**. See [[keep-a-vault-in-your-browser]].',
        ),
      ]),
      helpSection('Open In Another Tab', [
        helpParagraph('A browser vault can’t be renamed or deleted while another tab has it open. Close it in that tab, or close the tab, then try again.'),
      ]),
      helpSection('A note changed in another app', [
        helpParagraph(
          'Papeliz picks up another app’s changes to an open note within a few seconds, and combines them with your unsaved typing when it saves. If both changed the same lines, it asks what to keep. See [[saving-and-hidden-folders]].',
        ),
      ]),
      helpSection('A link opens the wrong note', [
        helpParagraph('When two notes share a name, Papeliz picks the nearest one. Write the folder too, for example `[[Projects/Garden plan]]`.'),
      ]),
      helpSection('The assistant can’t connect', [
        helpParagraph(
          'Choose **Test connection** in **Provider and API key**, and check the key, the base URL and the model. A provider that doesn’t accept calls from a web page can’t be used from Papeliz, and servers on your own computer need to allow Papeliz’s address. See [[choose-a-provider]].',
        ),
      ]),
    ],
    relatedArticleSlugs: ['browser-support', 'open-a-folder', 'keep-a-vault-in-your-browser', 'saving-and-hidden-folders'],
  },
]
