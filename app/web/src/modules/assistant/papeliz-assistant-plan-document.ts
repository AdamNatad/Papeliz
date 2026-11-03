import { getPapelizWikilinkDisplayText, parsePapelizWikilinkInnerText } from '../links/papeliz-wikilink-targets'

// A plan the assistant writes in Plan mode, as the card shows it and as its note keeps it. The model
// is asked for this shape (papeliz-assistant-conversation-store.ts), and the plan note in `Plans/` is
// written in it too, so a plan read back from either gives the same steps:
//
//   # Weekly review for Project Hub
//
//   Goal: each Friday afternoon, one note gathers the week’s open tasks and decisions.
//
//   Assumed: Friday afternoon · open tasks and decisions · a Reviews folder
//
//   - [ ] Create [[Weekly Review Template]] with sections for wins, open tasks and decisions.
//   - [x] Add a Reviews section to [[Project Hub]] that lists every review.
//
// `Assumed:` is there only when the questions were skipped with Just Plan It. A ticked step (`- [x]`)
// is one already done, which Build skips. Numbered steps ("1. …") are read too, as plans were written
// before the checklist. The plan note adds two frontmatter lines that tie it to its chat:
//
//   ---
//   papeliz-plan: in-progress
//   papeliz-plan-chat: 2026-11-03 2340 Plan a weekly review
//   ---
//
// `papeliz-plan` is `done` once every step is ticked; `papeliz-plan-chat` is the saved chat's name in
// `.csessions`, empty until the chat is first saved.

export const papelizAssistantPlansFolderName = 'Plans'

// A step's place in the plan and the build. `ticked` is a step the user marked done before building,
// `done` one the build finished; Build skips both. `skipped` is one Skip Step passed over (or whose
// changes were all rejected): left unticked, so the plan still has it to do.
export type PapelizAssistantPlanStepStatus = 'to-do' | 'ticked' | 'running' | 'needs-review' | 'done' | 'failed' | 'stopped' | 'skipped'

// The build as a whole: not built yet, building (a step running, waiting for review, or failed and
// waiting for Retry Step or Skip Step), stopped (Continue starts the stopped step again), or done.
export type PapelizAssistantPlanBuildPhase = 'draft' | 'building' | 'stopped' | 'done'

export interface PapelizAssistantPlanStep {
  planStepId: string
  // One line of Markdown, naming its notes as [[wikilinks]].
  planStepWords: string
  planStepStatus: PapelizAssistantPlanStepStatus
  // Why the step failed, in words to show under it.
  planStepProblem: string | null
  // The proposals the step's latest run made; the step is answered once each is decided.
  planStepProposalIds: string[]
}

export interface PapelizAssistantPlanDocument {
  planTitle: string
  planGoalText: string
  // The guesses made when the questions were skipped, joined with " · ".
  planAssumedText: string | null
  planSteps: PapelizAssistantPlanStep[]
  planBuildPhase: PapelizAssistantPlanBuildPhase
}

export interface PapelizAssistantPlanNote {
  planDocument: PapelizAssistantPlanDocument
  isPlanNoteDone: boolean
  // The saved chat's name in `.csessions` (without `.md`), when the note names one.
  planNoteChatSessionName: string | null
}

const papelizAssistantPlanStepStatuses: readonly PapelizAssistantPlanStepStatus[] = ['to-do', 'ticked', 'running', 'needs-review', 'done', 'failed', 'stopped', 'skipped']
const papelizAssistantPlanBuildPhases: readonly PapelizAssistantPlanBuildPhase[] = ['draft', 'building', 'stopped', 'done']

export function isPapelizAssistantPlanStepStatus(candidateStatus: string): candidateStatus is PapelizAssistantPlanStepStatus {
  return (papelizAssistantPlanStepStatuses as readonly string[]).includes(candidateStatus)
}

