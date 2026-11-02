# Changelog

What changed in Papeliz, newest first, in plain words. These entries record what has been built,
from the plan to the launch. The website's Changelog page shows the same list.

## 2026-11-02 — Templates, imports, export settings, and a Free Sync plan

_Templates start with one built in; submitting and voting are coming soon. The Free Sync plan and signing in are built, and open later._

- Templates: start a vault from a template someone shares from a public GitHub repository, or
  import one into the vault you have open, in a folder of its own. Preview shows every file first.
- Bring a template’s recommended files, all of them, or only the ones you tick in its folder tree.
- Papeliz checks a template before it makes the vault, strips its pictures’ hidden details, and
  lists every command its settings name. Recheck looks for a newer version and checks it too.
- Export as Template: the notes you tick, each Recommended or Optional, with up to three tags, the
  first being its Category, and any license.
- Import from Files, Folder, Zip or Template, each into a new folder of its own. Nothing already in
  the vault changes.
- JSON, YAML, scripts and other text files show in the file list and open in MD Code, with JSON
  colors and folding.
- Export has its own button in the top bar, between AI Assistant and Settings. It asks where to
  save when the browser can, and downloads otherwise.
- Word, PDF, HTML and Template each have a gear for their settings: every common paper size, or
  your own, for Word and PDF, and the theme, accent color, font, text size and text width of HTML
  pages.
- Settings: Accessibility holds the theme, Tabs, and the Lock All Notes and Focus Mode switches.
  Close Vault sits at the bottom.
- AI Provider: save several providers, each with its own key and tested before it’s saved. Switch
  models on or off for each provider, and pick one for each message from the model chip. Claude
  joins the providers, the recommended one takes a shorter name, and the local ones are now Ollama
  Local and LM Studio Local.
- Settings › Settings has the Vault and Key Bindings tabs, and Reminder in a browser vault, which
  can be renamed there while it’s open.
- Papeliz Sync has a Free plan: 10 MB, one synced vault and two devices, with Standard or
  End-to-end encryption. Settings › Sync has two tabs, Plans and Settings.
- Storage places are spelled out, such as Eastern North America, and the one nearest you is marked
  Nearest You.
- Signing in to Sync opens papeliz.com/account in a new tab. If the browser blocks it, a Sign In
  link and Copy Sign-In URL to Clipboard take its place. A device stays signed in until it signs
  out.
- Delete a note’s old versions, or free up a synced vault’s space by deleting old versions past an
  age.
- In the assistant’s answers, a picture from another site loads only when you press Show. Mermaid
  diagrams load nothing from other sites, and an API key in a provider’s error is hidden before
  it’s shown or saved.
- No back arrows on the start page: Esc, Cancel or Close goes back. The file list has one New menu
  for notes and folders.

## 2026-11-01 — Papeliz Sync and your Papeliz account

_Built. Accounts and Sync open later._

- Papeliz Sync, an optional add-on, keeps your vaults the same on your devices. For each vault you
  sync, choose Standard or End-to-end; either way its files are encrypted on your device before
  they’re uploaded.
- An End-to-end vault has its own passphrase, which Papeliz never receives. Change it in Papeliz or
  on your account page.
- Edits from two devices merge line by line, and a clash asks which to keep. Synced files that
  vanish from a device are held until you say whether they were deleted.
- Your account page at papeliz.com/account: your profile, your devices with Rename and Remove, your
  synced vaults, and billing.
- Synced Vaults on the start page downloads a synced vault to this device, with its progress.
- Recent Vaults says where each vault is kept, and whether it syncs: Sync with Standard Encryption
  or End-to-End Encryption, or Local.
- A vault reopens the tabs you had open, and clicking a tag searches the vault for it.
- Buttons, menus and dialog titles in Title Case, and errors as plain sentences.

## 2026-10-31 — PDF export

- Export notes as PDF, written by Papeliz itself with no print window. Text stays text you can
  search and copy, links work, and headings become bookmarks.
- A PDF keeps MD View's look: lists, task lists, quotes, callouts, tables with their header on every
  page, footnotes, properties, pictures and diagrams.
