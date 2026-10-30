import type { LucideIcon } from 'lucide-react'
import { BookOpen, Crosshair, FolderOpen, KeyRound, PenLine, Sparkles } from 'lucide-react'

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
    papelizSiteFeatureGroupTitle: 'Your vault, on your disk',
    papelizSiteFeatureGroupSummary: 'A vault is just a folder of Markdown files. Papeliz opens it where it is and writes back to it.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Plain .md files', papelizSiteFeaturePointBody: 'No database and no special format. Your notes open in any other Markdown app too.' },
      { papelizSiteFeaturePointTitle: 'Open a folder', papelizSiteFeaturePointBody: 'Pick a folder in Chrome or Edge. Papeliz remembers it and asks again for access when you come back.' },
      { papelizSiteFeaturePointTitle: 'A vault in your browser', papelizSiteFeaturePointBody: 'In Firefox, Safari and on phones, a vault lives in the browser’s own storage. Import one from a .zip or a folder, and download a backup any time.' },
      { papelizSiteFeaturePointTitle: 'A sample vault', papelizSiteFeaturePointBody: 'Try Papeliz on a set of linked example notes before you open your own.' },
      { papelizSiteFeaturePointTitle: 'File explorer', papelizSiteFeaturePointBody: 'Browse, filter, create and rename notes. Deleted notes move to the vault’s own .trash folder.' },
      { papelizSiteFeaturePointTitle: 'Leaves other apps alone', papelizSiteFeaturePointBody: 'Hidden folders, such as another app’s settings folder, are never written.' },
      { papelizSiteFeaturePointTitle: 'Autosave', papelizSiteFeaturePointBody: 'Changes are saved to disk as you type.' },
      { papelizSiteFeaturePointTitle: 'Export as HTML', papelizSiteFeaturePointBody: 'One note as a single web page, or several as a small website in a .zip, with a Markdown twin of every page.' },
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
      { papelizSiteFeaturePointTitle: 'Safe by default', papelizSiteFeaturePointBody: 'Every note is sanitized before display, so a note can never run code in the page.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'assistant',
    papelizSiteFeatureGroupIcon: Sparkles,
    papelizSiteFeatureGroupTitle: 'An assistant that edits',
    papelizSiteFeatureGroupSummary: 'Docked beside your note. It reads, searches and proposes changes; you decide what is saved.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Answers that cite your notes', papelizSiteFeaturePointBody: 'Ask about a note, a selection or the whole vault. Answers link to the notes they draw on.' },
      { papelizSiteFeaturePointTitle: 'Edits as diffs', papelizSiteFeaturePointBody: 'Every change the assistant proposes shows as a diff. Accept writes the file; Reject drops it.' },
      { papelizSiteFeaturePointTitle: 'Inline edits', papelizSiteFeaturePointBody: 'Select text for Shorter, Rewrite, Fix grammar or Translate, right where you are writing.' },
      { papelizSiteFeaturePointTitle: 'Links and tags across notes', papelizSiteFeaturePointBody: 'Ask for link and tag suggestions over many notes, then review each change.' },
      { papelizSiteFeaturePointTitle: 'Backlinks and outline', papelizSiteFeaturePointBody: 'See which notes link here, and jump between the headings of a long note.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'your-key',
    papelizSiteFeatureGroupIcon: KeyRound,
    papelizSiteFeatureGroupTitle: 'Your key, your provider',
    papelizSiteFeatureGroupSummary: 'Bring an API key from the provider you like. It stays on your device.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'Any OpenAI-compatible provider', papelizSiteFeaturePointBody: 'Pick a preset, or paste any compatible base URL, hosted or running on your own machine.' },
      { papelizSiteFeaturePointTitle: 'No Papeliz server', papelizSiteFeaturePointBody: 'Requests go straight from your device to your provider. Papeliz never sees your key or your notes.' },
      { papelizSiteFeaturePointTitle: 'You see what is sent', papelizSiteFeaturePointBody: 'Each message shows which notes go with it. Nothing leaves until you send it.' },
    ],
  },
  {
    papelizSiteFeatureGroupAnchor: 'focus-mode',
    papelizSiteFeatureGroupIcon: Crosshair,
    papelizSiteFeatureGroupTitle: 'Focus mode',
    papelizSiteFeatureGroupSummary: 'Just your note and a floating prompt box, with answers above it.',
    papelizSiteFeatureGroupPoints: [
      { papelizSiteFeaturePointTitle: 'One shortcut in, one out', papelizSiteFeaturePointBody: 'Ctrl+Shift+F hides the file explorer and the panels; Esc brings them back.' },
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
