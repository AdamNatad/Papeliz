// Site-wide facts. Fill the URLs in at launch: while a value is null, the site shows "Coming soon"
// (or hides the link) instead of pointing somewhere that does not exist yet.

export const papelizSiteName = 'Papeliz'

// The one description for search and link previews; app/web/index.html carries the same text.
export const papelizSiteDescription =
  'Papeliz is a Free, Open-Source Markdown Editor for your Personal Knowledge Base, with a built-in AI Assistant and Workflow Templates for Coding and AI Agents.'

// Every platform Papeliz runs on, for search engines' structured data.
export const papelizSitePlatformNames = ['Web browser', 'Windows', 'macOS', 'Linux', 'Android', 'iOS', 'HarmonyOS']

// The public origin. The sitemap, robots file, canonical links, link-preview banner and structured
// data use it; without it they leave absolute URLs out.
export const papelizSiteCanonicalOrigin: string | null = 'https://papeliz.com'

// The webapp is served at /app/ on the same domain as the site.
export const papelizSiteAppUrl: string | null = '/app/'
// The Download page (app/download/), which lists every app: the header's Use App menu and the account
// page's download menu link to it. Each app's own link is in lib/papeliz-site-downloads.ts.
export const papelizSiteDownloadUrl: string | null = '/download/'
// My Account opens the sign-in and account page (app/account/), live with Papeliz Sync.
export const papelizSiteAccountUrl: string | null = '/account/'
// The Templates pages (app/templates/). While null, the header leaves the Templates link out; the pages
// are still built.
export const papelizSiteTemplatesUrl: string | null = '/templates/'
// Whether the Templates pages read the Templates Worker's hourly list (papeliz.com/api/templates/gallery).
// While false, the build and every page show only the templates built into Papeliz (the app's static
// list), Open in Papeliz works, no vote counts show, and one line says more templates, submitting and
// votes are Coming Soon; no page asks /api/templates/. Switched on, the build reads the Worker's list,
// keeping the static list for when it can't be reached, and the list page refreshes from it.
export const isPapelizSiteTemplatesWorkerSwitchedOn = false
export const papelizSiteGitHubRepositoryUrl: string | null = 'https://github.com/AdamNatad/Papeliz'
// GitHub's Discussions and Issues for the repository. Discussions are turned off on the repository
// for now, so their link shows "Coming soon" until they are turned on.
const isPapelizSiteGitHubDiscussionsOn = false
export const papelizSiteGitHubDiscussionsUrl: string | null =
  papelizSiteGitHubRepositoryUrl && isPapelizSiteGitHubDiscussionsOn ? `${papelizSiteGitHubRepositoryUrl}/discussions` : null
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
