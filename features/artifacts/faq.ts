import { z } from 'zod'

/**
 * The shape of an FAQ. The reader renders the entries in the browser and
 * needs nothing beyond this file. See artifact-kinds.ts.
 */

export const Faq = z.object({
  title: z.string().describe('Kurzer Titel des FAQ, höchstens acht Wörter'),
  entries: z
    .array(
      z.object({
        question: z
          .string()
          .describe('Eine Frage, die jemand an diese Quellen stellen würde'),
        answer: z
          .string()
          .describe('Die Antwort aus den Abschnitten, ein bis drei Sätze'),
      }),
    )
    .min(1)
    .describe('Fünf bis zehn Paare, von der naheliegendsten Frage abwärts'),
})

export type Faq = z.infer<typeof Faq>

export const faqRules = `Du erstellst ein FAQ aus den nummerierten Abschnitten, die dir vorliegen.

Regeln:
- Stelle nur Fragen, die die Abschnitte auch beantworten. Eine Frage ohne Antwort im Text gehört nicht ins FAQ.
- Antworte ausschließlich aus den Abschnitten. Ergänze nichts aus allgemeinem Wissen.
- Beginne mit der Frage, die jemand zuerst stellen würde, und arbeite dich zu den spezielleren vor.
- Jede Antwort steht für sich und setzt die vorherigen Antworten nicht voraus.
- Widersprechen sich die Abschnitte, benenne den Widerspruch in der Antwort.
- Schreibe auf Deutsch, sachlich und knapp.`

/** What the studio shows under the title, counted from the content. */
export function faqMeta(faq: Faq) {
  return `${faq.entries.length} ${faq.entries.length === 1 ? 'Frage' : 'Fragen'}`
}

/**
 * The partial FAQs of a large selection into one, in the order they were
 * asked, without the question that two windows both thought of.
 *
 * Same reasoning as `mergeBriefings`: joining in code cannot lose an entry,
 * a second model pass could.
 */
export function mergeFaqs(parts: Faq[]): Faq {
  const asked = new Set<string>()

  const entries = parts
    .flatMap((part) => part.entries)
    .filter((entry) => {
      const question = entry.question.trim().toLowerCase()
      if (asked.has(question)) return false
      asked.add(question)
      return true
    })

  return { title: parts[0].title, entries }
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readFaq(content: unknown): Faq | null {
  const parsed = Faq.safeParse(content)
  return parsed.success ? parsed.data : null
}
