import { describe, expect, it } from 'vitest'
import { filterPapelizTemplateExportLicensePresets, findPapelizTemplateExportLicensePreset, papelizTemplateExportLicensePresets } from './papeliz-template-export-licenses'

describe('the licenses Template Settings offers', () => {
  it('has many, each with its SPDX id and a sentence for its tooltip', () => {
    expect(papelizTemplateExportLicensePresets.length).toBeGreaterThanOrEqual(15)
    expect(new Set(papelizTemplateExportLicensePresets.map((licensePreset) => licensePreset.templateLicenseSpdxId)).size).toBe(papelizTemplateExportLicensePresets.length)
    for (const licensePreset of papelizTemplateExportLicensePresets) expect(licensePreset.templateLicenseSummary).toMatch(/\.$/)
  })

  it('finds a license by its name or its id, whatever the case, and none for a license of one’s own', () => {
    expect(findPapelizTemplateExportLicensePreset('apache 2.0')?.templateLicenseSpdxId).toBe('Apache-2.0')
    expect(findPapelizTemplateExportLicensePreset(' cc-by-sa-4.0 ')?.templateLicenseDisplayName).toBe('CC BY-SA 4.0')
    expect(findPapelizTemplateExportLicensePreset('My Garden License')).toBeUndefined()
  })

  it('narrows the list to what is typed, and shows them all once one is picked', () => {
    expect(filterPapelizTemplateExportLicensePresets('gpl').map((licensePreset) => licensePreset.templateLicenseSpdxId)).toEqual(['GPL-3.0', 'LGPL-3.0', 'AGPL-3.0'])
    expect(filterPapelizTemplateExportLicensePresets('MIT')).toHaveLength(papelizTemplateExportLicensePresets.length)
    expect(filterPapelizTemplateExportLicensePresets('')).toHaveLength(papelizTemplateExportLicensePresets.length)
  })
})
