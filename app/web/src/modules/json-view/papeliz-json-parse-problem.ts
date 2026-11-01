import { jsonLanguage } from '@codemirror/lang-json'

// Where a JSON file stops parsing, for MD Code's mark and the JSON tree's error. The browser's own
// `JSON.parse` decides whether it parses; where it stops comes from the browser's message when it
// names a place (Chrome, Edge and Firefox mostly do), otherwise from Papeliz's JSON grammar.
export interface PapelizJsonParseProblem {
  // Characters from the start of the text, where reading stops.
  jsonParseProblemOffset: number
  // Both count from 1, as an editor shows them.
  jsonParseProblemLineNumber: number
  jsonParseProblemColumnNumber: number
}

// A byte order mark at the very start is allowed and skipped (some Windows tools write one).
export function removePapelizJsonByteOrderMark(jsonText: string): string {
  return jsonText.startsWith('﻿') ? jsonText.slice(1) : jsonText
}

export function findPapelizJsonParseProblem(jsonText: string): PapelizJsonParseProblem | null {
  const byteOrderMarkLength = jsonText.length - removePapelizJsonByteOrderMark(jsonText).length
  let jsonParseErrorMessage: string
  try {
    JSON.parse(jsonText.slice(byteOrderMarkLength))
    return null
  } catch (jsonParseError) {
    jsonParseErrorMessage = jsonParseError instanceof Error ? jsonParseError.message : ''
  }
  const jsonParseProblemOffset =
    readJsonParseErrorMessageOffset(jsonText.slice(byteOrderMarkLength), jsonParseErrorMessage) ??
    findJsonGrammarProblemOffset(jsonText.slice(byteOrderMarkLength)) ??
    jsonText.length - byteOrderMarkLength
  return describeJsonTextPlace(jsonText, Math.min(jsonText.length, jsonParseProblemOffset + byteOrderMarkLength))
}

// "… in JSON at position 42" (Chrome, Edge, Node) or "… at line 3 column 5 of the JSON data" (Firefox).
function readJsonParseErrorMessageOffset(jsonText: string, jsonParseErrorMessage: string): number | null {
  const positionMatch = /at position (\d+)/.exec(jsonParseErrorMessage)
  if (positionMatch !== null) return Number(positionMatch[1])
  const lineAndColumnMatch = /at line (\d+) column (\d+)/.exec(jsonParseErrorMessage)
  if (lineAndColumnMatch === null) return null
  const jsonTextLines = jsonText.split('\n')
  const problemLineIndex = Number(lineAndColumnMatch[1]) - 1
  if (problemLineIndex < 0 || problemLineIndex >= jsonTextLines.length) return null
  const problemLineStartOffset = jsonTextLines.slice(0, problemLineIndex).reduce((lineStartOffset, jsonTextLine) => lineStartOffset + jsonTextLine.length + 1, 0)
  return problemLineStartOffset + Math.max(0, Number(lineAndColumnMatch[2]) - 1)
}

// The first place the JSON grammar couldn't read, or null when it read everything.
export function findJsonGrammarProblemOffset(jsonText: string): number | null {
  let jsonGrammarProblemOffset: number | null = null
  jsonLanguage.parser.parse(jsonText).iterate({
    enter: (jsonSyntaxNode) => {
      if (jsonGrammarProblemOffset !== null) return false
      if (jsonSyntaxNode.type.isError) jsonGrammarProblemOffset = jsonSyntaxNode.from
      return undefined
    },
  })
  return jsonGrammarProblemOffset
}

function describeJsonTextPlace(jsonText: string, jsonTextOffset: number): PapelizJsonParseProblem {
  const textBeforeProblem = jsonText.slice(0, jsonTextOffset)
  const lastLineBreakIndex = textBeforeProblem.lastIndexOf('\n')
  return {
    jsonParseProblemOffset: jsonTextOffset,
    jsonParseProblemLineNumber: textBeforeProblem.split('\n').length,
    jsonParseProblemColumnNumber: jsonTextOffset - lastLineBreakIndex,
  }
}
