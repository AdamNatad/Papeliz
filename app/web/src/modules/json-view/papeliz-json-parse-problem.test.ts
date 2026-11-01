import { describe, expect, it } from 'vitest'
import { findJsonGrammarProblemOffset, findPapelizJsonParseProblem } from './papeliz-json-parse-problem'

describe('where a JSON file stops parsing', () => {
  it('finds nothing wrong with valid JSON, a byte order mark at the start included', () => {
    expect(findPapelizJsonParseProblem('{"hooks": {"Stop": []}, "count": 2}')).toBeNull()
    expect(findPapelizJsonParseProblem('﻿[1, 2, 3]')).toBeNull()
  })

  it('gives the line and column where reading stops', () => {
    expect(findPapelizJsonParseProblem('{\n  "theme": "dark",\n}\n')).toMatchObject({ jsonParseProblemLineNumber: 3, jsonParseProblemColumnNumber: 1 })
    expect(findPapelizJsonParseProblem('{\n  "theme" "dark"\n}')).toMatchObject({ jsonParseProblemLineNumber: 2, jsonParseProblemColumnNumber: 11 })
    expect(findPapelizJsonParseProblem('{"a": 1')).toMatchObject({ jsonParseProblemLineNumber: 1 })
    expect(findPapelizJsonParseProblem('')).toMatchObject({ jsonParseProblemOffset: 0, jsonParseProblemLineNumber: 1, jsonParseProblemColumnNumber: 1 })
    // A comment isn't JSON.
    expect(findPapelizJsonParseProblem('{\n  // the theme\n  "theme": "dark"\n}')).toMatchObject({ jsonParseProblemLineNumber: 2, jsonParseProblemColumnNumber: 3 })
  })

  it('finds the place with the JSON grammar when the browser’s message names none', () => {
    expect(findJsonGrammarProblemOffset('{"a": 1}')).toBeNull()
    expect(findJsonGrammarProblemOffset('{"a": 1,}')).toBe(8)
    expect(findJsonGrammarProblemOffset('[1, 2')).toBe(5)
  })
})
