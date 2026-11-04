import { DateTime } from 'luxon'

/** One range of a provider's weekly schedule, local to them. weekday: 1 = Monday ... 7 = Sunday. */
export interface WorkingRange {
  weekday: number
  startsAt: string // "HH:MM" or "HH:MM:SS"
  endsAt: string
}

export interface Interval {
  start: Date
  end: Date
}

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening'

/** Local hours each preference covers, [from, to) in minutes of the day. */
export const TIME_OF_DAY: Record<TimeOfDay, [number, number]> = {
  any: [0, 24 * 60],
  morning: [6 * 60, 12 * 60],
  afternoon: [12 * 60, 19 * 60],
  evening: [19 * 60, 24 * 60],
}

/** Appointments start on a 15-minute grid. */
export const GRID_MINUTES = 15
/** The earliest a request can be scheduled: some notice for the provider. */
export const MIN_NOTICE_MINUTES = 60

export const minutesOfDay = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

export interface SearchOptions {
  timezone: string
  hours: WorkingRange[]
  durationMinutes: number
  /** First and last local dates to search (YYYY-MM-DD), inclusive. */
  from: string
  to: string
  timeOfDay?: TimeOfDay
  /** Time already taken (active appointments). */
  busy: Interval[]
  now?: Date
}

/** Every free start time in the window, earliest first: inside working hours, on the grid,
    matching the time-of-day preference, with enough notice, and not overlapping anything busy. */
export function freeSlots(opts: SearchOptions): Interval[] {
  const now = opts.now ?? new Date()
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60_000
  const [prefFrom, prefTo] = TIME_OF_DAY[opts.timeOfDay ?? 'any']
  const out: Interval[] = []

  let day = DateTime.fromISO(opts.from, { zone: opts.timezone }).startOf('day')
  const last = DateTime.fromISO(opts.to, { zone: opts.timezone }).startOf('day')
  if (!day.isValid || !last.isValid) throw new Error('Invalid date range')

  for (; day <= last; day = day.plus({ days: 1 })) {
    const ranges = opts.hours
      .filter((r) => r.weekday === day.weekday)
      .sort((a, b) => minutesOfDay(a.startsAt) - minutesOfDay(b.startsAt))

    for (const range of ranges) {
      const open = minutesOfDay(range.startsAt)
      const close = minutesOfDay(range.endsAt)
      const firstOnGrid = Math.ceil(open / GRID_MINUTES) * GRID_MINUTES

      for (let m = firstOnGrid; m + opts.durationMinutes <= close; m += GRID_MINUTES) {
        if (m < prefFrom || m >= prefTo) continue
        const start = day.plus({ minutes: m })
        const slot = { start: start.toJSDate(), end: start.plus({ minutes: opts.durationMinutes }).toJSDate() }
        if (slot.start.getTime() < earliest) continue
        if (opts.busy.some((b) => overlaps(b, slot))) continue
        out.push(slot)
      }
    }
  }
  return out
}

/** Why a specific start time can't be requested, or null if it fits the provider's schedule. */
export function slotProblem(
  start: Date,
  durationMinutes: number,
  timezone: string,
  hours: WorkingRange[],
  now = new Date(),
): string | null {
  if (start.getTime() < now.getTime() + MIN_NOTICE_MINUTES * 60_000) {
    return `Appointments need at least ${MIN_NOTICE_MINUTES} minutes of notice`
  }
  const local = DateTime.fromJSDate(start, { zone: timezone })
  if (local.second !== 0 || local.millisecond !== 0 || local.minute % GRID_MINUTES !== 0) {
    return `Appointments start on the ${GRID_MINUTES}-minute grid`
  }
  const m = local.hour * 60 + local.minute
  const fits = hours.some(
    (r) => r.weekday === local.weekday && m >= minutesOfDay(r.startsAt) && m + durationMinutes <= minutesOfDay(r.endsAt),
  )
  return fits ? null : 'Outside the provider\'s working hours'
}
