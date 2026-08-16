import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModel } from 'ai'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  generateBriefing,
  generateFaq,
  generateFlashcards,
  generateMindmap,
  generateTimeline,
  NoDatesError,
  NoSourcesError,
} from '@/features/artifacts/artifact-generation'
import { artifactMeta } from '@/features/artifacts/artifact-kinds'
import { maxPromptCharacters } from '@/lib/config'
import { createArtifact, deleteArtifact, listArtifacts } from '@/features/artifacts/artifacts'
import { Briefing, briefingMeta, mergeBriefings, readBriefing } from '@/features/artifacts/briefing'
import { Faq, faqMeta, mergeFaqs, readFaq } from '@/features/artifacts/faq'
import {
  Flashcards,
  flashcardsMeta,
  mergeFlashcards,
  readFlashcards,
} from '@/features/artifacts/flashcards'
import {
  mergeMindmaps,
  mermaidLabel,
  Mindmap,
  mindmapMeta,
  readMindmap,
  toMermaid,
  withinBounds,
} from '@/features/artifacts/mindmap'
import {
  datedOnly,
  inTimeOrder,
  mergeTimelines,
  readTimeline,
  timelineMeta,
  type Timeline,
} from '@/features/artifacts/timeline'
import { createTestDb } from '@/lib/db/test-db'
import { user } from '@/lib/db/schema'
import { createNotebook } from '@/features/notebooks/notebooks'
import { createSource } from '@/features/sources/sources'

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

const flashcards = {
  title: 'Architektur zum Einprägen',
  cards: [
    { front: 'Welche Datenbank kommt zum Einsatz?', back: 'Neon Postgres.' },
    { front: 'Womit entstehen die Migrationen?', back: 'Mit Drizzle.' },
  ],
}

