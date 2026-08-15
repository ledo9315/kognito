import type { LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { user } from '@/lib/db/schema'
import { createNotebook } from '@/lib/notebooks'
import { createSource, listSources } from '@/lib/sources'
import { summarize } from '@/lib/summary'

let database: Awaited<ReturnType<typeof createTestDb>>

beforeEach(async () => {
  database = await createTestDb()
})

afterEach(async () => {
  await database.close()
})

/** Answers with the given text, or fails, and records the prompt it saw. */
function mockModel(answer: string | Error) {
  const seen: { prompt: unknown } = { prompt: null }

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen.prompt = options.prompt
      if (answer instanceof Error) throw answer
      return {
        content: [{ type: 'text' as const, text: answer }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })

  return { model: model as unknown as LanguageModel, seen }
}

describe('summarising a source', () => {
  it('returns the sentences the model wrote, without the surrounding space', async () => {
    const { model, seen } = mockModel(
      '  Als Datenbank dient Neon Postgres. Migrationen entstehen mit Drizzle.  ',
    )

    const summary = await summarize('Als Datenbank dient Neon Postgres.', model)

    expect(summary).toBe(
      'Als Datenbank dient Neon Postgres. Migrationen entstehen mit Drizzle.',
    )
    expect(JSON.stringify(seen.prompt)).toContain('Als Datenbank dient Neon Postgres.')
  })

  it('asks nothing when there is no text', async () => {
    const { model, seen } = mockModel('Sollte nie erzeugt werden.')

    expect(await summarize('   ', model)).toBeNull()
    expect(seen.prompt).toBeNull()
  })

  it('answers with nothing when the model is unreachable', async () => {
    const { model } = mockModel(new Error('rate limited'))

    expect(await summarize('Ein Text mit Inhalt.', model)).toBeNull()
  })

  it('answers with nothing when the model returns empty text', async () => {
    const { model } = mockModel('   ')

    expect(await summarize('Ein Text mit Inhalt.', model)).toBeNull()
  })

  it('is stored with the source and comes back in the list', async () => {
    await database.db
      .insert(user)
      .values({ id: 'alice', name: 'alice', email: 'alice@kognito.test' })
    const notebook = await createNotebook('alice', 'Architektur', database.db)

    await createSource(
      {
        notebookId: notebook.id,
        ownerId: 'alice',
        title: 'Architektur',
        kind: 'text',
        text: 'Als Datenbank dient Neon Postgres.',
        summary: 'Die Quelle beschreibt die Wahl der Datenbank.',
      },
      database.db,
    )

    const sources = await listSources(notebook.id, 'alice', database.db)
    expect(sources[0].summary).toBe('Die Quelle beschreibt die Wahl der Datenbank.')
  })

  it('leaves the summary empty when a source is stored without one', async () => {
    await database.db
      .insert(user)
      .values({ id: 'bob', name: 'bob', email: 'bob@kognito.test' })
    const notebook = await createNotebook('bob', 'Notizen', database.db)

    await createSource(
      {
        notebookId: notebook.id,
        ownerId: 'bob',
        title: 'Gedanke',
        kind: 'note',
        text: 'Eine Notiz braucht keine Zusammenfassung.',
      },
      database.db,
    )

    const sources = await listSources(notebook.id, 'bob', database.db)
    expect(sources[0].summary).toBeNull()
  })
})
