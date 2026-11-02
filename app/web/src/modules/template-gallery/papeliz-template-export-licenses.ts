import { papelizTemplateCustomLicenseId } from './papeliz-template-gallery-contract'

// The well-known licenses: Template Settings offers them, each with a sentence on what it lets others
// do, for its tooltip, and the gallery names a template's license with them. A person can also type a
// license of their own. Only MIT's text comes in an exported .zip; for any other, the person adds its
// LICENSE file.

export interface PapelizTemplateExportLicensePreset {
  // The SPDX id, as GitHub and the license files name it.
  templateLicenseSpdxId: string
  templateLicenseDisplayName: string
  templateLicenseSummary: string
}

export const papelizTemplateExportLicensePresets: readonly PapelizTemplateExportLicensePreset[] = [
  { templateLicenseSpdxId: 'MIT', templateLicenseDisplayName: 'MIT', templateLicenseSummary: 'Anyone may use, change and share it, even in paid work, if they keep your copyright notice.' },
  {
    templateLicenseSpdxId: 'Apache-2.0',
    templateLicenseDisplayName: 'Apache 2.0',
    templateLicenseSummary: 'Like MIT, and it also grants your patent rights; changed files must say they were changed.',
  },
  { templateLicenseSpdxId: 'BSD-2-Clause', templateLicenseDisplayName: 'BSD 2-Clause', templateLicenseSummary: 'Anyone may use, change and share it if they keep your copyright notice.' },
  {
    templateLicenseSpdxId: 'BSD-3-Clause',
    templateLicenseDisplayName: 'BSD 3-Clause',
    templateLicenseSummary: 'Like BSD 2-Clause, and no one may use your name to promote their version without asking.',
  },
  { templateLicenseSpdxId: 'ISC', templateLicenseDisplayName: 'ISC', templateLicenseSummary: 'A short license like MIT: use, change and share it, keeping your notice.' },
  {
    templateLicenseSpdxId: 'GPL-3.0',
    templateLicenseDisplayName: 'GNU GPL 3.0',
    templateLicenseSummary: 'Anyone may use and change it, but changed copies they share must stay GPL, with their source.',
  },
  {
    templateLicenseSpdxId: 'LGPL-3.0',
    templateLicenseDisplayName: 'GNU LGPL 3.0',
    templateLicenseSummary: 'Changes to it stay LGPL, but other works may use it under their own license.',
  },
  {
    templateLicenseSpdxId: 'AGPL-3.0',
    templateLicenseDisplayName: 'GNU AGPL 3.0',
    templateLicenseSummary: 'Like GPL, and it also applies when a changed copy is offered to people over a network.',
  },
  {
    templateLicenseSpdxId: 'MPL-2.0',
    templateLicenseDisplayName: 'Mozilla Public License 2.0',
    templateLicenseSummary: 'Changes to its own files are shared under MPL; it may sit inside larger works under other licenses.',
  },
  { templateLicenseSpdxId: 'Unlicense', templateLicenseDisplayName: 'The Unlicense', templateLicenseSummary: 'Gives it to the public domain: anyone may do anything with it.' },
  {
    templateLicenseSpdxId: 'CC0-1.0',
    templateLicenseDisplayName: 'CC0 1.0',
    templateLicenseSummary: 'Gives it to the public domain: anyone may use it for anything, with no credit needed.',
  },
  { templateLicenseSpdxId: 'CC-BY-4.0', templateLicenseDisplayName: 'CC BY 4.0', templateLicenseSummary: 'Anyone may use, change and share it, even commercially, if they credit you.' },
  {
    templateLicenseSpdxId: 'CC-BY-SA-4.0',
    templateLicenseDisplayName: 'CC BY-SA 4.0',
    templateLicenseSummary: 'Like CC BY, and changed copies must be shared under the same license.',
  },
  { templateLicenseSpdxId: 'CC-BY-NC-4.0', templateLicenseDisplayName: 'CC BY-NC 4.0', templateLicenseSummary: 'Anyone may use, change and share it if they credit you, but not for money.' },
  {
    templateLicenseSpdxId: 'CC-BY-NC-SA-4.0',
    templateLicenseDisplayName: 'CC BY-NC-SA 4.0',
    templateLicenseSummary: 'Credit you, not for money, and share changed copies under the same license.',
  },
  { templateLicenseSpdxId: 'CC-BY-ND-4.0', templateLicenseDisplayName: 'CC BY-ND 4.0', templateLicenseSummary: 'Anyone may share it, even commercially, if they credit you and change nothing.' },
]

// The preset a typed license names, by its name or its SPDX id, whatever the case; none for a license
// of the person's own.
export function findPapelizTemplateExportLicensePreset(typedTemplateLicenseText: string): PapelizTemplateExportLicensePreset | undefined {
  const lowerCaseLicenseText = typedTemplateLicenseText.trim().toLowerCase()
  return papelizTemplateExportLicensePresets.find(
    (licensePreset) => licensePreset.templateLicenseDisplayName.toLowerCase() === lowerCaseLicenseText || licensePreset.templateLicenseSpdxId.toLowerCase() === lowerCaseLicenseText,
  )
}

// The presets a typed text matches anywhere in the name or id; all of them for an empty box.
export function filterPapelizTemplateExportLicensePresets(typedTemplateLicenseText: string): PapelizTemplateExportLicensePreset[] {
  const lowerCaseLicenseText = typedTemplateLicenseText.trim().toLowerCase()
  if (lowerCaseLicenseText.length === 0 || findPapelizTemplateExportLicensePreset(typedTemplateLicenseText) !== undefined) return [...papelizTemplateExportLicensePresets]
  return papelizTemplateExportLicensePresets.filter(
    (licensePreset) => licensePreset.templateLicenseDisplayName.toLowerCase().includes(lowerCaseLicenseText) || licensePreset.templateLicenseSpdxId.toLowerCase().includes(lowerCaseLicenseText),
  )
}

// A license's name as the gallery shows it: "MIT", "Apache 2.0", "Custom License" for an author's
// own, and the id itself for one this list doesn't know.
export function describePapelizTemplateLicenseName(templateLicenseId: string): string {
  if (templateLicenseId === papelizTemplateCustomLicenseId) return 'Custom License'
  return papelizTemplateExportLicensePresets.find((licensePreset) => licensePreset.templateLicenseSpdxId === templateLicenseId)?.templateLicenseDisplayName ?? templateLicenseId
}
