-- Daily publisher revenue snapshots (AdSense estimates via Management API).
-- Written only by the FastAPI backend (service role). Not exposed to anon/authenticated clients by default.

create table if not exists public.publisher_revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'adsense_estimate',
  report_date date not null,
  estimated_earnings numeric(18, 6),
  currency_code text not null default 'USD',
  adsense_account text,
  raw_report jsonb,
  created_at timestamptz not null default now(),
  unique (source, report_date)
);

comment on table public.publisher_revenue_snapshots is 'AdSense estimated earnings per day (sync from backend). Stripe subscription revenue stays in Stripe; see docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md';

create index if not exists publisher_revenue_snapshots_report_date_idx
  on public.publisher_revenue_snapshots (report_date desc);

alter table public.publisher_revenue_snapshots enable row level security;

-- No policies: only service_role bypasses RLS for backend writes.
-- Optional: grant select to admin role via a view if needed later.
