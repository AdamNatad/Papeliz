import { papelizSiteDiscordUrl, papelizSiteGitHubDiscussionsUrl, papelizSiteGitHubIssuesUrl, papelizSiteGitHubRepositoryUrl } from './papeliz-site-config'

// The Community page: where people talk about Papeliz and help
// build it. A channel whose address is null shows "Coming soon" instead of a link.
export type PapelizSiteCommunityChannel = {
  papelizSiteCommunityChannelTitle: string
  papelizSiteCommunityChannelBody: string
  papelizSiteCommunityChannelActionLabel: string
  papelizSiteCommunityChannelUrl: string | null
}

export const papelizSiteCommunityHeading = 'Ask, share and help build Papeliz'
export const papelizSiteCommunityLead =
  'Papeliz is free and open source. Ask a question, show how you use it, report a bug, or send a change.'

export const papelizSiteCommunityChannels: readonly PapelizSiteCommunityChannel[] = [
  {
    papelizSiteCommunityChannelTitle: 'Discord',
    papelizSiteCommunityChannelBody: 'Chat with people who use Papeliz: questions, vault setups, and what you are writing.',
    papelizSiteCommunityChannelActionLabel: 'Join the Discord',
    papelizSiteCommunityChannelUrl: papelizSiteDiscordUrl,
  },
  {
    papelizSiteCommunityChannelTitle: 'GitHub Discussions',
    papelizSiteCommunityChannelBody: 'Ask a question or share an idea next to the code. Answers stay public and searchable.',
    papelizSiteCommunityChannelActionLabel: 'Open Discussions',
    papelizSiteCommunityChannelUrl: papelizSiteGitHubDiscussionsUrl,
  },
  {
    papelizSiteCommunityChannelTitle: 'Report a bug',
    papelizSiteCommunityChannelBody: 'Tell us what went wrong and how to make it happen again. Bugs are tracked in GitHub Issues.',
    papelizSiteCommunityChannelActionLabel: 'Open an issue',
    papelizSiteCommunityChannelUrl: papelizSiteGitHubIssuesUrl,
  },
  {
    papelizSiteCommunityChannelTitle: 'Contribute',
    papelizSiteCommunityChannelBody: 'Papeliz is MIT licensed. Read the code, fix something, and send a pull request.',
    papelizSiteCommunityChannelActionLabel: 'View the code on GitHub',
    papelizSiteCommunityChannelUrl: papelizSiteGitHubRepositoryUrl,
  },
]
