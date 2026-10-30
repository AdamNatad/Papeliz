export type PapelizSiteChangelogEntry = {
  papelizSiteChangelogDate: string
  papelizSiteChangelogMilestone: string
  papelizSiteChangelogTitle: string
  papelizSiteChangelogChanges: string[]
}

// Newest first, the same list as the repository's CHANGELOG.md.
export const papelizSiteChangelogEntries: PapelizSiteChangelogEntry[] = [
  {
    papelizSiteChangelogDate: '2026-10-31',
    papelizSiteChangelogMilestone: '0.2',
    papelizSiteChangelogTitle: 'Word export, every Mermaid diagram, and a clearer New Vault',
    papelizSiteChangelogChanges: [
      'Export notes as Word: an editable .docx per note, with its headings, lists, tables, callouts, footnotes, pictures and diagrams. Several notes come as one .zip whose links open each other.',
      'A Word file also opens in Google Docs and imports into Notion.',
      'Pictures go into a Word file without the details a camera or editor adds, such as where a photo was taken.',
      'The Export page lists Word, PDF and HTML as rows; PDF is coming soon.',
      'Every Mermaid diagram type draws and reads well in light and dark, on phones, and in HTML and Word exports. Wide diagrams scroll sideways instead of shrinking.',
      'New Vault opens on the start page itself: choose Folder Storage or Browser Storage, with a table that compares them.',
      'Import Vault leaves the start page. Importing a .zip into the open vault, from the file list, comes next.',
    ],
  },
  {
    papelizSiteChangelogDate: '2026-10-30',
    papelizSiteChangelogMilestone: '0.2',
    papelizSiteChangelogTitle: 'The Settings gear, HTML export, and vaults in every browser',
    papelizSiteChangelogChanges: [
      'One Settings gear in the top bar: Account, Sync, Settings with Key Bindings, Export, Accessibility with a Text size slider, Lock All Notes, Focus Mode and Close Vault.',
      'Export one note as a single .html page that looks like MD View, with its pictures and diagrams inside.',
      'Export several notes, or the whole vault, as a small website in one .zip: a page and a Markdown twin per note, search, and light and dark themes, with the site’s Astro project.',
      'Firefox, Safari and phones keep vaults in the browser. In Chrome and Edge, New Vault asks: a folder on disk, or this browser.',
      'Import a vault from a .zip or a folder, and download a backup of a browser vault any time.',
      'A reminder to back up a browser vault that has changes; set how often under Settings › Reminder.',
      'Papeliz asks the browser to keep a vault’s storage, and says when the storage is nearly full.',
      'Two tabs on one browser vault take turns saving, so neither overwrites the other.',
    ],
  },
  {
    papelizSiteChangelogDate: '2026-10-29',
    papelizSiteChangelogMilestone: '0.2',
    papelizSiteChangelogTitle: 'Papeliz is live, and the assistant grows up',
    papelizSiteChangelogChanges: [
      'Papeliz is live at papeliz.com, with the app at papeliz.com/app and help at papeliz.com/help.',
      'The AI assistant works in three modes: Ask, Plan and Write.',
      'It can ask you up to four questions on one card, and you answer with a pick or your own words.',
      'Steer the assistant while it answers, or queue your next message; choose how much effort it spends.',
      'Add files and pictures to the chat.',
      'The assistant can move notes and folders to the vault’s .trash, and never touches your saved chats.',
      'Usage shows tokens and cost for each model.',
      'The same note open in two tabs or apps: changes are combined on save, and a clash asks what to keep.',
      'Unsaved typing is kept in the browser, so a closed tab doesn’t lose it.',
      'Color and icon for any note or folder in the file list.',
      'Search results update when you edit a note, instead of showing text the note no longer has.',
      'Bigger buttons on touch screens: a tab’s lock and close, and New note.',
      'The sample vault is marked Temporary, and its notes read “Kept until reload”.',
      'Provider settings: Test connection and Get a key sit by the API key, one Save button, and a clearer Model price that shows the price Usage counts.',
      'Usage shows only usage: the totals and each model. Your chats are in Sessions.',
      'MD View draws tables and Mermaid diagrams; a diagram’s code loads only when a note has one.',
      'The Papeliz logo and name stay in the top bar on phones.',
    ],
  },
  {
    papelizSiteChangelogDate: '2026-10-28',
    papelizSiteChangelogMilestone: '0.2',
    papelizSiteChangelogTitle: 'More of the website, and a help site',
    papelizSiteChangelogChanges: [
      'New pages: Features, Roadmap, Changelog, About, Terms and License.',
      'A separate help site with guides for every part of Papeliz.',
    ],
  },
  {
    papelizSiteChangelogDate: '2026-10-27',
    papelizSiteChangelogMilestone: '0.2',
    papelizSiteChangelogTitle: 'The first build of the app',
    papelizSiteChangelogChanges: [
      'The workspace: file explorer, tabs, note area and status bar.',
      'A welcome screen and a sample vault of linked notes.',
      'Open a folder from your disk in Chrome or Edge.',
      'MD Code and MD View behind one switch.',
      'The first version of this website.',
    ],
  },
  {
    papelizSiteChangelogDate: '2026-10-27',
    papelizSiteChangelogMilestone: '0.1',
    papelizSiteChangelogTitle: 'Plan and design',
    papelizSiteChangelogChanges: [
      'The blue-and-white design, with the assistant docked on the right.',
      'Papeliz is open source under the MIT License.',
    ],
  },
]
