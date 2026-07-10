-- Learned preferences, gamified questionnaire, realtor → client property assignments

alter table public.clients
  add column if not exists client_user_id uuid references auth.users(id) on delete set null;

comment on column public.clients.client_user_id is 'Linked app user when client has registered';

-- Realtor pushes a property for client to tour + gamified questionnaire
create table if not exists public.realtor_property_assignments (
  id uuid primary key default uuid_generate_v4(),
  realtor_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  property_address text not null,
  property_snapshot jsonb not null default '{}',
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'archived')),
  assigned_at timestamptz default now(),
  completed_at timestamptz,
  read_at timestamptz
);

create index if not exists idx_realtor_assignments_client
  on public.realtor_property_assignments (client_user_id, status, assigned_at desc);
create index if not exists idx_realtor_assignments_realtor
  on public.realtor_property_assignments (realtor_id, assigned_at desc);

alter table public.realtor_property_assignments enable row level security;

create policy "Realtors manage own assignments"
  on public.realtor_property_assignments for all
  using (auth.uid() = realtor_id)
  with check (auth.uid() = realtor_id);

create policy "Clients read own assignments"
  on public.realtor_property_assignments for select
  using (auth.uid() = client_user_id);

create policy "Clients update own assignment status"
  on public.realtor_property_assignments for update
  using (auth.uid() = client_user_id)
  with check (auth.uid() = client_user_id);

-- Gamified walk-through session
create table if not exists public.questionnaire_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.realtor_property_assignments(id) on delete set null,
  property_address text not null,
  questions_total int not null default 0,
  questions_answered int not null default 0,
  completed boolean not null default false,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_questionnaire_sessions_user
  on public.questionnaire_sessions (user_id, started_at desc);

alter table public.questionnaire_sessions enable row level security;

create policy "Users manage own questionnaire sessions"
  on public.questionnaire_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Individual swipe / tap responses (feeds preference formula)
create table if not exists public.questionnaire_responses (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.questionnaire_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  category_label text not null,
  question_text text not null,
  response_value text not null
    check (response_value in ('love', 'like', 'neutral', 'dislike', 'hate')),
  signal_score numeric(4,2) not null,
  created_at timestamptz default now()
);

create index if not exists idx_questionnaire_responses_user_cat
  on public.questionnaire_responses (user_id, category_id, created_at desc);

alter table public.questionnaire_responses enable row level security;

create policy "Users manage own questionnaire responses"
  on public.questionnaire_responses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Running learned preference vector (EMA-updated category weights 0–10)
create table if not exists public.user_learned_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  weight numeric(5,2) not null default 5.0,
  confidence numeric(5,4) not null default 0.0,
  response_count int not null default 0,
  last_signal numeric(4,2),
  updated_at timestamptz default now(),
  primary key (user_id, category_id)
);

alter table public.user_learned_preferences enable row level security;

create policy "Users read own learned preferences"
  on public.user_learned_preferences for select
  using (auth.uid() = user_id);

-- Cached AI insight snippets (hidden preferences, suggestions)
create table if not exists public.preference_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_type text not null default 'profile'
    check (insight_type in ('profile', 'hidden', 'suggestion', 'assignment')),
  title text,
  body text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_preference_insights_user
  on public.preference_insights (user_id, created_at desc);

alter table public.preference_insights enable row level security;

create policy "Users read own preference insights"
  on public.preference_insights for select
  using (auth.uid() = user_id);

-- LLM usage audit (rate limiting)
create table if not exists public.llm_usage_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz default now()
);

create index if not exists idx_llm_usage_user_day
  on public.llm_usage_log (user_id, created_at desc);

alter table public.llm_usage_log enable row level security;

create policy "Users read own llm usage"
  on public.llm_usage_log for select
  using (auth.uid() = user_id);
