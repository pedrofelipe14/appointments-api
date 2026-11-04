import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import type { AuthUser } from '../auth/auth.types'
import { isPgError, PG_UNIQUE_VIOLATION } from '../common/pg-errors'
import { Database, type Queryable } from '../db/database'
import { freeSlots, type Interval, minutesOfDay, type WorkingRange } from '../scheduling/slots'
import type {
  CreateProviderDto, CreateServiceDto, ProviderResponse, ServiceResponse, SlotResponse, WorkingHoursDto,
} from './providers.dto'

export interface ProviderRow {
  id: string
  user_id: string
  name: string
  about: string
  timezone: string
  confirm_within_hours: number
}

/** A service with the provider fields scheduling needs. */
export interface ServiceRow {
  id: string
  provider_id: string
  name: string
  description: string
  duration_minutes: number
  price_cents: number
  active: boolean
  timezone: string
  confirm_within_hours: number
  provider_user_id: string
}

const toService = (s: { id: string; provider_id: string; name: string; description: string; duration_minutes: number; price_cents: number }): ServiceResponse => ({
  id: s.id,
  providerId: s.provider_id,
  name: s.name,
  description: s.description,
  durationMinutes: s.duration_minutes,
  priceCents: s.price_cents,
})

@Injectable()
export class ProvidersService {
  constructor(private readonly db: Database) {}

  async create(user: AuthUser, dto: CreateProviderDto): Promise<ProviderResponse> {
    try {
      const row = await this.db.one<ProviderRow>(
        `insert into providers (user_id, name, about, timezone, confirm_within_hours)
         values ($1, $2, $3, coalesce($4, 'America/Argentina/Buenos_Aires'), coalesce($5, 24)) returning *`,
        [user.id, dto.name, dto.about ?? '', dto.timezone ?? null, dto.confirmWithinHours ?? null],
      )
      return this.get(row!.id)
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new ConflictException('You already have a provider profile')
      throw error
    }
  }

  async list(): Promise<ProviderResponse[]> {
    const rows = await this.db.query<{ id: string }>('select id from providers order by name')
    return Promise.all(rows.map((r) => this.get(r.id)))
  }

  async get(id: string): Promise<ProviderResponse> {
    const p = await this.row(id)
    const [services, hours] = await Promise.all([
      this.db.query<ServiceRow>('select * from services where provider_id = $1 and active order by name', [id]),
      this.hours(id),
    ])
    return {
      id: p.id,
      userId: p.user_id,
      name: p.name,
      about: p.about,
      timezone: p.timezone,
      confirmWithinHours: p.confirm_within_hours,
      services: services.map(toService),
      workingHours: hours,
    }
  }

  async row(id: string, on?: Queryable): Promise<ProviderRow> {
    const p = await this.db.one<ProviderRow>('select * from providers where id = $1', [id], on)
    if (!p) throw new NotFoundException('Provider not found')
    return p
  }

  /** The provider profile, if the user owns it (admins manage every provider). */
  async owned(id: string, user: AuthUser, on?: Queryable): Promise<ProviderRow> {
    const p = await this.row(id, on)
    if (user.role !== 'admin' && p.user_id !== user.id) throw new ForbiddenException('Not your provider profile')
    return p
  }

  /** The provider profile that belongs to this user. */
  async ofUser(user: AuthUser): Promise<ProviderRow> {
    const p = await this.db.one<ProviderRow>('select * from providers where user_id = $1', [user.id])
    if (!p) throw new NotFoundException('Create your provider profile first (POST /providers)')
    return p
  }

