import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { maxPromptCharacters, searchResultCount } from '@/lib/config'
import { buildPrompt, getContextChunks, windowPassages } from '@/lib/context'
import { and, eq, isNull } from 'drizzle-orm'
import { createTestDb } from '@/lib/db/test-db'
import { chunk, embeddingSize, user } from '@/lib/db/schema'
import type { Embedder } from '@/lib/embeddings'
import { createNotebook } from '@/lib/notebooks'
import { createSource, listSources } from '@/lib/sources'

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

/**
 * Stands in for the embedding model. A text that contains the marker word
 * points along the first axis, everything else along the second, so "similar"
 * means "mentions the same thing" and the test never goes near a network.
 */
function markerEmbedder(marker: string): Embedder & { calls: number } {
  const embedder = {
    calls: 0,
    ofPassages: async (texts: string[]) => {
      embedder.calls += 1
      return texts.map((text) => axis(text.includes(marker)))
    },
    ofQuestion: async (question: string) => {
      embedder.calls += 1
      return axis(question.includes(marker))
    },
  }
  return embedder
}

function axis(first: boolean) {
  const numbers = new Array<number>(embeddingSize).fill(0)
  numbers[first ? 0 : 1] = 1
  return numbers
}

/** Never embeds anything, because it always fails. */
const brokenEmbedder: Embedder = {
  ofPassages: async () => {
    throw new Error('das Modell ist nicht erreichbar')
  },
  ofQuestion: async () => {
    throw new Error('das Modell ist nicht erreichbar')
  },
}

async function setUp(name: string) {
  await database.db.insert(user).values({ id: name, name, email: `${name}@kognito.test` })
  const notebook = await createNotebook(name, `${name} Notizbuch`, database.db)
  return { ownerId: name, notebookId: notebook.id }
}

const filler = 'Das Gremium tagte, ohne einen Beschluss zu fassen. '

async function withoutEmbedding(sourceId: string) {
  const rows = await database.db
    .select({ id: chunk.id })
    .from(chunk)
    .where(and(eq(chunk.sourceId, sourceId), isNull(chunk.embedding)))
  return rows.length
}

/**
 * Longer than one prompt can hold, with the interesting sentence right at
 * the end. That is the spot the old truncation could never reach.
 */
function tooLongForOnePrompt(needle: string) {
  const body = filler.repeat(
    Math.ceil((maxPromptCharacters * 1.5) / filler.length),
  )
  return `${body}${needle}`
}

describe('choosing how to answer', () => {
  it('sends a small selection whole, without asking the model anything', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Kurz',
        kind: 'text',
        text: `${filler.repeat(20)} Nordlicht startet im März.`,
        embedder,
      },
      database.db,
    )

    const before = embedder.calls
    const chunks = await getContextChunks(
      {
        sourceIds: [created!.id],
        question: 'Wann startet Nordlicht?',
        ownerId,
        embedder,
      },
      database.db,
    )

    expect(chunks).toHaveLength(created!.chunkCount)
    // No search means no embedding of the question, so no cost at all.
    expect(embedder.calls).toBe(before)
  })

  it('searches once the selection no longer fits', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [created!.id],
        question: 'Wann startet Nordlicht?',
        ownerId,
        embedder,
      },
      database.db,
    )

    expect(chunks.length).toBeLessThanOrEqual(searchResultCount)
    expect(chunks.length).toBeLessThan(created!.chunkCount)
    // The passage that mentions it is in there, although it sits at the very
    // back of a text that used to be cut off long before that point.
    expect(chunks.some((piece) => piece.text.includes('Nordlicht'))).toBe(true)
  })

  it('puts a passage into the prompt that truncation never reached', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const question = 'Wann startet Nordlicht?'
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Thesis',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )

    const searched = await getContextChunks(
      { sourceIds: [created!.id], question, ownerId, embedder },
      database.db,
    )
    const withSearch = buildPrompt(question, searched)

    // What the same question produced before: everything, then cut off at
    // the budget. The sentence sits behind the cut, so it never arrived.
    const everything = await getContextChunks(
      { sourceIds: [created!.id], question, ownerId },
      database.db,
    )
    const asBefore = buildPrompt(question, everything)

    expect(withSearch.user).toContain('Nordlicht startet im März.')
    expect(asBefore.user).not.toContain('Nordlicht startet im März.')
    expect(asBefore.omitted).toBeGreaterThan(0)

    // And it is far smaller, which is where the money goes. How much smaller
    // follows from searchResultCount, so this only pins down the direction.
    expect(withSearch.user.length).toBeLessThan(asBefore.user.length / 2)
  })

  it('hands the found passages over in reading order', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [created!.id],
        question: 'Wann startet Nordlicht?',
        ownerId,
        embedder,
      },
      database.db,
    )

    const starts = chunks.map((piece) => piece.charStart)
    expect(starts).toEqual([...starts].sort((left, right) => left - right))
  })
})

