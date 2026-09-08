import { describe, expect, it } from 'vitest'
import { modelFailureMessage } from '@/lib/model'

describe('explaining why the model did not deliver', () => {
  const limited = 'ausgelastet oder das Limit ist erreicht'

  it('names the limit when the gateway refuses for that reason', () => {
    // The shape the gateway really produces: wrapped twice, and the useful
    // part only in the message of the innermost error.
    const error = Object.assign(new Error('Failed after 3 attempts.'), {
      name: 'AI_RetryError',
      lastError: Object.assign(
        new Error('Free tier requests on this model are rate-limited.'),
        { name: 'GatewayRateLimitError' },
      ),
    })

    expect(modelFailureMessage(error)).toContain(limited)
  })

  it('recognises a limit by its status code alone', () => {
    const error = Object.assign(new Error('Request failed'), {
      statusCode: 429,
    })

    expect(modelFailureMessage(error)).toContain(limited)
  })

  it('finds the limit through a chain of causes', () => {
    const error = new Error('outer', {
      cause: new Error('inner', { cause: new Error('429 Too Many Requests') }),
    })

    expect(modelFailureMessage(error)).toContain(limited)
  })

  it('does not promise that waiting helps for any other failure', () => {
    expect(modelFailureMessage(new Error('socket hang up'))).toBe(
      'Das Modell hat nicht geantwortet. Bitte versuche es noch einmal.',
    )
  })

  it('survives something that is not an error at all', () => {
    for (const value of [null, undefined, 'kaputt', 42]) {
      expect(modelFailureMessage(value)).toContain('nicht geantwortet')
    }
  })

  it('does not dig endlessly through a cause that points at itself', () => {
    const error: Error & { cause?: unknown } = new Error('loop')
    error.cause = error

    expect(modelFailureMessage(error)).toContain('nicht geantwortet')
  })
})
