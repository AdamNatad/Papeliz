import { helpBulletList, helpNote, helpParagraph, helpSection, type PapelizHelpArticle } from './papeliz-help-content-blocks'

export const papelizHelpPrivacyArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'where-your-notes-live',
    articleTitle: 'Where your notes live',
    articleSummary: 'In a folder on your disk, or in your browser’s own storage. Papeliz has no server to send them to.',
    papelizHelpGroupSlug: 'privacy',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('On your disk', [
        helpParagraph(
          'A vault you open with **Open Vault**, or start in **Folder Storage**, is a folder on your computer. Papeliz reads and writes it inside your browser, and nothing is uploaded to Papeliz: there is no Papeliz server, account or cloud storage.',
        ),
      ]),
      helpSection('In your browser', [
        helpParagraph(
          'A vault kept in your browser lives in that browser’s own private storage on your device, not in a folder you can see. It isn’t uploaded either.',
        ),
        helpNote(
          'Unlike a folder on your disk, a browser vault is erased when you clear your browser’s data for Papeliz, with every note in it. Download a backup now and then. See [[keep-a-vault-in-your-browser]].',
        ),
      ]),
      helpSection('Settings in your browser', [
        helpParagraph(
          'Papeliz also keeps a few things in your browser: the list of recent vaults and the permission to reopen folders, your settings, and the assistant’s provider settings. Clearing your browser’s data for Papeliz removes them, and erases vaults kept in the browser. Folders on your disk aren’t affected.',
        ),
      ]),
      helpSection('When you use the assistant', [
        helpParagraph(
          'The assistant, still in development, sends your message and the notes it reads to the provider you chose, and nothing goes until you send a message. See [[where-your-key-goes]].',
        ),
      ]),
    ],
    relatedArticleSlugs: ['where-your-key-goes', 'keep-a-vault-in-your-browser', 'saving-and-hidden-folders', 'safe-rendering'],
  },
  {
    papelizHelpArticleSlug: 'where-your-key-goes',
    articleTitle: 'Where your API key goes',
    articleSummary: 'Saved only in this browser, and sent only to the provider you picked.',
    papelizHelpGroupSlug: 'privacy',
    papelizHelpArticleAvailability: 'in-development',
    articleSections: [
      helpSection('Saved in this browser', [
        helpParagraph(
          'Your key is saved in this browser’s storage (IndexedDB), with the provider you set it for. It isn’t synced anywhere, and it isn’t sent to Papeliz: there is nowhere to send it.',
        ),
      ]),
      helpSection('Sent only to your provider', [
        helpParagraph(
          'The key goes only to that provider’s base URL, with each request you make. The notes the assistant reads go there too, and that provider’s terms apply to them.',
        ),
        helpParagraph('Papeliz is built never to log the key or put it in a web address.'),
      ]),
      helpSection('Remove it', [
        helpParagraph('Choose **Forget this key** in the **Provider and API key** settings, or clear this browser’s data for Papeliz.'),
      ]),
      helpSection('On a shared computer', [
        helpNote(
          'Anyone who can use your browser profile can use a saved key. On a shared computer, forget the key when you’re done, or use a browser profile of your own.',
        ),
        helpParagraph('A passphrase lock for saved keys is planned after launch.'),
      ]),
    ],
    relatedArticleSlugs: ['bring-your-own-key', 'choose-a-provider', 'safe-rendering'],
  },
  {
    papelizHelpArticleSlug: 'safe-rendering',
    articleTitle: 'Safe rendering',
    articleSummary: 'Notes are sanitized before they’re shown, so a note can’t run code in Papeliz.',
    papelizHelpGroupSlug: 'privacy',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Why it matters', [
        helpParagraph('Papeliz keeps your API key in the same page that shows your notes, so a note must never be able to run code there.'),
      ]),
      helpSection('What Papeliz does', [
        helpBulletList([
          'Raw HTML in a note isn’t rendered, except one checked form for colored and resized text. See [[format-text]].',
          'Every rendered note goes through a sanitizer built on GitHub’s safe list, which removes anything that could run script, such as `<script>` tags, `on…` attributes and `javascript:` links.',
          'Web links open in a new tab, apart from Papeliz.',
        ]),
      ]),
      helpSection('Notes from anywhere', [
        helpParagraph('You can open a folder of notes from any source. Papeliz shows them as text and formatting only: nothing in a note runs.'),
      ]),
    ],
    relatedArticleSlugs: ['where-your-notes-live', 'where-your-key-goes', 'supported-markdown'],
  },
]
