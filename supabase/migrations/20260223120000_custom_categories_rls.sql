-- Lock down custom_categories: only service_role (FastAPI) should read/write via PostgREST.
-- Previously the table had no RLS while anon/authenticated may have had table-level grants.

alter table public.custom_categories enable row level security;

comment on table public.custom_categories is
  'Product analytics: unique custom scoring labels. RLS on with no policies — backend uses service role only.';
