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
    console.log('--- Starting Event Announcements Migration ---')

    // Records the last time customers were notified about this event, so the
    // UI can show "already sent" and an accidental second tap is deliberate.
    await sql`
      ALTER TABLE public.shop_events
      ADD COLUMN IF NOT EXISTS announced_at timestamp with time zone;
    `
    console.log('- shop_events.announced_at added.')

    console.log('Event announcements migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
