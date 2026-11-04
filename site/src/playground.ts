// The live scenarios behind "Try it": real calls to the API, each one logged for the page.

export interface LogEntry {
  id: number
  method: string
  path: string
  body?: unknown
  status?: number
  response?: unknown
  ms?: number
  note?: string
}

export interface Reply<T = any> {
  status: number
  data: T
}

/** fetch, with every request and its answer reported to onLog. */
export class ApiClient {
  private next = 0

  constructor(private readonly base: string, private readonly onLog: (entry: LogEntry) => void) {}

  async call<T = any>(method: string, path: string, body?: unknown, token?: string, note?: string): Promise<Reply<T>> {
    const entry: LogEntry = { id: ++this.next, method, path, body, note }
    this.onLog(entry)
    const started = performance.now()
    const res = await fetch(this.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    this.onLog({ ...entry, status: res.status, response: data, ms: Math.round(performance.now() - started) })
    return { status: res.status, data }
  }

  /** Quiet call: not logged (used for the 25 sign-ups before the race). */
  async silent<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<Reply<T>> {
    const res = await fetch(this.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }
}

const ZONE = 'America/Argentina/Buenos_Aires'

/** A date some days ahead, as the venue's local YYYY-MM-DD. */
export function localDate(daysAhead: number, now = new Date()): string {
  const d = new Date(now.getTime() + daysAhead * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** A local time at the venue (Argentina is UTC-3 all year). */
export const atLocal = (date: string, hhmm: string) => `${date}T${hhmm}:00-03:00`

const uid = () => Math.random().toString(36).slice(2, 8)
const PASSWORD = 'demo-password-123'

async function account(api: ApiClient, role: 'owner' | 'player', name: string, logged: boolean): Promise<string> {
  const email = `${name.toLowerCase()}-${uid()}@demo.dev`
  const call = logged ? api.call.bind(api) : api.silent.bind(api)
  await call('POST', '/auth/register', { email, name, password: PASSWORD, role })
  const login = await call<{ accessToken: string }>('POST', '/auth/login', { email, password: PASSWORD })
  return login.data.accessToken
}

/** An owner with a fresh venue and a 5-a-side court open 09:00-23:00. */
async function setUpCourt(api: ApiClient, logged: boolean): Promise<{ owner: string; venueId: string; courtId: string }> {
  const owner = await account(api, 'owner', 'Marta', logged)
  const call = logged ? api.call.bind(api) : api.silent.bind(api)
  const venue = await call<{ id: string }>('POST', '/venues', { name: `Complejo ${uid()}`, address: 'Calle Falsa 123' }, owner)
  const court = await call<{ id: string }>('POST', `/venues/${venue.data.id}/courts`,
    { name: 'Cancha 1', sport: 'futbol5', pricePerHourCents: 4_500_000, opensAt: '09:00', closesAt: '23:00' }, owner)
  return { owner, venueId: venue.data.id, courtId: court.data.id }
}

export async function runTour(api: ApiClient): Promise<void> {
  const { owner, venueId, courtId } = await setUpCourt(api, true)
  const lio = await account(api, 'player', 'Lio', true)
  const fede = await account(api, 'player', 'Fede', true)
  const date = localDate(3)

  await api.call('GET', `/courts/${courtId}/availability?date=${date}`)
  const booking = await api.call<{ id: string }>('POST', '/bookings', { courtId, startsAt: atLocal(date, '20:00'), durationMinutes: 120 }, lio, 'Lio · 20:00–22:00')
  await api.call('POST', '/bookings', { courtId, startsAt: atLocal(date, '21:00'), durationMinutes: 60 }, fede, 'Fede · 21:00–22:00')
  await api.call('POST', '/bookings', { courtId, startsAt: atLocal(date, '22:00'), durationMinutes: 60 }, fede, 'Fede · 22:00–23:00')
  await api.call('POST', '/bookings', { courtId, startsAt: atLocal(date, '08:00'), durationMinutes: 60 }, fede, 'Fede · 08:00')
  await api.call('GET', `/venues/${venueId}/bookings?date=${date}`, undefined, owner, 'Marta · agenda')
  await api.call('POST', `/bookings/${booking.data.id}/cancel`, undefined, lio, 'Lio · cancel')
}

/** 25 players fire a booking for the same slot at once. onCell reports each request's outcome. */
export async function runRace(
  api: ApiClient,
  onCell: (index: number, status: number | 'pending') => void,
  players = 25,
): Promise<{ won: number; lost: number }> {
  const { courtId } = await setUpCourt(api, true)
  const tokens: string[] = []
  for (let i = 0; i < players; i++) {
    tokens.push(await account(api, 'player', `Fan${i}`, false))
    onCell(i, 'pending')
  }
  const startsAt = atLocal(localDate(5), '21:00')
  const results = await Promise.all(
    tokens.map(async (token, i) => {
      const res = await api.silent('POST', '/bookings', { courtId, startsAt, durationMinutes: 60 }, token)
      onCell(i, res.status)
      return res.status
    }),
  )
  await api.call('GET', `/courts/${courtId}/availability?date=${localDate(5)}`, undefined, undefined, '21:00')
  return { won: results.filter((s) => s === 201).length, lost: results.filter((s) => s === 409).length }
}
