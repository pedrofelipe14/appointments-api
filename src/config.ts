export interface AppConfig {
  databaseUrl: string
  jwtSecret: string
  port: number
  /** Browser origins allowed to call the API (CORS); empty means any origin. */
  corsOrigins: string[]
}

export const APP_CONFIG = Symbol('APP_CONFIG')

/** Reads settings from the environment, failing fast on anything missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = (name: string) => {
    const value = env[name]
    if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`)
    return value
  }
  const jwtSecret = required('JWT_SECRET')
  if (jwtSecret.length < 16) throw new Error('JWT_SECRET must be at least 16 characters')
  return {
    databaseUrl: required('DATABASE_URL'),
    jwtSecret,
    port: Number(env.PORT ?? 3000),
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  }
}
