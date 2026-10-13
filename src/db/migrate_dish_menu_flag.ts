import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

// מתג "חלק מהתפריט" לכל מנה: מנה חיצונית לא מופיעה בתפריט המודפס ובסיכום ללקוח,
// אלא רק כשהיא שויכה ידנית להזמנה. כל המנות הקיימות נשארות בתפריט (ברירת מחדל true).
async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in env')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('--- Starting Dish Menu Flag Migration ---')

    console.log('Adding is_menu_item column to public.dishes table...')
    await sql`
      ALTER TABLE public.dishes
      ADD COLUMN IF NOT EXISTS is_menu_item boolean NOT NULL DEFAULT true;
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
