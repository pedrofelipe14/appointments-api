import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsTimeZone, Length } from 'class-validator'

export class CreateVenueDto {
  @ApiProperty({ example: 'Complejo La Bombonerita' })
  @IsString()
  @Length(1, 120)
  name: string

  @ApiProperty({ example: 'Av. Siempre Viva 742, Mar del Plata' })
  @IsString()
  @Length(1, 200)
  address: string

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires', default: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string
}

export class VenueResponse {
  @ApiProperty() id: string
  @ApiProperty() name: string
  @ApiProperty() address: string
  @ApiProperty() timezone: string
  @ApiProperty() ownerId: string
}