  /** Replaces the weekly schedule. Ranges on the same day can't overlap. */
  async setHours(user: AuthUser, id: string, dto: WorkingHoursDto): Promise<ProviderResponse> {
    await this.owned(id, user)
    for (const r of dto.hours) {
      if (minutesOfDay(r.endsAt) <= minutesOfDay(r.startsAt)) throw new BadRequestException(`${r.startsAt}-${r.endsAt}: endsAt must be after startsAt`)
    }
    for (const a of dto.hours) {
      for (const b of dto.hours) {
        if (a !== b && a.weekday === b.weekday
          && minutesOfDay(a.startsAt) < minutesOfDay(b.endsAt) && minutesOfDay(b.startsAt) < minutesOfDay(a.endsAt)) {
          throw new BadRequestException(`Overlapping ranges on weekday ${a.weekday}`)
        }
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.query('delete from working_hours where provider_id = $1', [id])
      for (const r of dto.hours) {
        await tx.query('insert into working_hours (provider_id, weekday, starts_at, ends_at) values ($1, $2, $3, $4)', [id, r.weekday, r.startsAt, r.endsAt])
      }
    })
    return this.get(id)
  }

  async addService(user: AuthUser, id: string, dto: CreateServiceDto): Promise<ServiceResponse> {
    await this.owned(id, user)
    if (dto.durationMinutes % 15 !== 0) throw new BadRequestException('durationMinutes must be a multiple of 15')
    try {
      const row = await this.db.one<ServiceRow>(
        `insert into services (provider_id, name, description, duration_minutes, price_cents)
         values ($1, $2, $3, $4, $5) returning *`,
        [id, dto.name, dto.description ?? '', dto.durationMinutes, dto.priceCents],
      )
      return toService(row!)
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new ConflictException('You already offer a service with that name')
      throw error
    }
  }

  async service(id: string, on?: Queryable): Promise<ServiceRow> {
    const s = await this.db.one<ServiceRow>(
      `select s.*, p.timezone, p.confirm_within_hours, p.user_id as provider_user_id
       from services s join providers p on p.id = s.provider_id where s.id = $1`,
      [id],
      on,
    )
    if (!s || !s.active) throw new NotFoundException('Service not found')
    return s
  }

  async hours(providerId: string, on?: Queryable): Promise<WorkingRange[]> {
    const rows = await this.db.query<{ weekday: number; starts_at: string; ends_at: string }>(
      'select weekday, starts_at, ends_at from working_hours where provider_id = $1 order by weekday, starts_at',
      [providerId],
      on,
    )
    return rows.map((r) => ({ weekday: r.weekday, startsAt: r.starts_at.slice(0, 5), endsAt: r.ends_at.slice(0, 5) }))
  }

  /** Time the provider already has taken: confirmed appointments and requests still awaiting an answer. */
  async busy(providerId: string, from: Date, to: Date, on?: Queryable): Promise<Interval[]> {
    const rows = await this.db.query<{ starts_at: Date; ends_at: Date }>(
      `select starts_at, ends_at from appointments
       where provider_id = $1
         and (status = 'confirmed' or (status = 'pending' and respond_by > now()))
         and tstzrange(starts_at, ends_at, '[)') && tstzrange($2, $3, '[)')`,
      [providerId, from, to],
      on,
    )
    return rows.map((r) => ({ start: r.starts_at, end: r.ends_at }))
  }

  /** Every free start time for a service on a local date. */
  async availability(providerId: string, serviceId: string, date: string): Promise<SlotResponse[]> {
    const service = await this.service(serviceId)
    if (service.provider_id !== providerId) throw new NotFoundException('Service not found for this provider')
    const day = DateTime.fromISO(date, { zone: service.timezone }).startOf('day')
    if (!day.isValid) throw new BadRequestException('Invalid date')
    const busy = await this.busy(providerId, day.toJSDate(), day.plus({ days: 1 }).toJSDate())
    const slots = freeSlots({
      timezone: service.timezone,
      hours: await this.hours(providerId),
      durationMinutes: service.duration_minutes,
      from: date,
      to: date,
      busy,
    })
    return slots.map((s) => ({ startsAt: s.start.toISOString(), endsAt: s.end.toISOString() }))
  }
}
