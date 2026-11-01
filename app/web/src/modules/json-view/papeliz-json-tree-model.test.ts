import { describe, expect, it } from 'vitest'
import { buildPapelizJsonTree, describePapelizJsonTreeBranchSize, type PapelizJsonTreeNode } from './papeliz-json-tree-model'

function buildBuiltJsonTree(jsonFileText: string): PapelizJsonTreeNode {
  const jsonTreeBuildResult = buildPapelizJsonTree(jsonFileText)
  if (jsonTreeBuildResult.jsonTreeBuildOutcome !== 'built') throw new Error('The JSON did not parse')
  return jsonTreeBuildResult.jsonTreeTopNode
}

// Each node as "label: kind value", indented by depth.
function describeJsonTree(jsonTreeNode: PapelizJsonTreeNode, jsonTreeDepth = 0): string[] {
  const jsonTreeNodeLine = `${'  '.repeat(jsonTreeDepth)}${jsonTreeNode.jsonTreeNodeLabel ?? '(top)'}: ${jsonTreeNode.jsonTreeValueKind}${jsonTreeNode.jsonTreeValueSourceText === '' ? '' : ` ${jsonTreeNode.jsonTreeValueSourceText}`}`
  return [jsonTreeNodeLine, ...jsonTreeNode.jsonTreeChildNodes.flatMap((jsonTreeChildNode) => describeJsonTree(jsonTreeChildNode, jsonTreeDepth + 1))]
}

describe('the JSON tree', () => {
  it('shows every value with its key or index and its kind, in the file’s order and as written', () => {
    const jsonTreeTopNode = buildBuiltJsonTree(
      '{\n  "name": "P1-Workflow",\n  "2": "a number-like key stays where it is",\n  "hooks": { "Stop": [ { "command": "echo \\"done\\"" } ] },\n  "id": 12345678901234567890,\n  "ratio": 1.50,\n  "on": true,\n  "off": false,\n  "none": null,\n  "list": []\n}',
    )
    expect(describeJsonTree(jsonTreeTopNode)).toEqual([
      '(top): object',
      '  name: string "P1-Workflow"',
      '  2: string "a number-like key stays where it is"',
      '  hooks: object',
      '    Stop: array',
      '      0: object',
      '        command: string "echo \\"done\\""',
      '  id: number 12345678901234567890',
      '  ratio: number 1.50',
      '  on: boolean true',
      '  off: boolean false',
      '  none: null null',
      '  list: array',
    ])
    expect(jsonTreeTopNode.jsonTreeChildNodes.map((jsonTreeChildNode) => jsonTreeChildNode.jsonTreeNodeLabelKind)).toContain('property')
    // hooks › Stop › 0
    expect(jsonTreeTopNode.jsonTreeChildNodes[2]?.jsonTreeChildNodes[0]?.jsonTreeChildNodes[0]?.jsonTreeNodeLabelKind).toBe('array-index')
  })

  it('reads escapes in a key, and keys each branch by its path', () => {
    const jsonTreeTopNode = buildBuiltJsonTree('{"tab\\tkey": {"inner": [10, 20]}}')
    const tabKeyNode = jsonTreeTopNode.jsonTreeChildNodes[0]
    expect(tabKeyNode?.jsonTreeNodeLabel).toBe('tab\tkey')
    expect(tabKeyNode?.jsonTreeChildNodes[0]?.jsonTreeChildNodes[1]?.jsonTreeNodePathKey).toBe(JSON.stringify(['tab\tkey', 'inner', 1]))
    expect(jsonTreeTopNode.jsonTreeNodePathKey).toBe('[]')
  })

  it('says how big a closed branch is', () => {
    const jsonTreeTopNode = buildBuiltJsonTree('{"one": {"a": 1}, "many": [1, 2, 3], "nothing": {}}')
    expect(jsonTreeTopNode.jsonTreeChildNodes.map(describePapelizJsonTreeBranchSize)).toEqual(['1 key', '3 items', 'empty'])
    expect(describePapelizJsonTreeBranchSize(jsonTreeTopNode)).toBe('3 keys')
  })

  it('gives where it stops instead of a tree when the file doesn’t parse', () => {
    expect(buildPapelizJsonTree('{\n  "a": 1,\n  "b": \n}')).toEqual({
      jsonTreeBuildOutcome: 'parse-problem',
      jsonParseProblem: expect.objectContaining({ jsonParseProblemLineNumber: 4, jsonParseProblemColumnNumber: 1 }),
    })
  })
})
