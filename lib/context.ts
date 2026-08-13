import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { chunk, notebook, source } from '@/lib/db/schema'

/**
 * The two steps between the stored sources and the model: fetch the text,
 * then turn it into a prompt.
 *
 * A model cannot read the database. It gets one long string and answers it,
 * so the string has to be built here.
 */

export type ContextChunk = {
  chunkId: string
  sourceId: string
  sourceTitle: string
  text: string
  charStart: number
  charEnd: number
}

/** A chunk as the model sees it. The number is what it cites. */
export type NumberedChunk = ContextChunk & { number: number }

export type BuiltPrompt = {
  system: string
  user: string
  /** Exactly the chunks in the prompt, in the order they appear there. */
  chunks: NumberedChunk[]
  /** Chunks left out because the prompt would otherwise be too long. */
  omitted: number
}

export class NoContextError extends Error {
  constructor() {
    super('A prompt without sources would be answered from general knowledge')
    this.name = 'NoContextError'
  }
}

export const maxPromptCharacters = 120_000

export async function getContextChunks(
  input: { sourceIds: string[]; question: string; ownerId: string },
  db: Database = getDb(),
): Promise<ContextChunk[]> {

  if (input.sourceIds.length === 0) return []

  return db
    .select({
      chunkId: chunk.id,
      sourceId: source.id,
      sourceTitle: source.title,
      text: chunk.text,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    })
    .from(chunk)
    .innerJoin(source, eq(source.id, chunk.sourceId))
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(
      and(
        inArray(source.id, input.sourceIds),
        eq(notebook.ownerId, input.ownerId),
        eq(source.status, 'ready'),
      ),
    )
    .orderBy(asc(source.createdAt), asc(source.id), asc(chunk.index))
}

const rules = `Du bist ein Rechercheassistent. Beantworte die Frage ausschließlich mit den nummerierten Abschnitten, die dir vorliegen.

Regeln:
- Belege jede Aussage mit der Nummer des Abschnitts, aus dem sie stammt, in eckigen Klammern, zum Beispiel [2]. Mehrere Belege werden einzeln gesetzt: [1][3].
- Verwende nur Nummern, die es unten wirklich gibt.
- Steht die Antwort nicht in den Abschnitten, sage das ausdrücklich und rate nicht. Setze in diesem Fall keine Belegnummer, denn es gibt nichts zu belegen.
- Widersprechen sich die Abschnitte, benenne den Widerspruch mit beiden Belegen.
- Antworte auf Deutsch, sachlich und so knapp wie möglich.`

export function buildPrompt(
  question: string,
  chunks: ContextChunk[],
  limits: { maxCharacters: number } = { maxCharacters: maxPromptCharacters },
): BuiltPrompt {
  const asked = question.trim()
  if (!asked) throw new Error('The question is empty')

  // A model without sources answers from what it happens to know
  if (chunks.length === 0) throw new NoContextError()

  const numbered: NumberedChunk[] = []
  let used = 0

  for (const piece of chunks) {
    used += piece.text.length
    if (used > limits.maxCharacters && numbered.length > 0) break
    numbered.push({ ...piece, number: numbered.length + 1 })
  }

  const passages = numbered
    .map((piece) => `[${piece.number}] (${piece.sourceTitle})\n${piece.text}`)
    .join('\n\n')

  return {
    system: rules,
    user: `Abschnitte:\n\n${passages}\n\nFrage: ${asked}`,
    chunks: numbered,
    omitted: chunks.length - numbered.length,
  }
}
