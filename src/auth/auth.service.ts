import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { isPgError, PG_UNIQUE_VIOLATION } from '../common/pg-errors'
import { Database } from '../db/database'
import type { LoginDto, RegisterDto, TokenResponse, UserResponse } from './auth.dto'
import { hashPassword, verifyPassword } from './password'

export const TOKEN_TTL_SECONDS = 3600

interface UserRow {
  id: string
  email: string
  name: string
  role: 'player' | 'owner' | 'admin'
  password_hash: string
}

const toUser = (row: UserRow): UserResponse => ({ id: row.id, email: row.email, name: row.name, role: row.role })

@Injectable()
export class AuthService {
  constructor(private readonly db: Database, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto): Promise<UserResponse> {
    try {
      const row = await this.db.one<UserRow>(
        `insert into users (email, name, password_hash, role) values ($1, $2, $3, $4)
         returning id, email, name, role, password_hash`,
        [dto.email.toLowerCase(), dto.name, await hashPassword(dto.password), dto.role ?? 'player'],
      )
      return toUser(row!)
    } catch (error) {
      if (isPgError(error, PG_UNIQUE_VIOLATION)) throw new ConflictException('Email already registered')
      throw error
    }
  }

  async login(dto: LoginDto): Promise<TokenResponse> {
    const user = await this.db.one<UserRow>('select * from users where email = $1', [dto.email.toLowerCase()])
    // Same answer for an unknown email and a wrong password: no account enumeration.
    if (!user || !(await verifyPassword(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password')
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role }, { expiresIn: TOKEN_TTL_SECONDS })
    return { accessToken, expiresIn: TOKEN_TTL_SECONDS }
  }

  async me(userId: string): Promise<UserResponse> {
    const user = await this.db.one<UserRow>('select * from users where id = $1', [userId])
    if (!user) throw new NotFoundException('User not found')
    return toUser(user)
  }
}
