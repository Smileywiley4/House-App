-- One-time, dismissible onboarding / client priority quiz flags on profiles.
-- Skip and complete both set the flag so we never nag again for that trigger.

alter table public.profiles
  add column if not exists has_seen_onboarding_quiz boolean not null default false;

alter table public.profiles
  add column if not exists has_seen_client_priority_quiz boolean not null default false;

comment on column public.profiles.has_seen_onboarding_quiz is
  'True after user completes or dismisses the post-signup Importance priority quiz';

comment on column public.profiles.has_seen_client_priority_quiz is
  'True after user completes or dismisses the client↔realtor priority quiz';

-- Re-grant column-level UPDATE so authenticated clients can clear their own flags
-- (billing/role columns remain service-role only).
grant update (
  full_name,
  default_weights,
  realtor_license,
  brokerage,
  state,
  linked_realtor_id,
  phone,
  marketing_opt_in,
  avatar_url,
  has_seen_onboarding_quiz,
  has_seen_client_priority_quiz
) on table public.profiles to authenticated;
