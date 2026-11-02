import { papelizTemplateTagPattern } from './papeliz-template-gallery-contract'

// Export › Template's details as the Template Settings keep them, and what still keeps them from
// making a template. Light on purpose: the Export page reads it on every change, while the export
// itself (papeliz-template-export.ts) loads only when someone exports.

export interface PapelizTemplateExportDetails {
  templateExportName: string
  templateExportDescription: string
  // Its main category first, then its subcategory and a label, as tags ("project-workflow").
  templateExportTags: string[]
  // A ticked note; it opens first and always comes, so it is never optional.
  templateExportFirstNotePath: string
  // A license's name as picked or typed: "MIT", "Apache 2.0", or one of the person's own.
  templateExportLicenseText: string
}

// The template's name and description, and its tags, as the gallery's manifest check allows them.
export const papelizTemplateExportNameLongestLength = 80
export const papelizTemplateExportDescriptionLongestLength = 300
export const papelizTemplateExportTagLongestLength = 30
export const papelizTemplateExportMostTagCount = 3

// A tag as typed, made a tag: "Project Workflow" -> "project-workflow", "AI Agents" -> "ai-agents".
export function makePapelizTemplateExportTag(typedTemplateTagText: string): string {
  return typedTemplateTagText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// The tags typed in the Category, Subcategory and Label boxes, made tags, empty boxes left out.
export function listPapelizTemplateExportTags(typedTemplateTagTexts: readonly string[]): string[] {
  return typedTemplateTagTexts
    .slice(0, papelizTemplateExportMostTagCount)
    .map(makePapelizTemplateExportTag)
    .filter((templateTag) => templateTag.length > 0)
}

// The sentence that says what to fill in, or null when the details make a template.
export function findPapelizTemplateExportDetailsProblem(templateExportDetails: {
  templateExportName: string
  templateExportDescription: string
  templateExportTagTexts: readonly string[]
  templateExportFirstNotePath: string | null
  templateExportLicenseText: string
}): string | null {
  const templateExportName = templateExportDetails.templateExportName.trim()
  const templateExportDescription = templateExportDetails.templateExportDescription.trim()
  if (templateExportName.length === 0) return 'Give the template a name in Template Settings.'
  if (templateExportName.length > papelizTemplateExportNameLongestLength) return `The template’s name can be up to ${papelizTemplateExportNameLongestLength} characters.`
  if (templateExportDescription.length === 0) return 'Describe the template in Template Settings.'
  if (templateExportDescription.length > papelizTemplateExportDescriptionLongestLength) {
    return `The template’s description can be up to ${papelizTemplateExportDescriptionLongestLength} characters.`
  }
  if (makePapelizTemplateExportTag(templateExportDetails.templateExportTagTexts[0] ?? '').length === 0) return 'Give the template a category in Template Settings.'
  const templateExportTags = listPapelizTemplateExportTags(templateExportDetails.templateExportTagTexts)
  if (templateExportTags.some((templateTag) => templateTag.length > papelizTemplateExportTagLongestLength || !papelizTemplateTagPattern.test(templateTag))) {
    return `Each tag can be up to ${papelizTemplateExportTagLongestLength} letters and numbers.`
  }
  if (templateExportDetails.templateExportLicenseText.trim().length === 0) return 'Pick or type the template’s license in Template Settings.'
  if (templateExportDetails.templateExportFirstNotePath === null) return 'Tick the notes the template holds.'
  return null
}
