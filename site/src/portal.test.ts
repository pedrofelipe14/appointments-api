import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { byTag, example, type OpenApiSpec, operations, resolve, schemaName } from './openapi'
import { curl, javascript, python } from './snippets'
import { STRINGS } from './i18n'

const spec: OpenApiSpec = JSON.parse(readFileSync(new URL('../public/openapi.json', import.meta.url), 'utf8'))

describe('reading the generated OpenAPI spec', () => {
  const ops = operations(spec)

  it('finds every endpoint of the API', () => {
    expect(ops).toHaveLength(15)
    expect(ops.map((o) => `${o.method} ${o.path}`)).toContain('POST /bookings')
    expect(ops.every((o) => o.summary)).toBe(true) // every endpoint documents itself
  })

  it('knows which endpoints need a token', () => {
    const find = (m: string, p: string) => ops.find((o) => o.method === m && o.path === p)!
    expect(find('POST', '/bookings').auth).toBe(true)
    expect(find('GET', '/courts/{id}/availability').auth).toBe(false)
  })

  it('groups endpoints by area', () => {
    expect(byTag(ops).map(([tag]) => tag)).toEqual(['health', 'venues', 'courts', 'bookings', 'auth'])
  })

  it('builds request examples from the examples written in the API code', () => {
    const book = ops.find((o) => o.method === 'POST' && o.path === '/bookings')!
    expect(schemaName(book.body)).toBe('CreateBookingDto')
    expect(example(spec, book.body)).toMatchObject({ durationMinutes: 60, startsAt: '2026-11-20T20:00:00-03:00' })
    expect(resolve(spec, book.body)?.required).toContain('courtId')
  })
})

describe('code snippets', () => {
  const call = { method: 'POST', path: '/bookings', auth: true, body: { courtId: 'abc', durationMinutes: 60, paid: false } }

  it('writes curl', () => {
    expect(curl(call, 'https://api.test')).toBe(
      `curl -X POST "https://api.test/bookings" \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"courtId":"abc","durationMinutes":60,"paid":false}'`,
    )
  })

  it('writes JavaScript with the token and JSON body', () => {
    const js = javascript(call, 'https://api.test')
    expect(js).toContain("fetch('https://api.test/bookings'")
    expect(js).toContain('Authorization: `Bearer ${token}`')
    expect(js).toContain('"durationMinutes": 60')
  })

  it('writes Python with Python literals and query params', () => {
    const py = python(call, 'https://api.test')
    expect(py).toContain('requests.post(')
    expect(py).toContain('"paid": False')
    expect(python({ method: 'GET', path: '/x', query: { date: '2026-11-20' } }, 'h')).toContain('params={"date":"2026-11-20"}')
  })
})

describe('translations', () => {
  it('has the same texts in Spanish and English', () => {
    const shape = (o: object): unknown =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v === 'object' && v ? shape(v) : typeof v]))
    expect(shape(STRINGS.en)).toEqual(shape(STRINGS.es))
  })
})
