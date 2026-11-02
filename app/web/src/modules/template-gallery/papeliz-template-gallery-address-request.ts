import { papelizTemplateGalleryStaticListRows } from './papeliz-template-gallery-static-list'

// The website's Open in Papeliz opens the app at `/app/?papelizTemplateGalleryId=<owner>%2F<repository>`:
// the start screen then shows Templates on that template's page. The address holds only the
// template's public id.
export const papelizTemplateGalleryIdAddressParameterName = 'papelizTemplateGalleryId'

// The listed template an address's search part names, as the gallery writes its id, or null. GitHub
// names ignore case, so "adamnatad/p1-workflow" names AdamNatad/P1-Workflow too.
export function readPapelizTemplateGalleryIdFromAddressSearch(addressSearch: string): string | null {
  const templateGalleryIdInAddress = new URLSearchParams(addressSearch).get(papelizTemplateGalleryIdAddressParameterName)
  if (templateGalleryIdInAddress === null) return null
  const lowerCaseTemplateGalleryIdInAddress = templateGalleryIdInAddress.trim().toLowerCase()
  return (
    papelizTemplateGalleryStaticListRows.find((staticListRow) => staticListRow.papelizTemplateGalleryId.toLowerCase() === lowerCaseTemplateGalleryIdInAddress)
      ?.papelizTemplateGalleryId ?? null
  )
}

// Takes the template's id out of this tab's address, keeping everything else in it, and gives back the
// listed template it names, or null. Once taken it's gone from the address, so a reload, or a later
// call, opens the start screen as usual.
export function takePapelizTemplateGalleryIdFromAddress(): string | null {
  const addressSearchParameters = new URLSearchParams(window.location.search)
  if (!addressSearchParameters.has(papelizTemplateGalleryIdAddressParameterName)) return null
  const papelizTemplateGalleryId = readPapelizTemplateGalleryIdFromAddressSearch(window.location.search)
  addressSearchParameters.delete(papelizTemplateGalleryIdAddressParameterName)
  const remainingAddressSearch = addressSearchParameters.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${remainingAddressSearch === '' ? '' : `?${remainingAddressSearch}`}${window.location.hash}`)
  return papelizTemplateGalleryId
}
