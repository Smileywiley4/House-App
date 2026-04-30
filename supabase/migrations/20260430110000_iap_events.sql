-- Audit log for iOS IAP webhook events (RevenueCat).
-- Backend service role writes to this table for traceability.

create table if not exists public.iap_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null default 'revenuecat',
  app_user_id text not null,
  event_type text,
  entitlement_ids text[] not null default '{}',
  raw_event jsonb
);

create index if not exists iap_events_created_idx
  on public.iap_events (created_at desc);

create index if not exists iap_events_app_user_idx
  on public.iap_events (app_user_id, created_at desc);

alter table public.iap_events enable row level security;
-- No policies: service_role only.
