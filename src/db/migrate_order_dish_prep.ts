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
    console.log('--- Starting Order Dish Prep Migration ---')

    console.log('Adding is_prepared column to public.order_dishes table...')
    await sql`
      ALTER TABLE public.order_dishes
      ADD COLUMN IF NOT EXISTS is_prepared boolean NOT NULL DEFAULT false;
    `

    console.log('- Schema migrated successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

run()