export function isPapelizAssistantPlanBuildPhase(candidatePhase: string): candidatePhase is PapelizAssistantPlanBuildPhase {
  return (papelizAssistantPlanBuildPhases as readonly string[]).includes(candidatePhase)
}

const papelizPlanNoteFrontmatterKey = 'papeliz-plan'
const papelizPlanNoteChatFrontmatterKey = 'papeliz-plan-chat'
const papelizPlanTitleLinePattern = /^#\s+(.+?)(?:\s+#+)?$/
// "- [ ] words" or "- [x] words" (any bullet), or "1. words" / "1) words".
const papelizPlanChecklistStepLinePattern = /^[-*+]\s+\[([ xX])\]\s+(.+)$/
const papelizPlanNumberedStepLinePattern = /^\d+[.)]\s+(.+)$/
// "Goal: …", "**Goal:** …" or "Goal · …"; the same for Assumed.
const papelizPlanGoalLinePattern = /^(?:\*\*|__)?Goal(?:\*\*|__)?\s*[:·]\s*(?:\*\*|__)?\s*(.*)$/i
const papelizPlanAssumedLinePattern = /^(?:\*\*|__)?Assumed(?:\*\*|__)?\s*[:·]\s*(?:\*\*|__)?\s*(.*)$/i
const papelizPlanIndentedLinePattern = /^(?: {2,}|\t)/
const papelizPlanListItemMarkerPattern = /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/

export function createPapelizAssistantPlanStep(planStepWords: string, planStepStatus: PapelizAssistantPlanStepStatus = 'to-do'): PapelizAssistantPlanStep {
  return { planStepId: `papeliz-plan-step-${crypto.randomUUID()}`, planStepWords, planStepStatus, planStepProblem: null, planStepProposalIds: [] }
}

