export type Role = 'player' | 'owner' | 'admin'

/** What the JWT carries and what guarded handlers receive as the current user. */
export interface AuthUser {
  id: string
  role: Role
}
