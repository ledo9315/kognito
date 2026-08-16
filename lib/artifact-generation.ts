import {
  generateText,
  Output,
  type LanguageModel,
  type SpeechModel,
} from 'ai'
import type { z } from 'zod'
import {
  AudioScript,
  audioScriptRules,
  mergeAudioScripts,
  splitScript,
  trimToSentence,
  type AudioOverview as AudioOverviewType,
} from '@/lib/audio'
import {
  Briefing,
  briefingRules,
  mergeBriefings,
  type Briefing as BriefingType,
} from '@/lib/briefing'
import { defaultModel } from '@/lib/chat'
import { maxPromptCharacters, maxScriptCharacters } from '@/lib/config'
import { inReadingOrder, windowPassages } from '@/lib/context'
import { getDb, type Database } from '@/lib/db'
import { Faq, faqRules, mergeFaqs, type Faq as FaqType } from '@/lib/faq'
import {
  Flashcards,
  flashcardsRules,
  mergeFlashcards,
  type Flashcards as FlashcardsType,
} from '@/lib/flashcards'
import {
  mergeMindmaps,
  Mindmap,
  mindmapRules,
  withinBounds,
  type Mindmap as MindmapType,
} from '@/lib/mindmap'
import { speak } from '@/lib/speech'
import {
  datedOnly,
  inTimeOrder,
  mergeTimelines,
  Timeline,
  timelineRules,
  type Timeline as TimelineType,
} from '@/lib/timeline'

/**
 * Turning a selection of sources into an artifact.
 *
 * Four pieces: the passages, the instructions, the schema and, for a
 * selection too large for one prompt, the way the partial answers come back
 * together. Only the last three change per kind, which is why the fetching
 * sits here on its own and not inside the briefing or the faq.
 */

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
  speechModel?: SpeechModel
  db?: Database
}

type Selection = { sourceIds: string[]; ownerId: string }

/**
 * One narrator talking about the selection, not reading it out.
 *
 * The script is written the same way every other artifact is written, and
 * only then spoken. Sending the sources themselves to a speech model would
 * cost characters by the hundred thousand and produce an audio book instead
 * of an overview.
 */
export async function generateAudio(
  input: Selection,
  options: GenerationOptions = {},
): Promise<AudioOverviewType> {
  const written = await generate(
    AudioScript,
    audioScriptRules,
    mergeAudioScripts,
    input,
    options,
  )

  const pieces = splitScript(
    trimToSentence(written.script, maxScriptCharacters),
  )

  // The prompt asks for a script and the schema asks for a string, so an
  // empty one means the model gave up on the selection.
  if (pieces.length === 0) throw new NoSourcesError()

  return {
    title: written.title,
    script: pieces.join('\n\n'),
    pathname: await speak(pieces, options.speechModel),
  }
}

export function generateBriefing(
  input: Selection,
  options: GenerationOptions = {},
): Promise<BriefingType> {

  return generate(Briefing, briefingRules, mergeBriefings, input, options)
}

export function generateFaq(
  input: Selection,
  options: GenerationOptions = {},
): Promise<FaqType> {

  return generate(Faq, faqRules, mergeFaqs, input, options)
}

export function generateFlashcards(
  input: Selection,
  options: GenerationOptions = {},
): Promise<FlashcardsType> {

  return generate(Flashcards, flashcardsRules, mergeFlashcards, input, options)
}

export async function generateMindmap(
  input: Selection,
  options: GenerationOptions = {},
): Promise<MindmapType> {
  // Cut to a size a drawing can carry, in code, because the counts in the
  // schema are a wish and this is a rule. See `withinBounds`.
  return withinBounds(
    await generate(Mindmap, mindmapRules, mergeMindmaps, input, options),
  )
}

export async function generateTimeline(
  input: Selection,
  options: GenerationOptions = {},
): Promise<TimelineType> {
  const timeline = await generate(
    Timeline,
    timelineRules,
    mergeTimelines,
    input,
    options,
  )

  const entries = datedOnly(timeline.entries)
  if (entries.length === 0) throw new NoDatesError()
  return { ...timeline, entries: inTimeOrder(entries) }
}

/**
 * Every passage into the prompt, in as many prompts as that takes.
 *
 * An artifact has no question, so there is nothing to search with. Before
 * this, a selection over `maxPromptCharacters` was cut down by similarity to
 * a stand-in question, and a summary lost precisely what lay off the topic
 * it was supposed to describe. Reading everything costs one model call per
 * window instead of one in total, and that is the whole price, see #55.
 */
async function generate<T>(
  schema: z.ZodType<T>,
  rules: string,
  merge: (parts: T[]) => T,
  input: Selection,
  options: GenerationOptions,
): Promise<T> {
  const chunks = await inReadingOrder(input, options.db ?? getDb())
  if (chunks.length === 0) throw new NoSourcesError()

  const windows = windowPassages(chunks, maxPromptCharacters)

  // Side by side, because the windows do not depend on each other and a
  // reader should not wait for three round trips in a row.
  const parts = await Promise.all(
    windows.map((passages) => askOnce(schema, rules, passages, options)),
  )

  // The ordinary selection is one window, and then there is nothing to
  // merge and nothing about it that differs from before.
  return parts.length === 1 ? parts[0] : merge(parts)
}

function askOnce<T>(
  schema: z.ZodType<T>,
  rules: string,
  passages: string,
  options: GenerationOptions,
): Promise<T> {
  return generateText({
    model: options.model ?? defaultModel(),
    output: Output.object({ schema }),
    system: rules,
    prompt: `Abschnitte:\n\n${passages}`,
  }).then((result) => result.output)
}
