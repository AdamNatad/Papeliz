import { papelizHtmlExportSitePageShellHtml } from './papeliz-html-export-site-page-shell.generated'

// Fills the website's page shell for one page. The shell is the site's Astro layout
// (app/html-export-astro-site/src/layouts/PapelizSitePage.astro), rendered once by Astro with a
// marker in each place (papeliz-page-shell/pages/index.astro), since Astro can't run in the browser.

export interface PapelizHtmlExportSitePageValues {
  pageLanguage: string
  pageTitle: string
  siteName: string
  // "" on the home page, "../" one folder down.
  siteRootHref: string
  sitePagePath: string
  markdownTwinHref: string
  // Papeliz's rendered note: placed as it is.
  pageArticleHtml: string
}

export const papelizHtmlExportSitePageShellMarkers: Readonly<Record<keyof PapelizHtmlExportSitePageValues, string>> = {
  pageLanguage: 'papeliz-site-page-language-marker',
  pageTitle: 'papeliz-site-page-title-marker',
  siteName: 'papeliz-site-name-marker',
  siteRootHref: 'papeliz-site-root-href-marker/',
  sitePagePath: 'papeliz-site-page-path-marker',
  markdownTwinHref: 'papeliz-site-markdown-twin-href-marker',
  pageArticleHtml: '<!--papeliz-site-page-article-marker-->',
}

const papelizHtmlExportSitePageValueNamesByMarker = new Map(
  Object.entries(papelizHtmlExportSitePageShellMarkers).map(([pageValueName, pageShellMarker]) => [pageShellMarker, pageValueName as keyof PapelizHtmlExportSitePageValues]),
)
const papelizHtmlExportSitePageShellMarkerAlternatives = [...papelizHtmlExportSitePageValueNamesByMarker.keys()]
  .map((pageShellMarker) => pageShellMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')
// A marker that is an attribute's whole value (` lang="…marker…"`), or a marker anywhere else.
const papelizHtmlExportSitePageShellMarkerPattern = new RegExp(`( [\\w:-]+)="(${papelizHtmlExportSitePageShellMarkerAlternatives})"|(${papelizHtmlExportSitePageShellMarkerAlternatives})`, 'g')

// Escaped as Astro escapes them, so a page filled here is the page Astro renders from the same
// values: text gets `& < > ' "`, an attribute's value only `&` and `"`.
const papelizAstroTextEntities: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }

function escapePapelizAstroText(htmlText: string): string {
  return htmlText.replace(/[&<>'"]/g, (escapedCharacter) => papelizAstroTextEntities[escapedCharacter] ?? escapedCharacter)
}

function escapePapelizAstroAttributeValue(attributeValue: string): string {
  return attributeValue.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// One pass over the shell, so a marker's text inside a note is never taken for a marker. An
// attribute whose whole value is a marker and comes out empty is written as its bare name, as Astro
// writes an empty attribute.
export function fillPapelizHtmlExportSitePageShell(sitePageValues: PapelizHtmlExportSitePageValues, pageShellHtml = papelizHtmlExportSitePageShellHtml): string {
  return pageShellHtml.replace(
    papelizHtmlExportSitePageShellMarkerPattern,
    (shellMatchText, wholeValueAttributeNamePart: string | undefined, wholeValueMarker: string | undefined, otherMarker: string | undefined, markerIndex: number) => {
      const pageValueName = papelizHtmlExportSitePageValueNamesByMarker.get(wholeValueMarker ?? otherMarker ?? '')
      if (pageValueName === undefined) return shellMatchText
      if (pageValueName === 'pageArticleHtml') return sitePageValues.pageArticleHtml
      const pageValue = sitePageValues[pageValueName]
      if (wholeValueAttributeNamePart !== undefined) {
        return pageValue === '' ? wholeValueAttributeNamePart : `${wholeValueAttributeNamePart}="${escapePapelizAstroAttributeValue(pageValue)}"`
      }
      const shellTextBeforeMarker = pageShellHtml.slice(0, markerIndex)
      const isInsideTag = shellTextBeforeMarker.lastIndexOf('<') > shellTextBeforeMarker.lastIndexOf('>')
      return isInsideTag ? escapePapelizAstroAttributeValue(pageValue) : escapePapelizAstroText(pageValue)
    },
  )
}
