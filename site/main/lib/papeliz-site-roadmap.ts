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
          'MD Code and MD View behind one switch',
          'File explorer, tabs and wikilinks',
          'Autosave to plain .md files',
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
    papelizSiteRoadmapMilestoneStatus: 'up-next',
    papelizSiteRoadmapMilestoneSummary: 'Your knowledge base on every device. What Papeliz is building next.',
    papelizSiteRoadmapMilestoneSteps: [
      {
        papelizSiteRoadmapStepTitle: 'Papeliz Sync',
        papelizSiteRoadmapStepStatus: 'up-next',
        papelizSiteRoadmapStepItems: [
          'Keep your vaults in sync across web, desktop and mobile',
          'Edits from two devices merge instead of overwriting each other',
          'End-to-end encrypted, so Papeliz still never sees your notes',
          'Optional: Papeliz itself stays free, with no account needed',
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
          'Math, diagrams and code highlighting in MD View',
          'Firefox and Safari on the web',
        ],
      },
    ],
  },
]
