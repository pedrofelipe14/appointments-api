import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types'
import { isPgError, PG_UNIQUE_VIOLATION } from '../common/pg-errors'
import { Database, type Queryable } from '../db/database'
import { VenuesService } from '../venues/venues.service'
import type { CourtResponse, CreateCourtDto, SlotResponse } from './courts.dto'
import { type CourtSchedule, daySlots, minutesOfDay } from './schedule'

export interface CourtRow {
  id: string
  venue_id: string
  name: string
  sport: string
  price_per_hour_cents: number
  opens_at: string
  closes_at: string
  slot_minutes: number
  timezone: string // joined from the venue
  owner_id: string // joined from the venue
}

export const scheduleOf = (court: CourtRow): CourtSchedule => ({
  opensAt: court.opens_at,
  closesAt: court.closes_at,
  slotMinutes: court.slot_minutes,
  timezone: court.timezone,
})

const toCourt = (row: CourtRow): CourtResponse => ({
  id: row.id,
  venueId: row.venue_id,
  name: row.name,
  sport: row.sport,
  pricePerHourCents: row.price_per_hour_cents,
  opensAt: row.opens_at.slice(0, 5),
  closesAt: row.closes_at.slice(0, 5),
  slotMinutes: row.slot_minutes,
  timezone: row.timezone,
})

@Injectable()
export class CourtsService {
  constructor(private readonly db: Database, private readonly venues: VenuesService) {}

  async create(user: AuthUser, venueId: string, dto: CreateCourtDto): Promise<CourtResponse> {
    await this.venues.getManaged(venueId, user)
    if (minutesOfDay(dto.closesAt) <= minutesOfDay(dto.opensAt)) {
      throw new BadRequestException('closesAt must be after opensAt')
    }
    try {
      const { id } = (await this.db.one<{ id: string }>(
        `insert into courts (venue_id, name, sport, price_per_hour_cents, opens_at, closes_at, slot_minutes)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [venueId, dto.name, dto.sport, dto.pricePerHourCents, dto.opensAt, dto.closesAt, dto.slotMinutes ?? 60],
      ))!
      return toCourt(await this.getRow(id))
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new ConflictException('This venue already has a court with that name')
      throw error
    }
  }

  async get(id: string): Promise<CourtResponse> {
    return toCourt(await this.getRow(id))
  }

  async listByVenue(venueId: string): Promise<CourtResponse[]> {
    await this.venues.get(venueId)
    const rows = await this.db.query<CourtRow>(
      `select c.*, v.timezone, v.owner_id from courts c join venues v on v.id = c.venue_id
       where c.venue_id = $1 order by c.name`,
      [venueId],
    )
    return rows.map(toCourt)
  }

  /** Court with its venue's timezone and owner. Pass a transaction client to read inside it. */
  async getRow(id: string, on?: Queryable): Promise<CourtRow> {
    const court = await this.db.one<CourtRow>(
      `select c.*, v.timezone, v.owner_id from courts c join venues v on v.id = c.venue_id where c.id = $1`,
      [id],
      on,
    )
    if (!court) throw new NotFoundException('Court not found')
    return court
  }

  /** Every slot on a local date, marked available unless an active booking overlaps it. */
  async availability(courtId: string, date: string): Promise<SlotResponse[]> {
    const court = await this.getRow(courtId)
    const slots = daySlots(date, scheduleOf(court))
    if (slots.length === 0) return []

    const taken = await this.db.query<{ starts_at: Date; ends_at: Date }>(
      `select starts_at, ends_at from bookings
       where court_id = $1
         and (status = 'confirmed' or (status = 'pending_payment' and expires_at > now()))
         and tstzrange(starts_at, ends_at, '[)') && tstzrange($2, $3, '[)')`,
      [courtId, slots[0].startsAt, slots[slots.length - 1].endsAt],
    )

    return slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      available: !taken.some((b) => b.starts_at < slot.endsAt && b.ends_at > slot.startsAt),
    }))
  }
}
