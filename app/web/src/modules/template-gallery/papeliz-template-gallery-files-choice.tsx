import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { describeTemplateGalleryFileCount } from './papeliz-template-gallery-page-parts'

// Which of a template's files come in, on Use Template and Import from Template, for a template with
// optional files: Recommended (none of them), All, or Choose, over the template's folder tree, which
// always shows. Required files and folders are checked and grayed; optional ones can be checked, and
// checking or unchecking one moves the switch to Choose. Recommended and All check the boxes for you.

type PapelizTemplateFilesChoiceSwitchValue = 'recommended' | 'all' | 'chosen'

interface PapelizTemplateFileTreeNode {
  templateFileTreeNodeName: string
  templateFileTreeNodeRelativePath: string
  isTemplateFileTreeNodeFolder: boolean
  templateFileTreeChildNodes: PapelizTemplateFileTreeNode[]
  // Every file in it (itself, for a file).
  templateFileRelativePathsInNode: string[]
}

// The included files as a tree: folders first, then files, each by name.
function buildTemplateFileTree(templateIncludedFileRelativePaths: readonly string[]): PapelizTemplateFileTreeNode[] {
  const templateFileTreeRootNode: PapelizTemplateFileTreeNode = {
    templateFileTreeNodeName: '',
    templateFileTreeNodeRelativePath: '',
    isTemplateFileTreeNodeFolder: true,
    templateFileTreeChildNodes: [],
    templateFileRelativePathsInNode: [],
  }
  for (const templateIncludedFileRelativePath of templateIncludedFileRelativePaths) {
    const templateFilePathParts = templateIncludedFileRelativePath.split('/')
    let templateFileTreeParentNode = templateFileTreeRootNode
    templateFileTreeParentNode.templateFileRelativePathsInNode.push(templateIncludedFileRelativePath)
    templateFilePathParts.forEach((templateFilePathPart, templateFilePathPartIndex) => {
      const isTemplateFilePathPartFolder = templateFilePathPartIndex < templateFilePathParts.length - 1
      const templateFileTreeNodeRelativePath = templateFilePathParts.slice(0, templateFilePathPartIndex + 1).join('/')
      let templateFileTreeChildNode = templateFileTreeParentNode.templateFileTreeChildNodes.find(
        (existingTemplateFileTreeNode) => existingTemplateFileTreeNode.templateFileTreeNodeRelativePath === templateFileTreeNodeRelativePath,
      )
      if (templateFileTreeChildNode === undefined) {
        templateFileTreeChildNode = {
          templateFileTreeNodeName: templateFilePathPart,
          templateFileTreeNodeRelativePath,
          isTemplateFileTreeNodeFolder: isTemplateFilePathPartFolder,
          templateFileTreeChildNodes: [],
          templateFileRelativePathsInNode: [],
        }
        templateFileTreeParentNode.templateFileTreeChildNodes.push(templateFileTreeChildNode)
      }
      templateFileTreeChildNode.templateFileRelativePathsInNode.push(templateIncludedFileRelativePath)
      templateFileTreeParentNode = templateFileTreeChildNode
    })
  }
  const sortTemplateFileTreeNodes = (templateFileTreeNodes: PapelizTemplateFileTreeNode[]) => {
    templateFileTreeNodes.sort(
      (firstTemplateFileTreeNode, secondTemplateFileTreeNode) =>
        Number(secondTemplateFileTreeNode.isTemplateFileTreeNodeFolder) - Number(firstTemplateFileTreeNode.isTemplateFileTreeNodeFolder) ||
        firstTemplateFileTreeNode.templateFileTreeNodeName.localeCompare(secondTemplateFileTreeNode.templateFileTreeNodeName),
    )
    for (const templateFileTreeNode of templateFileTreeNodes) sortTemplateFileTreeNodes(templateFileTreeNode.templateFileTreeChildNodes)
  }
  sortTemplateFileTreeNodes(templateFileTreeRootNode.templateFileTreeChildNodes)
  return templateFileTreeRootNode.templateFileTreeChildNodes
}

// A node's box: required alone (checked and grayed), every optional file in it in, none, or some.
type PapelizTemplateFileTreeNodeCheckState = 'required' | 'checked' | 'unchecked' | 'mixed'

interface PapelizTemplateFileTreeNodeLook {
  templateFileTreeNodeCheckState: PapelizTemplateFileTreeNodeCheckState
  optionalTemplateFileRelativePathsInNode: string[]
  // "32 files", or "1 of 2 files" while some of its optional files stay out.
  templateFileTreeNodeCountText: string
}

