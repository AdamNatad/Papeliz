export type PapelizSiteChangelogEntry = {
  papelizSiteChangelogDate: string
  papelizSiteChangelogMilestone: string
  papelizSiteChangelogTitle: string
  papelizSiteChangelogChanges: string[]
}

// Newest first. Papeliz has no public release yet; these record what has been built so far.
export const papelizSiteChangelogEntries: PapelizSiteChangelogEntry[] = [
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
