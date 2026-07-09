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
    console.log('--- Starting Push Subscriptions Migration ---')

    // One row per *device*, not per user: the same person may have the PWA on
    // an Android phone and a browser on a laptop, each with its own endpoint.
    await sql`
      create table if not exists public.push_subscriptions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references public.profiles(id) on delete cascade not null,
        endpoint text not null unique,
        p256dh text not null,
        auth text not null,
        user_agent text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null,
        last_success_at timestamp with time zone
      );
    `
    console.log('- push_subscriptions table created or verified.')

    await sql`create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);`
    console.log('- index created.')

    await sql`alter table public.push_subscriptions enable row level security;`

    // A user may only ever see or touch their own device subscriptions.
    // The cron job reads this table with the service connection, bypassing RLS.
    await sql`drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;`
    await sql`
      create policy "Users manage their own push subscriptions"
        on public.push_subscriptions
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    `
    console.log('- push_subscriptions RLS policy applied.')

    console.log('Push subscriptions migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
