-- Track custom categories created by users for product analytics
create table if not exists public.custom_categories (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  normalized_label text not null unique,
  use_count int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_custom_categories_count on public.custom_categories (use_count desc);

comment on table public.custom_categories is 'Tracks every unique custom scoring category users create, with usage count';