function toOneLine(planText: string): string {
  return planText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// The plan in a reply or a note's body, or null when there is none: it needs a `# ` title and at least
// one step under it. Text before the title is left out (an answer may say a word first), and so is text
// after the steps that isn't a step. A step's indented lines join its words. The steps keep the style
// of the first one, so a numbered aside under a checklist isn't read as a step.
function readPlanMarkdown(planMarkdownText: string, tickedStepStatus: PapelizAssistantPlanStepStatus): Omit<PapelizAssistantPlanDocument, 'planBuildPhase'> | null {
  const planMarkdownLines = planMarkdownText.replace(/\r\n/g, '\n').split('\n')
  const planTitleLineIndex = planMarkdownLines.findIndex((planMarkdownLine) => papelizPlanTitleLinePattern.test(planMarkdownLine.trim()))
  if (planTitleLineIndex === -1) return null
  const planTitle = toOneLine((papelizPlanTitleLinePattern.exec(planMarkdownLines[planTitleLineIndex]?.trim() ?? '')?.[1] ?? '').replace(/^(\*\*|__)(.+)\1$/, '$2'))
  let explicitGoalText: string | null = null
  let firstParagraphText: string | null = null
  let planAssumedText: string | null = null
  const planSteps: PapelizAssistantPlanStep[] = []
  let planStepLineStyle: 'checklist' | 'numbered' | null = null
  for (const planMarkdownLine of planMarkdownLines.slice(planTitleLineIndex + 1)) {
    const trimmedPlanLine = planMarkdownLine.trim()
    if (trimmedPlanLine.length === 0) continue
    const isIndentedLine = papelizPlanIndentedLinePattern.test(planMarkdownLine)
    const lastPlanStep = planSteps.at(-1)
    if (isIndentedLine && lastPlanStep !== undefined) {
      lastPlanStep.planStepWords = toOneLine(`${lastPlanStep.planStepWords} ${trimmedPlanLine.replace(papelizPlanListItemMarkerPattern, '')}`)
      continue
    }
    const checklistStepMatch = planStepLineStyle === 'numbered' ? null : papelizPlanChecklistStepLinePattern.exec(trimmedPlanLine)
    const numberedStepMatch = planStepLineStyle === 'checklist' || checklistStepMatch !== null ? null : papelizPlanNumberedStepLinePattern.exec(trimmedPlanLine)
    if (checklistStepMatch !== null) {
      planStepLineStyle = 'checklist'
      const isStepTicked = checklistStepMatch[1] !== ' '
      planSteps.push(createPapelizAssistantPlanStep(toOneLine(checklistStepMatch[2] ?? ''), isStepTicked ? tickedStepStatus : 'to-do'))
      continue
    }
    if (numberedStepMatch !== null) {
      planStepLineStyle = 'numbered'
      planSteps.push(createPapelizAssistantPlanStep(toOneLine(numberedStepMatch[1] ?? '')))
      continue
    }
    if (planSteps.length > 0 || trimmedPlanLine.startsWith('#')) continue
    const assumedLineMatch = papelizPlanAssumedLinePattern.exec(trimmedPlanLine)
    if (assumedLineMatch !== null) {
      planAssumedText = toOneLine(assumedLineMatch[1] ?? '') || null
      continue
    }
    const goalLineMatch = papelizPlanGoalLinePattern.exec(trimmedPlanLine)
    if (goalLineMatch !== null) explicitGoalText = toOneLine(goalLineMatch[1] ?? '')
    else firstParagraphText ??= toOneLine(trimmedPlanLine)
  }
  const nonEmptyPlanSteps = planSteps.filter((planStep) => planStep.planStepWords.length > 0)
  if (planTitle.length === 0 || nonEmptyPlanSteps.length === 0) return null
  return { planTitle, planGoalText: explicitGoalText ?? firstParagraphText ?? '', planAssumedText, planSteps: nonEmptyPlanSteps }
}

// A Plan reply as a plan, or null when the reply isn't one (a plain answer to a question).
export function readPapelizAssistantPlanReply(planReplyText: string): PapelizAssistantPlanDocument | null {
  const planMarkdown = readPlanMarkdown(planReplyText, 'ticked')
  return planMarkdown === null ? null : { ...planMarkdown, planBuildPhase: 'draft' }
}

export function isPapelizAssistantPlanStepTicked(planStep: PapelizAssistantPlanStep): boolean {
  return planStep.planStepStatus === 'ticked' || planStep.planStepStatus === 'done'
}

// The title, goal, guesses and steps as Markdown, ticks kept.
export function formatPapelizAssistantPlanMarkdown(planDocument: PapelizAssistantPlanDocument): string {
  const planMarkdownLines = [`# ${toOneLine(planDocument.planTitle) || 'Plan'}`]
  if (toOneLine(planDocument.planGoalText).length > 0) planMarkdownLines.push('', `Goal: ${toOneLine(planDocument.planGoalText)}`)
  if (planDocument.planAssumedText !== null && toOneLine(planDocument.planAssumedText).length > 0) planMarkdownLines.push('', `Assumed: ${toOneLine(planDocument.planAssumedText)}`)
  planMarkdownLines.push('')
  for (const planStep of planDocument.planSteps) {
    planMarkdownLines.push(`- [${isPapelizAssistantPlanStepTicked(planStep) ? 'x' : ' '}] ${toOneLine(planStep.planStepWords)}`)
  }
  return planMarkdownLines.join('\n')
}

// Every step ticked.
export function isPapelizAssistantPlanFinished(planDocument: PapelizAssistantPlanDocument): boolean {
  return planDocument.planSteps.length > 0 && planDocument.planSteps.every(isPapelizAssistantPlanStepTicked)
}

export function formatPapelizAssistantPlanNote(planDocument: PapelizAssistantPlanDocument, planNoteChatSessionName: string | null): string {
  return [
    '---',
    `${papelizPlanNoteFrontmatterKey}: ${isPapelizAssistantPlanFinished(planDocument) ? 'done' : 'in-progress'}`,
    `${papelizPlanNoteChatFrontmatterKey}: ${toOneLine(planNoteChatSessionName ?? '')}`.trimEnd(),
    '---',
    formatPapelizAssistantPlanMarkdown(planDocument),
    '',
  ].join('\n')
}

// A note in `Plans/` read back, or null for any note that isn't a plan note. A ticked step reads as
// done; the build reads as not started, stopped part way, or done, from the ticks.
export function parsePapelizAssistantPlanNote(planNoteText: string): PapelizAssistantPlanNote | null {
  const normalizedPlanNoteText = planNoteText.replace(/\r\n/g, '\n')
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(normalizedPlanNoteText)
  if (frontmatterMatch === null) return null
  const frontmatterValues = new Map<string, string>()
  for (const frontmatterLine of (frontmatterMatch[1] ?? '').split('\n')) {
    const frontmatterLineMatch = /^([\w-]+):\s*(.*)$/.exec(frontmatterLine)
    if (frontmatterLineMatch !== null) frontmatterValues.set(frontmatterLineMatch[1] ?? '', (frontmatterLineMatch[2] ?? '').trim())
  }
  const planNoteState = frontmatterValues.get(papelizPlanNoteFrontmatterKey)
  if (planNoteState === undefined) return null
  const planMarkdown = readPlanMarkdown(normalizedPlanNoteText.slice(frontmatterMatch[0].length), 'done')
  if (planMarkdown === null) return null
  const planStepDoneCount = planMarkdown.planSteps.filter(isPapelizAssistantPlanStepTicked).length
  const planBuildPhase: PapelizAssistantPlanBuildPhase =
    planStepDoneCount === planMarkdown.planSteps.length ? 'done' : planStepDoneCount > 0 ? 'stopped' : 'draft'
  const planNoteChatSessionName = frontmatterValues.get(papelizPlanNoteChatFrontmatterKey) ?? ''
  return {
    planDocument: { ...planMarkdown, planBuildPhase },
    isPlanNoteDone: planNoteState === 'done',
    planNoteChatSessionName: planNoteChatSessionName.length > 0 ? planNoteChatSessionName : null,
  }
}

export interface PapelizAssistantPlanProgress {
  planStepDoneCount: number
  planStepCount: number
}

export function countPapelizAssistantPlanProgress(planSteps: readonly Pick<PapelizAssistantPlanStep, 'planStepStatus'>[]): PapelizAssistantPlanProgress {
  return {
    planStepDoneCount: planSteps.filter((planStep) => planStep.planStepStatus === 'ticked' || planStep.planStepStatus === 'done').length,
    planStepCount: planSteps.length,
  }
}

// The step Build runs next: the first that isn't ticked, done or skipped.
export function findPapelizAssistantPlanStepToBuild(planDocument: PapelizAssistantPlanDocument): PapelizAssistantPlanStep | null {
  return (
    planDocument.planSteps.find((planStep) => !isPapelizAssistantPlanStepTicked(planStep) && planStep.planStepStatus !== 'skipped') ?? null
  )
}

// The step the build is on while it builds: running, waiting for review, or failed.
export function findPapelizAssistantPlanActiveStep(planDocument: PapelizAssistantPlanDocument): PapelizAssistantPlanStep | null {
  return (
    planDocument.planSteps.find(
      (planStep) => planStep.planStepStatus === 'running' || planStep.planStepStatus === 'needs-review' || planStep.planStepStatus === 'failed',
    ) ?? null
  )
}

export function updatePapelizAssistantPlanStep(
  planDocument: PapelizAssistantPlanDocument,
  planStepId: string,
  planStepChange: Partial<Omit<PapelizAssistantPlanStep, 'planStepId'>>,
): PapelizAssistantPlanDocument {
  return { ...planDocument, planSteps: planDocument.planSteps.map((planStep) => (planStep.planStepId === planStepId ? { ...planStep, ...planStepChange } : planStep)) }
}

// Ticked (already done, so Build skips it) or not.
export function togglePapelizAssistantPlanStepTicked(planDocument: PapelizAssistantPlanDocument, planStepId: string): PapelizAssistantPlanDocument {
  const planStep = planDocument.planSteps.find((candidateStep) => candidateStep.planStepId === planStepId)
  if (planStep === undefined) return planDocument
  return updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepStatus: isPapelizAssistantPlanStepTicked(planStep) ? 'to-do' : 'ticked', planStepProblem: null })
}

