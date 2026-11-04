import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { at, daysFromNow, resetDb, signUp, startApp, stopApp, type TestContext, venueWithCourt } from './helpers'

let ctx: TestContext
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await stopApp(ctx) })
beforeEach(async () => { await resetDb(ctx.pool) })

const book = (token: string, body: object) => ctx.http().post('/bookings').set('Authorization', token).send(body)

describe('booking a court', () => {
  it('books a slot, holds it for payment and charges by the hour', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const player = await signUp(ctx)
    const date = daysFromNow(3)

    const res = await book(player.token, { courtId, startsAt: at(date, '20:00'), durationMinutes: 90 })
    // 90 minutes is not a whole number of 60-minute slots.
    expect(res.status).toBe(400)

    const ok = await book(player.token, { courtId, startsAt: at(date, '20:00'), durationMinutes: 120 }).expect(201)
    expect(ok.body).toMatchObject({ courtId, userId: player.id, status: 'pending_payment', priceCents: 9_000_000 })
    expect(new Date(ok.body.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('refuses an overlapping booking but allows back-to-back ones', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const [a, b] = [await signUp(ctx), await signUp(ctx)]
    const date = daysFromNow(3)

    await book(a.token, { courtId, startsAt: at(date, '20:00'), durationMinutes: 120 }).expect(201) // 20-22
    await book(b.token, { courtId, startsAt: at(date, '21:00'), durationMinutes: 60 }).expect(409) // overlaps
    await book(b.token, { courtId, startsAt: at(date, '19:00'), durationMinutes: 60 }).expect(201) // ends at 20
    await book(b.token, { courtId, startsAt: at(date, '22:00'), durationMinutes: 60 }).expect(201) // starts at 22
  })

  it('lets exactly one of 25 simultaneous requests win the same slot', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const players = await Promise.all(Array.from({ length: 25 }, () => signUp(ctx)))
    const startsAt = at(daysFromNow(5), '21:00')

    const results = await Promise.all(players.map((p) => book(p.token, { courtId, startsAt, durationMinutes: 60 })))
    const statuses = results.map((r) => r.status)

    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(24)
    const { rows } = await ctx.pool.query(`select count(*)::int as n from bookings where court_id = $1`, [courtId])
    expect(rows[0].n).toBe(1)
  })

  it('rejects bookings outside opening hours, off the grid or in the past', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const player = await signUp(ctx)
    const date = daysFromNow(3)

    await book(player.token, { courtId, startsAt: at(date, '08:00'), durationMinutes: 60 }).expect(400)
    await book(player.token, { courtId, startsAt: at(date, '20:30'), durationMinutes: 60 }).expect(400)
    await book(player.token, { courtId, startsAt: at(date, '22:00'), durationMinutes: 120 }).expect(400)
    await book(player.token, { courtId, startsAt: at(daysFromNow(-1), '20:00'), durationMinutes: 60 }).expect(400)
    await book(player.token, { courtId: '00000000-0000-4000-8000-000000000000', startsAt: at(date, '20:00'), durationMinutes: 60 }).expect(404)
  })

  it('frees the slot when an unpaid hold expires', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const [a, b] = [await signUp(ctx), await signUp(ctx)]
    const startsAt = at(daysFromNow(4), '18:00')

    const first = await book(a.token, { courtId, startsAt, durationMinutes: 60 }).expect(201)
    await book(b.token, { courtId, startsAt, durationMinutes: 60 }).expect(409)

    await ctx.pool.query(`update bookings set expires_at = now() - interval '1 minute' where id = $1`, [first.body.id])
    await book(b.token, { courtId, startsAt, durationMinutes: 60 }).expect(201)

    const { rows } = await ctx.pool.query('select status from bookings where id = $1', [first.body.id])
    expect(rows[0].status).toBe('expired')
  })
})

