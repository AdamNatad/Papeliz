// Stands in for fontkit's WOFF2 decoder (`brotli/decompress.js`) in the app's build. The PDF export
// reads only `.woff` files (papeliz-pdf-export-font-files.ts), so the decoder never runs, and leaving
// it out keeps 60 kB (gzip) from the PDF worker's download.

export default function decompressPapelizPdfExportWoff2(): never {
  throw new Error('The PDF export reads WOFF font files only.')
}
