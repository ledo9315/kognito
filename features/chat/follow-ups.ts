import { generateText, Output, type LanguageModel } from 'ai'
import { z } from 'zod'
import { defaultModel } from '@/lib/model'
import { followUpCount, maxFollowUpCharacters } from '@/lib/config'

/**
 * Three questions to ask next, written after an answer has been given.
 *
 * A second, small request rather than a field of the answer itself: the
 * answer is streamed as text and the citations are read back out of exactly
 * that text. Wrapping it in an object would turn every citation chip and the
 * stored message into a different problem, for three short strings.
 *
 * The question and the answer go in, the sources do not. What the sources
 * hold is already in the answer, and asking again with the full context would
 * cost as much as the answer did.
 */

const FollowUps = z.object({
  questions: z
    .array(
      z
        .string()
        .describe('Eine Frage, die man nach dieser Antwort stellen würde'),
    )
    .describe('Genau drei Fragen, von der naheliegendsten zur speziellsten'),
})

export const followUpRules = `Du schlägst Fragen vor, die jemand nach einer Antwort als Nächstes stellen würde.

Regeln:
- Genau drei Fragen.
- Jede Frage führt weiter, statt die Antwort noch einmal zu erfragen.
- Frage nur nach Dingen, die in denselben Quellen stehen dürften. Nichts, was ein Handeln verlangt, und nichts über die Zukunft.
- Formuliere so, wie ein Leser fragt, direkt und ohne Anrede. Kein "Kannst du", kein "Erkläre mir", kein "Bitte".
- Höchstens zwölf Wörter pro Frage, sie stehen als Knopf in einer schmalen Spalte.
- Schreibe auf Deutsch, ohne Nummerierung und ohne Aufzählungszeichen.`

/**
 * Never throws. Suggestions are an offer, and an unreachable model costs the
 * offer and nothing else. Same trade as the summary of a source.
 */
export async function suggestFollowUps(
  question: string,
  answer: string,
  model?: LanguageModel,
): Promise<string[]> {
  if (!answer.trim()) return []

  try {
    const { output } = await generateText({
      model: model ?? defaultModel(),
      output: Output.object({ schema: FollowUps }),
      // Three short questions are not a thinking task, and gpt-5-mini spends
      // most of the wait on reasoning tokens nobody reads. Measured against
      // the gateway, with the answer below as input:
      //
      //   gpt-5-mini, as it comes   4.7s
      //   gpt-5-mini, minimal       1.4s
      //   gpt-5-nano, minimal       1.6s, and it drops the question marks
      //
      // Only openai reads these, a model from another provider ignores them
      // and is as slow as it was.
      providerOptions: {
        openai: { reasoningEffort: 'minimal', textVerbosity: 'low' },
      },
      system: followUpRules,
      prompt: [
        `Frage:\n${question.slice(0, maxFollowUpCharacters)}`,
        `Antwort:\n${answer.slice(0, maxFollowUpCharacters)}`,
      ].join('\n\n'),
    })

    return trimToThree(output.questions)
  } catch (error) {
    console.error('chat: suggesting follow-ups failed', error)
    return []
  }
}

/**
 * The count in the schema is a wish, not a rule: structured outputs do not
 * enforce array bounds, which is why the mindmap counts its nodes in code as
 * well. Same here, and a question that grew into a paragraph is dropped
 * rather than shown with an ellipsis.
 */
function trimToThree(questions: string[]) {
  return questions
    .map((question) => question.trim())
    .filter((question) => question.length > 0 && question.length <= 120)
    .slice(0, followUpCount)
}
