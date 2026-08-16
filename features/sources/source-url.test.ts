import { describe, expect, it } from 'vitest'
import { isYoutubeUrl, sourceHostLabel } from '@/features/sources/source-url'

describe('sourceHostLabel', () => {
  it('returns the hostname', () => {
    expect(sourceHostLabel('https://bmwk.de/bericht')).toBe('bmwk.de')
  })

  it('strips a leading www.', () => {
    expect(sourceHostLabel('https://www.bmwk.de/bericht')).toBe('bmwk.de')
  })

  it('strips www. only at the start', () => {
    expect(sourceHostLabel('https://www.www-archiv.de')).toBe('www-archiv.de')
  })

  it('keeps subdomains', () => {
    expect(sourceHostLabel('https://docs.example.com/a/b')).toBe(
      'docs.example.com',
    )
  })

  it('truncates invalid input to 40 characters instead of throwing', () => {
    const input = 'not a link but a rather long free text without an end'
    expect(sourceHostLabel(input)).toBe(input.slice(0, 40))
    expect(sourceHostLabel(input)).toHaveLength(40)
  })

  it('handles empty input', () => {
    expect(sourceHostLabel('')).toBe('')
  })
})

describe('isYoutubeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://youtu.be/abc',
    'https://youtube.com/shorts/abc',
  ])('detects %s as a video', (url) => {
    expect(isYoutubeUrl(url)).toBe(true)
  })

  it.each(['https://bmwk.de/bericht', 'https://vimeo.com/123'])(
    'does not detect %s as a video',
    (url) => {
      expect(isYoutubeUrl(url)).toBe(false)
    },
  )
})
