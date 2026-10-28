import { ArrowLeft, ArrowRight, ArrowUp, Check, MessageCircleQuestion, PencilLine } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizAssistantConversationStore, type PapelizAssistantChatEntry } from './papeliz-assistant-conversation-store'

interface PapelizAssistantQuestionCardProps {
  questionEntry: Extract<PapelizAssistantChatEntry, { chatEntryKind: 'question' }>
}

// One question's answer while the card is filled in: one picked from the list, or the user's own.
interface PapelizQuestionStepAnswer {
  pickedAnswerOptionText: string | null
  ownAnswerText: string
  isOwnAnswerChosen: boolean
}

function readQuestionStepAnswerText(questionStepAnswer: PapelizQuestionStepAnswer | undefined): string {
  if (questionStepAnswer === undefined) return ''
  return questionStepAnswer.isOwnAnswerChosen ? questionStepAnswer.ownAnswerText.trim() : (questionStepAnswer.pickedAnswerOptionText ?? '')
}

interface PapelizQuestionAnswerOptionRowProps {
  answerOptionText: string
  answerOptionNumber: number
  isChosenAnswer: boolean
  isQuestionAnswered: boolean
  onAnswerOptionPick: () => void
}

function PapelizQuestionAnswerOptionRow({ answerOptionText, answerOptionNumber, isChosenAnswer, isQuestionAnswered, onAnswerOptionPick }: PapelizQuestionAnswerOptionRowProps) {
  return (
    <button
      type="button"
      disabled={isQuestionAnswered}
      aria-pressed={isChosenAnswer}
      onClick={onAnswerOptionPick}
      className={joinPapelizClassNames(
        'flex min-h-9 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13.5px] transition-colors',
        isChosenAnswer
          ? 'bg-papeliz-chosen-row-ground font-medium text-papeliz-chosen-row-ink'
          : isQuestionAnswered
            ? 'text-papeliz-ink-subtle'
            : 'text-papeliz-ink hover:bg-papeliz-hover',
      )}
    >
      <span
        className={joinPapelizClassNames(
          'grid size-[22px] flex-none place-items-center rounded-md text-[11.5px] font-semibold',
          isChosenAnswer ? 'bg-papeliz-chosen-tab-ground text-white' : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
        )}
        aria-hidden="true"
      >
        {isChosenAnswer ? <Check className="size-3" /> : answerOptionNumber}
      </span>
      <span className="min-w-0">{answerOptionText}</span>
    </button>
  )
}

