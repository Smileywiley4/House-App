-- Promo redemption + perpetual admin/testing comps.
-- promo_code columns may already exist in some environments; IF NOT EXISTS is safe.

alter table public.profiles
  add column if not exists promo_code text,
  add column if not exists promo_code_redeemed_at timestamptz,
  add column if not exists admin_comp boolean not null default false;

comment on column public.profiles.promo_code is
  'Last access/promo code redeemed in-app (e.g. ADMIN).';

comment on column public.profiles.promo_code_redeemed_at is
  'When promo_code was last successfully redeemed.';

comment on column public.profiles.admin_comp is
  'Perpetual testing/comp grant (e.g. ADMIN code). Stripe/RevenueCat cancel must not revoke plan.';
