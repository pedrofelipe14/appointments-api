import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { at, daysFromNow, localTime, providerWithService, resetDb, signUp, startApp, stopApp, type TestContext } from './helpers'

let ctx: TestContext
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await stopApp(ctx) })
beforeEach(async () => { await resetDb(ctx.pool) })

const DAY = daysFromNow(7)

describe('requesting appointments', () => {
  it('picks the first free time matching the preference and leaves it pending', async () => {
    const { serviceId } = await providerWithService(ctx)
    const client = await signUp(ctx)
    const res = await ctx.http().post('/appointments').set('Authorization', client.token)
      .send({ serviceId, from: DAY, to: DAY, timeOfDay: 'afternoon', note: 'Primera clase' }).expect(201)

    expect(localTime(res.body.startsAt)).toBe('12:00')
    expect(res.body).toMatchObject({ status: 'pending', serviceName: 'Clase de guitarra', priceCents: 2_000_000, note: 'Primera clase' })
    expect(new Date(res.body.respondBy).getTime()).toBeGreaterThan(Date.now())

    const next = await ctx.http().post('/appointments').set('Authorization', client.token)
      .send({ serviceId, from: DAY, to: DAY, timeOfDay: 'afternoon' }).expect(201)
    expect(localTime(next.body.startsAt)).toBe('13:00') // 12:00 is held while pending
  })

  it('gives 10 simultaneous requests 10 different times, then says the day is full', async () => {
    const { serviceId, providerId } = await providerWithService(ctx, '09:00', '19:00') // ten 1-hour slots
    const clients = await Promise.all(Array.from({ length: 10 }, () => signUp(ctx)))

    const results = await Promise.all(
      clients.map((c) => ctx.http().post('/appointments').set('Authorization', c.token).send({ serviceId, from: DAY, to: DAY })),
    )
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(201))
    const times = results.map((r) => localTime(r.body.startsAt)).sort()
    expect(times).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'])

    const late = await signUp(ctx)
    const full = await ctx.http().post('/appointments').set('Authorization', late.token).send({ serviceId, from: DAY, to: DAY }).expect(409)
    expect(full.body.message).toMatch(/No free time/)

    const free = await ctx.http().get(`/providers/${providerId}/availability`).query({ serviceId, date: DAY }).expect(200)
    expect(free.body).toEqual([])
  })

  it('lets exactly one of 25 simultaneous requests win the same explicit time', async () => {
    const { serviceId } = await providerWithService(ctx)
    const clients = await Promise.all(Array.from({ length: 25 }, () => signUp(ctx)))
    const startsAt = at(DAY, '16:00')

    const results = await Promise.all(
      clients.map((c) => ctx.http().post('/appointments').set('Authorization', c.token).send({ serviceId, startsAt })),
    )
    const statuses = results.map((r) => r.status)
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(24)
    const { rows } = await ctx.pool.query('select count(*)::int as n from appointments')
    expect(rows[0].n).toBe(1)
  })

  it('refuses times outside working hours, off the grid or too soon', async () => {
    const { serviceId } = await providerWithService(ctx)
    const client = await signUp(ctx)
    const ask = (startsAt: string) => ctx.http().post('/appointments').set('Authorization', client.token).send({ serviceId, startsAt })
    expect((await ask(at(DAY, '18:30')).expect(400)).body.message).toMatch(/working hours/) // would end 19:30
    expect((await ask(at(DAY, '10:10')).expect(400)).body.message).toMatch(/grid/)
    expect((await ask(new Date(Date.now() + 10 * 60_000).toISOString()).expect(400)).body.message).toMatch(/notice/)
  })

  it('validates the search window', async () => {
    const { serviceId, user } = await providerWithService(ctx)
    const client = await signUp(ctx)
    const ask = (body: object, token = client.token) => ctx.http().post('/appointments').set('Authorization', token).send({ serviceId, ...body })
    await ask({ from: DAY, to: daysFromNow(3) }).expect(400)
    await ask({ from: DAY, to: daysFromNow(90) }).expect(400)
    await ask({ timeOfDay: 'midnight' }).expect(400)
    await ask({}, user.token).expect(400) // providers can't book themselves
    await ctx.http().post('/appointments').send({ serviceId }).expect(401)
  })
})

