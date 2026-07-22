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
    console.log('Running RBAC and User Approval migrations on Supabase...')

    // 1. Create profiles table
    await sql`
      create table if not exists public.profiles (
        id uuid references auth.users on delete cascade primary key,
        email text not null,
        is_approved boolean not null default false,
        is_admin boolean not null default false,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `
    console.log('- profiles table created or verified.')

    // Enable RLS on profiles and business tables
    await sql`alter table public.profiles enable row level security;`
    await sql`alter table public.ingredients enable row level security;`
    await sql`alter table public.dishes enable row level security;`
    await sql`alter table public.dish_ingredients enable row level security;`
    await sql`alter table public.orders enable row level security;`
    await sql`alter table public.order_dishes enable row level security;`

    // 2. Helper functions to check is_admin and is_approved securely
    await sql`
      create or replace function public.check_is_admin()
      returns boolean 
      language plpgsql 
      security definer 
      set search_path = ''
      as $$
      begin
        return exists (
          select 1 from public.profiles
          where id = auth.uid() and is_admin = true
        );
      end;
      $$;
    `
    await sql`
      create or replace function public.check_is_approved()
      returns boolean 
      language plpgsql 
      security definer 
      set search_path = ''
      as $$
      begin
        return exists (
          select 1 from public.profiles
          where id = auth.uid() and is_approved = true
        );
      end;
      $$;
    `
    console.log('- check functions defined with search_path.')

    // Revoke public execute on SECURITY DEFINER RPC functions
    await sql`revoke execute on function public.check_is_admin() from public, anon, authenticated;`
    await sql`revoke execute on function public.check_is_approved() from public, anon, authenticated;`

    // 3. Set policies on profiles table
    await sql`drop policy if exists "Admins can view and edit all profiles" on public.profiles;`
    await sql`
      create policy "Admins can view and edit all profiles"
        on public.profiles
        for all
        to authenticated
        using (public.check_is_admin());
    `

    await sql`drop policy if exists "Users can view own profile" on public.profiles;`
    await sql`
      create policy "Users can view own profile"
        on public.profiles
        for select
        to authenticated
        using (auth.uid() = id);
    `
    console.log('- policies for profiles defined.')

    // 4. Update policies for business tables
    // public.ingredients
    await sql`drop policy if exists "Allow all actions for authenticated users on ingredients" on public.ingredients;`
    await sql`drop policy if exists "Allow approved access" on public.ingredients;`
    await sql`
      create policy "Allow approved access" on public.ingredients
        for all to authenticated using (public.check_is_approved());
    `

    // public.dishes
    await sql`drop policy if exists "Allow all actions for authenticated users on dishes" on public.dishes;`
    await sql`drop policy if exists "Allow approved access" on public.dishes;`
    await sql`
      create policy "Allow approved access" on public.dishes
        for all to authenticated using (public.check_is_approved());
    `

    // public.dish_ingredients
    await sql`drop policy if exists "Allow all actions for authenticated users on dish_ingredients" on public.dish_ingredients;`
    await sql`drop policy if exists "Allow approved access" on public.dish_ingredients;`
    await sql`
      create policy "Allow approved access" on public.dish_ingredients
        for all to authenticated using (public.check_is_approved());
    `

    // public.orders
    await sql`drop policy if exists "Allow all actions for authenticated users on orders" on public.orders;`
    await sql`drop policy if exists "Allow approved access" on public.orders;`
    await sql`
      create policy "Allow approved access" on public.orders
        for all to authenticated using (public.check_is_approved());
    `

    // public.order_dishes
    await sql`drop policy if exists "Allow all actions for authenticated users on order_dishes" on public.order_dishes;`
    await sql`drop policy if exists "Allow approved access" on public.order_dishes;`
    await sql`
      create policy "Allow approved access" on public.order_dishes
        for all to authenticated using (public.check_is_approved());
    `
    console.log('- business tables RLS policies updated.')

    // 5. Trigger for new signups
    await sql`
      create or replace function public.handle_new_user()
      returns trigger 
      language plpgsql 
      security definer 
      set search_path = ''
      as $$
      begin
        insert into public.profiles (id, email, is_approved, is_admin)
        values (
          new.id,
          new.email,
          case when new.email = 'davidhakak19@gmail.com' then true else false end,
          case when new.email = 'davidhakak19@gmail.com' then true else false end
        )
        on conflict (id) do nothing;
        return new;
      end;
      $$;
    `
    await sql`revoke execute on function public.handle_new_user() from public, anon, authenticated;`

    await sql`drop trigger if exists on_auth_user_created on auth.users;`
    await sql`
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute procedure public.handle_new_user();
    `
    console.log('- auth trigger established.')

    // 6. Insert profiles for existing auth users immediately
    await sql`
      insert into public.profiles (id, email, is_approved, is_admin)
      select id, email, 
             (email = 'davidhakak19@gmail.com') as is_approved,
             (email = 'davidhakak19@gmail.com') as is_admin
      from auth.users
      on conflict (id) do nothing;
    `
    console.log('- synchronized existing auth users to profiles.')

    console.log('RBAC Migration completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await sql.end()
  }
}

run()
