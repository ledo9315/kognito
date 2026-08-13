import { describe, expect, it } from 'vitest'
import { defaultModel, streamAnswer } from '@/lib/chat'
import { createTestDb } from '@/lib/db/test-db'
import { user } from '@/lib/db/schema'
import { createNotebook } from '@/lib/notebooks'
import { createSource } from '@/lib/sources'

const document = `Protokoll der Projektsitzung vom 3. März 2026

Die Runde war sich einig, dass der ursprüngliche Zeitplan nicht zu halten ist. Als Hauptgrund wurde die ausstehende wasserrechtliche Genehmigung genannt, die seit November beim Landratsamt liegt. Frau Berger berichtete, dass die Behörde eine Nachforderung zur Kühlwassermenge gestellt hat und die Unterlagen erst Ende Februar vollständig eingereicht werden konnten.

Der zweite Grund ist die Lieferzeit der Hochdruckpumpen. Der Hersteller hat die Lieferzeit von 14 auf 28 Wochen verdoppelt und begründet das mit Engpässen bei Gussteilen. Ein alternativer Anbieter aus Italien wurde geprüft, liegt preislich aber 22 Prozent höher.

Die Inbetriebnahme verschiebt sich damit vom vierten Quartal 2026 auf das zweite Quartal 2027. Herr Vogel wies darauf hin, dass die Förderzusage an eine Inbetriebnahme bis Ende 2027 gebunden ist, der Puffer also weiterhin ausreicht, aber deutlich geschrumpft ist.

Beschlossen wurde, die Bestellung der Pumpen sofort auszulösen, ohne die Genehmigung abzuwarten. Das Risiko wurde mit rund 180.000 Euro beziffert und von der Geschäftsführung ausdrücklich getragen.

Der nächste Termin ist der 17. März 2026 um 14 Uhr.`

async function ask(question: string, sources: string[] = [document]) {
  const database = await createTestDb()
  await database.db
    .insert(user)
    .values({ id: 'live', name: 'live', email: 'live@kognito.test' })
  const notebook = await createNotebook('live', 'Live', database.db)

  const sourceIds: string[] = []
  for (const [index, text] of sources.entries()) {
    const created = await createSource(
      {
        notebookId: notebook.id,
        ownerId: 'live',
        title: `Protokoll ${index + 1}`,
        kind: 'text',
        text,
      },
      database.db,
    )
    sourceIds.push(created!.id)
  }

  const { result, prompt } = await streamAnswer(
    { notebookId: notebook.id, ownerId: 'live', question, sourceIds },
    { db: database.db },
  )

  let answer = ''
  for await (const part of result.textStream) answer += part
  await database.close()

  return { answer, chunkCount: prompt.chunks.length }
}

/**
 * The only test that calls a real model and costs money. Skipped unless
 * LIVE_MODEL is set, so neither CI nor `pnpm test` ever reaches the network.
 *
 *   pnpm test:live
 */
describe.runIf(process.env.LIVE_MODEL === '1')('the real model', () => {
  it('answers with citations', async () => {
    const { answer, chunkCount } = await ask('Warum verzögert sich das Projekt?')

    process.stdout.write(
      `\n--- Modell: ${defaultModel()} | Abschnitte: ${chunkCount}\n${answer}\n---\n`,
    )
    expect(answer).toMatch(/\[\d\]/)
  }, 60_000)

  it('says so when the answer is not in the sources', async () => {
    const { answer } = await ask('Wie hoch ist der Stromverbrauch der Anlage?')

    process.stdout.write(`\n--- Frage ohne Antwort in der Quelle:\n${answer}\n---\n`)
    expect(answer.length).toBeGreaterThan(0)
  }, 60_000)
})
