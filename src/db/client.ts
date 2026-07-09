import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * The evidence ledger lives in Neon Postgres, reached only over the
 * DATABASE_URL connection string held in an environment variable (PRD 9.3).
 * Never hardcode the connection string.
 */
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

// Neon requires TLS; `sslmode=require` in the connection string handles it.
export const sql = postgres(databaseUrl)
export const db = drizzle(sql, { schema })

export type Database = typeof db
