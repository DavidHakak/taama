import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in env')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('--- Starting Actual Cost Migration ---')

    console.log('Adding actual_cost column to public.orders table...')
    await sql`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS actual_cost numeric(10, 2);
    `

    console.log('- Schema migrated successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
