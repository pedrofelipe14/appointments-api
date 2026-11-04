// The weekly schedule editor works on one list of ranges per weekday; the API takes a flat list.

import type { WorkingRange } from './api'

export type Week = Record<number, { startsAt: string; endsAt: string }[]> // ISO weekday -> ranges

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function toWeek(hours: WorkingRange[]): Week {
  const week: Week = Object.fromEntries(WEEKDAYS.map((d) => [d, []]))
  for (const h of hours) week[h.weekday].push({ startsAt: h.startsAt, endsAt: h.endsAt })
  for (const d of WEEKDAYS) week[d].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return week
}

export const fromWeek = (week: Week): WorkingRange[] => WEEKDAYS.flatMap((weekday) => week[weekday].map((r) => ({ weekday, ...r })))

/** The weekdays whose ranges are empty, backwards or overlapping (the API would reject them). */
export function invalidDays(week: Week): number[] {
  return WEEKDAYS.filter((d) => {
    const ranges = [...week[d]].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    return ranges.some((r, i) => r.startsAt >= r.endsAt || (i > 0 && r.startsAt < ranges[i - 1].endsAt))
  })
}

/** A sensible first schedule: Monday to Friday, 9 to 13 and 14 to 18. */
export const DEFAULT_WEEK: Week = toWeek(
  [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startsAt: '09:00', endsAt: '13:00' },
    { weekday, startsAt: '14:00', endsAt: '18:00' },
  ]),
)

/** Compact summary for a provider card, e.g. [[1,2,3,4,5], "09:00–13:00, 14:00–18:00"] grouped by identical days. */
export function summarize(hours: WorkingRange[]): { days: number[]; ranges: string }[] {
  const week = toWeek(hours)
  const groups: { days: number[]; ranges: string }[] = []
  for (const d of WEEKDAYS) {
    if (!week[d].length) continue
    const ranges = week[d].map((r) => `${r.startsAt}–${r.endsAt}`).join(', ')
    const last = groups[groups.length - 1]
    if (last && last.ranges === ranges && last.days[last.days.length - 1] === d - 1) last.days.push(d)
    else groups.push({ days: [d], ranges })
  }
  return groups
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** The range "+ range" adds: an hour after the day's last one, four hours long, or 9 to 13 on an empty day. */
export function nextRange(ranges: { startsAt: string; endsAt: string }[]): { startsAt: string; endsAt: string } {
  const last = ranges[ranges.length - 1]
  if (!last) return { startsAt: '09:00', endsAt: '13:00' }
  const start = Math.min(minutes(last.endsAt) + 60, 22 * 60)
  return { startsAt: hhmm(start), endsAt: hhmm(Math.min(start + 4 * 60, 23 * 60 + 45)) }
}
