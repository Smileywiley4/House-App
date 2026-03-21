-- Peer sharing (folders & saved properties between accounts) + email invitations

-- Share a folder OR a single saved property with another user (read-only view via API)
create table if not exists public.library_peer_shares (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.property_folders(id) on delete cascade,
  saved_property_id uuid references public.user_saved_properties(id) on delete cascade,
  message text,
  created_at timestamptz default now(),
  constraint library_peer_shares_not_self check (owner_user_id <> recipient_user_id),
  constraint library_peer_shares_one_resource check (
    (folder_id is not null and saved_property_id is null)
    or (folder_id is null and saved_property_id is not null)
  )
);

create unique index if not exists idx_library_peer_shares_unique_folder
  on public.library_peer_shares (owner_user_id, recipient_user_id, folder_id)
  where folder_id is not null;

create unique index if not exists idx_library_peer_shares_unique_saved
  on public.library_peer_shares (owner_user_id, recipient_user_id, saved_property_id)
  where saved_property_id is not null;

create index if not exists idx_library_peer_shares_recipient on public.library_peer_shares (recipient_user_id, created_at desc);
create index if not exists idx_library_peer_shares_owner on public.library_peer_shares (owner_user_id);

alter table public.library_peer_shares enable row level security;

create policy "Owners see peer shares they created"
  on public.library_peer_shares for select
  using (auth.uid() = owner_user_id);

create policy "Recipients see peer shares to them"
  on public.library_peer_shares for select
  using (auth.uid() = recipient_user_id);

create policy "Owners insert peer shares"
  on public.library_peer_shares for insert
  with check (auth.uid() = owner_user_id);

create policy "Owners or recipients delete peer shares"
  on public.library_peer_shares for delete
  using (auth.uid() = owner_user_id or auth.uid() = recipient_user_id);

-- Email invitations (join app after invite token)
create table if not exists public.app_invitations (
  id uuid primary key default uuid_generate_v4(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  token uuid not null unique default uuid_generate_v4(),
  personal_message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_app_invitations_email on public.app_invitations (lower(invitee_email));
create index if not exists idx_app_invitations_inviter on public.app_invitations (inviter_id);

alter table public.app_invitations enable row level security;

create policy "Inviters read own invitations"
  on public.app_invitations for select
  using (auth.uid() = inviter_id);

create policy "Inviters insert invitations"
  on public.app_invitations for insert
  with check (auth.uid() = inviter_id);

-- Updates (accept) are performed by the FastAPI backend with the service role only.

comment on table public.library_peer_shares is 'Share a visit folder or saved property with another account (viewer)';
comment on table public.app_invitations is 'Email invite tokens for new users to join Property Pulse';