function describeTemplateFileTreeNodeLook(
  templateFileRelativePathsInNode: readonly string[],
  optionalTemplateFileRelativePathSet: ReadonlySet<string>,
  chosenTemplateOptionalFileRelativePathSet: ReadonlySet<string>,
): PapelizTemplateFileTreeNodeLook {
  const optionalTemplateFileRelativePathsInNode = templateFileRelativePathsInNode.filter((templateFileRelativePath) => optionalTemplateFileRelativePathSet.has(templateFileRelativePath))
  const chosenOptionalTemplateFileCount = optionalTemplateFileRelativePathsInNode.filter((templateFileRelativePath) => chosenTemplateOptionalFileRelativePathSet.has(templateFileRelativePath)).length
  const requiredTemplateFileCount = templateFileRelativePathsInNode.length - optionalTemplateFileRelativePathsInNode.length
  const incomingTemplateFileCount = requiredTemplateFileCount + chosenOptionalTemplateFileCount
  const templateFileTreeNodeCheckState: PapelizTemplateFileTreeNodeCheckState =
    optionalTemplateFileRelativePathsInNode.length === 0
      ? 'required'
      : chosenOptionalTemplateFileCount === optionalTemplateFileRelativePathsInNode.length
        ? 'checked'
        : incomingTemplateFileCount === 0
          ? 'unchecked'
          : 'mixed'
  return {
    templateFileTreeNodeCheckState,
    optionalTemplateFileRelativePathsInNode,
    templateFileTreeNodeCountText:
      incomingTemplateFileCount === templateFileRelativePathsInNode.length
        ? describeTemplateGalleryFileCount(templateFileRelativePathsInNode.length)
        : `${incomingTemplateFileCount.toLocaleString('en-US')} of ${describeTemplateGalleryFileCount(templateFileRelativePathsInNode.length)}`,
  }
}

interface PapelizTemplateGalleryFilesChoiceProps {
  templateName: string
  templateIncludedFileRelativePaths: readonly string[]
  templateOptionalFileRelativePaths: readonly string[]
  chosenTemplateOptionalFileRelativePaths: readonly string[]
  onChosenTemplateOptionalFilesChange: (chosenTemplateOptionalFileRelativePaths: string[]) => void
}

