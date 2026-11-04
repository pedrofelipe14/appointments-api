import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common'
import { Pool, type PoolClient, type QueryResultRow } from 'pg'
import { APP_CONFIG, type AppConfig } from '../config'

export const PG_POOL = Symbol('PG_POOL')

/** Executes queries. Accepts either the pool or a client that's inside a transaction. */
export type Queryable = Pick<Pool, 'query'> | PoolClient

@Injectable()
export class Database implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) readonly pool: Pool) {}

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = [], on: Queryable = this.pool): Promise<T[]> {
    return (await on.query<T>(sql, params)).rows
  }

  async one<T extends QueryResultRow>(sql: string, params: unknown[] = [], on: Queryable = this.pool): Promise<T | undefined> {
    return (await this.query<T>(sql, params, on))[0]
  }

  /** Runs fn in a transaction: committed if it resolves, rolled back if it throws. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const result = await fn(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end()
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new Pool({ connectionString: config.databaseUrl, max: 20 }),
    },
    Database,
  ],
  exports: [Database],
})
export class DatabaseModule {}
