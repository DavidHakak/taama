import { loadEnvConfig } from '@next/env'
import postgres from 'postgres'

loadEnvConfig(process.cwd())

// הטבלאות שנוצרו במהלך האיחוד עם "שמנת" (01_brands.sql, 08_option_tables.sql)
// עלו ל-DB בלי RLS, ו-Supabase Security Advisor התריע עליהן (rls_disabled_in_public).
// המדיניות כאן משקפת בדיוק את מה שיש על shop_products / shop_order_items.

// קטלוג: קריאה פתוחה לחזית, כתיבה רק למשתמשים מאושרים.
const CATALOG_TABLES = [
  'brands',
  'shop_product_option_groups',
  'shop_product_options',
  'shop_option_ingredients',
] as const

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set in env')
    process.exit(1)
  }

  const sql = postgres(url)
  try {
    console.log('--- Starting Option Tables RLS Migration ---')

    for (const table of CATALOG_TABLES) {
      await sql`alter table public.${sql(table)} enable row level security;`
      await sql`drop policy if exists "Allow public read access" on public.${sql(table)};`
      await sql`
        create policy "Allow public read access" on public.${sql(table)}
          for select to public using (true);
      `
      await sql`drop policy if exists "Allow approved write access" on public.${sql(table)};`
      await sql`
        create policy "Allow approved write access" on public.${sql(table)}
          for all to authenticated using (private.check_is_approved());
      `
      console.log(`- ${table}: RLS enabled, public read + approved write.`)
    }

    // שורות הזמנה: כמו shop_order_items — הצוות המאושר רואה הכל,
    // הלקוח רואה ומכניס רק אופציות של פריטים בהזמנות שלו.
    await sql`alter table public.shop_order_item_options enable row level security;`
    await sql`drop policy if exists "Allow approved access" on public.shop_order_item_options;`
    await sql`
      create policy "Allow approved access" on public.shop_order_item_options
        for all to authenticated using (private.check_is_approved());
    `
    await sql`drop policy if exists "Allow select for order owners" on public.shop_order_item_options;`
    await sql`
      create policy "Allow select for order owners" on public.shop_order_item_options
        for select to authenticated using (
          exists (
            select 1 from public.shop_order_items soi
            join public.shop_orders so on so.id = soi.shop_order_id
            where soi.id = shop_order_item_options.shop_order_item_id
              and so.user_id = auth.uid()
          )
        );
    `
    await sql`drop policy if exists "Allow insert for order owners" on public.shop_order_item_options;`
    await sql`
      create policy "Allow insert for order owners" on public.shop_order_item_options
        for insert to authenticated with check (
          exists (
            select 1 from public.shop_order_items soi
            join public.shop_orders so on so.id = soi.shop_order_id
            where soi.id = shop_order_item_options.shop_order_item_id
              and so.user_id = auth.uid()
          )
        );
    `
    console.log('- shop_order_item_options: RLS enabled, approved access + order-owner select/insert.')

    console.log('Option tables RLS migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
