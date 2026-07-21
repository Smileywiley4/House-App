-- Weekly preset digest: opt-in (default OFF) for email + in-app summaries
-- when listings match saved alerts / browse presets.

alter table public.profiles
  add column if not exists preset_digest_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists preset_digest_last_sent_at timestamptz;

comment on column public.profiles.preset_digest_opt_in is
  'Opt-in weekly digest when new listings match saved presets/alerts. Default false.';
comment on column public.profiles.preset_digest_last_sent_at is
  'Last successful weekly preset digest send (in-app and/or email).';

create index if not exists idx_profiles_preset_digest_opt_in
  on public.profiles (id)
  where preset_digest_opt_in = true;
