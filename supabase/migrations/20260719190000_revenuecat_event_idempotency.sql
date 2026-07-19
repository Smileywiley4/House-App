alter table public.iap_events
  add column if not exists event_id text;

create unique index if not exists iap_events_provider_event_id_unique
  on public.iap_events (provider, event_id)
  where event_id is not null;

comment on column public.iap_events.event_id is
  'Provider event identifier used to prevent duplicate webhook processing.';
