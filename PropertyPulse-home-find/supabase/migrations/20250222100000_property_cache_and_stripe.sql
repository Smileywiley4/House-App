-- Property cache for consistent search results (Python backend)
create table if not exists public.property_cache (
  address_hash text primary key,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Stripe customer id on profiles (for portal)
alter table public.profiles
  add column if not exists stripe_customer_id text;

comment on column public.profiles.stripe_customer_id is 'Stripe customer id for billing portal';
