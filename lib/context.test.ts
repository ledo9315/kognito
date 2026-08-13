import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, user } from '@/lib/db/schema'
import { createNotebook } from '@/lib/notebooks'
import { createSource } from '@/lib/sources'
import {
  buildPrompt,
  getContextChunks,
  NoContextError,
  type ContextChunk,
} from '@/lib/context'

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

/** Long enough to become several chunks. */
function longText(subject: string) {
  return `${subject}: Ein Satz, der lang genug ist, um mehrere Abschnitte zu füllen. `.repeat(40)
}

async function addSource(
  where: { ownerId: string; notebookId: string },
  title: string,
  text: string,
) {
  const created = await createSource(
    { ...where, title, kind: 'text', text },
    database.db,
  )
  return created!.id
}

describe('loading the context', () => {
  it('loads only the sources that were asked for', async () => {
    const alice = await setUp('alice')
    const wanted = await addSource(alice, 'Gewollt', longText('Gewollt'))
    await addSource(alice, 'Nicht gewollt', longText('Ungewollt'))

    const chunks = await getContextChunks(
      { sourceIds: [wanted], question: 'Worum geht es?', ownerId: alice.ownerId },
      database.db,
    )

    expect(chunks.length).toBeGreaterThan(1)
    expect(new Set(chunks.map((piece) => piece.sourceTitle))).toEqual(
      new Set(['Gewollt']),
    )
  })

  it('ignores a source id that belongs to another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const ofAlice = await addSource(alice, 'Privat', longText('Privat'))
    const ofBob = await addSource(bob, 'Bobs Quelle', longText('Bob'))

    // Bob asks for both, and gets only his own.
    const chunks = await getContextChunks(
      { sourceIds: [ofAlice, ofBob], question: 'Was steht drin?', ownerId: bob.ownerId },
      database.db,
    )

    expect(new Set(chunks.map((piece) => piece.sourceTitle))).toEqual(
      new Set(['Bobs Quelle']),
    )
  })

  it('returns nothing when nothing is selected', async () => {
    const alice = await setUp('alice')
    await addSource(alice, 'Da', longText('Da'))

    expect(
      await getContextChunks(
        { sourceIds: [], question: 'Frage', ownerId: alice.ownerId },
        database.db,
      ),
    ).toEqual([])
  })

  it('keeps the passages of a source in reading order', async () => {
    const alice = await setUp('alice')
    const sourceId = await addSource(alice, 'Kurz', 'Erster Abschnitt.')

    // Written back to front on purpose. Reading them in the order the table
    // happens to hold them would hand back 3, 2, 1.
    for (const index of [3, 2, 1]) {
      await database.db.insert(chunk).values({
        id: `chunk-${index}`,
        sourceId,
        index,
        text: `Abschnitt ${index}.`,
        charStart: index * 100,
        charEnd: index * 100 + 14,
      })
    }

    const chunks = await getContextChunks(
      { sourceIds: [sourceId], question: 'Frage', ownerId: alice.ownerId },
      database.db,
    )

    const starts = chunks.map((piece) => piece.charStart)
    expect(starts).toEqual([...starts].sort((left, right) => left - right))
    expect(starts[0]).toBe(0)
    expect(chunks.at(-1)?.text).toBe('Abschnitt 3.')
  })

  it('orders the same sources the same way on every call', async () => {
    const alice = await setUp('alice')
    const first = await addSource(alice, 'Erste', longText('Erste'))
    const second = await addSource(alice, 'Zweite', longText('Zweite'))

    const once = await getContextChunks(
      { sourceIds: [first, second], question: 'Frage', ownerId: alice.ownerId },
      database.db,
    )
    // Asked for in the other order, which must not change the result.
    const again = await getContextChunks(
      { sourceIds: [second, first], question: 'Frage', ownerId: alice.ownerId },
      database.db,
    )

    expect(again.map((piece) => piece.chunkId)).toEqual(
      once.map((piece) => piece.chunkId),
    )
  })
})

/* -------------------------------------------------------------------------- */

function chunkOf(number: number, text: string, title = 'Quelle'): ContextChunk {
  return {
    chunkId: `chunk-${number}`,
    sourceId: 'source-1',
    sourceTitle: title,
    text,
    charStart: number * 100,
    charEnd: number * 100 + text.length,
  }
}

describe('building the prompt', () => {
  it('numbers the passages without a gap, starting at one', () => {
    const built = buildPrompt('Wann geht es weiter?', [
      chunkOf(0, 'Der Zeitplan ist nicht zu halten.'),
      chunkOf(1, 'Nächster Termin ist der 17. März.'),
      chunkOf(2, 'Die Pumpen kommen später.'),
    ])

    expect(built.chunks.map((piece) => piece.number)).toEqual([1, 2, 3])
    expect(built.user).toContain('[1] (Quelle)\nDer Zeitplan ist nicht zu halten.')
    expect(built.user).toContain('[2] (Quelle)\nNächster Termin ist der 17. März.')
    expect(built.omitted).toBe(0)
  })

  it('puts the question in and tells the model to cite by number', () => {
    const built = buildPrompt('Wann geht es weiter?', [chunkOf(0, 'Am 17. März.')])

    expect(built.user).toContain('Frage: Wann geht es weiter?')
    expect(built.system).toContain('ausschließlich')
    expect(built.system).toContain('[2]')
  })

  it('refuses to build a prompt without sources', () => {
    expect(() => buildPrompt('Und jetzt?', [])).toThrow(NoContextError)
  })

  it('refuses an empty question', () => {
    expect(() => buildPrompt('   ', [chunkOf(0, 'Text')])).toThrow()
  })

  it('drops passages beyond the limit and says how many', () => {
    const chunks = Array.from({ length: 5 }, (_, index) =>
      chunkOf(index, 'x'.repeat(100)),
    )

    const built = buildPrompt('Frage?', chunks, { maxCharacters: 250 })

    expect(built.chunks.map((piece) => piece.number)).toEqual([1, 2])
    expect(built.omitted).toBe(3)
    expect(built.user).not.toContain('[3]')
  })

  it('keeps one passage even when it exceeds the limit on its own', () => {
    const built = buildPrompt('Frage?', [chunkOf(0, 'x'.repeat(500))], {
      maxCharacters: 100,
    })

    expect(built.chunks).toHaveLength(1)
    expect(built.omitted).toBe(0)
  })
})
