import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, message, notebook, source, user } from '@/lib/db/schema'
import {
  createNotebook,
  deleteNotebook,
  findNotebook,
  listNotebooks,
  renameNotebook,
} from '@/lib/notebooks'
import { saveMessage } from '@/lib/messages'
import { createSource } from '@/lib/sources'

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

async function createUser(id: string) {
  await database.db
    .insert(user)
    .values({ id, name: id, email: `${id}@kognito.test` })
  return id
}

describe('owner scoping', () => {
  it('lists only the notebooks of the given owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    await createNotebook(alice, 'Alice Recherche', database.db)
    await createNotebook(bob, 'Bob Recherche', database.db)

    const forAlice = await listNotebooks(alice, database.db)

    expect(forAlice.map((row) => row.title)).toEqual(['Alice Recherche'])
  })

  it('does not find a notebook of another owner by its id', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const notebookOfAlice = await createNotebook(alice, 'Privat', database.db)

    expect(await findNotebook(notebookOfAlice.id, bob, database.db)).toBeNull()
    expect(await findNotebook(notebookOfAlice.id, alice, database.db)).not.toBeNull()
  })

  it('refuses to rename or delete a notebook of another owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const notebookOfAlice = await createNotebook(alice, 'Privat', database.db)

    expect(await renameNotebook(notebookOfAlice.id, bob, 'Gekapert', database.db)).toBe(false)
    expect(await deleteNotebook(notebookOfAlice.id, bob, database.db)).toBe(false)

    const stillThere = await findNotebook(notebookOfAlice.id, alice, database.db)
    expect(stillThere?.title).toBe('Privat')
  })

  it('renames and deletes for the actual owner', async () => {
    const alice = await createUser('alice')
    const notebookOfAlice = await createNotebook(alice, 'Entwurf', database.db)

    expect(await renameNotebook(notebookOfAlice.id, alice, 'Endfassung', database.db)).toBe(true)
    expect((await findNotebook(notebookOfAlice.id, alice, database.db))?.title).toBe('Endfassung')

    expect(await deleteNotebook(notebookOfAlice.id, alice, database.db)).toBe(true)
    expect(await findNotebook(notebookOfAlice.id, alice, database.db)).toBeNull()
  })
})

describe('deleting a notebook', () => {
  it('takes sources, chunks and messages with it', async () => {
    const ownerId = await createUser('alice')
    const created = await createNotebook(ownerId, 'Weg damit', database.db)

    const stored = await createSource(
      {
        notebookId: created.id,
        ownerId,
        title: 'Bericht',
        kind: 'text',
        text: 'Ein Satz, der lang genug ist, um Abschnitte zu füllen. '.repeat(40),
      },
      database.db,
    )
    await saveMessage(
      { notebookId: created.id, role: 'user', content: 'Eine Frage?' },
      database.db,
    )

    expect(stored!.chunkCount).toBeGreaterThan(1)

    expect(await deleteNotebook(created.id, ownerId, database.db)).toBe(true)

    // The cascade sits on the foreign keys, so nothing here deletes the
    // children by hand. This test is what proves it actually fires.
    expect(await database.db.select().from(source)).toEqual([])
    expect(await database.db.select().from(chunk)).toEqual([])
    expect(await database.db.select().from(message)).toEqual([])
  })

  it('leaves the notebooks of another account untouched', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const hers = await createNotebook(alice, 'Ihres', database.db)
    const his = await createNotebook(bob, 'Seins', database.db)

    await createSource(
      {
        notebookId: his.id,
        ownerId: bob,
        title: 'Bobs Quelle',
        kind: 'text',
        text: 'Text',
      },
      database.db,
    )

    await deleteNotebook(hers.id, alice, database.db)

    expect(await database.db.select().from(source)).toHaveLength(1)
    expect(await findNotebook(his.id, bob, database.db)).not.toBeNull()
  })
})

describe('the overview list', () => {
  it('counts the sources of each notebook', async () => {
    const alice = await createUser('alice')
    const withSources = await createNotebook(alice, 'Mit Quellen', database.db)
    await createNotebook(alice, 'Leer', database.db)

    await database.db.insert(source).values([
      { id: 'source-1', notebookId: withSources.id, title: 'Eins', kind: 'text' },
      { id: 'source-2', notebookId: withSources.id, title: 'Zwei', kind: 'text' },
    ])

    const rows = await listNotebooks(alice, database.db)
    const counts = Object.fromEntries(rows.map((row) => [row.title, row.sourceCount]))

    expect(counts).toEqual({ 'Mit Quellen': 2, Leer: 0 })
  })

  it('puts the most recently changed notebook first', async () => {
    const alice = await createUser('alice')
    // Written directly, because two inserts in the same test share a timestamp
    // down to the microsecond often enough to make the assertion flaky.
    await database.db.insert(notebook).values([
      { id: 'older', ownerId: alice, title: 'Älter', updatedAt: new Date('2026-01-01') },
      { id: 'newer', ownerId: alice, title: 'Neuer', updatedAt: new Date('2026-06-01') },
    ])

    const rows = await listNotebooks(alice, database.db)

    expect(rows.map((row) => row.id)).toEqual(['newer', 'older'])
  })
})
