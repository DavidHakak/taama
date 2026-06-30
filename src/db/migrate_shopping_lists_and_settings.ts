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
    console.log('Running Shopping Lists and Store Settings migrations on Supabase...')

    // 1. Create store_settings table
    await sql`
      create table if not exists public.store_settings (
        key text primary key,
        value text not null,
        updated_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- store_settings table created or verified.')

    // Enable RLS on store_settings
    await sql`alter table public.store_settings enable row level security;`

    // Set policies on store_settings: public read, admin write
    await sql`drop policy if exists "Allow public read access on store_settings" on public.store_settings;`
    await sql`
      create policy "Allow public read access on store_settings"
        on public.store_settings
        for select
        using (true);
    `
    await sql`drop policy if exists "Allow admin write access on store_settings" on public.store_settings;`
    await sql`
      create policy "Allow admin write access on store_settings"
        on public.store_settings
        for all
        to authenticated
        using (public.check_is_admin());
    `
    
    // Seed default settings if they don't exist
    await sql`
      insert into public.store_settings (key, value)
      values 
        ('pickup_address', 'רחוב האורגים 12, אשדוד'),
        ('pickup_hours', 'ימי שישי 10:00 - 14:00'),
        ('cutoff_hours', '24'),
        ('pickup_phone', '050-1234567'),
        ('pickup_email', 'support@taama-catering.co.il')
      on conflict (key) do nothing;
    `
    console.log('- store_settings seeded with phone and email.')

    // 2. Create saved_shopping_lists table
    await sql`
      create table if not exists public.saved_shopping_lists (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        notes text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- saved_shopping_lists table created.')

    // Enable RLS on saved_shopping_lists
    await sql`alter table public.saved_shopping_lists enable row level security;`

    // Set policies: approved users can do anything
    await sql`drop policy if exists "Allow approved access on saved_shopping_lists" on public.saved_shopping_lists;`
    await sql`
      create policy "Allow approved access on saved_shopping_lists"
        on public.saved_shopping_lists
        for all
        to authenticated
        using (public.check_is_approved());
    `

    // 3. Create saved_shopping_list_items table
    await sql`
      create table if not exists public.saved_shopping_list_items (
        id uuid primary key default gen_random_uuid(),
        list_id uuid references public.saved_shopping_lists(id) on delete cascade not null,
        ingredient_id uuid references public.ingredients(id) on delete cascade,
        name text not null,
        unit text not null,
        category text not null,
        catering_qty numeric(10,3) not null default 0.000,
        shop_qty numeric(10,3) not null default 0.000,
        total_qty numeric(10,3) not null default 0.000,
        is_purchased boolean not null default false,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- saved_shopping_list_items table created.')

    // Enable RLS on saved_shopping_list_items
    await sql`alter table public.saved_shopping_list_items enable row level security;`

    // Set policies: approved users can do anything
    await sql`drop policy if exists "Allow approved access on saved_shopping_list_items" on public.saved_shopping_list_items;`
    await sql`
      create policy "Allow approved access on saved_shopping_list_items"
        on public.saved_shopping_list_items
        for all
        to authenticated
        using (public.check_is_approved());
    `

    console.log('Shopping lists and Store settings migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