// Questions the AI Assistant asked. One question: its answers in a numbered list and a last row to
// write your own; picking one (or pressing its number while the card has focus) sends it. Several:
// one at a time, with a step for each along the top; pick or write an answer, then Next, and Send
// answers on the last. Typing in the chat box answers them too. Once answered, the answers stay marked.
export function PapelizAssistantQuestionCard({ questionEntry }: PapelizAssistantQuestionCardProps) {
  const answerAssistantQuestion = usePapelizAssistantConversationStore((conversationState) => conversationState.answerAssistantQuestion)
  const { assistantQuestions } = questionEntry
  const isAskingSeveral = assistantQuestions.length > 1
  const isQuestionAnswered = questionEntry.questionAnswerText !== null
  const [questionStepIndex, setQuestionStepIndex] = useState(0)
  const [questionStepAnswers, setQuestionStepAnswers] = useState<PapelizQuestionStepAnswer[]>(() =>
    assistantQuestions.map(() => ({ pickedAnswerOptionText: null, ownAnswerText: '', isOwnAnswerChosen: false })),
  )
  const currentQuestion = assistantQuestions[questionStepIndex] ?? assistantQuestions[0]
  const currentStepAnswer = questionStepAnswers[questionStepIndex]
  const isCurrentStepAnswered = readQuestionStepAnswerText(currentStepAnswer).length > 0
  const isLastQuestionStep = questionStepIndex === assistantQuestions.length - 1
  const isEveryStepAnswered = questionStepAnswers.every((questionStepAnswer) => readQuestionStepAnswerText(questionStepAnswer).length > 0)
  if (currentQuestion === undefined) return null

  const updateCurrentStepAnswer = (stepAnswerChange: Partial<PapelizQuestionStepAnswer>) =>
    setQuestionStepAnswers((currentStepAnswers) =>
      currentStepAnswers.map((questionStepAnswer, stepIndex) => (stepIndex === questionStepIndex ? { ...questionStepAnswer, ...stepAnswerChange } : questionStepAnswer)),
    )

  const sendQuestionAnswers = (questionAnswerTexts: readonly string[]) => {
    if (isQuestionAnswered || questionAnswerTexts.some((questionAnswerText) => questionAnswerText.trim().length === 0)) return
    answerAssistantQuestion(questionEntry.chatEntryId, questionAnswerTexts)
  }

  // One question sends at once; with several, a pick marks the step and Next moves on.
  const pickAnswerOption = (answerOptionText: string) => {
    if (isQuestionAnswered) return
    if (!isAskingSeveral) {
      sendQuestionAnswers([answerOptionText])
      return
    }
    updateCurrentStepAnswer({ pickedAnswerOptionText: answerOptionText, isOwnAnswerChosen: false })
  }

  const goToNextQuestionStep = () => {
    if (!isCurrentStepAnswered) return
    if (isLastQuestionStep) {
      if (isEveryStepAnswered) sendQuestionAnswers(questionStepAnswers.map(readQuestionStepAnswerText))
      return
    }
    setQuestionStepIndex(questionStepIndex + 1)
  }

  const handleQuestionCardKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (keyboardEvent.target instanceof HTMLInputElement || isQuestionAnswered) return
    if (keyboardEvent.key === 'Enter' && isAskingSeveral && keyboardEvent.target === keyboardEvent.currentTarget) {
      keyboardEvent.preventDefault()
      goToNextQuestionStep()
      return
    }
    const answerOptionText = currentQuestion.answerOptionTexts[Number(keyboardEvent.key) - 1]
    if (answerOptionText === undefined) return
    keyboardEvent.preventDefault()
    pickAnswerOption(answerOptionText)
  }

  if (isAskingSeveral && isQuestionAnswered) {
    return (
      <div
        role="group"
        aria-label="Questions the assistant asked"
        className="papeliz-pop-enter flex-none overflow-hidden rounded-[18px] border border-papeliz-line bg-papeliz-surface px-3.5 py-3 shadow-papeliz-card"
      >
        <ol className="flex flex-col gap-2.5">
          {assistantQuestions.map((assistantQuestion, questionIndex) => (
            <li key={`${assistantQuestion.questionTopic}-${questionIndex}`} className="flex items-start gap-2.5 text-[13.5px]">
              <span className="mt-0.5 grid size-[18px] flex-none place-items-center rounded-full bg-papeliz-chosen-tab-ground text-white" aria-hidden="true">
                <Check className="size-2.5" />
              </span>
              <span className="min-w-0">
                <span className="papeliz-selectable-text block text-papeliz-ink-muted">{assistantQuestion.questionText}</span>
                <span className="papeliz-selectable-text block font-medium text-papeliz-ink">
                  {questionEntry.questionAnswerTexts?.[questionIndex] ?? 'Answered in the chat'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const answeredText = questionEntry.questionAnswerTexts?.[0] ?? questionEntry.questionAnswerText
  const isOwnAnswerGiven = !isAskingSeveral && isQuestionAnswered && !currentQuestion.answerOptionTexts.includes(answeredText ?? '')
  const isOwnAnswerChosenHere = isAskingSeveral && currentStepAnswer?.isOwnAnswerChosen === true

  return (
    <div
      role="group"
      aria-label={isAskingSeveral ? `Question ${questionStepIndex + 1} of ${assistantQuestions.length}: ${currentQuestion.questionText}` : currentQuestion.questionText}
      tabIndex={-1}
      onKeyDown={handleQuestionCardKeyDown}
      className="papeliz-pop-enter flex-none overflow-hidden rounded-[18px] border border-papeliz-blue-line bg-papeliz-surface shadow-papeliz-card outline-none"
    >
      {isAskingSeveral && (
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2.5">
          {assistantQuestions.map((assistantQuestion, questionIndex) => {
            const isStepAnswered = readQuestionStepAnswerText(questionStepAnswers[questionIndex]).length > 0
            const isCurrentStep = questionIndex === questionStepIndex
            return (
              <button
                key={`${assistantQuestion.questionTopic}-${questionIndex}`}
                type="button"
                aria-current={isCurrentStep ? 'step' : undefined}
                onClick={() => setQuestionStepIndex(questionIndex)}
                className={joinPapelizClassNames(
                  'inline-flex h-6 flex-none items-center gap-1 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors',
                  isCurrentStep
                    ? 'bg-papeliz-chosen-tab-ground text-white'
                    : isStepAnswered
                      ? 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink hover:brightness-[.97]'
                      : 'bg-papeliz-surface-gray text-papeliz-ink-muted hover:text-papeliz-ink',
                )}
              >
                {isStepAnswered && !isCurrentStep && <Check className="size-3" aria-hidden="true" />}
                {assistantQuestion.questionTopic}
              </button>
            )
          })}
          <span className="ml-auto flex-none pl-2 text-[11.5px] text-papeliz-ink-subtle">
            {questionStepIndex + 1} of {assistantQuestions.length}
          </span>
        </div>
      )}
      <div className="flex items-start gap-2 px-3.5 pt-3 pb-2 text-[14px] font-semibold text-papeliz-ink">
        <MessageCircleQuestion className="mt-0.5 size-4 flex-none text-papeliz-blue" aria-hidden="true" />
        <span className="papeliz-selectable-text min-w-0">{currentQuestion.questionText}</span>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-2">
        {currentQuestion.answerOptionTexts.map((answerOptionText, answerOptionIndex) => (
          <PapelizQuestionAnswerOptionRow
            key={answerOptionText}
            answerOptionText={answerOptionText}
            answerOptionNumber={answerOptionIndex + 1}
            isChosenAnswer={
              isAskingSeveral
                ? currentStepAnswer?.isOwnAnswerChosen === false && currentStepAnswer.pickedAnswerOptionText === answerOptionText
                : answeredText === answerOptionText
            }
            isQuestionAnswered={isQuestionAnswered}
            onAnswerOptionPick={() => pickAnswerOption(answerOptionText)}
          />
        ))}
        {isOwnAnswerGiven ? (
          <div className="flex min-h-9 items-center gap-2.5 rounded-xl bg-papeliz-chosen-row-ground px-2 py-1.5 text-[13.5px] font-medium text-papeliz-chosen-row-ink">
            <span className="grid size-[22px] flex-none place-items-center rounded-md bg-papeliz-chosen-tab-ground text-white" aria-hidden="true">
              <Check className="size-3" />
            </span>
            <span className="papeliz-selectable-text min-w-0">{answeredText}</span>
          </div>
        ) : (
          !isQuestionAnswered && (
            <form
              className={joinPapelizClassNames(
                'flex min-h-9 items-center gap-2.5 rounded-xl px-2 py-1',
                isOwnAnswerChosenHere ? 'bg-papeliz-chosen-row-ground' : 'focus-within:bg-papeliz-hover',
              )}
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault()
                if (isAskingSeveral) goToNextQuestionStep()
                else sendQuestionAnswers([currentStepAnswer?.ownAnswerText ?? ''])
              }}
            >
              <span
                className={joinPapelizClassNames(
                  'grid size-[22px] flex-none place-items-center rounded-md',
                  isOwnAnswerChosenHere ? 'bg-papeliz-chosen-tab-ground text-white' : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
                )}
                aria-hidden="true"
              >
                {isOwnAnswerChosenHere ? <Check className="size-3" /> : <PencilLine className="size-3" />}
              </span>
              <input
                value={currentStepAnswer?.ownAnswerText ?? ''}
                onChange={(changeEvent) => updateCurrentStepAnswer({ ownAnswerText: changeEvent.target.value, isOwnAnswerChosen: changeEvent.target.value.trim().length > 0 })}
                aria-label="Your own answer"
                placeholder="Something else…"
                className={joinPapelizClassNames(
                  'min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-papeliz-ink-subtle',
                  isOwnAnswerChosenHere ? 'font-medium text-papeliz-chosen-row-ink' : 'text-papeliz-ink',
                )}
              />
              {!isAskingSeveral && (
                <button
                  type="submit"
                  aria-label="Send your answer"
                  title="Send your answer"
                  disabled={(currentStepAnswer?.ownAnswerText ?? '').trim().length === 0}
                  className="grid size-7 flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-opacity disabled:opacity-0"
                >
                  <ArrowUp className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </form>
          )
        )}
      </div>
      {isAskingSeveral && (
        <div className="flex items-center gap-2 border-t border-papeliz-line px-3 py-2">
          {questionStepIndex > 0 && (
            <PapelizPillButton pillButtonVariant="gray" pillButtonSize="small" className="gap-1" onClick={() => setQuestionStepIndex(questionStepIndex - 1)}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </PapelizPillButton>
          )}
          <PapelizPillButton
            pillButtonVariant="primary"
            pillButtonSize="small"
            className="ml-auto gap-1"
            disabled={isLastQuestionStep ? !isEveryStepAnswered : !isCurrentStepAnswered}
            onClick={goToNextQuestionStep}
          >
            {isLastQuestionStep ? 'Send answers' : 'Next'}
            {isLastQuestionStep ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowRight className="size-3.5" aria-hidden="true" />}
          </PapelizPillButton>
        </div>
      )}
    </div>
  )
}
