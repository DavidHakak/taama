import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in .env.local')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('Adding category column to dishes table if not exists...')
    await sql`ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS category text;`
    console.log('Column category successfully added!')
  } catch (err) {
    console.error('Error running migration:', err)
  } finally {
    await sql.end()
  }
}

run()
