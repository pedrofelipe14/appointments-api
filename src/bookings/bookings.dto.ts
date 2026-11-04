import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsUUID, Matches, Max, Min } from 'class-validator'

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  courtId: string

  @ApiProperty({ example: '2026-11-20T20:00:00-03:00', description: 'ISO 8601 with offset; must fall on a slot boundary' })
  @IsISO8601({ strict: true })
  startsAt: string

  @ApiProperty({ example: 60, description: 'A multiple of the court slot length, up to 180' })
  @IsInt()
  @Min(30)
  @Max(180)
  durationMinutes: number
}

export class VenueBookingsQuery {
  @ApiProperty({ example: '2026-11-20', description: 'Local date at the venue (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string
}

export const BOOKING_STATUSES = ['pending_payment', 'confirmed', 'cancelled', 'expired'] as const

export class BookingResponse {
  @ApiProperty() id: string
  @ApiProperty() courtId: string
  @ApiProperty() userId: string
  @ApiProperty() startsAt: string
  @ApiProperty() endsAt: string
  @ApiProperty({ enum: BOOKING_STATUSES }) status: string
  @ApiProperty({ description: 'Total price in cents' }) priceCents: number
  @ApiProperty({ nullable: true, description: 'An unpaid booking stops holding the slot after this' }) expiresAt: string | null
  @ApiProperty() createdAt: string
}
