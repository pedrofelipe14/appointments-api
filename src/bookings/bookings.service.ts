import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import type { AuthUser } from '../auth/auth.types'
import { isPgError, PG_EXCLUSION_VIOLATION } from '../common/pg-errors'
import { CourtsService, scheduleOf } from '../courts/courts.service'
import { bookingProblem } from '../courts/schedule'
import { Database } from '../db/database'
import { VenuesService } from '../venues/venues.service'
import type { BookingResponse, CreateBookingDto } from './bookings.dto'

/** How long an unpaid booking holds its slot. */
export const PAYMENT_HOLD_MINUTES = 15
/** Players can cancel on their own until this long before the match; owners anytime. */
export const CANCELLATION_NOTICE_HOURS = 24

interface BookingRow {
  id: string
  court_id: string
  user_id: string
  starts_at: Date
  ends_at: Date
  status: string
  price_cents: number
  expires_at: Date | null
  created_at: Date
}

const toBooking = (row: BookingRow): BookingResponse => ({
  id: row.id,
  courtId: row.court_id,
  userId: row.user_id,
  startsAt: row.starts_at.toISOString(),
  endsAt: row.ends_at.toISOString(),
  status: row.status,
  priceCents: row.price_cents,
  expiresAt: row.expires_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
})

@Injectable()
export class BookingsService {
  constructor(
    private readonly db: Database,
    private readonly courts: CourtsService,
    private readonly venues: VenuesService,
  ) {}

  /** Books a slot, held for PAYMENT_HOLD_MINUTES until paid. Two requests for the same
      slot can't both succeed: the database's exclusion constraint rejects the second. */
  async create(user: AuthUser, dto: CreateBookingDto): Promise<BookingResponse> {
    const startsAt = new Date(dto.startsAt)
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000)

    try {
      return await this.db.transaction(async (tx) => {
        const court = await this.courts.getRow(dto.courtId, tx)
        const problem = bookingProblem(startsAt, dto.durationMinutes, scheduleOf(court))
        if (problem) throw new BadRequestException(problem)

        // Unpaid holds that ran out stop blocking the slot.
        await tx.query(
          `update bookings set status = 'expired'
           where court_id = $1 and status = 'pending_payment' and expires_at <= now()`,
          [court.id],
        )

        const price = Math.round((court.price_per_hour_cents * dto.durationMinutes) / 60)
        const row = await this.db.one<BookingRow>(
          `insert into bookings (court_id, user_id, starts_at, ends_at, price_cents, expires_at)
           values ($1, $2, $3, $4, $5, now() + make_interval(mins => $6)) returning *`,
          [court.id, user.id, startsAt, endsAt, price, PAYMENT_HOLD_MINUTES],
          tx,
        )
        return toBooking(row!)
      })
    } catch (error) {
      if (isPgError(error, PG_EXCLUSION_VIOLATION)) throw new ConflictException('That time is already booked')
      throw error
    }
  }

  async mine(user: AuthUser): Promise<BookingResponse[]> {
    const rows = await this.db.query<BookingRow>('select * from bookings where user_id = $1 order by starts_at desc', [user.id])
    return rows.map(toBooking)
  }

  /** Every booking at a venue on a local date, for its owner. */
  async forVenue(user: AuthUser, venueId: string, date: string): Promise<BookingResponse[]> {
    const venue = await this.venues.getManaged(venueId, user)
    const day = DateTime.fromISO(date, { zone: venue.timezone }).startOf('day')
    const rows = await this.db.query<BookingRow>(
      `select b.* from bookings b join courts c on c.id = b.court_id
       where c.venue_id = $1 and b.starts_at >= $2 and b.starts_at < $3
       order by b.starts_at, c.name`,
      [venueId, day.toJSDate(), day.plus({ days: 1 }).toJSDate()],
    )
    return rows.map(toBooking)
  }

  async cancel(user: AuthUser, id: string): Promise<BookingResponse> {
    return this.db.transaction(async (tx) => {
      // Lock the row so a concurrent cancel or payment can't interleave.
      const booking = await this.db.one<BookingRow & { owner_id: string }>(
        `select b.*, v.owner_id from bookings b
         join courts c on c.id = b.court_id join venues v on v.id = c.venue_id
         where b.id = $1 for update of b`,
        [id],
        tx,
      )
      if (!booking) throw new NotFoundException('Booking not found')

      const isPlayer = booking.user_id === user.id
      const isManager = user.role === 'admin' || booking.owner_id === user.id
      if (!isPlayer && !isManager) throw new ForbiddenException('Not your booking')

      if (booking.status !== 'pending_payment' && booking.status !== 'confirmed') {
        throw new ConflictException(`Booking is already ${booking.status}`)
      }
      const hoursLeft = (booking.starts_at.getTime() - Date.now()) / 3_600_000
      if (!isManager && hoursLeft < CANCELLATION_NOTICE_HOURS) {
        throw new ConflictException(`Bookings can only be cancelled up to ${CANCELLATION_NOTICE_HOURS} hours before`)
      }

      const row = await this.db.one<BookingRow>(
        `update bookings set status = 'cancelled', cancelled_at = now() where id = $1 returning *`,
        [id],
        tx,
      )
      return toBooking(row!)
    })
  }
}
