import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'
import { PapelizHelpShell } from '@/components/papeliz-help-shell'
import {
  createPapelizHelpJsonLdGraph,
  createPapelizHelpPageMetadata,
  papelizHelpCanonicalOrigin,
  papelizHelpDescription,
  papelizHelpHomePath,
  serializePapelizHelpJsonLd,
} from '@/lib/papeliz-help-seo'
import { papelizHelpLightBrowserBarColor, papelizHelpThemeBootScript } from '@/lib/papeliz-help-theme'

// The app's fonts, from the @fontsource files, loaded through next/font: the pages preload them,
// and the stand-in font is sized to match, so text does not jump when the real font arrives.
const papelizHelpFigtreeFont = localFont({
  src: [
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../node_modules/@fontsource/figtree/files/figtree-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-papeliz-help-figtree',
  display: 'swap',
})

const papelizHelpJetBrainsMonoFont = localFont({
  src: [
    { path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-papeliz-help-jetbrains-mono',
  display: 'swap',
  adjustFontFallback: false,
})

// The help home's metadata; each guide replaces the title, canonical link and cards.
export const metadata: Metadata = {
  metadataBase: new URL(papelizHelpCanonicalOrigin),
  title: {
    default: 'Papeliz Help',
    template: '%s - Papeliz Help',
  },
  ...createPapelizHelpPageMetadata('Papeliz Help', papelizHelpDescription, papelizHelpHomePath),
  applicationName: 'Papeliz',
  // The author page is on the main site, outside the /help base path, so its address is absolute.
  authors: [{ name: 'Adam Natad', url: `${papelizHelpCanonicalOrigin}/adam-natad/` }],
  creator: 'Adam Natad',
  publisher: 'Natad Corporation',
  // Metadata URLs don't get the /help base path that pages and next/link do, so it's written out.
  icons: { icon: '/help/favicon.svg', apple: '/help/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: papelizHelpLightBrowserBarColor,
}

export default function PapelizHelpRootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets data-papeliz-theme on <html> before React loads.
    <html lang="en" className={`${papelizHelpFigtreeFont.variable} ${papelizHelpJetBrainsMonoFont.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: papelizHelpThemeBootScript }} />
      </head>
      <body className="font-sans">
        <PapelizHelpShell>{children}</PapelizHelpShell>
        {/* The help site, the website, Natad Corporation and Adam Natad, on every page (lib/papeliz-help-seo.ts). */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePapelizHelpJsonLd(createPapelizHelpJsonLdGraph()) }} />
      </body>
    </html>
  )
}
