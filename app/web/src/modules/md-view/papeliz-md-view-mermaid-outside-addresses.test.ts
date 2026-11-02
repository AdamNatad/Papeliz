import { describe, expect, it } from 'vitest'
import {
  findCssFileLoadingWord,
  findOutsideAddressInMermaidDiagramSettings,
  findOutsideAddressInParsedMermaidDiagram,
  neutralizeCssFileLoadingWords,
  papelizMermaidPlaceholderPictureAddress,
  removeOutsideAddressesFromMermaidDiagramSource,
} from './papeliz-md-view-mermaid-outside-addresses'

const placeholderPictureValue = `"${papelizMermaidPlaceholderPictureAddress}"`
const wordJoiner = '\u2060'

describe('the placeholder picture an image shape shows instead', () => {
  it('is a picture Papeliz carries itself, with a size Mermaid can read', () => {
    expect(papelizMermaidPlaceholderPictureAddress.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const placeholderPictureSvgText = atob(papelizMermaidPlaceholderPictureAddress.slice('data:image/svg+xml;base64,'.length))
    expect(placeholderPictureSvgText).toMatch(/^<svg [^>]*width="96" height="72"/)
    expect(placeholderPictureSvgText).not.toMatch(/href|url\(|<image/)
  })
})

describe('an image shape’s picture, in the source', () => {
  it('becomes the placeholder for a web, protocol-relative, data: or vault address', () => {
    const pictureAddresses = [
      '"https://evil.example/cat.png"',
      "'http://evil.example/cat.png'",
      '//evil.example/cat.png',
      '"data:image/png;base64,iVBORw0KGgo="',
      'attachments/cat.png',
      '"HTTPS://evil.example/cat.png?size=2"',
    ]
    for (const pictureAddress of pictureAddresses) {
      const guardedSource = removeOutsideAddressesFromMermaidDiagramSource(`flowchart LR\n  A@{ img: ${pictureAddress}, label: "Cat", pos: "t", h: 60, constraint: "on" } --> B`)
      expect(guardedSource).toBe(`flowchart LR\n  A@{ img: ${placeholderPictureValue}, label: "Cat", pos: "t", h: 60, constraint: "on" } --> B`)
    }
  })

  it('reads the key however YAML writes it: quoted, tagged, anchored, last, or with no space', () => {
    const guardedSources = [
      'A@{ "img": "https://evil.example/a.png" }',
      "A@{ 'img': https://evil.example/a.png }",
      'A@{ label: x, img: !!str https://evil.example/a.png }',
      'A@{ img: &picture https://evil.example/a.png, label: x }',
      'A@{ label: x, !!str img: https://evil.example/a.png }',
      'A@{ &pictureKey img: https://evil.example/a.png }',
      'A@{ label: Cat, img:https://evil.example/a.png}',
      'A@{ img: [https://evil.example/a.png, https://evil.example/b.png] }',
      'A@{ img: {address: https://evil.example/a.png} }',
    ].map((shapeSource) => removeOutsideAddressesFromMermaidDiagramSource(`flowchart TB\n  ${shapeSource}`))
    for (const guardedSource of guardedSources) {
      expect(guardedSource).not.toContain('evil.example')
      expect(guardedSource).toContain(placeholderPictureValue)
    }
  })

  it('reads a block over several lines, a value on the next line, an explicit key and an empty value', () => {
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{\n    label: Cat\n    img: https://evil.example/a,b.png\n    w: 80\n  }')).toBe(
      `flowchart TB\n  A@{\n    label: Cat\n    img: ${placeholderPictureValue}\n    w: 80\n  }`,
    )
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{\n    img:\n      https://evil.example/a.png\n    w: 80\n  }')).toBe(
      `flowchart TB\n  A@{\n    img:\n      ${placeholderPictureValue}\n    w: 80\n  }`,
    )
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{\n    ? img\n    : https://evil.example/a.png\n  }')).not.toContain('evil.example')
    // An empty value gets the placeholder, and the key after it keeps its own value.
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{\n    img:\n    label: Cat\n  }')).toBe(`flowchart TB\n  A@{\n    img: ${placeholderPictureValue}\n    label: Cat\n  }`)
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{ img: , label: Cat }')).toBe(`flowchart TB\n  A@{ img: ${placeholderPictureValue}, label: Cat }`)
  })

  it('renames a quoted key written with escapes, which YAML could read as img', () => {
    const guardedSource = removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{ label: Cat, "\\x69mg": "https://evil.example/a.png", "\\u0069mg": "https://evil.example/b.png" }')
    expect(guardedSource).toBe('flowchart TB\n  A@{ label: Cat, "papelizEscapedShapeDataKey1": "https://evil.example/a.png", "papelizEscapedShapeDataKey2": "https://evil.example/b.png" }')
  })

  it('leaves alone a label that says img:, a word with an apostrophe, and every other block', () => {
    const untouchedSources = [
      'flowchart TB\n  A@{ shape: rect, label: "Docker img: alpine" }',
      "flowchart TB\n  A@{ shape: rect, label: 'img: inside quotes' }",
      'flowchart TB\n  A@{ shape: doc, label: "Packing slip" } --> B@{ icon: "fa:user", form: "circle", label: "User", pos: "b" }',
      'flowchart TB\n  e1@{ animate: true }\n  A e1@--> B',
      'kanban\n  todo[To do]\n    t1[Write the draft]@{ ticket: 42, assigned: "Ana", priority: "High" }',
    ]
    for (const untouchedSource of untouchedSources) expect(removeOutsideAddressesFromMermaidDiagramSource(untouchedSource)).toBe(untouchedSource)
    expect(removeOutsideAddressesFromMermaidDiagramSource("flowchart TB\n  A@{ label: don't stop, img: https://evil.example/a.png }")).toBe(
      `flowchart TB\n  A@{ label: don't stop, img: ${placeholderPictureValue} }`,
    )
  })

  it('gives the same source when rewritten again', () => {
    const guardedSource = removeOutsideAddressesFromMermaidDiagramSource('flowchart TB\n  A@{ img: "https://evil.example/a.png", label: "Cat" }')
    expect(removeOutsideAddressesFromMermaidDiagramSource(guardedSource)).toBe(guardedSource)
  })
})

describe('a sequence actor’s icon, in the source', () => {
  it('is taken out of the actor’s properties, which keep the rest', () => {
    expect(removeOutsideAddressesFromMermaidDiagramSource('sequenceDiagram\n  participant A\n  properties A: {"class": "internal", "icon": "https://evil.example/a.png"}\n  A->>A: hi')).toBe(
      'sequenceDiagram\n  participant A\n  properties A: {"class":"internal"}\n  A->>A: hi',
    )
    expect(removeOutsideAddressesFromMermaidDiagramSource('sequenceDiagram\n  properties A: {"\\u0069con": "//evil.example/a.png", "type": "x"}')).toBe('sequenceDiagram\n  properties A: {"type":"x"}')
  })

  it('takes the whole line out when only the icon is left, when it isn’t JSON, and for details', () => {
    expect(removeOutsideAddressesFromMermaidDiagramSource('sequenceDiagram\n  properties A: {"icon": "https://evil.example/a.png"}')).toBe('sequenceDiagram\n%% properties A: {"icon": "https://evil.example/a.png"}')
    expect(removeOutsideAddressesFromMermaidDiagramSource('sequenceDiagram\n  properties A: {&quot;icon&quot;: "https://evil.example/a.png"}')).toBe('sequenceDiagram\n%% properties A: {&quot;icon&quot;: "https://evil.example/a.png"}')
    expect(removeOutsideAddressesFromMermaidDiagramSource('sequenceDiagram\n  details A: actorDetails\n  A->>A: hi')).toBe('sequenceDiagram\n%% details A: actorDetails\n  A->>A: hi')
  })

  it('leaves properties without an icon, links, and other diagram types alone', () => {
    const untouchedSources = [
      'sequenceDiagram\n  participant A\n  properties A: {"class": "internal"}\n  link A: Docs @ https://example.com/docs\n  links A: {"Repo": "https://example.com/repo"}',
      'flowchart LR\n  details --> properties',
      '---\ntitle: Steps\n---\nflowchart LR\n  properties: x --> details',
    ]
    for (const untouchedSource of untouchedSources) expect(removeOutsideAddressesFromMermaidDiagramSource(untouchedSource)).toBe(untouchedSource)
  })
})

describe('CSS that loads a file, in the source', () => {
  it('is neutralized in style, classDef and linkStyle statements, with the rest of the statement kept', () => {
    expect(removeOutsideAddressesFromMermaidDiagramSource('flowchart LR\n  A --> B\n  style A fill:#fff,background:url(https://evil.example/a.png)')).toBe(
      `flowchart LR\n  A --> B\n  style A fill:#fff,background:url (https://evil.example/a.png)`,
    )
    const guardedSource = removeOutsideAddressesFromMermaidDiagramSource(
      "flowchart LR\n  classDef pictured background-image:url('//evil.example/a.png'),color:#111\n  linkStyle 0 stroke:URL(data:image/svg+xml;base64,AA)\n  A-->B; style B cursor:url(https://evil.example/c.cur)",
    )
    expect(findCssFileLoadingWord(guardedSource)).toBeNull()
    expect(guardedSource).toContain('color:#111')
  })

  it('catches every way CSS can write the word', () => {
    const cssLoadingTexts = [
      'url(https://evil.example/a.png)',
      'URL( "https://evil.example/a.png" )',
      'u\\72l(https://evil.example/a.png)',
      '\\75rl(https://evil.example/a.png)',
      '\\000075 rl(https://evil.example/a.png)',
      '\\55 \\52 \\4c (https://evil.example/a.png)',
      'image-set("https://evil.example/a.png" 1x)',
      '-webkit-image-set("https://evil.example/a.png" 1x)',
      'image\\-set("https://evil.example/a.png" 1x)',
      'image("https://evil.example/a.png")',
      'src("https://evil.example/a.png")',
      '@import "https://evil.example/a.css";',
      '@\\69mport url(https://evil.example/a.css);',
    ]
    for (const cssLoadingText of cssLoadingTexts) {
      expect(findCssFileLoadingWord(cssLoadingText), cssLoadingText).not.toBeNull()
      expect(findCssFileLoadingWord(neutralizeCssFileLoadingWords(cssLoadingText)), cssLoadingText).toBeNull()
    }
  })

  it('is neutralized by parting a function from its bracket, and @import with an unseen joiner', () => {
    expect(neutralizeCssFileLoadingWords('a { background: url(https://evil.example/a.png), image-set("b.png" 1x) }')).toBe('a { background: url (https://evil.example/a.png), image-set ("b.png" 1x) }')
    expect(neutralizeCssFileLoadingWords('@import "https://evil.example/a.css"; b { color: red }')).toBe(`@${wordJoiner}import "https://evil.example/a.css"; b { color: red }`)
  })

  it('keeps a link to a part of the same drawing, and text that only looks like CSS', () => {
    for (const cssText of ['fill: url(#gradient)', 'marker-end: url( "#arrowhead" )', "mask: url('#fade')", 'color: red', 'font-family: Imagery, sans-serif']) {
      expect(findCssFileLoadingWord(cssText), cssText).toBeNull()
      expect(neutralizeCssFileLoadingWords(cssText)).toBe(cssText)
    }
  })

  it('is neutralized in the diagram’s settings: frontmatter and init lines', () => {
    const guardedSource = removeOutsideAddressesFromMermaidDiagramSource(
      '---\nconfig:\n  themeCSS: "@import \'https://evil.example/a.css\'; .node rect { fill: url(#g) }"\n---\n%%{init: {"themeCSS": ".label { background: url(https://evil.example/b.png) }", "fontFamily": "x; background: image-set(\\"https://evil.example/c.png\\" 1x)"}}%%\nflowchart LR\n  A --> B',
    )
    expect(findCssFileLoadingWord(guardedSource)).toBeNull()
    expect(guardedSource).toContain('url(#g)')
  })

  it('leaves a node named url, src or image, with round sides, as it is', () => {
    const untouchedSource = 'flowchart LR\n  url(Web address) --> src(Source folder) --> image(Picture)\n  style url fill:#eaf2fe; src --> image-set(Several)'
    expect(removeOutsideAddressesFromMermaidDiagramSource(untouchedSource)).toBe(untouchedSource)
  })
})

describe('a label’s style attribute, in the source', () => {
  it('goes when it loads a file or holds an escape that could spell one', () => {
    const guardedSources = [
      'flowchart LR\n  A["<span style=\'background:url(https://evil.example/a.png)\'>x</span>"]',
      'flowchart LR\n  A["<span style="background:&#117;rl(https://evil.example/a.png)">x</span>"]',
      'flowchart LR\n  A["<span title=\'t\' STYLE=#quot;background:#117;rl(https://evil.example/a.png)#quot;>x</span>"]',
      'flowchart LR\n  A["<b style=background:u\\72l(https://evil.example/a.png)>x</b>"]',
    ].map(removeOutsideAddressesFromMermaidDiagramSource)
    expect(guardedSources).toEqual([
      'flowchart LR\n  A["<span >x</span>"]',
      'flowchart LR\n  A["<span >x</span>"]',
      "flowchart LR\n  A[\"<span title='t' >x</span>\"]",
      'flowchart LR\n  A["<b >x</b>"]',
    ])
  })

  it('stays when it only sets colors and type', () => {
    const untouchedSource = 'flowchart LR\n  A["<span style=\'color:red; font-weight:bold\'>red</span><br/>next"] --> B["<i>style=url(x) as text</i>"]'
    expect(removeOutsideAddressesFromMermaidDiagramSource(untouchedSource)).toBe(untouchedSource)
  })
})

// Ordinary diagrams of each kind, with the features that come near the rewrite (shape data, styles,
// classes, links, settings): none of them changes.
const ordinaryMermaidDiagramSources = [
  '---\ntitle: Order pipeline\nconfig:\n  theme: forest\n---\nflowchart LR\n  start([Start]) --> cart[Cart]\n  cart -->|checkout| pay{Paid?}\n  doc@{ shape: doc, label: "Packing slip" } --> pay\n  md["`**Bold** and _italic_`"] --> start\n  classDef decision fill:#fde68a,stroke:#b45309,color:#111\n  class pay decision\n  style cart fill:#eaf2fe,stroke:#0064d4\n  linkStyle 0 stroke:#0064d4,stroke-width:2px\n  click cart "https://example.com/cart" "Open the cart"',
  '%%{init: {"theme": "dark", "themeVariables": {"primaryColor": "#ff0000"}}}%%\nsequenceDiagram\n  autonumber\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello, see https://example.com\n  Note over A,B: url(x) in a note\n  links A: {"Docs": "https://example.com/docs"}',
  'classDiagram\n  class Shape{\n    <<interface>>\n    +Map<String, int> parts\n    +draw() void\n  }\n  Shape <|-- Circle\n  style Circle fill:#f9f,stroke:#333',
  'stateDiagram-v2\n  [*] --> Still\n  Still --> Moving: push\n  classDef moving fill:#e2f5e7,color:#17663a\n  class Moving moving',
  'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE-ITEM : contains\n  style CUSTOMER fill:#fff5c7',
  'gantt\n  title A plan\n  dateFormat YYYY-MM-DD\n  section Draft\n  Write :a1, 2026-01-01, 3d\n  click a1 href "https://example.com/a1"',
  'pie title Pets\n  "Dogs" : 40\n  "Cats" : 35',
  'mindmap\n  root((Papeliz))\n    Notes\n      ::icon(fa fa-book)\n    Diagrams',
  'C4Context\n  Person(customerA, "Customer A", "A customer")\n  System(systemA, "System A")\n  Rel(customerA, systemA, "Uses")\n  UpdateElementStyle(customerA, $fontColor="red", $bgColor="grey", $borderColor="red")',
  'architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service server(server)[Server] in api\n  db:L -- R:server',
  'quadrantChart\n  title Reach\n  quadrant-1 Expand\n  Campaign A: [0.3, 0.6] radius: 12, color: #ff3300',
]

describe('ordinary diagrams', () => {
  it('come back exactly as they were', () => {
    for (const ordinaryMermaidDiagramSource of ordinaryMermaidDiagramSources) {
      expect(removeOutsideAddressesFromMermaidDiagramSource(ordinaryMermaidDiagramSource)).toBe(ordinaryMermaidDiagramSource)
    }
  })
})

describe('what Mermaid parsed, before it draws', () => {
  it('finds a picture other than the placeholder, whatever its form', () => {
    const parsedFlowchart = (pictureValue: unknown) => ({ vertices: new Map([['A', { id: 'A', img: pictureValue, styles: [] }]]), edges: [], classes: new Map() })
    expect(findOutsideAddressInParsedMermaidDiagram(parsedFlowchart('https://evil.example/a.png'))).toBe('https://evil.example/a.png')
    expect(findOutsideAddressInParsedMermaidDiagram(parsedFlowchart(['//evil.example/a.png']))).toBe('//evil.example/a.png')
    expect(findOutsideAddressInParsedMermaidDiagram(parsedFlowchart(papelizMermaidPlaceholderPictureAddress))).toBeNull()
    expect(findOutsideAddressInParsedMermaidDiagram(parsedFlowchart(undefined))).toBeNull()
  })

  it('finds an actor icon that is an address, and passes an icon’s name', () => {
    const parsedSequence = (actorIcon: string) => ({ state: { records: { actors: new Map([['A', { name: 'A', properties: { class: 'x', icon: actorIcon } }]]) } } })
    expect(findOutsideAddressInParsedMermaidDiagram(parsedSequence('https://evil.example/a.png'))).toBe('https://evil.example/a.png')
    expect(findOutsideAddressInParsedMermaidDiagram(parsedSequence('@embedded'))).toBe('@embedded')
    for (const iconName of ['fa:fa-user', 'logos:aws', 'fa fa-book', 'mdi mdi-skull-outline']) expect(findOutsideAddressInParsedMermaidDiagram(parsedSequence(iconName))).toBeNull()
  })

  it('finds CSS that loads a file in a style or color, and not in a label', () => {
    expect(findOutsideAddressInParsedMermaidDiagram({ classes: new Map([['pictured', { id: 'pictured', styles: ['background:url(https://evil.example/a.png)'] }]]) })).toBe('url(')
    expect(findOutsideAddressInParsedMermaidDiagram({ points: [{ text: 'A', color: 'image-set("https://evil.example/a.png" 1x)' }] })).toBe('image-set(')
    expect(findOutsideAddressInParsedMermaidDiagram({ vertices: new Map([['A', { text: 'background: url(https://example.com) in a label', styles: ['fill:url(#g)'] }]]) })).toBeNull()
  })

  it('reads a node named img as a node, and walks a value that refers to itself once', () => {
    const selfReferringDb: Record<string, unknown> = { vertices: new Map([['img', { id: 'img', styles: ['fill:#fff'] }]]) }
    selfReferringDb['self'] = selfReferringDb
    expect(findOutsideAddressInParsedMermaidDiagram(selfReferringDb)).toBeNull()
  })

  it('finds CSS that loads a file in the diagram’s own settings, as YAML or JSON escapes give it', () => {
    expect(findOutsideAddressInMermaidDiagramSettings({ themeCSS: '.label { background: url(https://evil.example/a.png) }' })).toBe('url(')
    expect(findOutsideAddressInMermaidDiagramSettings({ themeVariables: { fontFamily: 'x; background: \\75rl(https://evil.example/a.png)' } })).not.toBeNull()
    expect(findOutsideAddressInMermaidDiagramSettings({ flowchart: { curve: 'basis' }, themeCSS: `.node rect { fill: url(#g) } .x { background: url (https://evil.example/a.png) }` })).toBeNull()
  })
})
