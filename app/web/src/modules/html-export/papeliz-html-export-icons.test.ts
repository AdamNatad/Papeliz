import { toHtml } from 'hast-util-to-html'
import { BookOpen, Calendar, CircleAlert, CircleCheck, CircleHelp, Flame, Hash, Info, Lightbulb, Link, List, ListChecks, OctagonAlert, Quote, Tag, TriangleAlert, type LucideIcon } from 'lucide-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createPapelizHtmlExportIconHastElement, papelizHtmlExportIconShapesByName, type PapelizHtmlExportIconName } from './papeliz-html-export-icons'

const lucideIconsByExportIconName: Record<PapelizHtmlExportIconName, LucideIcon> = {
  Info,
  BookOpen,
  Lightbulb,
  CircleAlert,
  CircleCheck,
  ListChecks,
  CircleHelp,
  TriangleAlert,
  OctagonAlert,
  Flame,
  List,
  Quote,
  Hash,
  Link,
  Calendar,
  Tag,
}

function readSvgInnerMarkup(svgMarkup: string): string {
  return svgMarkup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
}

describe('the exported icons', () => {
  it('draw the same shapes as the lucide-react icons MD View shows', () => {
    for (const exportIconName of Object.keys(papelizHtmlExportIconShapesByName) as PapelizHtmlExportIconName[]) {
      const lucideIconMarkup = renderToStaticMarkup(createElement(lucideIconsByExportIconName[exportIconName]))
      const exportIconMarkup = toHtml(createPapelizHtmlExportIconHastElement(exportIconName, 24))
      expect(readSvgInnerMarkup(exportIconMarkup), exportIconName).toBe(readSvgInnerMarkup(lucideIconMarkup))
    }
  })

  it('draw at the asked size with lucide’s stroke, hidden from screen readers', () => {
    const exportIconMarkup = toHtml(createPapelizHtmlExportIconHastElement('Info', 16))
    expect(exportIconMarkup).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="16" height="16" viewBox="0 0 24 24"/)
    expect(exportIconMarkup).toContain('stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')
    expect(exportIconMarkup).toContain('aria-hidden="true"')
  })
})
