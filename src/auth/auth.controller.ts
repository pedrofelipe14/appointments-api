import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { LoginDto, RegisterDto, TokenResponse, UserResponse } from './auth.dto'
import { Auth, CurrentUser } from './auth.guard'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth.types'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({ description: 'Email already registered' })
  register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return this.auth.register(dto)
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() dto: LoginDto): Promise<TokenResponse> {
    return this.auth.login(dto)
  }

  @Get('me')
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return this.auth.me(user.id)
  }
}
