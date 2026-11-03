import { describe, expect, it } from 'vitest'
import {
  addPapelizAssistantPlanStep,
  countPapelizAssistantPlanProgress,
  deletePapelizAssistantPlanStep,
  describePapelizAssistantPlanStepWords,
  findPapelizAssistantPlanActiveStep,
  findPapelizAssistantPlanStepToBuild,
  formatPapelizAssistantPlanMarkdown,
  formatPapelizAssistantPlanNote,
  listPapelizAssistantPlanStepWikilinkTargets,
  movePapelizAssistantPlanStep,
  parsePapelizAssistantPlanNote,
  readPapelizAssistantPlanReply,
  setPapelizAssistantPlanStepWords,
  togglePapelizAssistantPlanStepTicked,
  updatePapelizAssistantPlanStep,
  type PapelizAssistantPlanDocument,
} from './papeliz-assistant-plan-document'

const weeklyReviewPlanReplyText = `Here is the plan.

# Weekly review for Project Hub

**Goal:** Each Friday afternoon, one note gathers the week’s open tasks and decisions.

Assumed: Friday afternoon · open tasks and decisions · a Reviews folder

- [ ] Create [[Weekly Review Template]] with sections for wins, open tasks and decisions.
- [ ] Make the first review, [[Reviews/Review 2026-11-07|Review 2026-11-07]], and move the open tasks from [[Inbox]] into it.
  Keep the tasks' due dates.
- [x] Add a Reviews section to [[Project Hub]] that lists every review.

Press Build when it reads right.
1. This numbered line is an aside, not a step.`

function readWeeklyReviewPlan(): PapelizAssistantPlanDocument {
  const planDocument = readPapelizAssistantPlanReply(weeklyReviewPlanReplyText)
  if (planDocument === null) throw new Error('The plan reply should read as a plan.')
  return planDocument
}

describe('a plan the assistant writes', () => {
  it('reads a reply into a title, a goal, the guesses and the steps, leaving out what is around them', () => {
    const planDocument = readWeeklyReviewPlan()
    expect(planDocument).toMatchObject({
      planTitle: 'Weekly review for Project Hub',
      planGoalText: 'Each Friday afternoon, one note gathers the week’s open tasks and decisions.',
      planAssumedText: 'Friday afternoon · open tasks and decisions · a Reviews folder',
      planBuildPhase: 'draft',
    })
    expect(planDocument.planSteps.map(({ planStepWords, planStepStatus }) => [planStepWords, planStepStatus])).toEqual([
      ['Create [[Weekly Review Template]] with sections for wins, open tasks and decisions.', 'to-do'],
      [
        "Make the first review, [[Reviews/Review 2026-11-07|Review 2026-11-07]], and move the open tasks from [[Inbox]] into it. Keep the tasks' due dates.",
        'to-do',
      ],
      // A step written ticked is one already done, which Build skips.
      ['Add a Reviews section to [[Project Hub]] that lists every review.', 'ticked'],
    ])
    expect(new Set(planDocument.planSteps.map((planStep) => planStep.planStepId)).size).toBe(3)
  })

  it('reads numbered steps, and takes the first paragraph as the goal when no Goal line says it', () => {
    const planDocument = readPapelizAssistantPlanReply('# Tidy the garden notes\n\nMerge the duplicates.\n\n1. Read [[Garden]].\n2) Merge [[Garden 2]] into [[Garden]].')
    expect(planDocument).toMatchObject({ planTitle: 'Tidy the garden notes', planGoalText: 'Merge the duplicates.', planAssumedText: null })
    expect(planDocument?.planSteps.map((planStep) => planStep.planStepWords)).toEqual(['Read [[Garden]].', 'Merge [[Garden 2]] into [[Garden]].'])
  })

  it('is not a plan without a title and a step: a plain answer to a question stays an answer', () => {
    expect(readPapelizAssistantPlanReply('The second “Tasks” heading came in with a pasted block from [[Meeting Notes]].')).toBeNull()
    expect(readPapelizAssistantPlanReply('# Why two headings\n\nA block was pasted twice.\n\n- One reason\n- Another reason')).toBeNull()
    expect(readPapelizAssistantPlanReply('- [ ] A step with no title')).toBeNull()
  })

  it('writes the plan back as a checklist that reads the same', () => {
    const readPlanDocument = readWeeklyReviewPlan()
    const planDocument = togglePapelizAssistantPlanStepTicked(readPlanDocument, readPlanDocument.planSteps[0]!.planStepId)
    const planMarkdown = formatPapelizAssistantPlanMarkdown(planDocument)
    expect(planMarkdown).toBe(
      [
        '# Weekly review for Project Hub',
        '',
        'Goal: Each Friday afternoon, one note gathers the week’s open tasks and decisions.',
        '',
        'Assumed: Friday afternoon · open tasks and decisions · a Reviews folder',
        '',
        '- [x] Create [[Weekly Review Template]] with sections for wins, open tasks and decisions.',
        "- [ ] Make the first review, [[Reviews/Review 2026-11-07|Review 2026-11-07]], and move the open tasks from [[Inbox]] into it. Keep the tasks' due dates.",
        '- [x] Add a Reviews section to [[Project Hub]] that lists every review.',
      ].join('\n'),
    )
    const planReadBack = readPapelizAssistantPlanReply(planMarkdown)
    expect(planReadBack?.planSteps.map(({ planStepWords, planStepStatus }) => [planStepWords, planStepStatus])).toEqual(
      planDocument.planSteps.map(({ planStepWords, planStepStatus }) => [planStepWords, planStepStatus === 'ticked' ? 'ticked' : 'to-do']),
    )
  })
})

