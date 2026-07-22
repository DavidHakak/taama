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
    console.log('--- Fixing RLS policies for tasks and task_categories ---')

    // Enable RLS on tasks and task_categories
    await sql`ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;`
    await sql`ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;`

    // Recreate policies using private.check_is_approved()
    await sql`DROP POLICY IF EXISTS "Allow approved access" ON public.task_categories;`
    await sql`
      CREATE POLICY "Allow approved access" ON public.task_categories
        FOR ALL TO authenticated USING (private.check_is_approved());
    `

    await sql`DROP POLICY IF EXISTS "Allow approved access" ON public.tasks;`
    await sql`
      CREATE POLICY "Allow approved access" ON public.tasks
        FOR ALL TO authenticated USING (private.check_is_approved());
    `

    console.log('Successfully recreated RLS policies on tasks and task_categories!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
