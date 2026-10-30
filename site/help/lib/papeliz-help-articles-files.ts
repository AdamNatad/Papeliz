import {
  helpBulletList,
  helpNote,
  helpNumberedSteps,
  helpParagraph,
  helpSection,
  helpShortcutTable,
  type PapelizHelpArticle,
} from './papeliz-help-content-blocks'

export const papelizHelpFilesArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'file-explorer',
    articleTitle: 'The file list and tabs',
    articleSummary: 'Browse, search and arrange your notes, and keep several open in tabs.',
    papelizHelpGroupSlug: 'files',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Browse', [
        helpParagraph(
          'The file list on the left shows the vault’s folders and notes. Click a folder to open or close it, and click a note to open it. The button at the left of the top bar shows or hides the list.',
        ),
      ]),
      helpSection('Create notes and folders', [
        helpParagraph(
          'Use the **New note** and **New folder** buttons at the top of the list, or right-click a folder and choose **New note here** or **New folder here**.',
        ),
      ]),
      helpSection('Search notes', [
        helpParagraph('Type in **Search notes** to filter the list by name. Notes whose text matches what you typed appear below the list.'),
      ]),
      helpSection('Arrange', [
        helpBulletList([
          'Drag a note or folder onto a folder to move it there, or between rows to change the order.',
          'Or choose **Move up** and **Move down** in the right-click menu, or press `Alt+↑` and `Alt+↓`.',
          'Papeliz keeps the order in the vault’s `.papeliz` folder, so it travels with the folder.',
        ]),
      ]),
      helpSection('Copy and duplicate', [
        helpParagraph(
          '**Duplicate** makes a copy beside the original. **Copy** and **Paste**, or `Ctrl+C` and `Ctrl+V` on a selected row, copy a note or a whole folder into another folder.',
        ),
      ]),
      helpSection('Tabs', [
        helpParagraph(
          'Each note you open gets a tab above the note. Click a tab to switch to it, and drag tabs to change their order. With a tab focused, `Delete` closes it and `Alt+Shift+←` or `Alt+Shift+→` moves it.',
        ),
        helpParagraph('The lock at the front of a tab locks that note. See [[switch-views-and-lock]].'),
        helpParagraph(
          'When tabs don’t fit in one row, they scroll sideways. To wrap them onto more rows instead, choose **Stack** under **Note tabs** on the gear’s **Accessibility** page. See [[text-settings-and-theme]].',
        ),
      ]),
      helpSection('Keyboard', [
        helpShortcutTable([
          ['F2', 'Rename the selected note or folder'],
          ['Delete', 'Move it to the vault’s trash'],
          [['→', '←'], 'Open or close a folder'],
          [['Alt+↑', 'Alt+↓'], 'Move it up or down the list'],
          [['Ctrl+C', 'Ctrl+V'], 'Copy it, then paste it into the selected folder'],
        ]),
      ]),
    ],
    relatedArticleSlugs: ['rename-move-and-trash', 'saving-and-hidden-folders', 'find-and-replace'],
  },
  {
    papelizHelpArticleSlug: 'rename-move-and-trash',
    articleTitle: 'Rename, move and delete',
    articleSummary: 'Rename with F2, move by dragging, and delete into the vault’s own trash.',
    papelizHelpGroupSlug: 'files',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Rename', [
        helpNumberedSteps([
          'Select the note or folder in the file list.',
          'Press `F2`, or right-click it and choose **Rename**.',
          'Type the new name and press `Enter`. `Esc` cancels.',
        ]),
        helpParagraph('A name that’s already taken in that folder is refused, so nothing is overwritten.'),
      ]),
      helpSection('Move', [
        helpParagraph(
          'Drag a note or folder onto another folder. Papeliz copies it to the new place first and removes the original only once the copy is complete, so a failed move leaves everything where it was.',
        ),
      ]),
      helpSection('Delete', [
        helpParagraph(
          'Press `Delete` or choose **Move to trash**. The note or folder moves into the vault’s `.trash` folder, which the file list doesn’t show. Papeliz never deletes a note outright.',
        ),
        helpParagraph('To get a note back, move it out of `.trash` with your computer’s file manager.'),
        helpNote('Links to a renamed or moved note aren’t updated yet. See [[links-between-notes]].'),
      ]),
    ],
    relatedArticleSlugs: ['file-explorer', 'saving-and-hidden-folders'],
  },
  {
    papelizHelpArticleSlug: 'saving-and-hidden-folders',
    articleTitle: 'Saving and hidden folders',
    articleSummary: 'Notes save as you type, and Papeliz leaves the folder’s other files alone.',
    papelizHelpGroupSlug: 'files',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Autosave', [
        helpParagraph(
          'Papeliz saves a note a moment after you stop typing, and `Ctrl+S` saves every open note right away. The status bar at the bottom shows the note’s word count, and tells you if a save failed.',
        ),
      ]),
      helpSection('Safe writes', [
        helpParagraph('Each save writes to a temporary file and swaps it in once it’s complete, so a failed write leaves the old note untouched.'),
      ]),
      helpSection('What Papeliz reads and writes', [
        helpBulletList([
          'Folders and `.md` notes: shown in the file list and saved in place.',
          '`.trash`: where deleted notes and folders go.',
          '`.papeliz`: Papeliz’s own files for the vault, such as the file list’s order.',
          'Every other hidden folder or file, such as `.git`, is left out of the list and never changed.',
          'Files that aren’t Markdown notes stay on your disk untouched, and don’t appear in the list.',
        ]),
        helpParagraph(
          'The assistant, still in development, saves each conversation as a note in a **Chat Sessions** folder in the vault. See [[chat-with-the-assistant]].',
        ),
      ]),
      helpSection('Edits from other apps', [
        helpNote(
          'Papeliz doesn’t notice yet when another app changes a note it has open. If you keep typing in Papeliz, its next save overwrites the other app’s change. Close the vault in Papeliz before you edit its notes somewhere else, and open it again afterwards.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['rename-move-and-trash', 'where-your-notes-live'],
  },
]
