import { fileURLToPath } from 'node:url'

// The PDF export reads WOFF font files only, so fontkit's WOFF2 decoder (`brotli/decompress.js`)
// never runs. This alias puts a one-line stand-in in its place, keeping 60 kB (gzip) out of the PDF
// worker. The stand-in's absolute path works for the dev server's dependency bundling and the build.
export const papelizPdfExportWoff2DecoderAlias = {
  find: /^brotli\/decompress\.js$/,
  replacement: fileURLToPath(new URL('../../app/web/src/modules/pdf-export/papeliz-pdf-export-woff2-unread.ts', import.meta.url)),
}
