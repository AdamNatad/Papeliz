import type { PapelizTemplateCategoryTag, PapelizTemplateLicenseId } from './papeliz-template-gallery-contract'

// Export › Template's details as the Template Settings keep them, and what still keeps them from
// making a template. Light on purpose: the Export page reads it on every change, while the export
// itself (papeliz-template-export.ts) loads only when someone exports.

export interface PapelizTemplateExportDetails {
  templateExportName: string
  templateExportDescription: string
  templateExportCategoryTag: PapelizTemplateCategoryTag
  // A ticked note; it opens first and always comes, so it is never optional.
  templateExportFirstNotePath: string
  templateExportLicenseId: PapelizTemplateLicenseId
}

// The template's name and description, as the gallery's manifest check allows them.
export const papelizTemplateExportNameLongestLength = 80
export const papelizTemplateExportDescriptionLongestLength = 300

// The sentence that says what to fill in, or null when the details make a template.
export function findPapelizTemplateExportDetailsProblem(templateExportDetails: {
  templateExportName: string
  templateExportDescription: string
  templateExportCategoryTag: PapelizTemplateCategoryTag | null
  templateExportFirstNotePath: string | null
}): string | null {
  const templateExportName = templateExportDetails.templateExportName.trim()
  const templateExportDescription = templateExportDetails.templateExportDescription.trim()
  if (templateExportName.length === 0) return 'Give the template a name in Template Settings.'
  if (templateExportName.length > papelizTemplateExportNameLongestLength) return `The template’s name can be up to ${papelizTemplateExportNameLongestLength} characters.`
  if (templateExportDescription.length === 0) return 'Describe the template in Template Settings.'
  if (templateExportDescription.length > papelizTemplateExportDescriptionLongestLength) {
    return `The template’s description can be up to ${papelizTemplateExportDescriptionLongestLength} characters.`
  }
  if (templateExportDetails.templateExportCategoryTag === null) return 'Choose the template’s category in Template Settings.'
  if (templateExportDetails.templateExportFirstNotePath === null) return 'Tick the notes the template holds.'
  return null
}
