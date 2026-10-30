// The site's text files: each page's Markdown twin ("projects/launch-plan.md"), index.md, llms.txt,
// and the folder list and search data the site's script reads.
import type { APIRoute, GetStaticPaths } from 'astro'
import { loadPapelizSiteContent } from '../papeliz/papeliz-site-content.mjs'

const papelizSiteTextFileContentTypes: Record<string, string> = {
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
}

export const getStaticPaths: GetStaticPaths = async () => {
  const papelizSiteContent = await loadPapelizSiteContent()
  return papelizSiteContent.siteTextFiles.map((siteTextFile: { siteFilePath: string; siteFileText: string }) => ({
    params: { papelizSiteTextFilePath: siteTextFile.siteFilePath },
    props: { siteFileText: siteTextFile.siteFileText },
  }))
}

export const GET: APIRoute = ({ params, props }) => {
  const siteFileExtension = String(params.papelizSiteTextFilePath).split('.').pop() ?? ''
  return new Response(props.siteFileText, { headers: { 'Content-Type': papelizSiteTextFileContentTypes[siteFileExtension] ?? 'text/plain; charset=utf-8' } })
}
