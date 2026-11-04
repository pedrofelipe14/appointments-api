// A typed client for the Appointments API. Every method maps to one endpoint.

export type Role = 'client' | 'provider' | 'admin'
export type Status = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'expired'
export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening'

export interface User {
  id: string
  email: string
  name: string
  role: Role
}

export interface Service {
  id: string
  providerId: string
  name: string
  description: string
  durationMinutes: number
  priceCents: number
}

export interface WorkingRange {
  weekday: number // ISO: 1 = Monday ... 7 = Sunday
  startsAt: string // HH:MM
  endsAt: string
}

export interface Provider {
  id: string
  userId: string
  name: string
  about: string
  timezone: string
  confirmWithinHours: number
  services: Service[]
  workingHours: WorkingRange[]
}

export interface Slot {
  startsAt: string
  endsAt: string
}

export interface Appointment {
  id: string
  providerId: string
  providerName: string
  serviceId: string
  serviceName: string
  clientId: string
  clientName: string
  startsAt: string
  endsAt: string
  status: Status
  priceCents: number
  note: string
  rejectionReason: string | null
  respondBy: string
  createdAt: string
}

export interface Notification {
  id: string
  kind: 'requested' | 'confirmed' | 'rejected' | 'expired' | 'cancelled'
  appointmentId: string
  serviceName: string
  startsAt: string
  read: boolean
  createdAt: string
}

export interface AppointmentRequest {
  serviceId: string
  startsAt?: string
  from?: string
  to?: string
  timeOfDay?: TimeOfDay
  note?: string
}

/** A failed call. status 0 means the server could not be reached at all. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** The readable part of a NestJS error body: `message` is a string, or a list of validation errors. */
export function errorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message
  if (Array.isArray(message)) return message.join(' · ')
  if (typeof message === 'string' && message) return message
  return `HTTP ${status}`
}

export class Api {
  constructor(
    readonly base: string,
    readonly token?: string,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.base.replace(/\/+$/, '') + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'offline')
    }
    const data = res.status === 204 ? null : await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status))
    return data as T
  }

  register = (body: { email: string; name: string; password: string; role: 'client' | 'provider' }) => this.call<User>('POST', '/auth/register', body)
  login = (body: { email: string; password: string }) => this.call<{ accessToken: string; expiresIn: number }>('POST', '/auth/login', body)
  me = () => this.call<User>('GET', '/auth/me')

  providers = () => this.call<Provider[]>('GET', '/providers')
  createProvider = (body: { name: string; about?: string; timezone?: string; confirmWithinHours?: number }) => this.call<Provider>('POST', '/providers', body)
  setHours = (id: string, hours: WorkingRange[]) => this.call<Provider>('PUT', `/providers/${id}/working-hours`, { hours })
  addService = (id: string, body: { name: string; description?: string; durationMinutes: number; priceCents: number }) =>
    this.call<Service>('POST', `/providers/${id}/services`, body)
  availability = (id: string, serviceId: string, date: string) =>
    this.call<Slot[]>('GET', `/providers/${id}/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}`)

  request = (body: AppointmentRequest) => this.call<Appointment>('POST', '/appointments', body)
  mine = () => this.call<Appointment[]>('GET', '/appointments/me')
  inbox = (status?: Status) => this.call<Appointment[]>('GET', `/appointments/inbox${status ? `?status=${status}` : ''}`)
  confirm = (id: string) => this.call<Appointment>('POST', `/appointments/${id}/confirm`)
  reject = (id: string, reason: string) => this.call<Appointment>('POST', `/appointments/${id}/reject`, { reason })
  cancel = (id: string) => this.call<Appointment>('POST', `/appointments/${id}/cancel`)

  notifications = () => this.call<{ unread: number; items: Notification[] }>('GET', '/notifications')
  readNotifications = () => this.call<null>('POST', '/notifications/read')
}
