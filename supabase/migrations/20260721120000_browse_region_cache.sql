-- Daily RentCast browse cache for map/list Search Properties.
create table if not exists public.browse_region_cache (
  region_key text primary key,
  mode text not null default 'for_sale',
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  radius_miles double precision default 8,
  properties jsonb not null default '[]'::jsonb,
  total integer not null default 0,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists browse_region_cache_geo_idx
  on public.browse_region_cache (latitude, longitude);

create index if not exists browse_region_cache_refreshed_idx
  on public.browse_region_cache (refreshed_at desc);

alter table public.browse_region_cache enable row level security;

-- Backend uses service role only; no anon policies (same pattern as property_cache).

comment on table public.browse_region_cache is
  'Morning RentCast refresh snapshots for Search Properties map browse (all 50 states metros).';
