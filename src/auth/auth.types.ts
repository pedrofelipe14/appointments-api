export type Role = 'client' | 'provider' | 'admin'

/** What the JWT carries and what guarded handlers receive as the current user. */
export interface AuthUser {
  id: string
  role: Role
}
