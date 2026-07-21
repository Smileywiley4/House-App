-- Track share lifecycle: Sent → Viewed → Scored (returned).
-- Extends property_shares with viewed_at / scored_at and a viewed status.

alter table public.property_shares
  add column if not exists viewed_at timestamptz,
  add column if not exists scored_at timestamptz;

-- Expand status check to include 'viewed' (recipient opened the share).
alter table public.property_shares drop constraint if exists property_shares_status_check;
alter table public.property_shares
  add constraint property_shares_status_check
  check (status in ('pending_score', 'viewed', 'scored', 'returned', 'cancelled'));

comment on column public.property_shares.viewed_at is
  'When the recipient first opened the shared property (detail or Evaluate).';
comment on column public.property_shares.scored_at is
  'When the recipient returned scores to the sender.';
comment on column public.property_shares.status is
  'pending_score (Sent) → viewed (Viewed) → returned/scored (Scored); cancelled.';