export function PapelizTemplateGalleryFilesChoice({
  templateName,
  templateIncludedFileRelativePaths,
  templateOptionalFileRelativePaths,
  chosenTemplateOptionalFileRelativePaths,
  onChosenTemplateOptionalFilesChange,
}: PapelizTemplateGalleryFilesChoiceProps) {
  const templateFileTreeNodes = useMemo(() => buildTemplateFileTree(templateIncludedFileRelativePaths), [templateIncludedFileRelativePaths])
  const optionalTemplateFileRelativePathSet = useMemo(() => new Set(templateOptionalFileRelativePaths), [templateOptionalFileRelativePaths])
  const chosenTemplateOptionalFileRelativePathSet = new Set(chosenTemplateOptionalFileRelativePaths)
  // Choose stays picked once a box is touched (or Choose is pressed), even when the boxes happen to
  // match Recommended or All, until Recommended or All is pressed.
  const [isChooseSwitchHeld, setChooseSwitchHeld] = useState(false)
  // Folders holding both required and optional files start open, so what's optional in them shows.
  const [openTemplateFolderRelativePaths, setOpenTemplateFolderRelativePaths] = useState<ReadonlySet<string>>(() => {
    const startOpenTemplateFolderRelativePaths = new Set<string>()
    const findMixedTemplateFolders = (templateFileTreeNodesToSearch: PapelizTemplateFileTreeNode[]) => {
      for (const templateFileTreeNode of templateFileTreeNodesToSearch) {
        if (!templateFileTreeNode.isTemplateFileTreeNodeFolder) continue
        const optionalTemplateFileCountInNode = templateFileTreeNode.templateFileRelativePathsInNode.filter((templateFileRelativePath) =>
          optionalTemplateFileRelativePathSet.has(templateFileRelativePath),
        ).length
        if (optionalTemplateFileCountInNode > 0 && optionalTemplateFileCountInNode < templateFileTreeNode.templateFileRelativePathsInNode.length) {
          startOpenTemplateFolderRelativePaths.add(templateFileTreeNode.templateFileTreeNodeRelativePath)
          findMixedTemplateFolders(templateFileTreeNode.templateFileTreeChildNodes)
        }
      }
    }
    findMixedTemplateFolders(templateFileTreeNodes)
    return startOpenTemplateFolderRelativePaths
  })

  const shownFilesChoiceSwitchValue: PapelizTemplateFilesChoiceSwitchValue = isChooseSwitchHeld
    ? 'chosen'
    : chosenTemplateOptionalFileRelativePaths.length === 0
      ? 'recommended'
      : chosenTemplateOptionalFileRelativePaths.length === templateOptionalFileRelativePaths.length
        ? 'all'
        : 'chosen'
  const requiredTemplateFileCount = templateIncludedFileRelativePaths.length - templateOptionalFileRelativePaths.length
  const incomingTemplateFileCount = requiredTemplateFileCount + chosenTemplateOptionalFileRelativePaths.length

  const changeChosenTemplateOptionalFiles = (changedTemplateOptionalFileRelativePaths: Iterable<string>) => {
    const changedTemplateOptionalFileRelativePathSet = new Set(changedTemplateOptionalFileRelativePaths)
    onChosenTemplateOptionalFilesChange(templateOptionalFileRelativePaths.filter((templateFileRelativePath) => changedTemplateOptionalFileRelativePathSet.has(templateFileRelativePath)))
  }
  // A box: every optional file under it goes in, or, when they all are already, out. The template's own
  // box works as All and Recommended do; any other moves the switch to Choose.
  const toggleTemplateFileTreeNode = (templateFileTreeNodeLook: PapelizTemplateFileTreeNodeLook, isTemplateFileTreeRootRow: boolean) => {
    setChooseSwitchHeld(!isTemplateFileTreeRootRow)
    const changedTemplateOptionalFileRelativePathSet = new Set(chosenTemplateOptionalFileRelativePaths)
    for (const optionalTemplateFileRelativePath of templateFileTreeNodeLook.optionalTemplateFileRelativePathsInNode) {
      if (templateFileTreeNodeLook.templateFileTreeNodeCheckState === 'checked') changedTemplateOptionalFileRelativePathSet.delete(optionalTemplateFileRelativePath)
      else changedTemplateOptionalFileRelativePathSet.add(optionalTemplateFileRelativePath)
    }
    changeChosenTemplateOptionalFiles(changedTemplateOptionalFileRelativePathSet)
  }

  const renderTemplateFileTreeRow = (
    templateFileTreeNodeName: string,
    templateFileRelativePathsInNode: readonly string[],
    templateFileTreeNodeDepth: number,
    templateFolderToggle: { isTemplateFolderOpen: boolean; onTemplateFolderToggle: () => void } | null,
    isTemplateFileTreeRootRow: boolean,
  ) => {
    const templateFileTreeNodeLook = describeTemplateFileTreeNodeLook(templateFileRelativePathsInNode, optionalTemplateFileRelativePathSet, chosenTemplateOptionalFileRelativePathSet)
    const { templateFileTreeNodeCheckState } = templateFileTreeNodeLook
    const isTemplateFileTreeNodeRequired = templateFileTreeNodeCheckState === 'required'
    return (
      <div
        className={joinPapelizClassNames(
          'flex min-h-[30px] items-center gap-1.5 border-t border-papeliz-line pr-2.5 text-[12.5px] first:border-t-0',
          isTemplateFileTreeRootRow && 'bg-papeliz-surface-soft font-semibold',
          isTemplateFileTreeNodeRequired && 'text-papeliz-ink-muted',
        )}
        style={{ paddingLeft: `${8 + templateFileTreeNodeDepth * 18}px` }}
      >
        {templateFolderToggle === null ? (
          <span aria-hidden="true" className="w-4 flex-none" />
        ) : (
          <button
            type="button"
            aria-label={`${templateFolderToggle.isTemplateFolderOpen ? 'Close' : 'Open'} ${templateFileTreeNodeName}`}
            aria-expanded={templateFolderToggle.isTemplateFolderOpen}
            onClick={templateFolderToggle.onTemplateFolderToggle}
            className="grid size-4 flex-none place-items-center rounded text-papeliz-ink-subtle hover:bg-papeliz-hover hover:text-papeliz-ink"
          >
            <ChevronRight className={joinPapelizClassNames('size-3.5 transition-transform', templateFolderToggle.isTemplateFolderOpen && 'rotate-90')} aria-hidden="true" />
          </button>
        )}
        <label className={joinPapelizClassNames('flex min-w-0 flex-1 items-center gap-2', isTemplateFileTreeNodeRequired ? 'cursor-default' : 'cursor-pointer')}>
          <input
            type="checkbox"
            ref={(templateFileTreeNodeCheckbox) => {
              if (templateFileTreeNodeCheckbox !== null) templateFileTreeNodeCheckbox.indeterminate = templateFileTreeNodeCheckState === 'mixed'
            }}
            checked={templateFileTreeNodeCheckState === 'required' || templateFileTreeNodeCheckState === 'checked'}
            disabled={isTemplateFileTreeNodeRequired}
            onChange={() => toggleTemplateFileTreeNode(templateFileTreeNodeLook, isTemplateFileTreeRootRow)}
            className="size-[15px] flex-none accent-papeliz-blue disabled:opacity-60"
          />
          <span className={joinPapelizClassNames('min-w-0 truncate', !isTemplateFileTreeRootRow && 'font-mono text-[11.5px]')} dir="ltr">
            {templateFileTreeNodeName}
          </span>
        </label>
        {(templateFolderToggle !== null || isTemplateFileTreeRootRow) && (
          <span className="flex-none text-[11.5px] font-normal whitespace-nowrap text-papeliz-ink-subtle tabular-nums">{templateFileTreeNodeLook.templateFileTreeNodeCountText}</span>
        )}
      </div>
    )
  }

  const renderTemplateFileTreeNodes = (templateFileTreeNodesToRender: PapelizTemplateFileTreeNode[], templateFileTreeNodeDepth: number) =>
    templateFileTreeNodesToRender.map((templateFileTreeNode) => {
      const isTemplateFolderOpen = openTemplateFolderRelativePaths.has(templateFileTreeNode.templateFileTreeNodeRelativePath)
      return (
        <div key={templateFileTreeNode.templateFileTreeNodeRelativePath} role="presentation">
          {renderTemplateFileTreeRow(
            templateFileTreeNode.templateFileTreeNodeName,
            templateFileTreeNode.templateFileRelativePathsInNode,
            templateFileTreeNodeDepth,
            templateFileTreeNode.isTemplateFileTreeNodeFolder
              ? {
                  isTemplateFolderOpen,
                  onTemplateFolderToggle: () =>
                    setOpenTemplateFolderRelativePaths((previousOpenTemplateFolderRelativePaths) => {
                      const changedOpenTemplateFolderRelativePaths = new Set(previousOpenTemplateFolderRelativePaths)
                      if (isTemplateFolderOpen) changedOpenTemplateFolderRelativePaths.delete(templateFileTreeNode.templateFileTreeNodeRelativePath)
                      else changedOpenTemplateFolderRelativePaths.add(templateFileTreeNode.templateFileTreeNodeRelativePath)
                      return changedOpenTemplateFolderRelativePaths
                    }),
                }
              : null,
            false,
          )}
          {templateFileTreeNode.isTemplateFileTreeNodeFolder && isTemplateFolderOpen && renderTemplateFileTreeNodes(templateFileTreeNode.templateFileTreeChildNodes, templateFileTreeNodeDepth + 1)}
        </div>
      )
    })

  return (
    <div className="flex flex-col gap-2">
      <PapelizSlidingChoiceGroup<PapelizTemplateFilesChoiceSwitchValue>
        slidingChoiceGroupLabel="Files to bring"
        slidingChoiceGroupRole="radiogroup"
        slidingChoiceGroupTone="solid-blue"
        slidingChoices={[
          { slidingChoiceValue: 'recommended', slidingChoiceContent: `Recommended · ${requiredTemplateFileCount.toLocaleString('en-US')}` },
          { slidingChoiceValue: 'all', slidingChoiceContent: `All · ${templateIncludedFileRelativePaths.length.toLocaleString('en-US')}` },
          { slidingChoiceValue: 'chosen', slidingChoiceContent: shownFilesChoiceSwitchValue === 'chosen' ? `Choose · ${incomingTemplateFileCount.toLocaleString('en-US')}` : 'Choose' },
        ]}
        chosenSlidingChoiceValue={shownFilesChoiceSwitchValue}
        onSlidingChoiceSelect={(selectedFilesChoiceSwitchValue) => {
          setChooseSwitchHeld(selectedFilesChoiceSwitchValue === 'chosen')
          if (selectedFilesChoiceSwitchValue === 'recommended') changeChosenTemplateOptionalFiles([])
          if (selectedFilesChoiceSwitchValue === 'all') changeChosenTemplateOptionalFiles(templateOptionalFileRelativePaths)
        }}
      />
      <div role="group" aria-label={`${templateName}’s files`} className="max-h-[260px] overflow-y-auto rounded-[10px] border border-papeliz-line bg-papeliz-surface">
        {renderTemplateFileTreeRow(templateName, templateIncludedFileRelativePaths, 0, null, true)}
        {renderTemplateFileTreeNodes(templateFileTreeNodes, 0)}
      </div>
    </div>
  )
}
