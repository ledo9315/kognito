/**
 * Which language model answers, and what to say when it does not.
 *
 * The same shape as the other two gateway modules, `lib/embeddings.ts` and
 * `lib/speech.ts`: one function that reads the model out of the environment,
 * so which model is used is a deployment decision and not a code change.
 *
 * This lives in `lib/` and not in a feature because summarising a source,
 * writing an artifact and answering a question all reach for it. Hanging it
 * off the chat feature made those two import the whole answering path,
 * database and all, to read one environment variable.
 */

export function defaultModel() {
  return process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5-mini'
}

/**
 * The gateway reports a limit in whatever shape the provider handed it, so
 * this is the one place that has to know all of them.
 */
export function modelFailureMessage(error: unknown) {
  return looksRateLimited(error)
    ? 'Das Modell ist gerade ausgelastet oder das Limit ist erreicht. Bitte versuche es in ein paar Minuten noch einmal.'
    : 'Das Modell hat nicht geantwortet. Bitte versuche es noch einmal.'
}

function looksRateLimited(error: unknown, depth = 0): boolean {
  if (depth > 4 || error === null || typeof error !== 'object') return false

  const candidate = error as {
    name?: unknown
    message?: unknown
    statusCode?: unknown
    cause?: unknown
    lastError?: unknown
    errors?: unknown
  }

  if (candidate.statusCode === 429) return true

  const text = `${String(candidate.name ?? '')} ${String(candidate.message ?? '')}`
  if (/rate.?limit|too many requests|\b429\b/i.test(text)) return true

  if (looksRateLimited(candidate.cause, depth + 1)) return true
  if (looksRateLimited(candidate.lastError, depth + 1)) return true

  return (
    Array.isArray(candidate.errors) &&
    candidate.errors.some((one) => looksRateLimited(one, depth + 1))
  )
}
