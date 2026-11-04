import { Pool } from 'pg'
import { createApp } from './app'
import { loadConfig } from './config'
import { migrate } from './db/migrate'

async function main(): Promise<void> {
  const config = loadConfig()

  const pool = new Pool({ connectionString: config.databaseUrl })
  await migrate(pool, (msg) => console.log(`[migrate] ${msg}`))
  await pool.end()

  const app = await createApp(config)
  await app.listen(config.port)
  console.log(`Court Booking API on http://localhost:${config.port} · docs at /docs`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
