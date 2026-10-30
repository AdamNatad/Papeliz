import type { Element as HastElement } from 'hast'

// The lucide icons MD View draws beside callout titles and property chips, as plain SVG shapes, so
// an exported page carries them with no script. The shapes are lucide's own (ISC license); the
// test beside this file checks them against lucide-react, so they stay the icons MD View shows.

export type PapelizHtmlExportIconName =
  | 'Info'
  | 'BookOpen'
  | 'Lightbulb'
  | 'CircleAlert'
  | 'CircleCheck'
  | 'ListChecks'
  | 'CircleHelp'
  | 'TriangleAlert'
  | 'OctagonAlert'
  | 'Flame'
  | 'List'
  | 'Quote'
  | 'Hash'
  | 'Link'
  | 'Calendar'
  | 'Tag'

type PapelizHtmlExportIconShape = readonly [svgShapeTagName: string, svgShapeAttributes: Readonly<Record<string, string>>]

export const papelizHtmlExportIconShapesByName: Readonly<Record<PapelizHtmlExportIconName, readonly PapelizHtmlExportIconShape[]>> = {
  Info: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
  BookOpen: [
    ['path', { d: 'M12 5v16' }],
    ['path', { d: 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z' }],
  ],
  Lightbulb: [
    ['path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' }],
    ['path', { d: 'M9 18h6' }],
    ['path', { d: 'M10 22h4' }],
  ],
  CircleAlert: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['line', { x1: '12', x2: '12', y1: '8', y2: '12' }],
    ['line', { x1: '12', x2: '12.01', y1: '16', y2: '16' }],
  ],
  CircleCheck: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'm16 9-5.5 5.5L8 12' }]],
  ListChecks: [['path', { d: 'M13 5h8' }], ['path', { d: 'M13 12h8' }], ['path', { d: 'M13 19h8' }], ['path', { d: 'm3 17 2 2 4-4' }], ['path', { d: 'm3 7 2 2 4-4' }]],
  CircleHelp: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }], ['path', { d: 'M12 17h.01' }]],
  TriangleAlert: [
    ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }],
    ['path', { d: 'M12 9v4' }],
    ['path', { d: 'M12 17h.01' }],
  ],
  OctagonAlert: [
    ['path', { d: 'M12 16h.01' }],
    ['path', { d: 'M12 8v4' }],
    [
      'path',
      {
        d: 'M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z',
      },
    ],
  ],
  Flame: [['path', { d: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4' }]],
  List: [['path', { d: 'M3 5h.01' }], ['path', { d: 'M3 12h.01' }], ['path', { d: 'M3 19h.01' }], ['path', { d: 'M8 5h13' }], ['path', { d: 'M8 12h13' }], ['path', { d: 'M8 19h13' }]],
  Quote: [
    ['path', { d: 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z' }],
    ['path', { d: 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z' }],
  ],
  Hash: [
    ['line', { x1: '4', x2: '20', y1: '9', y2: '9' }],
    ['line', { x1: '4', x2: '20', y1: '15', y2: '15' }],
    ['line', { x1: '10', x2: '8', y1: '3', y2: '21' }],
    ['line', { x1: '16', x2: '14', y1: '3', y2: '21' }],
  ],
  Link: [
    ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
    ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
  ],
  Calendar: [['path', { d: 'M8 2v3' }], ['path', { d: 'M16 2v3' }], ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }], ['path', { d: 'M3 9h18' }]],
  Tag: [
    ['path', { d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z' }],
    ['circle', { cx: '7.5', cy: '7.5', r: '.5', fill: 'currentColor' }],
  ],
}

// The icon as an `<svg>` element, drawn at `iconSizePixels` (MD View: 16 for callouts, 14 for chips).
export function createPapelizHtmlExportIconHastElement(iconName: PapelizHtmlExportIconName, iconSizePixels: number): HastElement {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      xmlns: 'http://www.w3.org/2000/svg',
      width: String(iconSizePixels),
      height: String(iconSizePixels),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: ['papeliz-html-export-icon'],
      ariaHidden: 'true',
    },
    children: papelizHtmlExportIconShapesByName[iconName].map(([svgShapeTagName, svgShapeAttributes]) => ({
      type: 'element',
      tagName: svgShapeTagName,
      properties: { ...svgShapeAttributes },
      children: [],
    })),
  }
}
