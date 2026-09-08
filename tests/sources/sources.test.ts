import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, user } from '@/lib/db/schema'
import { buildPrompt, getContextChunks } from '@/features/chat/context'
import { createNotebook } from '@/features/notebooks/notebooks'
import {
  createSource,
  deleteSource,
  listSources,
  setAllSourcesSelected,
  setSourceSelected,
} from '@/features/sources/sources'

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

describe('the selection', () => {
  it('is on for a freshly stored source', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    await createSource(
      { notebookId, ownerId, title: 'Neu', kind: 'text', text: 'Text' },
      database.db,
    )

    const [stored] = await listSources(notebookId, ownerId, database.db)
    expect(stored.selected).toBe(true)
  })

  it('survives, because it is written to the database', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const created = await createSource(
      { notebookId, ownerId, title: 'Abgewählt', kind: 'text', text: 'Text' },
      database.db,
    )

    expect(
      await setSourceSelected(created!.id, ownerId, false, database.db),
    ).toBe(true)

    // Read back the way the page reads it, not through the browser state.
    const [stored] = await listSources(notebookId, ownerId, database.db)
    expect(stored.selected).toBe(false)
  })

  it('switches every source of one notebook at once', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    for (const title of ['Eins', 'Zwei', 'Drei']) {
      await createSource(
        { notebookId, ownerId, title, kind: 'text', text: 'Text' },
        database.db,
      )
    }

    expect(
      await setAllSourcesSelected(notebookId, ownerId, false, database.db),
    ).toBe(true)

    const stored = await listSources(notebookId, ownerId, database.db)
    expect(stored.map((one) => one.selected)).toEqual([false, false, false])
  })

  it('leaves the sources of another notebook alone', async () => {
    const alice = await setUp('alice')
    const second = await createNotebook('alice', 'Zweites', database.db)
    await createSource(
      { ...alice, title: 'Hier', kind: 'text', text: 'Text' },
      database.db,
    )
    await createSource(
      {
        notebookId: second.id,
        ownerId: 'alice',
        title: 'Dort',
        kind: 'text',
        text: 'Text',
      },
      database.db,
    )

    await setAllSourcesSelected(alice.notebookId, 'alice', false, database.db)

    const [untouched] = await listSources(second.id, 'alice', database.db)
    expect(untouched.selected).toBe(true)
  })

  it('refuses a source of another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const created = await createSource(
      { ...alice, title: 'Privat', kind: 'text', text: 'Text' },
      database.db,
    )

    expect(
      await setSourceSelected(created!.id, bob.ownerId, false, database.db),
    ).toBe(false)

    const [stored] = await listSources(alice.notebookId, alice.ownerId, database.db)
    expect(stored.selected).toBe(true)
  })

  it('refuses a notebook of another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    await createSource(
      { ...alice, title: 'Privat', kind: 'text', text: 'Text' },
      database.db,
    )

    expect(
      await setAllSourcesSelected(
        alice.notebookId,
        bob.ownerId,
        false,
        database.db,
      ),
    ).toBe(false)

    const [stored] = await listSources(alice.notebookId, alice.ownerId, database.db)
    expect(stored.selected).toBe(true)
  })
})

describe('the selection and the prompt', () => {
  it('keeps a deselected source out of the prompt', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const wanted = await createSource(
      { notebookId, ownerId, title: 'Gewollt', kind: 'text', text: longText },
      database.db,
    )
    const dropped = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Abgewählt',
        kind: 'text',
        text: 'Diese Aussage darf nicht im Prompt landen.',
      },
      database.db,
    )

    await setSourceSelected(dropped!.id, ownerId, false, database.db)

    // Exactly what the chat sends: the sources that are still checked.
    const selected = (await listSources(notebookId, ownerId, database.db))
      .filter((one) => one.selected)
      .map((one) => one.id)

    expect(selected).toEqual([wanted!.id])

    const chunks = await getContextChunks(
      { sourceIds: selected, question: 'Worum geht es?', ownerId },
      database.db,
    )
    const built = buildPrompt('Worum geht es?', chunks)

    expect(built.user).not.toContain('darf nicht im Prompt landen')
    expect(built.user).toContain('Gewollt')
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
