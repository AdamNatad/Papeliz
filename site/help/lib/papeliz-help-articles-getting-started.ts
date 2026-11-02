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
          'The assistant works on your notes with you: it answers from your notes, rewrites a selection in place, proposes changes as diffs, and suggests links and tags across notes. Nothing changes until you accept it. See [[proposed-edits]].',
        ),
      ]),
      helpSection('No account needed', [
        helpParagraph(
          'Papeliz needs no account: your notes stay on your device, and the assistant talks straight from your device to the AI providers you add, each with your own key. No Papeliz server is in between. See [[where-your-notes-live]].',
        ),
        helpParagraph(
          'A free Papeliz account is only for Papeliz Sync, the optional add-on that keeps your vaults the same on all your devices. See [[sync-your-vaults]].',
        ),
      ]),
      helpSection('Templates', [
        helpParagraph(
          'Start a vault from a template someone shares on GitHub, or add one to a vault you have. See [[open-a-folder]].',
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
          'On the start page, choose **Try Sample** at the top of **Recent Vaults**. On a first visit, with no vaults yet, it sits in the middle of the empty list.',
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
          'Type the vault’s name in **Vault Name**. Every vault has one, and it shows in **Recent Vaults**, the top bar and the status bar.',
          'Choose where to keep it: **Folder Storage** or **Browser Storage**. The table under them compares the two. In Firefox, Safari and phone browsers, **Folder Storage** shows **Off in this browser** and **Browser Storage** is chosen.',
          'For a folder, choose **Pick Folder**, pick the place it goes, such as **Documents**, and allow editing when the browser asks. Papeliz makes a folder with the vault’s name there. For the browser, choose **Create Vault**.',
          'Papeliz starts your first note, named and ready to write in.',
        ]),
        helpParagraph('**Cancel**, or Esc, goes back to **Recent Vaults**.'),
        helpParagraph('If the place already has a folder with that name and something in it, Papeliz says so and lets you pick another name or another place. An empty folder of that name is used. To open a folder that already has notes, use **Open Vault**.'),
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
      helpSection('Start from a template', [
        helpParagraph(
          'A template is a whole starter vault that someone shares from a public GitHub repository. On the start page, choose **Templates**, just above **Synced Vaults**.',
        ),
        helpNumberedSteps([
          'Pick a template in **Featured**. Its row shows the author, the license and how many files it has, and **Preview** shows every file, read-only.',
          'Choose the template to open its page, with its first note and **What’s inside**, then choose **Use Template**.',
          'If the template marks some files as optional, its folder tree shows with a switch above it: **Recommended** brings the files the author recommends, **All** brings every file, and ticking or clearing a file yourself moves the switch to **Choose**. Each choice shows how many files it brings. Required files are always ticked.',
          'If the template’s agent settings or scripts name commands, Papeliz lists each one. Papeliz never runs them. Tick **I’ve read these commands**, then choose **Continue**.',
          'New Vault opens with the template at its top. Name the vault, choose **Folder Storage** or **Browser Storage**, then **Pick Folder** or **Create Vault**. The vault opens on the template’s first note.',
        ]),
        helpParagraph('**Recheck**, on a template’s page or in Preview, asks GitHub for a newer version and checks it before Papeliz uses it.'),
        helpParagraph(
          'In a vault you already have, choose **Import** in the file list’s header, then **Import from Template**. **Import into This Vault** puts the template in a new folder named after it, at the top of the vault, and changes nothing else. The same **Recommended**, **All** and **Choose** apply.',
        ),
        helpParagraph(
          'Papeliz checks a template before it makes the vault, and removes the hidden details a camera or editor adds to its pictures. Nothing in a template runs.',
        ),
        helpParagraph(
          'To share a vault of your own as a template, use **Export as Template** in **Export**. See [[settings-gear]].',
        ),
        helpNote(
          '**New**, **Top 100**, votes and **Report** open with the Templates server. Until then, **Submit Template** checks your own repository: paste its link and choose **Check**.',
        ),
      ]),
      helpSection('Come back with Recent Vaults', [
        helpParagraph(
          'Vaults you make or open appear under **Recent Vaults** on the start page, most recent first, so you can reopen one in a click. Under each name, **Folder Storage** or **Browser Storage** says where it’s kept, and where Papeliz Sync is in use, **Sync** and its encryption or **Local** say whether it syncs. Hover over any of them to see what it means. Type in **Search vaults** to find one in a long list.',
        ),
        helpParagraph('Right-click a vault for **Open** and **Hide**. A vault kept in this browser also has **Rename** and **Download Backup**.'),
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
          'If a browser vault has changes since its last backup, the question says so and offers **Download Backup** beside **Close Vault**. The sample vault’s changes are lost when it closes.',
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
          'Type a name in **Vault Name**.',
          'Choose **Browser Storage**. In Firefox, Safari and phone browsers it’s already chosen.',
          'Choose **Create Vault**. Papeliz starts your first note.',
        ]),
        helpParagraph(
          'Each browser vault needs a name of its own, and capitals don’t make a name different. Papeliz suggests a free one, such as **Notes** or **Notes 2**, and a taken name says ‘A vault named “Notes” already exists. Pick another name.’ The name must also work as a folder’s name, since a backup unzips into a folder of that name.',
        ),
        helpParagraph('In the status bar, a browser window icon comes before the vault’s name, and a saved note shows **Saved in browser**.'),
      ]),
      helpSection('Notes you already have', [
        helpParagraph(
          'In the open vault, choose **Import** in the file list’s header. **Import from Files** takes one or more files, **Import from Folder** takes a whole folder, and **Import from Zip** takes a `.zip`. Each goes into a new folder at the top of the vault: a folder under its own name, loose files under **Imported Files**, a `.zip` under its name. If the name is taken, the folder becomes **Imported Files 2**, say. Nothing already in the vault changes, and you can rename or move the new folder like any other.',
        ),
      ]),
      helpSection('Download a backup', [
        helpParagraph(
          'A backup is the whole vault in one `.zip`: every note, folder and file, hidden ones too, so `.trash` and `.papeliz` come back. Inside, it all sits in one folder named after the vault.',
        ),
        helpParagraph('Choose **Download Backup** in any of these places:'),
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
          'Every browser vault has a backup reminder, on from the start. It comes 30 minutes after the first change since the last backup: Papeliz asks whether to back up, with **Download Backup**, and the status bar shows **Backup due** until you do. It asks again each interval after that. With no changes since the last backup, nothing reminds you.',
        ),
        helpParagraph(
          'To change it, open the gear, choose **Settings**, then the **Reminder** tab: the **Backup Reminder** switch, **Remind me every** 10, 30 or 60 min, the **Last backup**, **Download Backup**, and whether the browser keeps your storage.',
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
          'When the storage is full, a save fails: the status bar shows **Not saved** with “Browser storage full”, and a message offers **Download Backup**. See [[troubleshooting]].',
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
          '**Rename**, in the vault’s right-click menu on the start page, changes the name Papeliz shows. With the vault open, the gear’s **Settings** › **Vault** renames it too, unless another tab has it open.',
          '**Hide** takes it off **Recent Vaults** into **Hidden Vaults**. Its notes stay in this browser, and **Restore** brings it back.',
          '**Delete**, in Hidden Vaults, erases the vault and every note in it from this browser. It can’t be undone, so Papeliz offers **Download a backup** first and asks you to type the vault’s name.',
        ]),
        helpParagraph('While another tab has the vault open, Rename and Delete are refused: “It’s open in another Papeliz tab. Close it there, then try again.”'),
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
          '“This browser can’t keep vaults. Update it, or use Chrome, Edge or Firefox.”: the browser is too old, or lacks a feature browser vaults need.',
          '“This browser won’t keep vaults here, as in some private windows. Use a normal window, or let this site store data.”: the browser refuses its storage here, as some private windows do, or site data is turned off for Papeliz.',
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
    articleSummary: 'Accessibility, key bindings, backups, locking, focus mode and closing the vault in one panel, and Export beside it.',
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
          '**Account**: sign in to Papeliz Sync, then see your email, your plan and your devices, and sign out. See [[sync-your-vaults]].',
          '**Sync**: keep your vaults the same on all your devices, with the tabs **Plans** and **Settings**. Every account comes with Free. See [[sync-your-vaults]].',
          '**Settings**: the tabs **Vault**, the open vault’s name (a vault kept in your browser renames here; a folder vault takes its folder’s name), and **Key Bindings**, the shortcuts you can change. See [[keyboard-shortcuts]]. In a vault kept in your browser, a third tab, **Reminder**, holds the backup reminder and **Download Backup**. See [[keep-a-vault-in-your-browser]].',
          '**Accessibility**: the theme, how tabs show, how your notes’ text looks (font, size and width), and the **Lock All Notes** and **Focus Mode** switches. See [[text-settings-and-theme]], [[switch-views-and-lock]] and [[focus-mode|focus mode]].',
          '**AI Provider**: your saved providers. Add one, or open one’s gear for its key, models and **Advanced**. See [[bring-your-own-key]].',
          '**Close Vault**, at the bottom: back to the start page. See [[open-a-folder]].',
        ]),
      ]),
      helpSection('Export', [
        helpParagraph(
          'Export has its own button on the top bar, between the AI Assistant and the gear. It opens a panel: tick the notes you want. The open note comes ticked, and opening a folder lets you pick single notes inside it. Then pick a format and press **Export**. One note becomes one file; several become one `.zip`, folders kept. Where the browser can, Papeliz asks where to save it; otherwise, or if the file can’t be written there, it downloads.',
        ),
        helpParagraph(
          'For Word and PDF, press the gear on the format’s row to choose the **Paper**: Letter, A4 and the other sizes Google Docs offers, or **Custom** for your own width and height, from 3 to 22 inches a side (76.2 to 558.8 mm). The row shows the paper you chose. Papeliz starts with your region’s paper and remembers the one you pick.',
        ),
        helpParagraph(
          'HTML’s gear sets the **Theme** the pages open in (Light, Dark or Device; a website’s readers can still switch it), an **Accent Color** for links, tags and callouts, and the pages’ **Font**, **Text Size** and **Text Width**, which start as your **Accessibility** settings. **Use My Accessibility Text** goes back to those.',
        ),
        helpBulletList([
          '**Word**: an editable `.docx` for each note, with its headings, lists, tables, callouts, footnotes, pictures and diagrams. In a `.zip`, a link to another exported note opens that note’s file once the `.zip` is unpacked.',
          '**PDF**: pages for printing and sharing, written by Papeliz itself, with no print window. Text stays text you can search and copy, links work, and headings become bookmarks. Several notes download as one `.zip` of `.pdf` files.',
          '**HTML**: one note as a web page, several as a small website.',
          '**Template**: the ticked notes as a template others can start a vault from, in one `.zip`. See **Export as a template** below.',
        ]),
        helpParagraph('A Word file also opens in Google Docs (**File › Open › Upload**) and imports into Notion (**Import › Word**).'),
        helpParagraph(
          'Text in other scripts prints as text too. Papeliz brings fonts for Latin, Cyrillic, Greek and Vietnamese. For Chinese, Japanese, Korean, Thai, Arabic, Hebrew and others, Chrome and Edge can use the fonts on your computer: the first time a note needs them, the Export page asks, and nothing leaves your computer. Otherwise, and always for emoji, those characters print as pictures with the text kept underneath, so it still copies and searches.',
        ),
        helpParagraph(
          'Pictures and diagrams go inside the Word or PDF file, without the details a camera or editor adds, such as where a photo was taken. In a PDF, most diagrams are sharp drawings with real text; a few kinds print as pictures. A picture whose website doesn’t share it shows as a line with its address, and the page says so when the export is done.',
        ),
      ]),
      helpSection('Export as a template', [
        helpParagraph(
          'Press the gear on **Template**’s row to open **Template Settings**. **Details** holds the template’s name, a short description, up to three **Tags** (its category, which can be any word, then a subcategory and a label), the note it opens first and its **License**: pick one of the well-known licenses (hover one to read what it allows) or type your own. **Files** marks each ticked note **Recommended** or **Optional**: Recommended notes always come, and Optional ones come only when someone chooses All or ticks them. Pictures and files a note links to come with it.',
        ),
        helpParagraph(
          'Export downloads one `.zip` with the notes in their folders, a `papeliz-template.json` written from the settings and, for MIT, a `LICENSE`. For any other license, add its text as a file named `LICENSE`. Templates lists a template under any license, your own too. Put the files in a public GitHub repository, then share it with **Submit Template**. Papeliz keeps the settings for each vault.',
        ),
      ]),
      helpSection('On the start page', [
        helpParagraph('The start page has a gear too, with **Account**, **Sync** and **Accessibility**. With no vault open, Accessibility holds only the theme.'),
        helpParagraph('The start page also has **Templates** and **Synced Vaults**. See [[open-a-folder]] and [[sync-your-vaults]].'),
      ]),
    ],
    relatedArticleSlugs: ['text-settings-and-theme', 'keyboard-shortcuts', 'switch-views-and-lock'],
  },
  {
    papelizHelpArticleSlug: 'sync-your-vaults',
    articleTitle: 'Sync your vaults',
    articleSummary: 'Sign in, turn on Papeliz Sync for a vault, and open it on your other devices.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('What it is', [
        helpParagraph(
          'Papeliz Sync is an optional add-on that keeps your vaults the same on all your devices. Papeliz itself needs no account; Sync needs a free Papeliz account, and every account comes with the Free plan. Paid plans hold more. See [[sync-plans]].',
        ),
      ]),
      helpSection('Sign in', [
        helpNumberedSteps([
          'Open the gear at the right end of the top bar and choose **Sync** or **Account**, then **Sign In**. On the start page, **Synced Vaults** has **Sign In** too.',
          'The sign-in page, papeliz.com/account, opens in a new tab. Sign in with an email code, Google or Apple.',
          'A new account picks where its synced files are stored: Eastern North America, Western North America, Europe, Asia-Pacific or Oceania. The one nearest you is chosen first. You can’t change it later.',
          'Come back to Papeliz’s tab. It shows your account.',
        ]),
        helpParagraph(
          'If your browser blocks the new tab, Papeliz says so and shows **Copy Sign-In URL to Clipboard** and a **Sign In** link. Press **Sign In** to open the page yourself, or paste the copied address into a new tab.',
        ),
        helpParagraph(
          'A device stays signed in until you sign it out, remove it, or delete your account. A few actions, such as changing a passphrase or deleting your account, ask you to sign in again first.',
        ),
      ]),
      helpSection('Choose a plan', [
        helpParagraph(
          'The **Plans** tab of the gear’s **Sync** page lists Free and the paid plans. **Choose** on a paid plan opens checkout in a new tab. If you aren’t signed in yet, Papeliz first asks where your files are stored and signs you in. You can also choose a plan on papeliz.com/pricing.',
        ),
      ]),
      helpSection('Turn on Sync for a vault', [
        helpNumberedSteps([
          'Open the vault, then the gear’s **Sync** page, on the **Settings** tab.',
          'Turn on the vault’s switch. **Turn On Sync for This Vault** asks who can read the vault: **Standard** or **End-to-end**.',
          'For End-to-end, type a passphrase of at least 12 characters, twice. Papeliz never receives it and can’t recover it, so keep it somewhere safe.',
          'The first upload starts. It goes on if you close the dialog.',
        ]),
        helpDetailList([
          ['Standard', 'Encrypted on your device. Papeliz keeps the vault’s key, so the vault opens on any device you sign in on, and Papeliz could read it.'],
          ['End-to-end', 'Encrypted on your device with a key only your passphrase opens. Papeliz can’t read it.'],
        ]),
        helpParagraph('Either way, a vault’s name isn’t encrypted. Your AI provider keys never sync: you paste yours on each device.'),
      ]),
      helpSection('Open it on another device', [
        helpParagraph(
          'Sign in on the other device, then choose **Synced Vaults** on the start page and pick the vault. Papeliz downloads it and shows its progress. An End-to-end vault asks for its passphrase.',
        ),
      ]),
      helpSection('What syncs', [
        helpParagraph(
          'Notes, attachments and the vault’s own Papeliz settings, such as the file order. Under **What Syncs**, on the **Settings** tab, two switches choose whether **Settings** (theme, text and key bindings) and **Assistant Chats** sync too.',
        ),
        helpParagraph(
          'When two devices change the same note, the changes merge line by line. If both changed the same lines, Papeliz asks which to keep.',
        ),
      ]),
      helpSection('See it in the app', [
        helpParagraph(
          'On the start page, **Recent Vaults** marks each vault **Sync**, with **Standard Encryption** or **End-to-End Encryption**, or **Local** for one that doesn’t sync. The status bar shows how a synced vault is doing, such as offline or paused.',
        ),
        helpParagraph(
          '**Pause on This Device** stops syncing here for a while. **Old Versions** shows the open note’s earlier versions. See [[sync-old-versions]].',
        ),
      ]),
      helpSection('Your account page', [
        helpParagraph(
          'papeliz.com/account shows your profile, your devices, your synced vaults and billing. There you can rename or remove a device, change a vault’s passphrase, delete a vault from Sync, manage your subscription, and delete your account.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['sync-plans', 'sync-old-versions', 'settings-gear', 'where-your-notes-live'],
  },
]
