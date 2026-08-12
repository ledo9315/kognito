import { and, desc, eq } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { notebook, source } from '@/lib/db/schema'

export type NotebookSummary = Awaited<ReturnType<typeof listNotebooks>>[number]
export type NotebookRow = typeof notebook.$inferSelect

export function listNotebooks(ownerId: string, db: Database = getDb()) {
  return db
    .select({
      id: notebook.id,
      title: notebook.title,
      emoji: notebook.emoji,
      updatedAt: notebook.updatedAt,
      sourceCount: db.$count(source, eq(source.notebookId, notebook.id)),
    })
    .from(notebook)
    .where(eq(notebook.ownerId, ownerId))
    .orderBy(desc(notebook.updatedAt))
}

export async function findNotebook(
  id: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<NotebookRow | null> {
  const [row] = await db
    .select()
    .from(notebook)
    .where(and(eq(notebook.id, id), eq(notebook.ownerId, ownerId)))
    .limit(1)

  return row ?? null
}

export async function createNotebook(
  ownerId: string,
  title: string,
  db: Database = getDb(),
) {
  const [row] = await db
    .insert(notebook)
    .values({ id: crypto.randomUUID(), ownerId, title })
    .returning()

  return row
}

/** Returns false when the notebook does not exist or belongs to someone else. */
export async function renameNotebook(
  id: string,
  ownerId: string,
  title: string,
  db: Database = getDb(),
) {
  const rows = await db
    .update(notebook)
    .set({ title })
    .where(and(eq(notebook.id, id), eq(notebook.ownerId, ownerId)))
    .returning({ id: notebook.id })

  return rows.length === 1
}

/** Returns false when the notebook does not exist or belongs to someone else. */
export async function deleteNotebook(
  id: string,
  ownerId: string,
  db: Database = getDb(),
) {
  const rows = await db
    .delete(notebook)
    .where(and(eq(notebook.id, id), eq(notebook.ownerId, ownerId)))
    .returning({ id: notebook.id })

  return rows.length === 1
}
