-- Keep profiles.email in sync when auth.users.email changes
-- (e.g. after the user confirms a Supabase email-change link).
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id
      and email is distinct from new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_updated();
