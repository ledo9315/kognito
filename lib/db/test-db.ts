import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Database } from '@/lib/db'
import * as schema from '@/lib/db/schema'

/**
 * An in-process Postgres for unit tests, brought to the current schema by the
 * real migration files.
 *
 * The client is cast to the production type. pglite and the Neon driver build
 * structurally different drizzle instances, but the query builders used in
 * lib/notebooks.ts are identical, so the cast lets those functions be tested
 * without a network database. It lives here, once, instead of in every test.
 */
export async function createTestDb() {
  // pgvector is not built into pglite, it comes as a separate package. The
  // migration creates the extension, so without this every test would fail
  // on the very first one.
  const client = new PGlite({ extensions: { vector } })
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './lib/db/migrations' })
  return { db: db as unknown as Database, close: () => client.close() }
}