export function movePapelizAssistantPlanStep(planDocument: PapelizAssistantPlanDocument, planStepId: string, targetPlanStepIndex: number): PapelizAssistantPlanDocument {
  const currentPlanStepIndex = planDocument.planSteps.findIndex((planStep) => planStep.planStepId === planStepId)
  if (currentPlanStepIndex === -1) return planDocument
  const clampedTargetIndex = Math.max(0, Math.min(planDocument.planSteps.length - 1, targetPlanStepIndex))
  if (clampedTargetIndex === currentPlanStepIndex) return planDocument
  const reorderedPlanSteps = [...planDocument.planSteps]
  const [movedPlanStep] = reorderedPlanSteps.splice(currentPlanStepIndex, 1)
  if (movedPlanStep === undefined) return planDocument
  reorderedPlanSteps.splice(clampedTargetIndex, 0, movedPlanStep)
  return { ...planDocument, planSteps: reorderedPlanSteps }
}

export function addPapelizAssistantPlanStep(planDocument: PapelizAssistantPlanDocument, planStepWords = ''): PapelizAssistantPlanDocument {
  return { ...planDocument, planSteps: [...planDocument.planSteps, createPapelizAssistantPlanStep(toOneLine(planStepWords))] }
}

export function deletePapelizAssistantPlanStep(planDocument: PapelizAssistantPlanDocument, planStepId: string): PapelizAssistantPlanDocument {
  return { ...planDocument, planSteps: planDocument.planSteps.filter((planStep) => planStep.planStepId !== planStepId) }
}

