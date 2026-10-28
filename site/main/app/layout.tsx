import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'
import { PapelizSiteFooter } from '@/components/footer/papeliz-site-footer'
import { PapelizSiteHeader } from '@/components/header/papeliz-site-header'
import {
  papelizSiteAuthorName,
  papelizSiteAuthorPagePath,
  papelizSiteCanonicalOrigin,
  papelizSiteCopyrightHolder,
  papelizSiteDescription,
  papelizSiteName,
} from '@/lib/papeliz-site-config'
import { createPapelizSiteJsonLdGraph, serializePapelizSiteJsonLd } from '@/lib/papeliz-site-jsonld'
import { createPapelizSiteSocialCardMetadata } from '@/lib/papeliz-site-seo'
import { papelizSiteLightBrowserBarColor, papelizSiteThemeBootScript } from '@/lib/papeliz-site-theme'

// The app's fonts, from the @fontsource files, loaded through next/font: the pages preload them,
// and the stand-in font is sized to match, so text does not jump when the real font arrives.
const papelizSiteFigtreeFont = localFont({
  src: [
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-papeliz-site-figtree',
  display: 'swap',
})

const papelizSiteJetBrainsMonoFont = localFont({
  src: [
    { path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-papeliz-site-jetbrains-mono',
  display: 'swap',
  adjustFontFallback: false,
})

const papelizSiteHomeTitle = 'Papeliz - Making Notes Simple'

// The home page's metadata; every other page replaces the title, canonical and social cards.
export const metadata: Metadata = {
  ...(papelizSiteCanonicalOrigin ? { metadataBase: new URL(papelizSiteCanonicalOrigin), alternates: { canonical: '/' } } : {}),
  title: {
    default: papelizSiteHomeTitle,
    template: '%s - Papeliz',
  },
  description: papelizSiteDescription,
  applicationName: papelizSiteName,
  authors: [{ name: papelizSiteAuthorName, url: papelizSiteAuthorPagePath }],
  creator: papelizSiteAuthorName,
  publisher: papelizSiteCopyrightHolder,
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  ...createPapelizSiteSocialCardMetadata({
    papelizSiteSocialCardTitle: papelizSiteHomeTitle,
    papelizSiteSocialCardDescription: papelizSiteDescription,
    papelizSiteSocialCardPagePath: '/',
  }),
}

export const viewport: Viewport = {
  themeColor: papelizSiteLightBrowserBarColor,
}

export default function PapelizSiteRootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets data-papeliz-theme on <html> before React loads.
    <html lang="en" className={`${papelizSiteFigtreeFont.variable} ${papelizSiteJetBrainsMonoFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: papelizSiteThemeBootScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-papeliz-surface focus:px-4 focus:py-2 focus:shadow-papeliz-pop"
        >
          Skip to content
        </a>
        <PapelizSiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <PapelizSiteFooter />
        {/* The website, Natad Corporation and Adam Natad, on every page (lib/papeliz-site-jsonld.ts). */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePapelizSiteJsonLd(createPapelizSiteJsonLdGraph()) }} />
      </body>
    </html>
  )
}
