// Site-wide facts. Fill the URLs in at launch: while a value is null, the site shows "Coming soon"
// (or hides the link) instead of pointing somewhere that does not exist yet.

export const papelizSiteName = 'Papeliz'

// The one description for search and link previews; app/web/index.html carries the same text.
export const papelizSiteDescription =
  'Papeliz is a free, open-source, cross-platform Markdown editor and AI-powered note-taking app for building your personal knowledge base. Create, edit, organize, and connect your notes and ideas with a built-in AI assistant that runs on your own API key. Available on the web, Windows, macOS, Linux, Android, iOS, and HarmonyOS.'

// Every platform the description names, for search engines' structured data.
export const papelizSitePlatformNames = ['Web browser', 'Windows', 'macOS', 'Linux', 'Android', 'iOS', 'HarmonyOS']

// The public origin, such as https://example.com, once the domain is chosen. The sitemap, robots
// file and canonical links use it; without it they leave absolute URLs out.
export const papelizSiteCanonicalOrigin: string | null = null

// The webapp is served at /app/ on the same domain as the site.
export const papelizSiteAppUrl: string | null = '/app/'
// The header's Use App menu: Download and My Account show "Coming soon" until these are set.
export const papelizSiteDownloadUrl: string | null = null
export const papelizSiteAccountUrl: string | null = null
export const papelizSiteGitHubRepositoryUrl: string | null = null
// GitHub's Discussions and Issues for the repository, once it exists.
export const papelizSiteGitHubDiscussionsUrl: string | null = papelizSiteGitHubRepositoryUrl ? `${papelizSiteGitHubRepositoryUrl}/discussions` : null
export const papelizSiteGitHubIssuesUrl: string | null = papelizSiteGitHubRepositoryUrl ? `${papelizSiteGitHubRepositoryUrl}/issues` : null
// The Discord server's invite address, for the Community page.
export const papelizSiteDiscordUrl: string | null = null

// The help site (site/help) is exported under /help/ and served beside the site on the same domain.
export const papelizSiteHelpUrl: string | null = '/help/'

export const papelizSiteAuthorName = 'Adam Natad'
export const papelizSiteCopyrightHolder = 'Natad Corporation'
export const papelizSiteCopyrightYear = 2026