describe('a plan’s note in Plans/', () => {
  it('keeps the ticks and names its chat, and reads back with its ticked steps done', () => {
    const planDocument = readWeeklyReviewPlan()
    const builtPlanDocument = updatePapelizAssistantPlanStep(planDocument, planDocument.planSteps[0]!.planStepId, { planStepStatus: 'done' })
    const planNoteText = formatPapelizAssistantPlanNote(builtPlanDocument, '2026-11-03 2340 Plan a weekly review')
    expect(planNoteText.startsWith('---\npapeliz-plan: in-progress\npapeliz-plan-chat: 2026-11-03 2340 Plan a weekly review\n---\n# Weekly review for Project Hub\n')).toBe(true)
    expect(planNoteText).toContain('\n- [x] Create [[Weekly Review Template]]')
    expect(planNoteText.endsWith('\n')).toBe(true)

    const planNote = parsePapelizAssistantPlanNote(planNoteText.replace(/\n/g, '\r\n'))
    expect(planNote).toMatchObject({ isPlanNoteDone: false, planNoteChatSessionName: '2026-11-03 2340 Plan a weekly review' })
    expect(planNote?.planDocument.planSteps.map((planStep) => planStep.planStepStatus)).toEqual(['done', 'to-do', 'done'])
    // Part way built: Continue picks it up.
    expect(planNote?.planDocument.planBuildPhase).toBe('stopped')
  })

  it('is done once every step is ticked, and names no chat until the chat is saved', () => {
    const planDocument = readWeeklyReviewPlan()
    const everyStepDone = { ...planDocument, planSteps: planDocument.planSteps.map((planStep) => ({ ...planStep, planStepStatus: 'done' as const })) }
    const planNoteText = formatPapelizAssistantPlanNote(everyStepDone, null)
    expect(planNoteText).toContain('papeliz-plan: done\npapeliz-plan-chat:\n---')
    expect(parsePapelizAssistantPlanNote(planNoteText)).toMatchObject({ isPlanNoteDone: true, planNoteChatSessionName: null, planDocument: { planBuildPhase: 'done' } })
  })

  it('is not a plan note without its frontmatter line', () => {
    expect(parsePapelizAssistantPlanNote('# Weekly review\n\n- [ ] A step')).toBeNull()
    expect(parsePapelizAssistantPlanNote('---\ntags: [plan]\n---\n# Weekly review\n\n- [ ] A step')).toBeNull()
  })
})

