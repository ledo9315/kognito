import { generateText, Output, type LanguageModel } from 'ai'
import { Briefing, briefingRules, type Briefing as BriefingType } from '@/lib/briefing'
import { defaultModel } from '@/lib/chat'
import { maxPromptCharacters } from '@/lib/config'
import { getContextChunks, numberPassages } from '@/lib/context'
import { getDb, type Database } from '@/lib/db'
import { createEmbedder, type Embedder } from '@/lib/embeddings'

/**
 * Turning a selection of sources into an artifact.
 *
 * Three pieces: the passages, the instructions and the schema. Only the last
 * two change for the next kind of artifact, which is why the fetching sits
 * here on its own and not inside the briefing.
 */

/** A briefing has no single question, so this one stands in when searching. */
const scope = 'Worum geht es in diesen Quellen, und was sind die Kernaussagen?'

export class NoSourcesError extends Error {
  constructor() {
    super('An artifact without sources would be invented')
    this.name = 'NoSourcesError'
  }
}

export type GenerationOptions = {
  model?: LanguageModel
  db?: Database
  embedder?: Embedder
}

export async function generateBriefing(
  input: { sourceIds: string[]; ownerId: string },
  options: GenerationOptions = {},
): Promise<BriefingType> {
  const passages = await passagesFor(input, options)

  const { output } = await generateText({
    model: options.model ?? defaultModel(),
    output: Output.object({ schema: Briefing }),
    system: briefingRules,
    prompt: `Abschnitte:\n\n${passages}`,
  })

  return output
}

/**
 * The same passages the chat would get for this selection, which is what
 * keeps a briefing and an answer from disagreeing about the sources.
 */
async function passagesFor(
  input: { sourceIds: string[]; ownerId: string },
  options: GenerationOptions,
) {
  const db = options.db ?? getDb()

  const chunks = await getContextChunks(
    {
      sourceIds: input.sourceIds,
      question: scope,
      ownerId: input.ownerId,
      embedder: options.embedder ?? createEmbedder(),
    },
    db,
  )

  if (chunks.length === 0) throw new NoSourcesError()

  return numberPassages(chunks, maxPromptCharacters).passages
}
