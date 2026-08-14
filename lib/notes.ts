import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { note, notebook } from '@/lib/db/schema'

export type NoteRow = typeof note.$inferSelect

/**
 * A note belongs to a notebook, and a notebook belongs to an account. There
 * is no column on `note` that says who owns it, so every query here goes
 * through the notebooks of the account and nothing else.
 */
function ownedNotebooks(ownerId: string, db: Database) {
  return db
    .select({ id: notebook.id })
    .from(notebook)
    .where(eq(notebook.ownerId, ownerId))
}

export function listNotes(
  notebookId: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<NoteRow[]> {
  return db
    .select()
    .from(note)
    .where(
      and(
        eq(note.notebookId, notebookId),
        inArray(note.notebookId, ownedNotebooks(ownerId, db)),
      ),
    )
    .orderBy(desc(note.createdAt))
}

/** Null when the notebook does not exist or belongs to someone else. */
export async function createNote(
  input: { notebookId: string; ownerId: string; title: string; body: string },
  db: Database = getDb(),
): Promise<NoteRow | null> {
  const [owned] = await db
    .select({ id: notebook.id })
    .from(notebook)
    .where(
      and(eq(notebook.id, input.notebookId), eq(notebook.ownerId, input.ownerId)),
    )
    .limit(1)

  if (!owned) return null

  const [row] = await db
    .insert(note)
    .values({
      id: crypto.randomUUID(),
      notebookId: input.notebookId,
      title: input.title,
      body: input.body,
    })
    .returning()

  return row
}

/** False when the note does not exist or belongs to someone else. */
export async function updateNote(
  id: string,
  ownerId: string,
  fields: { title: string; body: string },
  db: Database = getDb(),
) {
  const rows = await db
    .update(note)
    .set(fields)
    .where(
      and(eq(note.id, id), inArray(note.notebookId, ownedNotebooks(ownerId, db))),
    )
    .returning({ id: note.id })

  return rows.length === 1
}

/** False when the note does not exist or belongs to someone else. */
export async function deleteNote(
  id: string,
  ownerId: string,
  db: Database = getDb(),
) {
  const rows = await db
    .delete(note)
    .where(
      and(eq(note.id, id), inArray(note.notebookId, ownedNotebooks(ownerId, db))),
    )
    .returning({ id: note.id })

  return rows.length === 1
}
