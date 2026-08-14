import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { note, user } from '@/lib/db/schema'
import { createNotebook, deleteNotebook } from '@/lib/notebooks'
import { createNote, deleteNote, listNotes, updateNote } from '@/lib/notes'

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
  it('lists only the notes of a notebook of the given owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const hers = await createNotebook(alice, 'Ihres', database.db)
    const his = await createNotebook(bob, 'Seins', database.db)

    await createNote(
      { notebookId: hers.id, ownerId: alice, title: 'Ihre Notiz', body: 'Text' },
      database.db,
    )
    await createNote(
      { notebookId: his.id, ownerId: bob, title: 'Seine Notiz', body: 'Text' },
      database.db,
    )

    expect(
      (await listNotes(hers.id, alice, database.db)).map((row) => row.title),
    ).toEqual(['Ihre Notiz'])
    expect(await listNotes(hers.id, bob, database.db)).toEqual([])
  })

  it('refuses to write a note into a notebook of another owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const hers = await createNotebook(alice, 'Ihres', database.db)

    expect(
      await createNote(
        { notebookId: hers.id, ownerId: bob, title: 'Fremd', body: 'Text' },
        database.db,
      ),
    ).toBeNull()
    expect(await database.db.select().from(note)).toEqual([])
  })

  it('refuses to edit or delete a note of another owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const hers = await createNotebook(alice, 'Ihres', database.db)
    const stored = await createNote(
      { notebookId: hers.id, ownerId: alice, title: 'Privat', body: 'Text' },
      database.db,
    )

    expect(
      await updateNote(
        stored!.id,
        bob,
        { title: 'Gekapert', body: 'Text' },
        database.db,
      ),
    ).toBe(false)
    expect(await deleteNote(stored!.id, bob, database.db)).toBe(false)

    const stillThere = await listNotes(hers.id, alice, database.db)
    expect(stillThere.map((row) => row.title)).toEqual(['Privat'])
  })
})

describe('writing notes', () => {
  it('creates, edits and deletes for the actual owner', async () => {
    const alice = await createUser('alice')
    const hers = await createNotebook(alice, 'Ihres', database.db)

    const stored = await createNote(
      { notebookId: hers.id, ownerId: alice, title: 'Entwurf', body: 'Erste Fassung' },
      database.db,
    )
    expect(stored).not.toBeNull()

    expect(
      await updateNote(
        stored!.id,
        alice,
        { title: 'Endfassung', body: 'Zweite Fassung' },
        database.db,
      ),
    ).toBe(true)

    const [edited] = await listNotes(hers.id, alice, database.db)
    expect(edited.title).toBe('Endfassung')
    expect(edited.body).toBe('Zweite Fassung')

    expect(await deleteNote(stored!.id, alice, database.db)).toBe(true)
    expect(await listNotes(hers.id, alice, database.db)).toEqual([])
  })

  it('puts the newest note first', async () => {
    const alice = await createUser('alice')
    const hers = await createNotebook(alice, 'Ihres', database.db)

    // Written directly, because two inserts in the same test share a
    // timestamp down to the microsecond often enough to make this flaky.
    await database.db.insert(note).values([
      {
        id: 'older',
        notebookId: hers.id,
        title: 'Älter',
        body: 'Text',
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'newer',
        notebookId: hers.id,
        title: 'Neuer',
        body: 'Text',
        createdAt: new Date('2026-06-01'),
      },
    ])

    expect(
      (await listNotes(hers.id, alice, database.db)).map((row) => row.id),
    ).toEqual(['newer', 'older'])
  })

  it('goes away with the notebook it belongs to', async () => {
    const alice = await createUser('alice')
    const hers = await createNotebook(alice, 'Weg damit', database.db)
    await createNote(
      { notebookId: hers.id, ownerId: alice, title: 'Notiz', body: 'Text' },
      database.db,
    )

    await deleteNotebook(hers.id, alice, database.db)

    expect(await database.db.select().from(note)).toEqual([])
  })
})
