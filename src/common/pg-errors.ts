/** PostgreSQL error codes the API turns into proper HTTP answers. */
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_EXCLUSION_VIOLATION = '23P01'

export const isPgError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === code