describe('availability', () => {
  it('lists the day and marks booked slots, ignoring cancelled and expired ones', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const player = await signUp(ctx)
    const date = daysFromNow(6)
    const taken = await book(player.token, { courtId, startsAt: at(date, '20:00'), durationMinutes: 60 }).expect(201)
    const cancelled = await book(player.token, { courtId, startsAt: at(date, '10:00'), durationMinutes: 60 }).expect(201)
    await ctx.http().post(`/bookings/${cancelled.body.id}/cancel`).set('Authorization', player.token).expect(200)

    const res = await ctx.http().get(`/courts/${courtId}/availability`).query({ date }).expect(200)
    expect(res.body).toHaveLength(14)
    const busy = res.body.filter((s: { available: boolean }) => !s.available)
    expect(busy.map((s: { startsAt: string }) => s.startsAt)).toEqual([taken.body.startsAt])
  })

  it('validates the date', async () => {
    const { courtId } = await venueWithCourt(ctx)
    await ctx.http().get(`/courts/${courtId}/availability`).query({ date: '20-11-2026' }).expect(400)
  })
})

describe('cancelling', () => {
  it('lets a player cancel with enough notice, and the slot can be booked again', async () => {
    const { courtId } = await venueWithCourt(ctx)
    const [a, b] = [await signUp(ctx), await signUp(ctx)]
    const startsAt = at(daysFromNow(3), '20:00')

    const booking = await book(a.token, { courtId, startsAt, durationMinutes: 60 }).expect(201)
    const res = await ctx.http().post(`/bookings/${booking.body.id}/cancel`).set('Authorization', a.token).expect(200)
    expect(res.body.status).toBe('cancelled')
    await ctx.http().post(`/bookings/${booking.body.id}/cancel`).set('Authorization', a.token).expect(409)
    await book(b.token, { courtId, startsAt, durationMinutes: 60 }).expect(201)
  })

  it('stops players cancelling late, but lets the venue owner do it', async () => {
    const { courtId, owner } = await venueWithCourt(ctx)
    const player = await signUp(ctx)
    const booking = await book(player.token, { courtId, startsAt: at(daysFromNow(3), '20:00'), durationMinutes: 60 }).expect(201)
    // Pull the match to 2 hours from now.
    await ctx.pool.query(
      `update bookings set starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours' where id = $1`,
      [booking.body.id],
    )

    const late = await ctx.http().post(`/bookings/${booking.body.id}/cancel`).set('Authorization', player.token).expect(409)
    expect(late.body.message).toContain('24 hours')
    await ctx.http().post(`/bookings/${booking.body.id}/cancel`).set('Authorization', owner.token).expect(200)
  })

  it("doesn't let strangers cancel someone else's booking", async () => {
    const { courtId } = await venueWithCourt(ctx)
    const [player, stranger] = [await signUp(ctx), await signUp(ctx)]
    const booking = await book(player.token, { courtId, startsAt: at(daysFromNow(3), '20:00'), durationMinutes: 60 }).expect(201)
    await ctx.http().post(`/bookings/${booking.body.id}/cancel`).set('Authorization', stranger.token).expect(403)
  })
})

describe('owners', () => {
  it("see their venue's bookings for a day, and nobody else's", async () => {
    const { courtId, venueId, owner } = await venueWithCourt(ctx)
    const player = await signUp(ctx)
    const date = daysFromNow(3)
    await book(player.token, { courtId, startsAt: at(date, '20:00'), durationMinutes: 60 }).expect(201)
    await book(player.token, { courtId, startsAt: at(daysFromNow(4), '20:00'), durationMinutes: 60 }).expect(201)

    const res = await ctx.http().get(`/venues/${venueId}/bookings`).query({ date }).set('Authorization', owner.token).expect(200)
    expect(res.body).toHaveLength(1)

    const otherOwner = await signUp(ctx, 'owner')
    await ctx.http().get(`/venues/${venueId}/bookings`).query({ date }).set('Authorization', otherOwner.token).expect(403)
    await ctx.http().post(`/venues/${venueId}/courts`).set('Authorization', otherOwner.token)
      .send({ name: 'Intrusa', sport: 'futbol5', pricePerHourCents: 100, opensAt: '09:00', closesAt: '10:00' }).expect(403)
  })

  it('cannot create a court that closes before it opens, or reuse a court name', async () => {
    const { venueId, owner } = await venueWithCourt(ctx)
    const court = { name: 'Cancha 2', sport: 'futbol7', pricePerHourCents: 100, opensAt: '18:00', closesAt: '10:00' }
    await ctx.http().post(`/venues/${venueId}/courts`).set('Authorization', owner.token).send(court).expect(400)
    await ctx.http().post(`/venues/${venueId}/courts`).set('Authorization', owner.token).send({ ...court, name: 'Cancha 1', closesAt: '23:00' }).expect(409)
  })
})
