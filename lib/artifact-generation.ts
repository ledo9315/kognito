import { generateText, Output, type LanguageModel } from 'ai'
import type { z } from 'zod'
import { Briefing, briefingRules, type Briefing as BriefingType } from '@/lib/briefing'
import { defaultModel } from '@/lib/chat'
import { maxPromptCharacters } from '@/lib/config'
import { getContextChunks, numberPassages } from '@/lib/context'
import { getDb, type Database } from '@/lib/db'
import { createEmbedder, type Embedder } from '@/lib/embeddings'
import { Faq, faqRules, type Faq as FaqType } from '@/lib/faq'
import {
  datedOnly,
  inTimeOrder,
  Timeline,
  timelineRules,
  type Timeline as TimelineType,
} from '@/lib/timeline'

/**
 * Turning a selection of sources into an artifact.
 *
 * Three pieces: the passages, the instructions and the schema. Only the last
 * two change per kind, which is why the fetching sits here on its own and
 * not inside the briefing or the faq.
 */

/** An artifact has no single question, so this one stands in when searching. */
const scope = 'Worum geht es in diesen Quellen, und was sind die Kernaussagen?'

export class NoSourcesError extends Error {
  constructor() {
    super('An artifact without sources would be invented')
    this.name = 'NoSourcesError'
  }
}

/** The sources carry no dates, so there is nothing to put on a timeline. */
export class NoDatesError extends Error {
  constructor() {
    super('A timeline without dates would be invented')
    this.name = 'NoDatesError'
  }
}

export type GenerationOptions = {
  model?: LanguageModel
  db?: Database
  embedder?: Embedder
}

type Selection = { sourceIds: string[]; ownerId: string }

export function generateBriefing(
  input: Selection,
  options: GenerationOptions = {},
): Promise<BriefingType> {

  return generate(Briefing, briefingRules, input, options)
}

export function generateFaq(
  input: Selection,
  options: GenerationOptions = {},
): Promise<FaqType> {
  
  return generate(Faq, faqRules, input, options)
}

export async function generateTimeline(
  input: Selection,
  options: GenerationOptions = {},
): Promise<TimelineType> {
  const timeline = await generate(Timeline, timelineRules, input, options)

  // The rules ask for points in time and the filter enforces it, because a
  // rule is a request and a model may read a duration as a date. Not empty
  // is not the same as usable, so the check has to come after the filter.
  const entries = datedOnly(timeline.entries)

  // The schema allows an empty list so that a source without dates has a
  // truthful answer to give. What it must not become is a stored artifact
  // that only says there is nothing.
  if (entries.length === 0) throw new NoDatesError()

  // Chronology is decided here, where a test can check it, and not by
  // asking the model for it.
  return { ...timeline, entries: inTimeOrder(entries) }
}

async function generate<T>(
  schema: z.ZodType<T>,
  rules: string,
  input: Selection,
  options: GenerationOptions,
): Promise<T> {
  const passages = await passagesFor(input, options)

  const { output } = await generateText({
    model: options.model ?? defaultModel(),
    output: Output.object({ schema }),
    system: rules,
    prompt: `Abschnitte:\n\n${passages}`,
  })

  return output
}

/**
 * The same passages the chat would get for this selection, which is what
 * keeps an artifact and an answer from disagreeing about the sources.
 */
async function passagesFor(input: Selection, options: GenerationOptions) {
  const db = options.db ?? getDb()

  const chunks = await getContextChunks(
    {
      sourceIds: input.sourceIds,
      // ponytail: one generic question for every artifact. Harmless below
      // maxPromptCharacters, where the whole selection goes in anyway. Above
      // it a summary should read everything, not the nearest hits, see #55.
      question: scope,
      ownerId: input.ownerId,
      embedder: options.embedder ?? createEmbedder(),
    },
    db,
  )

  if (chunks.length === 0) throw new NoSourcesError()

  return numberPassages(chunks, maxPromptCharacters).passages
}
