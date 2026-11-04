import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { AvailabilityQuery, CourtResponse, CreateCourtDto, SlotResponse } from './courts.dto'
import { CourtsService } from './courts.service'

@ApiTags('courts')
@Controller()
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Post('venues/:venueId/courts')
  @Auth('owner', 'admin')
  @ApiCreatedResponse({ type: CourtResponse })
  @ApiConflictResponse({ description: 'Court name already used in this venue' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: CreateCourtDto,
  ): Promise<CourtResponse> {
    return this.courts.create(user, venueId, dto)
  }

  @Get('venues/:venueId/courts')
  @ApiOkResponse({ type: [CourtResponse] })
  @ApiNotFoundResponse({ description: 'Venue not found' })
  list(@Param('venueId', ParseUUIDPipe) venueId: string): Promise<CourtResponse[]> {
    return this.courts.listByVenue(venueId)
  }

  @Get('courts/:id')
  @ApiOkResponse({ type: CourtResponse })
  @ApiNotFoundResponse({ description: 'Court not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CourtResponse> {
    return this.courts.get(id)
  }

  @Get('courts/:id/availability')
  @ApiOkResponse({ type: [SlotResponse], description: 'Every slot of the day and whether it can still be booked' })
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() query: AvailabilityQuery): Promise<SlotResponse[]> {
    return this.courts.availability(id, query.date)
  }
}
