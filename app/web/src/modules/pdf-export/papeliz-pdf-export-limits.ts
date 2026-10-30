// The PDF export's limits, in one place. Past one, the export stops with a plain message instead of
// running the browser out of memory. Tests may lower a limit, never raise one.

export const papelizPdfExportLimits = Object.freeze({
  maximumPdfPageCountPerNote: 2_000,
  maximumPdfFileByteCount: 64 * 1024 * 1024,
  maximumPdfZipByteCount: 1024 * 1024 * 1024,
  maximumPageOperationCount: 10_000,
  maximumTextRunCodeUnitCount: 64 * 1024,
  maximumCharacterPictureCount: 4_096,
})

export type PapelizPdfExportLimits = { readonly [pdfExportLimitName in keyof typeof papelizPdfExportLimits]: number }

export function resolvePapelizPdfExportLimits(lowerPdfExportLimits: Partial<PapelizPdfExportLimits> = {}): PapelizPdfExportLimits {
  const resolvedPdfExportLimits: Record<keyof PapelizPdfExportLimits, number> = { ...papelizPdfExportLimits }
  for (const pdfExportLimitName of Object.keys(papelizPdfExportLimits) as Array<keyof PapelizPdfExportLimits>) {
    const lowerPdfExportLimit = lowerPdfExportLimits[pdfExportLimitName]
    if (lowerPdfExportLimit !== undefined && Number.isSafeInteger(lowerPdfExportLimit) && lowerPdfExportLimit > 0) {
      resolvedPdfExportLimits[pdfExportLimitName] = Math.min(papelizPdfExportLimits[pdfExportLimitName], lowerPdfExportLimit)
    }
  }
  return Object.freeze(resolvedPdfExportLimits)
}