describe('the provider answers', () => {
  async function pending() {
    const p = await providerWithService(ctx)
    const client = await signUp(ctx)
    const appt = await ctx.http().post('/appointments').set('Authorization', client.token)
      .send({ serviceId: p.serviceId, startsAt: at(DAY, '10:00') }).expect(201)
    return { ...p, client, id: appt.body.id as string }
  }

  it('confirms; the client is notified and it cannot be answered twice', async () => {
    const { user, client, id } = await pending()
    const inbox = await ctx.http().get('/appointments/inbox?status=pending').set('Authorization', user.token).expect(200)
    expect(inbox.body.map((a: { id: string }) => a.id)).toEqual([id])

    const res = await ctx.http().post(`/appointments/${id}/confirm`).set('Authorization', user.token).expect(200)
    expect(res.body.status).toBe('confirmed')
    await ctx.http().post(`/appointments/${id}/reject`).set('Authorization', user.token).send({ reason: 'oops' }).expect(409)

    const notes = await ctx.http().get('/notifications').set('Authorization', client.token).expect(200)
    expect(notes.body).toMatchObject({ unread: 1, items: [{ kind: 'confirmed', appointmentId: id, read: false }] })
  })

  it('rejects with a reason and the time frees up for someone else', async () => {
    const { user, serviceId, client, id } = await pending()
    await ctx.http().post(`/appointments/${id}/reject`).set('Authorization', user.token).send({ reason: '' }).expect(400)
    const res = await ctx.http().post(`/appointments/${id}/reject`).set('Authorization', user.token)
      .send({ reason: 'Ese día no estoy' }).expect(200)
    expect(res.body).toMatchObject({ status: 'rejected', rejectionReason: 'Ese día no estoy' })

    const mine = await ctx.http().get('/appointments/me').set('Authorization', client.token).expect(200)
    expect(mine.body[0].status).toBe('rejected')
    const other = await signUp(ctx)
    await ctx.http().post('/appointments').set('Authorization', other.token).send({ serviceId, startsAt: at(DAY, '10:00') }).expect(201)
  })

  it('only lets the right provider answer', async () => {
    const { client, id } = await pending()
    const stranger = await providerWithService(ctx)
    await ctx.http().post(`/appointments/${id}/confirm`).set('Authorization', stranger.user.token).expect(403)
    await ctx.http().post(`/appointments/${id}/confirm`).set('Authorization', client.token).expect(403) // clients can't
    await ctx.http().post('/appointments/00000000-0000-0000-0000-000000000000/confirm').set('Authorization', stranger.user.token).expect(404)
  })

  it('expires requests nobody answered in time: the client is told and the time frees up', async () => {
    const { user, serviceId, client, id } = await pending()
    await ctx.pool.query("update appointments set respond_by = now() - interval '1 minute' where id = $1", [id])

    await ctx.http().post(`/appointments/${id}/confirm`).set('Authorization', user.token).expect(409)
    const inbox = await ctx.http().get('/appointments/inbox').set('Authorization', user.token).expect(200)
    expect(inbox.body[0].status).toBe('expired')
    const notes = await ctx.http().get('/notifications').set('Authorization', client.token).expect(200)
    expect(notes.body.items[0].kind).toBe('expired')

    const other = await signUp(ctx)
    await ctx.http().post('/appointments').set('Authorization', other.token).send({ serviceId, startsAt: at(DAY, '10:00') }).expect(201)
  })
})