export function setPapelizAssistantPlanStepWords(planDocument: PapelizAssistantPlanDocument, planStepId: string, planStepWords: string): PapelizAssistantPlanDocument {
  return updatePapelizAssistantPlanStep(planDocument, planStepId, { planStepWords: toOneLine(planStepWords) })
}

const papelizPlanStepWikilinkPattern = /\[\[([^[\]\n]+)\]\]/g

// The notes a step names, in order, each once: `[[Folder/Note|Label]]` gives "Folder/Note".
export function listPapelizAssistantPlanStepWikilinkTargets(planStepWords: string): string[] {
  const wikilinkTargetNoteNames: string[] = []
  for (const wikilinkMatch of planStepWords.matchAll(papelizPlanStepWikilinkPattern)) {
    const wikilinkTargetNoteName = parsePapelizWikilinkInnerText(wikilinkMatch[1] ?? '').wikilinkTargetNoteName
    if (wikilinkTargetNoteName.length > 0 && !wikilinkTargetNoteNames.some((listedName) => listedName.toLowerCase() === wikilinkTargetNoteName.toLowerCase())) {
      wikilinkTargetNoteNames.push(wikilinkTargetNoteName)
    }
  }
  return wikilinkTargetNoteNames
}

// A step's words as they read on the card: each [[link]] as the words it shows ("Weekly Review
// Template"), and Markdown's bold and code marks left out.
export function describePapelizAssistantPlanStepWords(planStepWords: string): string {
  return planStepWords
    .replace(papelizPlanStepWikilinkPattern, (_wikilinkText, wikilinkInnerText: string) => getPapelizWikilinkDisplayText(parsePapelizWikilinkInnerText(wikilinkInnerText)))
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
}
