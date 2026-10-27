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
    console.log('--- Starting Dish Components Migration ---')

    // מנה מורכבת: שורה לכל תת-מנה, עם מספר מנות ממנה לכל סועד.
    // שמות ה-FK מפורשים כי השאילתות המקוננות של Supabase מפנות אליהם בשמם
    // (יש שני מפתחות זרים לאותה טבלת dishes).
    await sql`
      create table if not exists public.dish_components (
        id uuid primary key default gen_random_uuid(),
        dish_id uuid not null,
        component_dish_id uuid not null,
        quantity numeric(10, 3) not null default 1.000,
        constraint dish_components_dish_id_fkey
          foreign key (dish_id) references public.dishes(id) on delete cascade,
        constraint dish_components_component_dish_id_fkey
          foreign key (component_dish_id) references public.dishes(id) on delete restrict,
        constraint dish_components_unique unique (dish_id, component_dish_id),
        constraint dish_components_not_self check (dish_id <> component_dish_id)
      );
    `
    console.log('- dish_components table created or verified.')

    await sql`create index if not exists dish_components_dish_id_idx on public.dish_components (dish_id);`
    await sql`create index if not exists dish_components_component_dish_id_idx on public.dish_components (component_dish_id);`
    console.log('- dish_components indexes created.')

    // אותה מדיניות בדיוק כמו על dishes / dish_ingredients (הפונקציה יושבת בסכמת private)
    await sql`alter table public.dish_components enable row level security;`
    await sql`drop policy if exists "Allow approved access" on public.dish_components;`
    await sql`
      create policy "Allow approved access" on public.dish_components
        for all to authenticated using (private.check_is_approved());
    `
    console.log('- dish_components RLS policy applied.')

    console.log('Dish components migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
