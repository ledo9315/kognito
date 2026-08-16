import { z } from 'zod'

/**
 * The shape of a set of flashcards, and nothing that talks to a model or a
 * database.
 *
 * Same split as lib/briefing.ts, lib/faq.ts and lib/timeline.ts: the reader
 * turns the cards in the browser and must not drag the AI SDK into the
 * bundle. The generating lives in lib/artifact-generation.ts.
 */

export const Flashcards = z.object({
  title: z
    .string()
    .describe('Kurzer Titel des Kartensatzes, höchstens acht Wörter'),
  cards: z
    .array(
      z.object({
        front: z
          .string()
          .describe('Die Frage auf der Vorderseite, prüft genau eine Sache'),
        back: z
          .string()
          .describe('Die Antwort auf der Rückseite, ein bis zwei kurze Sätze'),
      }),
    )
    .min(1)
    .describe('Zehn bis zwanzig Karten, vom Grundlegenden zum Speziellen'),
})

export type Flashcards = z.infer<typeof Flashcards>

/**
 * The rules keep this apart from the FAQ, which draws on the same sources
 * and would otherwise produce the same pairs.
 *
 * An FAQ explains to someone reading it for the first time. A card checks
 * whether someone who has read it still knows. That is the difference
 * between an answer of three sentences and one that can be recalled.
 */
export const flashcardsRules = `Du erstellst Lernkarten aus den nummerierten Abschnitten, die dir vorliegen.

Regeln:
- Eine Karte prüft genau eine Sache: einen Begriff, eine Zahl, einen Zusammenhang. Zwei Dinge sind zwei Karten.
- Die Vorderseite ist eine Frage, die man sich selbst stellen kann, ohne den Text daneben zu haben. "Was bedeutet das?" oder "Wozu dient es?" sind ohne den Text keine Fragen.
- Die Rückseite ist so kurz, dass man sie behalten kann: ein bis zwei Sätze, keine Erklärung mit Beispielen.
- Frage nur ab, was zu wissen sich lohnt. Eine Randnotiz gehört auf keine Karte.
- Verwende ausschließlich, was in den Abschnitten steht. Ergänze nichts aus allgemeinem Wissen.
- Beginne mit dem Grundlegenden und arbeite dich zum Speziellen vor.
- Schreibe auf Deutsch, sachlich und knapp.`

/** What the studio shows under the title, counted from the content. */
export function flashcardsMeta(flashcards: Flashcards) {
  const count = flashcards.cards.length
  return `${count} ${count === 1 ? 'Karte' : 'Karten'}`
}

/**
 * The partial sets of a large selection into one, without the card that two
 * windows both wrote. Same reasoning as `mergeFaqs`: joining in code cannot
 * lose a card, a second model pass could.
 */
export function mergeFlashcards(parts: Flashcards[]): Flashcards {
  const asked = new Set<string>()

  const cards = parts
    .flatMap((part) => part.cards)
    .filter((card) => {
      const front = card.front.trim().toLowerCase()
      if (asked.has(front)) return false
      asked.add(front)
      return true
    })

  return { title: parts[0].title, cards }
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readFlashcards(content: unknown): Flashcards | null {
  const parsed = Flashcards.safeParse(content)
  return parsed.success ? parsed.data : null
}
