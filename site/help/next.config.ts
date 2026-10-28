import type { NextConfig } from 'next'

// Papeliz Help is a pure static export served at /help/ on the same domain as the website.
// `basePath` keeps every page and every `_next` asset under /help/, so the export can be copied
// into the assembled folder's `help/` without clashing with the website's own files.
const papelizHelpSiteNextConfig: NextConfig = {
  output: 'export',
  basePath: '/help',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default papelizHelpSiteNextConfig
