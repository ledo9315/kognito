import { z } from 'zod'

/**
 * The shape of a timeline. The reader renders the entries in the browser and
 * needs nothing beyond this file. See artifact-kinds.ts.
 */

export const Timeline = z.object({
  title: z.string().describe('Kurzer Titel der Zeitleiste, höchstens acht Wörter'),
  entries: z
    .array(
      z.object({
        when: z
          .string()
          .describe(
            'Die Zeitangabe so, wie sie im Text steht, etwa "Frühjahr 2021" oder "3. Mai 2019"',
          ),
        sortKey: z
          .string()
          .describe(
            'Dieselbe Angabe als 2021, 2021-03 oder 2021-03-15, nur so genau wie der Text sie hergibt. Lässt sie sich nicht in dieser Form schreiben, gehört der Eintrag nicht in die Zeitleiste',
          ),
        event: z
          .string()
          .describe('Was zu diesem Zeitpunkt geschah, ein vollständiger Satz'),
      }),
    )
    // No minimum on purpose. A schema that demands an entry forces a source
    // without dates to invent one, and the model obeys the schema over any
    // rule written in prose.
    .describe(
      'Leer lassen, wenn die Abschnitte keine Zeitangaben enthalten. Ein leeres Ergebnis ist richtig, erfundene Daten sind es nie.',
    ),
})

export type Timeline = z.infer<typeof Timeline>
export type TimelineEntry = Timeline['entries'][number]

export const timelineRules = `Du erstellst eine Zeitleiste aus den nummerierten Abschnitten, die dir vorliegen.

Regeln:
- Nimm nur Ereignisse auf, die der Text auf einen Zeitpunkt legt: ein Jahr, einen Monat, einen Tag. "1685", "im Frühjahr 1950", "am 10. November 2011".
- Eine Dauer ist kein Zeitpunkt. "wenige Sekunden", "mehrere Minuten", "über Jahrhunderte" sagen, wie lange etwas dauert, nicht wann es geschah. Solche Angaben gehören nicht in die Zeitleiste.
- Gib die Zeitangabe wortgetreu wieder. Erfinde keinen Tag und keinen Monat, den der Text nicht nennt.
- Enthalten die Abschnitte keine Zeitangaben, gib eine leere Liste zurück. Das ist eine richtige Antwort, keine Niederlage.
- Relative Angaben wie "drei Jahre später" nur dann, wenn sich daraus mit einer anderen Angabe im Text ein Zeitpunkt ergibt.
- Jedes Ereignis steht für sich und ist ohne die anderen verständlich.
- Schreibe auf Deutsch, sachlich und knapp.`

/** What the studio shows under the title, counted from the content. */
export function timelineMeta(timeline: Timeline) {
  const count = timeline.entries.length
  return `${count} ${count === 1 ? 'Ereignis' : 'Ereignisse'}`
}

/**
 * A key that names a point in time: a year, a month, a day.
 *
 * Kept out of the schema on purpose. A pattern there would make the whole
 * answer invalid and cost retries over a single unusable entry, and the
 * providers do not enforce it reliably anyway. Rules ask, this decides.
 */
const datable = /^\d{4}(-\d{2}(-\d{2})?)?$/

/**
 * Only the entries the text really places in time.
 *
 * A model reads "Zeitangabe" as covering a duration as well, and answers a
 * text about brewing coffee with "mehrere Minuten im Wasser". That is a
 * true sentence and a worthless timeline entry: it has no position, so the
 * order around it means nothing.
 */
export function datedOnly(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry) => datable.test(entry.sortKey))
}

/**
 * Chronological order is decided here, not by the model.
 *
 * The keys are sortable as plain strings because a coarser one is a prefix
 * of a finer one: 2021 sorts before 2021-03, which sorts before 2021-03-15.
 * A model asked to sort cannot be tested against a mock, this can.
 */
export function inTimeOrder(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((left, right) => left.sortKey.localeCompare(right.sortKey))
}

/**
 * The partial timelines of a large selection into one.
 *
 * Order is not decided here. The entries are gathered, the duplicate that
 * two windows both saw is dropped, and `inTimeOrder` sorts the result the
 * same way it sorts a single answer.
 *
 * The same event is the same date and the same sentence. Two events on one
 * date are two entries, which is why the key is both fields and not just
 * the key that sorts.
 */
export function mergeTimelines(parts: Timeline[]): Timeline {
  const seen = new Set<string>()

  const entries = parts
    .flatMap((part) => part.entries)
    .filter((entry) => {
      const key = `${entry.sortKey} ${entry.event.trim().toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return { title: parts[0].title, entries }
}

/**
 * Stored artifacts come back from the database as `unknown` json. Anything
 * that does not match the schema was written by an older version and is
 * skipped rather than rendered half broken.
 */
export function readTimeline(content: unknown): Timeline | null {
  const parsed = Timeline.safeParse(content)
  return parsed.success ? parsed.data : null
}
