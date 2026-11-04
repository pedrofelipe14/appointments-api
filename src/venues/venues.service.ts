import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types'
import { Database } from '../db/database'
import type { CreateVenueDto, VenueResponse } from './venues.dto'

export interface VenueRow {
  id: string
  owner_id: string
  name: string
  address: string
  timezone: string
}

export const toVenue = (row: VenueRow): VenueResponse => ({
  id: row.id,
  name: row.name,
  address: row.address,
  timezone: row.timezone,
  ownerId: row.owner_id,
})

@Injectable()
export class VenuesService {
  constructor(private readonly db: Database) {}

  async create(owner: AuthUser, dto: CreateVenueDto): Promise<VenueResponse> {
    const row = await this.db.one<VenueRow>(
      `insert into venues (owner_id, name, address, timezone)
       values ($1, $2, $3, coalesce($4, 'America/Argentina/Buenos_Aires')) returning *`,
      [owner.id, dto.name, dto.address, dto.timezone ?? null],
    )
    return toVenue(row!)
  }

  async list(): Promise<VenueResponse[]> {
    return (await this.db.query<VenueRow>('select * from venues order by name')).map(toVenue)
  }

  async get(id: string): Promise<VenueRow> {
    const venue = await this.db.one<VenueRow>('select * from venues where id = $1', [id])
    if (!venue) throw new NotFoundException('Venue not found')
    return venue
  }

  /** The venue, if the user owns it (admins manage every venue). */
  async getManaged(id: string, user: AuthUser): Promise<VenueRow> {
    const venue = await this.get(id)
    if (user.role !== 'admin' && venue.owner_id !== user.id) throw new ForbiddenException('Not your venue')
    return venue
  }
}
