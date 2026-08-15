import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModel } from 'ai'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateBriefing, generateFaq, NoSourcesError } from '@/lib/artifact-generation'
import { artifactMeta } from '@/lib/artifact-kinds'
import { createArtifact, deleteArtifact, listArtifacts } from '@/lib/artifacts'
import { Briefing, briefingMeta, readBriefing } from '@/lib/briefing'
import { Faq, faqMeta, readFaq } from '@/lib/faq'
import { createTestDb } from '@/lib/db/test-db'
import { user } from '@/lib/db/schema'
import { createNotebook } from '@/lib/notebooks'
import { createSource } from '@/lib/sources'

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

const briefing = {
  title: 'Entscheidungen zur Architektur',
  summary: 'Die Quellen beschreiben die Wahl der Datenbank und offene Punkte.',
  sections: [
    {
      heading: 'Persistenz',
      points: ['Als Datenbank dient Neon Postgres.', 'Der Betrieb ist serverless.'],
    },
    { heading: 'Migrationen', points: ['Migrationen entstehen mit Drizzle.'] },
  ],
  openQuestions: ['Wird pgvector direkt mitgenutzt?'],
}

const faq = {
  title: 'Fragen zur Architektur',
  entries: [
    {
      question: 'Welche Datenbank kommt zum Einsatz?',
      answer: 'Als Datenbank dient Neon Postgres.',
    },
    {
      question: 'Wie entstehen Migrationen?',
      answer: 'Migrationen entstehen mit Drizzle.',
    },
  ],
}

/** Answers with the given object and records the prompt it was handed. */
function mockModel(object: unknown) {
  const seen: { system?: string; prompt: unknown } = { prompt: null }

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen.prompt = options.prompt
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(object) }],
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

function textOf(prompt: unknown) {
  return JSON.stringify(prompt)
}

