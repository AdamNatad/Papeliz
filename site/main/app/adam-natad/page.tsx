import type { Metadata } from 'next'
import { papelizSiteName } from '@/lib/papeliz-site-config'
import { serializePapelizSiteJsonLd } from '@/lib/papeliz-site-jsonld'
import { createPapelizSitePageMetadata, papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'
import { PapelizSiteAdamNatadProfile, type AdamNatadProfileConfig } from './papeliz-site-adam-natad-profile'

const papelizSiteAdamNatadPagePath = '/adam-natad/'

// The exact description of natadtech.com/adam-natad (Adam, 2026-10-13: "just the text so its consistent in google"),
// shared by the meta, Open Graph, Twitter and JSON-LD descriptions. Change the sites together.
const papelizSiteAdamNatadProfileDescription =
  "Adam Natad (Jose Adam Climaco Natad) was born on September 1, 1997, in Juan Climaco Sr. (Magdugo), Toledo City, Cebu, Philippines. His passion for technology and creativity began early, crafting short videos in Adobe After Effects at just 10–12 years old. By 13–15, he was already developing web applications using HTML, CSS, and JavaScript. Adam's journey into software development took a significant leap at 16 when he started learning PHP and MySQL, leading to the creation of his first CMS and e-commerce platform. Over the years, Adam has honed his skills in various programming languages and frameworks, including Laravel and Flutter. He is the founder of NatadTech Solutions OPC, a company dedicated to delivering innovative software solutions. Adam is also an accomplished author with several published books on programming and technology. His dedication to excellence and innovation continues to drive his contributions to the tech community."

const papelizSiteAdamNatadProfileConfig: AdamNatadProfileConfig = {
  images: {
    adam1: '/images/adam-natad/adam-natad-portrait.webp',
    adam2: '/images/adam-natad/adam-natad-graduation.webp',
    nbdbCor: '/images/adam-natad/adam-natad-nbdb-certificate-of-registration-blurred.jpg',
  },
  external: {
    panulat: 'https://panulat.com',
    fortifyte: 'https://fortifyte.com',
    harvestmare: 'https://harvestmare.com',
    openshinobi: 'https://openshinobi.com',
    flovade: 'https://flovade.com',
    papeliz: 'https://papeliz.com',
    natadCorporationWebsite: 'https://natad.ai/',
    natadTechSolutionsWebsite: 'https://natadtech.com/',
    cloudflareForStartups: 'https://www.cloudflare.com/startups/',
    personal: 'https://adamnatad.com',
    facebook: 'https://www.facebook.com/AdamNatadFB',
    youtube: 'https://www.youtube.com/@AdamNatad',
    xProfile: 'https://x.com/AdamNatad',
    // The rest of adamnatad.com's social links (its "Others" menu, 2026-10-14).
    instagramProfile: 'https://www.instagram.com/adamnatad/',
    redditProfile: 'https://www.reddit.com/user/AdamNatad/',
    tiktokProfile: 'https://www.tiktok.com/@AdamNatad',
    spotifyArtist: 'https://open.spotify.com/artist/1KusvKG4kAwiTW8jINQfA6',
    nbdb: 'https://books.gov.ph/',
    nlp: 'https://web.nlp.gov.ph/',
    githubVideoRecoveryCLI: 'https://github.com/AdamNatad/VideoRecoveryCLI',
    videoRecoveryCLIReleases: 'https://github.com/AdamNatad/VideoRecoveryCLI/releases',
    pageSizerMarketplace: 'https://workspace.google.com/marketplace/app/page_sizer_by_adam_natad/207001493947',
    pageSizerGithub: 'https://github.com/AdamNatad/PageSizer',
    booksAmazon: 'https://amazon.com/author/adam-natad',
    booksApple: 'https://books.apple.com/us/author/adam-natad/id1803647270',
    booksKobo: 'https://www.kobo.com/us/en/author/adam-natad',
    orcid: 'https://orcid.org/0009-0002-8363-2363',
    linkedin: 'https://www.linkedin.com/in/adamnatad/',
    github: 'https://github.com/AdamNatad',
    steamDev: 'https://store.steampowered.com/developer/adamnatad',
  },
}

const papelizSiteAdamNatadPageMetadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Adam Natad',
  papelizSitePageDescription: papelizSiteAdamNatadProfileDescription,
  papelizSitePagePath: papelizSiteAdamNatadPagePath,
})

