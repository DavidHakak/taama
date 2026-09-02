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
    console.log('--- Starting Notification Preferences Migration ---')

    // Opt-outs only: a row exists solely when the user turned a topic off (or
    // back on). Everyone else keeps the default without a row per user/topic.
    await sql`
      create table if not exists public.notification_preferences (
        user_id uuid references public.profiles(id) on delete cascade not null,
        topic text not null,
        enabled boolean not null default true,
        updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
        primary key (user_id, topic)
      );
    `
    console.log('- notification_preferences table created or verified.')

    await sql`alter table public.notification_preferences enable row level security;`

    // Same rule as push_subscriptions: a user only ever touches their own rows.
    // The send paths read this table with the service connection, bypassing RLS.
    await sql`drop policy if exists "Users manage their own notification preferences" on public.notification_preferences;`
    await sql`
      create policy "Users manage their own notification preferences"
        on public.notification_preferences
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    `
    console.log('- notification_preferences RLS policy applied.')

    console.log('Notification preferences migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
