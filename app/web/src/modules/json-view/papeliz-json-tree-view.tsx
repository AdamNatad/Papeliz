import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { papelizJsonPropertyNameColor, papelizJsonValueKindColors } from './papeliz-json-code-presentation'
import { describePapelizJsonTreeBranchSize, type PapelizJsonTreeNode } from './papeliz-json-tree-model'

// The JSON tree (papeliz-json-tree-model.ts): read-only, each object and array a branch that folds
// open, keys in blue and values colored by type as in MD Code. The top value starts open; a small
// file opens two levels.

// A tree with at most this many values opens its first two levels at once.
const papelizJsonTreeSmallTreeValueCount = 80

function countJsonTreeValues(jsonTreeNode: PapelizJsonTreeNode): number {
  return jsonTreeNode.jsonTreeChildNodes.reduce((jsonTreeValueCount, jsonTreeChildNode) => jsonTreeValueCount + countJsonTreeValues(jsonTreeChildNode), 1)
}

function listJsonTreeBranchPathKeysToDepth(jsonTreeNode: PapelizJsonTreeNode, openedDepth: number): string[] {
  if (jsonTreeNode.jsonTreeChildNodes.length === 0 || openedDepth < 0) return []
  return [jsonTreeNode.jsonTreeNodePathKey, ...jsonTreeNode.jsonTreeChildNodes.flatMap((jsonTreeChildNode) => listJsonTreeBranchPathKeysToDepth(jsonTreeChildNode, openedDepth - 1))]
}

export function PapelizJsonTreeView({ jsonTreeTopNode }: { jsonTreeTopNode: PapelizJsonTreeNode }) {
  const [openedJsonTreeBranchPathKeys, setOpenedJsonTreeBranchPathKeys] = useState<ReadonlySet<string>>(
    () => new Set(listJsonTreeBranchPathKeysToDepth(jsonTreeTopNode, countJsonTreeValues(jsonTreeTopNode) <= papelizJsonTreeSmallTreeValueCount ? 1 : 0)),
  )
  const toggleJsonTreeBranch = (jsonTreeNodePathKey: string) =>
    setOpenedJsonTreeBranchPathKeys((openedPathKeys) => {
      const nextOpenedPathKeys = new Set(openedPathKeys)
      if (nextOpenedPathKeys.has(jsonTreeNodePathKey)) nextOpenedPathKeys.delete(jsonTreeNodePathKey)
      else nextOpenedPathKeys.add(jsonTreeNodePathKey)
      return nextOpenedPathKeys
    })

  return (
    <div role="group" aria-label="JSON tree" className="font-mono text-[calc(var(--papeliz-note-font-size)-3px)] leading-[1.8] [font-variant-ligatures:none]">
      <ul>
        <PapelizJsonTreeRow
          jsonTreeNode={jsonTreeTopNode}
          openedJsonTreeBranchPathKeys={openedJsonTreeBranchPathKeys}
          onJsonTreeBranchToggle={toggleJsonTreeBranch}
        />
      </ul>
    </div>
  )
}

interface PapelizJsonTreeRowProps {
  jsonTreeNode: PapelizJsonTreeNode
  openedJsonTreeBranchPathKeys: ReadonlySet<string>
  onJsonTreeBranchToggle: (jsonTreeNodePathKey: string) => void
}

function PapelizJsonTreeRow({ jsonTreeNode, openedJsonTreeBranchPathKeys, onJsonTreeBranchToggle }: PapelizJsonTreeRowProps) {
  const isJsonTreeBranch = jsonTreeNode.jsonTreeValueKind === 'object' || jsonTreeNode.jsonTreeValueKind === 'array'
  const canJsonTreeBranchOpen = isJsonTreeBranch && jsonTreeNode.jsonTreeChildNodes.length > 0
  const isJsonTreeBranchOpen = canJsonTreeBranchOpen && openedJsonTreeBranchPathKeys.has(jsonTreeNode.jsonTreeNodePathKey)
  const jsonTreeRowLabel =
    jsonTreeNode.jsonTreeNodeLabel === null ? null : (
      <span
        className={jsonTreeNode.jsonTreeNodeLabelKind === 'array-index' ? 'text-papeliz-ink-subtle' : undefined}
        style={jsonTreeNode.jsonTreeNodeLabelKind === 'property' ? { color: papelizJsonPropertyNameColor } : undefined}
      >
        {jsonTreeNode.jsonTreeNodeLabel}
        <span className="text-papeliz-ink-subtle">:</span>
      </span>
    )
  const jsonTreeRowValue = isJsonTreeBranch ? (
    <span className="text-papeliz-ink-subtle">
      {jsonTreeNode.jsonTreeValueKind === 'object' ? '{' : '['}
      <span className="px-1 font-sans text-[12px]">{describePapelizJsonTreeBranchSize(jsonTreeNode)}</span>
      {jsonTreeNode.jsonTreeValueKind === 'object' ? '}' : ']'}
    </span>
  ) : (
    <span
      className={joinPapelizClassNames('break-all', jsonTreeNode.jsonTreeValueKind === 'null' && 'italic')}
      style={{ color: papelizJsonValueKindColors[jsonTreeNode.jsonTreeValueKind] }}
    >
      {jsonTreeNode.jsonTreeValueSourceText}
    </span>
  )

  return (
    <li>
      {canJsonTreeBranchOpen ? (
        <button
          type="button"
          aria-expanded={isJsonTreeBranchOpen}
          onClick={() => onJsonTreeBranchToggle(jsonTreeNode.jsonTreeNodePathKey)}
          className="-ml-1 flex max-w-full items-baseline gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-papeliz-hover"
        >
          <ChevronRight
            className={joinPapelizClassNames(
              'size-[13px] flex-none self-center text-papeliz-ink-subtle transition-transform duration-200 ease-[var(--ease-papeliz-out)]',
              isJsonTreeBranchOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
          {jsonTreeRowLabel}
          {jsonTreeRowValue}
        </button>
      ) : (
        // A value lines up with its branch siblings' names, past the room their arrows take.
        <div className="flex max-w-full items-baseline gap-1.5 pl-[19px]">
          {jsonTreeRowLabel}
          {jsonTreeRowValue}
        </div>
      )}
      {isJsonTreeBranchOpen && (
        <ul className="ml-[6px] border-l border-papeliz-line pl-3">
          {jsonTreeNode.jsonTreeChildNodes.map((jsonTreeChildNode) => (
            <PapelizJsonTreeRow
              key={jsonTreeChildNode.jsonTreeNodePathKey}
              jsonTreeNode={jsonTreeChildNode}
              openedJsonTreeBranchPathKeys={openedJsonTreeBranchPathKeys}
              onJsonTreeBranchToggle={onJsonTreeBranchToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
