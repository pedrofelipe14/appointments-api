import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signUp, startApp, stopApp, type TestContext } from './helpers'

let ctx: TestContext
beforeAll(async () => { ctx = await startApp() })
afterAll(async () => { await stopApp(ctx) })
beforeEach(async () => { await resetDb(ctx.pool) })

describe('auth', () => {
  const user = { email: 'Lio@Example.com', name: 'Lio', password: 'a-long-password' }

  it('registers, logs in and returns the current user', async () => {
    const res = await ctx.http().post('/auth/register').send(user).expect(201)
    expect(res.body).toMatchObject({ email: 'lio@example.com', name: 'Lio', role: 'player' })
    expect(res.body).not.toHaveProperty('passwordHash')

    const login = await ctx.http().post('/auth/login').send({ email: 'lio@example.com', password: user.password }).expect(200)
    const me = await ctx.http().get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200)
    expect(me.body.email).toBe('lio@example.com')
  })

  it('rejects a duplicate email, case-insensitively', async () => {
    await ctx.http().post('/auth/register').send(user).expect(201)
    await ctx.http().post('/auth/register').send({ ...user, email: 'LIO@example.com' }).expect(409)
  })

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await ctx.http().post('/auth/register').send(user).expect(201)
    const wrong = await ctx.http().post('/auth/login').send({ email: user.email, password: 'nope-nope-nope' }).expect(401)
    const unknown = await ctx.http().post('/auth/login').send({ email: 'ghost@example.com', password: 'whatever1' }).expect(401)
    expect(wrong.body.message).toBe(unknown.body.message)
  })

  it('validates input and refuses unknown fields', async () => {
    await ctx.http().post('/auth/register').send({ ...user, email: 'not-an-email' }).expect(400)
    await ctx.http().post('/auth/register').send({ ...user, password: 'short' }).expect(400)
    await ctx.http().post('/auth/register').send({ ...user, role: 'admin' }).expect(400) // no self-made admins
    await ctx.http().post('/auth/register').send({ ...user, isAdmin: true }).expect(400)
  })

  it('protects endpoints that need a token', async () => {
    await ctx.http().get('/auth/me').expect(401)
    await ctx.http().get('/auth/me').set('Authorization', 'Bearer garbage').expect(401)
  })

  it('only lets owners create venues', async () => {
    const player = await signUp(ctx, 'player')
    await ctx.http().post('/venues').set('Authorization', player.token).send({ name: 'X', address: 'Y' }).expect(403)
    const owner = await signUp(ctx, 'owner')
    await ctx.http().post('/venues').set('Authorization', owner.token).send({ name: 'X', address: 'Y' }).expect(201)
  })
})
