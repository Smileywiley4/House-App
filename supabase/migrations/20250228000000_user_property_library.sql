-- User property library: visit photos, scores, folders, realtor sharing (premium/realtor plans)

-- Buyer links a subscribed realtor for shared visit updates
alter table public.profiles
  add column if not exists linked_realtor_id uuid references public.profiles(id) on delete set null;

comment on column public.profiles.linked_realtor_id is 'Optional realtor profile id for sharing visit scores & photos';

-- Saved properties (per user): scores + personal visit rating + notes
create table if not exists public.user_saved_properties (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_address text not null,
  place_id text,
  scores jsonb default '[]',
  weighted_total int not null default 0,
  max_possible int not null default 0,
  percentage int not null default 0,
  personal_score int,
  visit_notes text,
  external_listing_url text,
  property_snapshot jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint user_saved_properties_personal_score_range
    check (personal_score is null or (personal_score >= 1 and personal_score <= 10)),
  constraint user_saved_properties_unique_address unique (user_id, property_address)
);

create index if not exists idx_user_saved_properties_user on public.user_saved_properties (user_id, updated_at desc);

alter table public.user_saved_properties enable row level security;

create policy "Users manage own saved properties"
  on public.user_saved_properties for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Photos (user uploads + imported listing images)
create table if not exists public.user_property_photos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_property_id uuid not null references public.user_saved_properties(id) on delete cascade,
  storage_path text not null,
  source text not null default 'user_upload'
    check (source in ('user_upload', 'listing_import')),
  caption text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_user_property_photos_saved on public.user_property_photos (saved_property_id);

alter table public.user_property_photos enable row level security;

create policy "Users manage own property photos"
  on public.user_property_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Folders
create table if not exists public.property_folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_property_folders_user on public.property_folders (user_id);

alter table public.property_folders enable row level security;

create policy "Users manage own folders"
  on public.property_folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Folder membership
create table if not exists public.property_folder_items (
  id uuid primary key default uuid_generate_v4(),
  folder_id uuid not null references public.property_folders(id) on delete cascade,
  saved_property_id uuid not null references public.user_saved_properties(id) on delete cascade,
  created_at timestamptz default now(),
  unique (folder_id, saved_property_id)
);

create index if not exists idx_property_folder_items_folder on public.property_folder_items (folder_id);

alter table public.property_folder_items enable row level security;

create policy "Users manage folder items for own folders"
  on public.property_folder_items for all
  using (
    exists (
      select 1 from public.property_folders f
      where f.id = folder_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.property_folders f
      where f.id = folder_id and f.user_id = auth.uid()
    )
    and exists (
      select 1 from public.user_saved_properties s
      where s.id = saved_property_id and s.user_id = auth.uid()
    )
  );

-- Shares with realtor (buyer → realtor)
create table if not exists public.property_realtor_shares (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  realtor_id uuid not null references auth.users(id) on delete cascade,
  saved_property_id uuid not null references public.user_saved_properties(id) on delete cascade,
  message text,
  include_photos boolean not null default true,
  shared_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_property_realtor_shares_realtor on public.property_realtor_shares (realtor_id, shared_at desc);
create index if not exists idx_property_realtor_shares_buyer on public.property_realtor_shares (buyer_id);

alter table public.property_realtor_shares enable row level security;

create policy "Buyers see own shares"
  on public.property_realtor_shares for select
  using (auth.uid() = buyer_id);

create policy "Buyers insert own shares"
  on public.property_realtor_shares for insert
  with check (auth.uid() = buyer_id);

create policy "Realtors see shares to them"
  on public.property_realtor_shares for select
  using (auth.uid() = realtor_id);

-- Storage bucket for visit / listing photos (private; backend uses service role for uploads)
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

drop policy if exists "property_photos_insert_own" on storage.objects;
drop policy if exists "property_photos_select_own" on storage.objects;
drop policy if exists "property_photos_delete_own" on storage.objects;

-- Authenticated users can read/write only objects under their user id prefix
create policy "property_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and name like auth.uid()::text || '/%'
  );

create policy "property_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-photos'
    and name like auth.uid()::text || '/%'
  );

create policy "property_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and name like auth.uid()::text || '/%'
  );
