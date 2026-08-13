import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, user } from '@/lib/db/schema'
import { createNotebook } from '@/lib/notebooks'
import { createSource, deleteSource, listSources } from '@/lib/sources'

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

async function setUp(name: string) {
  await database.db.insert(user).values({ id: name, name, email: `${name}@kognito.test` })
  const notebook = await createNotebook(name, `${name} Notizbuch`, database.db)
  return { ownerId: name, notebookId: notebook.id }
}

const longText = 'Ein Satz, der lang genug ist, um mehrere Abschnitte zu füllen. '.repeat(60)

describe('storing a source', () => {
  it('writes the text and its chunks', async () => {
    const { ownerId, notebookId } = await setUp('alice')

    const created = await createSource(
      { notebookId, ownerId, title: 'Bericht', kind: 'text', text: longText },
      database.db,
    )

    expect(created?.chunkCount).toBeGreaterThan(1)

    const [stored] = await listSources(notebookId, ownerId, database.db)
    expect(stored.title).toBe('Bericht')
    expect(stored.status).toBe('ready')
    expect(stored.content).toBe(longText)
  })

  it('gives every chunk offsets that point into the stored text', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const created = await createSource(
      { notebookId, ownerId, title: 'Bericht', kind: 'text', text: longText },
      database.db,
    )

    const pieces = await database.db
      .select()
      .from(chunk)
      .where(eq(chunk.sourceId, created!.id))

    expect(pieces).toHaveLength(created!.chunkCount)
    for (const piece of pieces) {
      expect(longText.slice(piece.charStart, piece.charEnd)).toBe(piece.text)
    }
  })

  it('numbers the chunks in reading order', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const created = await createSource(
      { notebookId, ownerId, title: 'Bericht', kind: 'text', text: longText },
      database.db,
    )

    const pieces = await database.db
      .select()
      .from(chunk)
      .where(eq(chunk.sourceId, created!.id))

    const byIndex = [...pieces].sort((left, right) => left.index - right.index)
    expect(byIndex.map((piece) => piece.index)).toEqual(
      pieces.map((_, index) => index),
    )
    expect(byIndex[0].charStart).toBe(0)
    expect(byIndex.at(-1)?.charEnd).toBe(longText.length)
  })

  it('keeps a short text as a single chunk', async () => {
    const { ownerId, notebookId } = await setUp('alice')

    const created = await createSource(
      { notebookId, ownerId, title: 'Notiz', kind: 'text', text: 'Kurz.' },
      database.db,
    )

    expect(created?.chunkCount).toBe(1)
  })
})

describe('owner scoping', () => {
  it('refuses to store into a notebook of another owner', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')

    const created = await createSource(
      {
        notebookId: alice.notebookId,
        ownerId: bob.ownerId,
        title: 'Untergeschoben',
        kind: 'text',
        text: 'Text',
      },
      database.db,
    )

    expect(created).toBeNull()
    expect(await listSources(alice.notebookId, alice.ownerId, database.db)).toEqual([])
  })

  it('does not list the sources of another owner', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    await createSource(
      { notebookId: alice.notebookId, ownerId: alice.ownerId, title: 'Privat', kind: 'text', text: 'Text' },
      database.db,
    )

    expect(await listSources(alice.notebookId, bob.ownerId, database.db)).toEqual([])
  })

  it('refuses to delete a source of another owner', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const created = await createSource(
      { notebookId: alice.notebookId, ownerId: alice.ownerId, title: 'Privat', kind: 'text', text: 'Text' },
      database.db,
    )

    expect(await deleteSource(created!.id, bob.ownerId, database.db)).toBe(false)
    expect(await listSources(alice.notebookId, alice.ownerId, database.db)).toHaveLength(1)
  })

  it('deletes the chunks along with the source', async () => {
    const alice = await setUp('alice')
    const created = await createSource(
      { notebookId: alice.notebookId, ownerId: alice.ownerId, title: 'Weg', kind: 'text', text: longText },
      database.db,
    )

    expect(await deleteSource(created!.id, alice.ownerId, database.db)).toBe(true)

    const leftOver = await database.db
      .select()
      .from(chunk)
      .where(eq(chunk.sourceId, created!.id))
    expect(leftOver).toEqual([])
  })
})