describe('cancelling', () => {
  it('lets clients cancel pending requests; the provider is notified', async () => {
    const { serviceId, user } = await providerWithService(ctx)
    const client = await signUp(ctx)
    const appt = await ctx.http().post('/appointments').set('Authorization', client.token).send({ serviceId, from: DAY, to: DAY }).expect(201)
    const res = await ctx.http().post(`/appointments/${appt.body.id}/cancel`).set('Authorization', client.token).expect(200)
    expect(res.body.status).toBe('cancelled')
    await ctx.http().post(`/appointments/${appt.body.id}/cancel`).set('Authorization', client.token).expect(409)

    const notes = await ctx.http().get('/notifications').set('Authorization', user.token).expect(200)
    expect(notes.body.items.map((n: { kind: string }) => n.kind)).toEqual(['cancelled', 'requested'])
    await ctx.http().post('/notifications/read').set('Authorization', user.token).expect(204)
    expect((await ctx.http().get('/notifications').set('Authorization', user.token)).body.unread).toBe(0)
  })

  it('needs 12 hours of notice from clients for confirmed appointments, none from providers', async () => {
    const { serviceId, user } = await providerWithService(ctx)
    const client = await signUp(ctx)
    const appt = await ctx.http().post('/appointments').set('Authorization', client.token).send({ serviceId, from: DAY, to: DAY }).expect(201)
    await ctx.http().post(`/appointments/${appt.body.id}/confirm`).set('Authorization', user.token).expect(200)
    // Pretend it starts in two hours.
    await ctx.pool.query(
      "update appointments set starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours' where id = $1",
      [appt.body.id],
    )
    await ctx.http().post(`/appointments/${appt.body.id}/cancel`).set('Authorization', client.token).expect(409)
    const outsider = await signUp(ctx)
    await ctx.http().post(`/appointments/${appt.body.id}/cancel`).set('Authorization', outsider.token).expect(403)
    await ctx.http().post(`/appointments/${appt.body.id}/cancel`).set('Authorization', user.token).expect(200)
  })
})

describe('providers', () => {
  it('validates working hours and services', async () => {
    const { user, providerId } = await providerWithService(ctx)
    const put = (hours: object[]) => ctx.http().put(`/providers/${providerId}/working-hours`).set('Authorization', user.token).send({ hours })
    await put([{ weekday: 1, startsAt: '10:00', endsAt: '09:00' }]).expect(400)
    await put([{ weekday: 1, startsAt: '09:00', endsAt: '13:00' }, { weekday: 1, startsAt: '12:00', endsAt: '15:00' }]).expect(400)
    await put([{ weekday: 8, startsAt: '09:00', endsAt: '13:00' }]).expect(400)

    const add = (body: object) => ctx.http().post(`/providers/${providerId}/services`).set('Authorization', user.token).send(body)
    await add({ name: 'Raro', durationMinutes: 50, priceCents: 1 }).expect(400)
    await add({ name: 'Clase de guitarra', durationMinutes: 30, priceCents: 1 }).expect(409)
    await ctx.http().post('/providers').set('Authorization', user.token).send({ name: 'Again' }).expect(409)
  })

  it("won't let anyone else edit a provider", async () => {
    const { providerId } = await providerWithService(ctx)
    const other = await signUp(ctx, 'provider')
    const client = await signUp(ctx)
    const hours = [{ weekday: 1, startsAt: '09:00', endsAt: '10:00' }]
    await ctx.http().put(`/providers/${providerId}/working-hours`).set('Authorization', other.token).send({ hours }).expect(403)
    await ctx.http().post('/providers').set('Authorization', client.token).send({ name: 'Me' }).expect(403)
  })

  it('lists free times that shrink as requests come in', async () => {
    const { serviceId, providerId } = await providerWithService(ctx)
    const free = () => ctx.http().get(`/providers/${providerId}/availability`).query({ serviceId, date: DAY }).expect(200)
    const before = (await free()).body.map((s: { startsAt: string }) => localTime(s.startsAt))
    expect(before[0]).toBe('09:00')
    expect(before).toContain('10:30')

    const client = await signUp(ctx)
    await ctx.http().post('/appointments').set('Authorization', client.token).send({ serviceId, startsAt: at(DAY, '10:00') }).expect(201)
    const after = (await free()).body.map((s: { startsAt: string }) => localTime(s.startsAt))
    expect(after).not.toContain('10:00')
    expect(after).not.toContain('10:30') // overlaps 10:00-11:00
    expect(after).toContain('11:00')
  })
})
