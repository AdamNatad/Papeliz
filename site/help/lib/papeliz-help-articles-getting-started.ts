import { helpBulletList, helpNote, helpNumberedSteps, helpParagraph, helpSection, type PapelizHelpArticle } from './papeliz-help-content-blocks'

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
          'Papeliz calls that folder a **vault**. It can be a folder you already have, a new empty one, or the built-in [[try-the-sample-vault|sample vault]].',
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
    relatedArticleSlugs: ['try-the-sample-vault', 'open-a-folder', 'browser-support'],
  },
  {
    papelizHelpArticleSlug: 'try-the-sample-vault',
    articleTitle: 'Try the sample vault',
    articleSummary: 'Explore Papeliz with a few linked example notes, without opening a folder.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Open it', [
        helpNumberedSteps([
          'On the start page, choose **Try the sample vault**.',
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
          'The sample vault lives only in this browser tab. Edit, create, rename and delete notes as much as you like: nothing is written to your disk, and your changes are gone when you close the vault or the tab.',
        ),
        helpNote('The sample vault works in every browser, including those that can’t open a folder on your disk yet.'),
      ]),
    ],
    relatedArticleSlugs: ['open-a-folder', 'md-view', 'links-between-notes'],
  },
  {
    papelizHelpArticleSlug: 'open-a-folder',
    articleTitle: 'Open a folder or start a new vault',
    articleSummary: 'Use a folder of notes you already have, or start fresh in a new folder.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Open a folder you already have', [
        helpNumberedSteps([
          'On the start page, choose **Open a folder**.',
          'Pick the folder in your browser’s folder picker.',
          'Your browser asks whether Papeliz may view and edit the files in that folder. Allow it, and the vault opens.',
        ]),
        helpParagraph(
          'The folder opens as it is. Papeliz shows its folders and `.md` notes and leaves everything else alone. See [[saving-and-hidden-folders]].',
        ),
      ]),
      helpSection('Start a new vault', [
        helpNumberedSteps([
          'On the start page, choose **New vault**.',
          'Pick or create an empty folder.',
          'Allow editing when the browser asks. Papeliz starts your first note, named and ready to write in.',
        ]),
        helpParagraph('If the folder you pick already has notes, Papeliz opens it as it is instead of starting over.'),
      ]),
      helpSection('Come back with Recent vaults', [
        helpParagraph(
          'Folders you open appear under **Recent vaults** on the start page, so you can reopen one in a click. Type in the search box to find a vault in a long list.',
        ),
        helpParagraph('When you reopen a vault, the browser may ask for permission again. See [[troubleshooting]].'),
      ]),
      helpSection('Take a vault off the list', [
        helpParagraph(
          '**Move to Trash** takes a vault off Recent vaults and leaves its folder on your disk. The start page’s **Trash** keeps it, so you can restore it later.',
        ),
        helpNote(
          '**Delete for good**, from the start page’s Trash, erases the folder and every note in it from your disk. It doesn’t go to your computer’s Recycle Bin or Trash, and it can’t be undone. Papeliz asks you to type the vault’s name first.',
        ),
      ]),
      helpSection('Close a vault', [
        helpParagraph('The **Start page** button in the top bar closes the vault and takes you back to the start page.'),
      ]),
    ],
    relatedArticleSlugs: ['browser-support', 'file-explorer', 'where-your-notes-live'],
  },
  {
    papelizHelpArticleSlug: 'browser-support',
    articleTitle: 'Browser support',
    articleSummary: 'Chrome and Edge on a computer can open folders on your disk. Other browsers can use the sample vault for now.',
    papelizHelpGroupSlug: 'getting-started',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Chrome and Edge', [
        helpParagraph(
          'Opening a real folder needs the File System Access API, which Chrome and Edge on a computer support. Use one of them to open a folder or start a new vault.',
        ),
      ]),
      helpSection('Other browsers', [
        helpParagraph(
          'Firefox, Safari and phone browsers can’t open a folder on your disk yet. The start page says so, and the [[try-the-sample-vault|sample vault]] still works there.',
        ),
        helpParagraph('A vault kept inside the browser, with zip import and export, is planned for Firefox and Safari after launch.'),
      ]),
      helpSection('Secure pages only', [
        helpParagraph(
          'Browsers allow folder access only on secure pages: `https://` addresses, or `localhost` while developing. If the folder buttons stay greyed out in Chrome or Edge, check that the page is served over `https://`.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['open-a-folder', 'troubleshooting'],
  },
]
