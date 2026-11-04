import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import type { PoolClient } from 'pg'
import type { AuthUser } from '../auth/auth.types'
import { isPgError, PG_EXCLUSION_VIOLATION } from '../common/pg-errors'
import { Database, type Queryable } from '../db/database'
import { ProvidersService } from '../providers/providers.service'
import { freeSlots, type Interval, slotProblem } from '../scheduling/slots'
import type { AppointmentResponse, RequestAppointmentDto } from './appointments.dto'

/** How far ahead a client may search for a free time. */
export const MAX_SEARCH_DAYS = 60
/** Clients can cancel a confirmed appointment until this long before it starts; providers anytime. */
export const CLIENT_CANCEL_NOTICE_HOURS = 12

interface AppointmentRow {
  id: string
  provider_id: string
  provider_name: string
  service_id: string
  service_name: string
  client_id: string
  client_name: string
  starts_at: Date
  ends_at: Date
  status: string
  price_cents: number
  note: string
  rejection_reason: string | null
  respond_by: Date
  created_at: Date
  provider_user_id: string
}

const SELECT = `
  select a.*, p.name as provider_name, p.user_id as provider_user_id, s.name as service_name, u.name as client_name
  from appointments a
  join providers p on p.id = a.provider_id
  join services s on s.id = a.service_id
  join users u on u.id = a.client_id`

const toAppointment = (r: AppointmentRow): AppointmentResponse => ({
  id: r.id,
  providerId: r.provider_id,
  providerName: r.provider_name,
  serviceId: r.service_id,
  serviceName: r.service_name,
  clientId: r.client_id,
  clientName: r.client_name,
  startsAt: r.starts_at.toISOString(),
  endsAt: r.ends_at.toISOString(),
  status: r.status,
  priceCents: r.price_cents,
  note: r.note,
  rejectionReason: r.rejection_reason,
  respondBy: r.respond_by.toISOString(),
  createdAt: r.created_at.toISOString(),
})

@Injectable()
export class AppointmentsService {
  constructor(private readonly db: Database, private readonly providers: ProvidersService) {}

  /** Requests a service. With startsAt, that exact time; without it, the first free time that
      matches the search window and time of day. Concurrent requests never get the same time:
      requests for one provider take turns on that provider's row, so each sees the times the
      previous one took. The exclusion constraint stays as the last line of defence. */
  async request(client: AuthUser, dto: RequestAppointmentDto): Promise<AppointmentResponse> {
    const id = await this.db.transaction(async (tx) => {
      const service = await this.providers.service(dto.serviceId, tx)
      if (service.provider_user_id === client.id) throw new BadRequestException("You can't book your own service")
      // Two racing inserts into an exclusion constraint can deadlock each other; queueing avoids it.
      await tx.query('select 1 from providers where id = $1 for no key update', [service.provider_id])
      await this.expireOverdue(tx, service.provider_id)
      const hours = await this.providers.hours(service.provider_id, tx)

      let candidates: Interval[]
      if (dto.startsAt) {
        const start = new Date(dto.startsAt)
        const problem = slotProblem(start, service.duration_minutes, service.timezone, hours)
        if (problem) throw new BadRequestException(problem)
        candidates = [{ start, end: new Date(start.getTime() + service.duration_minutes * 60_000) }]
      } else {
        const today = DateTime.now().setZone(service.timezone).toISODate()!
        const from = dto.from ?? today
        const to = dto.to ?? DateTime.fromISO(from).plus({ days: 13 }).toISODate()!
        const days = DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days
        if (days < 0) throw new BadRequestException('"to" must not be before "from"')
        if (days > MAX_SEARCH_DAYS) throw new BadRequestException(`Search at most ${MAX_SEARCH_DAYS} days at a time`)

        const windowStart = DateTime.fromISO(from, { zone: service.timezone }).startOf('day')
        const windowEnd = DateTime.fromISO(to, { zone: service.timezone }).plus({ days: 1 }).startOf('day')
        candidates = freeSlots({
          timezone: service.timezone,
          hours,
          durationMinutes: service.duration_minutes,
          from,
          to,
          timeOfDay: dto.timeOfDay,
          busy: await this.providers.busy(service.provider_id, windowStart.toJSDate(), windowEnd.toJSDate(), tx),
        })
        if (candidates.length === 0) throw new ConflictException(`No free time between ${from} and ${to}`)
      }

      const slot = candidates[0]
      try {
        const row = await this.db.one<{ id: string }>(
          `insert into appointments (provider_id, service_id, client_id, starts_at, ends_at, price_cents, note, respond_by)
           values ($1, $2, $3, $4, $5, $6, $7, least(now() + make_interval(hours => $8), $4))
           returning id`,
          [service.provider_id, service.id, client.id, slot.start, slot.end, service.price_cents, dto.note ?? '', service.confirm_within_hours],
          tx,
        )
        await this.notify(tx, service.provider_user_id, 'requested', row!.id)
        return row!.id
      } catch (error) {
        if (isPgError(error, PG_EXCLUSION_VIOLATION)) throw new ConflictException('That time is already taken')
        throw error
      }
    })
    return this.get(id)
  }

