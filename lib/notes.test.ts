import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, embeddingSize, user } from '@/lib/db/schema'
import type { Embedder } from '@/lib/embeddings'
import { buildPrompt, getContextChunks } from '@/lib/context'
import { createNotebook } from '@/lib/notebooks'
import {
  createSource,
  deleteSource,
  listSources,
  replaceSourceText,
} from '@/lib/sources'

/**
 * A note is a source of kind `note`. These tests cover what is special about
 * it: that it reaches the prompt like any other source, and that editing it
 * rewrites the chunks instead of leaving stale offsets behind.
 */

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

async function setUp(name: string) {
  await database.db
    .insert(user)
    .values({ id: name, name, email: `${name}@kognito.test` })
  const notebook = await createNotebook(name, `${name} Notizbuch`, database.db)
  return { ownerId: name, notebookId: notebook.id }
}

function writeNote(
  where: { notebookId: string; ownerId: string },
  title: string,
  text: string,
) {
  return createSource({ ...where, title, kind: 'note', text }, database.db)
}

/** Points every text along the same axis. Enough to see whether it ran. */
const stubEmbedder: Embedder = {
  ofPassages: async (texts) => texts.map(() => axis()),
  ofQuestion: async () => axis(),
}

function axis() {
  const numbers = new Array<number>(embeddingSize).fill(0)
  numbers[0] = 1
  return numbers
}

const chunksOf = (sourceId: string) =>
  database.db
    .select()
    .from(chunk)
    .where(eq(chunk.sourceId, sourceId))
    .orderBy(asc(chunk.index))

describe('a note as a source', () => {
  it('is stored with its kind and is selected right away', async () => {
    const where = await setUp('alice')

    await writeNote(where, 'Erkenntnis', 'Die Persistenzschicht ist entschieden.')

    const [stored] = await listSources(where.notebookId, where.ownerId, database.db)
    expect(stored.kind).toBe('note')
    expect(stored.status).toBe('ready')
    expect(stored.selected).toBe(true)
  })

  it('answers a question like any other source', async () => {
    const where = await setUp('alice')

    const note = await writeNote(
      where,
      'Erkenntnis',
      'Als Datenbank wurde Neon Postgres gewählt.',
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [note!.id],
        question: 'Welche Datenbank?',
        ownerId: where.ownerId,
      },
      database.db,
    )
    const prompt = buildPrompt('Welche Datenbank?', chunks)

    expect(prompt.user).toContain('Neon Postgres')
    expect(prompt.chunks[0].sourceTitle).toBe('Erkenntnis')
  })
})

describe('editing a note', () => {
  it('replaces title, text and chunks', async () => {
    const where = await setUp('alice')
    const note = await writeNote(where, 'Entwurf', 'Erste Fassung.')
    const before = await chunksOf(note!.id)

    expect(
      await replaceSourceText(
        note!.id,
        where.ownerId,
        { title: 'Endfassung', text: 'Zweite Fassung, deutlich anders.' },
        database.db,
      ),
    ).toBe(true)

    const [stored] = await listSources(where.notebookId, where.ownerId, database.db)
    expect(stored.title).toBe('Endfassung')
    expect(stored.content).toBe('Zweite Fassung, deutlich anders.')

    // The old chunks are gone, not merely joined by new ones. A citation into
    // the first version would otherwise point into text that no longer exists.
    const after = await chunksOf(note!.id)
    expect(after.map((piece) => piece.text)).toEqual([
      'Zweite Fassung, deutlich anders.',
    ])
    expect(after.map((piece) => piece.id)).not.toEqual(
      before.map((piece) => piece.id),
    )
  })

  it('keeps the offsets pointing into the new text', async () => {
    const where = await setUp('alice')
    const note = await writeNote(where, 'Notiz', 'Kurz.')
    const longer = 'Ein Satz, der lang genug ist, um Abschnitte zu füllen. '.repeat(40)

    await replaceSourceText(
      note!.id,
      where.ownerId,
      { title: 'Notiz', text: longer },
      database.db,
    )

    const pieces = await chunksOf(note!.id)
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) {
      expect(longer.slice(piece.charStart, piece.charEnd)).toBe(piece.text)
    }
  })

  it('embeds the new passages, so the note stays searchable', async () => {
    const where = await setUp('alice')
    const note = await createSource(
      {
        ...where,
        title: 'Notiz',
        kind: 'note',
        text: 'Erste Fassung.',
        embedder: stubEmbedder,
      },
      database.db,
    )

    await replaceSourceText(
      note!.id,
      where.ownerId,
      { title: 'Notiz', text: 'Zweite Fassung.', embedder: stubEmbedder },
      database.db,
    )

    // Without this the edited note would sit in a large notebook without a
    // vector, and the search could not reach it until something refilled it.
    for (const piece of await chunksOf(note!.id)) {
      expect(piece.embedding).not.toBeNull()
    }
  })

  it('reaches the next question with the new text', async () => {
    const where = await setUp('alice')
    const note = await writeNote(where, 'Notiz', 'Als Datenbank dient MySQL.')

    await replaceSourceText(
      note!.id,
      where.ownerId,
      { title: 'Notiz', text: 'Als Datenbank dient Neon Postgres.' },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [note!.id],
        question: 'Welche Datenbank?',
        ownerId: where.ownerId,
      },
      database.db,
    )

    expect(chunks.map((piece) => piece.text).join(' ')).toContain('Neon Postgres')
    expect(chunks.map((piece) => piece.text).join(' ')).not.toContain('MySQL')
  })
})

describe('owner scoping', () => {
  it('refuses to write a note into a notebook of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')

    expect(
      await writeNote(
        { notebookId: hers.notebookId, ownerId: 'bob' },
        'Fremd',
        'Text',
      ),
    ).toBeNull()
  })

  it('refuses to edit or delete a note of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const note = await writeNote(hers, 'Privat', 'Erste Fassung.')

    expect(
      await replaceSourceText(
        note!.id,
        'bob',
        { title: 'Gekapert', text: 'Fremder Text.' },
        database.db,
      ),
    ).toBe(false)
    expect(await deleteSource(note!.id, 'bob', database.db)).toBe(false)

    const [stored] = await listSources(hers.notebookId, hers.ownerId, database.db)
    expect(stored.title).toBe('Privat')
    expect(stored.content).toBe('Erste Fassung.')
  })
})
