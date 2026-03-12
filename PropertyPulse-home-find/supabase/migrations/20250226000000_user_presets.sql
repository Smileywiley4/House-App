-- User presets: save scoring weights + search filters for consistent multi-property search.
-- client_id: when set, preset belongs to a realtor's client (realtor manages it).
create table if not exists public.user_presets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  weights jsonb not null default '{}',
  filters jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.user_presets enable row level security;

create policy "Users can manage own presets"
  on public.user_presets for all using (auth.uid() = user_id);

create index if not exists idx_user_presets_user on public.user_presets(user_id);
create index if not exists idx_user_presets_client on public.user_presets(client_id);

comment on table public.user_presets is 'Saved preference presets: weights (category importance) and filters (budget, beds, etc)';
comment on column public.user_presets.weights is 'category_id -> importance 0-10';
comment on column public.user_presets.filters is 'budget_min, budget_max, beds_min, baths_min, sqft_min, sqft_max, city, state, zip';
