import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, notebook, source, user } from '@/lib/db/schema'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

let database: TestDb

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

async function createUser(id: string) {
  await database.db.insert(user).values({ id, name: id, email: `${id}@test.de` })
  return id
}

async function createNotebook(id: string, ownerId: string) {
  await database.db.insert(notebook).values({ id, ownerId, title: id })
  return id
}

describe('owner scoping', () => {
  it('does not return another owner notebook when filtering by owner', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    await createNotebook('alice-notebook', alice)
    await createNotebook('bob-notebook', bob)

    const forAlice = await database.db
      .select()
      .from(notebook)
      .where(eq(notebook.ownerId, alice))

    expect(forAlice.map((row) => row.id)).toEqual(['alice-notebook'])
  })

  it('does not return another owner notebook when fetching it by id', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    await createNotebook('bob-notebook', bob)

    // The direct URL case: knowing the id must not be enough.
    const stolen = await database.db
      .select()
      .from(notebook)
      .where(and(eq(notebook.id, 'bob-notebook'), eq(notebook.ownerId, alice)))

    expect(stolen).toEqual([])
  })
})

describe('cascading deletes', () => {
  it('removes notebooks, sources and chunks when the user goes', async () => {
    const alice = await createUser('alice')
    await createNotebook('alice-notebook', alice)
    await database.db.insert(source).values({
      id: 'source-1',
      notebookId: 'alice-notebook',
      title: 'Report',
      kind: 'pdf',
    })
    await database.db.insert(chunk).values({
      id: 'chunk-1',
      sourceId: 'source-1',
      index: 0,
      text: 'Lorem ipsum',
      charStart: 0,
      charEnd: 11,
    })

    await database.db.delete(user).where(eq(user.id, alice))

    expect(await database.db.select().from(notebook)).toEqual([])
    expect(await database.db.select().from(source)).toEqual([])
    expect(await database.db.select().from(chunk)).toEqual([])
  })
})

describe('constraints', () => {
  it('rejects a notebook without an existing owner', async () => {
    await expect(
      database.db
        .insert(notebook)
        .values({ id: 'orphan', ownerId: 'nobody', title: 'Orphan' }),
    ).rejects.toThrow()
  })

  it('rejects two chunks with the same index in one source', async () => {
    const alice = await createUser('alice')
    await createNotebook('alice-notebook', alice)
    await database.db.insert(source).values({
      id: 'source-1',
      notebookId: 'alice-notebook',
      title: 'Report',
      kind: 'pdf',
    })
    const first = {
      id: 'chunk-1',
      sourceId: 'source-1',
      index: 0,
      text: 'a',
      charStart: 0,
      charEnd: 1,
    }
    await database.db.insert(chunk).values(first)

    await expect(
      database.db.insert(chunk).values({ ...first, id: 'chunk-2' }),
    ).rejects.toThrow()
  })

  it('rejects a duplicate email', async () => {
    await createUser('alice')
    await expect(
      database.db
        .insert(user)
        .values({ id: 'other', name: 'other', email: 'alice@test.de' }),
    ).rejects.toThrow()
  })
})

describe('defaults', () => {
  it('starts a source as selected and processing', async () => {
    const alice = await createUser('alice')
    await createNotebook('alice-notebook', alice)
    await database.db.insert(source).values({
      id: 'source-1',
      notebookId: 'alice-notebook',
      title: 'Report',
      kind: 'pdf',
    })

    const [row] = await database.db.select().from(source)
    expect(row.status).toBe('processing')
    expect(row.selected).toBe(true)
    expect(row.content).toBeNull()
  })
})
