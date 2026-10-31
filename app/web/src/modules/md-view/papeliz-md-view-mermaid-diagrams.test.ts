import { describe, expect, it } from 'vitest'
import { removeEventHandlerAttributesFromMermaidDiagramSource } from './papeliz-md-view-mermaid-diagrams'

describe('taking event handlers out of a diagram source before Mermaid reads it', () => {
  it('takes out a handler in each way it can be quoted', () => {
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('B["<b>bold?</b> <img src=x onerror=alert(1)>"]')).toBe('B["<b>bold?</b> <img src=x >"]')
    expect(removeEventHandlerAttributesFromMermaidDiagramSource(`A["<svg onload='alert(1)'>"]`)).toBe('A["<svg >"]')
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A[<a href="#" onclick="go()">x</a>]')).toBe('A[<a href="#" >x</a>]')
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A["<img src=x onerror=#quot;alert(1); go()#quot;>"]')).toBe('A["<img src=x >"]')
  })

  it('takes out every handler in a tag, in any case, after a slash or a closing quote', () => {
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A["<IMG SRC=x ONERROR=alert(1) onLoad = go()>"]')).toBe('A["<IMG SRC=x  >"]')
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A["<img/onerror=alert(1)>"]')).toBe('A["<img/>"]')
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A["<img src=\'x\'onerror=alert(1)>"]')).toBe('A["<img src=\'x\'>"]')
  })

  it('keeps a quoted value whole, even with a handler-like word or a > in it', () => {
    expect(removeEventHandlerAttributesFromMermaidDiagramSource('A[<a title="say onclick=hi > there" href="#">x</a>]')).toBe('A[<a title="say onclick=hi > there" href="#">x</a>]')
  })

  it('leaves alone what is not a handler inside a tag', () => {
    const untouchedMermaidSources = [
      'flowchart LR\n  A[Start] --> B{Is it?} -->|Yes| C[OK]\n  A <--> D',
      'flowchart LR\n  A["Set onerror=handler in the config"] --> B',
      'classDiagram\n  class Shape{\n    <<interface>>\n    +Map<String, onlyOne> parts\n  }',
      'flowchart LR\n  A["<span style=\'color:red\'>red</span><br/>next"] --> B',
      'sequenceDiagram\n  Alice->>Bob: x < y and onload=1',
    ]
    for (const untouchedMermaidSource of untouchedMermaidSources) {
      expect(removeEventHandlerAttributesFromMermaidDiagramSource(untouchedMermaidSource)).toBe(untouchedMermaidSource)
    }
  })
})
