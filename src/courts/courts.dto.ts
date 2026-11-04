import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export const SPORTS = ['futbol5', 'futbol7', 'futbol11'] as const

export class CreateCourtDto {
  @ApiProperty({ example: 'Cancha 1' })
  @IsString()
  @Length(1, 60)
  name: string

  @ApiProperty({ enum: SPORTS })
  @IsIn(SPORTS)
  sport: (typeof SPORTS)[number]

  @ApiProperty({ example: 4500000, description: 'Price per hour in cents (ARS 45,000.00)' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  pricePerHourCents: number

  @ApiProperty({ example: '09:00', description: 'Local opening time (HH:MM)' })
  @Matches(TIME, { message: 'opensAt must be HH:MM' })
  opensAt: string

  @ApiProperty({ example: '23:00', description: 'Local closing time (HH:MM), after opensAt' })
  @Matches(TIME, { message: 'closesAt must be HH:MM' })
  closesAt: string

  @ApiPropertyOptional({ enum: [30, 60, 90, 120], default: 60 })
  @IsOptional()
  @IsIn([30, 60, 90, 120])
  slotMinutes?: number
}

export class AvailabilityQuery {
  @ApiProperty({ example: '2026-11-20', description: 'Local date at the venue (YYYY-MM-DD)' })
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string
}

export class CourtResponse {
  @ApiProperty() id: string
  @ApiProperty() venueId: string
  @ApiProperty() name: string
  @ApiProperty({ enum: SPORTS }) sport: string
  @ApiProperty() pricePerHourCents: number
  @ApiProperty({ example: '09:00' }) opensAt: string
  @ApiProperty({ example: '23:00' }) closesAt: string
  @ApiProperty() slotMinutes: number
  @ApiProperty() timezone: string
}

export class SlotResponse {
  @ApiProperty() startsAt: string
  @ApiProperty() endsAt: string
  @ApiProperty() available: boolean
}
