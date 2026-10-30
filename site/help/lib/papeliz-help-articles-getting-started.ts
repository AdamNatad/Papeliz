import { helpBulletList, helpDetailList, helpNote, helpNumberedSteps, helpParagraph, helpSection, type PapelizHelpArticle } from './papeliz-help-content-blocks'

export const papelizHelpGettingStartedArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'what-is-papeliz',
    articleTitle: 'What Papeliz is',
    articleSummary: 'A Markdown editor and AI-powered note-taking app for building your personal knowledge base, with an assistant on your own API key.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Plain Markdown in a folder you own', [
        helpParagraph(
          'Papeliz opens a folder of `.md` files where it is. Every note stays an ordinary Markdown file on your device, so the same folder keeps working in any other Markdown app.',
        ),
        helpParagraph(
          'Papeliz calls that folder a **vault**. It can be a folder you already have, a new empty one, a vault kept in your browser, or the built-in [[try-the-sample-vault|sample vault]].',
        ),
        helpParagraph(
          'Browsers that can’t open a folder on your disk, such as Firefox, Safari and phone browsers, keep the vault in the browser’s own storage instead, with the same Markdown files inside. A backup gives them back to you as a folder. See [[keep-a-vault-in-your-browser]].',
        ),
      ]),
      helpSection('Two views of every note', [
        helpParagraph(
          'Each note has two views behind one switch in the top bar. [[md-code|MD Code]] shows the raw Markdown with line numbers, like a code editor. [[md-view|MD View]] shows the note rendered, and you can still edit it there. Press `Ctrl+E` to switch.',
        ),
      ]),
      helpSection('An assistant that edits', [
        helpParagraph(
          'The assistant, still in development, works on your notes with you: it rewrites a selection in place, proposes changes as diffs, and suggests links and tags across notes. Nothing changes until you accept it. See [[proposed-edits]].',
        ),
      ]),
      helpSection('No server, no account', [
        helpParagraph(
          'There is no Papeliz account and no Papeliz server: your notes stay on your device, and the assistant talks straight from your device to the AI provider you choose, with your own key. See [[where-your-notes-live]].',
        ),
      ]),
      helpSection('Free and open source', [
        helpParagraph('Papeliz is free, and its source is released under the MIT License, so you can read it, change it and share it.'),
      ]),
    ],
    relatedArticleSlugs: ['try-the-sample-vault', 'open-a-folder', 'keep-a-vault-in-your-browser', 'browser-support'],
  },
  {
    papelizHelpArticleSlug: 'try-the-sample-vault',
    articleTitle: 'Try the sample vault',
    articleSummary: 'Explore Papeliz with a few linked example notes, before you start a vault of your own.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Open it', [
        helpNumberedSteps([
          'On the start page, choose **Try Sample**.',
          'The sample notes appear in the file list. Open **Start here** first.',
        ]),
      ]),
      helpSection('What’s inside', [
        helpParagraph('A small set of notes that link to each other:'),
        helpBulletList([
          '**Start here**, at the top of the vault.',
          'A `Guides` folder: Writing in MD View, Writing in MD Code, Links between notes, Callouts, and Your files stay yours.',
          'A `Projects` folder with a garden plan and a reading list, and an **Inbox** note.',
        ]),
      ]),
      helpSection('Nothing is saved', [
        helpParagraph(
          'The sample vault lives only in this browser tab, and the status bar marks it **Temporary**. Edit, create, rename and delete notes as much as you like: nothing is saved, and your changes are gone when you close the vault, or reload or close the tab.',
        ),
        helpNote('The sample vault works in every browser. To keep your notes, start a vault of your own. See [[open-a-folder]].'),
      ]),
    ],
    relatedArticleSlugs: ['open-a-folder', 'md-view', 'links-between-notes'],
  },
  {
    papelizHelpArticleSlug: 'open-a-folder',
    articleTitle: 'Start or open a vault',
    articleSummary: 'Start a new vault on your disk or in your browser, or open a folder of notes you already have.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Start a new vault', [
        helpNumberedSteps([
          'On the start page, choose **New Vault**. It opens where **Recent Vaults** was.',
          'Choose where to keep it: **Folder Storage** or **Browser Storage**. The table under them compares the two. In Firefox, Safari and phone browsers, **Folder Storage** shows **Off in this browser** and **Browser Storage** is chosen.',
          'For a folder, choose **Pick Folder**, pick or create an empty folder, and allow editing when the browser asks. For the browser, type a name and choose **Create Vault**.',
          'Papeliz starts your first note, named and ready to write in.',
        ]),
        helpParagraph('**Cancel**, or Esc, goes back to **Recent Vaults**.'),
        helpParagraph('If the folder you pick already has notes, Papeliz opens it as it is instead of starting over.'),
        helpParagraph('A vault kept in the browser lives in the browser’s own storage, not in a folder you can see. See [[keep-a-vault-in-your-browser]].'),
      ]),
      helpSection('Open a folder you already have', [
        helpNumberedSteps([
          'On the start page, choose **Open Vault**.',
          'Pick the folder in your browser’s folder picker.',
          'Your browser asks whether Papeliz may view and edit the files in that folder. Allow it, and the vault opens.',
        ]),
        helpParagraph(
          'The folder opens as it is. Papeliz shows its folders and `.md` notes and leaves everything else alone. See [[saving-and-hidden-folders]].',
        ),
        helpNote(
          'Only Chrome and Edge on a computer open folders on your disk. Firefox, Safari and phone browsers show **New Vault** and **Try Sample**, without **Open Vault**. See [[browser-support]].',
        ),
      ]),
      helpSection('Come back with Recent Vaults', [
        helpParagraph(
          'Vaults you make or open appear under **Recent Vaults** on the start page, most recent first, so you can reopen one in a click. Under each name, **Folder on this device** or **In this browser** says where it’s kept. Type in **Search vaults** to find one in a long list.',
        ),
        helpParagraph('Right-click a vault for **Open** and **Hide**. A vault kept in this browser also has **Rename** and **Download backup**.'),
        helpParagraph('When you reopen a folder, the browser may ask for permission again. See [[troubleshooting]].'),
      ]),
      helpSection('Hide a vault', [
        helpParagraph(
          '**Hide**, in the right-click menu or the crossed-out eye on the vault’s row, takes a vault off Recent Vaults. A folder stays on your disk, and a browser vault stays in this browser.',
        ),
        helpParagraph(
          'The crossed-out eye in the list’s heading opens **Hidden Vaults**, and its badge counts them. **Restore** puts a vault back on Recent Vaults.',
        ),
      ]),
      helpSection('Delete a vault', [
        helpParagraph(
          'In **Hidden Vaults**, **Delete** erases a vault and every note in it. Papeliz asks you to type the vault’s name first, then **Delete Vault**. **Delete All** deletes every hidden vault once you type how many there are.',
        ),
        helpNote(
          'Deleting a folder erases it from your disk. It doesn’t go to your computer’s Recycle Bin or Trash, and it can’t be undone. Deleting a browser vault erases it from this browser and can’t be undone either, so Papeliz offers **Download a backup** first.',
        ),
      ]),
      helpSection('Close a vault', [
        helpParagraph(
          'Open the gear at the right end of the top bar and choose **Close Vault**. Papeliz asks first, then you go back to the start page, where you can open the vault again. Your notes are saved and stay in the folder, or in this browser for a browser vault.',
        ),
        helpParagraph(
          'If a browser vault has changes since its last backup, the question says so and offers **Download backup** beside **Close vault**. The sample vault’s changes are lost when it closes.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['keep-a-vault-in-your-browser', 'browser-support', 'file-explorer', 'where-your-notes-live'],
  },
  {
    papelizHelpArticleSlug: 'keep-a-vault-in-your-browser',
    articleTitle: 'Keep a vault in your browser',
    articleSummary: 'A vault kept in your browser’s own storage, for Firefox, Safari and phones, and in Chrome and Edge too. Back it up now and then.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Where it lives', [
        helpParagraph(
          'A browser vault keeps its notes in this browser’s own private storage on your device, not in a folder you can see. Inside, it’s laid out like a folder: the same `.md` notes and folders, with `.trash` and `.papeliz`. Nothing is uploaded.',
        ),
        helpParagraph(
          'Chrome and Edge 103, Firefox 113 and Safari 16.4 and later keep browser vaults, on computers and phones. Only this browser sees the vault; a backup is how you take it somewhere else.',
        ),
        helpNote('Clearing this browser’s data for Papeliz deletes every vault kept in it. A browser can also clear its storage by itself, so download a backup now and then.'),
      ]),
      helpSection('Start one', [
        helpNumberedSteps([
          'On the start page, choose **New Vault**.',
          'Choose **Browser Storage**. In Firefox, Safari and phone browsers it’s already chosen.',
          'Type a name and choose **Create Vault**. Papeliz starts your first note.',
        ]),
        helpParagraph(
          'Each browser vault needs a name of its own, and capitals don’t make a name different. Papeliz suggests a free one, such as **Notes** or **Notes 2**, and a taken name shows “Can’t use this name (Name Taken)”. The name must also work as a folder’s name, since a backup unzips into a folder of that name.',
        ),
        helpParagraph('In the status bar, a browser window icon comes before the vault’s name, and a saved note shows **Saved in browser**.'),
      ]),
      helpSection('Notes you already have', [
        helpParagraph(
          'Importing a `.zip` into the open vault, from the file list, is coming. Until then, in Chrome or Edge on a computer, unzip your notes and open the folder with **Open Vault**.',
        ),
      ]),
      helpSection('Download a backup', [
        helpParagraph(
          'A backup is the whole vault in one `.zip`: every note, folder and file, hidden ones too, so `.trash` and `.papeliz` come back. Inside, it all sits in one folder named after the vault.',
        ),
        helpParagraph('Choose **Download backup** in any of these places:'),
        helpBulletList([
          'The gear’s **Settings**, on the **Reminder** tab.',
          'The **Backup due** chip in the status bar, or the reminder’s message.',
          '**Close Vault**’s question, when the vault has changes since its last backup.',
          'The start page: right-click the vault in **Recent Vaults**.',
        ]),
        helpParagraph(
          'The file is named after the vault and the time, such as `Field Notes 2026-10-30 1441.zip`. Chrome and Edge ask where to save it; other browsers download it. Once it’s saved, the status bar shows **Backed up** and the time.',
        ),
      ]),
      helpSection('The backup reminder', [
        helpParagraph(
          'Every browser vault has a backup reminder, on from the start. It comes 30 minutes after the first change since the last backup: Papeliz asks whether to back up, with **Download backup**, and the status bar shows **Backup due** until you do. It asks again each interval after that. With no changes since the last backup, nothing reminds you.',
        ),
        helpParagraph(
          'To change it, open the gear, choose **Settings**, then the **Reminder** tab: the **Backup reminder** switch, **Remind me every** 10, 30 or 60 min, the **Last backup**, **Download backup**, and whether the browser keeps your storage.',
        ),
        helpParagraph('The reminder shows only in the tab you’re looking at, so several tabs don’t all ask.'),
      ]),
      helpSection('Will the browser keep it?', [
        helpParagraph(
          'When you make or open a browser vault, Papeliz asks the browser to keep its storage. Firefox asks you, so allow it. Chrome, Edge and Safari decide by themselves. The **Reminder** tab says where it stands:',
        ),
        helpDetailList([
          ['Kept', 'This browser won’t clear it to make room.'],
          ['Not kept for sure', 'This browser may clear it when your disk runs low. Safari may also clear it after 7 days of using Safari without opening Papeliz.'],
          ['Storage nearly full', 'Papeliz is using 90% or more of the space this browser allows it. The status bar says so too. Download a backup, then make room.'],
        ]),
        helpParagraph(
          'When the storage is full, a save fails: the status bar shows **Not saved** with “Browser Storage Full”, and a message offers **Download backup**. See [[troubleshooting]].',
        ),
      ]),
      helpSection('Move it to a folder', [
        helpNumberedSteps([
          'Download a backup and unzip it.',
          'In Chrome or Edge on a computer, choose **Open Vault** on the start page.',
          'Pick the unzipped folder named after the vault.',
        ]),
        helpParagraph(
          'It opens as a folder vault, with its notes, `.trash` and `.papeliz` as they were. The browser vault stays until you delete it.',
        ),
      ]),
      helpSection('Rename, hide and delete', [
        helpBulletList([
          '**Rename**, in the vault’s right-click menu on the start page, changes the name Papeliz shows.',
          '**Hide** takes it off **Recent Vaults** into **Hidden Vaults**. Its notes stay in this browser, and **Restore** brings it back.',
          '**Delete**, in Hidden Vaults, erases the vault and every note in it from this browser. It can’t be undone, so Papeliz offers **Download a backup** first and asks you to type the vault’s name.',
        ]),
        helpParagraph('While another tab has the vault open, Rename and Delete are refused with “Open In Another Tab”. Close it there first.'),
      ]),
      helpSection('Two tabs on one vault', [
        helpParagraph(
          'You can open a browser vault in several tabs of the same browser. Saves take turns, so two tabs never write at the same moment, and each tab picks up the other’s changes. If both changed the same lines of a note, Papeliz asks which to keep.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['open-a-folder', 'browser-support', 'where-your-notes-live', 'troubleshooting'],
  },
  {
    papelizHelpArticleSlug: 'browser-support',
    articleTitle: 'Browser support',
    articleSummary: 'Chrome, Edge, Firefox and Safari keep vaults in the browser. Chrome and Edge on a computer also open folders on your disk.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Vaults kept in the browser', [
        helpParagraph(
          'Chrome and Edge 103, Firefox 113 and Safari 16.4 and later keep vaults in the browser’s own storage, on computers and phones. See [[keep-a-vault-in-your-browser]].',
        ),
        helpParagraph('Papeliz checks what your browser can do, not its name, so other browsers with the same features work too.'),
      ]),
      helpSection('Folders on your disk', [
        helpParagraph(
          'Opening a real folder needs the File System Access API, which only Chrome and Edge on a computer support. There, **New Vault** offers **Folder Storage** or **Browser Storage**, and **Open Vault** opens a folder you already have.',
        ),
        helpParagraph(
          'Firefox, Safari and phone browsers can’t open a folder on your disk. Their start page offers **New Vault**, which keeps the vault in the browser, and **Try Sample**, without **Open Vault**.',
        ),
      ]),
      helpSection('Off in this browser', [
        helpParagraph(
          'A start-page action that can’t work in this browser shows **Off in this browser**. Hover over it to see why, or press it to get the reason in a message. **Try Sample** works in every browser.',
        ),
        helpBulletList([
          '“Couldn’t keep vaults in this browser (Update It, Or Use Chrome, Edge Or Firefox)”: the browser is too old, or lacks a feature browser vaults need.',
          '“Couldn’t keep vaults in this browser (Storage Off)”: the browser refuses its storage here, as some private windows do, or site data is turned off for Papeliz.',
        ]),
        helpParagraph('See [[troubleshooting]] for what to do.'),
      ]),
      helpSection('Secure pages only', [
        helpParagraph(
          'Browsers allow folder access and browser vaults only on secure pages: `https://` addresses, or `localhost` while developing. If **New Vault** or **Open Vault** shows **Off in this browser** in a browser that should support it, check that the page is served over `https://`.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['keep-a-vault-in-your-browser', 'open-a-folder', 'troubleshooting'],
  },
  {
    papelizHelpArticleSlug: 'settings-gear',
    articleTitle: 'The Settings gear',
    articleSummary: 'Accessibility, key bindings, backups, export, locking, focus mode and closing the vault, in one panel.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Open it', [
        helpParagraph(
          'The gear at the right end of the top bar opens a panel: a list on the left, and the page you choose on the right. It opens on **Accessibility**. `Esc` or a click outside closes it.',
        ),
        helpParagraph('In a narrow window the list fills the panel. Each page opens over it, and the back arrow returns to the list.'),
      ]),
      helpSection('What’s in it', [
        helpBulletList([
          '**Account**: coming soon.',
          '**Sync**: keep your vaults in sync across web, desktop and mobile, end-to-end encrypted. A paid add-on, coming soon.',
          '**Settings**: **Key Bindings**, the shortcuts you can change. See [[keyboard-shortcuts]]. In a vault kept in your browser, Settings has two tabs, **Key Bindings** and **Reminder**, for the backup reminder and **Download backup**. See [[keep-a-vault-in-your-browser]].',
          '**Export**: download notes as Word or HTML files. PDF is coming soon. See **Export** below.',
          '**Accessibility**: the theme, how your notes’ text looks, and how note tabs show. See [[text-settings-and-theme]].',
          '**Lock All Notes**: a switch that locks every note in the vault. See [[switch-views-and-lock]].',
          '**Focus Mode**: a switch for [[focus-mode|focus mode]].',
          '**Close Vault**, at the bottom: back to the start page. See [[open-a-folder]].',
        ]),
      ]),
      helpSection('Export', [
        helpParagraph(
          'Tick the notes you want. The open note comes ticked, and opening a folder lets you pick single notes inside it. Then pick a format and press **Export**. One note downloads as one file; several download as one `.zip`, folders kept.',
        ),
        helpBulletList([
          '**Word**: an editable `.docx` for each note, with its headings, lists, tables, callouts, footnotes, pictures and diagrams. In a `.zip`, a link to another exported note opens that note’s file once the `.zip` is unpacked.',
          '**PDF**: coming soon.',
          '**HTML**: one note as a web page, several as a small website.',
        ]),
        helpParagraph('A Word file also opens in Google Docs (**File › Open › Upload**) and imports into Notion (**Import › Word**).'),
        helpParagraph(
          'Pictures and diagrams go inside the Word file, without the details a camera or editor adds, such as where a photo was taken. A picture whose website doesn’t share it shows as a line with its address, and the page says so when the export is done.',
        ),
      ]),
      helpSection('On the start page', [
        helpParagraph('The start page has a gear too, with **Account**, **Sync** and **Accessibility**. With no vault open, Accessibility holds only the theme.'),
      ]),
    ],
    relatedArticleSlugs: ['text-settings-and-theme', 'keyboard-shortcuts', 'switch-views-and-lock'],
  },
]
