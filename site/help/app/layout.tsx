import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'
import { PapelizHelpShell } from '@/components/papeliz-help-shell'
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

export const metadata: Metadata = {
  title: {
    default: 'Papeliz Help',
    template: '%s - Papeliz Help',
  },
  description: 'Guides for Papeliz, the free, open-source, cross-platform Markdown editor and AI-powered note-taking app for building your personal knowledge base.',
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
      </body>
    </html>
  )
}
