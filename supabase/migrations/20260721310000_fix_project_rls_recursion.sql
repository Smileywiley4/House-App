-- Fix project collaboration RLS:
-- 1) Infinite recursion between user_projects <-> project_members policies
-- 2) Unqualified column refs that Postgres bound to the subquery alias
--    (e.g. m.project_id = m.project_id — always true; m.project_id = m.id)
-- Use SECURITY DEFINER helpers so policies do not re-enter RLS on peer tables.

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_projects up
    where up.id = p_project_id
      and up.user_id = auth.uid()
  );
$$;

create or replace function public.is_accepted_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.status = 'accepted'
  );
$$;

revoke all on function public.is_project_owner(uuid) from public;
revoke all on function public.is_accepted_project_member(uuid) from public;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.is_accepted_project_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- user_projects
-- ---------------------------------------------------------------------------
drop policy if exists "Users manage own projects" on public.user_projects;
create policy "Users manage own projects"
  on public.user_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members read shared projects" on public.user_projects;
create policy "Members read shared projects"
  on public.user_projects for select
  using (public.is_accepted_project_member(id));

-- ---------------------------------------------------------------------------
-- project_members
-- ---------------------------------------------------------------------------
drop policy if exists "Project members select" on public.project_members;
create policy "Project members select"
  on public.project_members for select
  using (
    auth.uid() = user_id
    or auth.uid() = invited_by
    or public.is_project_owner(project_id)
  );

drop policy if exists "Owners invite project members" on public.project_members;
create policy "Owners invite project members"
  on public.project_members for insert
  with check (
    public.is_project_owner(project_id)
    and auth.uid() = invited_by
  );

drop policy if exists "Participants update project members" on public.project_members;
create policy "Participants update project members"
  on public.project_members for update
  using (
    auth.uid() = user_id
    or public.is_project_owner(project_id)
  )
  with check (
    auth.uid() = user_id
    or public.is_project_owner(project_id)
  );

drop policy if exists "Owners remove project members" on public.project_members;
create policy "Owners remove project members"
  on public.project_members for delete
  using (public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- user_project_properties
-- ---------------------------------------------------------------------------
drop policy if exists "Users manage own project properties" on public.user_project_properties;
create policy "Users manage own project properties"
  on public.user_project_properties for all
  using (
    auth.uid() = user_id
    or public.is_project_owner(project_id)
    or public.is_accepted_project_member(project_id)
  )
  with check (
    auth.uid() = user_id
    and (
      public.is_project_owner(project_id)
      or public.is_accepted_project_member(project_id)
    )
  );

comment on function public.is_project_owner(uuid) is
  'RLS helper: true when auth.uid() owns the project (bypasses RLS to avoid recursion).';
comment on function public.is_accepted_project_member(uuid) is
  'RLS helper: true when auth.uid() is an accepted collaborator (bypasses RLS to avoid recursion).';
