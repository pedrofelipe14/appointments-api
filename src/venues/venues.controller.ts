import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { CreateVenueDto, VenueResponse } from './venues.dto'
import { toVenue, VenuesService } from './venues.service'

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Post()
  @Auth('owner', 'admin')
  @ApiCreatedResponse({ type: VenueResponse })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVenueDto): Promise<VenueResponse> {
    return this.venues.create(user, dto)
  }

  @Get()
  @ApiOkResponse({ type: [VenueResponse] })
  list(): Promise<VenueResponse[]> {
    return this.venues.list()
  }

  @Get(':id')
  @ApiOkResponse({ type: VenueResponse })
  @ApiNotFoundResponse({ description: 'Venue not found' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<VenueResponse> {
    return toVenue(await this.venues.get(id))
  }
}
