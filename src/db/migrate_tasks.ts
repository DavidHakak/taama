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
    console.log('--- Starting Task Management Migration ---')

    // 1. Task categories
    await sql`
      create table if not exists public.task_categories (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        color text not null default 'amber',
        position integer not null default 0,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- task_categories table created or verified.')

    await sql`alter table public.task_categories enable row level security;`
    await sql`drop policy if exists "Allow approved access on task_categories" on public.task_categories;`
    await sql`
      create policy "Allow approved access on task_categories"
        on public.task_categories
        for all
        to authenticated
        using (public.check_is_approved());
    `
    console.log('- task_categories RLS policy applied.')

    // 2. Tasks
    await sql`
      create table if not exists public.tasks (
        id uuid primary key default gen_random_uuid(),
        category_id uuid references public.task_categories(id) on delete cascade not null,
        title text not null,
        details text,
        status text not null default 'open',
        priority text not null default 'normal',
        due_date date,
        completed_at timestamp with time zone,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null,
        updated_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- tasks table created or verified.')

    // Guard the status/priority domains at the database level so a bad client
    // write can never produce a row the UI has no column for.
    await sql`alter table public.tasks drop constraint if exists tasks_status_check;`
    await sql`
      alter table public.tasks
        add constraint tasks_status_check
        check (status in ('open', 'in_progress', 'waiting', 'done'));
    `
    await sql`alter table public.tasks drop constraint if exists tasks_priority_check;`
    await sql`
      alter table public.tasks
        add constraint tasks_priority_check
        check (priority in ('low', 'normal', 'high'));
    `
    console.log('- tasks check constraints applied.')

    await sql`create index if not exists tasks_category_id_idx on public.tasks (category_id);`
    await sql`create index if not exists tasks_status_idx on public.tasks (status);`
    await sql`create index if not exists tasks_due_date_idx on public.tasks (due_date);`
    console.log('- tasks indexes created.')

    await sql`alter table public.tasks enable row level security;`
    await sql`drop policy if exists "Allow approved access on tasks" on public.tasks;`
    await sql`
      create policy "Allow approved access on tasks"
        on public.tasks
        for all
        to authenticated
        using (public.check_is_approved());
    `
    console.log('- tasks RLS policy applied.')

    // 3. Keep updated_at honest without relying on every client to set it.
    await sql`
      create or replace function public.touch_tasks_updated_at()
      returns trigger as $$
      begin
        new.updated_at = timezone('utc'::text, now());
        return new;
      end;
      $$ language plpgsql;
    `
    await sql`drop trigger if exists tasks_touch_updated_at on public.tasks;`
    await sql`
      create trigger tasks_touch_updated_at
        before update on public.tasks
        for each row execute function public.touch_tasks_updated_at();
    `
    console.log('- tasks updated_at trigger installed.')

    // 4. Seed a starter category so the page is never empty on first load.
    await sql`
      insert into public.task_categories (name, color, position)
      select 'משימות כלליות', 'amber', 0
      where not exists (select 1 from public.task_categories);
    `
    console.log('- default category seeded (only when table was empty).')

    console.log('Task management migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
