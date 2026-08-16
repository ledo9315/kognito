import { generateText, type LanguageModel } from 'ai'
import { defaultModel } from '@/lib/model'
import { maxPromptCharacters } from '@/lib/config'

/**
 * The two or three sentences that stand under a source in the list.
 *
 * Written once when the source is stored, not on every view: the text does
 * not change, so paying for it again would buy nothing.
 */

export const summaryRules = `Du fasst den Text einer Quelle für eine Übersicht zusammen.

Regeln:
- Zwei bis drei Sätze, mehr nicht.
- Sage, worum es in der Quelle geht, nicht was in der Einleitung steht.
- Verwende ausschließlich, was im Text steht. Ergänze nichts aus allgemeinem Wissen.
- Keine Einleitung wie "Dieser Text handelt von", beginne direkt mit der Sache.
- Schreibe auf Deutsch, sachlich und knapp.`

/**
 * Never throws. A source without a summary is still a working source, while
 * a failed upload is a lost one, so an unreachable model costs the sentences
 * and nothing else. Same trade as the embeddings in sources.ts.
 */
export async function summarize(
  text: string,
  model?: LanguageModel,
): Promise<string | null> {
  if (text.trim().length === 0) return null

  try {
    const { text: summary } = await generateText({
      model: model ?? defaultModel(),
      system: summaryRules,
      // ponytail: a long source is cut off rather than searched. Two or three
      // sentences about the opening are still true, and the chat is where
      // the whole text matters. Read it in pieces if that stops holding.
      prompt: text.slice(0, maxPromptCharacters),
    })

    return summary.trim() || null
  } catch (error) {
    console.error('sources: summarising failed', error)
    return null
  }
}
