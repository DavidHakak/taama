import { loadEnvConfig } from '@next/env'
// Load environment variables immediately before imports are resolved
loadEnvConfig(process.cwd())

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Prepare connections (disable prefetch for pgbouncer poolers and require SSL)
const client = postgres(connectionString, { prepare: false, ssl: 'require' })
export const db = drizzle(client, { schema })