const mindmap = {
  title: 'Architektur im Überblick',
  branches: [
    {
      label: 'Datenhaltung',
      children: [
        { label: 'Neon Postgres', children: ['serverless', 'Branch pro Lauf'] },
        { label: 'Drizzle', children: ['Migrationen'] },
      ],
    },
    {
      label: 'Auslieferung',
      children: [{ label: 'Vercel', children: [] }],
    },
  ],
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

const timeline = {
  title: 'Entstehung des Projekts',
  entries: [
    { when: 'Frühjahr 2021', sortKey: '2021-03', event: 'Der Prototyp entsteht.' },
    { when: '2019', sortKey: '2019', event: 'Die Idee wird notiert.' },
    { when: '3. Mai 2021', sortKey: '2021-05-03', event: 'Die erste Version geht live.' },
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

describe('generating flashcards', () => {
  it('returns cards that match the schema, asked to check and not to explain', async () => {
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
    const { model, seen } = mockModel(flashcards)

    const generated = await generateFlashcards(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(Flashcards.safeParse(generated).success).toBe(true)
    expect(generated.cards).toHaveLength(2)
    // The same passages as every other kind, and the rules that keep a card
    // apart from an faq entry.
    expect(textOf(seen.prompt)).toContain('Als Datenbank dient Neon Postgres.')
    expect(textOf(seen.prompt)).toContain('Zwei Dinge sind zwei Karten.')
  })

  it('refuses a selection without readable text', async () => {
    const where = await setUp('alice')
    const { model } = mockModel(flashcards)

    await expect(
      generateFlashcards(
        { sourceIds: [], ownerId: where.ownerId },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('does not read the sources of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const source = await createSource(
      { ...hers, title: 'Privat', kind: 'text', text: 'Vertraulicher Text.' },
      database.db,
    )
    const { model } = mockModel(flashcards)

    await expect(
      generateFlashcards(
        { sourceIds: [source!.id], ownerId: 'bob' },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('reads a stored set back and does not confuse it with an faq', () => {
    expect(readFlashcards(flashcards)).toEqual(flashcards)
    expect(readFlashcards(faq)).toBeNull()
    expect(readFaq(flashcards)).toBeNull()
  })
})

describe('generating a mindmap', () => {
  it('returns a map that matches the schema, asked to sort and not to summarise', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Architektur',
        kind: 'text',
        text: 'Als Datenbank dient Neon Postgres. Ausgeliefert wird über Vercel.',
      },
      database.db,
    )
    const { model, seen } = mockModel(mindmap)

    const generated = await generateMindmap(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(Mindmap.safeParse(generated).success).toBe(true)
    expect(generated.branches).toHaveLength(2)
    expect(textOf(seen.prompt)).toContain('Als Datenbank dient Neon Postgres.')
    // The rule that keeps a label a label instead of a sentence.
    expect(textOf(seen.prompt)).toContain('Eine Mindmap gliedert, sie fasst nicht zusammen.')
  })

  it('refuses a selection without readable text', async () => {
    const where = await setUp('alice')
    const { model } = mockModel(mindmap)

    await expect(
      generateMindmap({ sourceIds: [], ownerId: where.ownerId }, { model, db: database.db }),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('does not read the sources of another account', async () => {
    const hers = await setUp('alice')
    await setUp('bob')
    const source = await createSource(
      { ...hers, title: 'Privat', kind: 'text', text: 'Vertraulicher Text.' },
      database.db,
    )
    const { model } = mockModel(mindmap)

    await expect(
      generateMindmap({ sourceIds: [source!.id], ownerId: 'bob' }, { model, db: database.db }),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })

  it('cuts a map the model made too large down to a drawable size', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      { ...where, title: 'Datenbanken', kind: 'text', text: 'Ein langer Text.' },
      database.db,
    )
    // The shape of a real run that kept every rule and still came back with
    // 82 nodes: eight topics, six subtopics each, four keywords under each.
    const { model } = mockModel({
      title: 'Zu viel',
      branches: [...Array(8).keys()].map((topic) => ({
        label: `Thema ${topic}`,
        children: [...Array(6).keys()].map((sub) => ({
          label: `Unterthema ${topic}.${sub}`,
          children: ['eins', 'zwei', 'drei', 'vier'],
        })),
      })),
    })

    const generated = await generateMindmap(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(generated.branches).toHaveLength(6)
    expect(generated.branches[0].children).toHaveLength(3)
    expect(generated.branches[0].children[0].children).toEqual(['eins', 'zwei'])
    // 6 topics, 3 subtopics each, 2 keywords under each.
    expect(mindmapMeta(generated)).toBe('6 Themen · 54 Knoten')
  })

  it('leaves a map that is already small enough alone', () => {
    expect(withinBounds(mindmap as Mindmap)).toEqual(mindmap)
  })

  it('reads a stored map back and rejects one that lost its branches', () => {
    expect(readMindmap(mindmap)).toEqual(mindmap)
    expect(readMindmap({ title: 'Ohne Äste' })).toBeNull()
    expect(readMindmap(briefing)).toBeNull()
  })
})

describe('writing a mindmap in mermaid syntax', () => {
  it('nests by indentation and gives every node an id of its own', () => {
    expect(toMermaid(mindmap as Mindmap)).toBe(
      [
        'mindmap',
        '  root((Architektur im Überblick))',
        '    n1[Datenhaltung]',
        '      n2[Neon Postgres]',
        '        n3[serverless]',
        '        n4[Branch pro Lauf]',
        '      n5[Drizzle]',
        '        n6[Migrationen]',
        '    n7[Auslieferung]',
        '      n8[Vercel]',
      ].join('\n'),
    )
  })

  it('removes what would end a node early instead of escaping it', () => {
    // A label a model wrote from a document nobody here controls.
    expect(mermaidLabel('Chunking (500 bis 1000 Zeichen)')).toBe(
      'Chunking 500 bis 1000 Zeichen',
    )
    expect(mermaidLabel('Feld  "kind"\nim Schema')).toBe('Feld kind im Schema')
    expect(mermaidLabel('Liste [1]')).toBe('Liste 1')
  })

  it('drops a node whose label is nothing but delimiters, and its children', () => {
    const written = toMermaid({
      title: 'Rest',
      branches: [
        { label: '[]', children: [{ label: 'Verschwindet mit', children: ['auch das'] }] },
        { label: 'Bleibt', children: [] },
      ],
    } as Mindmap)

    expect(written).not.toContain('Verschwindet mit')
    expect(written).toContain('n1[Bleibt]')
  })

  it('falls back to a title when the title itself cleans up to nothing', () => {
    expect(toMermaid({ title: '(())', branches: [] } as Mindmap)).toBe(
      'mindmap\n  root((Mindmap))',
    )
  })
})

describe('generating a timeline', () => {
  async function dated(name: string) {
    const where = await setUp(name)
    const source = await createSource(
      {
        ...where,
        title: 'Verlauf',
        kind: 'text',
        text: 'Die Idee wird 2019 notiert. Im Frühjahr 2021 entsteht der Prototyp.',
      },
      database.db,
    )
    return { ...where, sourceId: source!.id }
  }

  it('puts the events in order, whatever order the model answered in', async () => {
    const where = await dated('alice')
    const { model } = mockModel(timeline)

    const generated = await generateTimeline(
      { sourceIds: [where.sourceId], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(generated.entries.map((entry) => entry.when)).toEqual([
      '2019',
      'Frühjahr 2021',
      '3. Mai 2021',
    ])
  })

  it('refuses to store a timeline when the sources carry no dates', async () => {
    const where = await dated('alice')
    // The schema allows this, which is the point: the model can say nothing.
    const { model } = mockModel({ title: 'Ohne Daten', entries: [] })

    await expect(
      generateTimeline(
        { sourceIds: [where.sourceId], ownerId: where.ownerId },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoDatesError)
  })

  // What a real model answered for a text about grinding coffee: true
  // sentences, and durations rather than dates.
  it('refuses a timeline the model built from durations', async () => {
    const where = await dated('alice')
    const { model } = mockModel({
      title: 'Wie eine Kaffeemühle den Geschmack bestimmt',
      entries: [
        {
          when: 'mehrere Minuten im Wasser',
          sortKey: 'mehrere Minuten',
          event: 'Eine French Press braucht einen groben Mahlgrad.',
        },
        {
          when: 'nur wenige Sekunden Kontakt',
          sortKey: 'wenige Sekunden',
          event: 'Espresso braucht einen feinen Mahlgrad.',
        },
      ],
    })

    await expect(
      generateTimeline(
        { sourceIds: [where.sourceId], ownerId: where.ownerId },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoDatesError)
  })

  it('drops a single undatable entry and keeps the rest', async () => {
    const where = await dated('alice')
    const { model } = mockModel({
      title: 'Gemischt',
      entries: [
        { when: 'über Jahrhunderte', sortKey: 'Jahrhunderte', event: 'Dauert lange.' },
        ...timeline.entries,
      ],
    })

    const generated = await generateTimeline(
      { sourceIds: [where.sourceId], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(generated.entries).toHaveLength(3)
    expect(generated.entries.map((entry) => entry.when)).not.toContain(
      'über Jahrhunderte',
    )
  })

  it('does not read the sources of another account', async () => {
    const hers = await dated('alice')
    await setUp('bob')
    const { model } = mockModel(timeline)

    await expect(
      generateTimeline(
        { sourceIds: [hers.sourceId], ownerId: 'bob' },
        { model, db: database.db },
      ),
    ).rejects.toBeInstanceOf(NoSourcesError)
  })
})

describe('keeping only what is dated', () => {
  it('accepts a year, a month and a day, and nothing else', () => {
    const kept = datedOnly([
      { when: '2021', sortKey: '2021', event: 'Jahr' },
      { when: 'Mai 2021', sortKey: '2021-05', event: 'Monat' },
      { when: '3. Mai 2021', sortKey: '2021-05-03', event: 'Tag' },
      { when: 'mehrere Minuten', sortKey: 'mehrere Minuten', event: 'Dauer' },
      { when: 'im Sommer', sortKey: 'Sommer', event: 'ohne Jahr' },
      { when: 'kürzlich', sortKey: '', event: 'leer' },
      { when: 'Mai 2021', sortKey: '2021-5', event: 'ohne führende Null' },
    ])

    expect(kept.map((entry) => entry.event)).toEqual(['Jahr', 'Monat', 'Tag'])
  })
})

describe('sorting a timeline', () => {
  it('reads a coarse key as earlier than a finer one in the same period', () => {
    const order = inTimeOrder([
      { when: 'Mai 2021', sortKey: '2021-05', event: 'b' },
      { when: '2021', sortKey: '2021', event: 'a' },
      { when: '3. Mai 2021', sortKey: '2021-05-03', event: 'c' },
    ])

    expect(order.map((entry) => entry.event)).toEqual(['a', 'b', 'c'])
  })

  it('leaves the given entries untouched', () => {
    const entries = [
      { when: '2021', sortKey: '2021', event: 'b' },
      { when: '2019', sortKey: '2019', event: 'a' },
    ]

    inTimeOrder(entries)
    expect(entries.map((entry) => entry.event)).toEqual(['b', 'a'])
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
    expect(artifactMeta({ kind: 'timeline', content: timeline })).toBe('3 Ereignisse')
    expect(artifactMeta({ kind: 'flashcards', content: flashcards })).toBe('2 Karten')
    expect(artifactMeta({ kind: 'mindmap', content: mindmap })).toBe(
      '2 Themen · 6 Knoten',
    )
    expect(artifactMeta({ kind: 'faq', content: { headline: 'anderes' } })).toBeNull()
  })

  it('keeps a timeline readable and apart from the other kinds', async () => {
    const where = await setUp('alice')

    await createArtifact(
      { ...where, kind: 'timeline', title: timeline.title, content: timeline },
      database.db,
    )

    const [row] = await listArtifacts(where.notebookId, where.ownerId, database.db)
    expect(readTimeline(row.content)).toEqual(timeline)
    expect(readFaq(row.content)).toBeNull()
    expect(timelineMeta(timeline as Timeline)).toBe('3 Ereignisse')
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
    expect(await deleteArtifact(stored!.id, 'bob', database.db)).toBeNull()
    expect(
      await deleteArtifact(stored!.id, hers.ownerId, database.db),
    ).toMatchObject({ id: stored!.id })
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
    expect(
      flashcardsMeta({ ...flashcards, cards: [flashcards.cards[0]] } as Flashcards),
    ).toBe('1 Karte')
    expect(
      mindmapMeta({ ...mindmap, branches: [mindmap.branches[1]] } as Mindmap),
    ).toBe('1 Thema · 1 Knoten')
  })
})

/**
 * Longer than one prompt can hold, with the sentence that matters at the
 * very end. That is the spot the similarity search could never reach, and
 * the reason #55 exists. Same shape as in features/chat/context.search.test.ts.
 */
function tooLongForOnePrompt(needle: string) {
  const filler = 'Das Gremium tagte, ohne einen Beschluss zu fassen. '
  const body = filler.repeat(Math.ceil((maxPromptCharacters * 1.5) / filler.length))
  return `${body}${needle}`
}

/** Answers with one object per call and keeps every prompt it was handed. */
function mockWindows(objects: unknown[]) {
  const prompts: string[] = []

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const answer = objects[Math.min(prompts.length, objects.length - 1)]
      prompts.push(JSON.stringify(options.prompt))
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(answer) }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })

  return { model: model as unknown as LanguageModel, prompts }
}

describe('a selection larger than one prompt', () => {
  it('reads the end of the selection, not only what a search would find', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Langes Protokoll',
        kind: 'text',
        text: tooLongForOnePrompt('Der Beschluss fiel erst am Ende der Sitzung.'),
      },
      database.db,
    )
    const { model, prompts } = mockWindows([briefing])

    await generateBriefing(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(prompts.length).toBeGreaterThan(1)
    expect(prompts.join('\n')).toContain('Der Beschluss fiel erst am Ende der Sitzung.')
  })

  it('asks once and merges nothing when the selection fits', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Architektur',
        kind: 'text',
        text: 'Als Datenbank dient Neon Postgres.',
      },
      database.db,
    )
    const { model, prompts } = mockWindows([briefing])

    const result = await generateBriefing(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(prompts).toHaveLength(1)
    expect(result).toEqual(briefing)
  })

  it('keeps the entries of every window in the timeline', async () => {
    const where = await setUp('alice')
    const source = await createSource(
      {
        ...where,
        title: 'Langes Protokoll',
        kind: 'text',
        text: tooLongForOnePrompt('Am 3. Mai 2019 fiel der Beschluss.'),
      },
      database.db,
    )
    const { model, prompts } = mockWindows([
      { title: 'Erste Hälfte', entries: [{ when: '2019', sortKey: '2019', event: 'Die Arbeit begann.' }] },
      { title: 'Zweite Hälfte', entries: [{ when: '2011', sortKey: '2011', event: 'Der Plan entstand.' }] },
    ])

    const timeline = await generateTimeline(
      { sourceIds: [source!.id], ownerId: where.ownerId },
      { model, db: database.db },
    )

    expect(prompts.length).toBeGreaterThan(1)
    // Both windows are in, and the later window's earlier date sorts first.
    expect(timeline.entries.map((entry) => entry.sortKey)).toEqual(['2011', '2019'])
  })
})

describe('merging the answers of several windows', () => {
  it('gathers the points of a heading two windows both wrote about', () => {
    const merged = mergeBriefings([
      briefing as Briefing,
      {
        ...briefing,
        title: 'Zweite Hälfte',
        summary: 'Der zweite Teil.',
        sections: [
          { heading: 'Persistenz', points: ['Die Daten liegen in der Cloud.'] },
          { heading: 'Betrieb', points: ['Der Betrieb läuft ohne Server.'] },
        ],
        openQuestions: ['Wird pgvector direkt mitgenutzt?', 'Wer betreibt das?'],
      } as Briefing,
    ])

    expect(merged.title).toBe(briefing.title)
    expect(merged.sections.map((section) => section.heading)).toEqual([
      'Persistenz',
      'Migrationen',
      'Betrieb',
    ])
    expect(merged.sections[0].points).toEqual([
      'Als Datenbank dient Neon Postgres.',
      'Der Betrieb ist serverless.',
      'Die Daten liegen in der Cloud.',
    ])
    // The question both windows raised is asked once.
    expect(merged.openQuestions).toEqual([
      'Wird pgvector direkt mitgenutzt?',
      'Wer betreibt das?',
    ])
    expect(merged.summary).toContain('Der zweite Teil.')
  })

  it('asks a question that two windows both thought of only once', () => {
    const merged = mergeFaqs([
      faq as Faq,
      {
        title: 'Zweite Hälfte',
        entries: [
          { question: faq.entries[0].question.toUpperCase(), answer: 'Noch einmal dasselbe.' },
          { question: 'Wer betreibt das?', answer: 'Das steht nicht im Text.' },
        ],
      },
    ])

    expect(merged.entries).toHaveLength(faq.entries.length + 1)
    expect(merged.entries.at(-1)?.question).toBe('Wer betreibt das?')
  })

  it('writes the card two windows both thought of only once', () => {
    const merged = mergeFlashcards([
      flashcards as Flashcards,
      {
        title: 'Zweite Hälfte',
        cards: [
          { front: flashcards.cards[0].front.toUpperCase(), back: 'Noch einmal dasselbe.' },
          { front: 'Wer betreibt das?', back: 'Das steht nicht im Text.' },
        ],
      },
    ])

    expect(merged.cards).toHaveLength(flashcards.cards.length + 1)
    expect(merged.cards.at(-1)?.front).toBe('Wer betreibt das?')
    expect(merged.title).toBe(flashcards.title)
  })

  it('hangs the children of both windows under a branch they both saw', () => {
    const merged = mergeMindmaps([
      mindmap as Mindmap,
      {
        title: 'Zweite Hälfte',
        branches: [
          {
            // Same branch, spelled differently, with one known and one new child.
            label: 'DATENHALTUNG',
            children: [
              { label: 'Neon Postgres', children: ['serverless', 'pgvector'] },
              { label: 'Backups', children: [] },
            ],
          },
          { label: 'Tests', children: [] },
        ],
      },
    ])

    expect(merged.branches.map((branch) => branch.label)).toEqual([
      'Datenhaltung',
      'Auslieferung',
      'Tests',
    ])

    const datenhaltung = merged.branches[0]
    expect(datenhaltung.children.map((child) => child.label)).toEqual([
      'Neon Postgres',
      'Drizzle',
      'Backups',
    ])
    expect(datenhaltung.children[0].children).toEqual([
      'serverless',
      'Branch pro Lauf',
      'pgvector',
    ])
    expect(merged.title).toBe(mindmap.title)
  })

  it('leaves the maps it was given untouched', () => {
    const before = JSON.stringify(mindmap)

    mergeMindmaps([
      mindmap as Mindmap,
      { title: 'Zweite', branches: [{ label: 'Datenhaltung', children: [] }] },
    ])

    expect(JSON.stringify(mindmap)).toBe(before)
  })

  it('drops the event two windows both saw and keeps two events of one day', () => {
    const merged = mergeTimelines([
      {
        title: 'Erste Hälfte',
        entries: [
          { when: '3. Mai 2019', sortKey: '2019-05-03', event: 'Der Beschluss fiel.' },
          { when: '3. Mai 2019', sortKey: '2019-05-03', event: 'Der Vertrag wurde unterschrieben.' },
        ],
      },
      {
        title: 'Zweite Hälfte',
        entries: [
          { when: '03.05.2019', sortKey: '2019-05-03', event: 'Der Beschluss fiel. ' },
        ],
      },
    ])

    expect(merged.entries).toHaveLength(2)
    expect(merged.title).toBe('Erste Hälfte')
  })
})
