import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags,
} from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { BookingResponse, CreateBookingDto, VenueBookingsQuery } from './bookings.dto'
import { BookingsService } from './bookings.service'

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings')
  @ApiOperation({ summary: 'Book a slot', description: 'Held for 15 minutes until paid. Overlapping requests get 409, even when they arrive at the same instant.' })
  @Auth()
  @ApiCreatedResponse({ type: BookingResponse, description: 'Booked; holds the slot until paid' })
  @ApiBadRequestResponse({ description: 'Outside opening hours, off the slot grid, or in the past' })
  @ApiConflictResponse({ description: 'That time is already booked' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto): Promise<BookingResponse> {
    return this.bookings.create(user, dto)
  }

  @Get('bookings/me')
  @ApiOperation({ summary: 'My bookings' })
  @Auth()
  @ApiOkResponse({ type: [BookingResponse] })
  mine(@CurrentUser() user: AuthUser): Promise<BookingResponse[]> {
    return this.bookings.mine(user)
  }

  @Post('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking', description: 'Players need 24 hours of notice; the venue owner can always cancel.' })
  @HttpCode(200)
  @Auth()
  @ApiOkResponse({ type: BookingResponse })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Already cancelled/expired, or too close to start for a player to cancel' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BookingResponse> {
    return this.bookings.cancel(user, id)
  }

  @Get('venues/:venueId/bookings')
  @ApiOperation({ summary: "A venue's bookings for a day", description: 'For the venue owner: the agenda of a local date.' })
  @Auth('owner', 'admin')
  @ApiOkResponse({ type: [BookingResponse], description: 'All bookings at the venue on that local date' })
  forVenue(
    @CurrentUser() user: AuthUser,
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Query() query: VenueBookingsQuery,
  ): Promise<BookingResponse[]> {
    return this.bookings.forVenue(user, venueId, query.date)
  }
}
