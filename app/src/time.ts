// Dates and times are always shown in the provider's time zone: "10:00" means 10:00 where the appointment happens.

import type { Lang } from './i18n'

const locale = (lang: Lang) => (lang === 'es' ? 'es-AR' : 'en-US')

/** The local date (YYYY-MM-DD) in `zone`, some days from now. */
export function localDate(zone: string, daysAhead = 0, now = new Date()): string {
  const d = new Date(now.getTime() + daysAhead * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** The next `count` local dates in `zone`, starting today. */
export const nextDates = (zone: string, count: number, now = new Date()) => Array.from({ length: count }, (_, i) => localDate(zone, i, now))

/** "HH:MM" in `zone`. */
export const formatTime = (iso: string, zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

/** "vie 20 nov" / "Fri, Nov 20" in `zone`. */
export const formatDay = (iso: string, zone: string, lang: Lang) =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))

/** Same as formatDay, for a plain YYYY-MM-DD date. */
export const formatDate = (date: string, lang: Lang) => formatDay(`${date}T12:00:00Z`, 'UTC', lang)

/** Weekday name for an ISO weekday (1 = Monday). */
export const weekdayName = (weekday: number, lang: Lang, style: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', weekday: style }).format(new Date(Date.UTC(2024, 0, weekday))) // 2024-01-01 was a Monday

export const formatPrice = (cents: number, lang: Lang) =>
  new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'ARS', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)

export const formatDuration = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}`)

/** "en 3 h" / "hace 5 min": how far `iso` is from now, in minutes, hours or days. */
export function relative(iso: string, lang: Lang, now = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'always', style: 'short' })
  if (minutes === 0) return lang === 'es' ? 'ahora' : 'just now'
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  if (Math.abs(minutes) < 48 * 60) return rtf.format(Math.round(minutes / 60), 'hour')
  return rtf.format(Math.round(minutes / 1440), 'day')
}

/** The browser's time zone, the default for a new provider profile. */
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires'
