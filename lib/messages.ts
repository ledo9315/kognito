import { and, asc, eq } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { message, notebook, type Citation, type MessageRole } from '@/lib/db/schema'

export type MessageRow = typeof message.$inferSelect

/** Owner scoped through the notebook, the same rule as everywhere else. */
export function listMessages(
  notebookId: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<MessageRow[]> {
  return db
    .select({
      id: message.id,
      notebookId: message.notebookId,
      role: message.role,
      content: message.content,
      citations: message.citations,
      createdAt: message.createdAt,
    })
    .from(message)
    .innerJoin(notebook, eq(notebook.id, message.notebookId))
    .where(and(eq(message.notebookId, notebookId), eq(notebook.ownerId, ownerId)))
    .orderBy(asc(message.createdAt))
}

export async function saveMessage(
  input: {
    notebookId: string
    role: MessageRole
    content: string
    citations?: Citation[]
  },
  db: Database = getDb(),
) {
  const [row] = await db
    .insert(message)
    .values({
      id: crypto.randomUUID(),
      notebookId: input.notebookId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? [],
    })
    .returning({ id: message.id })

  return row.id
}

export async function clearMessages(
  notebookId: string,
  ownerId: string,
  db: Database = getDb(),
) {
  const owned = await db
    .select({ id: notebook.id })
    .from(notebook)
    .where(and(eq(notebook.id, notebookId), eq(notebook.ownerId, ownerId)))

  if (owned.length === 0) return false

  await db.delete(message).where(eq(message.notebookId, notebookId))
  return true
}
