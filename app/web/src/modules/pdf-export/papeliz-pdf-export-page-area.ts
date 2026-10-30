import {
  papelizExportFooterDistanceFromPageEdgeMillimeters,
  papelizExportPageMarginsInMillimeters,
  papelizExportPageSizesInPoints,
  type PapelizExportPageSize,
} from '../export-print-style/papeliz-export-print-style'

// Where a page's content and footer go, in points, from the print style's paper sizes and margins.
// The page reads it to size pictures, and the worker to lay out pages, so it imports nothing else.

export interface PapelizPdfExportPageArea {
  pageWidthPoints: number
  pageHeightPoints: number
  contentLeftPoints: number
  contentTopPoints: number
  contentWidthPoints: number
  contentBottomPoints: number
  // The footer's line ends this far above the page's bottom edge.
  footerBottomFromPageEdgePoints: number
}

const papelizPdfExportPointsPerMillimeter = 72 / 25.4

export function getPapelizPdfExportPageArea(pdfExportPageSize: PapelizExportPageSize): PapelizPdfExportPageArea {
  const { pageWidthPoints, pageHeightPoints } = papelizExportPageSizesInPoints[pdfExportPageSize]
  const { topMillimeters, rightMillimeters, bottomMillimeters, leftMillimeters } = papelizExportPageMarginsInMillimeters
  const contentLeftPoints = leftMillimeters * papelizPdfExportPointsPerMillimeter
  const contentTopPoints = topMillimeters * papelizPdfExportPointsPerMillimeter
  return {
    pageWidthPoints,
    pageHeightPoints,
    contentLeftPoints,
    contentTopPoints,
    contentWidthPoints: pageWidthPoints - contentLeftPoints - rightMillimeters * papelizPdfExportPointsPerMillimeter,
    contentBottomPoints: pageHeightPoints - bottomMillimeters * papelizPdfExportPointsPerMillimeter,
    footerBottomFromPageEdgePoints: papelizExportFooterDistanceFromPageEdgeMillimeters * papelizPdfExportPointsPerMillimeter,
  }
}
