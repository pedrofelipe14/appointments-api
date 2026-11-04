import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { LoginDto, RegisterDto, TokenResponse, UserResponse } from './auth.dto'
import { Auth, CurrentUser } from './auth.guard'
import { AuthService } from './auth.service'
import type { AuthUser } from './auth.types'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account', description: 'Players book courts; owners publish venues and courts.' })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({ description: 'Email already registered' })
  register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return this.auth.register(dto)
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in', description: 'Returns a JWT valid for one hour. Send it as `Authorization: Bearer <token>`.' })
  @HttpCode(200)
  @ApiOkResponse({ type: TokenResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() dto: LoginDto): Promise<TokenResponse> {
    return this.auth.login(dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'The current user' })
  @Auth()
  @ApiOkResponse({ type: UserResponse })
  me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return this.auth.me(user.id)
  }
}
