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
    console.log('--- Starting Order Purchases Migration ---')

    // מעקב רכש: שורה לכל חומר גלם בתוך הזמנה, מסמנת אם כבר נרכש.
    // המפתח המשולב מאפשר upsert פשוט מהלקוח בכל לחיצה על צ׳קבוקס.
    await sql`
      create table if not exists public.order_purchases (
        order_id uuid references public.orders(id) on delete cascade not null,
        ingredient_id uuid references public.ingredients(id) on delete cascade not null,
        is_purchased boolean not null default false,
        updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
        primary key (order_id, ingredient_id)
      );
    `
    console.log('- order_purchases table created or verified.')

    await sql`create index if not exists order_purchases_order_id_idx on public.order_purchases (order_id);`
    console.log('- order_purchases index created.')

    // אותה מדיניות בדיוק כמו על orders / order_dishes (הפונקציה יושבת בסכמת private)
    await sql`alter table public.order_purchases enable row level security;`
    await sql`drop policy if exists "Allow approved access" on public.order_purchases;`
    await sql`
      create policy "Allow approved access" on public.order_purchases
        for all to authenticated using (private.check_is_approved());
    `
    console.log('- order_purchases RLS policy applied.')

    console.log('Order purchases migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
