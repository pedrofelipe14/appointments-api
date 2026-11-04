import {
  applyDecorators, type CanActivate, createParamDecorator, type ExecutionContext, ForbiddenException,
  Injectable, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import type { Request } from 'express'
import type { AuthUser, Role } from './auth.types'

const ROLES_KEY = 'roles'

type AuthedRequest = Request & { user?: AuthUser }

/** Checks the bearer token and, when the handler names roles, that the user has one of them. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token')

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(token)
      request.user = { id: payload.sub, role: payload.role }
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (roles?.length && !roles.includes(request.user.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`)
    }
    return true
  }
}

/** Requires a valid token; pass roles to restrict who may call the endpoint. */
export const Auth = (...roles: Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(AuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid token' }),
    ...(roles.length ? [ApiForbiddenResponse({ description: `Requires role: ${roles.join(' or ')}` })] : []),
  )

/** The authenticated user, set by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest<AuthedRequest>().user!,
)
