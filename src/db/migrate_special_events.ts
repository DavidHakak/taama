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
    console.log('--- Starting Special Events Migration ---')

    console.log('Adding is_special column to public.shop_events table...')
    await sql`
      ALTER TABLE public.shop_events 
      ADD COLUMN IF NOT EXISTS is_special boolean DEFAULT false NOT NULL;
    `

    console.log('- Schema migrated successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
