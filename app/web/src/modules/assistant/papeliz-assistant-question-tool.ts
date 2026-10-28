import type { PapelizChatToolCall, PapelizChatToolDefinition } from './papeliz-openai-compatible-client'

// The tool the AI Assistant uses to ask the user something before it goes on: one to four questions,
// each with a few answers to pick from and room for the user's own. The card shows them one at a
// time with Next. The answer is never awaited inside a run: asking ends the run, and the answers come
// back as the user's next message.

export const papelizAssistantQuestionToolName = 'askUserQuestion'

const papelizAssistantQuestionLimit = 4
const papelizAssistantQuestionAnswerOptionLimit = 4

export const papelizAssistantQuestionToolDefinition: PapelizChatToolDefinition = {
  type: 'function',
  function: {
    name: papelizAssistantQuestionToolName,
    description:
      'Ask the user when their request is unclear or has real choices to make (which notes, how much, what style). Ask 1 to 4 questions at once, each with 2 to 4 short answers to pick from; the user may also write their own. Their answers arrive as their next message, so stop after asking. Ask only what changes what you do.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: '1 to 4 questions, asked one after another.',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The question, one short sentence ending in a question mark.' },
              topic: { type: 'string', description: 'One or two words naming the question, like "Notes" or "Tone".' },
              answerOptions: {
                type: 'array',
                items: { type: 'string' },
                description: '2 to 4 short answers, the one you would pick first.',
              },
            },
            required: ['question', 'topic', 'answerOptions'],
          },
        },
      },
      required: ['questions'],
    },
  },
}

export interface PapelizAssistantQuestion {
  questionText: string
  // A word or two naming the question, shown on its step.
  questionTopic: string
  answerOptionTexts: string[]
}

function readPapelizAssistantQuestion(questionArguments: unknown, questionIndex: number): PapelizAssistantQuestion | null {
  if (typeof questionArguments !== 'object' || questionArguments === null) return null
  const { question, topic, answerOptions } = questionArguments as { question?: unknown; topic?: unknown; answerOptions?: unknown }
  if (typeof question !== 'string' || question.trim().length === 0) return null
  const answerOptionTexts = (Array.isArray(answerOptions) ? answerOptions : [])
    .filter((answerOption): answerOption is string => typeof answerOption === 'string' && answerOption.trim().length > 0)
    .map((answerOption) => answerOption.trim())
    .slice(0, papelizAssistantQuestionAnswerOptionLimit)
  const questionTopic = typeof topic === 'string' && topic.trim().length > 0 ? topic.trim().slice(0, 24) : `Question ${questionIndex + 1}`
  return { questionText: question.trim(), questionTopic, answerOptionTexts }
}

// The questions a tool call asks, or null when it has none. A model that sends one question the
// older way (`question` and `answerOptions` at the top) is understood too.
export function readPapelizAssistantQuestionToolCall(toolCall: PapelizChatToolCall): PapelizAssistantQuestion[] | null {
  let toolArguments: unknown
  try {
    toolArguments = JSON.parse(toolCall.function.arguments || '{}')
  } catch {
    return null
  }
  if (typeof toolArguments !== 'object' || toolArguments === null) return null
  const { questions } = toolArguments as { questions?: unknown }
  const askedQuestions = (Array.isArray(questions) ? questions : [toolArguments])
    .map((questionArguments, questionIndex) => readPapelizAssistantQuestion(questionArguments, questionIndex))
    .filter((assistantQuestion): assistantQuestion is PapelizAssistantQuestion => assistantQuestion !== null)
    .slice(0, papelizAssistantQuestionLimit)
  return askedQuestions.length > 0 ? askedQuestions : null
}

// The user's answers as the message sent back: the answer alone for one question, or each question
// with its answer, one per line.
export function buildPapelizAssistantQuestionAnswerMessage(assistantQuestions: readonly PapelizAssistantQuestion[], questionAnswerTexts: readonly string[]): string {
  if (assistantQuestions.length === 1) return questionAnswerTexts[0] ?? ''
  return assistantQuestions.map((assistantQuestion, questionIndex) => `${assistantQuestion.questionText} → ${questionAnswerTexts[questionIndex] ?? ''}`).join('\n')
}
