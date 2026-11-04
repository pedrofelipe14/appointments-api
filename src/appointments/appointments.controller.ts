import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiTags,
} from '@nestjs/swagger'
import { Auth, CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { AppointmentResponse, InboxQuery, RejectDto, RequestAppointmentDto } from './appointments.dto'
import { AppointmentsService } from './appointments.service'

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Request an appointment',
    description: 'Give a startsAt, or a window and time of day and let the API pick the first free time. The request stays pending until the provider confirms it. Concurrent requests never get the same time.',
  })
  @Auth()
  @ApiCreatedResponse({ type: AppointmentResponse })
  @ApiBadRequestResponse({ description: 'Outside working hours, off the 15-minute grid, too soon, or a bad window' })
  @ApiConflictResponse({ description: 'That time is taken, or no free time in the window' })
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestAppointmentDto): Promise<AppointmentResponse> {
    return this.appointments.request(user, dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'My appointments', description: 'As a client, newest first.' })
  @Auth()
  @ApiOkResponse({ type: [AppointmentResponse] })
  mine(@CurrentUser() user: AuthUser): Promise<AppointmentResponse[]> {
    return this.appointments.mine(user)
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Requests and appointments to handle', description: "The provider's agenda. Filter with ?status=pending to see what needs an answer." })
  @Auth('provider', 'admin')
  @ApiOkResponse({ type: [AppointmentResponse] })
  inbox(@CurrentUser() user: AuthUser, @Query() query: InboxQuery): Promise<AppointmentResponse[]> {
    return this.appointments.inbox(user, query.status)
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a request', description: 'Only the provider. The client gets a notification.' })
  @Auth('provider', 'admin')
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiForbiddenResponse({ description: "Not this provider's request" })
  @ApiConflictResponse({ description: 'Already answered, cancelled or expired' })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AppointmentResponse> {
    return this.appointments.confirm(user, id)
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a request', description: 'Only the provider, with a reason the client will see. The time frees up.' })
  @Auth('provider', 'admin')
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiConflictResponse({ description: 'Already answered, cancelled or expired' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto): Promise<AppointmentResponse> {
    return this.appointments.reject(user, id, dto.reason)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an appointment', description: 'Client or provider. Clients need 12 hours of notice for confirmed appointments.' })
  @Auth()
  @ApiOkResponse({ type: AppointmentResponse })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  @ApiConflictResponse({ description: 'Already over, or too late for the client to cancel' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AppointmentResponse> {
    return this.appointments.cancel(user, id)
  }
}
