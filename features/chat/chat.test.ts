import { simulateReadableStream, type LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChatError, streamAnswer } from '@/features/chat/chat'
import { createTestDb } from '@/lib/db/test-db'
import { user } from '@/lib/db/schema'
import { listMessages } from '@/features/chat/messages'
import { createNotebook } from '@/features/notebooks/notebooks'
import { createSource } from '@/features/sources/sources'

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

/** Answers with the given words and records the prompt it was handed. */
function mockModel(words: string[]) {
  const seen: { system?: string; prompt: unknown } = { prompt: null }

  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      seen.prompt = options.prompt
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: 'text-1' },
            ...words.map((delta) => ({
              type: 'text-delta' as const,
              id: 'text-1',
              delta,
            })),
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: undefined },
              logprobs: undefined,
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 5, text: 5, reasoning: undefined },
              },
            },
          ],
          chunkDelayInMs: 0,
        }),
      }
    },
  })

  return { model: model as unknown as LanguageModel, seen }
}

async function read(result: { textStream: AsyncIterable<string> }) {
  let text = ''
  for await (const part of result.textStream) text += part
  return text
}

const longText = 'Der Zeitplan ist nicht zu halten, weil die Genehmigung aussteht. '.repeat(20)

async function setUp(name: string) {
  await database.db.insert(user).values({ id: name, name, email: `${name}@kognito.test` })
  const notebook = await createNotebook(name, `${name} Notizbuch`, database.db)
  const source = await createSource(
    {
      notebookId: notebook.id,
      ownerId: name,
      title: 'Protokoll',
      kind: 'text',
      text: longText,
    },
    database.db,
  )
  return { ownerId: name, notebookId: notebook.id, sourceId: source!.id }
}

describe('answering a question', () => {
  it('streams the answer and stores both turns', async () => {
    const { ownerId, notebookId, sourceId } = await setUp('alice')
    const { model } = mockModel(['Der Termin ', 'ist der 17. März [1].'])

    const { result } = await streamAnswer(
      { notebookId, ownerId, question: 'Wann geht es weiter?', sourceIds: [sourceId] },
      { model, db: database.db },
    )

    expect(await read(result)).toBe('Der Termin ist der 17. März [1].')

    const stored = await listMessages(notebookId, ownerId, database.db)
    expect(stored.map((row) => [row.role, row.content])).toEqual([
      ['user', 'Wann geht es weiter?'],
      ['assistant', 'Der Termin ist der 17. März [1].'],
    ])
  })

  it('stores the answer with the passages it cited', async () => {
    const { ownerId, notebookId, sourceId } = await setUp('alice')
    const { model } = mockModel(['Der Termin steht [2], der Rest nicht [99].'])

    const { result, prompt } = await streamAnswer(
      { notebookId, ownerId, question: 'Wann?', sourceIds: [sourceId] },
      { model, db: database.db },
    )
    await read(result)

    const [, answer] = await listMessages(notebookId, ownerId, database.db)
    expect(answer.citations).toHaveLength(1)
    expect(answer.citations[0].index).toBe(2)
    // The number points at the second passage of the prompt, and that is the
    // passage the reader will jump to.
    expect(answer.citations[0].chunkId).toBe(prompt.chunks[1].chunkId)
    expect(answer.citations[0].quote.length).toBeGreaterThan(0)
  })

  it('hands the model the numbered passages and the rules', async () => {
    const { ownerId, notebookId, sourceId } = await setUp('alice')
    const { model, seen } = mockModel(['Antwort'])

    const { result, prompt } = await streamAnswer(
      { notebookId, ownerId, question: 'Worum geht es?', sourceIds: [sourceId] },
      { model, db: database.db },
    )
    await read(result)

    expect(prompt.chunks.length).toBeGreaterThan(0)
    const sent = JSON.stringify(seen.prompt)
    expect(sent).toContain('[1] (Protokoll)')
    expect(sent).toContain('Worum geht es?')
    expect(sent).toContain('ausschließlich')
  })

  it('passes earlier turns along, so a follow-up makes sense', async () => {
    const { ownerId, notebookId, sourceId } = await setUp('alice')
    const { model, seen } = mockModel(['Antwort'])

    const { result } = await streamAnswer(
      {
        notebookId,
        ownerId,
        question: 'Und danach?',
        sourceIds: [sourceId],
        history: [
          { role: 'user', content: 'Wann geht es weiter?' },
          { role: 'assistant', content: 'Am 17. März [1].' },
        ],
      },
      { model, db: database.db },
    )
    await read(result)

    const sent = JSON.stringify(seen.prompt)
    expect(sent).toContain('Wann geht es weiter?')
    expect(sent).toContain('Am 17. März [1].')
  })

  it('stores nothing for the assistant when the model returns nothing', async () => {
    const { ownerId, notebookId, sourceId } = await setUp('alice')
    const { model } = mockModel([])

    const { result } = await streamAnswer(
      { notebookId, ownerId, question: 'Frage?', sourceIds: [sourceId] },
      { model, db: database.db },
    )
    await read(result)

    const stored = await listMessages(notebookId, ownerId, database.db)
    expect(stored.map((row) => row.role)).toEqual(['user'])
  })
})

describe('refusing to answer', () => {
  it('refuses without a selected source', async () => {
    const { ownerId, notebookId } = await setUp('alice')
    const { model } = mockModel(['sollte nie laufen'])

    await expect(
      streamAnswer(
        { notebookId, ownerId, question: 'Frage?', sourceIds: [] },
        { model, db: database.db },
      ),
    ).rejects.toMatchObject({ code: 'no-sources' })

    expect(await listMessages(notebookId, ownerId, database.db)).toEqual([])
  })

  it('refuses when only sources of another account are named', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const { model } = mockModel(['sollte nie laufen'])

    await expect(
      streamAnswer(
        {
          notebookId: bob.notebookId,
          ownerId: bob.ownerId,
          question: 'Was steht in Alices Quelle?',
          sourceIds: [alice.sourceId],
        },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(ChatError)
  })

  it('refuses a notebook of another account', async () => {
    const alice = await setUp('alice')
    const bob = await setUp('bob')
    const { model } = mockModel(['sollte nie laufen'])

    await expect(
      streamAnswer(
        {
          notebookId: alice.notebookId,
          ownerId: bob.ownerId,
          question: 'Frage?',
          sourceIds: [alice.sourceId],
        },
        { model, db: database.db },
      ),
    ).rejects.toMatchObject({ code: 'unknown-notebook' })

    expect(await listMessages(alice.notebookId, alice.ownerId, database.db)).toEqual([])
  })
})
