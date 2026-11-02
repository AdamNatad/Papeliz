export type PapelizSiteRoadmapStatus = 'done' | 'in-progress' | 'up-next' | 'later'

export type PapelizSiteRoadmapStep = {
  papelizSiteRoadmapStepTitle: string
  papelizSiteRoadmapStepStatus: PapelizSiteRoadmapStatus
  papelizSiteRoadmapStepItems: string[]
}

export type PapelizSiteRoadmapMilestone = {
  papelizSiteRoadmapMilestoneVersion: string
  papelizSiteRoadmapMilestoneTitle: string
  papelizSiteRoadmapMilestoneStatus: PapelizSiteRoadmapStatus
  papelizSiteRoadmapMilestoneSummary: string
  papelizSiteRoadmapMilestoneSteps: PapelizSiteRoadmapStep[]
}

export const papelizSiteRoadmapStatusLabels: Record<PapelizSiteRoadmapStatus, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  'up-next': 'Up next',
  later: 'Later',
}

// Order and scope only, never dates. Update the statuses as work finishes.
export const papelizSiteRoadmapMilestones: PapelizSiteRoadmapMilestone[] = [
  {
    papelizSiteRoadmapMilestoneVersion: '1.0',
    papelizSiteRoadmapMilestoneTitle: 'Papeliz',
    papelizSiteRoadmapMilestoneStatus: 'done',
    papelizSiteRoadmapMilestoneSummary:
      'A free, open-source Markdown editor and AI-powered note-taking app for building your personal knowledge base.',
    papelizSiteRoadmapMilestoneSteps: [
      {
        papelizSiteRoadmapStepTitle: 'Editor and vault',
        papelizSiteRoadmapStepStatus: 'done',
        papelizSiteRoadmapStepItems: [
          'Open a folder of Markdown notes, or try the sample vault',
          'Vaults kept in the browser, in every browser',
          'MD Code and MD View behind one switch',
          'Tables and Mermaid diagrams in MD View',
          'File list, tabs and wikilinks',
          'Text files such as JSON open in MD Code',
          'Import from Files, Folder and Zip, each into its own folder',
          'Autosave to plain .md files',
        ],
      },
      {
        papelizSiteRoadmapStepTitle: 'Export',
        papelizSiteRoadmapStepStatus: 'done',
        papelizSiteRoadmapStepItems: [
          'Word: one note as a .docx, or several in a .zip',
          'PDF, written by Papeliz with no print window',
          'HTML: one note as a page, or several as a website',
          'Template: notes as a template others can start from',
          'Settings for each format: paper sizes, and the HTML pages’ look',
        ],
      },
      {
        papelizSiteRoadmapStepTitle: 'Templates',
        papelizSiteRoadmapStepStatus: 'done',
        papelizSiteRoadmapStepItems: [
          'Start a vault from P1-Workflow, the first template, built in',
          'Import a template into the vault you have open',
          'Recommended, All or Choose over a template’s files',
          'Checks before use, and Preview',
        ],
      },
      {
        papelizSiteRoadmapStepTitle: 'The assistant',
        papelizSiteRoadmapStepStatus: 'done',
        papelizSiteRoadmapStepItems: [
          'Bring-your-own-key settings with provider presets',
          'Chat that cites your notes',
          'Proposed edits as diffs, and inline edits on a selection',
          'Link and tag suggestions, backlinks and outline',
          'Focus mode',
        ],
      },
      {
        papelizSiteRoadmapStepTitle: 'Every platform',
        papelizSiteRoadmapStepStatus: 'done',
        papelizSiteRoadmapStepItems: ['Web', 'Windows, macOS and Linux', 'Android and iOS', 'HarmonyOS'],
      },
    ],
  },
  {
    papelizSiteRoadmapMilestoneVersion: '1.1',
    papelizSiteRoadmapMilestoneTitle: 'Papeliz Sync',
    papelizSiteRoadmapMilestoneStatus: 'in-progress',
    papelizSiteRoadmapMilestoneSummary: 'Your knowledge base on every device, as an optional add-on with a Free plan.',
    papelizSiteRoadmapMilestoneSteps: [
      {
        papelizSiteRoadmapStepTitle: 'Papeliz Sync',
        papelizSiteRoadmapStepStatus: 'in-progress',
        papelizSiteRoadmapStepItems: [
          'Keep your vaults in sync across web, desktop and mobile',
          'Edits from two devices merge instead of overwriting each other',
          'Standard or End-to-end encryption for each vault you sync',
          'Version history, with old versions you can delete to free up space',
          'A Free plan, and three paid plans',
          'Optional: Papeliz itself stays free, with no account needed',
        ],
      },
    ],
  },
  {
    papelizSiteRoadmapMilestoneVersion: 'Next',
    papelizSiteRoadmapMilestoneTitle: 'Sharing templates',
    papelizSiteRoadmapMilestoneStatus: 'up-next',
    papelizSiteRoadmapMilestoneSummary: 'One template is built in today. More templates, sharing your own and voting are coming soon, with a free Papeliz account.',
    papelizSiteRoadmapMilestoneSteps: [
      {
        papelizSiteRoadmapStepTitle: 'Sharing templates',
        papelizSiteRoadmapStepStatus: 'up-next',
        papelizSiteRoadmapStepItems: [
          'Submit your own template from Papeliz',
          'Vote templates up or down',
          'New and Top 100 lists beside Featured',
          'Report a template',
        ],
      },
    ],
  },
  {
    papelizSiteRoadmapMilestoneVersion: 'Later',
    papelizSiteRoadmapMilestoneTitle: 'Ideas on the list',
    papelizSiteRoadmapMilestoneStatus: 'later',
    papelizSiteRoadmapMilestoneSummary: 'Not scheduled yet.',
    papelizSiteRoadmapMilestoneSteps: [
      {
        papelizSiteRoadmapStepTitle: 'Ideas on the list',
        papelizSiteRoadmapStepStatus: 'later',
        papelizSiteRoadmapStepItems: [
          'Graph view and canvas',
          'A passphrase lock for your keys',
          'Translations',
          'Math and code highlighting in MD View',
        ],
      },
    ],
  },
]
