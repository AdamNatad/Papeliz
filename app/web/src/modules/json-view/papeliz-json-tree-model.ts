import { jsonLanguage } from '@codemirror/lang-json'
import { findPapelizJsonParseProblem, removePapelizJsonByteOrderMark, type PapelizJsonParseProblem } from './papeliz-json-parse-problem'

// A node of the JSON grammar's syntax tree.
type PapelizJsonSyntaxNode = ReturnType<typeof jsonLanguage.parser.parse>['topNode']

// A JSON file as a read-only tree, for showing a file without editing it (a template's files before
// Use Template): each value built from the file's own text, so keys keep the file's order and
// numbers and strings read exactly as written (a long number isn't rounded, a string keeps its
// escapes). In a vault, JSON opens in MD Code only.

export type PapelizJsonTreeValueKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export interface PapelizJsonTreeNode {
  // The keys and indexes down to this value, as one string: stable while the file changes elsewhere,
  // so a branch opened stays open.
  jsonTreeNodePathKey: string
  // The property's name (its escapes read), the item's index, or null for the file's top value.
  jsonTreeNodeLabel: string | null
  jsonTreeNodeLabelKind: 'property' | 'array-index' | 'top-value'
  jsonTreeValueKind: PapelizJsonTreeValueKind
  // A string, number, true, false or null as written; empty for an object or array.
  jsonTreeValueSourceText: string
  jsonTreeChildNodes: PapelizJsonTreeNode[]
}

export type PapelizJsonTreeBuildResult =
  | { jsonTreeBuildOutcome: 'built'; jsonTreeTopNode: PapelizJsonTreeNode }
  | { jsonTreeBuildOutcome: 'parse-problem'; jsonParseProblem: PapelizJsonParseProblem }

const papelizJsonTreeValueKindsBySyntaxName: Record<string, PapelizJsonTreeValueKind> = {
  Object: 'object',
  Array: 'array',
  String: 'string',
  Number: 'number',
  True: 'boolean',
  False: 'boolean',
  Null: 'null',
}

export function buildPapelizJsonTree(jsonFileText: string): PapelizJsonTreeBuildResult {
  const jsonParseProblem = findPapelizJsonParseProblem(jsonFileText)
  if (jsonParseProblem !== null) return { jsonTreeBuildOutcome: 'parse-problem', jsonParseProblem }
  const jsonText = removePapelizJsonByteOrderMark(jsonFileText)
  const jsonTopValueSyntaxNode = findJsonValueSyntaxNodes(jsonLanguage.parser.parse(jsonText).topNode)[0]
  // JSON.parse took it, so the grammar finds its one value.
  if (jsonTopValueSyntaxNode === undefined) return { jsonTreeBuildOutcome: 'parse-problem', jsonParseProblem: { jsonParseProblemOffset: 0, jsonParseProblemLineNumber: 1, jsonParseProblemColumnNumber: 1 } }
  return { jsonTreeBuildOutcome: 'built', jsonTreeTopNode: buildJsonTreeNode(jsonText, jsonTopValueSyntaxNode, null, 'top-value', []) }
}

function findJsonValueSyntaxNodes(parentSyntaxNode: PapelizJsonSyntaxNode): PapelizJsonSyntaxNode[] {
  const jsonValueSyntaxNodes: PapelizJsonSyntaxNode[] = []
  for (let childSyntaxNode = parentSyntaxNode.firstChild; childSyntaxNode !== null; childSyntaxNode = childSyntaxNode.nextSibling) {
    if (papelizJsonTreeValueKindsBySyntaxName[childSyntaxNode.name] !== undefined) jsonValueSyntaxNodes.push(childSyntaxNode)
  }
  return jsonValueSyntaxNodes
}

function buildJsonTreeNode(
  jsonText: string,
  jsonValueSyntaxNode: PapelizJsonSyntaxNode,
  jsonTreeNodeLabel: string | null,
  jsonTreeNodeLabelKind: PapelizJsonTreeNode['jsonTreeNodeLabelKind'],
  parentJsonTreePath: readonly (string | number)[],
): PapelizJsonTreeNode {
  const jsonTreePath = jsonTreeNodeLabelKind === 'top-value' ? parentJsonTreePath : [...parentJsonTreePath, jsonTreeNodeLabelKind === 'array-index' ? Number(jsonTreeNodeLabel) : (jsonTreeNodeLabel ?? '')]
  const jsonTreeValueKind = papelizJsonTreeValueKindsBySyntaxName[jsonValueSyntaxNode.name] ?? 'null'
  const jsonTreeChildNodes: PapelizJsonTreeNode[] = []
  if (jsonTreeValueKind === 'object') {
    for (let propertySyntaxNode = jsonValueSyntaxNode.firstChild; propertySyntaxNode !== null; propertySyntaxNode = propertySyntaxNode.nextSibling) {
      if (propertySyntaxNode.name !== 'Property') continue
      const propertyNameSyntaxNode = propertySyntaxNode.getChild('PropertyName')
      const propertyValueSyntaxNode = findJsonValueSyntaxNodes(propertySyntaxNode)[0]
      if (propertyNameSyntaxNode === null || propertyValueSyntaxNode === undefined) continue
      const propertyName = JSON.parse(jsonText.slice(propertyNameSyntaxNode.from, propertyNameSyntaxNode.to)) as string
      jsonTreeChildNodes.push(buildJsonTreeNode(jsonText, propertyValueSyntaxNode, propertyName, 'property', jsonTreePath))
    }
  } else if (jsonTreeValueKind === 'array') {
    findJsonValueSyntaxNodes(jsonValueSyntaxNode).forEach((itemSyntaxNode, itemIndex) =>
      jsonTreeChildNodes.push(buildJsonTreeNode(jsonText, itemSyntaxNode, String(itemIndex), 'array-index', jsonTreePath)),
    )
  }
  return {
    jsonTreeNodePathKey: JSON.stringify(jsonTreePath),
    jsonTreeNodeLabel,
    jsonTreeNodeLabelKind,
    jsonTreeValueKind,
    jsonTreeValueSourceText: jsonTreeValueKind === 'object' || jsonTreeValueKind === 'array' ? '' : jsonText.slice(jsonValueSyntaxNode.from, jsonValueSyntaxNode.to),
    jsonTreeChildNodes,
  }
}

// What a closed object or array says about itself: "3 keys", "1 item", "empty".
export function describePapelizJsonTreeBranchSize(jsonTreeNode: PapelizJsonTreeNode): string {
  const jsonTreeChildCount = jsonTreeNode.jsonTreeChildNodes.length
  if (jsonTreeChildCount === 0) return 'empty'
  if (jsonTreeNode.jsonTreeValueKind === 'object') return `${jsonTreeChildCount} ${jsonTreeChildCount === 1 ? 'key' : 'keys'}`
  return `${jsonTreeChildCount} ${jsonTreeChildCount === 1 ? 'item' : 'items'}`
}
