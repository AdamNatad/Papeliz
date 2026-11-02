import { describe, expect, it } from 'vitest'
import {
  formatPapelizTemplateTagDisplayName,
  isPapelizTemplateCategoryTag,
  papelizTemplateCategoryTags,
  papelizTemplateGalleryTagDisplayNames,
} from './papeliz-template-gallery-contract'

describe('template categories and tag names', () => {
  it('has three categories', () => {
    expect(papelizTemplateCategoryTags).toEqual(['coding', 'education', 'research'])
    expect(papelizTemplateCategoryTags.map(formatPapelizTemplateTagDisplayName)).toEqual(['Coding', 'Education', 'Research'])
    expect(isPapelizTemplateCategoryTag('coding')).toBe(true)
    expect(isPapelizTemplateCategoryTag('journal')).toBe(false)
    expect(isPapelizTemplateCategoryTag('Coding')).toBe(false)
  })

  it('shows every word with a capital first letter, hyphens as spaces, and short forms in capitals', () => {
    expect(formatPapelizTemplateTagDisplayName('project-workflow')).toBe('Project Workflow')
    expect(formatPapelizTemplateTagDisplayName('ai-agents')).toBe('AI Agents')
    expect(formatPapelizTemplateTagDisplayName('rest-api-design')).toBe('Rest API Design')
    expect(formatPapelizTemplateTagDisplayName('ui-ux')).toBe('UI UX')
    expect(formatPapelizTemplateTagDisplayName('sql-css-html-json-cli-sdk')).toBe('SQL CSS HTML JSON CLI SDK')
    expect(formatPapelizTemplateTagDisplayName('notes-2026')).toBe('Notes 2026')
    // Only whole words: "aim" and "build" keep their letters.
    expect(formatPapelizTemplateTagDisplayName('aim-build')).toBe('Aim Build')
    expect(formatPapelizTemplateTagDisplayName('research')).toBe('Research')
  })

  it('keeps the earlier tag-name export working for any tag, listing only the categories', () => {
    expect(papelizTemplateGalleryTagDisplayNames['ai-agents']).toBe('AI Agents')
    expect(papelizTemplateGalleryTagDisplayNames['language-learning']).toBe('Language Learning')
    expect(Object.hasOwn(papelizTemplateGalleryTagDisplayNames, 'garden-notes')).toBe(true)
    expect('coding' in papelizTemplateGalleryTagDisplayNames).toBe(true)
    // Not a tag's shape: not in it, as before.
    expect(papelizTemplateGalleryTagDisplayNames['Not A Tag']).toBeUndefined()
    expect(Object.hasOwn(papelizTemplateGalleryTagDisplayNames, 'toString')).toBe(false)
    expect(Object.keys(papelizTemplateGalleryTagDisplayNames)).toEqual(['coding', 'education', 'research'])
    expect(Object.entries(papelizTemplateGalleryTagDisplayNames)).toEqual([
      ['coding', 'Coding'],
      ['education', 'Education'],
      ['research', 'Research'],
    ])
  })
})
