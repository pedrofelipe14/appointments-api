import { Controller, Get, Module, type DynamicModule } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { AuthModule } from './auth/auth.module'
import { BookingsController } from './bookings/bookings.controller'
import { BookingsService } from './bookings/bookings.service'
import { APP_CONFIG, type AppConfig } from './config'
import { CourtsController } from './courts/courts.controller'
import { CourtsService } from './courts/courts.service'
import { Database, DatabaseModule } from './db/database'
import { VenuesController } from './venues/venues.controller'
import { VenuesService } from './venues/venues.service'

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(private readonly db: Database) {}

  @Get()
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
      controllers: [HealthController, VenuesController, CourtsController, BookingsController],
      providers: [VenuesService, CourtsService, BookingsService],
    }
  }
}
