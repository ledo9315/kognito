import { describe, expect, it } from 'vitest'
import { updatedLabel } from '@/lib/relative-time'

const now = new Date('2026-08-12T10:00:00')

describe('updatedLabel', () => {
  it('names the recent days instead of printing a date', () => {
    expect(updatedLabel(new Date('2026-08-12T09:00:00'), now)).toBe('Heute')
    expect(updatedLabel(new Date('2026-08-11T23:30:00'), now)).toBe('Gestern')
    expect(updatedLabel(new Date('2026-08-08T12:00:00'), now)).toBe('Vor 4 Tagen')
  })

  it('counts calendar days, not 24 hour blocks', () => {
    // Two hours earlier, but on the previous day.
    expect(updatedLabel(new Date('2026-08-11T23:59:00'), new Date('2026-08-12T00:30:00'))).toBe(
      'Gestern',
    )
  })

  it('falls back to a date beyond a week', () => {
    expect(updatedLabel(new Date('2026-06-01T10:00:00'), now)).toBe('1. Juni 2026')
  })

  it('does not claim a future timestamp was days ago', () => {
    expect(updatedLabel(new Date('2026-09-01T10:00:00'), now)).toBe('1. Sept. 2026')
  })
})
