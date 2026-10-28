// Site-wide facts. Fill the URLs in at launch: while a value is null, the site shows "Coming soon"
// (or hides the link) instead of pointing somewhere that does not exist yet.

export const papelizSiteName = 'Papeliz'

// The one description for search and link previews; app/web/index.html carries the same text.
export const papelizSiteDescription =
  'Papeliz is a free, open-source, cross-platform Markdown editor and AI-powered note-taking app for building your personal knowledge base. Create, edit, organize, and connect your notes and ideas with a built-in AI assistant that runs on your own API key. Available on the web, Windows, macOS, Linux, Android, iOS, and HarmonyOS.'

// Every platform the description names, for search engines' structured data.
export const papelizSitePlatformNames = ['Web browser', 'Windows', 'macOS', 'Linux', 'Android', 'iOS', 'HarmonyOS']

// The public origin. The sitemap, robots file, canonical links, link-preview banner and structured
// data use it; without it they leave absolute URLs out.
export const papelizSiteCanonicalOrigin: string | null = 'https://papeliz.com'

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

// Who makes Papeliz, for search engines' structured data (lib/papeliz-site-jsonld.ts): Adam Natad,
// with the profiles that name him, and Natad Corporation, the organization behind it.
export const papelizSiteAuthorAlternateName = 'Jose Adam Climaco Natad'
export const papelizSiteAuthorJobTitle = 'Software Developer, Creator of Papeliz, and Founder and CEO of Natad Corporation'
export const papelizSiteAuthorPagePath = '/adam-natad/'
export const papelizSiteAuthorPortraitPath = '/images/adam-natad/adam-natad-portrait.webp'
export const papelizSiteAuthorProfileUrls = [
  'https://adamnatad.com',
  'https://natad.ai/adam-natad/',
  'https://www.facebook.com/AdamNatadFB',
  'https://www.youtube.com/@AdamNatad',
  'https://x.com/AdamNatad',
  'https://www.linkedin.com/in/adamnatad/',
  'https://github.com/AdamNatad',
  'https://orcid.org/0009-0002-8363-2363',
]
export const papelizSiteOrganizationUrl = 'https://natad.ai/'
export const papelizSiteOrganizationLogoPath = '/images/adam-natad/natad-corporation-icon.png'
