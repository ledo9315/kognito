import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '@/lib/db/schema'

type Database = ReturnType<typeof create>

function create() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return drizzle(neon(url), { schema })
}

let instance: Database | null = null

export function getDb(): Database {
  if (!instance) instance = create()
  return instance
}
