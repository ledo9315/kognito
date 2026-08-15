import { z } from 'zod'

/**
 * The shape of a briefing, and nothing that talks to a model or a database.
 *
 * Deliberately free of server imports: the reader renders a briefing field
 * by field and needs the type and the counting, but must not drag the AI SDK
 * into the browser bundle. The generating lives in lib/artifact-generation.ts.
 */

export const Briefing = z.object({
  title: z
    .string()
    .describe('Kurzer Titel des Briefings, höchstens acht Wörter'),
  summary: z
    .string()
    .describe('Zwei bis drei Sätze, die die Quellen zusammenfassen'),
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Überschrift des Abschnitts'),
        points: z
          .array(z.string())
          .min(1)
          .describe('Einzelne Aussagen, je ein vollständiger Satz'),
      }),
    )
    .min(1)
    .describe('Drei bis sechs Abschnitte entlang der Themen der Quellen'),
  openQuestions: z
    .array(z.string())
    .describe('Fragen, die die Quellen aufwerfen, aber nicht beantworten'),
})

export type Briefing = z.infer<typeof Briefing>

export const briefingRules = `Du erstellst ein Briefing-Dokument aus den nummerierten Abschnitten, die dir vorliegen.

Regeln:
- Verwende ausschließlich, was in den Abschnitten steht. Ergänze nichts aus allgemeinem Wissen.
- Gliedere nach Themen, nicht nach Quellen.
- Jeder Punkt ist ein vollständiger, für sich verständlicher Satz.
- Widersprechen sich die Abschnitte, benenne den Widerspruch, statt dich für eine Seite zu entscheiden.
- Offene Fragen sind Fragen, die der Text aufwirft und selbst nicht beantwortet. Gibt es keine, bleibt die Liste leer.
- Schreibe auf Deutsch, sachlich und knapp.`

/**
 * What the studio shows under the title. Counted from the content, so it
 * cannot drift away from what the artifact actually contains.
 */
export function briefingMeta(briefing: Briefing) {
  const points = briefing.sections.reduce(
    (total, section) => total + section.points.length,
    0,
  )

  return [
    `${briefing.sections.length} ${briefing.sections.length === 1 ? 'Abschnitt' : 'Abschnitte'}`,
    `${points} ${points === 1 ? 'Punkt' : 'Punkte'}`,
  ].join(' · ')
}

/**
 * The partial briefings of a large selection into one.
 *
 * In code and not by asking the model to merge: a second pass over the parts
 * would be free to leave a section out, and leaving something out is the
 * failure this whole path exists to prevent.
 *
 * Sections meet again over their heading, which is how two windows about the
 * same topic end up in one place instead of twice in the list.
 */
export function mergeBriefings(parts: Briefing[]): Briefing {
  const sections = new Map<string, string[]>()

  for (const part of parts) {
    for (const section of part.sections) {
      const points = sections.get(section.heading) ?? []
      sections.set(section.heading, [...points, ...section.points])
    }
  }

  return {
    title: parts[0].title,
    // ponytail: the summaries are strung together, so a long selection gets
    // a long paragraph. One more model call would read better and could
    // drop a statement, which is the trade this path refuses everywhere else.
    summary: parts.map((part) => part.summary).join(' '),
    sections: [...sections].map(([heading, points]) => ({
      heading,
      points: [...new Set(points)],
    })),
    openQuestions: [...new Set(parts.flatMap((part) => part.openQuestions))],
  }
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readBriefing(content: unknown): Briefing | null {
  const parsed = Briefing.safeParse(content)
  return parsed.success ? parsed.data : null
}
