-- Browse preference memory, listing alert subscriptions, and in-app notifications.

-- Soft learning: track which browse filter combinations a user uses often.
create table if not exists public.user_browse_preference_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filters_hash text not null,
  filters jsonb not null default '{}',
  use_count int not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, filters_hash)
);

alter table public.user_browse_preference_memory enable row level security;

create policy "Users manage own browse preference memory"
  on public.user_browse_preference_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_browse_pref_memory_user_freq
  on public.user_browse_preference_memory (user_id, use_count desc, last_used_at desc);

comment on table public.user_browse_preference_memory is
  'Learned browse filter combinations (including auto-score mins) for suggested presets';

-- Saved search / match alert subscriptions (logged-in users).
create table if not exists public.listing_alert_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Match alert',
  criteria jsonb not null default '{}',
  enabled boolean not null default true,
  email_enabled boolean not null default false,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_alert_subscriptions enable row level security;

create policy "Users manage own listing alerts"
  on public.listing_alert_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_listing_alerts_user
  on public.listing_alert_subscriptions (user_id, enabled);

create index if not exists idx_listing_alerts_enabled
  on public.listing_alert_subscriptions (enabled)
  where enabled = true;

comment on table public.listing_alert_subscriptions is
  'Alert when new/updated RentCast listings match saved browse criteria (filters + score mins)';
comment on column public.listing_alert_subscriptions.criteria is
  'JSON: mode, city, state, zip, latitude, longitude, radius, filters (incl. score_mins)';

-- In-app notifications inbox.
create table if not exists public.user_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'listing_match',
  title text not null,
  body text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_notifications enable row level security;

create policy "Users manage own notifications"
  on public.user_notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_user_notifications_inbox
  on public.user_notifications (user_id, created_at desc);

create index if not exists idx_user_notifications_unread
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

comment on table public.user_notifications is
  'In-app notifications (listing matches, etc.). Email delivery is optional via Resend.';