  async get(id: string, on?: Queryable): Promise<AppointmentResponse> {
    const row = await this.db.one<AppointmentRow>(`${SELECT} where a.id = $1`, [id], on)
    if (!row) throw new NotFoundException('Appointment not found')
    return toAppointment(row)
  }

  /** The client's appointments, newest first. */
  async mine(client: AuthUser): Promise<AppointmentResponse[]> {
    await this.db.transaction((tx) => this.expireOverdue(tx))
    const rows = await this.db.query<AppointmentRow>(`${SELECT} where a.client_id = $1 order by a.starts_at desc`, [client.id])
    return rows.map(toAppointment)
  }

  /** The provider's appointments (optionally one status), soonest first. */
  async inbox(user: AuthUser, status?: string): Promise<AppointmentResponse[]> {
    const provider = await this.providers.ofUser(user)
    await this.db.transaction((tx) => this.expireOverdue(tx, provider.id))
    const rows = await this.db.query<AppointmentRow>(
      `${SELECT} where a.provider_id = $1 and ($2::appointment_status is null or a.status = $2) order by a.starts_at`,
      [provider.id, status ?? null],
    )
    return rows.map(toAppointment)
  }

  confirm(user: AuthUser, id: string): Promise<AppointmentResponse> {
    return this.decide(user, id, 'confirmed', null)
  }

  reject(user: AuthUser, id: string, reason: string): Promise<AppointmentResponse> {
    return this.decide(user, id, 'rejected', reason)
  }

  /** The provider answers a pending request. */
  private async decide(user: AuthUser, id: string, outcome: 'confirmed' | 'rejected', reason: string | null): Promise<AppointmentResponse> {
    return this.db.transaction(async (tx) => {
      const appt = await this.lock(tx, id)
      if (user.role !== 'admin' && appt.provider_user_id !== user.id) throw new ForbiddenException('Only the provider can answer this request')
      if (appt.status === 'pending' && appt.respond_by <= new Date()) {
        await this.expireOverdue(tx, appt.provider_id)
        throw new ConflictException('This request already expired')
      }
      if (appt.status !== 'pending') throw new ConflictException(`This request is already ${appt.status}`)

      await tx.query(
        `update appointments set status = $2, rejection_reason = $3, decided_at = now() where id = $1`,
        [id, outcome, reason],
      )
      await this.notify(tx, appt.client_id, outcome, id)
      return this.get(id, tx)
    })
  }

  /** Either side can cancel. Clients need notice for confirmed appointments; providers don't. */
  async cancel(user: AuthUser, id: string): Promise<AppointmentResponse> {
    return this.db.transaction(async (tx) => {
      const appt = await this.lock(tx, id)
      const isClient = appt.client_id === user.id
      const isProvider = user.role === 'admin' || appt.provider_user_id === user.id
      if (!isClient && !isProvider) throw new ForbiddenException('Not your appointment')
      if (appt.status !== 'pending' && appt.status !== 'confirmed') throw new ConflictException(`This appointment is already ${appt.status}`)

      const hoursLeft = (appt.starts_at.getTime() - Date.now()) / 3_600_000
      if (!isProvider && appt.status === 'confirmed' && hoursLeft < CLIENT_CANCEL_NOTICE_HOURS) {
        throw new ConflictException(`Confirmed appointments can be cancelled up to ${CLIENT_CANCEL_NOTICE_HOURS} hours before`)
      }

      await tx.query(`update appointments set status = 'cancelled', decided_at = now() where id = $1`, [id])
      await this.notify(tx, isClient ? appt.provider_user_id : appt.client_id, 'cancelled', id)
      return this.get(id, tx)
    })
  }

  /** Requests nobody answered in time expire: their time frees up and the client is told. */
  private async expireOverdue(tx: PoolClient, providerId?: string): Promise<void> {
    const expired = await this.db.query<{ id: string; client_id: string }>(
      `update appointments set status = 'expired', decided_at = now()
       where status = 'pending' and respond_by <= now() and ($1::uuid is null or provider_id = $1)
       returning id, client_id`,
      [providerId ?? null],
      tx,
    )
    for (const e of expired) await this.notify(tx, e.client_id, 'expired', e.id)
  }

  private async lock(tx: PoolClient, id: string): Promise<AppointmentRow> {
    const appt = await this.db.one<AppointmentRow>(
      `select a.*, p.user_id as provider_user_id from appointments a
       join providers p on p.id = a.provider_id where a.id = $1 for update of a`,
      [id],
      tx,
    )
    if (!appt) throw new NotFoundException('Appointment not found')
    return appt
  }

  private async notify(tx: PoolClient, userId: string, kind: string, appointmentId: string): Promise<void> {
    await tx.query('insert into notifications (user_id, kind, appointment_id) values ($1, $2, $3)', [userId, kind, appointmentId])
  }
}
