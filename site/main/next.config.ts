import type { NextConfig } from 'next'

// The Papeliz site is a pure static export: `next build` writes plain files to `out/`, with no
// server, API routes or image optimization at runtime.
const papelizSiteNextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default papelizSiteNextConfig