describe('sources without embeddings', () => {
  it('are stored anyway when the embedding model fails', async () => {
    const { ownerId, notebookId } = await setUp('alice')

    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Trotzdem da',
        kind: 'text',
        text: `${filler.repeat(20)} Nordlicht startet im März.`,
        embedder: brokenEmbedder,
      },
      database.db,
    )

    expect(created!.chunkCount).toBeGreaterThan(0)
    const [stored] = await listSources(notebookId, ownerId, database.db)
    expect(stored.status).toBe('ready')
  })

  it('get their embeddings the first time a question needs them', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const question = 'Wann startet Nordlicht?'

    // Stored the way everything was stored before embeddings existed.
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Alt und lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
      },
      database.db,
    )

    expect(await withoutEmbedding(created!.id)).toBe(created!.chunkCount)

    const chunks = await getContextChunks(
      { sourceIds: [created!.id], question, ownerId, embedder },
      database.db,
    )

    // Filled in on the way, so this question already gets a search.
    expect(await withoutEmbedding(created!.id)).toBe(0)
    expect(chunks.length).toBeLessThanOrEqual(searchResultCount)
    expect(chunks.some((piece) => piece.text.includes('Nordlicht'))).toBe(true)
  })

  it('are filled in once, not on every question', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const question = 'Wann startet Nordlicht?'
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Alt und lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
      },
      database.db,
    )

    await getContextChunks(
      { sourceIds: [created!.id], question, ownerId, embedder },
      database.db,
    )
    const afterFirst = embedder.calls

    await getContextChunks(
      { sourceIds: [created!.id], question, ownerId, embedder },
      database.db,
    )

    // Only the question itself, no second pass over the passages.
    expect(embedder.calls).toBe(afterFirst + 1)
  })

  it('stay on the whole path when filling them in fails', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Alt und lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
      },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [created!.id],
        question: 'Wann startet Nordlicht?',
        ownerId,
        embedder: brokenEmbedder,
      },
      database.db,
    )

    // All of them, and buildPrompt then decides what still fits. Searching
    // with half the passages missing an embedding would silently drop them.
    expect(chunks).toHaveLength(created!.chunkCount)
  })

  it('are filled in for a mixed selection as well', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')

    const withEmbedding = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Neu',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )
    const without = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Alt',
        kind: 'text',
        text: `${filler.repeat(20)} Etwas anderes.`,
      },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [withEmbedding!.id, without!.id],
        question: 'Wann startet Nordlicht?',
        ownerId,
        embedder,
      },
      database.db,
    )

    expect(await withoutEmbedding(without!.id)).toBe(0)
    expect(chunks.length).toBeLessThanOrEqual(searchResultCount)
  })

  it('are never filled in for another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const embedder = markerEmbedder('Nordlicht')

    const hers = await createSource(
      {
        ...alice,
        title: 'Privat',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
      },
      database.db,
    )
    const his = await createSource(
      {
        ...bob,
        title: 'Bobs Quelle',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht steht auch hier.'),
      },
      database.db,
    )

    // Bob asks with both ids, so the fill would touch her passages too if it
    // did not check the owner.
    await getContextChunks(
      {
        sourceIds: [hers!.id, his!.id],
        question: 'Wann startet Nordlicht?',
        ownerId: bob.ownerId,
        embedder,
      },
      database.db,
    )

    expect(await withoutEmbedding(hers!.id)).toBe(hers!.chunkCount)
    expect(await withoutEmbedding(his!.id)).toBe(0)
  })

  it('take the whole path when no embedder is handed in at all', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const embedder = markerEmbedder('Nordlicht')
    const created = await createSource(
      {
        notebookId,
        ownerId,
        title: 'Lang',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )

    const chunks = await getContextChunks(
      { sourceIds: [created!.id], question: 'Wann startet Nordlicht?', ownerId },
      database.db,
    )

    expect(chunks).toHaveLength(created!.chunkCount)
  })
})

describe('owner scoping still holds when searching', () => {
  it('never returns a passage of another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const embedder = markerEmbedder('Nordlicht')

    const hers = await createSource(
      {
        ...alice,
        title: 'Privat',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht startet im März.'),
        embedder,
      },
      database.db,
    )
    const his = await createSource(
      {
        ...bob,
        title: 'Bobs Quelle',
        kind: 'text',
        text: tooLongForOnePrompt('Nordlicht steht auch hier.'),
        embedder,
      },
      database.db,
    )

    const chunks = await getContextChunks(
      {
        sourceIds: [hers!.id, his!.id],
        question: 'Wann startet Nordlicht?',
        ownerId: bob.ownerId,
        embedder,
      },
      database.db,
    )

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.every((piece) => piece.sourceTitle === 'Bobs Quelle')).toBe(true)
  })
})

describe('cutting a selection into prompts', () => {
  function passage(text: string) {
    return {
      chunkId: crypto.randomUUID(),
      sourceId: 'source',
      sourceTitle: 'Quelle',
      text,
      charStart: 0,
      charEnd: text.length,
    }
  }

  it('leaves a selection that fits in one prompt', () => {
    const windows = windowPassages([passage('Erster.'), passage('Zweiter.')], 100)

    expect(windows).toHaveLength(1)
    expect(windows[0]).toContain('Erster.')
    expect(windows[0]).toContain('Zweiter.')
  })

  it('opens the next prompt instead of dropping a passage', () => {
    const windows = windowPassages(
      [passage('a'.repeat(60)), passage('b'.repeat(60)), passage('c'.repeat(60))],
      100,
    )

    expect(windows).toHaveLength(3)
    expect(windows.join('\n')).toContain('c'.repeat(60))
  })

  it('numbers every prompt from one, because nothing points back at them', () => {
    const windows = windowPassages([passage('a'.repeat(80)), passage('b'.repeat(80))], 100)

    expect(windows).toHaveLength(2)
    expect(windows[0].startsWith('[1] ')).toBe(true)
    expect(windows[1].startsWith('[1] ')).toBe(true)
  })

  it('keeps a passage that is longer than a whole prompt', () => {
    const windows = windowPassages([passage('a'.repeat(300))], 100)

    expect(windows).toHaveLength(1)
    expect(windows[0]).toContain('a'.repeat(300))
  })

  it('has nothing to cut when there is nothing selected', () => {
    expect(windowPassages([], 100)).toEqual([])
  })
})