- Most Mermaid diagrams print as sharp drawings with real text; a few kinds print as pictures.
- Text in other scripts prints too. Papeliz brings fonts for Latin, Cyrillic, Greek and Vietnamese,
  and in Chrome and Edge it can use your computer's fonts for Chinese, Japanese, Korean, Thai,
  Arabic, Hebrew and more, after asking. Emoji print as pictures that still copy as emoji.
- PDFs carry the note's language, reading order, picture descriptions and table headers for screen
  readers.
- Pick the paper for Word and PDF: Letter or A4. Several notes come as one .zip of PDF files.

## 2026-10-31 — Word export, every Mermaid diagram, and a clearer New Vault

- Export notes as Word: an editable .docx per note, with its headings, lists, tables, callouts,
  footnotes, pictures and diagrams. Several notes come as one .zip whose links open each other.
- A Word file also opens in Google Docs and imports into Notion.
- Pictures go into a Word file without the details a camera or editor adds, such as where a photo
  was taken.
- The Export page lists Word, PDF and HTML as rows; PDF is coming soon.
- Every Mermaid diagram type draws and reads well in light and dark, on phones, and in HTML and
  Word exports. Wide diagrams scroll sideways instead of shrinking.
- New Vault opens on the start page itself: choose Folder Storage or Browser Storage, with a
  table that compares them.
- Import Vault leaves the start page. Importing a .zip into the open vault, from the file list,
  comes next.

## 2026-10-30 — The Settings gear, HTML export, and vaults in every browser

- One Settings gear in the top bar: Account, Sync, Settings with Key Bindings, Export, Accessibility
  with a Text size slider, Lock All Notes, Focus Mode and Close Vault.
- Export one note as a single .html page that looks like MD View, with its pictures and diagrams
  inside.
- Export several notes, or the whole vault, as a small website in one .zip: a page and a Markdown
  twin per note, search, and light and dark themes, with the site’s Astro project.
- Firefox, Safari and phones keep vaults in the browser. In Chrome and Edge, New Vault asks: a
  folder on disk, or this browser.
- Import a vault from a .zip or a folder, and download a backup of a browser vault any time.
- A reminder to back up a browser vault that has changes; set how often under Settings › Reminder.
- Papeliz asks the browser to keep a vault’s storage, and says when the storage is nearly full.
- Two tabs on one browser vault take turns saving, so neither overwrites the other.

## 2026-10-29 — Papeliz is live, and the assistant grows up

- Papeliz is live at papeliz.com, with the app at papeliz.com/app and help at papeliz.com/help.
- The AI assistant works in three modes: Ask, Plan and Write.
- It can ask you up to four questions on one card, and you answer with a pick or your own words.
- Steer the assistant while it answers, or queue your next message; choose how much effort it spends.
- Add files and pictures to the chat.
- The assistant can move notes and folders to the vault’s .trash, and never touches your saved chats.
- Usage shows tokens and cost for each model.
- The same note open in two tabs or apps: changes are combined on save, and a clash asks what to keep.
- Unsaved typing is kept in the browser, so a closed tab doesn’t lose it.
- Color and icon for any note or folder in the file list.
- Search results update when you edit a note, instead of showing text the note no longer has.
- Bigger buttons on touch screens: a tab’s lock and close, and New note.
- The sample vault is marked Temporary, and its notes read “Kept until reload”.
- Provider settings: Test connection and Get a key sit by the API key, one Save button, and a
  clearer Model price that shows the price Usage counts.
- Usage shows only usage: the totals and each model. Your chats are in Sessions.
- MD View draws tables and Mermaid diagrams; a diagram’s code loads only when a note has one.
- The Papeliz logo and name stay in the top bar on phones.

## 2026-10-28 — More of the website, and a help site

- New pages: Features, Roadmap, Changelog, About, Terms and License.
- A separate help site with guides for every part of Papeliz.

## 2026-10-27 — The first build of the app

- The workspace: file explorer, tabs, note area and status bar.
- A welcome screen and a sample vault of linked notes.
- Open a folder from your disk in Chrome or Edge.
- MD Code and MD View behind one switch.
- The first version of the website.

## 2026-10-27 — Plan and design

- The blue-and-white design, with the assistant docked on the right.
- Papeliz is open source under the MIT License.
