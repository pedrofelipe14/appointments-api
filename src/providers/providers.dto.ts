import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsTimeZone, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export class CreateProviderDto {
  @ApiProperty({ example: 'Clases de guitarra con Lucía' })
  @IsString()
  @Length(1, 120)
  name: string

  @ApiPropertyOptional({ example: 'Guitarra eléctrica y acústica, todos los niveles.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  about?: string

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires', default: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string

  @ApiPropertyOptional({ example: 24, default: 24, description: 'Hours to confirm a request before it expires (1-168)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  confirmWithinHours?: number
}

export class WorkingRangeDto {
  @ApiProperty({ example: 1, description: 'ISO weekday: 1 = Monday ... 7 = Sunday' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number

  @ApiProperty({ example: '10:00' })
  @Matches(TIME, { message: 'startsAt must be HH:MM' })
  startsAt: string

  @ApiProperty({ example: '13:00' })
  @Matches(TIME, { message: 'endsAt must be HH:MM' })
  endsAt: string
}

export class WorkingHoursDto {
  @ApiProperty({ type: [WorkingRangeDto], description: 'Replaces the whole weekly schedule' })
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => WorkingRangeDto)
  hours: WorkingRangeDto[]
}

export class CreateServiceDto {
  @ApiProperty({ example: 'Clase individual' })
  @IsString()
  @Length(1, 80)
  name: string

  @ApiPropertyOptional({ example: 'Una hora, en el estudio o por videollamada.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiProperty({ example: 60, description: 'Minutes, a multiple of 15 between 15 and 480' })
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number

  @ApiProperty({ example: 1500000, description: 'Price in cents (ARS 15,000.00)' })
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents: number
}

export class AvailabilityQuery {
  @ApiProperty()
  @IsUUID()
  serviceId: string

  @ApiProperty({ example: '2026-11-20', description: "Local date at the provider's time zone (YYYY-MM-DD)" })
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string
}

export class ServiceResponse {
  @ApiProperty() id: string
  @ApiProperty() providerId: string
  @ApiProperty() name: string
  @ApiProperty() description: string
  @ApiProperty() durationMinutes: number
  @ApiProperty() priceCents: number
}

export class WorkingRangeResponse {
  @ApiProperty() weekday: number
  @ApiProperty({ example: '10:00' }) startsAt: string
  @ApiProperty({ example: '13:00' }) endsAt: string
}

export class ProviderResponse {
  @ApiProperty() id: string
  @ApiProperty() userId: string
  @ApiProperty() name: string
  @ApiProperty() about: string
  @ApiProperty() timezone: string
  @ApiProperty() confirmWithinHours: number
  @ApiProperty({ type: [ServiceResponse] }) services: ServiceResponse[]
  @ApiProperty({ type: [WorkingRangeResponse] }) workingHours: WorkingRangeResponse[]
}

export class SlotResponse {
  @ApiProperty() startsAt: string
  @ApiProperty() endsAt: string
}