describe('generating a briefing', () => {
  it('returns an object that matches the schema', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Architektur',
        kind: 'text',
        text: 'Als Datenbank dient Neon Postgres. Migrationen entstehen mit Drizzle.',
      },
      database.db,
    )
    const { model } = mockModel(briefing)

    const generated = await generateBriefing(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(Briefing.safeParse(generated).success).toBe(true)
    expect(generated.sections).toHaveLength(2)
  })

  it('hands the model the text of the selected sources', async () => {
    const where = await setUp('alice')
    const wanted = await createSource(
      { ...where, title: 'Gewählt', kind: 'text', text: 'Die Persistenz ist entschieden.' },
      database.db,
    )
    await createSource(
      { ...where, title: 'Nicht gewählt', kind: 'text', text: 'Ein ganz anderes Thema.' },
      database.db,
    )
    const { model, seen } = mockModel(briefing)

    await generateBriefing(
      { sourceIds: [wanted!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(textOf(seen.prompt)).toContain('Die Persistenz ist entschieden.')
    expect(textOf(seen.prompt)).not.toContain('Ein ganz anderes Thema.')
  })

  it('refuses a selection without readable text', async () => {
    const where = await setUp('alice')
    const { model } = mockModel(briefing)

    await expect(
      generateBriefing({ sourceIds: [], ownerId: where.ownerId }, { model, db: database.db }),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('does not read the sources of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const source = await createSource(
      { ...hers, title: 'Privat', kind: 'text', text: 'Vertraulicher Text.' },
      database.db,
    )
    const { model } = mockModel(briefing)

    await expect(
      generateBriefing(
        { sourceIds: [source!.id], ownerId: 'bob' },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })
})

describe('generating an faq', () => {
  it('returns question and answer pairs that match the schema', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Architektur',
        kind: 'text',
        text: 'Als Datenbank dient Neon Postgres. Migrationen entstehen mit Drizzle.',
      },
      database.db,
    )
    const { model, seen } = mockModel(faq)

    const generated = await generateFaq(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(Faq.safeParse(generated).success).toBe(true)
    expect(generated.entries).toHaveLength(2)
    // The rules differ from the briefing, the passages do not.
    expect(textOf(seen.prompt)).toContain('FAQ')
    expect(textOf(seen.prompt)).toContain('Als Datenbank dient Neon Postgres.')
  })

  it('refuses a selection without readable text', async () => {
    const where = await setUp('alice')
    const { model } = mockModel(faq)

    await expect(
      generateFaq({ sourceIds: [], ownerId: where.ownerId }, { model, db: database.db }),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('does not read the sources of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const source = await createSource(
      { ...hers, title: 'Privat', kind: 'text', text: 'Vertraulicher Text.' },
      database.db,
    )
    const { model } = mockModel(faq)

    await expect(
      generateFaq({ sourceIds: [source!.id], ownerId: 'bob' }, { model, db: database.db }),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })
})

describe('storing an artifact', () => {
  it('keeps the content readable as a briefing', async () => {
    const where = await setUp('alice')

    const stored = await createArtifact(
      { ...where, kind: 'briefing', title: briefing.title, content: briefing },
      database.db,
    )

    const [row] = await listArtifacts(where.notebookId, where.ownerId, database.db)
    expect(row.id).toBe(stored!.id)
    expect(row.kind).toBe('briefing')
    expect(readBriefing(row.content)).toEqual(briefing)
  })

  it('keeps the two kinds apart', async () => {
    const where = await setUp('alice')

    await createArtifact(
      { ...where, kind: 'briefing', title: briefing.title, content: briefing },
      database.db,
    )
    await createArtifact(
      { ...where, kind: 'faq', title: faq.title, content: faq },
      database.db,
    )

    const rows = await listArtifacts(where.notebookId, where.ownerId, database.db)
    const stored = Object.fromEntries(rows.map((row) => [row.kind, row]))

    expect(readFaq(stored.faq.content)).toEqual(faq)
    expect(readBriefing(stored.briefing.content)).toEqual(briefing)
    // A briefing is not an faq, even though both carry a title.
    expect(readFaq(stored.briefing.content)).toBeNull()
    expect(readBriefing(stored.faq.content)).toBeNull()
  })

  it('describes every kind from its own content', async () => {
    expect(artifactMeta({ kind: 'faq', content: faq })).toBe('2 Fragen')
    expect(artifactMeta({ kind: 'briefing', content: briefing })).toBe(
      '2 Abschnitte · 3 Punkte',
    )
    expect(artifactMeta({ kind: 'faq', content: { headline: 'anderes' } })).toBeNull()
  })

  it('skips content that does not match the schema', async () => {
    const where = await setUp('alice')

    await createArtifact(
      { ...where, kind: 'briefing', title: 'Alt', content: { headline: 'anderes Format' } },
      database.db,
    )

    const [row] = await listArtifacts(where.notebookId, where.ownerId, database.db)
    expect(readBriefing(row.content)).toBeNull()
  })
})

describe('owner scoping', () => {
  it('refuses to store into a notebook of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')

    expect(
      await createArtifact(
        {
          notebookId: hers.notebookId,
          ownerId: 'bob',
          kind: 'briefing',
          title: 'Fremd',
          content: briefing,
        },
        database.db,
      ),
    ).toBeNull()
  })

  it('does not list or delete the artifacts of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const stored = await createArtifact(
      { ...hers, kind: 'briefing', title: 'Privat', content: briefing },
      database.db,
    )

    expect(await listArtifacts(hers.notebookId, 'bob', database.db)).toEqual([])
    expect(await deleteArtifact(stored!.id, 'bob', database.db)).toBe(false)
    expect(await deleteArtifact(stored!.id, hers.ownerId, database.db)).toBe(true)
  })
})

describe('the meta line', () => {
  it('counts sections and points instead of stating them', () => {
    expect(briefingMeta(briefing as Briefing)).toBe('2 Abschnitte · 3 Punkte')
  })

  it('uses the singular where it belongs', () => {
    expect(
      briefingMeta({
        ...briefing,
        sections: [{ heading: 'Eins', points: ['Ein Satz.'] }],
      } as Briefing),
    ).toBe('1 Abschnitt · 1 Punkt')
    expect(faqMeta({ ...faq, entries: [faq.entries[0]] } as Faq)).toBe('1 Frage')
  })
})
