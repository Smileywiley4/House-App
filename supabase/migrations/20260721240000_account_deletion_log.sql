-- Minimal audit log for account deletions (billing/legal retention; no payment card data).
-- Survives auth.users cascade so admins can reconcile Google Sheets CRM and Stripe.

create table if not exists public.account_deletion_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  email_hash text,
  plan_at_deletion text,
  had_stripe_customer boolean not null default false,
  stripe_cancelled boolean not null default false,
  sheet_marked boolean not null default false,
  source text not null default 'profile_delete',
  deleted_at timestamptz not null default now()
);

create index if not exists idx_account_deletion_log_deleted_at
  on public.account_deletion_log (deleted_at desc);

create index if not exists idx_account_deletion_log_user_id
  on public.account_deletion_log (user_id);

alter table public.account_deletion_log enable row level security;

-- No client policies: service role only (admin audit).

comment on table public.account_deletion_log is
  'Audit of account deletions for CRM/Sheets sync and billing reconciliation. No card numbers.';
