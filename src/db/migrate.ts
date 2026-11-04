import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations')

/** Applies migrations/*.sql in name order, each once, each in its own transaction. */
export async function migrate(pool: Pool, log: (msg: string) => void = () => {}): Promise<string[]> {
  await pool.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`)
  const done = new Set((await pool.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name))
  const pending = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !done.has(f)).sort()

  for (const file of pending) {
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
      await client.query('insert into schema_migrations (name) values ($1)', [file])
      await client.query('commit')
      log(`applied ${file}`)
    } catch (error) {
      await client.query('rollback')
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    } finally {
      client.release()
    }
  }
  return pending
}

// `npm run db:migrate`
if (require.main === module) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing DATABASE_URL')
  const pool = new Pool({ connectionString: url })
  migrate(pool, console.log)
    .then((applied) => console.log(applied.length ? 'done' : 'already up to date'))
    .finally(() => pool.end())
}