describe('changing a plan before it is built', () => {
  it('ticks, rewords, moves, adds and deletes steps', () => {
    const planDocument = readWeeklyReviewPlan()
    const [firstStep, secondStep, thirdStep] = planDocument.planSteps
    const tickedPlan = togglePapelizAssistantPlanStepTicked(planDocument, firstStep!.planStepId)
    expect(tickedPlan.planSteps[0]?.planStepStatus).toBe('ticked')
    expect(togglePapelizAssistantPlanStepTicked(tickedPlan, firstStep!.planStepId).planSteps[0]?.planStepStatus).toBe('to-do')

    const rewordedPlan = setPapelizAssistantPlanStepWords(planDocument, secondStep!.planStepId, 'Make the first review\nfrom the template.')
    expect(rewordedPlan.planSteps[1]?.planStepWords).toBe('Make the first review from the template.')

    const movedPlan = movePapelizAssistantPlanStep(planDocument, thirdStep!.planStepId, 0)
    expect(movedPlan.planSteps.map((planStep) => planStep.planStepId)).toEqual([thirdStep!.planStepId, firstStep!.planStepId, secondStep!.planStepId])
    expect(movePapelizAssistantPlanStep(planDocument, firstStep!.planStepId, 99).planSteps.at(-1)?.planStepId).toBe(firstStep!.planStepId)

    const extendedPlan = addPapelizAssistantPlanStep(planDocument, 'Tag the reviews #weekly-review.')
    expect(extendedPlan.planSteps).toHaveLength(4)
    expect(extendedPlan.planSteps[3]).toMatchObject({ planStepWords: 'Tag the reviews #weekly-review.', planStepStatus: 'to-do' })

    expect(deletePapelizAssistantPlanStep(planDocument, secondStep!.planStepId).planSteps.map((planStep) => planStep.planStepId)).toEqual([
      firstStep!.planStepId,
      thirdStep!.planStepId,
    ])
  })

  it('names each step’s notes once, and reads its words without the link marks', () => {
    const stepWords = 'Move the tasks from [[Inbox]] into [[Reviews/Review 2026-11-07|this week’s review]], then link **[[inbox]]** from `Project Hub`.'
    expect(listPapelizAssistantPlanStepWikilinkTargets(stepWords)).toEqual(['Inbox', 'Reviews/Review 2026-11-07'])
    expect(describePapelizAssistantPlanStepWords(stepWords)).toBe('Move the tasks from Inbox into this week’s review, then link inbox from Project Hub.')
  })
})

describe('building a plan', () => {
  it('builds the first step that isn’t ticked, done or skipped, and counts what is done', () => {
    const planDocument = readWeeklyReviewPlan()
    const [firstStep, secondStep] = planDocument.planSteps
    expect(findPapelizAssistantPlanStepToBuild(planDocument)?.planStepId).toBe(firstStep!.planStepId)
    const skippedFirstPlan = updatePapelizAssistantPlanStep(planDocument, firstStep!.planStepId, { planStepStatus: 'skipped' })
    expect(findPapelizAssistantPlanStepToBuild(skippedFirstPlan)?.planStepId).toBe(secondStep!.planStepId)
    expect(findPapelizAssistantPlanActiveStep(skippedFirstPlan)).toBeNull()
    const reviewedPlan = updatePapelizAssistantPlanStep(skippedFirstPlan, secondStep!.planStepId, { planStepStatus: 'needs-review' })
    expect(findPapelizAssistantPlanActiveStep(reviewedPlan)?.planStepId).toBe(secondStep!.planStepId)
    expect(countPapelizAssistantPlanProgress(reviewedPlan.planSteps)).toEqual({ planStepDoneCount: 1, planStepCount: 3 })
    const builtPlan = updatePapelizAssistantPlanStep(reviewedPlan, secondStep!.planStepId, { planStepStatus: 'done' })
    expect(findPapelizAssistantPlanStepToBuild(builtPlan)).toBeNull()
  })
})
