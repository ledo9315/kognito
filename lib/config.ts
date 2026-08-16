/* -------------------------------------------------------------------------- */
/* Reading a source                                                            */

/**
 * How a source is cut into passages, in characters.
 *
 * Smaller passages make a search more precise and give citations a tighter
 * target. Larger ones keep more context around a hit. The overlap stops a
 * sentence that falls on a border from belonging to neither side.
 */
export const chunkLimits = {
  min: 500,
  max: 1000,
  overlap: 100,
}

/** The largest file an upload accepts. Ten megabytes of pdf is a long book. */
export const maxFileBytes = 10_000_000

/* -------------------------------------------------------------------------- */
/* Answering a question                                                        */

/**
 * How much text may go into one prompt.
 *
 * This is the switch between the two ways of answering: a selection that
 * fits goes in whole, a larger one is searched. Raising it means paying for
 * more text on every question, lowering it means searching sooner.
 */
export const maxPromptCharacters = 120_000

/**
 * How many passages a search hands back.
 *
 * The trade-off is cost against completeness. At around 900 characters per
 * passage, 48 of them are roughly a third of what a full prompt costs. More
 * of them find more, up to the point where searching saves nothing.
 *
 * Deliberately more than one answer needs: the neighbours of a hit often
 * carry the sentence that completes it.
 */
export const searchResultCount = 48

/**
 * How many passages of one source are embedded at most.
 *
 * A guard against a file somebody dropped in by mistake, not a quality
 * setting. Beyond this the source keeps working, it just goes into the
 * prompt whole instead of being searchable.
 */
export const maxChunksPerSource = 2_000

/* -------------------------------------------------------------------------- */
/* Speaking about a selection                                                  */

/**
 * How long an audio overview may get, in characters of script.
 *
 * Ten thousand characters are roughly ten minutes. The point of the overview
 * is that it is shorter than the sources, so this is a ceiling in code and
 * not only a wish in the prompt: a hundred page thesis becomes an overview,
 * never an audio book.
 */
export const maxScriptCharacters = 10_000

/**
 * The largest text one synthesis request takes.
 *
 * The limit of the speech models is 4096 characters. Below it, because the
 * script is cut between sentences and the last one has to fit.
 */
export const maxSpeechCharacters = 4_000

/** Characters spoken per minute, for the estimate under the title. */
export const charactersPerSpokenMinute = 1_000

/* -------------------------------------------------------------------------- */
/* Showing an answer                                                           */

/** How much of a passage a citation tooltip shows, in characters. */
export const quoteLength = 200
