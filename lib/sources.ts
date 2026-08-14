import { and, asc, eq } from 'drizzle-orm'
import { chunkText } from '@/lib/chunker'
import { getDb, type Database } from '@/lib/db'
import { chunk, notebook, source, type SourceKind } from '@/lib/db/schema'

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

  try {
    if (pieces.length > 0) await db.insert(chunk).values(pieces)
  } catch (error) {
    await db.delete(source).where(eq(source.id, id))
    throw error
  }

  return { id, chunkCount: pieces.length }
}

/**
 * Replaces the text of a source and cuts it again.
 *
 * The chunks carry offsets into `content`, so leaving the old ones in place
 * would point citations at positions that no longer exist. They are deleted
 * and written anew, which is also why this is not a plain update.
 *
 * Returns false when the source does not exist or belongs to someone else.
 */
export async function replaceSourceText(
  id: string,
  ownerId: string,
  fields: { title: string; text: string },
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: source.id })
    .from(source)
    .innerJoin(notebook, eq(notebook.id, source.notebookId))
    .where(and(eq(source.id, id), eq(notebook.ownerId, ownerId)))

  if (owned.length === 0) return false

  await db
    .update(source)
    .set({ title: fields.title, content: fields.text })
    .where(eq(source.id, id))

  await db.delete(chunk).where(eq(chunk.sourceId, id))

  const pieces = chunkText(fields.text).map((piece, index) => ({
    id: crypto.randomUUID(),
    sourceId: id,
    index,
    text: piece.text,
    charStart: piece.charStart,
    charEnd: piece.charEnd,
  }))

  if (pieces.length > 0) await db.insert(chunk).values(pieces)

  return true
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
