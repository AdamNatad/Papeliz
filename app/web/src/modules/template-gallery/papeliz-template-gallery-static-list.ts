import type { PapelizTemplateGalleryRow } from './papeliz-template-gallery-contract'
import papelizTemplateGalleryStaticListSnapshot from './papeliz-template-gallery-static-list.json'

// The templates built into Papeliz: papeliz-template-gallery-static-list.json, in the Templates Worker's
// own snapshot shape (`GET /api/templates/gallery`), so the website's Templates pages build from the same
// file and the Worker's list can take its place. The app's gallery lists these as Featured, in the list's
// order.
//
// Each row is pinned to the commit Papeliz checked, with the fingerprint of the files it includes, their
// count and size. Use Template reads those files from jsDelivr at that commit and checks them again, so a
// row that no longer matches its commit makes no vault. Moving a template to a newer commit means running
// the template checks at that commit and copying what they report into the list.

const papelizTemplateGalleryStaticListRowsById = new Map(
  papelizTemplateGalleryStaticListSnapshot.templateGallerySnapshotRows.map((staticListRow) => [staticListRow.papelizTemplateGalleryId, staticListRow]),
)

export const papelizTemplateGalleryStaticListRows: readonly PapelizTemplateGalleryRow[] = papelizTemplateGalleryStaticListSnapshot.featuredPapelizTemplateGalleryIds.flatMap(
  (featuredTemplateGalleryId): PapelizTemplateGalleryRow[] => {
    const staticListRow = papelizTemplateGalleryStaticListRowsById.get(featuredTemplateGalleryId)
    return staticListRow === undefined ? [] : [staticListRow]
  },
)
