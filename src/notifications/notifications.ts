import { Controller, Get, HttpCode, Injectable, Post } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { Database } from '../db/database'

export class NotificationResponse {
  @ApiProperty() id: string
  @ApiProperty({ enum: ['requested', 'confirmed', 'rejected', 'expired', 'cancelled'] }) kind: string
  @ApiProperty() appointmentId: string
  @ApiProperty() serviceName: string
  @ApiProperty() startsAt: string
  @ApiProperty() read: boolean
  @ApiProperty() createdAt: string
}

export class NotificationsResponse {
  @ApiProperty() unread: number
  @ApiProperty({ type: [NotificationResponse] }) items: NotificationResponse[]
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: Database) {}

  async list(user: AuthUser): Promise<NotificationsResponse> {
    const rows = await this.db.query<{ id: string; kind: string; appointment_id: string; service_name: string; starts_at: Date; read_at: Date | null; created_at: Date }>(
      `select n.*, s.name as service_name, a.starts_at from notifications n
       join appointments a on a.id = n.appointment_id join services s on s.id = a.service_id
       where n.user_id = $1 order by n.created_at desc limit 50`,
      [user.id],
    )
    return {
      unread: rows.filter((r) => !r.read_at).length,
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        appointmentId: r.appointment_id,
        serviceName: r.service_name,
        startsAt: r.starts_at.toISOString(),
        read: r.read_at !== null,
        createdAt: r.created_at.toISOString(),
      })),
    }
  }

  async readAll(user: AuthUser): Promise<void> {
    await this.db.query('update notifications set read_at = now() where user_id = $1 and read_at is null', [user.id])
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications', description: 'New requests for providers; confirmations, rejections, expirations and cancellations for clients.' })
  @Auth()
  @ApiOkResponse({ type: NotificationsResponse })
  list(@CurrentUser() user: AuthUser): Promise<NotificationsResponse> {
    return this.notifications.list(user)
  }

  @Post('read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark all as read' })
  @Auth()
  async readAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.readAll(user)
  }
}
