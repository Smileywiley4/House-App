-- Referral / invite-contacts program (Pro+ reward credit via Stripe)

create table if not exists public.referral_invites (
  id uuid primary key default uuid_generate_v4(),
  inviter_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_invites_code_lower on public.referral_invites (lower(code));

create table if not exists public.referral_redemptions (
  id uuid primary key default uuid_generate_v4(),
  invite_id uuid not null references public.referral_invites(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  status text not null default 'signed_up'
    check (status in ('signed_up', 'credited', 'forfeited', 'ineligible')),
  invitee_plan_at_credit text,
  inviter_credit_cents int,
  invitee_credit_cents int,
  inviter_stripe_balance_txn_id text,
  invitee_stripe_balance_txn_id text,
  credit_applied_at timestamptz,
  forfeited_at timestamptz,
  forfeit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_redemptions_not_self check (inviter_id <> invitee_id)
);

create index if not exists idx_referral_redemptions_inviter
  on public.referral_redemptions (inviter_id, created_at desc);

create index if not exists idx_referral_redemptions_status
  on public.referral_redemptions (status)
  where status = 'signed_up';

alter table public.referral_invites enable row level security;
alter table public.referral_redemptions enable row level security;

-- Users can read their own invite code row
drop policy if exists "Users read own referral invite" on public.referral_invites;
create policy "Users read own referral invite"
  on public.referral_invites for select
  using (auth.uid() = inviter_id);

-- Users can read redemptions they sent or received
drop policy if exists "Users read own referral redemptions" on public.referral_redemptions;
create policy "Users read own referral redemptions"
  on public.referral_redemptions for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- Inserts/updates are performed by FastAPI with the service role only.

comment on table public.referral_invites is
  'Shareable referral codes; one code per inviter. Free users may invite; Stripe credit applies only when invitee pays Pro+.';
comment on table public.referral_redemptions is
  'One redemption per invitee. Credit applied once when invitee first subscribes to Premium/Realtor.';
