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

/**
 * Whether the string is a single emoji.
 *
 * It may carry a skin tone, a variation selector and further parts joined with
 * a zero width joiner, which is what a family or a profession is made of.
 * Anything else, above all ordinary text, is refused: the value goes straight
 * into a card, where a word would break the layout.
 *
 * ponytail: no flags, those are two regional indicators rather than a
 * pictograph, and no keycaps. Both need their own alternative in the pattern.
 */
export function isEmoji(value: string) {
  return /^\p{Extended_Pictographic}(\p{Emoji_Modifier}|\uFE0F|\u200D\p{Extended_Pictographic})*$/u.test(
    value,
  )
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
  /** Behind the database on purpose: twenty callers pass one, none pass the
   *  other, and the column has a default. */
  emoji?: string,
) {
  const [row] = await db
    .insert(notebook)
    .values({ id: crypto.randomUUID(), ownerId, title, emoji })
    .returning()

  return row
}

/** Returns false when the notebook does not exist or belongs to someone else. */
export async function updateNotebook(
  id: string,
  ownerId: string,
  values: { title: string; emoji: string },
  db: Database = getDb(),
) {
  const rows = await db
    .update(notebook)
    .set(values)
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
