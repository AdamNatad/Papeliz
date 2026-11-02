import { helpBulletList, helpNote, helpParagraph, helpSection, type PapelizHelpArticle } from './papeliz-help-content-blocks'

export const papelizHelpPrivacyArticles: readonly PapelizHelpArticle[] = [
  {
    papelizHelpArticleSlug: 'where-your-notes-live',
    articleTitle: 'Where your notes live',
    articleSummary: 'In a folder on your disk, or in your browser’s own storage. Nothing is uploaded unless you sync a vault.',
    papelizHelpGroupSlug: 'privacy',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('On your disk', [
        helpParagraph(
          'A vault you open with **Open Vault**, or start in **Folder Storage**, is a folder on your computer. Papeliz reads and writes it inside your browser, and nothing is uploaded to Papeliz unless you turn on Papeliz Sync for that vault.',
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
      helpSection('When you sync a vault', [
        helpParagraph(
          'Papeliz Sync, the optional add-on, uploads only the vaults you turn it on for, encrypted on your device first. In a Standard vault, Papeliz keeps the vault’s key, so it could read the vault. An End-to-end vault has its own passphrase, which Papeliz never receives, so Papeliz can’t read it. Vault and device names aren’t encrypted. See [[sync-your-vaults]].',
        ),
      ]),
      helpSection('When a note shows a picture or video', [
        helpParagraph(
          'Pictures and videos stored in your vault are read from it in your browser, and showing them sends them nowhere. One with a web address loads from that address when the note shows it; that site sees the request, but not which note it is in.',
        ),
        helpParagraph(
          'A YouTube video shows as a poster Papeliz draws, so nothing reaches YouTube while you read. When you press play, it loads from YouTube’s privacy-enhanced player at youtube-nocookie.com, and from then on YouTube sees your visit, as it would on its own site. It is told the video plays on papeliz.com, never which note it is in. See [[md-view]].',
        ),
      ]),
      helpSection('When you open Templates', [
        helpParagraph(
          'Papeliz contacts other services for templates only when you open **Templates**: jsDelivr or GitHub for a template’s files and pictures. The list of templates is built into Papeliz. **Check**, in **Submit Template**, asks GitHub and jsDelivr about the repository you paste. None of them receives your notes or your key. **New**, **Top 100**, votes, **Report** and **Recheck** are Coming Soon, with Papeliz’s Templates server.',
        ),
      ]),
      helpSection('When you use the assistant', [
        helpParagraph(
          'The assistant sends your message and the notes it reads to the provider of the model you picked, and nothing goes until you send a message. See [[where-your-key-goes]].',
        ),
        helpParagraph(
          'Pictures, prompts and audio go from your browser straight to the provider you chose, with your own key, as the chat does. Papeliz has no server for them and keeps no copy. A picture or recording is saved only in your vault, and only when you save it or accept the change. See [[pictures-and-speech]].',
        ),
        helpParagraph(
          'The microphone is used only while you record, after you press **Record** and your browser asks you. **Remove C2PA** runs in your browser: no picture is sent anywhere to be cleaned.',
        ),
      ]),
    ],
    relatedArticleSlugs: ['where-your-key-goes', 'keep-a-vault-in-your-browser', 'saving-and-hidden-folders', 'safe-rendering'],
  },
  {
    papelizHelpArticleSlug: 'where-your-key-goes',
    articleTitle: 'Where your API key goes',
    articleSummary: 'Saved only in this browser, each key sent only to its own provider.',
    papelizHelpGroupSlug: 'privacy',
    papelizHelpArticleAvailability: 'available',
    articleSections: [
      helpSection('Saved in this browser', [
        helpParagraph(
          'Your keys are saved in this browser’s storage (IndexedDB), each with the provider you set it for. They aren’t sent to Papeliz, and Papeliz Sync never syncs them: you paste them on each device.',
        ),
      ]),
      helpSection('Sent only to your provider', [
        helpParagraph(
          'Each key goes only to its own provider’s base URL, with each request to one of that provider’s models. The notes the assistant reads go there too, and that provider’s terms apply to them. The address a key goes to shows under each provider’s name on the gear’s **AI Provider** page.',
        ),
        helpParagraph('Papeliz is built never to log a key or put it in a web address, and hides a key if a provider’s error message repeats it.'),
      ]),
      helpSection('Remove it', [
        helpParagraph('Choose the provider’s gear on the gear’s **AI Provider** page, then **Remove Provider**. Or clear this browser’s data for Papeliz.'),
      ]),
      helpSection('On a shared computer', [
        helpNote(
          'Anyone who can use your browser profile can use a saved key. On a shared computer, remove your providers when you’re done, or use a browser profile of your own.',
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
          'A YouTube video plays in a frame of its own, kept apart from Papeliz, and only after you press play.',
        ]),
      ]),
      helpSection('Notes from anywhere', [
        helpParagraph('You can open a folder of notes from any source. Papeliz shows them as text and formatting only: nothing in a note runs.'),
      ]),
    ],
    relatedArticleSlugs: ['where-your-notes-live', 'where-your-key-goes', 'supported-markdown'],
  },
]