export const metadata: Metadata = {
  ...papelizSiteAdamNatadPageMetadata,
  openGraph: { ...papelizSiteAdamNatadPageMetadata.openGraph, type: 'profile' },
  keywords: [
    'Adam Natad',
    'Jose Adam Climaco Natad',
    'Papeliz',
    'Natad Corporation',
    'NatadTech',
    'NatadTech Solutions OPC',
    'FortiFyte',
    'Software Developer',
    'Unreal Engine 5',
    'Laravel',
    'Flutter',
    'Open-source',
    'NBDB',
    'Author',
    'Philippines',
  ],
}

// A profile page about Adam for search engines. Absolute URLs need the public origin, so they are left out until
// it is set (lib/papeliz-site-config.ts), as in the home page's structured data.
function createPapelizSiteAdamNatadProfileJsonLd() {
  const papelizSiteAdamNatadPageUrl = papelizSiteAbsoluteUrl(papelizSiteAdamNatadPagePath)
  const papelizSiteHomeUrl = papelizSiteAbsoluteUrl('/')
  const papelizSiteAdamNatadImageUrls = [
    papelizSiteAbsoluteUrl(papelizSiteAdamNatadProfileConfig.images.adam1),
    papelizSiteAbsoluteUrl(papelizSiteAdamNatadProfileConfig.images.adam2),
  ].filter((papelizSiteAdamNatadImageUrl): papelizSiteAdamNatadImageUrl is string => papelizSiteAdamNatadImageUrl !== null)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    ...(papelizSiteAdamNatadPageUrl ? { '@id': `${papelizSiteAdamNatadPageUrl}#profile`, url: papelizSiteAdamNatadPageUrl } : {}),
    name: 'Adam Natad',
    description: papelizSiteAdamNatadProfileDescription,
    mainEntity: {
      '@type': 'Person',
      name: 'Adam Natad',
      alternateName: 'Jose Adam Climaco Natad',
      jobTitle: 'Software Developer, Creator of Papeliz, and Founder and CEO of Natad Corporation',
      ...(papelizSiteAdamNatadPageUrl ? { url: papelizSiteAdamNatadPageUrl } : {}),
      ...(papelizSiteAdamNatadImageUrls.length > 0 ? { image: papelizSiteAdamNatadImageUrls } : {}),
      worksFor: [
        { '@type': 'Organization', name: 'Natad Corporation', url: 'https://natad.ai/' },
        { '@type': 'Organization', name: 'NatadTech Solutions OPC', url: 'https://natadtech.com/' },
      ],
      sameAs: [
        'https://adamnatad.com',
        'https://natad.ai/adam-natad/',
        'https://www.facebook.com/AdamNatadFB',
        'https://www.youtube.com/@AdamNatad',
        'https://x.com/AdamNatad',
        'https://www.linkedin.com/in/adamnatad/',
        'https://github.com/AdamNatad',
        'https://orcid.org/0009-0002-8363-2363',
      ],
    },
    isPartOf: {
      '@type': 'WebSite',
      name: papelizSiteName,
      ...(papelizSiteHomeUrl ? { '@id': `${papelizSiteHomeUrl}#website`, url: papelizSiteHomeUrl } : {}),
    },
  }
}

export default function PapelizSiteAdamNatadPage() {
  return (
    // The page frame of Adam's other site: a centred column with room around it; the sections are soft cards on it.
    <div className="flex bg-papeliz-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10">
        <PapelizSiteAdamNatadProfile adamNatadProfileConfig={papelizSiteAdamNatadProfileConfig} />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializePapelizSiteJsonLd(createPapelizSiteAdamNatadProfileJsonLd()) }}
      />
    </div>
  )
}
