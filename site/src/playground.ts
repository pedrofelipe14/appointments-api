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

  /** Quiet call: not logged (used for the sign-ups before the race). */
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

/** A date some days ahead, as the provider's local YYYY-MM-DD. */
export function localDate(daysAhead: number, now = new Date()): string {
  const d = new Date(now.getTime() + daysAhead * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** "HH:MM" at the provider for an ISO timestamp. */
export const localTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const uid = () => Math.random().toString(36).slice(2, 8)
const PASSWORD = 'demo-password-123'

async function account(api: ApiClient, role: 'provider' | 'client', name: string, logged: boolean): Promise<string> {
  const email = `${name.toLowerCase()}-${uid()}@demo.dev`
  const call = logged ? api.call.bind(api) : api.silent.bind(api)
  await call('POST', '/auth/register', { email, name, password: PASSWORD, role })
  const login = await call<{ accessToken: string }>('POST', '/auth/login', { email, password: PASSWORD })
  return login.data.accessToken
}

/** A guitar teacher working every day from `opens` to `closes`, offering a 60-minute class. */
async function setUpProvider(api: ApiClient, logged: boolean, opens: string, closes: string) {
  const token = await account(api, 'provider', 'Lucia', logged)
  const call = logged ? api.call.bind(api) : api.silent.bind(api)
  const provider = await call<{ id: string }>('POST', '/providers', { name: `Lucía · guitarra ${uid()}`, confirmWithinHours: 24 }, token)
  const hours = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startsAt: opens, endsAt: closes }))
  await call('PUT', `/providers/${provider.data.id}/working-hours`, { hours }, token)
  const service = await call<{ id: string }>('POST', `/providers/${provider.data.id}/services`,
    { name: 'Clase individual', durationMinutes: 60, priceCents: 2_000_000 }, token)
  return { token, providerId: provider.data.id, serviceId: service.data.id }
}

export async function runTour(api: ApiClient): Promise<void> {
  const lucia = await setUpProvider(api, true, '10:00', '19:00')
  const lio = await account(api, 'client', 'Lio', true)
  const fede = await account(api, 'client', 'Fede', true)
  const window = { from: localDate(1), to: localDate(7), timeOfDay: 'afternoon' }

  const first = await api.call<{ id: string; startsAt: string }>('POST', '/appointments',
    { serviceId: lucia.serviceId, ...window, note: 'Primera clase' }, lio, 'Lio · "this week, afternoon"')
  await api.call('POST', '/appointments', { serviceId: lucia.serviceId, startsAt: first.data.startsAt }, fede,
    `Fede · ${localTime(first.data.startsAt)}, taken`)
  const second = await api.call<{ id: string }>('POST', '/appointments', { serviceId: lucia.serviceId, ...window }, fede, 'Fede · first free afternoon')
  await api.call('GET', '/appointments/inbox?status=pending', undefined, lucia.token, 'Lucía · pending')
  await api.call('POST', `/appointments/${first.data.id}/confirm`, undefined, lucia.token, 'Lucía confirms Lio')
  await api.call('POST', `/appointments/${second.data.id}/reject`, { reason: 'Ese día no puedo, ¿probás el jueves?' }, lucia.token, 'Lucía rejects Fede')
  await api.call('GET', '/notifications', undefined, fede, 'Fede · notifications')
}

export type Cell = { status: number | 'pending'; time?: string }

/** 10 clients ask for "any time that day" at once; the day has exactly 10 one-hour slots.
    onCell reports each request's outcome; an 11th, late request finds the day full. */
export async function runRace(
  api: ApiClient,
  onCell: (index: number, cell: Cell) => void,
  clients = 10,
): Promise<{ distinct: number; late: number }> {
  const { serviceId } = await setUpProvider(api, true, '09:00', '19:00')
  const tokens: string[] = []
  for (let i = 0; i < clients; i++) {
    tokens.push(await account(api, 'client', `Client${i}`, false))
    onCell(i, { status: 'pending' })
  }
  const day = localDate(5)
  const times = await Promise.all(
    tokens.map(async (token, i) => {
      const res = await api.silent<{ startsAt: string }>('POST', '/appointments', { serviceId, from: day, to: day }, token)
      const time = res.status === 201 ? localTime(res.data.startsAt) : undefined
      onCell(i, { status: res.status, time })
      return time
    }),
  )
  const late = await account(api, 'client', 'Late', false)
  const full = await api.call('POST', '/appointments', { serviceId, from: day, to: day }, late, 'Client 11 · day is full')
  return { distinct: new Set(times.filter(Boolean)).size, late: full.status }
}
