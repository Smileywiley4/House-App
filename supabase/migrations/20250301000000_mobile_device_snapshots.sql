-- Anonymous mobile / Expo device-class snapshots for product statistics (opt-in from app).
-- Written only via FastAPI service role (bypasses RLS). No PII; coarse device + app metadata.

create table if not exists public.mobile_device_snapshots (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  platform text,
  os_name text,
  os_version text,
  manufacturer text,
  brand text,
  model_name text,
  model_id text,
  device_type integer,
  is_physical_device boolean,
  design_name text,
  product_name text,
  total_memory_bytes bigint,
  device_year_class integer,
  app_version text,
  app_build text,
  expo_runtime text,
  client_timestamp timestamptz,
  source text not null default 'expo_mobile'
);

create index if not exists idx_mobile_device_snapshots_created_at
  on public.mobile_device_snapshots (created_at desc);

create index if not exists idx_mobile_device_snapshots_platform_model
  on public.mobile_device_snapshots (platform, coalesce(model_name, ''), coalesce(os_name, ''));

comment on table public.mobile_device_snapshots is 'Opt-in anonymous device/app metadata from Expo app for aggregate analytics';

alter table public.mobile_device_snapshots enable row level security;
