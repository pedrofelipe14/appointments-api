import type { INestApplication } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Pool } from 'pg'
import request from 'supertest'
import { createApp } from '../src/app'
import { migrate } from '../src/db/migrate'

// Every test runs against a real PostgreSQL: CI starts one as a service; locally see the README.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/courts_test'
export const ZONE = 'America/Argentina/Buenos_Aires'

export interface TestContext {
  app: INestApplication
  pool: Pool
  http: () => ReturnType<typeof request>
}

export async function startApp(): Promise<TestContext> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  await migrate(pool)
  const app = await createApp({ databaseUrl: TEST_DATABASE_URL, jwtSecret: 'test-secret-that-is-long-enough', port: 0 })
  await app.init()
  return { app, pool, http: () => request(app.getHttpServer()) }
}

export async function stopApp(ctx: TestContext): Promise<void> {
  await ctx.app.close()
  await ctx.pool.end()
}

export async function resetDb(pool: Pool): Promise<void> {
  await pool.query('truncate bookings, courts, venues, users restart identity cascade')
}

let counter = 0

/** Registers a user and returns their bearer token. */
export async function signUp(ctx: TestContext, role: 'player' | 'owner' = 'player'): Promise<{ token: string; id: string }> {
  const email = `user${++counter}-${Date.now()}@test.dev`
  const registered = await ctx.http().post('/auth/register').send({ email, name: 'Test', password: 'a-long-password', role }).expect(201)
  const login = await ctx.http().post('/auth/login').send({ email, password: 'a-long-password' }).expect(200)
  return { token: `Bearer ${login.body.accessToken}`, id: registered.body.id }
}

/** An owner, their venue and one court open 09:00-23:00 in 60-minute slots at ARS 45,000/h. */
export async function venueWithCourt(ctx: TestContext) {
  const owner = await signUp(ctx, 'owner')
  const venue = await ctx.http().post('/venues').set('Authorization', owner.token)
    .send({ name: 'La Bombonerita', address: 'Calle Falsa 123' }).expect(201)
  const court = await ctx.http().post(`/venues/${venue.body.id}/courts`).set('Authorization', owner.token)
    .send({ name: 'Cancha 1', sport: 'futbol5', pricePerHourCents: 4_500_000, opensAt: '09:00', closesAt: '23:00' })
    .expect(201)
  return { owner, venueId: venue.body.id as string, courtId: court.body.id as string }
}

/** A local date at the venue, some days from now (YYYY-MM-DD). */
export const daysFromNow = (days: number): string => DateTime.now().setZone(ZONE).plus({ days }).toISODate()!

/** ISO timestamp for a local time at the venue on that date. */
export const at = (date: string, time: string): string => DateTime.fromISO(`${date}T${time}`, { zone: ZONE }).toISO()!
