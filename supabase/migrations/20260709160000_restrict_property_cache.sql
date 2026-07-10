-- The Python backend uses the service-role key to maintain this shared cache.
-- With RLS disabled, Supabase's data API could allow anonymous/authenticated
-- clients to read or poison cached property results directly.
alter table public.property_cache enable row level security;

-- Intentionally no client policies: service_role bypasses RLS.
