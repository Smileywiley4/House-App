-- Contacts / property shares for scoring / project collaboration.
-- future: gamify mobile share/score loop (XP, streaks, badges) — deferred from MVP.

-- Optional public handle for contact search (email still primary).
alter table public.profiles
  add column if not exists username text;

create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

comment on column public.profiles.username is
  'Optional unique handle for contact search; not required for auth';

-- ---------------------------------------------------------------------------
-- Contact book (friend / contact request style)
-- ---------------------------------------------------------------------------
create table if not exists public.user_contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  contact_role text
    check (contact_role is null or contact_role in ('client', 'realtor', 'other')),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_contacts_not_self check (user_id <> contact_user_id),
  constraint user_contacts_unique_pair unique (user_id, contact_user_id)
);

create index if not exists idx_user_contacts_owner
  on public.user_contacts (user_id, status, updated_at desc);

create index if not exists idx_user_contacts_incoming
  on public.user_contacts (contact_user_id, status, created_at desc);

alter table public.user_contacts enable row level security;

drop policy if exists "Participants read contacts" on public.user_contacts;
create policy "Participants read contacts"
  on public.user_contacts for select
  using (auth.uid() = user_id or auth.uid() = contact_user_id);

drop policy if exists "Owners insert contacts" on public.user_contacts;
create policy "Owners insert contacts"
  on public.user_contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Participants update contacts" on public.user_contacts;
create policy "Participants update contacts"
  on public.user_contacts for update
  using (auth.uid() = user_id or auth.uid() = contact_user_id);

drop policy if exists "Owners delete contacts" on public.user_contacts;
create policy "Owners delete contacts"
  on public.user_contacts for delete
  using (auth.uid() = user_id);

comment on table public.user_contacts is
  'In-app contact book / friend requests between logged-in users';

-- ---------------------------------------------------------------------------
-- Property shares for client scoring (+ optional private listing URL)
-- ---------------------------------------------------------------------------
create table if not exists public.property_shares (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  property_payload jsonb not null default '{}'::jsonb,
  media_urls jsonb not null default '[]'::jsonb,
  -- Off-market / private listing channel URL — participants only; never public browse/SEO.
  private_listing_url text,
  message text,
  status text not null default 'pending_score'
    check (status in ('pending_score', 'scored', 'returned', 'cancelled')),
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_shares_not_self check (from_user_id <> to_user_id)
);

create index if not exists idx_property_shares_to
  on public.property_shares (to_user_id, status, created_at desc);

create index if not exists idx_property_shares_from
  on public.property_shares (from_user_id, status, created_at desc);

alter table public.property_shares enable row level security;

drop policy if exists "Participants read property shares" on public.property_shares;
create policy "Participants read property shares"
  on public.property_shares for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Sender inserts property shares" on public.property_shares;
create policy "Sender inserts property shares"
  on public.property_shares for insert
  with check (auth.uid() = from_user_id);

drop policy if exists "Participants update property shares" on public.property_shares;
create policy "Participants update property shares"
  on public.property_shares for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Sender deletes property shares" on public.property_shares;
create policy "Sender deletes property shares"
  on public.property_shares for delete
  using (auth.uid() = from_user_id);

comment on table public.property_shares is
  'Realtor→client (or peer) property share for scoring; private_listing_url is participant-only';
comment on column public.property_shares.private_listing_url is
  'Optional off-market listing/channel URL; store+display only, never scrape; RLS participant-only';

-- ---------------------------------------------------------------------------
-- Project collaboration
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.user_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null default 'collaborator'
    check (role in ('collaborator')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_members_unique unique (project_id, user_id)
);

create index if not exists idx_project_members_user
  on public.project_members (user_id, status, updated_at desc);

create index if not exists idx_project_members_project
  on public.project_members (project_id, status);

alter table public.project_members enable row level security;

drop policy if exists "Project members select" on public.project_members;
create policy "Project members select"
  on public.project_members for select
  using (
    auth.uid() = user_id
    or auth.uid() = invited_by
    or exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Owners invite project members" on public.project_members;
create policy "Owners invite project members"
  on public.project_members for insert
  with check (
    exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    and auth.uid() = invited_by
  );

drop policy if exists "Participants update project members" on public.project_members;
create policy "Participants update project members"
  on public.project_members for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Owners remove project members" on public.project_members;
create policy "Owners remove project members"
  on public.project_members for delete
  using (
    exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

comment on table public.project_members is
  'Invites to scoring projects; accepted collaborators can add/edit properties; owner manages presets/delete';

-- Expand project RLS so accepted members can read projects + manage properties.
drop policy if exists "Users manage own projects" on public.user_projects;
create policy "Users manage own projects"
  on public.user_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members read shared projects" on public.user_projects;
create policy "Members read shared projects"
  on public.user_projects for select
  using (
    exists (
      select 1 from public.project_members m
      where m.project_id = id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  );

drop policy if exists "Users manage own project properties" on public.user_project_properties;
create policy "Users manage own project properties"
  on public.user_project_properties for all
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.project_members m
      where m.project_id = project_id
        and m.user_id = auth.uid()
        and m.status = 'accepted'
    )
  )
  with check (
    (
      exists (
        select 1 from public.user_projects p
        where p.id = project_id and p.user_id = auth.uid()
      )
      or exists (
        select 1 from public.project_members m
        where m.project_id = project_id
          and m.user_id = auth.uid()
          and m.status = 'accepted'
      )
    )
  );
