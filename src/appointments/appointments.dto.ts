import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator'

const DATE = /^\d{4}-\d{2}-\d{2}$/
export const TIMES_OF_DAY = ['any', 'morning', 'afternoon', 'evening'] as const
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled', 'expired'] as const

export class RequestAppointmentDto {
  @ApiProperty()
  @IsUUID()
  serviceId: string

  @ApiPropertyOptional({
    example: '2026-11-20T16:00:00-03:00',
    description: 'A specific start time. Leave it out to let the API pick the first free time.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string

  @ApiPropertyOptional({ example: '2026-11-16', description: 'Search from this local date (default: today)' })
  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string

  @ApiPropertyOptional({ example: '2026-11-22', description: 'Search until this local date, inclusive (default: two weeks from "from")' })
  @IsOptional()
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string

  @ApiPropertyOptional({ enum: TIMES_OF_DAY, default: 'any', description: 'morning 6-12 · afternoon 12-19 · evening 19-24 (provider time)' })
  @IsOptional()
  @IsIn(TIMES_OF_DAY)
  timeOfDay?: (typeof TIMES_OF_DAY)[number]

  @ApiPropertyOptional({ example: 'Primera clase, nivel principiante' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

export class RejectDto {
  @ApiProperty({ example: 'Ese día no estoy, ¿probás el jueves?' })
  @IsString()
  @Length(1, 300)
  reason: string
}

export class InboxQuery {
  @ApiPropertyOptional({ enum: APPOINTMENT_STATUSES, description: 'Only appointments in this status' })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES)
  status?: (typeof APPOINTMENT_STATUSES)[number]
}

export class AppointmentResponse {
  @ApiProperty() id: string
  @ApiProperty() providerId: string
  @ApiProperty() providerName: string
  @ApiProperty() serviceId: string
  @ApiProperty() serviceName: string
  @ApiProperty() clientId: string
  @ApiProperty() clientName: string
  @ApiProperty() startsAt: string
  @ApiProperty() endsAt: string
  @ApiProperty({ enum: APPOINTMENT_STATUSES }) status: string
  @ApiProperty() priceCents: number
  @ApiProperty() note: string
  @ApiProperty({ nullable: true }) rejectionReason: string | null
  @ApiProperty({ description: 'If the provider has not answered by then, the request expires' }) respondBy: string
  @ApiProperty() createdAt: string
}
