-- `profiles` is exposed to authenticated Supabase clients. Keep billing and
-- authorization fields service-role-only so a user cannot self-upgrade to admin.
revoke update on table public.profiles from authenticated;

grant update (
  full_name,
  default_weights,
  realtor_license,
  brokerage,
  state,
  linked_realtor_id,
  phone,
  marketing_opt_in
) on table public.profiles to authenticated;
