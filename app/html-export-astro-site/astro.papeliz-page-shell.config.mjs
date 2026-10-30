import { defineConfig } from 'astro/config'

// Papeliz's own build of the page shell (scripts/papeliz-html-export-site-page-shell-write.mjs):
// the site's layout rendered once with markers, which Papeliz fills in the browser for each page.
export default defineConfig({
  srcDir: './papeliz-page-shell',
  publicDir: './papeliz-page-shell/public',
  outDir: './node_modules/.papeliz-page-shell',
  build: { format: 'file' },
})
