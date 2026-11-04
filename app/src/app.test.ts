import { afterEach, describe, expect, it, vi } from 'vitest'
import { Api, ApiError, errorMessage } from './api'
import { DEFAULT_WEEK, fromWeek, invalidDays, nextRange, summarize, toWeek } from './hours'
import { STRINGS } from './i18n'
import { formatTime, localDate, nextDates, relative, weekdayName } from './time'

describe('weekly hours', () => {
  const hours = [
    { weekday: 3, startsAt: '14:00', endsAt: '18:00' },
    { weekday: 3, startsAt: '09:00', endsAt: '13:00' },
    { weekday: 6, startsAt: '10:00', endsAt: '12:00' },
  ]

  it('round-trips between the API list and the per-day editor, sorted', () => {
    const week = toWeek(hours)
    expect(week[3].map((r) => r.startsAt)).toEqual(['09:00', '14:00'])
    expect(week[1]).toEqual([])
    expect(fromWeek(week)).toEqual([hours[1], hours[0], hours[2]])
  })

  it('flags backwards and overlapping ranges', () => {
    const week = toWeek(hours)
    expect(invalidDays(week)).toEqual([])
    week[3][1] = { startsAt: '12:00', endsAt: '18:00' } // overlaps 09-13
    week[6][0] = { startsAt: '12:00', endsAt: '10:00' } // backwards
    expect(invalidDays(week)).toEqual([3, 6])
  })

  it('groups consecutive identical days for the provider card', () => {
    expect(summarize(fromWeek(DEFAULT_WEEK))).toEqual([{ days: [1, 2, 3, 4, 5], ranges: '09:00–13:00, 14:00–18:00' }])
    expect(summarize(hours).map((g) => g.days)).toEqual([[3], [6]])
  })

  it('suggests the next range after the last one, inside the day', () => {
    expect(nextRange([])).toEqual({ startsAt: '09:00', endsAt: '13:00' })
    expect(nextRange([{ startsAt: '09:00', endsAt: '13:00' }])).toEqual({ startsAt: '14:00', endsAt: '18:00' })
    expect(nextRange([{ startsAt: '18:00', endsAt: '22:30' }])).toEqual({ startsAt: '22:00', endsAt: '23:45' })
  })
})

describe('times in the provider zone', () => {
  // 2026-11-20 02:30 UTC is still the 19th, 23:30, in Buenos Aires (UTC-3).
  const now = new Date('2026-11-20T02:30:00Z')

  it('uses the local date of the zone, not UTC', () => {
    expect(localDate('America/Argentina/Buenos_Aires', 0, now)).toBe('2026-11-19')
    expect(localDate('UTC', 0, now)).toBe('2026-11-20')
    expect(nextDates('America/Argentina/Buenos_Aires', 3, now)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21'])
  })

  it('formats times in the zone, 24 h', () => {
    expect(formatTime('2026-11-20T19:15:00Z', 'America/Argentina/Buenos_Aires')).toBe('16:15')
    expect(formatTime('2026-11-20T00:00:00Z', 'UTC')).toBe('00:00')
  })

  it('names ISO weekdays', () => {
    expect(weekdayName(1, 'en')).toBe('Monday')
    expect(weekdayName(7, 'es')).toBe('domingo')
  })

  it('describes how far a time is, both ways', () => {
    const at = Date.parse('2026-11-20T12:00:00Z')
    expect(relative('2026-11-20T15:00:00Z', 'en', at)).toBe('in 3 hr.')
    expect(relative('2026-11-20T11:55:00Z', 'en', at)).toBe('5 min. ago')
    expect(relative('2026-11-20T12:00:20Z', 'es', at)).toBe('ahora')
  })
})

describe('API client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads NestJS error bodies', () => {
    expect(errorMessage({ message: 'That time is taken' }, 409)).toBe('That time is taken')
    expect(errorMessage({ message: ['name should not be empty', 'email must be an email'] }, 400)).toBe('name should not be empty · email must be an email')
    expect(errorMessage(null, 502)).toBe('HTTP 502')
  })

  it('sends the token and JSON body, and throws the status on failure', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Already answered' }), { status: 409 }))
    vi.stubGlobal('fetch', fetch)
    const err = await new Api('http://api.test/', 'tok').reject('a1', 'away').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, message: 'Already answered' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/appointments/a1/reject')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' })
    expect(init.body).toBe('{"reason":"away"}')
  })

  it('reports an unreachable server as status 0', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(new Api('http://nowhere').providers()).rejects.toMatchObject({ status: 0 })
  })
})

describe('translations', () => {
  const shape = (o: object): unknown => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? shape(v) : typeof v]))

  it('has the same keys in Spanish and English', () => {
    expect(shape(STRINGS.en)).toEqual(shape(STRINGS.es))
  })
})
