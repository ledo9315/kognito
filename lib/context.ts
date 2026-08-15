import { and, asc, cosineDistance, eq, inArray, sql } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { chunk, notebook, source } from '@/lib/db/schema'
import { maxPromptCharacters, searchResultCount } from '@/lib/config'
import type { Embedder } from '@/lib/embeddings'
import { fillMissingEmbeddings } from '@/lib/sources'

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

const columns = {
  chunkId: chunk.id,
  sourceId: source.id,
  sourceTitle: source.title,
  text: chunk.text,
  charStart: chunk.charStart,
  charEnd: chunk.charEnd,
}

function selected(input: { sourceIds: string[]; ownerId: string }) {
  return and(
    inArray(source.id, input.sourceIds),
    eq(notebook.ownerId, input.ownerId),
    eq(source.status, 'ready'),
  )
}

export async function getContextChunks(
  input: {
    sourceIds: string[]
    question: string
    ownerId: string
    embedder?: Embedder
  },
  db: Database = getDb(),
): Promise<ContextChunk[]> {

  if (input.sourceIds.length === 0) return []

  const [size] = await db
    .select({
      characters: sql<number>`coalesce(sum(length(${chunk.text})), 0)`,
      withoutEmbedding: sql<number>`count(*) filter (where ${chunk.embedding} is null)`,
    })
    .from(chunk)
    .innerJoin(source, eq(source.id, chunk.sourceId))
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(selected(input))

  if (Number(size?.characters ?? 0) <= maxPromptCharacters) {
    return inReadingOrder(input, db)
  }

  if (!input.embedder) return inReadingOrder(input, db)

  // is true if all sources have embeddings, or if the missing ones were filled
  // is false if error, api-error, to many chunks
  const complete =
    Number(size?.withoutEmbedding ?? 0) === 0 ||
    (await fillMissingEmbeddings(
      { sourceIds: input.sourceIds, ownerId: input.ownerId, embedder: input.embedder },
      db,
    ))

  if (!complete) return inReadingOrder(input, db)

  return bySimilarity(input, db)
}

function inReadingOrder(
  input: { sourceIds: string[]; ownerId: string },
  db: Database,
): Promise<ContextChunk[]> {
  return db
    .select(columns)
    .from(chunk)
    .innerJoin(source, eq(source.id, chunk.sourceId))
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(selected(input))
    .orderBy(asc(source.createdAt), asc(source.id), asc(chunk.index))
}

async function bySimilarity(
  input: { sourceIds: string[]; ownerId: string; question: string; embedder?: Embedder },
  db: Database,
): Promise<ContextChunk[]> {
  const asked = await input.embedder!.ofQuestion(input.question)

  const found = await db
    .select({ ...columns, index: chunk.index, createdAt: source.createdAt })
    .from(chunk)
    .innerJoin(source, eq(source.id, chunk.sourceId))
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(selected(input))
    .orderBy(cosineDistance(chunk.embedding, asked))
    .limit(searchResultCount)

  // Found by similarity, handed over in reading order: passages of one source
  // in the order they were written read as a text, not as a pile of hits.
  found.sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.sourceId.localeCompare(right.sourceId) ||
      left.index - right.index,
  )

  return found.map((piece) => ({
    chunkId: piece.chunkId,
    sourceId: piece.sourceId,
    sourceTitle: piece.sourceTitle,
    text: piece.text,
    charStart: piece.charStart,
    charEnd: piece.charEnd,
  }))
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

  const { passages, numbered } = numberPassages(chunks, limits.maxCharacters)

  return {
    system: rules,
    user: `Abschnitte:\n\n${passages}\n\nFrage: ${asked}`,
    chunks: numbered,
    omitted: chunks.length - numbered.length,
  }
}

/**
 * The passages as the model reads them, numbered and cut off at the limit.
 *
 * Shared by the chat and by the studio artifacts, because both hand the same
 * text to a model and both have to stop at the same length. Only the
 * instructions around it differ.
 */
export function numberPassages(chunks: ContextChunk[], maxCharacters: number) {
  const numbered: NumberedChunk[] = []
  let used = 0

  for (const piece of chunks) {
    used += piece.text.length
    if (used > maxCharacters && numbered.length > 0) break
    numbered.push({ ...piece, number: numbered.length + 1 })
  }

  const passages = numbered
    .map((piece) => `[${piece.number}] (${piece.sourceTitle})\n${piece.text}`)
    .join('\n\n')

  return { passages, numbered, omitted: chunks.length - numbered.length }
}
