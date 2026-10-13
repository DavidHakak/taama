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
    console.log('--- Starting Customers Migration ---')

    // 0. The table started out as catering-only; it now holds the Shabbat shop's
    //    customers too. Rename it in place on databases that already have it.
    const [{ needsRename }] = await sql`
      select to_regclass('public.catering_customers') is not null
         and to_regclass('public.customers') is null as "needsRename"
    `
    if (needsRename) {
      await sql`alter table public.catering_customers rename to customers;`
      await sql`alter index if exists public.catering_customers_pkey rename to customers_pkey;`
      await sql`alter table public.customers drop constraint if exists catering_customers_type_check;`
      await sql`alter table public.customers drop constraint if exists catering_customers_company_number_check;`
      console.log('- catering_customers renamed to customers.')
    }

    // 1. The customer book, shared by catering and the Shabbat shop. Separate
    //    from `profiles`, which holds the registered users of the website.
    await sql`
      create table if not exists public.customers (
        id uuid primary key default gen_random_uuid(),
        customer_type text not null,
        name text not null,
        phone text not null,
        email text,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- customers table created or verified.')

    await sql`alter table public.customers drop constraint if exists customers_type_check;`
    await sql`
      alter table public.customers
        add constraint customers_type_check
        check (customer_type in ('private', 'company'));
    `
    console.log('- customers type check constraint applied.')

    // 2. Company registration number (ח.פ): required (9 digits) for a company,
    //    and empty for a private customer, who has none.
    await sql`alter table public.customers add column if not exists company_number text;`
    await sql`alter table public.customers drop constraint if exists customers_company_number_check;`
    await sql`
      alter table public.customers
        add constraint customers_company_number_check
        check (
          -- 'is not null' is explicit: a null regex match is unknown, which a check lets through
          (customer_type = 'company' and company_number is not null and company_number ~ '^[0-9]{9}$')
          or (customer_type <> 'company' and company_number is null)
        );
    `
    console.log('- customers.company_number column and check constraint applied.')

    // 3. Which business the customer belongs to. Both may be true; at least one must be.
    await sql`alter table public.customers add column if not exists is_catering boolean not null default false;`
    await sql`alter table public.customers add column if not exists is_shabbat boolean not null default false;`
    await sql`alter table public.customers drop constraint if exists customers_segment_check;`
    await sql`
      alter table public.customers
        add constraint customers_segment_check
        check (is_catering or is_shabbat);
    `
    console.log('- customers segment columns and check constraint applied.')

    await sql`alter table public.customers enable row level security;`
    await sql`drop policy if exists "Allow approved access" on public.customers;`
    await sql`
      create policy "Allow approved access" on public.customers
        for all to authenticated using (private.check_is_approved());
    `
    console.log('- customers RLS policy applied.')

    // 4. Link a catering order to its customer. 'restrict' (and not set null) so
    //    a customer who has orders cannot be deleted and their history stays whole.
    await sql`
      alter table public.orders
        add column if not exists customer_id uuid
        references public.customers(id) on delete restrict;
    `
    await sql`create index if not exists orders_customer_id_idx on public.orders (customer_id);`
    console.log('- orders.customer_id column and index created or verified.')

    // 5. Whether a receipt is issued for the order. Nullable: orders created
    //    before this column existed have simply not been marked yet.
    await sql`alter table public.orders add column if not exists issues_receipt boolean;`
    console.log('- orders.issues_receipt column created or verified.')

    await sql`notify pgrst, 'reload schema';`
    console.log('Customers migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

run()
