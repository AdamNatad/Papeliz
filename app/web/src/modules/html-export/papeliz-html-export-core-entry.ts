// The part of the HTML export an exported Astro project runs when it builds: the site's content
// from its notes, made by the same code Papeliz runs in the browser. The webapp bundles it into one
// file, papeliz-html-export-core.mjs, with every package it uses (the build's
// papelizHtmlExportCorePlugin), and puts it in the project.

export { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
export { buildPapelizHtmlExportSiteContent } from './papeliz-html-export-site-content'
