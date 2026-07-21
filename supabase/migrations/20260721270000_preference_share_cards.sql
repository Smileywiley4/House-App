-- Opt-in shareable preference pattern cards (importance priorities only — no addresses/prices/photos).
-- Public access is token-gated; rows are created only when the user explicitly enables sharing.

create table if not exists public.preference_share_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  token text not null unique,
  -- Optional display of first name only (off by default; never email/address).
  include_first_name boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  regenerated_at timestamptz not null default now()
);

create index if not exists idx_preference_share_cards_token
  on public.preference_share_cards (token);

alter table public.preference_share_cards enable row level security;

-- Owners can read their own share row; public reads go through the service-role API only.
drop policy if exists "Users read own preference share card" on public.preference_share_cards;
create policy "Users read own preference share card"
  on public.preference_share_cards for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own preference share card" on public.preference_share_cards;
create policy "Users insert own preference share card"
  on public.preference_share_cards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own preference share card" on public.preference_share_cards;
create policy "Users update own preference share card"
  on public.preference_share_cards for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own preference share card" on public.preference_share_cards;
create policy "Users delete own preference share card"
  on public.preference_share_cards for delete
  using (auth.uid() = user_id);

comment on table public.preference_share_cards is
  'Opt-in share tokens for preference pattern cards. Public payload is preferences-only (no address/price/photo). Summary is regenerated live from property_scores.';
