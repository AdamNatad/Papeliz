import type { LucideIcon } from 'lucide-react'
import { BookOpen, Crosshair, FolderOpen, KeyRound, LayoutTemplate, PenLine, RefreshCw, Share, SlidersHorizontal, Sparkles } from 'lucide-react'
import { papelizSiteSyncFreePlan } from './papeliz-site-sync-plans'

export type PapelizSiteFeatureGroup = {
  papelizSiteFeatureGroupAnchor: string
  papelizSiteFeatureGroupIcon: LucideIcon
  papelizSiteFeatureGroupTitle: string
  papelizSiteFeatureGroupSummary: string
  papelizSiteFeatureGroupPoints: { papelizSiteFeaturePointTitle: string; papelizSiteFeaturePointBody: string }[]
}

// What the launch build delivers. Keep each claim true of the app before
// launch; anything later belongs in papelizSiteAfterLaunchFeatures.
export const papelizSiteFeatureGroups: PapelizSiteFeatureGroup[] = [
  {
    papelizSiteFeatureGroupAnchor: 'vault',
    papelizSiteFeatureGroupIcon: FolderOpen,
    papelizSiteFeatureGroupTitle: 'Your vault, on your device',
    papelizSiteFeatureGroupSummary: 'A vault is just a folder of Markdown files. Papeliz opens it where it is and writes back to it.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Plain .md files', papelizSiteFeaturePointBody: 'No database and no special format. Your notes open in any other Markdown app too.' },
      { papelizSiteFeaturePointTitle: 'Folder Storage', papelizSiteFeaturePointBody: 'Pick a folder in Chrome or Edge. Papeliz remembers it and asks again for access when you come back.' },
      { papelizSiteFeaturePointTitle: 'Browser Storage', papelizSiteFeaturePointBody: 'A vault kept in the browser’s own storage, in every browser, phones included. Download a backup any time.' },
      { papelizSiteFeaturePointTitle: 'A sample vault', papelizSiteFeaturePointBody: 'Try Papeliz on a set of linked example notes before you open your own.' },
      { papelizSiteFeaturePointTitle: 'Recent Vaults', papelizSiteFeaturePointBody: 'Reopen any vault in a click. Each row says where it’s kept, and whether it syncs and how it’s encrypted.' },
      {
        papelizSiteFeaturePointTitle: 'Import into a vault',
        papelizSiteFeaturePointBody: 'Import from Files, Folder, Zip or Template. Each lands in a new folder of its own, and nothing already in the vault changes.',
      },
      { papelizSiteFeaturePointTitle: 'File list', papelizSiteFeaturePointBody: 'Browse, filter, create, rename and arrange notes. Deleted notes move to the vault’s own .trash folder.' },
      {
        papelizSiteFeaturePointTitle: 'Text files too',
        papelizSiteFeaturePointBody: 'JSON, YAML, scripts and other text files open in MD Code, with JSON colors and folding. Nothing in them ever runs.',
      },
      {
        papelizSiteFeaturePointTitle: 'Leaves other apps alone',
        papelizSiteFeaturePointBody: 'Show Hidden lists hidden folders and files, such as another app’s settings, read-only. Papeliz never writes them.',
      },
      { papelizSiteFeaturePointTitle: 'This Note', papelizSiteFeaturePointBody: 'Under the file list: the open note’s outline, and every note that links to it.' },
      { papelizSiteFeaturePointTitle: 'Autosave', papelizSiteFeaturePointBody: 'Changes are saved as you type.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'md-code',
    papelizSiteFeatureGroupIcon: PenLine,
    papelizSiteFeatureGroupTitle: 'MD Code',
    papelizSiteFeatureGroupSummary: 'The raw Markdown, laid out like a code editor, so your file stays exactly as you wrote it.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Syntax colors and line numbers', papelizSiteFeaturePointBody: 'Headings, links, frontmatter and wikilinks are easy to tell apart.' },
      { papelizSiteFeaturePointTitle: 'Link as you type', papelizSiteFeaturePointBody: 'Type [[ to pick another note from your vault.' },
      { papelizSiteFeaturePointTitle: 'Find and replace', papelizSiteFeaturePointBody: 'Search inside the note and replace one match or all of them.' },
      { papelizSiteFeaturePointTitle: 'Undo per note', papelizSiteFeaturePointBody: 'Each open note keeps its own undo history.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'md-view',
    papelizSiteFeatureGroupIcon: BookOpen,
    papelizSiteFeatureGroupTitle: 'MD View',
    papelizSiteFeatureGroupSummary: 'The rendered note, one switch away from MD Code.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'GitHub-flavored Markdown', papelizSiteFeaturePointBody: 'Tables, task lists, strikethrough and fenced code.' },
      { papelizSiteFeaturePointTitle: 'Tables and diagrams', papelizSiteFeaturePointBody: 'Tables show as tables, and a mermaid code block as a diagram. Click either to edit its Markdown.' },
      { papelizSiteFeaturePointTitle: 'Wikilinks and tags', papelizSiteFeaturePointBody: '[[Links]] open the note they name, and #tags stand out.' },
      { papelizSiteFeaturePointTitle: 'Properties and callouts', papelizSiteFeaturePointBody: 'YAML frontmatter shows as property chips; > [!note] blocks show as callouts.' },
      {
        papelizSiteFeaturePointTitle: 'Safe by default',
        papelizSiteFeaturePointBody: 'Every note is sanitized before display, so a note can never run code in the page, and a diagram loads nothing from other sites.',
      },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'export',
    papelizSiteFeatureGroupIcon: Share,
    papelizSiteFeatureGroupTitle: 'Export',
    papelizSiteFeatureGroupSummary: 'Export, in the top bar: tick the notes you want and pick a format. Each format has a gear for its settings.',
    papelizSiteFeatureGroupPoints: [
      {
        papelizSiteFeaturePointTitle: 'Word',
        papelizSiteFeaturePointBody: 'An editable .docx per note, with its tables, callouts, footnotes, pictures and diagrams. Google Docs and Notion open it too.',
      },
      {
        papelizSiteFeaturePointTitle: 'PDF',
        papelizSiteFeaturePointBody: 'Written by Papeliz itself, with no print window. Text stays text you can search and copy, links work, and headings become bookmarks.',
      },
      { papelizSiteFeaturePointTitle: 'Paper sizes', papelizSiteFeaturePointBody: 'Letter, A4 and the other common sizes for Word and PDF, or a custom width and height.' },
      { papelizSiteFeaturePointTitle: 'HTML', papelizSiteFeaturePointBody: 'One note as a single web page, or several as a small website in a .zip, with a Markdown twin of every page.' },
      { papelizSiteFeaturePointTitle: 'HTML Settings', papelizSiteFeaturePointBody: 'The pages’ theme, accent color, font, text size and text width.' },
      {
        papelizSiteFeaturePointTitle: 'Template',
        papelizSiteFeaturePointBody: 'The notes you tick as a template others can start from: Recommended or Optional files, up to three tags, and any license.',
      },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'templates',
    papelizSiteFeatureGroupIcon: LayoutTemplate,
    papelizSiteFeatureGroupTitle: 'Templates',
    papelizSiteFeatureGroupSummary: 'Whole starter vaults that people share from their own public GitHub repositories.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Start a vault from one', papelizSiteFeaturePointBody: 'Templates on the start page lists them. Preview shows every file, read-only, before you use one.' },
      { papelizSiteFeaturePointTitle: 'Or add one to your vault', papelizSiteFeaturePointBody: 'Import from Template puts it in a new folder named after it, and changes nothing else.' },
      {
        papelizSiteFeaturePointTitle: 'Recommended, All or Choose',
        papelizSiteFeaturePointBody: 'Bring the files the author recommends, every file, or only the ones you tick in the template’s folder tree.',
      },
      {
        papelizSiteFeaturePointTitle: 'Checked first',
        papelizSiteFeaturePointBody: 'Papeliz checks a template before it makes the vault, strips its pictures’ hidden details, and lists every command its settings name. Nothing runs.',
      },
      { papelizSiteFeaturePointTitle: 'Always a known version', papelizSiteFeaturePointBody: 'Papeliz reads the version it checked. Recheck looks for a newer one and checks it too.' },
      { papelizSiteFeaturePointTitle: 'Share your own', papelizSiteFeaturePointBody: 'Make one with Export as Template, put it in a public GitHub repository, and check it with Submit Template.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'assistant',
    papelizSiteFeatureGroupIcon: Sparkles,
    papelizSiteFeatureGroupTitle: 'An assistant that edits',
    papelizSiteFeatureGroupSummary: 'Docked beside your note. It reads, searches and proposes changes; you decide what is saved.',
    papelizSiteFeatureGroupPoints: [
      {
        papelizSiteFeaturePointTitle: 'Ask, Plan and Write',
        papelizSiteFeaturePointBody: 'Ask answers from your notes and never changes them. Plan turns an idea into steps. Write edits, adds and deletes notes, and you review each change.',
      },
      { papelizSiteFeaturePointTitle: 'Answers that cite your notes', papelizSiteFeaturePointBody: 'Ask about a note, a selection or the whole vault. Answers link to the notes they draw on.' },
      { papelizSiteFeaturePointTitle: 'Edits as diffs', papelizSiteFeaturePointBody: 'Every change the assistant proposes shows as a diff. Accept writes the file; Reject drops it.' },
      { papelizSiteFeaturePointTitle: 'Inline edits', papelizSiteFeaturePointBody: 'Select text for Shorter, Rewrite, Fix Grammar or Translate, right where you are writing.' },
      { papelizSiteFeaturePointTitle: 'Links and tags across notes', papelizSiteFeaturePointBody: 'Ask for link and tag suggestions over many notes, then review each change.' },
      { papelizSiteFeaturePointTitle: 'Files and pictures', papelizSiteFeaturePointBody: 'Add files and pictures to a message. A picture from another site in an answer loads only when you press Show.' },
      { papelizSiteFeaturePointTitle: 'Sessions and Usage', papelizSiteFeaturePointBody: 'Every chat is saved in the vault as a note. Usage shows the tokens and cost of each model.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'your-key',
    papelizSiteFeatureGroupIcon: KeyRound,
    papelizSiteFeatureGroupTitle: 'Your key, your provider',
    papelizSiteFeatureGroupSummary: 'Bring an API key from the provider you like. It stays on your device.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Any OpenAI-compatible provider', papelizSiteFeaturePointBody: 'Pick a preset, or paste any compatible base URL, hosted or running on your own machine.' },
      { papelizSiteFeaturePointTitle: 'No Papeliz server', papelizSiteFeaturePointBody: 'Requests go straight from your device to your provider, never through Papeliz, and your key goes only to that provider.' },
      { papelizSiteFeaturePointTitle: 'You see what is sent', papelizSiteFeaturePointBody: 'Each message shows which notes go with it. Nothing leaves until you send it.' },
      { papelizSiteFeaturePointTitle: 'Keys kept out of errors', papelizSiteFeaturePointBody: 'If a provider’s error repeats your key, Papeliz hides it before the error is shown or saved.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'sync',
    papelizSiteFeatureGroupIcon: RefreshCw,
    papelizSiteFeatureGroupTitle: 'Papeliz Sync',
    papelizSiteFeatureGroupSummary: 'The one add-on, and optional: your vaults, the same on every device.',
    papelizSiteFeatureGroupPoints: [
      {
        papelizSiteFeaturePointTitle: 'A Free plan',
        papelizSiteFeaturePointBody: `Every account comes with Free: ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanStorageLabel}, ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanVaultLimit} synced vault and ${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} devices. Paid plans hold more.`,
      },
      {
        papelizSiteFeaturePointTitle: 'Standard or End-to-end',
        papelizSiteFeaturePointBody: 'Chosen for each vault you sync. Either way its files are encrypted on your device before they’re uploaded.',
      },
      { papelizSiteFeaturePointTitle: 'Edits merge', papelizSiteFeaturePointBody: 'Edits from two devices merge line by line. If both changed the same line, Papeliz asks which to keep.' },
      { papelizSiteFeaturePointTitle: 'Version history', papelizSiteFeaturePointBody: 'Look at the open note’s old versions and restore one, or delete old versions to free up space.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'settings',
    papelizSiteFeatureGroupIcon: SlidersHorizontal,
    papelizSiteFeatureGroupTitle: 'Make it yours',
    papelizSiteFeatureGroupSummary: 'One Settings gear in the top bar.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Accessibility', papelizSiteFeaturePointBody: 'A light, dark or device theme, your notes’ font, text size and text width, and how tabs show.' },
      { papelizSiteFeaturePointTitle: 'Key Bindings', papelizSiteFeaturePointBody: 'Change the shortcuts for switching views, saving, formatting, focus mode and more.' },
      { papelizSiteFeaturePointTitle: 'Lock All Notes', papelizSiteFeaturePointBody: 'Read every note without changing it, or lock single notes and folders from their tabs and the file list.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'focus-mode',
    papelizSiteFeatureGroupIcon: Crosshair,
    papelizSiteFeatureGroupTitle: 'Focus mode',
    papelizSiteFeatureGroupSummary: 'Just your note and a floating prompt box, with answers above it.',
    papelizSiteFeatureGroupPoints: [
      {
        papelizSiteFeaturePointTitle: 'One shortcut in, one out',
        papelizSiteFeaturePointBody: 'Ctrl+Shift+F, or the Focus Mode switch in Accessibility, hides the file list and the panels; Esc brings them back.',
      },
    ],
  },
]

// Planned after launch. Not scheduled.
export const papelizSiteAfterLaunchFeatures = [
  'Graph view and canvas',
  'Offline install',
  'A passphrase lock for your keys',
  'Translations',
  'Math and code highlighting in MD View',
]
