-- Scoring projects (folder-like) with per-project preference weights.
-- Free: max 2 projects; Premium/Realtor/Admin: max 20 (enforced in API).

create table if not exists public.user_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scoring_presets jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_projects_user
  on public.user_projects (user_id, updated_at desc);

alter table public.user_projects enable row level security;

drop policy if exists "Users manage own projects" on public.user_projects;
create policy "Users manage own projects"
  on public.user_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_projects is
  'Named project folders with scoring_presets (category importance weights) used to score saved listings';

create table if not exists public.user_project_properties (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.user_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  property_key text not null,
  property_address text not null,
  lat double precision,
  lng double precision,
  property_snapshot jsonb not null default '{}'::jsonb,
  auto_scores jsonb not null default '{}'::jsonb,
  overall_percentage int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, property_key)
);

create index if not exists idx_user_project_properties_project
  on public.user_project_properties (project_id, overall_percentage desc);

create index if not exists idx_user_project_properties_user
  on public.user_project_properties (user_id);

alter table public.user_project_properties enable row level security;

drop policy if exists "Users manage own project properties" on public.user_project_properties;
create policy "Users manage own project properties"
  on public.user_project_properties for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

comment on table public.user_project_properties is
  'Listings saved into a project with cached auto_scores and overall_percentage for the project presets';
