-- PropertyPulse schema for Supabase
-- Run in Supabase SQL Editor or via `supabase db push` if using Supabase CLI.

-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  default_weights jsonb default '{}',
  role text default 'user',
  plan text default 'free',
  realtor_license text,
  brokerage text,
  state text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Property scores (user-scoped)
create table if not exists public.property_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_address text not null,
  scores jsonb not null default '[]',
  weighted_total int not null default 0,
  max_possible int not null default 0,
  percentage int not null default 0,
  created_at timestamptz default now()
);

alter table public.property_scores enable row level security;

create policy "Users can manage own property_scores"
  on public.property_scores for all using (auth.uid() = user_id);

-- Clients (realtor-scoped)
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  budget_min numeric,
  budget_max numeric,
  notes text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.clients enable row level security;

create policy "Users can manage own clients"
  on public.clients for all using (auth.uid() = user_id);

-- Private listings (realtor-scoped)
create table if not exists public.private_listings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  city text,
  state text,
  zip text,
  price numeric,
  bedrooms int,
  bathrooms int,
  sqft int,
  year_built int,
  status text default 'off_market',
  client_id uuid references public.clients(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

alter table public.private_listings enable row level security;

create policy "Users can manage own private_listings"
  on public.private_listings for all using (auth.uid() = user_id);

-- Optional: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
