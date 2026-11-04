import { Controller, Get, Module, type DynamicModule } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AppointmentsController } from './appointments/appointments.controller'
import { AppointmentsService } from './appointments/appointments.service'
import { AuthModule } from './auth/auth.module'
import { APP_CONFIG, type AppConfig } from './config'
import { Database, DatabaseModule } from './db/database'
import { NotificationsController, NotificationsService } from './notifications/notifications'
import { ProvidersController } from './providers/providers.controller'
import { ProvidersService } from './providers/providers.service'

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(private readonly db: Database) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'The API is up and can reach the database' })
  async check(): Promise<{ status: 'ok' }> {
    await this.db.query('select 1')
    return { status: 'ok' }
  }
}

@Module({})
export class AppModule {
  /** Built from explicit config so tests can point it at their own database. */
  static forRoot(config: AppConfig): DynamicModule {
    const configModule: DynamicModule = {
      module: class ConfigModule {},
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    }
    return {
      module: AppModule,
      imports: [configModule, DatabaseModule, AuthModule],
      controllers: [HealthController, ProvidersController, AppointmentsController, NotificationsController],
      providers: [ProvidersService, AppointmentsService, NotificationsService],
    }
  }
}
