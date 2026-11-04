import { DateTime } from 'luxon'

/** When a court can be booked. Times are local to the venue ("HH:MM" or "HH:MM:SS"). */
export interface CourtSchedule {
  opensAt: string
  closesAt: string
  slotMinutes: number
  timezone: string
}

export const MAX_BOOKING_MINUTES = 180

export const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Every bookable slot on a local calendar date, as UTC instants. */
export function daySlots(date: string, schedule: CourtSchedule): { startsAt: Date; endsAt: Date }[] {
  const day = DateTime.fromISO(date, { zone: schedule.timezone }).startOf('day')
  if (!day.isValid) throw new Error(`Invalid date: ${date}`)

  const slots: { startsAt: Date; endsAt: Date }[] = []
  const close = minutesOfDay(schedule.closesAt)
  for (let m = minutesOfDay(schedule.opensAt); m + schedule.slotMinutes <= close; m += schedule.slotMinutes) {
    const start = day.plus({ minutes: m })
    slots.push({ startsAt: start.toJSDate(), endsAt: start.plus({ minutes: schedule.slotMinutes }).toJSDate() })
  }
  return slots
}

/** Why a booking can't be made at this time, or null if it fits the court's schedule. */
export function bookingProblem(startsAt: Date, durationMinutes: number, schedule: CourtSchedule, now = new Date()): string | null {
  if (startsAt.getTime() <= now.getTime()) return 'Bookings must start in the future'

  const { slotMinutes } = schedule
  if (durationMinutes <= 0 || durationMinutes % slotMinutes !== 0 || durationMinutes > MAX_BOOKING_MINUTES) {
    return `Duration must be a multiple of ${slotMinutes} minutes, up to ${MAX_BOOKING_MINUTES}`
  }

  const local = DateTime.fromJSDate(startsAt, { zone: schedule.timezone })
  const start = local.hour * 60 + local.minute
  const open = minutesOfDay(schedule.opensAt)
  const close = minutesOfDay(schedule.closesAt)

  if (local.second !== 0 || local.millisecond !== 0) return 'Bookings must start on a whole minute'
  if (start < open) return `The court opens at ${schedule.opensAt.slice(0, 5)}`
  if ((start - open) % slotMinutes !== 0) return `Bookings start every ${slotMinutes} minutes from ${schedule.opensAt.slice(0, 5)}`
  if (start + durationMinutes > close) return `The court closes at ${schedule.closesAt.slice(0, 5)}`
  return null
}
