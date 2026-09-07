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
    console.log('--- Starting Order Payment Tasks Migration ---')

    // 1. Link a task back to the catering order it tracks payment for.
    //    'set null' (and not cascade) keeps a payment reminder alive even if the
    //    order row is later removed — the money is still owed.
    await sql`
      alter table public.tasks
        add column if not exists order_id uuid
        references public.orders(id) on delete set null;
    `
    console.log('- tasks.order_id column created or verified.')

    // 2. One payment-tracking task per order, enforced by the database so two
    //    tabs (or a stale client) can never produce a duplicate.
    await sql`
      create unique index if not exists tasks_order_id_unique
        on public.tasks (order_id)
        where order_id is not null;
    `
    console.log('- tasks_order_id_unique partial index created.')

    // 3. The category payment tasks land in.
    await sql`
      insert into public.task_categories (name, color, position)
      select 'קייטרינג', 'gold', coalesce((select max(position) + 1 from public.task_categories), 0)
      where not exists (
        select 1 from public.task_categories where name = 'קייטרינג'
      );
    `
    console.log('- "קייטרינג" task category seeded (only when missing).')

    console.log('Order payment tasks migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
