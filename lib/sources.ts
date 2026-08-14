import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { chunkText } from '@/lib/chunker'
import { getDb, type Database } from '@/lib/db'
import { chunk, notebook, source, type SourceKind } from '@/lib/db/schema'
import { maxChunksPerSource } from '@/lib/config'
import type { Embedder } from '@/lib/embeddings'

/**
 * Sources hang off a notebook, and a notebook has an owner. Every function
 * here therefore takes the owner as well and joins the notebook to check it,
 * the same rule as in lib/notebooks.ts.
 */

export type SourceRow = typeof source.$inferSelect

export type SourceItem = Pick<
  SourceRow,
  'id' | 'title' | 'kind' | 'status' | 'error' | 'url' | 'content' | 'summary' | 'selected'
>

export function listSources(
  notebookId: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<SourceItem[]> {
  return db
    .select({
      id: source.id,
      title: source.title,
      kind: source.kind,
      status: source.status,
      error: source.error,
      url: source.url,
      content: source.content,
      summary: source.summary,
      selected: source.selected,
    })
    .from(source)
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(and(eq(source.notebookId, notebookId), eq(notebook.ownerId, ownerId)))
    .orderBy(asc(source.createdAt))
}

/**
 * Stores an already extracted text together with its chunks.
 *
 * The text is written as it is handed in. It was normalised once during
 * extraction, and the chunk offsets point into exactly this string.
 */
export async function createSource(
  input: {
    notebookId: string
    ownerId: string
    title: string
    kind: SourceKind
    text: string
    url?: string
    /** Left out means the chunks get no embedding, which is allowed. */
    embedder?: Embedder
  },
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: notebook.id })
    .from(notebook)
    .where(and(eq(notebook.id, input.notebookId), eq(notebook.ownerId, input.ownerId)))

  if (owned.length === 0) return null

  const id = crypto.randomUUID()
  await db.insert(source).values({
    id,
    notebookId: input.notebookId,
    title: input.title,
    kind: input.kind,
    url: input.url,
    content: input.text,
    status: 'ready',
  })

  const pieces = chunkText(input.text).map((piece, index) => ({
    id: crypto.randomUUID(),
    sourceId: id,
    index,
    text: piece.text,
    charStart: piece.charStart,
    charEnd: piece.charEnd,
  }))

  const withMeaning = await embedded(pieces, input.embedder)

  try {
    if (withMeaning.length > 0) await db.insert(chunk).values(withMeaning)
  } catch (error) {
    await db.delete(source).where(eq(source.id, id))
    throw error
  }

  return { id, chunkCount: pieces.length }
}

/**
 * Adds the meaning of each passage, if that is possible right now.
 *
 * A source without embeddings still works: it goes into the prompt whole,
 * the way every source did before this existed. Losing the upload over an
 * unreachable embedding model would be the worse trade, so the failure is
 * logged and swallowed.
 */
async function embedded<T extends { text: string }>(
  pieces: T[],
  embedder?: Embedder,
) {
  if (!embedder || pieces.length === 0) return pieces

  if (pieces.length > maxChunksPerSource) {
    console.warn(
      `sources: ${pieces.length} passages exceed the embedding limit of ${maxChunksPerSource}, storing without`,
    )
    return pieces
  }

  try {
    const embeddings = await embedder.ofPassages(pieces.map((one) => one.text))
    return pieces.map((piece, index) => ({
      ...piece,
      embedding: embeddings[index],
    }))
  } catch (error) {
    console.error('sources: embedding the passages failed', error)
    return pieces
  }
}

/**
 * Adds the missing embeddings of a selection, right when they are needed.
 *
 * Sources stored before embeddings existed, or while the model was
 * unreachable, would otherwise be stuck on the expensive path forever, and
 * the only cure would be deleting and uploading them again. Nobody works
 * that out on their own, so the first question that needs them pays a few
 * seconds and every later one is cheap.
 *
 * Returns whether the selection is now complete.
 */
export async function fillMissingEmbeddings(
  input: { sourceIds: string[]; ownerId: string; embedder: Embedder },
  db: Database = getDb(),
): Promise<boolean> {
  if (input.sourceIds.length === 0) return true

  const missing = await db
    .select({ id: chunk.id, text: chunk.text })
    .from(chunk)
    .innerJoin(source, eq(source.id, chunk.sourceId))
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(
      and(
        inArray(source.id, input.sourceIds),
        eq(notebook.ownerId, input.ownerId),
        isNull(chunk.embedding),
      ),
    )
    .limit(maxChunksPerSource + 1)

  if (missing.length === 0) return true
  if (missing.length > maxChunksPerSource) {
    console.warn(
      `sources: ${missing.length} passages without an embedding exceed the limit of ${maxChunksPerSource}`,
    )
    return false
  }

  try {
    const embeddings = await input.embedder.ofPassages(
      missing.map((one) => one.text),
    )

    // One statement instead of one per passage: a few hundred round trips
    // over http would take longer than the embedding itself.
    const rows = sql.join(
      missing.map(
        (one, index) =>
          sql`(${one.id}::text, ${JSON.stringify(embeddings[index])}::vector)`,
      ),
      sql`, `,
    )

    await db.execute(sql`
      update ${chunk} set embedding = filled.embedding
      from (values ${rows}) as filled(id, embedding)
      where ${chunk.id} = filled.id
    `)

    return true
  } catch (error) {
    console.error('sources: filling in the missing embeddings failed', error)
    return false
  }
}

export async function setSourceSelected(
  id: string,
  ownerId: string,
  selected: boolean,
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: source.id })
    .from(source)
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(and(eq(source.id, id), eq(notebook.ownerId, ownerId)))

  if (owned.length === 0) return false

  await db.update(source).set({ selected }).where(eq(source.id, id))
  return true
}

/** The check mark in the column header, for every source of one notebook. */
export async function setAllSourcesSelected(
  notebookId: string,
  ownerId: string,
  selected: boolean,
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: notebook.id })
    .from(notebook)
    .where(and(eq(notebook.id, notebookId), eq(notebook.ownerId, ownerId)))

  if (owned.length === 0) return false

  await db
    .update(source)
    .set({ selected })
    .where(eq(source.notebookId, notebookId))
  return true
}

/** Returns false when the source does not exist or belongs to someone else. */
export async function deleteSource(
  id: string,
  ownerId: string,
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: source.id })
    .from(source)
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(and(eq(source.id, id), eq(notebook.ownerId, ownerId)))

  if (owned.length === 0) return false

  await db.delete(source).where(eq(source.id, id))
  return true
}
