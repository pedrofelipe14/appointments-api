import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'

export class RegisterDto {
  @ApiProperty({ example: 'lio@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string

  @ApiProperty({ example: 'Lio' })
  @IsString()
  @Length(1, 80)
  name: string

  @ApiProperty({ example: 'a-long-password', minLength: 8 })
  @IsString()
  @Length(8, 128)
  password: string

  @ApiPropertyOptional({
    enum: ['player', 'owner'],
    default: 'player',
    description: 'Owners can list venues and courts. Admins are never self-registered.',
  })
  @IsOptional()
  @IsIn(['player', 'owner'])
  role?: 'player' | 'owner'
}

export class LoginDto {
  @ApiProperty({ example: 'lio@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'a-long-password' })
  @IsString()
  password: string
}

export class TokenResponse {
  @ApiProperty() accessToken: string
  @ApiProperty({ example: 3600 }) expiresIn: number
}

export class UserResponse {
  @ApiProperty() id: string
  @ApiProperty() email: string
  @ApiProperty() name: string
  @ApiProperty({ enum: ['player', 'owner', 'admin'] }) role: string
}
