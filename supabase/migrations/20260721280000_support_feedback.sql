-- In-app feedback / bug reports (service-role writes from Python API).
-- Complements mailto support@proppocket.com — not a full ticketing system.

create table if not exists public.support_feedback (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('problem', 'feedback')),
  message text not null,
  page_url text,
  user_id uuid,
  user_email text,
  contact_email text,
  user_agent text,
  has_screenshot boolean not null default false,
  email_sent boolean not null default false
);

create index if not exists idx_support_feedback_created_at
  on public.support_feedback (created_at desc);

create index if not exists idx_support_feedback_user_id
  on public.support_feedback (user_id)
  where user_id is not null;

alter table public.support_feedback enable row level security;

-- No client policies: inserts/reads via service role only.

comment on table public.support_feedback is
  'Lightweight in-app feedback submissions; emailed to support when Resend is configured.';
