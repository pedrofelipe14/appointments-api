import type { INestApplication } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Pool } from 'pg'
import request from 'supertest'
import { createApp } from '../src/app'
import { migrate } from '../src/db/migrate'

// Every test runs against a real PostgreSQL: CI starts one as a service; locally see the README.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/appointments_test'
export const ZONE = 'America/Argentina/Buenos_Aires'

export interface TestContext {
  app: INestApplication
  pool: Pool
  http: () => ReturnType<typeof request>
}

export async function startApp(): Promise<TestContext> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  await migrate(pool)
  const app = await createApp({ databaseUrl: TEST_DATABASE_URL, jwtSecret: 'test-secret-that-is-long-enough', port: 0, corsOrigins: [] })
  await app.init()
  return { app, pool, http: () => request(app.getHttpServer()) }
}

export async function stopApp(ctx: TestContext): Promise<void> {
  await ctx.app.close()
  await ctx.pool.end()
}

export async function resetDb(pool: Pool): Promise<void> {
  await pool.query('truncate notifications, appointments, services, working_hours, providers, users restart identity cascade')
}

let counter = 0

export interface TestUser {
  token: string
  id: string
}

/** Registers a user and returns their bearer token. */
export async function signUp(ctx: TestContext, role: 'client' | 'provider' = 'client'): Promise<TestUser> {
  const email = `user${++counter}-${Date.now()}@test.dev`
  const registered = await ctx.http().post('/auth/register').send({ email, name: `User ${counter}`, password: 'a-long-password', role }).expect(201)
  const login = await ctx.http().post('/auth/login').send({ email, password: 'a-long-password' }).expect(200)
  return { token: `Bearer ${login.body.accessToken}`, id: registered.body.id }
}

/** A provider working every day from `opens` to `closes`, offering one 60-minute service. */
export async function providerWithService(ctx: TestContext, opens = '09:00', closes = '19:00') {
  const user = await signUp(ctx, 'provider')
  const provider = await ctx.http().post('/providers').set('Authorization', user.token)
    .send({ name: 'Profe Marta', about: 'Clases de guitarra', timezone: ZONE }).expect(201)
  const hours = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startsAt: opens, endsAt: closes }))
  await ctx.http().put(`/providers/${provider.body.id}/working-hours`).set('Authorization', user.token).send({ hours }).expect(200)
  const service = await ctx.http().post(`/providers/${provider.body.id}/services`).set('Authorization', user.token)
    .send({ name: 'Clase de guitarra', durationMinutes: 60, priceCents: 2_000_000 }).expect(201)
  return { user, providerId: provider.body.id as string, serviceId: service.body.id as string }
}

/** A local date at the provider, some days from now (YYYY-MM-DD). */
export const daysFromNow = (days: number): string => DateTime.now().setZone(ZONE).plus({ days }).toISODate()!

/** ISO timestamp for a local time at the provider on that date. */
export const at = (date: string, time: string): string => DateTime.fromISO(`${date}T${time}`, { zone: ZONE }).toISO()!

/** The local "HH:MM" of an ISO timestamp, at the provider. */
export const localTime = (iso: string): string => DateTime.fromISO(iso).setZone(ZONE).toFormat('HH:mm')
