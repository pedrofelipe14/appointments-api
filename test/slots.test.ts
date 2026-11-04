import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { freeSlots, slotProblem, type WorkingRange } from '../src/scheduling/slots'

const ZONE = 'America/Argentina/Buenos_Aires'
// Monday 2030-03-04, 08:00 local: far from any real "now".
const NOW = DateTime.fromISO('2030-03-04T08:00', { zone: ZONE }).toJSDate()
const MONDAY = '2030-03-04'
const local = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat('ccc HH:mm')
const at = (date: string, time: string) => DateTime.fromISO(`${date}T${time}`, { zone: ZONE }).toJSDate()

const weekdays: WorkingRange[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startsAt: '09:00', endsAt: '13:00' },
  { weekday, startsAt: '14:00', endsAt: '18:00' },
])

const search = (over: Partial<Parameters<typeof freeSlots>[0]> = {}) =>
  freeSlots({ timezone: ZONE, hours: weekdays, durationMinutes: 60, from: MONDAY, to: MONDAY, busy: [], now: NOW, ...over })

describe('freeSlots', () => {
  it('walks the 15-minute grid inside each working range, skipping the lunch break', () => {
    const slots = search().map((s) => local(s.start))
    expect(slots[0]).toBe('Mon 09:00')
    expect(slots).toContain('Mon 12:00') // ends exactly at 13:00
    expect(slots).not.toContain('Mon 12:15') // would run into lunch
    expect(slots).not.toContain('Mon 13:00')
    expect(slots).toContain('Mon 14:00')
    expect(slots.at(-1)).toBe('Mon 17:00')
    expect(slots).toHaveLength(13 * 2)
  })

  it('honours the time-of-day preference', () => {
    expect(local(search({ timeOfDay: 'afternoon' })[0].start)).toBe('Mon 12:00') // 12:00-13:00 fits before lunch
    expect(search({ timeOfDay: 'evening' })).toEqual([])
    expect(search({ timeOfDay: 'morning' }).every((s) => s.start < at(MONDAY, '12:00:01'))).toBe(true)
  })

  it('skips busy time, including partial overlaps', () => {
    const busy = [{ start: at(MONDAY, '09:30'), end: at(MONDAY, '10:30') }]
    const slots = search({ busy }).map((s) => local(s.start))
    expect(slots).not.toContain('Mon 09:00')
    expect(slots).not.toContain('Mon 10:15')
    expect(slots[0]).toBe('Mon 10:30') // starts the moment the busy block ends
  })

  it('needs an hour of notice', () => {
    const slots = search({ now: at(MONDAY, '10:05') }).map((s) => local(s.start))
    expect(slots[0]).toBe('Mon 11:15')
  })

  it('spans several days and skips days off', () => {
    const slots = search({ from: '2030-03-08', to: '2030-03-11' }).map((s) => local(s.start)) // Fri..Mon
    expect(slots[0]).toBe('Fri 09:00')
    expect(slots.some((s) => s.startsWith('Sat') || s.startsWith('Sun'))).toBe(false)
    expect(slots.at(-1)).toBe('Mon 17:00')
  })

  it('returns nothing when the service is longer than any range', () => {
    expect(search({ durationMinutes: 300 })).toEqual([])
  })
})

describe('slotProblem', () => {
  it('accepts a time that fits', () => {
    expect(slotProblem(at(MONDAY, '15:30'), 60, ZONE, weekdays, NOW)).toBeNull()
  })

  it('explains what is wrong', () => {
    expect(slotProblem(at(MONDAY, '08:30'), 60, ZONE, weekdays, NOW)).toMatch(/notice/)
    expect(slotProblem(at(MONDAY, '15:10'), 60, ZONE, weekdays, NOW)).toMatch(/grid/)
    expect(slotProblem(at(MONDAY, '12:30'), 60, ZONE, weekdays, NOW)).toMatch(/working hours/)
    expect(slotProblem(at('2030-03-09', '10:00'), 60, ZONE, weekdays, NOW)).toMatch(/working hours/) // Saturday
  })
})
