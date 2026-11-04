import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import {
  AvailabilityQuery, CreateProviderDto, CreateServiceDto, ProviderResponse, ServiceResponse, SlotResponse, WorkingHoursDto,
} from './providers.dto'
import { ProvidersService } from './providers.service'

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Post()
  @ApiOperation({ summary: 'Create your provider profile', description: 'One per provider account. Its time zone defines what "10:00" means.' })
  @Auth('provider', 'admin')
  @ApiCreatedResponse({ type: ProviderResponse })
  @ApiConflictResponse({ description: 'You already have a provider profile' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderDto): Promise<ProviderResponse> {
    return this.providers.create(user, dto)
  }

  @Get()
  @ApiOperation({ summary: 'List providers', description: 'With their services and weekly working hours.' })
  @ApiOkResponse({ type: [ProviderResponse] })
  list(): Promise<ProviderResponse[]> {
    return this.providers.list()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a provider' })
  @ApiOkResponse({ type: ProviderResponse })
  @ApiNotFoundResponse({ description: 'Provider not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ProviderResponse> {
    return this.providers.get(id)
  }

  @Put(':id/working-hours')
  @ApiOperation({ summary: 'Set your weekly working hours', description: 'Replaces the whole schedule. Several ranges per day are allowed.' })
  @Auth('provider', 'admin')
  @ApiOkResponse({ type: ProviderResponse })
  setHours(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WorkingHoursDto): Promise<ProviderResponse> {
    return this.providers.setHours(user, id, dto)
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Offer a service', description: 'Name, duration (multiple of 15 minutes) and price.' })
  @Auth('provider', 'admin')
  @ApiCreatedResponse({ type: ServiceResponse })
  @ApiConflictResponse({ description: 'Service name already used' })
  addService(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateServiceDto): Promise<ServiceResponse> {
    return this.providers.addService(user, id, dto)
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Free times for a service on a day', description: 'Every start time a client could request, on a 15-minute grid.' })
  @ApiOkResponse({ type: [SlotResponse] })
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() query: AvailabilityQuery): Promise<SlotResponse[]> {
    return this.providers.availability(id, query.serviceId, query.date)
  }
}
