import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db'
import { artifact, notebook, type ArtifactKind } from '@/lib/db/schema'

/**
 * Artifacts hang off a notebook, and a notebook has an owner. Same rule as
 * everywhere else: the owner is checked through the notebook, never trusted
 * from the caller.
 */

export type ArtifactRow = typeof artifact.$inferSelect

function ownedNotebooks(ownerId: string, db: Database) {
  return db
    .select({ id: notebook.id })
    .from(notebook)
    .where(eq(notebook.ownerId, ownerId))
}

export function listArtifacts(
  notebookId: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<ArtifactRow[]> {
  return db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.notebookId, notebookId),
        inArray(artifact.notebookId, ownedNotebooks(ownerId, db)),
      ),
    )
    .orderBy(desc(artifact.createdAt))
}

/** Null when the notebook does not exist or belongs to someone else. */
export async function createArtifact(
  input: {
    notebookId: string
    ownerId: string
    kind: ArtifactKind
    title: string
    content: unknown
  },
  db: Database = getDb(),
): Promise<ArtifactRow | null> {
  const [owned] = await db
    .select({ id: notebook.id })
    .from(notebook)
    .where(
      and(eq(notebook.id, input.notebookId), eq(notebook.ownerId, input.ownerId)),
    )
    .limit(1)

  if (!owned) return null

  const [row] = await db
    .insert(artifact)
    .values({
      id: crypto.randomUUID(),
      notebookId: input.notebookId,
      kind: input.kind,
      title: input.title,
      content: input.content,
    })
    .returning()

  return row
}

/** Null when the artifact does not exist or belongs to someone else. */
export async function findArtifact(
  id: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<ArtifactRow | null> {
  const [row] = await db
    .select()
    .from(artifact)
    .where(
      and(
        eq(artifact.id, id),
        inArray(artifact.notebookId, ownedNotebooks(ownerId, db)),
      ),
    )
    .limit(1)

  return row ?? null
}

/**
 * The deleted row, or null when the artifact does not exist or belongs to
 * someone else. The row comes back because an audio overview leaves files
 * behind that only its content still names.
 */
export async function deleteArtifact(
  id: string,
  ownerId: string,
  db: Database = getDb(),
): Promise<ArtifactRow | null> {
  const rows = await db
    .delete(artifact)
    .where(
      and(
        eq(artifact.id, id),
        inArray(artifact.notebookId, ownedNotebooks(ownerId, db)),
      ),
    )
    .returning()

  return rows[0] ?? null
}
