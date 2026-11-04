import { describe, expect, it } from 'vitest'
import { bookingProblem, type CourtSchedule, daySlots } from '../src/courts/schedule'

const court: CourtSchedule = { opensAt: '09:00:00', closesAt: '23:00:00', slotMinutes: 60, timezone: 'America/Argentina/Buenos_Aires' }
const now = new Date('2026-11-01T12:00:00Z')
const local = (iso: string) => new Date(`${iso}-03:00`) // Argentina is UTC-3 all year

describe('daySlots', () => {
  it('lists every slot from opening to closing, in UTC', () => {
    const slots = daySlots('2026-11-20', court)
    expect(slots).toHaveLength(14) // 09:00 .. 22:00
    expect(slots[0].startsAt.toISOString()).toBe('2026-11-20T12:00:00.000Z')
    expect(slots[13].endsAt.toISOString()).toBe('2026-11-21T02:00:00.000Z') // 23:00 local
  })

  it('drops a final slot that would run past closing', () => {
    expect(daySlots('2026-11-20', { ...court, slotMinutes: 90 })).toHaveLength(9) // 09:00 .. 21:00 + 90 = 22:30
  })
})

describe('bookingProblem', () => {
  it('accepts a booking on the grid inside opening hours', () => {
    expect(bookingProblem(local('2026-11-20T20:00:00'), 60, court, now)).toBeNull()
    expect(bookingProblem(local('2026-11-20T21:00:00'), 120, court, now)).toBeNull() // ends exactly at closing
  })

  it.each([
    ['2026-10-30T20:00:00', 60, 'future'],
    ['2026-11-20T08:00:00', 60, 'opens'],
    ['2026-11-20T20:30:00', 60, 'every 60 minutes'],
    ['2026-11-20T22:00:00', 120, 'closes'],
    ['2026-11-20T20:00:00', 45, 'multiple of 60'],
    ['2026-11-20T12:00:00', 240, 'up to 180'],
  ])('rejects %s for %i minutes (%s)', (start, minutes, message) => {
    expect(bookingProblem(local(start), minutes, court, now)).toContain(message)
  })
})
